# R10 — Adopt mutateOrThrow on money / NDA / verification write paths

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker + React/Vite + Neon Postgres, raw SQL via `@neondatabase/serverless`, no ORM). Live API router is `src/worker-integrated.ts`. Stripe is LIVE in production — be careful around money paths.

GOAL
Adopt the existing `mutateOrThrow` write-guard (in `src/db/safe-query.ts`) on the critical moat-data write paths so that a write affecting zero rows surfaces a real error (and a Sentry capture) instead of telling the user "success" on an incomplete audit trail. Additionally, close the credit-deduct / NDA-insert race in the NDA request handler by making the charge and the NDA-row insert atomic.

DO NOT change the 10-credit NDA charge amount or its seriousness-filter semantics. That value is a locked product decision (Karl) — it is a deliberate filter, not a tax. Touch ordering/atomicity/error-surfacing ONLY.

PRE-FLIGHT (read before writing any code; report findings first)
1. Read `src/db/safe-query.ts` — confirm the exact signature of `mutateOrThrow<T>(rows, context)` (it asserts non-empty rows, reports to Sentry via `withScope`, then throws and returns `arr[0]`). Note it expects the *result of a write that uses RETURNING* (or otherwise returns affected rows).
2. Confirm R10's dependency R7 has landed: `git log --oneline | grep -i "safe-query\|safeQuery\|mutateOrThrow"`. If `mutateOrThrow` is not yet exported/used anywhere, proceed anyway but note it in your summary.
3. Read the NDA request handler in `src/worker-integrated.ts` around lines 8670–8770 (the `/api/pitches/:id/request-nda` style handler). Note the current flow: balance CHECK → `INSERT INTO ndas ... ON CONFLICT (pitch_id, signer_id) DO NOTHING RETURNING *` → if no row, return ALREADY_EXISTS without charging → then a separate `UPDATE user_credits ...` and `INSERT INTO credit_transactions ...`. The race: insert and charge are two separate non-transactional `this.db.query` calls.
4. CRITICAL DRIVER CONSTRAINT: `src/services/worker-database.ts` `WorkerDatabase.transaction()` THROWS `'Transactions not supported in serverless mode'`. The live db uses the neon() HTTP driver. So you CANNOT use an interactive `BEGIN/COMMIT` transaction via `this.db.transaction(...)`. Two viable atomic options — pick the writable-CTE one unless you find a reason not to:
   - PREFERRED: a single writable-CTE SQL statement (one round-trip, atomic) that does `WITH ins AS (INSERT INTO ndas ... ON CONFLICT DO NOTHING RETURNING id, ...), upd AS (UPDATE user_credits SET balance = balance - 10, total_used = total_used + 10, last_updated = NOW() WHERE user_id = $x AND EXISTS (SELECT 1 FROM ins) RETURNING balance), tx AS (INSERT INTO credit_transactions (...) SELECT ... FROM ins) SELECT * FROM ins`. The charge rows only fire when `ins` produced a row, so the charge cannot succeed without the NDA row, and a no-op ON CONFLICT charges nothing — all in one atomic statement. Keep the pre-insert balance CHECK (insufficient-credits guard returning BAD_REQUEST) before the statement.
   - FALLBACK only if the CTE proves infeasible: use a `Pool`/`Client` from `@neondatabase/serverless` for an interactive transaction. This is heavier (WebSocket) — avoid unless necessary.
5. Read `src/handlers/collaborations-real.ts` around lines 160–195 — the collaboration NDA-signature / company-NDA-signature insert path that swallows exceptions in a `try { ... } catch {}` and still reports success. Identify the exact insert(s) for the signature/audit-trail row (the one that, if it fails, leaves an incomplete audit trail while telling the user success).
6. Read `src/handlers/teams.ts` around line 1326 (`INSERT INTO company_nda_signatures`) — confirm whether the result is checked.
7. Read `src/services/company-verification.service.ts:572` and `src/services/creator-reputation.ts:44` (the `UPDATE users SET verification_tier = ...` sites) — confirm they don't assert the row was affected.

