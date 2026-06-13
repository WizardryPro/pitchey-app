/**
 * Admin promo-code report.
 *
 * Reads live from Stripe (no DB persistence): promotion codes give the
 * redemption counts; checkout sessions give WHO redeemed each one (we stamp
 * `metadata.userId` on every session, so we can join back to `users`).
 *
 * Scoped to the named launch codes PLUS any promo code carrying a
 * `metadata.cohort` tag (e.g. the film-industry seeding codes — one code with
 * 50 redemptions, or 50 single-use codes, both surface here). Admin-only.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { StripeService } from '../services/stripe.service';
import { WorkerEmailService } from '../services/worker-email';

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
  cohort: string | null; // metadata.cohort tag, e.g. 'film-industry'; null for launch codes
  recipient: string | null; // metadata.recipient — who Karl assigned/sent this code to
  recipientEmail: string | null; // metadata.recipient_email
  sentAt: string | null; // metadata.sent_at — when the invite email went out
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
      const cohort = pc.metadata?.cohort ? String(pc.metadata.cohort) : null;
      // Include the named launch codes, plus any cohort-tagged code (the
      // film-industry seeding codes carry metadata.cohort). Everything else
      // (unrelated Stripe coupons) stays out of the report.
      if (!LAUNCH_CODES.has(pc.code) && !cohort) continue;
      byId.set(pc.id, {
        id: pc.id,
        code: pc.code,
        cohort,
        recipient: pc.metadata?.recipient ? String(pc.metadata.recipient) : null,
        recipientEmail: pc.metadata?.recipient_email ? String(pc.metadata.recipient_email) : null,
        sentAt: pc.metadata?.sent_at ? String(pc.metadata.sent_at) : null,
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

// Readable random suffix (no ambiguous chars) for generated codes.
function randomSuffix(len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return s;
}

// POST /api/admin/promo-codes/generate
// Mint N single-use film-industry promo codes server-side, using the worker's
// own live Stripe key (no terminal / sk_live needed). Each code is max-1
// redemption, tagged metadata.cohort so it surfaces in the report + can be
// assigned/sent. Admin-only. Creating codes does NOT consume anything.
export async function createPromoCodesHandler(request: Request, env: Env): Promise<Response> {
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

    const body = (await request.json().catch(() => ({}))) as { count?: number; percentOff?: number };
    const count = Math.max(1, Math.min(50, Math.floor(Number(body.count) || 0)));
    const percentOff = Math.max(1, Math.min(100, Math.floor(Number(body.percentOff ?? 100))));
    if (!count) return jsonResponse({ success: false, error: 'Count must be between 1 and 50' }, origin, 400);

    const key = env.STRIPE_SECRET_KEY;
    if (!key) return jsonResponse({ success: false, error: 'Stripe is not configured' }, origin, 503);
    const stripe = new StripeService(key);

    const cohort = 'film-industry';
    const couponId = `ptchy_${cohort.replace(/-/g, '_')}_${percentOff}`;

    // Create-or-reuse the coupon (fixed id keeps it idempotent across runs).
    let coupon = await stripe.retrieveCoupon(couponId);
    if (!coupon?.id) {
      coupon = await stripe.createCoupon({
        id: couponId,
        percentOff,
        duration: 'forever',
        name: `Film Industry (${percentOff}% off)`,
        metadata: { cohort },
      });
    }
    if (!coupon?.id) {
      return jsonResponse({ success: false, error: 'Failed to create coupon' }, origin, 502);
    }

    const created: { id: string; code: string }[] = [];
    for (let i = 0; i < count; i++) {
      // Retry on the rare random-code collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = `FILMIND-${randomSuffix()}`;
        try {
          const pc = await stripe.createPromotionCode({
            coupon: couponId,
            code,
            maxRedemptions: 1,
            metadata: { cohort },
          });
          if (pc?.id) { created.push({ id: pc.id, code: pc.code }); break; }
        } catch {
          // duplicate code or transient — try another suffix
        }
      }
    }

    return jsonResponse({ success: true, data: { created, count: created.length, percentOff } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('createPromoCodesHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to generate codes' }, origin, 500);
  }
}

// POST /api/admin/promo-codes/send
// Assign an industry promo code to a recipient and email it to them.
// Admin-only. Stamps metadata.recipient / recipient_email / sent_at on the
// Stripe promotion code (so the report shows assignment state) and sends the
// code via Resend. Creating/assigning is allowed; it does NOT redeem the code.
export async function sendPromoInviteHandler(request: Request, env: Env): Promise<Response> {
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

    const body = (await request.json().catch(() => ({}))) as {
      promoId?: string; code?: string; recipientName?: string; recipientEmail?: string;
    };
    const promoId = (body.promoId || '').trim();
    const recipientName = (body.recipientName || '').trim();
    const recipientEmail = (body.recipientEmail || '').trim().toLowerCase();

    if (!promoId) return jsonResponse({ success: false, error: 'Missing promo code id' }, origin, 400);
    if (!recipientName) return jsonResponse({ success: false, error: 'Recipient name is required' }, origin, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      return jsonResponse({ success: false, error: 'A valid recipient email is required' }, origin, 400);
    }

    const key = env.STRIPE_SECRET_KEY;
    const resendKey = (env as Record<string, unknown>).RESEND_API_KEY as string | undefined;
    if (!key) return jsonResponse({ success: false, error: 'Stripe is not configured' }, origin, 503);
    if (!resendKey) return jsonResponse({ success: false, error: 'Email (Resend) is not configured' }, origin, 503);

    const stripe = new StripeService(key);

    // Re-fetch the code to get its string + guard it's a cohort (industry) code,
    // so this endpoint can't be used to blast arbitrary coupons.
    const pcList = await stripe.listPromotionCodes();
    const pc = (pcList.data || []).find((p: any) => p.id === promoId);
    if (!pc) return jsonResponse({ success: false, error: 'Promo code not found' }, origin, 404);
    if (!pc.metadata?.cohort) {
      return jsonResponse({ success: false, error: 'Only cohort (industry) codes can be sent from here' }, origin, 400);
    }

    const code: string = pc.code;
    // Land cold recipients on signup (the "Have a promo code?" field lives in the
    // subscribe/billing flow, which requires an account first).
    const startUrl = 'https://pitchey-5o8.pages.dev/register';
    const email = new WorkerEmailService({ apiKey: resendKey, fromEmail: 'noreply@pitchey.com', fromName: 'Pitchey' });
    const subject = "You're invited to Pitchey — your access code inside";
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="color:#7B3FBF">You've been invited to Pitchey</h2>
        <p>Hi ${recipientName.split(' ')[0] || 'there'},</p>
        <p>You've been given complimentary access to <strong>Pitchey</strong> — the marketplace where film creators, investors, and production companies connect.</p>
        <p>Your personal access code:</p>
        <p style="font-size:22px;font-weight:700;letter-spacing:1px;background:#f3f0fb;border:1px solid #e0d8f5;border-radius:8px;padding:14px 18px;text-align:center;color:#4d42b0">${code}</p>
        <p><strong>How to use it:</strong> create your account, then open <strong>Billing</strong>, choose a plan, and enter this code in the “Have a promo code?” field — it applies your discount before you pay.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${startUrl}" style="background:#7B3FBF;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Create your account</a>
        </p>
        <p style="color:#666;font-size:13px">This code is reserved for you. If you weren't expecting this, you can ignore the email.</p>
      </div>`;
    const text = `You've been invited to Pitchey.\n\nYour access code: ${code}\n\nCreate your account, then open Billing, pick a plan, and enter this code in the "Have a promo code?" field to apply your discount.\n\n${startUrl}`;

    // Send the email FIRST. Only stamp the code as "sent" if the email actually
    // went out — otherwise a Resend hiccup would leave the panel showing a false
    // "Sent" for a recipient who never received anything.
    const sendResult = await email.send(
      { to: recipientEmail, subject, html, text },
      { userId, templateType: 'promo_invite' }
    );
    if (!sendResult.success) {
      return jsonResponse({ success: false, error: `Email failed — code NOT marked sent, try again: ${sendResult.error || 'unknown'}` }, origin, 502);
    }

    const sentAt = new Date().toISOString();
    await stripe.updatePromotionCodeMetadata(promoId, {
      recipient: recipientName,
      recipient_email: recipientEmail,
      sent_at: sentAt,
    });

    return jsonResponse({
      success: true,
      data: { code, recipient: recipientName, recipientEmail, sentAt },
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('sendPromoInviteHandler error:', e.message);
    return jsonResponse({ success: false, error: 'Failed to send invite' }, origin, 500);
  }
}
