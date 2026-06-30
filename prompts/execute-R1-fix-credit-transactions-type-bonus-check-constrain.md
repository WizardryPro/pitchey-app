# R1 — Fix credit_transactions type='bonus' CHECK-constraint violation

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker + React/Vite + Neon Postgres, raw SQL, no ORM). Goal: fix a silent-breakage bug where credit-granting code inserts `type='bonus'` into `credit_transactions`, but the table's CHECK constraint does not permit `'bonus'`, so referral redemption, demo-account topup, and the welcome bonus all fail at runtime.

## Background (verified, do not re-derive)
- `src/db/migrations/038_credit_system.sql` line 20 defines: `type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'grant'))`. Note: the allowed set is purchase/usage/refund/**grant** — NOT bonus.
- THREE live call sites in `src/worker-integrated.ts` INSERT `type='bonus'` (all will violate the constraint if prod's constraint matches migration 038):
  - line ~2033 — welcome bonus credits ("Welcome bonus credits")
  - line ~21835 — referral invite bonus (inside `redeemInvite`, registered at `/api/invites/:code/redeem`)
  - line ~22768 — daily demo-account top-up (inside `topUpDemoAccountCredits`, called from a cron/scheduled path)
- CONFLICT TO RESOLVE: project memory (`credit_type_drift` note) claims the *live prod* constraint actually permits `purchase|usage|refund|bonus` and that `'grant'` "never existed in prod" — the opposite of what migration 038 says. The migration files have known drift vs. prod (prod was hand-migrated, baselined 2026-04-17). You MUST inspect the live constraint before writing anything. Do not trust either the migration file or the memory note over the actual database.

## Pre-flight checks (do these first, report findings before changing code)
1. Confirm the three call sites still exist and still insert `'bonus'`:
   `grep -n "'bonus'" src/worker-integrated.ts`
2. Confirm `redeemInvite` and `topUpDemoAccountCredits` are live (registered/invoked), per the repo's pre-flight rule:
   `grep -n "redeemInvite\|topUpDemoAccountCredits\|/api/invites/:code/redeem" src/worker-integrated.ts`
3. Inspect the ACTUAL live prod constraint via `mcp__neon__run_sql` against the production (main) branch. Run:
   - `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'credit_transactions'::regclass AND contype = 'c';`
   - Also check whether `type` is a VARCHAR+CHECK or a Postgres ENUM type: `SELECT data_type, udt_name FROM information_schema.columns WHERE table_name='credit_transactions' AND column_name='type';`
   - And see what values already exist: `SELECT DISTINCT type FROM credit_transactions;`
   Report the exact constraint definition. This reconciles the migration-vs-memory conflict.

## Decision rule
- If the live constraint already permits `'bonus'` (memory was right): then the runtime failure is NOT the constraint — re-investigate (maybe a different env, or the bug is elsewhere). Report and STOP before writing a migration; do not ship a no-op migration claiming a fix.
- If the live constraint does NOT permit `'bonus'` (migration 038 is accurate to prod): proceed. PREFER adding `'bonus'` to the allowed set (not changing call sites to `'grant'`), because `'bonus'` is the value used in 3 live places and is the more descriptive label. Keep `'grant'` in the allowed set too (additive, non-destructive) so nothing else breaks.

## Implementation (only if the constraint must change)
1. Write a new numbered migration in `src/db/migrations/` — use the next free number (check the highest existing number; the repo is at ~110+). Name it like `NNN_credit_transactions_allow_bonus_type.sql`.
2. The migration must handle the CHECK-vs-ENUM reality you found in pre-flight:
   - If `type` is VARCHAR + CHECK: `ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS <exact_constraint_name>;` then `ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check CHECK (type IN ('purchase','usage','refund','grant','bonus'));`. Use the exact constraint name you discovered (it may be auto-generated like `credit_transactions_type_check`). Use `IF EXISTS` / `IF NOT EXISTS` idiom where possible. Wrap the ADD in a guard so re-running is safe.
   - If `type` is a Postgres ENUM: `ALTER TYPE <enum_name> ADD VALUE IF NOT EXISTS 'bonus';` (note: ADD VALUE cannot run inside a transaction block alongside other statements in some PG versions — keep it standalone).
3. Do NOT touch the three worker call sites if you keep `'bonus'` (they are already correct against the new constraint). Do NOT renumber or edit migration 038.

## Verification gates (all must pass before merge)
- **G1 — Constraint reconciled & migration correct:** Pre-flight step 3 output is captured and the migration's ALTER matches the *actual* live constraint definition/type (CHECK vs ENUM, exact constraint name). The migration uses idempotent guards and re-runs cleanly.
- **G2 — Neon branch apply + real side-effect proof:** Apply the migration on a fresh Neon branch (`mcp__neon__create_branch`, then run the migration SQL via `mcp__neon__run_sql`). Then exercise both broken paths against that branch and assert a ROW IS INSERTED (not just an HTTP 200): manually run the exact INSERT from the `redeemInvite` path and the `topUpDemoAccountCredits` path (`INSERT INTO credit_transactions (...) VALUES (..., 'bonus', ...)`) and confirm they succeed and `SELECT` returns the new row. Before the migration the same INSERT must fail with a check-violation (capture both the before-fail and after-success to prove the fix). Clean up the branch when done.
- **G3 — Migration tracking + deploy gate:** Confirm the new file will be recorded by the migration runner: run `npm run db:migrate:status` (or `node scripts/migrate.mjs status`) and verify the new file is detected as pending, and that the `deploy-production` CI gate (which fails if any `src/db/migrations/*.sql` is not recorded in `schema_migrations`) will be satisfied once applied. Apply to prod (main branch) as part of the migration workflow so the gate passes. Document that `schema_migrations` records the new filename + SHA-256.
- **G4 — No swallowed errors regressed:** Verify the three call sites still surface insert failures to their handler `try/catch` (do not add or rely on a `.catch(() => default)` that would re-hide a future constraint failure). The point of this fix is to stop silent breakage, not relocate it.

Report: the live constraint definition you found, which branch of the decision rule you took, the migration filename/number, and the G2 before/after INSERT evidence. Do not commit/push unless asked; if you do, branch off main first and end the commit message with the Co-Authored-By trailer per repo convention.
