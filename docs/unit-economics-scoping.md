# Unit Economics Dashboard — Phase 4 / Pillar 2 Scoping

_Captured 2026-05-04 alongside the Phase 5.0 orchestrator decomposition. Same
shape: cross-check the strategy doc against runtime, surface drift, scope
day-level milestones with verification gates. Honest total: ~6 days active
engineering + 1-week soak observation._

## Scope corrections — strategy doc claims that don't survive contact with the runtime

| # | Strategy doc says | Runtime reality | Decision |
|---|---|---|---|
| 1 | "Cost per pitch view = Worker CPU ms × CF unit price + Neon compute time × Neon unit price" | **Worker CPU time isn't accessible in user code.** `performance.now()` and `Date.now()` give wall-clock duration, not CPU. CF charges on CPU; the two diverge dramatically for I/O-heavy requests (typical CPU/wall ratio 0.1–0.3 for DB-bound endpoints). | Two-path resolution. (a) For week-1 launch, use wall-clock as proxy and label it as such on the dashboard. (b) Follow-up: scheduled handler scrapes CF GraphQL Analytics API for true CPU-time aggregates, writes into AE. (b) is more accurate, more work — defer. |
| 2 | "Neon compute time × Neon unit price" | **Neon doesn't expose per-query compute-unit time in the connection.** Neon billing is org-level (compute-hour). Per-query duration (already captured in `database-metrics.service.ts`) is wall-clock not compute. | Same as #1: wall-clock as proxy, normalize to compute-hour-equivalent based on observed concurrency assumption. Document the conversion in the dashboard. |
| 3 | "Backed by SQL over surviving 2 AE datasets ... do not add new bindings" | True — `ANALYTICS` and `PITCHEY_ANALYTICS` exist. **But the schemas already written are heterogeneous** — different call sites write different blob/double layouts to the same dataset. SQL aggregation requires filtering by source-of-write. | Add a single canonical `cost_event` schema for unit-economics writes; tag with `metric_kind='cost_event'` in a blob slot so the SQL can filter. Other writes to the same dataset stay as-is. |

## Live drift surfaced during this scoping pass — already filed adjacent

- **`src/db/traced-operations.ts:223`** writes slow-query data to `env.PITCHEY_PERFORMANCE` (pruned 2026-04-17 per `docs/observability-audit-2026-04-17.md`). The `if (env.PITCHEY_PERFORMANCE)` guard makes it a silent no-op, so it doesn't error — but it looks like it's instrumenting slow queries when nothing is captured.
- **`src/services/trace-service.ts:206`** writes span trace data to `env.TRACE_ANALYTICS` (also pruned 2026-04-17). Same silent no-op.

These are **not** Phase 2 catch-swallow because they don't catch errors — they're guarded writes against missing bindings. They're a different drift species: **orphan writes to pruned bindings**. M1 below sweeps both.

## Existing AE write inventory (what's actually there)

| Site | Dataset | Schema (blobs / doubles / indexes) | Written when |
|---|---|---|---|
| `worker-integrated.ts:19657` | `ANALYTICS` | `[event, category, label, userId, userType, page, metadata]` / `[value]` / `[sessionId]` | Frontend `/api/analytics/track` call (user events) |
| `db/traced-operations.ts:450` | `ANALYTICS` | `[userId, type, resource]` / `[timestamp]` / `[type:user_activity]` | User activity logging (NDA creation, etc.) |
| `services/health-monitor.ts:376` | `ANALYTICS` | `[health_alert_<sev>]` / `[1]` / `[<sev>:<msg>]` | Health alert fires |
| `services/database-metrics.service.ts:52` | `ANALYTICS` (via param) | `[queryType, table, success, errorCode, endpoint, userId]` / `[duration, rowCount, timestamp]` / `[table:queryType]` | DB query logged (caller-driven, not auto) |
| `services/database-metrics.service.ts:86` | `ANALYTICS` (via param) | `[endpoint, method, statusCode, cacheHit, userId]` / `[duration, queryCount, timestamp]` / `[method:endpoint]` | API request perf logged (caller-driven) |
| `services/database-metrics.service.ts:119` | `ANALYTICS` (via param) | `[type, source, message, code, endpoint, userId]` / `[timestamp, 1]` / `[type:source]` | Error metric |
| `scheduled-handler.ts:197` | `ANALYTICS` | `[json(metrics)]` / `[hitRate, activeConnections]` | Cron tick (interval-driven) |
| `metrics-api.ts:397` | `ANALYTICS` | `[endpoint, method]` / `[duration, isError]` | Frontend `/api/metrics/record` call |
| `services/trace-service.ts:282` | `PITCHEY_ANALYTICS` | `[traceId, action, resource, result, userId, sessionId]` / various | Audit trail entries |

