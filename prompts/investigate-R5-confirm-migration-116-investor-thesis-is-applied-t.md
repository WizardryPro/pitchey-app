# R5 — Confirm migration 116 (investor_thesis) is applied to prod Neon

**Action:** investigate

---

You are working in the Pitchey repo (Cloudflare Worker backend at `src/worker-integrated.ts`, raw SQL via `@neondatabase/serverless`, Neon Postgres, React 18 frontend in `frontend/src`). Migrations are numbered `NNN_*.sql` under `src/db/migrations/`, applied via `scripts/migrate.mjs` and tracked in the `schema_migrations` table (filename-keyed, SHA-256). Stripe is live in prod. Do NOT touch parked paths (`src/workflows/`, `src/workers/crawl4ai-worker.ts`, `src/services/console-analysis-crawler.ts`).

GOAL: Verify whether migration 116 (the `investor_thesis` table backing moat #7 thesis-matching/notify) is actually applied to the production Neon database. The strategic frame claims it is "reportedly NOT applied (Neon was down)", but the PR is merged and the file exists. The matching/notify handlers degrade SILENTLY when the table is missing (look for `isMissingThesisTable` around `src/worker-integrated.ts:2922`), so the feature can appear to work while being completely inert. This is an INVESTIGATE-FIRST task — VERIFY THE PREMISE BEFORE CHANGING ANY CODE, then report findings and stop for approval before applying anything.

=== PHASE 1: VERIFY THE PREMISE (read-only, no writes) ===

1. Confirm the migration file exists and read it:
   - `ls src/db/migrations/ | grep 116`
   - Read the matching `116_*.sql` file in full. Note the exact filename (it is the `schema_migrations` key), and capture the table name(s) and columns it creates.

2. Confirm the PR/merge state in git history:
   - `git log --oneline --all -- src/db/migrations/*116*` and `git log --oneline --all | grep -i thesis` to confirm the merge landed on main.

3. Locate the live handlers and the silent-degrade path:
   - `grep -n "isMissingThesisTable" src/worker-integrated.ts`
   - `grep -n "investor_thesis" src/worker-integrated.ts` and across `src/`
   - `grep -n "/api/investor/thesis" src/worker-integrated.ts` to confirm which thesis routes are LIVE (matches, GET, PUT). Note the exact route path for the matches endpoint (e.g. `/api/investor/thesis/matches` or similar) — this is needed for G3.
   - Read the degrade branch so you understand exactly what an empty/missing-table response looks like vs a genuine no-matches response.

4. Query PRODUCTION Neon (READ-ONLY) using the `mcp__neon__run_sql` tool against the prod branch (NOT a dev/preview branch — confirm the project/branch first with `mcp__neon__list_projects` / `mcp__neon__describe_branch` if unsure):
   - Check the migration record:
     `SELECT filename, applied_at FROM schema_migrations WHERE filename LIKE '%116%';`
   - Check the table actually exists:
     `SELECT to_regclass('public.investor_thesis') AS tbl;`
   - If it exists, confirm the column shape matches the migration:
     `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'investor_thesis' ORDER BY ordinal_position;`
   - Check row count (so we know whether matching has any data to work with):
     `SELECT count(*) FROM investor_thesis;` (only run if the table exists)

5. REPORT a clear verdict before doing anything else:
   - State whether the table EXISTS in prod, whether the `schema_migrations` row is PRESENT, and whether the two agree (a present table + missing migration row = drift to reconcile; a missing table + present row = phantom-applied drift, the #20 / silent `CREATE TABLE IF NOT EXISTS` no-op pattern).
   - Quote the exact rows returned. Do not paraphrase "it's fine" — show the data.
   - STOP and wait for approval before any write/apply step.

=== PHASE 2 (ONLY IF PHASE 1 SHOWS THE TABLE IS MISSING OR DRIFTED) — apply via the runner, never ad-hoc ===

- If the table is genuinely missing: apply it through the migration runner so `schema_migrations` stays authoritative — `npm run db:migrate` (NOT a hand-written `CREATE TABLE` via `run_sql`). Confirm `scripts/migrate.mjs` is pointed at the prod `DATABASE_URL` and run `npm run db:migrate:status` first.
- If the table EXISTS but the `schema_migrations` row is MISSING (table was hand-created): do NOT re-run the SQL. Reconcile the ledger only — record the filename as applied (use the runner's baseline/record path, e.g. `npm run db:migrate:baseline` semantics or the documented record command in `scripts/migrate.mjs`); do not blindly INSERT without confirming the SHA-256 the runner expects.
- Re-run the Phase-1 read-only queries to confirm the table + ledger now agree.

=== VERIFICATION GATES (all must pass before claiming done / opening any PR) ===

G1 — Premise stated with evidence: the report includes the literal `schema_migrations` query result for `%116%` AND the `to_regclass('public.investor_thesis')` result from the PROD branch. No conclusion without both rows shown.
G2 — Ledger/table agreement: after any Phase-2 action, `schema_migrations` has the 116 row AND `to_regclass` is non-null AND the column set matches the migration file. If they disagree, the gate FAILS — name the drift type and stop.
G3 — Functional proof (not silent-empty): as a seeded investor (e.g. sarah.investor@demo.com, password Demo123 — or seed a thesis row via the live `PUT /api/investor/thesis` first if none exists), call the LIVE matches endpoint identified in Phase-1 step 3 against prod and assert it returns NON-EMPTY matches when matching pitches exist. Critically distinguish a real `[]` (no matching pitches) from the `isMissingThesisTable` silent-degrade `[]`: confirm via the handler code path which branch fired (e.g. add a temporary log read via `wrangler tail`, or verify the table is queried by checking the response shape / status). A green-looking empty response is the exact failure mode this task exists to catch — do not accept it as a pass.
G4 — No ad-hoc schema writes: confirm any apply went through `scripts/migrate.mjs` (check `git diff` shows no stray manual SQL and `schema_migrations` SHA matches the file). If you applied by hand, the gate FAILS.
G5 — Pre-flight respected: confirm via `grep` that the thesis route you exercised is registered in `src/worker-integrated.ts` (live), not an orphan handler file.

Deliverable: a short written verdict — "applied / not applied / drifted", the evidence rows, what (if anything) was applied and how, and the G1–G5 pass/fail table. Report paths as absolute. Do NOT write a summary `.md` file — return findings in your message.
