# R4 — charge.refunded credit reversal + admin credit grant/revoke endpoints

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker + React/Vite + Neon Postgres, Stripe live). Live API router is `src/worker-integrated.ts` (raw SQL via `@neondatabase/serverless`, no ORM). Migrations are `src/db/migrations/NNN_*.sql` applied via `scripts/migrate.mjs` + `schema_migrations`.

GOAL
Two related fixes on the money path:
1. Make the `charge.refunded` Stripe webhook actually reverse credits (today it only logs) by writing a reversal row into `credit_transactions` and decrementing the user's balance.
2. Add admin tooling: `POST /api/admin/credits/grant` and `POST /api/admin/credits/revoke` with an audit trail, so refunds/adjustments don't require manual DB edits.

DEPENDENCY: This item depends on R1 (credit_transactions `type` enum / constraint fix). Before writing any reversal/grant/revoke `type` value, confirm what the live enum/constraint accepts.

=== PRE-FLIGHT (do this first, report findings, do NOT skip) ===
Run and read the output before editing:
- `grep -n "charge.refunded" src/worker-integrated.ts` — confirm the current handler location (scope notes ~line 11384) and read the surrounding `handleStripeWebhook` switch + the `stripe_webhook_events` idempotency gate.
- `grep -rn "credit_transactions" src/db/migrations/ | grep -i "type"` and read the live ENUM/constraint. Per repo memory the prod enum is `purchase|usage|refund|bonus` (mig 038's `grant` never existed) — but VERIFY against R1's change. Use `mcp__neon__run_sql` (read-only) against the live DB to confirm the actual constraint: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='credit_transactions'::regclass;` and `\d credit_transactions` equivalent. The reversal MUST use an accepted type (`refund`).
- `grep -n "stripe_session_id\|stripe_payment_intent\|session_id" src/db/migrations/*credit* src/db/migrations/*.sql | grep -i credit` and inspect the actual columns on `credit_transactions` — determine which column links a credit grant to a Stripe object (session id vs payment_intent). The scope says "lookup stripe_session_id"; CONFIRM the column actually exists. Known gotcha from the 2026-05-27 Stripe session: `credit_transactions has no payment_intent_id linkage` — that is exactly why `charge.refunded` was log-only. So you must FIRST establish the link path. Check whether `checkout.session.completed` / `invoice.paid` writes a `metadata`, `stripe_session_id`, or `reference_id` you can match a refund back to. A Stripe `charge.refunded` event carries `charge.payment_intent` and `charge.invoice` — trace which of those (if any) is stored on the original credit grant row.
- `grep -n "Permission.ADMIN_ACCESS\|adminHandler\|/api/admin/" src/worker-integrated.ts` — find how existing admin routes are registered and how `adminHandler` intercepts the `/api/admin/*` prefix. New endpoints must register correctly and not be shadowed/swallowed by a catch-all admin intercept. Find an existing admin POST endpoint to copy the auth + registration pattern exactly.
- Confirm the live balance column: `grep -rn "credit" src/worker-integrated.ts | grep -i "balance\|UPDATE users"` — find how credits are added/subtracted today (e.g. `UPDATE users SET credits = credits + $1`). Reuse that exact column name.

If pre-flight reveals there is NO reliable column linking a credit grant to the refunded Stripe object, STOP and report: implement the reversal keyed on whatever IS available (e.g. match by `users.stripe_customer_id` from `charge.customer` + the most recent unreversed purchase txn for that user, or add a migration to backfill the link), and propose the chosen approach before coding.

=== IMPLEMENTATION ===
A. Migration (if a link column or audit column is missing):
- New `src/db/migrations/NNN_credit_refund_and_admin_audit.sql` with `IF NOT EXISTS` patterns. Add any missing linkage column on `credit_transactions` (e.g. `stripe_payment_intent_id TEXT`, `stripe_session_id TEXT`, partial index) needed to match a refund to its grant, AND/OR an `admin_credit_adjustments` audit table (`id, target_user_id, admin_user_id, delta INT, reason TEXT, type, created_at`) — or, if you prefer keeping audit inline, record admin actions as `credit_transactions` rows with a metadata field naming the acting admin. Choose ONE audit mechanism and be consistent.
- Apply via `npm run db:migrate` only after testing on a Neon branch (`mcp__neon__create_branch` → run SQL → verify). Record in `schema_migrations`.

B. `charge.refunded` handler (in `handleStripeWebhook`, `src/worker-integrated.ts`):
- Keep the existing idempotency gate (`stripe_webhook_events`) and the existing log line.
- Resolve the original credit grant txn(s) for the refunded charge via the link established in pre-flight.
- Compute credits to reverse (full vs partial: a partial refund `charge.amount_refunded < charge.amount` should reverse proportionally — clamp so balance never goes below 0, and never reverse the same charge twice).
- In a single transaction (`mcp__neon__run_sql_transaction` pattern / batched SQL): INSERT a `credit_transactions` reversal row with `type='refund'` (or the R1-validated type), negative/`amount` per the table's sign convention, and a reference back to the Stripe charge/PI; and `UPDATE users SET credits = GREATEST(credits - $n, 0)`.
- Do NOT swallow errors. Per CLAUDE.md the catch-swallow gate runs `--include-worker --threshold 0`. Use the standard `const e = err instanceof Error ? err : new Error(String(err))` form and let failures surface to Sentry. A webhook handler that silently returns 200 on a failed DB write is the exact #20 laundering anti-pattern — return a 5xx (or record a needs-action row) so Stripe retries / ops is alerted; do NOT report success on a swallowed write.

C. Admin endpoints (`src/worker-integrated.ts`):
- `POST /api/admin/credits/grant` body `{ userId, amount, reason }` → add credits.
- `POST /api/admin/credits/revoke` body `{ userId, amount, reason }` → subtract credits (clamp at 0).
- Both gated by `Permission.ADMIN_ACCESS` using the SAME auth check as existing admin routes. Validate body with Zod (`amount` positive int, `reason` non-empty). Each writes an audit row (admin_user_id from the authenticated session) AND a `credit_transactions` row (`type='bonus'` for grant, `type='refund'`/`usage` for revoke per the R1-validated enum — pick the accepted value, do not invent `grant`).
- Register them so the `/api/admin/*` `adminHandler` intercept routes to them correctly (verify with the grep pattern above — confirm zero shadowing).

=== VERIFICATION GATES (all must pass before merge) ===
G1 — Enum/constraint safety: Reversal + admin txns use a value the live `credit_transactions` type constraint accepts (confirmed via the R1 change and the live `pg_get_constraintdef` query). Prove it: insert a test reversal/grant row on a Neon branch and show no constraint violation. NO new `CHECK`/enum violation introduced.
G2 — Routing: `grep -n "/api/admin/credits/grant\|/api/admin/credits/revoke" src/worker-integrated.ts` shows both registered; show the `Permission.ADMIN_ACCESS` gate on each; prove a non-admin session gets 403 and the request is NOT swallowed by `adminHandler`. Per CLAUDE.md pre-flight: `grep -rn "register" + handler name` returns hits (handler is live, not orphaned).
G3 — Refund webhook end-to-end (Stripe CLI, TEST MODE): `stripe listen --forward-to <local worker>` + `stripe trigger charge.refunded` (or replay a real test charge that previously granted credits). Assert: (a) a `credit_transactions` reversal row was written with `type='refund'`, (b) `users.credits` was decremented by the correct amount (and not below 0), (c) re-delivering the same event does NOT double-reverse (idempotency holds), (d) handler returns 200 only on success. Paste the wrangler tail log line + the before/after balance + the txn row.
G4 — Catch-swallow gate: run the repo gate (`catch-swallow-gate.mjs --include-worker --threshold 0`) and confirm no new untagged swallow was introduced. Type-check passes (`cd frontend && npx tsc --noEmit -p tsconfig.app.json` for any FE touch; worker build via the project's worker type-check).

DELIVERABLES: the migration file (if any), the worker diff, gate evidence pasted inline, and a short note on the link-resolution approach chosen in pre-flight. Branch off `main`; do not deploy or merge — open for review with the G1–G4 evidence in the PR body.