**Key observation**: heterogeneous schemas across the same dataset means querying for a specific metric (cost-per-pitch-view) requires careful filtering. Adding `metric_kind` as a blob slot in the new cost-event schema makes this clean without disturbing existing writes.

## Metric selection

**Pick: cost per pitch view** for the launch metric.

**Rationale:**
- **Highest volume** — every pitch view fires the metric, giving tight p50/p95 confidence. Lower-volume metrics (NDA signatures, investor onboarding) need weeks of data before percentiles are meaningful.
- **Simplest funnel** — single endpoint (`/api/pitches/:id`), single transaction. NDA/investor metrics span multi-step funnels and need event correlation.
- **Sets the floor** — every other unit-economic metric is bounded by view cost. If view cost is reasonable, others are too (in proportion). If view cost is wrong, we know to fix the foundation first.

**Deferred but valuable** (revisit after 4 weeks of view-cost data):
- Cost per NDA signature
- Cost per investor onboarded (funnel)
- Cost per Heat recomputation (already a cron — straightforward)

## Hard prerequisites

| ID | Description | Estimate | Gate |
|---|---|---|---|
| P1 | **Wall-clock-vs-CPU-time decision** — pick path (a) (proxy) or (b) (CF GraphQL scrape). Recommend (a) for launch with caveat label; (b) as follow-up. | 0.5 days | Decision documented in this scoping doc |
| P2 | **CF Analytics Engine SQL access from Worker or scheduled handler** — needs a CF API token with the right scope. The dashboard either runs SQL from the Worker (token in `env`) or the scheduled handler bakes daily aggregates into KV/R2 (read by Worker without token). | 0.5 days | Test SQL query returns valid response from staging Worker |

## Milestones

### M1 — Fix orphan AE writes to pruned bindings (0.5 days)

**What:** Address the two drift sites surfaced above. Either repoint writes to surviving bindings (`ANALYTICS` for slow-query, `PITCHEY_ANALYTICS` for span tracing) OR remove them with a comment citing why.

**Gate G-M1:**
- (a) Zero references to `env.PITCHEY_PERFORMANCE`, `env.TRACE_ANALYTICS`, `env.JOB_ANALYTICS`, `env.CONTAINER_ANALYTICS` in `src/`
- (b) Any retained writes (e.g., redirected to `ANALYTICS`) include `metric_kind` blob slot for SQL filtering
- (c) Add the orphan-write check to `scripts/docs-vs-code-audit.sh` as a tripwire — same shape as the BA-import check, watches for accidental re-introduction

### M2 — Instrument pitch-view handler with canonical cost-event schema (1 day)

**What:** Wrap the live pitch-view request handler (`worker-integrated.ts` route registration for `GET /api/pitches/:id` — find via grep) with a duration measurement that writes to AE on completion. Schema:

```ts
env.ANALYTICS.writeDataPoint({
  blobs: [
    'cost_event',           // metric_kind discriminator — load-bearing for SQL filtering
    'pitch_view',           // event type
    pitchId,
    userType ?? 'anonymous',
    cacheHit ? 'cache' : 'origin',
  ],
  doubles: [
    wallClockMs,            // total wall-clock duration
    dbQueryCount,            // for cost attribution
    dbQueryTotalMs,          // wall-clock DB time (subset of wallClockMs)
  ],
  indexes: [`pitch_view:${pitchId.substring(0, 80)}`],
});
```

