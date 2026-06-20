/**
 * Creator Deal Inbox — moat #6.
 *
 * The producer side (createProductionDeal, POST /api/production/deals) already
 * inserts a `production_deals` row targeting `creator_id` and notifies the creator
 * — but there was NO creator-side endpoint, so the flow dead-ended: the creator was
 * pinged about an offer with no way to act on it. This closes that gap with the
 * inbox + accept/counter/reject, unblocking Pillar 4 (deal continuity).
 *
 * deal_state is the `investment_deal_state` enum:
 *   inquiry → nda_required → nda_signed → due_diligence → negotiation →
 *   term_sheet → legal_review → funding → completed | cancelled
 * A proposed production deal starts at `inquiry`. Creator actions map to:
 *   accept  → negotiation   (willing to proceed; producer drives the pipeline)
 *   counter → negotiation   (+ counter terms recorded)
 *   reject  → cancelled
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { safeQuery } from '../db/safe-query';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}
function errorResponse(message: string, origin: string | null, status = 400): Response {
  return jsonResponse({ success: false, error: message }, origin, status);
}

// States in which a creator can still respond to a deal (early pipeline). Past
// these the producer owns the pipeline (DD, legal, funding) and a creator
// accept/reject no longer applies.
const ACTIONABLE_STATES = new Set(['inquiry', 'nda_required', 'nda_signed', 'negotiation']);

const ACTION_MAP: Record<string, { state: string; type: string; title: string; message: string }> = {
  accept: { state: 'negotiation', type: 'deal_accepted', title: 'Deal Accepted', message: 'The creator accepted your deal proposal' },
  counter: { state: 'negotiation', type: 'deal_countered', title: 'Counter-Offer', message: 'The creator sent a counter-offer on your deal' },
  reject: { state: 'cancelled', type: 'deal_rejected', title: 'Deal Declined', message: 'The creator declined your deal proposal' },
};

/** GET /api/creator/deals — the creator's deal inbox. */
export async function getCreatorDeals(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { deals: [], total: 0 } }, origin);

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || '';
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

    const dealsResult = await safeQuery(() => sql`
      SELECT d.id, d.pitch_id, d.production_company_id, d.deal_type,
             d.deal_state AS status,
             COALESCE(d.option_amount, d.purchase_price, d.development_fee, 0) AS amount,
             d.backend_percentage, d.notes, d.created_at, d.state_changed_at,
             d.outcome::text AS outcome, d.outcome_amount, d.outcome_terms, d.closed_at,
             d.outcome_confirmed_by_creator, d.outcome_confirmed_by_production,
             p.title AS pitch_title, p.genre AS pitch_genre,
             COALESCE(NULLIF(TRIM(pc.first_name || ' ' || pc.last_name), ''), pc.company_name, pc.username, 'Production company') AS producer_name
      FROM production_deals d
      LEFT JOIN pitches p ON d.pitch_id = p.id
      LEFT JOIN users pc ON d.production_company_id = pc.id
      WHERE d.creator_id = ${Number(userId)}
        AND (${status} = '' OR d.deal_state::text = ${status})
      ORDER BY d.created_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `, { fallback: [], context: 'creator-deals.list' });

    const countResult = await safeQuery<{ total: number }>(() => sql`
      SELECT COUNT(*)::int AS total FROM production_deals
      WHERE creator_id = ${Number(userId)}
        AND (${status} = '' OR deal_state::text = ${status})
    `, { fallback: [{ total: 0 }], context: 'creator-deals.count' });

    const deals = (dealsResult.rows as Array<Record<string, unknown>>).map((d) => ({
      ...d,
      actionable: ACTIONABLE_STATES.has(String(d.status)),
    }));

    return jsonResponse({ success: true, data: { deals, total: countResult.rows[0]?.total || 0 } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getCreatorDeals error:', e.message);
    return jsonResponse({ success: true, data: { deals: [], total: 0 } }, origin);
  }
}

/** POST /api/creator/deals/:id/respond — accept / counter / reject. */
export async function respondToCreatorDeal(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const dealId = Number(parts[parts.length - 2]); // /api/creator/deals/:id/respond
    if (!dealId || Number.isNaN(dealId)) return errorResponse('Invalid deal id', origin);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const message = typeof body.message === 'string' ? body.message.slice(0, 2000) : '';
    const counterAmount = action === 'counter' && Number.isFinite(body.counterAmount as number)
      ? Number(body.counterAmount) : null;

    const map = ACTION_MAP[action];
    if (!map) return errorResponse(`Invalid action. Must be one of: ${Object.keys(ACTION_MAP).join(', ')}`, origin);

    // Load + ownership-gate the deal.
    const [deal] = await sql`
      SELECT id, creator_id, production_company_id, pitch_id, deal_state
      FROM production_deals WHERE id = ${dealId}
    `;
    if (!deal) return errorResponse('Deal not found', origin, 404);
    if (String((deal as Record<string, unknown>).creator_id) !== String(userId)) {
      return errorResponse('Forbidden', origin, 403);
    }
    if (!ACTIONABLE_STATES.has(String((deal as Record<string, unknown>).deal_state))) {
      return errorResponse(`This deal can no longer be ${action}ed (state: ${(deal as Record<string, unknown>).deal_state}).`, origin, 409);
    }

    const noteSuffix = message ? `\n[Creator ${action}]: ${message}` : '';
    const [updated] = await sql`
      UPDATE production_deals
      SET deal_state = ${map.state}::investment_deal_state,
          option_amount = COALESCE(${counterAmount}, option_amount),
          notes = COALESCE(notes, '') || ${noteSuffix},
          state_changed_at = NOW(), state_changed_by = ${Number(userId)}, updated_at = NOW()
      WHERE id = ${dealId} AND creator_id = ${Number(userId)}
      RETURNING id, deal_state AS status,
                COALESCE(option_amount, purchase_price, development_fee, 0) AS amount, pitch_id
    `;

    // Notify the producer — best-effort.
    await safeQuery(() => sql`
      INSERT INTO notifications (user_id, type, title, message, related_user_id, related_pitch_id, created_at)
      VALUES (
        ${(deal as Record<string, unknown>).production_company_id}, ${map.type}, ${map.title}, ${map.message},
        ${Number(userId)}, ${(deal as Record<string, unknown>).pitch_id}, NOW()
      )
    `, { fallback: [], context: 'creator-deals.respond.notify' });

    return jsonResponse({ success: true, data: { deal: updated } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('respondToCreatorDeal error:', e.message);
    return errorResponse('Failed to respond to deal', origin, 500);
  }
}
