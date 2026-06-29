# R15 — Consolidate discovery under heat_score (retire parallel view_count ranking)

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker backend, `src/worker-integrated.ts` is the single live router; raw SQL via `@neondatabase/serverless`, no ORM; Neon Postgres; React 18 + Vite + Zustand frontend in `frontend/src`; migrations are numbered `NNN_*.sql` with `IF NOT EXISTS`, applied via `scripts/migrate.mjs` against `schema_migrations`). Branch off `main` before any code changes.

## Goal
Unify pitch discovery ranking on the role-weighted `heat_score` signal. Today there are TWO parallel ranking systems:
- CORRECT (already on heat): `GET /api/pitches/public/trending` → `getPublicTrendingPitches()` in `src/db/queries/pitches.ts` (ORDER BY `p.heat_score DESC NULLS LAST, p.view_count DESC, p.created_at DESC`).
- STALE (old formula `view_count + like_count*3` or `view_count`/`like_count` sorts):
  - `browsePitches()` in `src/worker-integrated.ts` (~line 9452), used by both `GET /api/pitches/browse` and `GET /api/browse`. Its `trending` and `popular` tab `orderClause` use `COALESCE(p.view_count,0) + COALESCE(p.like_count,0)*3 DESC`.
  - `handleBrowseTopRated()` in `src/worker-integrated.ts` (~line 14979), `GET /api/browse/top-rated` — `ORDER BY like_count DESC, view_count DESC`.
  - `pitchesDiscoverRealHandler()` in `src/handlers/common-real.ts` (~line 166), `GET /api/pitches/discover` — `ORDER BY p.view_count DESC NULLS LAST` etc.
- Also note `getTrending()` (~line 9489, `case 'trending'`) and the heat-using block near line 9704 (`COALESCE(p.heat_score,0) AS heat_score ... ORDER BY heat_score DESC`) — confirm which of these are live before touching; `getTrending` is registered at `/api/pitches/trending`, `/api/trending`, `/api/search/trending`.

This causes inconsistent "trending" across surfaces and the browse endpoint reportedly returns empty sometimes. `heat_score` is the moat-aligned signal (role-weighted cross-role engagement, computed by the Postgres function `recalculate_heat_scores()` from migration 080, run by the `updateTrendingAlgorithm()` cron in `worker-integrated.ts` ~line 22664).

## Pre-flight checks (do these first, report findings before editing)
1. Confirm the live routes and their bound handlers:
   - `grep -n "this.register" src/worker-integrated.ts | grep -E "browse|discover|trending|top-rated"`
   - Confirm `/api/pitches/browse`, `/api/browse`, `/api/browse/top-rated`, `/api/pitches/discover` are all live (they are at ~2323, 2628, 2637, 3974).
2. Confirm `heat_score` is a real column on `pitches` and `recalculate_heat_scores()` exists: read `src/db/migrations/080_*.sql` (and any later heat migration). Confirm the cron body at ~line 22664 calls `SELECT recalculate_heat_scores()`.
3. Read the exemplar correct query: `getPublicTrendingPitches()` in `src/db/queries/pitches.ts` (~line 631) — match its ORDER BY shape and `COALESCE(p.heat_score,0)::float as heat_score` projection.
4. Verify the frontend tabs that consume these endpoints so nothing silently breaks: `grep -rn "browse/top-rated\|pitches/browse\|pitches/discover\|/api/browse" frontend/src` and locate `BrowseTabsFixed` (the browse tab component) plus `BrowseTopRated`/marketplace pages. Note which response shape each expects (`items` array, `total`, etc.) — preserve those shapes exactly.

## Implementation steps
1. `browsePitches()` (~9452): change the `trending` and `popular` tab `orderClause` to rank by heat — `ORDER BY COALESCE(p.heat_score,0) DESC NULLS LAST, COALESCE(p.published_at, p.created_at) DESC` (keep the `new` tab on `published_at DESC`). Add `COALESCE(p.heat_score,0)::float AS heat_score` to `baseSelect` so the frontend can show heat badges consistently. Keep the existing 503-on-error behavior (do NOT revert to fake-empty 200).
2. `handleBrowseTopRated()` (~14979): change `ORDER BY like_count DESC, view_count DESC` to `ORDER BY COALESCE(p.heat_score,0) DESC NULLS LAST, p.created_at DESC`, and add `COALESCE(p.heat_score,0)::float as heat_score` to the SELECT. NOTE: this handler currently has a `catch` that returns a fake-empty `200` with `{items:[],total:0}` — leave that as-is for now unless R0/silent-empty work says otherwise; do not widen scope.
3. `pitchesDiscoverRealHandler()` in `src/handlers/common-real.ts` (~166): for the ranked/"trending"/"popular" branch(es) that sort by `view_count`, switch to `ORDER BY COALESCE(p.heat_score,0) DESC NULLS LAST, p.published_at DESC NULLS LAST` and project `heat_score`. Leave genuinely chronological branches ("new"/recent) on `published_at DESC`.
4. Remove now-duplicated ranking SQL: if any tab's heat ordering is identical, factor the shared `orderClause` into a single constant/helper rather than copy-pasting the formula. Do not break the Neon embedded-value pattern already used in `browsePitches` (no `$1` placeholders there) vs the parameterized `$N` pattern in `handleBrowseTopRated`/`common-real` — keep each handler's existing parameter style.
5. Bust the relevant Redis cache keys' formats if the response shape changed (the `browse:pitches:*` and `browse:top-rated:*` keys) — a shape change with a stale cache will serve old payloads; consider bumping the cache-key prefix (e.g. `browse:pitches:v2:...`).
6. Add an admin heat-status endpoint: `GET /api/admin/heat-scores/status` (register near the existing `POST /api/admin/heat-scores/recalculate` at ~3884; reuse the same admin-auth gating those admin routes use). It returns the last recalc timestamp and rows-updated count. Source the data WITHOUT new bindings: the cron at ~22664 already emits a structured log `{category:'heat_score', action:'recalculate_cron', outcome, updated, duration_ms}`. Cheapest grounded source = a small `heat_recalc_runs` row OR reuse an existing config/status table. Check for an existing `heat_role_weights` / heat config table first (`grep -rn "heat_role_weights\|heat_score" src/db/migrations/`); if a status row already exists, read it. If not, add a numbered migration (`NNN_heat_recalc_status.sql`, `IF NOT EXISTS`) creating `heat_recalc_runs (id, ran_at timestamptz default now(), rows_updated int, source text)` and INSERT one row from both the cron and the manual recalc handler. Endpoint returns the latest row.

