/**
 * Deal outcome capture — Phase 1 of the disintermediation-defense roadmap
 * (deal system-of-record).
 *
 * Pitchey captures the high-value intro (NDA-gated connection + a `production_deals`
 * offer→accept/counter state machine) but, until now, kept NO record of how a deal
 * actually ended — a film deal that closed off-platform was indistinguishable from
 * one that closed on-platform or one that died. That blind spot IS the leak: better
 * intros with no outcome record accelerate disintermediation.
 *
 * This is a BOTH-SIDED action. Either party to a deal (the creator or the production
 * company) can mark the outcome; the counterparty confirms. Bilateral confirmation
 * flags (`outcome_confirmed_by_creator` / `outcome_confirmed_by_production`) feed the
 * Phase 2 reputation loop, which credits reputation ONLY on mutually-confirmed
 * outcomes — turning leakage into a reason to report the deal back.
 *
 * Marking an outcome does NOT add a new deal_state — it moves the deal to one of the
 * existing terminal `investment_deal_state` values and records the richer outcome:
 *   closed_on_platform | closed_off_platform  → deal_state = 'completed'
 *   dead                                       → deal_state = 'cancelled'
 *
 * Wired under both:
 *   POST /api/creator/deals/:id/outcome
 *   POST /api/production/deals/:id/outcome
 * The caller's role is resolved from the deal row, not the route, so the same logic
 * serves both sides.
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

// Outcome → existing terminal deal_state. We do NOT introduce new states.
const OUTCOME_TO_STATE: Record<string, 'completed' | 'cancelled'> = {
  closed_on_platform: 'completed',
  closed_off_platform: 'completed',
  dead: 'cancelled',
};

interface DealRow {
  id: number;
  creator_id: number;
  production_company_id: number;
  pitch_id: number | null;
  outcome: string | null;
  outcome_confirmed_by_creator: boolean;
  outcome_confirmed_by_production: boolean;
}

/** POST /api/{creator,production}/deals/:id/outcome — mark or confirm a deal outcome. */
export async function markDealOutcome(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const parts = new URL(request.url).pathname.split('/');
    const dealId = Number(parts[parts.length - 2]); // /.../deals/:id/outcome
    if (!dealId || Number.isNaN(dealId)) return errorResponse('Invalid deal id', origin);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const outcome = typeof body.outcome === 'string' ? body.outcome : '';
    if (!OUTCOME_TO_STATE[outcome]) {
      return errorResponse(`Invalid outcome. Must be one of: ${Object.keys(OUTCOME_TO_STATE).join(', ')}`, origin);
    }
    const terminalState = OUTCOME_TO_STATE[outcome];

    const amount = Number.isFinite(body.amount as number) ? Number(body.amount) : null;
    const terms = typeof body.terms === 'string' ? body.terms.slice(0, 4000) : null;
    // close date — accept an ISO date/datetime string; reject anything unparseable.
    let closeDate: string | null = null;
    if (typeof body.closeDate === 'string' && body.closeDate.trim()) {
      const parsed = new Date(body.closeDate);
      if (Number.isNaN(parsed.getTime())) return errorResponse('Invalid closeDate', origin);
      closeDate = parsed.toISOString();
    }

    // Load + party-gate the deal.
    const [deal] = await sql`
      SELECT id, creator_id, production_company_id, pitch_id, outcome::text AS outcome,
             outcome_confirmed_by_creator, outcome_confirmed_by_production
      FROM production_deals WHERE id = ${dealId}
    ` as unknown as DealRow[];
    if (!deal) return errorResponse('Deal not found', origin, 404);

    const isCreator = String(deal.creator_id) === String(userId);
    const isProduction = String(deal.production_company_id) === String(userId);
    if (!isCreator && !isProduction) return errorResponse('Forbidden', origin, 403);

    // A fresh assertion if there is no prior outcome OR the submitted outcome differs
    // from what's on record (a party correcting/changing it resets confirmations).
    const isReassert = deal.outcome === null || deal.outcome !== outcome;

    // Compute the two confirmation flags in JS so we can set both columns in one UPDATE.
    let creatorConfirmed: boolean;
    let productionConfirmed: boolean;
    if (isReassert) {
      creatorConfirmed = isCreator;       // the reporter has implicitly confirmed
      productionConfirmed = isProduction; // the other side must confirm separately
    } else {
      // Same outcome on record → this caller is confirming; keep the other side's flag.
      creatorConfirmed = isCreator ? true : deal.outcome_confirmed_by_creator;
      productionConfirmed = isProduction ? true : deal.outcome_confirmed_by_production;
    }

    let updated: Record<string, unknown> | undefined;
    if (isReassert) {
      [updated] = await sql`
        UPDATE production_deals
        SET outcome = ${outcome}::deal_outcome,
            deal_state = ${terminalState}::investment_deal_state,
            outcome_amount = ${amount},
            outcome_terms = ${terms},
            closed_at = ${closeDate}::timestamp,
            outcome_reported_by = ${Number(userId)},
            outcome_reported_at = NOW(),
            outcome_confirmed_by_creator = ${creatorConfirmed},
            outcome_confirmed_by_production = ${productionConfirmed},
            state_changed_at = NOW(), state_changed_by = ${Number(userId)}, updated_at = NOW()
        WHERE id = ${dealId}
        RETURNING id, deal_state AS status, outcome::text AS outcome,
                  outcome_amount, outcome_terms, closed_at,
                  outcome_confirmed_by_creator, outcome_confirmed_by_production
      ` as unknown as Record<string, unknown>[];
    } else {
      // Confirmation: flip this side's flag, optionally refine the reported figures.
      [updated] = await sql`
        UPDATE production_deals
        SET outcome_amount = COALESCE(${amount}, outcome_amount),
            outcome_terms = COALESCE(${terms}, outcome_terms),
            closed_at = COALESCE(${closeDate}::timestamp, closed_at),
            outcome_confirmed_by_creator = ${creatorConfirmed},
            outcome_confirmed_by_production = ${productionConfirmed},
            updated_at = NOW()
        WHERE id = ${dealId}
        RETURNING id, deal_state AS status, outcome::text AS outcome,
                  outcome_amount, outcome_terms, closed_at,
                  outcome_confirmed_by_creator, outcome_confirmed_by_production
      ` as unknown as Record<string, unknown>[];
    }

    const mutuallyConfirmed = creatorConfirmed && productionConfirmed;

    // Notify the counterparty — best-effort.
    const counterpartyId = isCreator ? deal.production_company_id : deal.creator_id;
    const verb = isReassert ? 'reported' : 'confirmed';
    await safeQuery(() => sql`
      INSERT INTO notifications (user_id, type, title, message, related_user_id, related_pitch_id, created_at)
      VALUES (
        ${counterpartyId}, 'deal_outcome',
        ${'Deal outcome ' + verb},
        ${'The other party ' + verb + ' this deal as ' + outcome.replace(/_/g, ' ') +
          (mutuallyConfirmed ? ' (now mutually confirmed).' : '. Confirm to finalise the record.')},
        ${Number(userId)}, ${deal.pitch_id}, NOW()
      )
    `, { fallback: [], context: 'deal-outcome.notify' });

    return jsonResponse({ success: true, data: { deal: updated, mutuallyConfirmed } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('markDealOutcome error:', e.message);
    return errorResponse('Failed to mark deal outcome', origin, 500);
  }
}
