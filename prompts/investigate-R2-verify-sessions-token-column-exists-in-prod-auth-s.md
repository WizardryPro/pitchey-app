# R2 — Verify sessions.token column exists in prod (auth schema drift)

**Action:** investigate

---

You are working in the Pitchey repo (Cloudflare Worker `src/worker-integrated.ts` live router, raw SQL via `@neondatabase/serverless`, Neon Postgres, migrations numbered `NNN_*.sql` applied via `scripts/migrate.mjs` + `schema_migrations`). This is an INVESTIGATE-FIRST task. The premise is UNVERIFIED. Do not change any code until the premise is confirmed and you have reported findings.

## Goal
Determine whether the production `sessions` table actually has the `token` column that the login/session-creation code INSERTs into. The claim (unverified) is: `handleLoginSimple` (~worker-integrated.ts:1570) and `src/auth/session-store.ts` (~line 85) INSERT a `token` column; `src/db/migrations/add_missing_tables.sql` does NOT create it, while `better-auth-migration.sql` does. If prod lacks the column, session creation could be erroring or failing silently on every login — a launch-day blocker.

## Step 1 — VERIFY THE PREMISE (read-only, report before any code change)
1. Read `src/auth/session-store.ts` around lines 1-120. Confirm whether the INSERT into `sessions` actually references a `token` column, and capture the exact column list and which columns are read back / used later. Note whether `token` is ever SELECTed/read anywhere (`grep -rn "token" src/auth/session-store.ts` and trace usages).
2. Read `src/worker-integrated.ts` lines 1430-1644 (the login / session-creation region around `handleLoginSimple` ~1570). Confirm the exact INSERT statement and its column list. Note: the live cookie is `pitchey-session` (UUID) per CLAUDE.md — establish what value goes into `token` vs the session id.
3. `grep -rn "INSERT INTO sessions\|FROM sessions\|sessions (" src/` to enumerate every code path that writes/reads `sessions`, so you know the full contract the column must satisfy.
4. Inspect the migration files: `grep -rln "sessions" src/db/migrations/` then read the relevant ones (`add_missing_tables.sql`, `better-auth-migration.sql`, and any `*sessions*` file). Determine which migration is the one prod was actually built from. NOTE: CLAUDE.md/MEMORY.md say Better Auth was ripped and `sessions` is the LEGACY table — be skeptical that `better-auth-migration.sql` was ever applied to prod.
5. **Authoritative check — describe the LIVE prod schema** using the Neon MCP: call `mcp__neon__describe_table_schema` on the `sessions` table in the production project/branch (production Neon project; main branch). Confirm presence/absence of the `token` column AND its nullability/default. This is the ground truth — migration files are NOT (prod was hand-migrated and baselined per `schema_migrations`).

STOP and report: does `token` exist in prod `sessions`? Is it nullable? Does the code read it back or only insert it? Is login currently succeeding (the platform is live — if logins worked at all, a NOT NULL `token` column with no default either exists, or the INSERT omits it)?

## Step 2 — Decide the action based on findings (only after reporting Step 1)
- **Case A — `token` exists in prod:** No schema change needed. Premise is stale. Write up the finding (cite the describe_table_schema output) and stop. Consider noting in MEMORY that R2 was a false alarm.
- **Case B — `token` is MISSING in prod AND code inserts it:** This means either logins are erroring or the INSERT is being swallowed. Before adding a column, run gate G2 (below) to find out which. Then:
  - If the column is genuinely required by the INSERT and is read somewhere → add a migration `NNN_add_sessions_token_column.sql` using `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token TEXT;` (match type/nullability to what the code supplies — do NOT add `NOT NULL` without a default if existing rows lack it). Apply via the documented flow: Neon branch first (`mcp__neon__create_branch` → `mcp__neon__run_sql`), then prod, then record in `schema_migrations` per `scripts/migrate.mjs`.
  - If the column is write-only (inserted but NEVER read anywhere — confirmed in Step 1.1/1.3) → prefer REMOVING `token` from the INSERT statements over adding dead nullable schema churn. Removing an unused column from an INSERT is lower-risk than altering the live auth table. Make this call explicitly and justify it.

## Pre-flight rules
- Pre-flight per CLAUDE.md: confirm `handleLoginSimple` / the session-store path is the LIVE login path before editing (`grep -rn "session-store\|handleLoginSimple\|createSession" src/worker-integrated.ts`). `src/auth/session-store.ts` is described as having 4 raw-SQL methods used by inline login paths — confirm it's actually wired, not an orphan.
- Raw SQL only, no ORM. Neon client: use tagged templates or `sql.query(text, params)`; the function-call form `sql("...", [...])` is a known bug pattern in this repo.
- Touch only: `src/auth/session-store.ts`, `src/worker-integrated.ts:1430-1644`, and (if Case B) a new migration file under `src/db/migrations/`. Do NOT touch parked paths (`src/workflows/`, `src/workers/crawl4ai-worker.ts`).

## Verification gates (all must pass before merge)
- **G1 — Ground-truth schema captured:** `mcp__neon__describe_table_schema` output for prod `sessions` is pasted into the PR/report, explicitly stating whether `token` exists and its nullability. No action taken without this.
- **G2 — Failure-mode confirmed (only if `token` missing):** Query Cloudflare observability for errors on the login routes before concluding it's broken. Use `mcp__cloudflare-observability__query_worker_observability` (or `cloudflare-api` Code Mode `telemetry/query` per `reference_cf_observability_query` — timeframe in epoch MILLIS) filtered to `service = pitchey-api-prod`, `level = error`, looking for `column "token" does not exist` or session-insert failures. A swallowed failure would be invisible in the UI — confirm via telemetry, not by assuming. Record whether logins are actually failing.
- **G3 — Read-vs-write decided:** State explicitly whether `token` is read back anywhere (cite grep results). If unused, the chosen fix must be drop-from-INSERT, not add-nullable-column (no schema churn for a write-only field).
- **G4 — Migration applied + tracked (only if adding a column):** Migration uses `ADD COLUMN IF NOT EXISTS`, was applied on a Neon branch first then prod, and is recorded in `schema_migrations` (`npm run db:migrate:status` shows it applied). CI deploy-preflight gate must pass.
- **G5 — Live login smoke:** After any change, deploy (`npx wrangler deploy` from repo root) and verify a real login succeeds end-to-end with a demo account (e.g. alex.creator@demo.com / Demo123) against `pitchey-api-prod`, confirming a `sessions` row is created with the expected columns and `pitchey-session` cookie is set. Re-query telemetry (G2) for zero new session-insert errors in the post-deploy window.

Report findings as your final message (do not write a report .md file). Lead with the answer to G1.
