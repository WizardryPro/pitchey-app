# R13 — Gold-tier reputation: integration tests + manual recompute endpoint

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker + React/Vite + Neon Postgres). Goal: add integration-test coverage for the platform-earned GOLD creator-reputation tier AND add an admin-gated manual-recompute endpoint as a recovery path if the daily cron fails. This is the moat-native trust tier — if the cron silently freezes, there must be both a test that catches a regression and an operator escape hatch.

## Context (already verified — do NOT re-litigate)
- The service is live: `src/services/creator-reputation.ts` exports `recomputeCreatorReputationTiers(env, ctx?): Promise<{ promoted: number }>`. It is PROMOTE-ONLY: a single `UPDATE users SET verification_tier='gold' ... WHERE user_type='creator' AND COALESCE(verification_tier,'grey') <> 'gold' AND (<Path A> OR <Path B>) RETURNING id`. It never downgrades, never touches non-creators.
  - Path A: `(SELECT COUNT(*) FROM pitch_provenance pr WHERE pr.creator_id = u.id) >= 2` AND `(SELECT COUNT(*) FROM ndas n JOIN pitches p ON p.id = n.pitch_id WHERE p.user_id = u.id AND n.status='signed' AND n.signer_id <> u.id AND n.revoked_at IS NULL AND n.access_revoked_at IS NULL) >= 3`.
  - Path B: `(SELECT COUNT(*) FROM production_deals d WHERE d.creator_id = u.id AND d.outcome IN ('closed_on_platform','closed_off_platform') AND d.outcome_confirmed_by_creator=true AND d.outcome_confirmed_by_production=true) >= 1`.
- The cron calls it at `src/worker-integrated.ts` ~line 22324 via `const { recomputeCreatorReputationTiers } = await import('./services/creator-reputation'); await recomputeCreatorReputationTiers(env, ctx);`. There is NO HTTP route to trigger it and NO test of its side-effects.
- Integration test harness already exists: `test/integration/` drives the REAL `worker.fetch()` against a throwaway Neon branch via `test/integration/client.ts` (TestClient, cookie jar) and `test/integration/env.ts` (`buildTestEnv`). It uses `TEST_DATABASE_URL` with a no-prod guard. Read `test/integration/README.md`, `client.ts`, `env.ts`, and an existing data-seeding suite (`creator-deals.test.ts`, `cross-role-flows.test.ts`, `nda.test.ts`) before writing — match their seeding/cleanup style exactly.
- Admin route pattern: most `/api/admin/*` routes flow through `this.adminHandler` (which enforces `user_type='admin'`), but a few are registered directly in the router and EXCLUDED from the adminHandler dispatch block (see `src/worker-integrated.ts` ~line 4410 where `/api/admin/heat-scores`, `/api/admin/promo-codes`, etc. are excluded). The closest precedent for what you're building is `POST /api/admin/heat-scores/recalculate` (registered ~line 3884, handler in `src/handlers/heat-score.ts`). Copy that pattern, including its admin gate.

## Pre-flight checks (run first, paste output)
1. `grep -n "recomputeCreatorReputationTiers" src/worker-integrated.ts` — confirm only the cron call exists, no route yet.
2. `grep -n "reputation" src/worker-integrated.ts` — confirm no `/api/admin/reputation/*` route.
3. Read `src/handlers/heat-score.ts` `recalculateHeatScoresHandler` to copy its admin-auth check verbatim (whatever it uses to assert `user_type='admin'` / 403 otherwise).
4. Confirm columns exist on the test branch: `pitch_provenance.creator_id`, `ndas.signer_id`/`status`/`revoked_at`/`access_revoked_at`, `production_deals.outcome`/`outcome_confirmed_by_creator`/`outcome_confirmed_by_production`. If a column name differs from the service SQL, the SERVICE is the source of truth — match it, do not "fix" the service in this task.

## Implementation
### 1. Admin recompute endpoint
- Add a new handler `recomputeReputationHandler(req, env)` in `src/handlers/creator-reputation-admin.ts` (new file). It must:
  - Enforce the same admin gate as `recalculateHeatScoresHandler` (return 403 JSON if caller is not `user_type='admin'`).
  - Call `recomputeCreatorReputationTiers(env)` and return `{ ok: true, promoted: <n> }` as JSON.
  - **Log every promotion for audit (gate G3).** The service already `console.log`s a `{category:'reputation', action:'creator_gold_recompute', promoted}` line; extend it (or log in the handler) so the AUDIT record includes the triggering admin's user id and the list of promoted creator ids, e.g. `console.log(JSON.stringify({ level:'info', category:'reputation', action:'creator_gold_recompute_manual', triggeredBy: <adminId>, promotedIds: [...], promoted: n }))`. To surface promoted ids, have `recomputeCreatorReputationTiers` also return the `RETURNING id` array (extend the return type to `{ promoted: number; promotedIds: number[] }` — keep `promoted` for the cron caller's existing shape). Do NOT swallow errors: on failure let it throw to the handler `try/catch` which returns a 500 (no `.catch(() => default)` laundering — the catch-swallow gate runs `--include-worker --threshold 0`).