IMPLEMENTATION
A. NDA request handler (`worker-integrated.ts`): make credit-deduct + NDA-create atomic via the writable-CTE single statement (option 4-PREFERRED). Preserve every existing behavior: balance check → BAD_REQUEST on insufficient; ON CONFLICT → ALREADY_EXISTS with NO charge; `signer_id` = requester; status `'pending'`; `access_granted=false`; ip/user-agent capture; `credit_transactions` row with `type='usage'`, `usage_type='nda_request'`, amount `-10`, correct `balance_before`/`balance_after`; the subsequent `recordActivity(...)` call. After the statement, use `mutateOrThrow(<rows from the ins/select>, 'nda.request.create')` ONLY where a missing row genuinely means failure — note ON CONFLICT DO NOTHING legitimately returns zero rows (already-exists), so handle the already-exists branch BEFORE mutateOrThrow, and only treat a truly unexpected empty result as the throw case. Do not let mutateOrThrow turn a legitimate ALREADY_EXISTS into a 500.

B. `company_nda_signatures` insert (`teams.ts:1326`) and the collaboration signature insert (`collaborations-real.ts`): add `RETURNING id` (or similar) and wrap with `mutateOrThrow(result, 'company-nda.sign')` / `mutateOrThrow(result, 'collab-nda.sign')` so a zero-row write throws and surfaces instead of being swallowed into a success response. REMOVE the empty/swallowing `catch {}` around the signature insert specifically — let it propagate to the handler's outer `try/catch` so the user gets a real error, not a fake success on an incomplete audit trail. (Leave genuinely non-critical fire-and-forget side-effects like the notification/email inserts as-is — those are correctly best-effort; only the signature/audit-trail write must be hardened.)

C. `verification_tier` promotion writes (`company-verification.service.ts:572`, `creator-reputation.ts:44`, and the two admin sites in `worker-modules/admin-endpoints.ts:846,1390`): add `RETURNING id` and wrap with `mutateOrThrow(result, 'verification.tier.<site>')` so a promotion that matched zero rows (wrong/vanished user id) throws rather than silently no-op'ing a trust-tier change. For the daily reputation cron (`creator-reputation.ts`) which may legitimately update many or zero rows in a batch, do NOT use mutateOrThrow on the batch (zero is valid there) — instead leave the batch but ensure any error propagates / is logged at error level. Use judgment per-site and state your reasoning in the summary.

CONVENTIONS
- TypeScript only, raw SQL only.
- In catch blocks you keep: `const e = err instanceof Error ? err : new Error(String(err))`.
- Import `mutateOrThrow` from `src/db/safe-query.ts` (relative path from each file).
- Do not introduce the `Pool`/`Client` driver unless the CTE approach is shown infeasible.

VERIFICATION GATES (all must pass before merge — report each with evidence)
- G1 — Atomic charge/insert: Demonstrate (by reading the final SQL) that the credit deduction and the `ndas` insert occur in a single atomic statement (writable CTE) such that the charge CANNOT commit without the NDA row, and an ON CONFLICT no-op charges nothing. Paste the final statement and walk through the three cases: new insert (charge fires once), conflict/already-exists (no charge, ALREADY_EXISTS returned), insufficient balance (BAD_REQUEST, no statement run).
- G2 — Sentry-on-zero-row proven on a Neon branch: create a Neon test branch (`mcp__neon__create_branch`), force a zero-affected-row condition on one wrapped write (e.g. run the verification_tier UPDATE against a non-existent user id, or a signature insert whose WHERE matches nothing), and confirm `mutateOrThrow` throws `Write affected 0 rows: <context>`. Confirm the code path calls `Sentry.captureException` (the try/catch around Sentry in mutateOrThrow swallows only when the hub is uninitialized — so in the worker runtime it fires). Show the test invocation and the thrown error. Do NOT run this against the production/main branch.
- G3 — Locked charge unchanged: `grep -n "10" ` the NDA handler region and confirm the charge amount is still 10 credits, `usage_type='nda_request'`, `type='usage'`, amount `-10`. Show that no pricing/semantics changed.
- G4 — Build + typecheck green: worker build (`npm run build:worker` if present, else the project's worker build) and frontend typecheck `cd frontend && npx tsc --noEmit -p tsconfig.app.json` both pass. Also run `node scripts/migrate.mjs status` is NOT needed (no migration in this change) — but confirm you added no new migration unless schema actually required it (it should not).

OUTPUT
Report: files changed with line ranges, the final NDA atomic statement, per-site mutateOrThrow decisions (including where you deliberately did NOT use it and why, e.g. the reputation batch and the ON-CONFLICT already-exists branch), and the G1–G4 evidence. Open a PR off `main` (branch e.g. `fix/r10-mutateorthrow-money-nda-verify`) with the gate results in the body. End the PR body with:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
And the commit message with:
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
