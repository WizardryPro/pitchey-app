# Catch-Swallow Audit Snapshot — 2026-05-05

Re-audit of the [2026-04-17 plan](catch-swallow-audit-2026-04-17.md). The original
doc is retained as canonical rationale (anti-pattern taxonomy, `safeQuery` design,
why each site matters). This doc is the working artifact for the actual migration.

Read-only prep — no migrations performed on this branch.

## Headline numbers

| Metric | 2026-04-17 | 2026-05-05 | Δ |
|---|---:|---:|---:|
| Total `.catch(() => …)` in `src/` | 196 | 173 | -23 |
| Excluding `worker-integrated.ts` | 137 | 114 | -23 |
| `worker-integrated.ts` only | 59 | 59 | 0 |
| Files with residue (excl worker) | 26 | 20 | -6 |
| Sites tagged `// fire-and-forget` | 0 | 0 | 0 |
| **Orchestrator gate** (untagged, excl worker, target **<30**) | — | **114** | gap **85+** |

`safeQuery` adopted in 8 files (the 6 originally tagged Tier 1 + `creator-dashboard.ts` + `slates.ts`).

## Tier 1 — complete

All six Tier-1 files from 2026-04-17 are at zero residue. Migrations + file deletions:

| File | Was | Now | Notes |
|---|---:|---:|---|
| `worker-modules/analytics-endpoints.ts` | 3 | — | file deleted (Era-2 orphan rip) |
| `handlers/follows.ts` | 6 | 0 | migrated |
| `handlers/follows-enhanced.ts` | 1 | 0 | migrated |
| `handlers/pitch-feedback.ts` | 4 | 0 | migrated |
| `handlers/pitch-interactions.ts` | 2 | 0 | migrated |
| `handlers/portfolio-share.ts` | 2 | 1 | partially migrated; one residual |
| `handlers/slates.ts` | 7 | 4 | partially migrated |

Gate-feeding paths (consumption gate, follow counts, NDA writes, structured feedback) no longer silently swallow.

## Tier 2 — open working list (production + creator dashboard cluster)

This is the bulk of remaining work. **83 sites across 6 files**, all `.catch(() => [])` or `.catch(() => [{ total: 0 }])` on tagged-template SQL — exact anti-patterns #1 and #2 from the original doc.

| File | Sites | Notes |
|---|---:|---|
| `handlers/production-dashboard-extended.ts` | 22 | talent search, projects, budget, schedule, locations, crew |
| `handlers/creator-dashboard-extended.ts` | 16 | extended creator metrics |
| `handlers/production-sidebar.ts` | 15 | |
| `handlers/production-deals.ts` | 13 | |
| `handlers/production-dashboard.ts` | 10 | core production handler |
| `handlers/creator-dashboard.ts` | 7 | partial migration already in place; finish remaining read sites |

**Operator visibility goal**: each fall-back-to-empty-state UI path stays user-facing-ok, but a real schema/network error surfaces in Sentry instead of looking like "no data."

## Tier 3 — supporting handlers (smaller, tactical)

| File | Sites | Notes |
|---|---:|---|
| `handlers/production-pitch-data.ts` | 4 | |
| `handlers/slates.ts` | 4 | residual after partial migration |
| `handlers/ai-production-autofill.ts` | 3 | AI calls — failures should be loud (paid credits) |
| `handlers/ai-pitch-extract.ts` | 3 | same |
| `handlers/investor-pitch-data.ts` | 2 | |
| `handlers/collaborator.ts` | 2 | |
| `handlers/status-dashboard.ts` | 2 | |
| `handlers/mobile-auth.ts` | 1 | |
| `handlers/messaging-simple.ts` | 1 | |
| `handlers/portfolio-share.ts` | 1 | residual |

**Tier 3 total: 23 sites across 10 files.**

## Tier 4 — utils + worker-integrated.ts

| File | Sites | Notes |
|---|---:|---|
| `services/file-validation.service.ts` | 2 | |
| `utils/edge-cache-optimized-v2.ts` | 1 | |
| `worker-integrated.ts` | 59 | mix; classification required per site |

