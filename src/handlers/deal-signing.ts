/**
 * Deal-sheet e-signature — P5.0 of the deal-servicing roadmap.
 *
 * Promotes the deal sheet (getProductionContract) from a rendered VIEW into a
 * BINDING, hash-sealed, co-signed instrument. This is the cheapest real on-platform
 * lock-in: NO payments, NO Stripe Connect, NO take-rate, NO PCI surface. A co-signed,
 * content-hash-sealed deal sheet living on Pitchey is a switching cost — a reason to
 * transact on-platform rather than just record (P1) a deal that happened elsewhere.
 *
 * BOTH-SIDED, mirroring deal-outcome.ts: either party (the deal's creator or its
 * production company) may sign; the caller's role is resolved from the deal row, not
 * the route. A deal is "fully executed" when BOTH parties have a current signature
 * (content_hash matching the live deal sheet). If a term is changed after one party
 * signs, the live hash diverges and the read path flags the stale signature — so the
 * sheet cannot be silently altered post-signature.
 *
 * Wired:
 *   POST /api/deals/:id/sign        — sign (or re-affirm) the current deal sheet
 *   GET  /api/deals/:id/signatures  — both parties' signature state + tamper check
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { safeQuery } from '../db/safe-query';
import { sealDealSheet } from '../services/deal-signing';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}
function errorResponse(message: string, origin: string | null, status = 400): Response {
  return jsonResponse({ success: false, error: message }, origin, status);
}

// The columns needed to (a) party-gate and (b) seal the binding terms.
const DEAL_COLUMNS = `
  id, pitch_id, creator_id, production_company_id,
  deal_type, option_amount, purchase_price, backend_percentage,
  development_fee, rights_territory, notes
`;

interface SignatureRow {
  signer_id: number;
  party: string;
  status: string;
  content_hash: string;
  signed_name: string;
  signed_at: string;
}

function dealIdFromPath(url: string, segmentFromEnd: number): number {
  const parts = new URL(url).pathname.split('/');
  return Number(parts[parts.length - segmentFromEnd]);
}

/** POST /api/deals/:id/sign — sign or re-affirm the current deal sheet. */
export async function signDeal(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const dealId = dealIdFromPath(request.url, 2); // /api/deals/:id/sign
    if (!dealId || Number.isNaN(dealId)) return errorResponse('Invalid deal id', origin);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const signedName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : '';
    const agreed = body.agreed === true || body.acceptTerms === true;
    if (!signedName) return errorResponse('A typed full legal name is required to sign', origin);
    if (!agreed) return errorResponse('You must agree to the deal terms to sign', origin);

    const [deal] = await sql.query(
      `SELECT ${DEAL_COLUMNS} FROM production_deals WHERE id = $1`,
      [dealId],
    ) as unknown as Record<string, unknown>[];
    if (!deal) return errorResponse('Deal not found', origin, 404);

    const isCreator = String(deal.creator_id) === String(userId);
    const isProduction = String(deal.production_company_id) === String(userId);
    if (!isCreator && !isProduction) return errorResponse('Forbidden', origin, 403);
    const party = isCreator ? 'creator' : 'production';

    // Seal the CURRENT deal sheet — this is exactly what the signer is binding to.
    const seal = await sealDealSheet(deal);

    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;
    const ua = request.headers.get('User-Agent') || null;
    const signatureData = JSON.stringify({
      agreed: true,
      fullName: signedName,
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : '',
      signedAt: new Date().toISOString(),
    });

    // One signature per (deal, signer); re-signing re-affirms against the current hash.
    await sql`
      INSERT INTO deal_signatures
        (deal_id, signer_id, party, status, content_hash, algorithm, signed_name, signed_at, ip_address, user_agent, signature_data)
      VALUES
        (${dealId}, ${userId}, ${party}, 'signed', ${seal.hash}, ${seal.algorithm}, ${signedName}, NOW(), ${ip}, ${ua}, ${signatureData})
      ON CONFLICT (deal_id, signer_id) DO UPDATE SET
        status = 'signed',
        content_hash = EXCLUDED.content_hash,
        algorithm = EXCLUDED.algorithm,
        signed_name = EXCLUDED.signed_name,
        signed_at = NOW(),
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        signature_data = EXCLUDED.signature_data,
        revoked_at = NULL
    `;

    // Did this complete a fully-executed (both parties, current hash) deal sheet?
    const sigs = await sql`
      SELECT signer_id, party, status, content_hash
      FROM deal_signatures WHERE deal_id = ${dealId} AND status = 'signed'
    ` as unknown as SignatureRow[];
    const creatorSigned = sigs.some(s => s.party === 'creator' && s.content_hash === seal.hash);
    const productionSigned = sigs.some(s => s.party === 'production' && s.content_hash === seal.hash);
    const fullyExecuted = creatorSigned && productionSigned;

    // Notify the counterparty — best-effort, mirrors deal-outcome.notify.
    const counterpartyId = isCreator ? deal.production_company_id : deal.creator_id;
    await safeQuery(() => sql`
      INSERT INTO notifications (user_id, type, title, message, related_user_id, related_pitch_id, created_at)
      VALUES (
        ${counterpartyId as number}, 'deal_signed',
        ${fullyExecuted ? 'Deal sheet fully executed' : 'Deal sheet signed'},
        ${fullyExecuted
          ? 'Both parties have signed the deal sheet. It is now a sealed, binding record on Pitchey.'
          : 'The other party signed the deal sheet. Sign to make it a sealed, binding record.'},
        ${userId}, ${deal.pitch_id as number | null}, NOW()
      )
    `, { fallback: [], context: 'deal-signing.notify' });

    return jsonResponse({
      success: true,
      data: { dealId, party, contentHash: seal.hash, fullyExecuted },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('signDeal error:', e.message);
    return errorResponse('Failed to sign deal sheet', origin, 500);
  }
}

/** GET /api/deals/:id/signatures — both parties' signature state + tamper check. */
export async function getDealSignatures(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const dealId = dealIdFromPath(request.url, 1); // /api/deals/:id/signatures
    if (!dealId || Number.isNaN(dealId)) return errorResponse('Invalid deal id', origin);

    const [deal] = await sql.query(
      `SELECT ${DEAL_COLUMNS} FROM production_deals WHERE id = $1`,
      [dealId],
    ) as unknown as Record<string, unknown>[];
    if (!deal) return errorResponse('Deal not found', origin, 404);

    const isCreator = String(deal.creator_id) === String(userId);
    const isProduction = String(deal.production_company_id) === String(userId);
    if (!isCreator && !isProduction) return errorResponse('Forbidden', origin, 403);
    const viewerParty = isCreator ? 'creator' : 'production';

    // Seal the live sheet — the reference hash every signature is compared against.
    const seal = await sealDealSheet(deal);

    const result = await safeQuery<SignatureRow>(() => sql`
      SELECT signer_id, party, status, content_hash, signed_name, signed_at
      FROM deal_signatures
      WHERE deal_id = ${dealId} AND status = 'signed'
      ORDER BY signed_at ASC
    `, { fallback: [], context: 'deal-signing.list' });
    if (!result.ok) return errorResponse('Failed to load signatures', origin, 500);

    const signatures = result.rows.map(s => ({
      party: s.party,
      signedName: s.signed_name,
      signedAt: s.signed_at,
      contentHash: s.content_hash,
      // false ⇒ a term changed after this party signed (stale/ tampered signature).
      matchesCurrent: s.content_hash === seal.hash,
    }));

    const creatorCurrent = signatures.some(s => s.party === 'creator' && s.matchesCurrent);
    const productionCurrent = signatures.some(s => s.party === 'production' && s.matchesCurrent);

    return jsonResponse({
      success: true,
      data: {
        dealId,
        currentHash: seal.hash,
        algorithm: seal.algorithm,
        fullyExecuted: creatorCurrent && productionCurrent,
        // true ⇒ at least one signature was made against an older version of the sheet.
        hasStaleSignature: signatures.some(s => !s.matchesCurrent),
        // viewer context — lets the UI show "you signed" vs the sign action.
        viewerParty,
        viewerSigned: signatures.some(s => s.party === viewerParty && s.matchesCurrent),
        signatures,
      },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getDealSignatures error:', e.message);
    return errorResponse('Failed to load deal signatures', origin, 500);
  }
}
