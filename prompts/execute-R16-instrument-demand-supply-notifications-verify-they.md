# R16 — Instrument demand→supply notifications (verify they reach creators)

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker backend at `src/worker-integrated.ts` — the live, hand-rolled router; raw SQL via `@neondatabase/serverless`, no ORM; React 18 + Vite frontend in `frontend/src`; Neon Postgres; migrations are numbered `NNN_*.sql` applied via `scripts/migrate.mjs` against the `schema_migrations` table). Work on a feature branch off `main`, not on `main` directly.

GOAL
The demand→supply notification path is the acquisition flywheel's ignition: when a production/investor posts an Open Call (`createCallHandler`) or a creator publishes a pitch (worker-integrated.ts publish-notify), the system fires an `INSERT…SELECT` that notifies all genre/format-matched creators/investors in one batch. Today this notify is fire-and-forget with swallowed errors, and there is NO telemetry confirming batches actually land. We need to (a) reconcile the notification `priority` enum drift that 500s `createNotification`, and (b) add structured logging + a metric on notify batch size/success so we can verify batches reach the `notifications` table. This is observability + a correctness fix — do NOT redesign the notify flow.

CRITICAL PRE-FLIGHT (do these reads/greps BEFORE editing anything; report findings before changing code)
1. Confirm the live notify paths exist and are wired:
   - `grep -n "createCallHandler" src/handlers/calls.ts` and read the notify block around the cited region (originally ~lines 260-270). Find the `INSERT…SELECT` into `notifications` and the `.catch(...)` that swallows its error.
   - `grep -n "createCall\|createCallHandler" src/worker-integrated.ts` to confirm the handler is actually registered/live (per the CLAUDE.md pre-flight rule: a handler is orphaned if it has zero hits in the live router).
   - In `src/worker-integrated.ts` find the publish-notify block (originally ~line 2924; search `grep -n "INSERT INTO notifications" src/worker-integrated.ts` and the pitch publish path). Confirm it issues an `INSERT…SELECT` to matching users.
   - Read `src/routes/notification-routes.ts` (or `grep -rn "notification-routes" src/`) to understand the notifications read API and the `notifications` table columns actually used.
2. Establish the ground-truth notification schema and the priority enum:
   - `grep -rn "priority" src/handlers/calls.ts src/worker-integrated.ts` to see which priority value each notify path writes.
   - Check the DB column type: in a migration file or via `grep -rn "priority" src/db/migrations/` confirm whether `notifications.priority` is a CHECK/enum constraint and what values it accepts. Per repo memory (`reference_notifications_broken`): the correct value is `'normal'`, NOT `'medium'`; the `createNotification()` helper is DRIFTED and must not be used — the live pattern is the direct `INSERT`/`notify()` pattern (see `handlers/calls.ts` `notify()`). The `'medium'` value is what 500s inserts.
   - Confirm whether the GENERATED-column / trigger issue from `users.notification_count` (migration 103) is relevant here; do not reintroduce it.

IMPLEMENTATION
A. Reconcile the priority drift (correctness):
   - In every demand→supply notify INSERT (calls.ts createCall path AND worker-integrated.ts publish-notify), ensure `priority` is written as `'normal'`. Replace any `'medium'` literal. Do NOT route through the drifted `createNotification()` helper — keep the direct-insert / `notify()` pattern (gate G1).
