# R7 — Side-effect verification in the integration test tier

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker backend `src/worker-integrated.ts`, raw SQL via `@neondatabase/serverless`, Neon Postgres, React/Vite frontend). There is an existing backend integration test tier under `test/integration/` that drives the REAL worker `fetch()` against a throwaway Neon branch. Read `test/integration/README.md`, `test/integration/env.ts`, and `test/integration/client.ts` first to understand the harness.

GOAL
The integration tests currently assert ONLY on HTTP status codes and cookie presence — they never read the database back to confirm the side-effect actually happened. A handler can return 200 while the NDA row is never created, credits are never charged, the provenance seal is never written, or `verification_tier` is never mutated. This is the silent-breakage root cause (same class of bug that hid the consumption-gate failure for weeks). Extend the integration tier with round-trip side-effect assertions on the money / NDA / verification / seal paths — the data these side-effects produce IS the moat, and untested it can silently stop accruing.

PRE-FLIGHT (do these before writing any test)
1. Confirm each route you intend to test is LIVE in the router: `grep -n "ndas/request\|/api/pitches\|identity\|verify/p/" src/worker-integrated.ts`. Only test routes registered in `src/worker-integrated.ts`; an orphan handler that looks complete is not live.
2. Trace the actual write each handler performs so you assert against the REAL schema, not a stale migration. Key known drifts (verify against code, do not trust doc framing):
   - NDA writes go to the unified `ndas` table with columns `signer_id` / `user_id` (NOT `requester_id`/`creator_id`) — grep the live `requestNDA`/approve/access handlers to confirm the exact INSERT columns.
   - The NDA-request credit charge is 10 credits (a deliberate seriousness filter) — find where credits are decremented (`credits` on `users` and/or a `credit_transactions` insert with `type` in the prod ENUM `purchase|usage|refund|bonus`) and assert the decrement, not an invented column.
   - Pitch publish writes a provenance seal row (migration 109, `src/services/pitch-provenance.ts`) and is supposed to INSERT matching-investor notification rows. Confirm the seal table name + the notification insert path.
   - Identity/reputation mutates `users.verification_tier`. Confirm which endpoint or cron actually flips it before asserting.
3. Run the existing tier once to confirm your local harness works: provision a disposable Neon branch off `pitchey-production` (Neon MCP `create_branch` or Console), export its POOLED connection string as `TEST_DATABASE_URL`, then `npm run test:integration`. The harness `assertNotProd` in `env.ts` will refuse a prod-looking URL — that is expected and must stay intact.

IMPLEMENTATION
A. Add a tiny read-only DB helper to the harness so tests can read rows back. Create `test/integration/db.ts` exporting a `query(text, params)` (and a `queryOne`) backed by `@neondatabase/serverless` using `getTestDatabaseUrl()` from `env.ts` (reuse the existing guard — do NOT duplicate the prod check, and never accept `DATABASE_URL`). This is for assertions only; the worker still does all writes through its own path.
B. Extend the existing suites (do not create parallel ones) with round-trip assertions. At minimum:
   - `test/integration/nda.test.ts`: log in as `sarah.investor@demo.com` / `Demo123` (investor portal), capture the target user id and their pre-request credit balance via `db.ts`, POST `/api/ndas/request` for a browseable pitch, then assert: (a) a new row exists in `ndas` for that signer+pitch, AND (b) the user's credit balance decreased by exactly the live charge (and/or a `credit_transactions` row was written). Clean up or use a fresh pitch/user combination so reruns are idempotent.
   - `test/integration/pitches.test.ts`: create + publish a pitch as `alex.creator@demo.com`, then assert a provenance seal row exists for that pitch, AND assert the matching-investor notification rows were inserted (or, if the notify path is genuinely conditional, assert the exact condition and the row count). 
   - Identity/verification: add (in the appropriate existing suite, or `cross-role-flows.test.ts`) an assertion that the path which is supposed to set `users.verification_tier` actually mutates the column — drive whatever live endpoint/cron does it; if it is a cron-only mutation, invoke the same service function the cron calls and assert the DB change.
C. Keep tests serial and self-contained (the tier already runs serially). Prefer asserting deltas (before/after) over absolute values so seeded demo data doesn't make them brittle. Each test must print the response body on failure (the suites already do `await res.clone().text()` — follow that pattern).
D. If `vitest.integration.config.ts` needs the new `db.ts` included or any timeout bump for DB round-trips, adjust it minimally; do not touch `vitest.backend.config.ts` (the unit tier) except if the scope note there must be updated.

DO NOT
- Do not point `TEST_DATABASE_URL` at prod; do not weaken or remove `assertNotProd`.
- Do not chase coverage % on read-only GET endpoints — money/NDA/verification/seal write-backs only.
- Do not refactor handlers to "make them testable" — if a handler can't be verified, that's a finding to report, not a code change in this task.

VERIFICATION GATES (all must pass before merge; report each explicitly)
- G1 (no-prod guard intact): Show that tests run only against `TEST_DATABASE_URL` and that `assertNotProd` still rejects the prod endpoint host. Demonstrate the suite errors clearly when `TEST_DATABASE_URL` is unset.
- G2 (mutation test — assertions have teeth): For EACH new side-effect assertion, temporarily disable the corresponding write in the handler/service (comment out the `ndas` INSERT, the credit decrement, the seal insert, the notification insert, the `verification_tier` UPDATE — one at a time), run the relevant test, and confirm it FAILS. Restore the code. Paste the before/after pass→fail evidence for each. An assertion that still passes with the write removed is not done.
- G3 (full tier green): `npm run test:integration` passes end-to-end against a fresh disposable Neon branch, and reruns are idempotent (run it twice on the same branch).
- G4 (live-route confirmation): For every route asserted, paste the `grep` hit from `src/worker-integrated.ts` proving it is the registered live handler (not an orphan).

When done, open a PR summarizing which side-effects are now covered, the G2 mutation-test evidence table, and any handler that could NOT be verified (as a follow-up finding). Branch off main; do not commit/push until I confirm.
