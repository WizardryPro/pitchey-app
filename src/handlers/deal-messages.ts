/**
 * Deal negotiation thread — Phase 3 of the disintermediation-defense roadmap.
 *
 * Keeps the back-and-forth on a deal ON Pitchey instead of in email. Today counters
 * are a text-blob in `production_deals.notes`; this is a structured, deal-scoped
 * thread: each entry records who sent it, when, an optional free-form message, and
 * an optional structured terms-delta (proposed amount / terms).
 *
 * NON-binding by design: the deal state machine (accept/counter/reject in
 * creator-deals.ts, mark-outcome in deal-outcome.ts) still owns status + standing
 * terms. The thread is the conversation around it. Role-neutral — both portals hit
 * the same routes; the caller's role is resolved from the deal row.
 *
 *   GET  /api/deals/:id/messages   — list the thread (party-gated)
 *   POST /api/deals/:id/messages   — post a message / structured counter (party-gated)
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

interface DealParties {
  id: number;
  creator_id: number;
  production_company_id: number;
  pitch_id: number | null;
}

function dealIdFromPath(url: string): number {
  const parts = new URL(url).pathname.split('/'); // /api/deals/:id/messages
  return Number(parts[parts.length - 2]);
}

/** Load the deal and resolve the caller's party role, or null if not a party. */
async function loadPartyDeal(sql: ReturnType<typeof getDb>, dealId: number, userId: string | number) {
  const [deal] = await sql`
    SELECT id, creator_id, production_company_id, pitch_id
    FROM production_deals WHERE id = ${dealId}
  ` as unknown as DealParties[];
  if (!deal) return { deal: null as DealParties | null, role: null as 'creator' | 'production' | null };
  const role = String(deal.creator_id) === String(userId) ? 'creator'
    : String(deal.production_company_id) === String(userId) ? 'production'
    : null;
  return { deal, role };
}

/** GET /api/deals/:id/messages */
export async function getDealMessages(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { messages: [] } }, origin);

  try {
    const dealId = dealIdFromPath(request.url);
    if (!dealId || Number.isNaN(dealId)) return errorResponse('Invalid deal id', origin);

    const { deal, role } = await loadPartyDeal(sql, dealId, userId);
    if (!deal) return errorResponse('Deal not found', origin, 404);
    if (!role) return errorResponse('Forbidden', origin, 403);

    const result = await safeQuery(() => sql`
      SELECT m.id, m.sender_id, m.sender_role, m.kind, m.body,
             m.proposed_amount, m.proposed_terms, m.created_at,
             COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.company_name, u.username, 'User') AS sender_name
      FROM deal_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.deal_id = ${dealId}
      ORDER BY m.created_at ASC
    `, { fallback: [], context: 'deal-messages.list' });

    return jsonResponse({ success: true, data: { messages: result.rows } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getDealMessages error:', e.message);
    return jsonResponse({ success: true, data: { messages: [] } }, origin);
  }
}

/** POST /api/deals/:id/messages */
export async function postDealMessage(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const dealId = dealIdFromPath(request.url);
    if (!dealId || Number.isNaN(dealId)) return errorResponse('Invalid deal id', origin);

    const { deal, role } = await loadPartyDeal(sql, dealId, userId);
    if (!deal) return errorResponse('Deal not found', origin, 404);
    if (!role) return errorResponse('Forbidden', origin, 403);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const text = typeof body.body === 'string' ? body.body.slice(0, 4000).trim() : '';
    const proposedAmount = Number.isFinite(body.proposedAmount as number) ? Number(body.proposedAmount) : null;
    const proposedTerms = typeof body.proposedTerms === 'string' ? body.proposedTerms.slice(0, 2000).trim() : '';

    if (!text && proposedAmount === null && !proposedTerms) {
      return errorResponse('Message body or a proposed term is required', origin);
    }
    const kind = (proposedAmount !== null || proposedTerms) ? 'counter' : 'message';

    const [message] = await sql`
      INSERT INTO deal_messages (deal_id, sender_id, sender_role, kind, body, proposed_amount, proposed_terms)
      VALUES (${dealId}, ${userId}, ${role}, ${kind}, ${text || null}, ${proposedAmount}, ${proposedTerms || null})
      RETURNING id, sender_id, sender_role, kind, body, proposed_amount, proposed_terms, created_at
    ` as unknown as Record<string, unknown>[];

    // Notify the counterparty — best-effort.
    const counterpartyId = role === 'creator' ? deal.production_company_id : deal.creator_id;
    await safeQuery(() => sql`
      INSERT INTO notifications (user_id, type, title, message, related_user_id, related_pitch_id, created_at)
      VALUES (
        ${counterpartyId}, 'deal_message',
        ${kind === 'counter' ? 'New counter-offer' : 'New deal message'},
        ${kind === 'counter'
          ? 'The other party proposed new terms on your deal'
          : 'The other party sent a message on your deal'},
        ${userId}, ${deal.pitch_id}, NOW()
      )
    `, { fallback: [], context: 'deal-messages.notify' });

    return jsonResponse({ success: true, data: { message } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('postDealMessage error:', e.message);
    return errorResponse('Failed to post message', origin, 500);
  }
}