B. Add structured logging + a metric on batch size and success (observability):
   - Use the structured logger already in the repo — `grep -rn "production-logger\|src/lib/production-logger" src/` and reuse it (structured JSON, requestId/traceId propagation). Do not invent a new logger.
   - After each batch `INSERT…SELECT`, capture the rows-affected count (the Neon serverless driver returns affected/returned row info — verify the exact shape; `INSERT … RETURNING id` is the most reliable way to count, or use the driver's rowCount/`.length`). Log a structured event with at minimum: event name (e.g. `demand_supply_notify`), source (`open_call` | `pitch_publish`), the trigger entity id (callId / pitchId), the matched/inserted batch size, and a boolean success.
   - Emit a metric to Analytics Engine using ONLY the existing bindings — `pitchey_metrics` / `ANALYTICS` / `PITCHEY_ANALYTICS` (confirm the live binding name in `wrangler.toml`; do NOT add a new AE binding). Write a datapoint with batch size as a double and source as a blob/index. If wiring AE here is non-trivial, the structured log is the must-have; the AE datapoint is the nice-to-have — but include it if the existing binding is already imported in the file.
   - REPLACE the swallowed `.catch(() => …)` on the notify INSERT: the error must be surfaced (logged at error level with the structured logger AND reported to Sentry if `Sentry`/`captureException` is already in scope in that file). Keep it non-blocking for the user-facing response (the post/publish must still succeed even if notify fails), but it must NOT be silent. Per repo rule: a fire-and-forget tag on something the user was told succeeded is laundering — so log the failure loudly, just don't fail the request. Add a `// fire-and-forget` comment ONLY on the truly post-success telemetry call, never on the write whose failure we're now logging.

NON-GOALS / GUARDRAILS
- No schema migration unless the pre-flight proves `notifications.priority` cannot accept `'normal'` (it can, per repo memory — so almost certainly no migration). If you do need one, it must be `NNN_*.sql` with `IF NOT EXISTS`/idempotent patterns and recorded via `scripts/migrate.mjs`.
- Do not touch the parked paths (`src/workflows/`, `src/workers/crawl4ai-worker.ts`, `src/services/console-analysis-crawler.ts`).
- Do not refactor the notify into a shared abstraction; keep the two call sites independent and minimal.

VERIFICATION GATES (all must pass before opening the PR for merge)
- G1 — Priority correctness: `grep -rn "priority" src/handlers/calls.ts src/worker-integrated.ts` shows every demand→supply notify writes `'normal'` and NONE write `'medium'`. Confirm none of the changed paths call the drifted `createNotification()` helper. Paste the grep output in the PR.
- G2 — Integration test asserts a ROW IS WRITTEN (not just HTTP 200): add/extend a test in the backend integration tier (`grep -rn "worker.fetch\|TEST_DATABASE_URL" src/ test*/ frontend/` to find the harness — it drives real `worker.fetch()` against a throwaway Neon branch). The test must: post an Open Call (or publish a pitch) that matches at least one seeded creator, then query the `notifications` table directly and assert ≥1 matching row exists with `priority = 'normal'`. Asserting only the 200 response is explicitly insufficient (this is a hard gate). Run it and paste the passing output.
- G3 — Error is no longer swallowed: confirm the catch-swallow gate still passes — run `node scripts/catch-swallow-gate.mjs --include-worker --threshold 0` (the live gate; confirm exact path/flags via `grep -rn "catch-swallow" .github/ scripts/`). The notify INSERT's failure path must surface to the logger/Sentry, not return a silent default.
- G4 — Telemetry present: show the structured log event (event name + source + batch size + success) is emitted on both paths, and (if the existing AE binding was already imported in the file) an AE datapoint is written. Describe how you'd confirm batches land in prod after deploy: query Cloudflare Workers Observability / Axiom for the `demand_supply_notify` event, and cross-check `SELECT count(*) FROM notifications WHERE type=… AND created_at > now() - interval '1 hour'` against the logged batch sizes.
- G5 — Type check + worker build: `cd frontend && npx tsc --noEmit -p tsconfig.app.json` (frontend untouched should stay green) AND the worker build (`npm run build:worker` or the repo's worker typecheck — confirm the command) passes. Note: backticks inside `sql\`\`` template literals break `build:worker` — avoid them.

DELIVERABLE
Open a PR against `main` titled "R16: instrument demand→supply notifications + fix priority drift". In the body, paste the G1 grep output and G2 test output, summarize the logging/metric added, and list the exact files changed. Report the matched/expected batch-size behavior you verified.
