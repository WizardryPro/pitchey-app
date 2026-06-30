# R12 — Cross-role NDA-intent graph density metrics on /admin/liquidity

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker `src/worker-integrated.ts` live router, raw SQL via @neondatabase/serverless, no ORM; React 18 + Vite + Zustand frontend in `frontend/src`; Neon Postgres; Sentry/Axiom observability). Branch off `main`.

GOAL
Add **cross-role NDA-intent graph density metrics** to the existing admin liquidity dashboard. The moat thesis IS the cross-role NDA-intent graph over time + liquidity, but nothing currently measures its density. Compute graph-density metrics with read-only SQL over EXISTING tables (`ndas`, `collaborations`, `investor_thesis`, `production_deals`, `pitches`, `users`) and surface them on `/admin/liquidity`. No new tables, no new migrations, no new Analytics Engine bindings.

IMPORTANT GROUNDING (do not rebuild what exists)
- The endpoint `GET /api/admin/liquidity` ALREADY exists. It is NOT a registered route — it is served by `AdminEndpointsHandler.handleRequest` in `src/worker-modules/admin-endpoints.ts` (the if-chain branch `relevantPath[0] === 'liquidity'` near line 258, method `handleLiquidityGate` near line 1576). It already returns deal-servicing *gate* signals (buyers/week, deals/month, off-platform rate, mutual-confirm). Your job is to ADD a new `graphDensity` section to that same payload — do NOT delete or rewrite the existing gate signals.
- The frontend page ALREADY exists: `frontend/src/portals/admin/pages/AdminLiquidity.tsx`, fed by `adminService.getLiquidity()` in `frontend/src/portals/admin/services/admin.service.ts` (single GET to `/api/admin/liquidity`). Render the new metrics by extending this page; reuse the existing `getLiquidity()` call (do not add a second round trip).

PRE-FLIGHT CHECKS (run and read before editing)
1. `grep -n "handleLiquidityGate\|'liquidity'\|getSqlClient\|bareJson" src/worker-modules/admin-endpoints.ts` — confirm the handler, the if-chain branch, and the `this.getSqlClient()` / `this.bareJson(...)` helpers (lines ~106, ~118).
2. Read `src/worker-modules/admin-endpoints.ts` lines 1570-1669 (the full `handleLiquidityGate`) to match its style: tagged-template SQL (`` sql`...` ``), `this.logger.captureError(...)` on failure, `this.bareJson(payload, corsHeaders)` to return.
3. Read `src/db/safe-query.ts` to understand the `safeQuery` discriminated union (`{ ok, rows, errored, error }`).
4. Confirm the column reality before writing JOINs (history has drift):
   - `grep -rn "ndas" src/db/migrations/ | grep -i "signer_id\|user_id\|pitch_id"` and trust the LIVE code: the existing `handleLiquidityGate` uses `n.signer_id` and `n.signed_at` joined to `users u ON u.id = n.signer_id`. Per repo memory, `ndas` uses `signer_id`/`user_id`, NOT `requester_id`/`creator_id`. Follow the live handler's column names; do not invent `requester_id`.
   - `mcp__neon__describe_table_schema` (or `psql`) for `ndas`, `production_deals`, `investor_thesis`, `collaborations`, `pitches` to confirm the exact columns you reference (`production_deals` outcome columns came in migrations 114; `investor_thesis` in 116). If a column you want doesn't exist, drop that sub-metric rather than guessing.
5. Read `src/CLAUDE.md` section "`/api/admin/*` is shadowed by AdminEndpointsHandler" — this is why you MUST add the metrics inside `AdminEndpointsHandler` and MUST NOT `register('GET','/api/admin/graph-density', …)` in `worker-integrated.ts` (registered admin routes are dead-on-arrival unless added to the exclusion list). Extending the existing `liquidity` branch needs no exclusion-list change.