**Gate G-M2:**
- (a) Synthetic `GET /api/pitches/:id` request to staging produces a row in AE with `metric_kind='cost_event'`
- (b) Wall-clock + DB query count + DB time all populated correctly (cross-check against `wrangler tail` and direct DB query log)
- (c) Cache-hit and origin paths both fire the event with correct `cacheHit` flag

### M3 — Pricing model + cost-calculation function (0.5 days)

**What:** Constants module `src/services/cost-calculation.ts`:

```ts
const CF_WORKER_PRICE_PER_MILLION_REQUESTS = 0.30; // USD, paid plan as of 2026-05-04
const CF_WORKER_PRICE_PER_MILLION_GB_S = 12.50;    // GB-seconds CPU
const NEON_PRICE_PER_COMPUTE_HOUR = 0.16;          // USD, Pro plan
const ASSUMED_WORKER_MEMORY_GB = 0.128;            // CF Workers default 128 MB
const CPU_TO_WALL_RATIO = 0.2;                     // proxy until M3-followup (CF GraphQL scrape)
```

Plus `computeCostUsd({ wallClockMs, dbQueryTotalMs })` returning the dollar cost.

**Gate G-M3:**
- (a) Unit test: 100ms wall-clock + 50ms DB time produces a non-zero, sub-cent cost figure that matches manual calculation
- (b) Pricing constants documented inline with date-of-rate-check; auto-stale if not refreshed quarterly (filed as comment, not actual cron)
- (c) Caveat label `"Cost is approximated using wall-clock × ${CPU_TO_WALL_RATIO} CPU/wall ratio. Refine with M3-followup if needed."` exposed via dashboard tile

### M4 — AE SQL aggregation + Worker endpoint (1 day)

**What:** SQL query against AE for p50/p95 cost-per-pitch-view over a time range. Worker route `GET /api/admin/unit-economics?metric=cost_per_pitch_view&days=7` returns JSON:

```json
{
  "metric": "cost_per_pitch_view",
  "currency": "USD",
  "calculation_note": "Wall-clock proxy with CPU/wall ratio 0.2",
  "window_days": 7,
  "p50": 0.000023,
  "p95": 0.000089,
  "p99": 0.000180,
  "view_count": 14823,
  "total_cost": 0.34,
  "delta_vs_prior_week_pct": -2.4
}
```

SQL approximate shape (CF AE SQL dialect):
```sql
SELECT
  quantileMerge(0.50)(durationState) AS p50,
  quantileMerge(0.95)(durationState) AS p95,
  count() AS view_count
FROM PITCHEY_ANALYTICS_view
WHERE blob1 = 'cost_event' AND blob2 = 'pitch_view'
  AND timestamp >= now() - INTERVAL 7 DAY
```

**Gate G-M4:**
- (a) Endpoint returns valid JSON for staging-traffic-driven data; `view_count` matches independent count from `wrangler tail`
- (b) Endpoint requires admin auth (gate via existing `requirePortalAuth('admin')` or equivalent)
- (c) Response time p95 under 500ms (AE SQL is fast but timeboxed)

### M5 — Frontend tile in `AdminAnalytics.tsx` (1 day)

**What:** Add a "Unit Economics" section to `frontend/src/portals/admin/pages/AdminAnalytics.tsx`. Initial tile renders cost-per-pitch-view p50/p95/p99, view count, total cost, and week-over-week delta. Includes the caveat label inline.

Format follows existing AdminAnalytics aesthetic — no new design system, no charts library beyond what's already imported.

**Gate G-M5:**
- (a) Page renders against staging data with values matching the M4 endpoint
- (b) Caveat label is visible (not hidden in tooltip — operators reading the number should see the caveat without hovering)
- (c) Refresh-on-load is fine; no live-streaming. Stale-up-to-1-day is acceptable for a unit-economics view.

### M6 — Week-over-week delta + 1-week verification soak (1 day setup + 1 week observation)

