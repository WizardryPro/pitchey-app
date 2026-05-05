# Catch-Swallow Audit Snapshot — 2026-05-05

Re-audit of the [2026-04-17 plan](catch-swallow-audit-2026-04-17.md). The original
doc is retained as canonical rationale (anti-pattern taxonomy, `safeQuery` design,
why each site matters). This doc is the working artifact for the actual migration.

Read-only prep — no migrations performed on this branch.

## Status

**The original gate-feeding bug surface is closed.** All six Tier-1 files from the 2026-04-17 audit are at zero `.catch(() => …)` residue: `follows`, `follows-enhanced`, `pitch-feedback`, `pitch-interactions`, plus the deleted `worker-modules/analytics-endpoints.ts`. The class of bug the audit was originally written to address — consumption-gate-style failures where a query exception looks identical to legitimate empty data on paths that feed quotas, trust signals, or gates — no longer has a hiding place in the live request paths.

**The remaining 114 untagged sites are second-tier residue, not Tier 1 leftover.** Most are dashboard-read fall-back-to-empty-state patterns where the user-facing UI behavior is acceptable but the operator-visibility cost is the issue. None of them are on a path that silently corrupts gate state.

**The headline gate count (114) is currently uninterpretable.** See the next section: with zero `// fire-and-forget` tags applied anywhere in the tree, a count of "untagged residue" cannot distinguish genuine swallows from legitimate telemetry. Phase 1 of the work below is a tag-sweep that makes the count meaningful before any migration begins.

## Headline numbers

| Metric | 2026-04-17 | 2026-05-05 | Δ |
|---|---:|---:|---:|
| Total `.catch(() => …)` in `src/` | 196 | 173 | -23 |
| Excluding `worker-integrated.ts` | 137 | 114 | -23 |
| `worker-integrated.ts` only | 59 | 59 | 0 |
| Files with residue (excl worker) | 26 | 20 | -6 |
| Sites tagged `// fire-and-forget` | 0 | 0 | 0 |
| **Orchestrator gate** (untagged, excl worker, target **<30**) | — | **114**¹ | (uninterpretable¹) |

¹ The 114 figure is what the gate would currently report, but it is a mix of genuine swallows and legitimate fire-and-forget telemetry that has never been distinguished. Until Phase 1 tag-sweep lands, you cannot tell from this number whether 30 swallows remain or 84 remain. Don't use it for status reporting.

`safeQuery` adopted in 8 files (the 6 originally tagged Tier 1 + `creator-dashboard.ts` + `slates.ts`).

## Tier 1 — closed (migration ledger)

Backing detail for the milestone surfaced in §Status. All six Tier-1 files from 2026-04-17 plus the originally-Tier-1-adjacent `slates`/`portfolio-share` are at or near zero residue:

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

Without it, every migration PR's diff against the gate is illegible: you cannot tell whether a PR moved the count by fixing a swallow or by deleting telemetry that should have been preserved. Phase 1 below addresses this directly.

## Suggested sequencing — Phase 1 (tag sweep) before Phase 2 (migration)

The work has two phases. Phase 1 must complete tree-wide before Phase 2 begins, because Phase 2's review hinges on the gate count being interpretable.

### Phase 1 — tree-wide tag sweep

Visit every `.catch(() => …)` site in `src/` (all 173) and apply one of three classifications. **No behavioral change beyond tagging + breadcrumbs** — this is observability hygiene, not bug fixing.

| Bucket | Code shape | Criteria |
|---|---|---|
| **A. `// fire-and-forget`** | one-line comment immediately above the catch, code unchanged | Best-effort write or telemetry; failure is non-fatal AND caller does not act on the result. Examples: post-login password rehash, Stripe payment-method detach, Axiom log fire. Spec'd in CLAUDE.md as gate-exclusion mechanism. |
| **B. defensible-default + Sentry breadcrumb** | replace `.catch(() => default)` with a typed catch that adds a Sentry breadcrumb then returns the same default | Caller legitimately uses the default value, but error volume needs to be visible. Examples: Stripe API reads where null is checked, idempotent reads where transient failure is OK but pool exhaustion shouldn't be silent. |
| **C. migrate** | leave the catch in place but mark it for Phase 2 (e.g. `// TODO(catch-swallow): migrate to safeQuery`) | Read-side query where the fallback masks data semantics. The consumption-gate class — every Tier 2 dashboard catch is almost certainly this. |

Rough size estimate from the 12-site spot-check of `worker-integrated.ts`: ~50% bucket C, ~25% bucket B, ~25% bucket A. The dashboard handler files are likely close to 100% bucket C — read-path SQL aggregates with no fire-and-forget legitimacy.

**Suggested split** (one PR per row, in order):

| PR | Scope | Site count | Output |
|---|---|---:|---|
| Phase 1a | `src/handlers/*` + `src/services/*` + `src/utils/*` (everything except worker-integrated) | 114 | every site classified A/B/C |
| Phase 1b | `src/worker-integrated.ts` | 59 | every site classified A/B/C |

Splitting at the worker-integrated boundary because that file's per-site judgment density is much higher and it deserves its own focused review. Phase 1a should be mostly mechanical; Phase 1b will be where most of the bucket-A tags land.

After Phase 1 lands, the gate count (untagged residue) genuinely measures sites needing migration. The original target of <30 becomes meaningful.

### Phase 2 — migration of bucket-C residue, tier-ordered

Triggered once Phase 1 is in. Sites still marked `// TODO(catch-swallow): migrate` get their handlers ported to the `safeQuery` discriminated-union pattern. The tier ordering in the working list above (production+creator dashboard cluster first, then supporting handlers) drives PR sequencing here.

Because the bucket-C subset will be smaller than the raw 114 (excluded sites are now tagged or breadcrumbed), the original "3–4 PR" estimate is probably an over-count. Re-estimate after Phase 1a lands.

Per the original doc: after each Phase 2 PR, re-query Sentry for a week and expect new event volume from the now-visible failures. Each surfaced error is evidence the catch was hiding something — fix it at the root (schema drift → migration; network → retry policy), don't re-suppress.

## Prerequisites

Before Phase 1a opens:
- [ ] Main is green (axios CVE PR `fix/axios-cve-bump` merged, Security Scan passes)
- [ ] Confirm Sentry breadcrumb context-tag convention (Phase 1a should grep one of the live exemplars and match its tag shape — bucket B emits the breadcrumbs)

Before Phase 2's first migration PR opens:
- [ ] Phase 1a + 1b both merged; gate count under <30 target *or* documented why the residue can't reach it without code changes
- [ ] Confirm `safeQuery` API hasn't drifted since the exemplar in `handlers/creator-dashboard.ts:creatorRevenueHandler`

## What this branch contains

- This document (`docs/catch-swallow-prep-2026-05-05.md`) only.
- No code changes. Phase 1a (tag sweep across `src/handlers` + `src/services` + `src/utils`) opens on a separate branch once main is green.