IMPLEMENTATION
A) Backend — `src/worker-modules/admin-endpoints.ts`, inside `handleLiquidityGate` (or a private helper `computeGraphDensity(sql)` it calls), add a `graphDensity` object to the returned payload computing, all read-only over existing tables:
   1. **NDAs per pitch (density)**: total signed NDAs, count of distinct pitches with ≥1 NDA, mean NDAs-per-engaged-pitch (`total NDAs / pitches-with-NDA`), and a small bucketed distribution (e.g. pitches with 1 / 2-3 / 4+ NDAs).
   2. **Cross-role signature counts (the moat edges)**: per pitch, count NDA signers by `users.user_type`; report total pitches that have **both** an investor-type AND a production-type signer (the cross-role density — the defensible asset), plus counts of investor-only and production-only pitches. This is the headline number.
   3. **Intent→deal conversion**: of pitches that have ≥1 NDA (intent), how many have an associated `production_deals` row / a deal reaching an outcome; report the conversion rate (deals ÷ NDA-engaged pitches). Use the deal↔pitch linkage that actually exists in `production_deals` (confirm the FK column in pre-flight; if no clean pitch linkage exists, fall back to creator-level conversion and label it as such).
   4. **Supply/intent signals (leading indicator for the "enough creator supply day-1" question)**: count of investors with a structured `investor_thesis` row, and count of `collaborations` (cross-role bridges) — both as simple totals/recent-window counts.
   - Style: tagged-template SQL matching the existing handler; coerce with `Number(r.x || 0)`.
B) Error handling gate — do NOT copy the existing `catch → return empty` silent pattern for the new section. Wrap the graph-density queries so a thrown DB error (e.g. Neon HTTP 402 compute-quota) is reported via `this.logger.captureError(...)` AND surfaced to the client as `graphDensity: { degraded: true }` (or a top-level `degraded` flag) — never all-zeros that read as "no graph". Use `safeQuery` from `src/db/safe-query.ts` if it composes cleanly with `this.getSqlClient()`; otherwise replicate its behavior (catch → report → set `degraded:true`). Genuine empty data (zero rows) must be distinguishable from a failed query.
C) Frontend — `frontend/src/portals/admin/pages/AdminLiquidity.tsx`: add TypeScript interfaces for the new `graphDensity` shape, extend the `LiquidityData` interface, and render a new "Graph Density" section (reuse the existing `SignalCard`/`StatusPill` components and Tailwind classes for visual consistency). Lead with the cross-role-both-sides count. If `degraded` is true, render a clear degraded banner (e.g. "Metrics unavailable — database degraded") instead of misleading zeros. No change needed to `admin.service.getLiquidity()` (same endpoint) unless you tighten its return type.

VERIFICATION GATES (all must pass before merge)
- **G1 — No silent-empty on quota/error.** Read-only queries surface failure, not zeros. Verify: (a) the new code path reports to Sentry via `this.logger.captureError`; (b) a forced query failure yields `degraded:true` in the payload and a degraded banner in the UI, not a graph of zeros. Manually exercise: temporarily break one query (bad column) locally, hit the handler, confirm `degraded:true`; then revert. Run `/catch-swallow-auditor` (or the `catch-swallow-gate.mjs --include-worker --threshold 0` gate) over the changed files and confirm no new untagged swallow.
- **G2 — No new Analytics Engine bindings.** `git diff wrangler.toml` shows ZERO changes to `[[analytics_engine_datasets]]` (the 7→2 prune was deliberate). All metrics come from Postgres tables only. Confirm with `grep -n "analytics_engine\|ANALYTICS" wrangler.toml` is unchanged.
- **G3 — Endpoint reachability.** Confirm the metrics are served from inside `AdminEndpointsHandler` (extended `liquidity` branch), NOT a `register('GET','/api/admin/…')` line (which would 404 per the shadow gotcha). `grep -n "graph" src/worker-integrated.ts` should be empty.
- **G4 — Build/type-check clean.** Worker builds (`npm run build:worker` or the repo's worker build) and frontend type-check passes: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`. Run frontend tests touching admin if any: `cd frontend && npx vitest run src/portals/admin`.
- **G5 — Column correctness.** Every table/column referenced in the new SQL was confirmed to exist via `describe_table_schema`/migration grep in pre-flight (no `requester_id`/`creator_id` invented on `ndas`; deal↔pitch linkage confirmed or creator-level fallback labeled).

Do NOT commit, push, or open a PR until I review the diff. When done, report: the exact metrics added, the SQL used, the deal↔pitch linkage column you confirmed, and which (if any) sub-metric you dropped due to a missing column.