## Verification gates (ALL must pass before opening/merging the PR — this PR is med-risk: it changes the live discovery ranking and adds a migration)

G1 — Heat-correctness integration test (write FIRST, before the ranking swap). Migration 080's bug proved `recalculate_heat_scores()` was untested. Add a test (backend integration tier — see `docs`/existing `*.integration.test.ts` and the throwaway-Neon-branch harness using `TEST_DATABASE_URL` with the no-prod guard) that: seeds pitches with known role-weighted engagement, calls `recalculate_heat_scores()`, and asserts (a) it returns/updates the expected number of rows, and (b) the resulting `heat_score` ordering reflects the role weights (a pitch with higher-weighted cross-role engagement outranks one with only raw views). This test must FAIL if the function is a no-op. Run it and confirm green: it gates the whole change.

G2 — No frontend tab silently breaks. Confirm each consuming surface still renders after the swap: `BrowseTabsFixed` tabs (trending/new/popular), `BrowseTopRated`/top-rated page, and the discover/marketplace surface. Run `cd frontend && npx vitest run` (relevant suites) and `cd frontend && npx tsc --noEmit -p tsconfig.app.json`. Manually verify (chrome-devtools MCP against a local `wrangler dev` or the live frontend) that each tab returns a non-empty, heat-ordered list and the response shape (`items`, `total`, `totalPages`/`hasMore`) is unchanged. Document the before/after ordering for one tab.

G3 — Heat recalc cron success is alertable (not JSON-log-only). Confirm a frozen-score regression would surface: the cron at ~22664 already `captureException` to Sentry on failure — verify that path, AND ensure the new `GET /api/admin/heat-scores/status` makes staleness observable (last `ran_at` older than ~30min = stale). If there is an existing CI/health probe (`simple-health-check.yml`), note whether heat staleness should route there; at minimum, the status endpoint plus the existing Sentry-on-cron-failure must together make a frozen `heat_score` detectable. State explicitly in the PR how a frozen-score regression would now be caught.

G4 — Worker builds and type-checks. The worker is NOT type-checked in CI by default, so run it locally: `npx tsc --noEmit` on the root tsconfig (or `npm run build:worker`) and confirm zero new errors. Also run the catch-swallow gate locally (`node scripts/catch-swallow-gate.mjs --include-worker --threshold 0`, or the npm script) — do NOT introduce any new untagged `.catch(() => default)` on the DB queries you touch.

G5 — Migration applied cleanly (if you added one). Run it against a Neon branch first (never prod directly), then `npm run db:migrate:status` to confirm it records in `schema_migrations`. The migration must be idempotent (`IF NOT EXISTS`).

## Constraints / gotchas
- Pre-flight rule: do not extend any handler you have not confirmed is wired through `src/worker-integrated.ts`. There are orphan parallel handler trees — the live one wins.
- Preserve each handler's existing response shape and its existing error behavior (browsePitches = 503 on error; do not "helpfully" change it). 
- Do NOT touch protected/parked paths (`src/workflows/`, `src/workers/crawl4ai-worker.ts`, `src/services/console-analysis-crawler.ts`).
- No new Analytics Engine / Durable Object bindings for the status endpoint — reuse a Postgres row.
- depends-on R7 (heat scoring foundation) — confirm R7's heat work is merged/live before relying on `heat_score` being populated; if `heat_score` is NULL for most rows in prod, flag it (the `NULLS LAST` ordering degrades gracefully but the consolidation buys nothing until the cron has run).

Deliver: the branch, the migration (if any), the G1 test, and a PR description that walks through G1–G5 with evidence (test output, before/after ordering, type-check/build output).