`worker-integrated.ts` sample classification (from 12-site spot-check):
- ~6 SQL aggregate reads with `.catch(() => [])` — **real swallows, migrate to `safeQuery`**
- ~3 `.catch(() => null)` on Stripe API reads where caller checks null — **defensible default-on-error, candidate for `// fire-and-forget` tag**
- ~3 `await db.query(...).catch(() => {})` on best-effort writes (post-login password rehash, Stripe detach) — **legitimate fire-and-forget, candidate for tag**

Full classification of all 59 is the most labor-intensive part of the audit.

## Excluded from working list (not in gate count either way)

| File | Sites | Reason |
|---|---:|---|
| `workers/crawl4ai-worker.ts` | 3 | **parked**, do not modify (issue #61, CLAUDE.md) |
| `db/safe-query.ts` | 2 | matches are inside the docstring describing the anti-patterns the helper *fixes*; not real code sites |

If the orchestrator gate counts strictly — **114** is the number to compare to <30.
If we exclude these 5 by exemption (parked + helper docstring) — **109** is the working number. Either way, far above the threshold.

## The fire-and-forget tagging gap

Per CLAUDE.md, the orchestrator-gate spec is:

> untagged `.catch(() => …)` residue < 30 in `src/` excluding `worker-integrated.ts`; telemetry sites must be marked `// fire-and-forget` on the prior line to be excluded from the count.

**Zero sites currently carry the tag.** Six occurrences of "fire-and-forget" exist in `src/`, but they document `void`/`waitUntil` patterns elsewhere on the line — none satisfy the "prior line" rule for any `.catch(() => …)` site.

This means the audit work has two components, not one:

1. **Migrate genuine swallows to `safeQuery`** — the dashboard cluster, AI handlers, etc.
2. **Tag legitimate telemetry catches with `// fire-and-forget`** — currently invisible to the gate. Most likely live in `worker-integrated.ts` (Stripe cleanup, password rehash, etc.).

Without (2), even after migrating every Tier 2/3 site, the worker-integrated 59 will still need per-site classification to land below 30. Tagging-only is the cheaper half of the work; doing it first reduces noise during the migration PRs.

## Suggested PR sequencing

Goal: clear the orchestrator gate (untagged < 30, excl worker-integrated) in 3–4 reviewable PRs, then tackle worker-integrated separately.

| PR | Scope | Sites cleared | Running total |
|---|---|---:|---:|
| 1 | `production-dashboard-extended.ts` + `production-dashboard.ts` | 32 | 114 → 82 |
| 2 | `creator-dashboard-extended.ts` + `creator-dashboard.ts` (finish) | 23 | 82 → 59 |
| 3 | `production-sidebar.ts` + `production-deals.ts` | 28 | 59 → 31 |
| 4 | Tier 3 sweep (any 2+ files) | 4–10 | 31 → ≤27 |
| 5 | `worker-integrated.ts` audit + tagging pass | varies | bring worker-integrated to a defensible state independently |

PR 1–4 each ship a meaningful chunk that's reviewable on its own and produces real Sentry signal increase (per the original doc's expectation: "After each tier, re-query Sentry for a week; expect new event volume from the now-visible failures").

PR 5 is a different shape — every site needs classification rather than mechanical migration. Likely 2–3× the review effort of any other PR. Sequence it last so it can absorb learnings from the earlier migrations.

## Prerequisites before the first migration PR opens

- [ ] Main is green (axios CVE PR `fix/axios-cve-bump` merged, Security Scan passes)
- [ ] Confirm `safeQuery` API hasn't drifted since the exemplar in `handlers/creator-dashboard.ts:creatorRevenueHandler`
- [ ] Confirm Sentry breadcrumb context-tag convention (PR 1 should grep one of the live exemplars and match its tag shape)

## What this branch contains

- This document (`docs/catch-swallow-prep-2026-05-05.md`) only.
- No code changes. The migration work begins on a separate branch after main is green.
