/**
 * Admin promo-code report.
 *
 * Reads live from Stripe (no DB persistence): promotion codes give the
 * redemption counts; checkout sessions give WHO redeemed each one (we stamp
 * `metadata.userId` on every session, so we can join back to `users`).
 *
 * Scoped to the launch codes only. Admin-only.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { StripeService } from '../services/stripe.service';

// The two launch codes created by scripts/stripe-create-promo-codes.sh.
// Scoping to these keeps unrelated/future Stripe coupons out of the report.
const LAUNCH_CODES = new Set(['FreeThePitch100', 'LifesAPitch50']);

// Cap the session scan so a busy account can't make this endpoint run long.
// 10 pages × 100 = 1000 most-recent sessions, ample for launch-scale codes.
const MAX_SESSION_PAGES = 10;

interface Redeemer {
  userId: number | null;
  email: string | null;
  name: string | null;
  signedUpAt: string | null;
  redeemedAt: string | null;
  amountOff: number; // cents discounted on the checkout
}

interface CodeReport {
  id: string;
  code: string;
  percentOff: number | null;
  used: number;
  max: number | null;
  remaining: number | null;
  active: boolean;
  redeemers: Redeemer[];
}

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

// GET /api/admin/promo-codes
export async function adminPromoCodesHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const userId = await getUserId(request, env);

  if (!sql || !userId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }

  try {
    const [me] = await sql`SELECT user_type FROM users WHERE id = ${userId}`;
    if (me?.user_type !== 'admin') {
      return jsonResponse({ success: false, error: 'Admin access required' }, origin, 403);
    }

    const key = env.STRIPE_SECRET_KEY;
    if (!key) {
      return jsonResponse({ success: false, error: 'Stripe is not configured' }, origin, 503);
    }
    const stripe = new StripeService(key);

    // 1. Promotion codes → counts + percent off. Build promo-id → report shell.
    const pcRes = await stripe.listPromotionCodes();
    const byId = new Map<string, CodeReport>();
    for (const pc of pcRes.data || []) {
      if (!LAUNCH_CODES.has(pc.code)) continue;
      byId.set(pc.id, {
        id: pc.id,
        code: pc.code,
        percentOff: pc.coupon?.percent_off ?? null,
        used: pc.times_redeemed ?? 0,
        max: pc.max_redemptions ?? null,
        remaining: pc.max_redemptions != null ? Math.max(0, pc.max_redemptions - (pc.times_redeemed ?? 0)) : null,
        active: pc.active !== false,
        redeemers: [],
      });
    }

    if (byId.size === 0) {
      // Codes not created yet (run scripts/stripe-create-promo-codes.sh).
      return jsonResponse({ success: true, data: { codes: [] } }, origin);
    }

    // 2. Scan recent checkout sessions for redemptions of our codes.
    const redemptions: { promoId: string; userId: number | null; amountOff: number; redeemedAt: string | null }[] = [];
    let startingAfter: string | undefined;
    let pages = 0;
    do {
      const res = await stripe.listCheckoutSessions(startingAfter);
      const sessions = res.data || [];
      for (const s of sessions) {
        if (s.status && s.status !== 'complete') continue;
        const promoId: string | undefined = s.discounts?.[0]?.promotion_code;
        if (!promoId || !byId.has(promoId)) continue;
        const parsed = parseInt(s.metadata?.userId, 10);
        redemptions.push({
          promoId,
          userId: Number.isFinite(parsed) ? parsed : null,
          amountOff: s.total_details?.amount_discount ?? 0,
          redeemedAt: s.created ? new Date(s.created * 1000).toISOString() : null,
        });
      }
      startingAfter = res.has_more && sessions.length ? sessions[sessions.length - 1].id : undefined;
      pages += 1;
    } while (startingAfter && pages < MAX_SESSION_PAGES);

    // 3. Resolve the redeeming users in one query.
    const uids = [...new Set(redemptions.map((r) => r.userId).filter((id): id is number => id != null))];
    const usersById = new Map<number, { email: string; name: string; created_at: string }>();
    if (uids.length) {
      const rows = await sql`
        SELECT id, email, COALESCE(name, username, email) AS name, created_at
        FROM users
        WHERE id = ANY(${uids})
      ` as { id: number; email: string; name: string; created_at: string }[];
      for (const u of rows) usersById.set(u.id, u);
    }

    for (const r of redemptions) {
      const report = byId.get(r.promoId);
      if (!report) continue;
      const u = r.userId != null ? usersById.get(r.userId) : undefined;
      report.redeemers.push({
        userId: r.userId,
        email: u?.email ?? null,
        name: u?.name ?? null,
        signedUpAt: u?.created_at ?? null,
        redeemedAt: r.redeemedAt,
        amountOff: r.amountOff,
      });
    }

    // Newest redemptions first within each code.
    const codes = [...byId.values()].map((c) => ({
      ...c,
      redeemers: c.redeemers.sort((a, b) => (b.redeemedAt ?? '').localeCompare(a.redeemedAt ?? '')),
    }));

    return jsonResponse({ success: true, data: { codes } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('adminPromoCodesHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to load promo codes' }, origin, 500);
  }
}