- Register the route in `src/worker-integrated.ts` next to the heat-scores route (~line 3884): `this.register('POST', '/api/admin/reputation/recompute', async (req) => { const { recomputeReputationHandler } = await import('./handlers/creator-reputation-admin'); return recomputeReputationHandler(req, this.env); });`
- Add `/api/admin/reputation` to the adminHandler EXCLUSION list (~line 4410) exactly like `/api/admin/heat-scores` is excluded, so the directly-registered route isn't shadowed by the adminHandler dispatch.

### 2. Integration test — `test/integration/creator-reputation.test.ts`
Follow the seeding/cleanup conventions of the existing suites. Cover:
- **T1 (Path A happy path):** seed a creator + 2 rows in `pitch_provenance` (creator_id) for 2 of the creator's pitches + 3 `ndas` rows from 3 OTHER users (status='signed', revoked_at NULL, access_revoked_at NULL) on that creator's pitches. Call `recomputeCreatorReputationTiers(env)` directly (import the service) OR hit `POST /api/admin/reputation/recompute` as an admin. Assert the creator's `users.verification_tier` is now `'gold'` (re-query the DB; assert the SIDE EFFECT, not just the HTTP status — this whole item exists because side-effects were untested).
- **T2 (below threshold = no promotion):** seed a creator with only 1 sealed pitch OR only 2 honored NDAs → assert tier stays whatever it was (not gold).
- **T3 (Path B deal path):** seed a creator + 1 `production_deals` row with `outcome='closed_on_platform'`, both confirm flags true → assert gold, with NO sealed pitches/NDAs (proves Path B stands alone).
- **T4 — GATE G1 (promote-only invariant under a silver race):** seed a creator who is ALREADY `verification_tier='gold'` but ALSO currently mid-silver-identity (simulate the trust-map CASE WHEN race: e.g. set `identity_verified_at` / a silver marker concurrently). Run recompute. Assert the creator is STILL `'gold'` and was NOT downgraded to silver/grey, and is NOT double-counted in `promoted` (already-gold rows are excluded by `COALESCE(verification_tier,'grey') <> 'gold'`). Also assert a NON-creator (e.g. a production user) at some tier is never touched by the recompute.
- **T5 (endpoint auth):** `POST /api/admin/reputation/recompute` as a non-admin (creator session) → 403; as admin → 200 with `{ promoted: <n> }`.
- Clean up all seeded rows in `afterAll`/`afterEach` per the existing suites' teardown pattern.

## Verification gates (ALL must pass before merge)
- **G1 — promote-only invariant proven:** T4 passes — an already-gold creator undergoing a concurrent silver/identity write is never downgraded and never double-counted, and non-creators are untouched. (This is the trust-map-flagged CASE WHEN race; without this assertion the test is theater.)
- **G2 — side-effects asserted, not status:** T1/T3 re-query `users.verification_tier` from the DB and assert `'gold'`; they must FAIL if the service is stubbed to a no-op. Temporarily neuter the service (make the UPDATE a SELECT) and confirm T1 goes red, then revert — paste both results.
- **G3 — audit logging present:** the manual recompute emits a structured log line including the triggering admin id and the promoted creator ids. Show the log line (capture console output in T5 or grep the handler).
- **G4 — route is live, not orphaned:** `grep -n "reputation/recompute" src/worker-integrated.ts` shows BOTH the `this.register(...)` line AND the exclusion-list entry; the non-admin 403 / admin 200 test (T5) proves the route actually dispatches (not shadowed by adminHandler).
- **G5 — no swallowed errors / typecheck clean:** `npx tsc --noEmit` on the worker tsconfig passes; the new handler has no `.catch(() => default)`; on service failure the endpoint returns 500 (add a quick test or reason it through). Run the integration suite: `npx vitest run test/integration/creator-reputation.test.ts` (requires `TEST_DATABASE_URL` pointed at a throwaway Neon branch — see `test/integration/README.md`; never point it at prod).

## Constraints
- Do NOT modify the cron call site's behavior or the `{ promoted }` shape the cron consumes (only additively return `promotedIds`).
- Do NOT touch protected/parked paths (`src/workflows/`, `src/workers/crawl4ai-worker.ts`).
- Raw SQL only, no ORM. Match the service's existing column names exactly (the service is source of truth for schema).
- Commit on a feature branch (not main). End the PR body with the gate block (G1–G5) and paste the passing test output.
