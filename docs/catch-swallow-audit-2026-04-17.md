# Catch-Swallow Audit — 2026-04-17

## Problem

Handlers across `src/` use `.catch(() => default)` or `.catch(() => [])` on raw SQL
calls. This collapses two distinct outcomes into one shape:

1. **Query succeeded, returned empty rows.** Expected. User has no data yet, table is legitimately empty, etc.
2. **Query threw.** Schema drift, missing column, network hiccup, pool exhaustion.

Both paths return the same "empty" value — the handler then uses a fallback and nothing surfaces. Sentry sees nothing. Axiom sees nothing. The feature quietly degrades to zero.

The **consumption-gate bug** (2026-04-17) was the canonical case: `SUM(view_duration)` returning `0` because rows existed but the column was NULL looked identical to `SUM(view_duration)` returning `0` because the query exploded on a missing column. It stayed invisible for weeks.

## Fix: `safeQuery` helper

`src/db/safe-query.ts` — returns a discriminated union:

```ts
type QueryResult<T> =
  | { ok: true;  rows: T[]; errored: false }
  | { ok: false; rows: T[]; errored: true; error: Error };
```

Errors are reported to Sentry by default (with context tag). Callers MUST check `ok`/`errored` before using `rows` for anything load-bearing — gates, counters, quotas.

Exemplar patched: `src/handlers/creator-dashboard.ts` — `creatorRevenueHandler()` now distinguishes the three investment-table queries from each other, tagged by context.

## Remaining sites (196 occurrences across 26 files)

Priority order — highest-impact first (patterns that feed gates, quotas, or trust-signal calculations):

### Tier 1 — Gate / quota / trust-calculation (fix first)

- `src/worker-modules/analytics-endpoints.ts` (3) — view tracker, feeds consumption gate. `handleTrackView` already uses Sentry `captureError`; verify no callsites still silently swallow.
- `src/handlers/pitch-feedback.ts` (4) — structured feedback submission. Any swallow here hides legitimate submission failures.
- `src/handlers/follows.ts` (6), `follows-enhanced.ts` (1) — follow counts feed heat score.
- `src/handlers/pitch-interactions.ts` (2) — like / save / publish / archive. Writes that silently fail are worse than erroring.
- `src/handlers/slates.ts` (7) — slate CRUD.
- `src/handlers/portfolio-share.ts` (2) — token issuance / revocation.

### Tier 2 — Dashboard reads (fix in bulk)

- `src/handlers/creator-dashboard.ts` (19) — revenue/engagement/trends. Partially patched.
- `src/handlers/creator-dashboard-extended.ts` (16)
- `src/handlers/production-dashboard.ts` (10), `production-dashboard-extended.ts` (22), `production-sidebar.ts` (19), `production-deals.ts` (13)
- `src/handlers/investor-dashboard.ts` (1), `investor-sidebar.ts` (1), `investor-pitch-data.ts` (2)
- `src/handlers/creator-pitches.ts`, `production-pitch-data.ts` (4)

Dashboards can legitimately fall back to empty state — but the operator needs to see the error, so the UI fallback doesn't mask a broken schema.

### Tier 3 — Supporting handlers

- `src/handlers/ai-production-autofill.ts` (3), `ai-pitch-extract.ts` (3) — AI calls; failures should be loud, users paid credits for these.
- `src/handlers/collaborator.ts` (4), `teams.ts` (1), `mobile-auth.ts` (1), `messaging-simple.ts` (1), `status-dashboard.ts` (2)

### Tier 4 — Worker entry + auth + misc

- `src/worker-integrated.ts` (59) — many are legitimate fire-and-forget `ctx.waitUntil().catch(() => {})` for telemetry, which is the *correct* pattern. Audit required to separate these from real swallows.
- `src/auth/better-auth-worker-handler.ts` (2) — probably intentional; verify.
- `src/services/cdn.service.ts` (1), `file-validation.service.ts` (2), `utils/edge-cache-optimized-v2.ts` (1), `testing/test-framework.ts` (1)

## Anti-patterns to watch for

1. `.catch(() => [])` — **worst**. Total silence, returns empty array.
2. `.catch(() => [{ total: 0 }])` — **worst in disguise**. Returns valid-looking fallback shape; downstream code uses it as truth.
3. `.catch((err) => { console.error(...); return []; })` — **mid**. Errors go to Worker logs but not Sentry. Still loses rate-of-change and grouping.
4. `.catch(() => { Sentry.captureException(...); return []; })` — **acceptable** but loses the ok/errored distinction. Caller still treats result as data.
5. `ctx.waitUntil(promise.catch(() => {}))` — **correct** for telemetry fire-and-forget (Axiom ingest, metrics writes). Leave these alone.

## Rollout

- Don't migrate all 196 in one PR. Go tier-by-tier.
- After each tier, re-query Sentry for a week; expect new event volume from the now-visible failures.
- Each new error that surfaces is evidence the catch was hiding something. Fix it at the root (schema drift → migration; network → retry policy), don't just re-suppress.