**What:** Delta computation in M4's endpoint compares prior 7-day window. Verify the delta makes sense over the soak period (numbers are stable, deltas don't oscillate wildly between refreshes).

**Gate G-M6:**
- (a) After 14 days of staging data, delta computation returns coherent values (not NaN, not 1000% week-over-week from low-data noise)
- (b) Delta gracefully handles low-volume weeks (e.g., < 100 views in a window — return `null` for delta with a "insufficient data" flag)
- (c) Verified against a manual SQL query for the same windows

## Critical path

```
P1 (path decision) ──┐
P2 (CF token)        ├── prereqs ──► M1 (drift fix) ──► M2 (instrument) ──► M3 (pricing) ──► M4 (SQL+endpoint) ──► M5 (frontend) ──► M6 (delta + soak)
                     ┘
```

Sequential by nature — not much parallelism opportunity since each milestone consumes the prior one's output. The exception: M1 (drift fix) can run in parallel with M2/M3 since it touches different files.

## Honest total

- Prerequisites P1+P2: **1 day**
- Milestones M1–M5: **4 days** active engineering
- M6 (delta + soak): 1 day setup + 1 week observation
- **Total active engineering: ~5 days**
- **Total wall-clock with soak: ~2 weeks**

Smaller than orchestrator (13.5 days, 10-week wall-clock) because:
1. Pillar 2 is observability, not autonomous action — soak validates correctness, not safety, so 1 week not 4
2. No multi-action surface to wire (orchestrator had 4 bounded actions)
3. Existing AE schemas can be extended cleanly without new bindings (per strategy doc — that part holds)

The CPU-time-not-accessible finding is the biggest delta from the strategy doc framing. Wall-clock proxy with explicit caveat is the pragmatic resolution; CF GraphQL scrape is the future-improvement path. Don't gate launch on accuracy that the dashboard wouldn't actually move on.

## Out of scope (explicitly)

- **Per-investor profitability tracking** — that's a different metric class (revenue per X), not unit cost. Pillar 2 is the **cost** half; revenue side is its own future scoping.
- **Real-time streaming dashboard** — refresh-on-load is sufficient. WebSocket-streamed unit economics is solution-in-search-of-a-problem until someone needs minute-level granularity.
- **Multi-currency** — USD only at launch. Pitchey is multi-currency on the consumer side, but unit economics is an internal cost view.
- **Cost attribution to individual users** — privacy-sensitive, and not what unit economics is for. Aggregate p50/p95 only.
- **CF GraphQL scrape for true CPU time** — listed as path (b) but deferred to a follow-up after the wall-clock proxy proves operationally valuable.

## Drift findings to file separately (do not bury)

- **Orphan AE writes to pruned bindings** (the two `traced-operations.ts:223` and `trace-service.ts:206` sites) — same drift class as the strategy-doc Hyperdrive finding from orchestrator scoping. File as a tracked issue alongside Phase 4 work; M1 closes it.
- **Heterogeneous AE write schemas across the same dataset** — not a bug, but a documentation gap. Worth a short `docs/analytics-engine-schemas.md` enumerating the current write shapes per dataset, so future writers don't accidentally collide. Lower priority; file as followup.

## Why this decomposition was worth doing

Same answer as orchestrator decomposition: surfaced 3 strategy-doc drift items + 2 live drift sites that the original "weeks" framing would have absorbed invisibly into milestone work. Honest 5-day active estimate is correct because the prerequisites (path decision, CF token, drift fix) aren't free — they're real work that the strategy doc didn't itemize.

The CPU-time finding is the load-bearing one. Without it, M2's instrumentation would have been "capture CPU time and wall-clock," then mid-execution we'd discover CPU time isn't accessible, then we'd refactor to wall-clock with caveat. Catching it in scoping saves the refactor.

## Maintenance

Update this doc when:
- A milestone ships → mark complete with merge commit link
- Pricing rates change (CF or Neon) → update M3 constants and bump comment date
- Path (b) becomes priority (e.g., wall-clock proxy proves insufficient) → reopen P1 decision

Do not maintain on a calendar.
