/**
 * Admin credit adjustments — manual grant / revoke with an audit trail.
 *
 * Why this exists: refunds and goodwill adjustments previously required a
 * hand-written DB edit (the `charge.refunded` webhook only auto-reverses
 * credit-pack purchases it can link via metadata; everything else routes here).
 * Both endpoints are admin-gated, validate their body, mutate the canonical
 * balance in `user_credits`, and write a `credit_transactions` ledger row whose
 * `metadata` records the acting admin + reason — so every manual change is
 * auditable without a separate table or migration.
 *
 * Registered (and excluded from the AdminEndpointsHandler intercept) in
 * worker-integrated.ts:
 *   POST /api/admin/credits/grant   { userId, amount, reason }
 *   POST /api/admin/credits/revoke  { userId, amount, reason }
 */

import { z } from 'zod';
import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

const bodySchema = z.object({
  userId: z.coerce.number().int().positive(),
  amount: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

// Shared core for grant (delta > 0) and revoke (delta < 0). Returns the response.
async function adjustCredits(
  request: Request,
  env: Env,
  action: 'grant' | 'revoke',
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);
  const adminId = await getUserId(request, env);

  if (!sql || !adminId) {
    return jsonResponse({ success: false, error: 'Authentication required' }, origin, 401);
  }

  // Enforce admin inside the handler — once excluded from the /api/admin/*
  // intercept, the AdminEndpointsHandler's gate no longer applies.
  const [me] = await sql`SELECT user_type FROM users WHERE id = ${adminId}`;
  if (me?.user_type !== 'admin') {
    return jsonResponse({ success: false, error: 'Admin access required' }, origin, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, origin, 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { success: false, error: 'Invalid body', issues: parsed.error.issues },
      origin,
      400,
    );
  }
  const { userId, amount, reason } = parsed.data;

  try {
    const [target] = await sql`SELECT id FROM users WHERE id = ${userId}`;
    if (!target) {
      return jsonResponse({ success: false, error: 'Target user not found' }, origin, 404);
    }

    const currentRows = await sql`SELECT balance FROM user_credits WHERE user_id = ${userId}`;
    const balanceBefore = currentRows.length > 0 ? (currentRows[0].balance || 0) : 0;

    // Clamp so a revoke can never drive the balance below zero; the effective
    // delta is what actually moved (a grant always moves the full amount).
    const delta = action === 'grant' ? amount : -Math.min(amount, balanceBefore);
    const balanceAfter = balanceBefore + delta;

    if (action === 'grant') {
      await sql`
        INSERT INTO user_credits (user_id, balance, total_purchased, total_used, last_updated)
        VALUES (${userId}, ${amount}, ${amount}, 0, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          balance = user_credits.balance + ${amount},
          total_purchased = user_credits.total_purchased + ${amount},
          last_updated = NOW()
      `;
    } else if (delta !== 0) {
      await sql`
        UPDATE user_credits
        SET balance = ${balanceAfter}, last_updated = NOW()
        WHERE user_id = ${userId}
      `;
    }

    const meta = JSON.stringify({ admin_user_id: adminId, reason, admin_action: action });
    await sql`
      INSERT INTO credit_transactions (user_id, type, amount, description, balance_before, balance_after, metadata, created_at)
      VALUES (
        ${userId},
        ${action === 'grant' ? 'bonus' : 'refund'},
        ${delta},
        ${`Admin ${action}: ${reason}`},
        ${balanceBefore},
        ${balanceAfter},
        ${meta}::jsonb,
        NOW()
      )
    `;

    console.log(JSON.stringify({
      level: 'info',
      category: 'admin_credits',
      action,
      admin_user_id: adminId,
      target_user_id: userId,
      requested_amount: amount,
      applied_delta: delta,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
    }));

    return jsonResponse(
      {
        success: true,
        data: {
          userId,
          action,
          requestedAmount: amount,
          appliedDelta: delta,
          balanceBefore,
          balanceAfter,
        },
      },
      origin,
    );
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error(`adminCredits ${action} error:`, e.message);
    return jsonResponse({ success: false, error: `Failed to ${action} credits` }, origin, 500);
  }
}

export function adminGrantCreditsHandler(request: Request, env: Env): Promise<Response> {
  return adjustCredits(request, env, 'grant');
}

export function adminRevokeCreditsHandler(request: Request, env: Env): Promise<Response> {
  return adjustCredits(request, env, 'revoke');
}
