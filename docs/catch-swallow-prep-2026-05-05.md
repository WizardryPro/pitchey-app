# Catch-Swallow Audit Snapshot — 2026-05-05

Re-audit of the [2026-04-17 plan](catch-swallow-audit-2026-04-17.md). The original
doc is retained as canonical rationale (anti-pattern taxonomy, `safeQuery` design,
why each site matters). This doc is the working artifact for the actual migration.

Read-only prep — no migrations performed on this branch.

## Status

**Phase 2 structurally complete (2026-05-07)** — all bucket-C sites migrated to `safeQuery` across the entire `src/` tree. Four PRs (#92, #93, #94, #95) cover the 133-site migration. When all four land, the gate counts **0 untagged AND 0 bucket-C** in both scopes (with and without `worker-integrated.ts`). The orchestrator-prerequisite gate (a) — "<30 untagged residue" — is met with margin.

Phase 2 PR ledger:

| PR | Branch | Sites | Scope |
|---|---|---:|---|
| #92 | `phase-2.1/safequery-production-dashboard-extended` | 22 | `production-dashboard-extended.ts` (canary) |
| #93 | `phase-2.2/safequery-production-family` | 42 | `production-sidebar.ts` (15) + `production-deals.ts` (13) + `production-dashboard.ts` (10) + `production-pitch-data.ts` (4) |
| #94 | `phase-2.3/safequery-creator-and-grab-bag` | 33 | `creator-dashboard-extended.ts` (16) + `creator-dashboard.ts` (7) + `ai-production-autofill.ts` (1) + `ai-pitch-extract.ts` (1) + `file-validation.service.ts` (2) + `status-dashboard.ts` (2) + `investor-pitch-data.ts` (2) + `collaborator.ts` (2) |
| #95 | `phase-2.4/safequery-worker-integrated` | 36 | `worker-integrated.ts` |
| | | **133** | |

**Gate-feeding sites — all closed in #94.** The three sites originally flagged as "Phase 2 priority" all received fail-closed-with-Sentry-report treatment:

- `services/file-validation.service.ts:394` (quota usage + tier lookup) — was returning `currentUsage=0, tier=free` on SQL error, allowing uploads past quota. Now sets `quotaLookupFailed=true` and returns `allowed: false` so the caller refuses the upload.
- `handlers/ai-pitch-extract.ts:72` (credit-balance gate) — was returning `balance=0` silently on outage (operator-blind). Now returns 503 "credit check temporarily unavailable" and reports to Sentry under `ai-pitch-extract.credit-check`.
- `handlers/ai-production-autofill.ts:91` (credit-balance gate) — same pattern, same fix, context tag `ai-production-autofill.credit-check`.

These were the original case study for why `.catch(() => default)` is dangerous. They are now operator-visible.

**Pillar 1 acceptance gate (orchestrator prerequisite) — open after Phase 2 lands.** Post-Phase-2 numbers: **0 untagged**, 8 fire-and-forget (legitimate), 0 bucket-B (all wrapped via `observedSwallow` / `observedSwallowReturning`), 0 bucket-C (all migrated). The companion gate (b) — Phase C.1 rollback drill verified end-to-end — remains the open prerequisite for Phase D.4.

**Mid-template comment fix (#90)** — Phase 1a's tagger had a `STMT_START` regex bug that inserted 5 `// TODO(catch-swallow)` comments *inside* `sql\`…\`` template literals, breaking those queries at parse time (PostgreSQL has no `//` comment syntax). The breakage was invisible because each affected query was wrapped in `.catch(() => [])`. PR #90 relocates the 5 comments, tightens the tagger regex (require `await` after `=` so SQL column-assignment lines like `updated_at = NOW()` no longer match), and adds a `findMidTemplateComments()` walker to the gate that hard-fails on any future occurrence.

---

**Phase 1a complete (2026-05-06)** — every `.catch(() => …)` site in `src/handlers/`, `src/services/`, `src/utils/` carries an A/B/C tag. Gate metric (untagged residue, excl. `worker-integrated.ts`): **0 of 109**.

**What 0/109 means and doesn't mean.** The gate metric measures "tagged vs untagged" — Phase 1a hits zero because every site now carries a marker. It does **not** mean every site has received per-site human judgment of the kind the May-2 framing originally anticipated. The actual shape of the work:

- **Bucket A (8 sites)**: per-site human classification — each judged as legitimately fire-and-forget (telemetry writes, request-body parse defaults).
- **Bucket B (4 sites)**: per-site human classification — each judged as a defensible-default-with-visibility-gap that needs a breadcrumb wrap.
- **Bucket C (97 sites)**: heuristic auto-classification — bulk tagger labelled them as migration candidates and the TODO marker carries that intent forward. The per-site judgment of "is this the right migration target?" is deferred to Phase 2, when each site gets ported to `safeQuery`.
- **3 gate-feeding C sites**: per-site human classification, flagged with rationale text in the TODO.

So the honest reading is: Phase 1a establishes A/B/C *classification* for every site; bucket-C sites are tagged as migration candidates, not yet individually-judged. Phase 1b covers `worker-integrated.ts`; Phase 2 is the per-site migration pass that retires the TODO markers. The gate count's interpretability problem (per the §"fire-and-forget tagging gap") is solved — A and C are now distinguishable in the count — but the orchestrator-prerequisite reading of "<30 untagged" should be understood as "<30 sites still pending any classification," not "<30 sites still pending migration."

Phase 1a finalized counts:
- **A — fire-and-forget**: 8 sites (telemetry writes, request-body parse fallbacks)
- **B — breadcrumb pending**: 4 sites (credit deduction + transaction log writes; Phase 2 prerequisite)
- **C — TODO(catch-swallow): migrate**: 97 sites (read-side dashboard fallbacks + 3 gate-feeding sites flagged in TODO text)

**Worker-integrated baseline** (Phase 1b scope): ~~59 untagged sites, 0 tagged~~ — closed 2026-05-06 by Phase 1b PR. Tree-wide gate metric across `src/` is now **0/168**.

Phase 1b finalized counts (worker-integrated.ts only):
- **A — fire-and-forget**: 15 sites (post-login password rehash, Stripe cleanup, Axiom logging, search-click tracking, session DELETEs, share-event INSERTs)
- **B — breadcrumb pending**: 8 sites (Stripe `getSubscription` reads, INSERT-RETURNING patterns where caller checks null, auth-optional fallback)
- **C — TODO(catch-swallow): migrate**: 36 sites (analytics dashboard reads, browse aggregates, info_requests reads, NDA document lookups)

Distribution: 25% A / 14% B / 61% C — close to the spot-check prediction of 25/25/50. Each site received per-site human classification (no bulk-by-file shortcut available — file is too mixed). Tagger config preserved as the audit artifact: see PR diff for the line→bucket mapping.

**~~Residual risk this PR does not fix.~~ Closed 2026-05-06 by B-site wrap PR.** The 4 bucket-B sites (`ai-pitch-extract.ts:191/197`, `ai-production-autofill.ts:211/217`) were credit-deduction and transaction-log writes that could still fail silently. The B-site wrap landed `observedSwallow` (a `safeQuery`-style helper for best-effort writes) and converted all four sites; revenue/audit-trail leakage is now visible in Sentry under the `catch_swallow.context` tag. Bucket B count is now 0; total `.catch(() => …)` sites in scope dropped from 109 to 105.

**Gate-feeding sites identified during Phase 1a** — 3 sites on paths the original audit was written to address:
- `services/file-validation.service.ts:394` — fail-open quota bypass; '0' on error lets user upload past quota
- `handlers/ai-pitch-extract.ts:72` — credit-balance check before AI charge; fail-closed but operator-blind
- `handlers/ai-production-autofill.ts:91` — same as above for autofill

**The original gate-feeding bug surface from 2026-04-17 is closed.** All six Tier-1 files are at zero `.catch(() => …)` residue. The 3 gate-feeding sites listed above are Phase 1a discoveries — newly-surfaced sites worth Phase 2 priority, not Tier-1 leftover.

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

## Tooling — Phase 1a deliverables

Two scripts ship with the Phase 1a PR (branch `phase-1a/catch-swallow-tag-sweep`):

- `scripts/catch-swallow-gate.mjs` — counts tagged vs untagged sites, breaks down by bucket. Supports `--list`, `--include-worker`, `--threshold N` (exit non-zero if untagged > N — for CI gate use). Default scope excludes `worker-integrated.ts`.
- `scripts/catch-swallow-tag.mjs` — bulk tagger for buckets A and C. Idempotent: re-running skips already-tagged sites. Walks back from `.catch` line through statement body to statement-start (`await`, `const`, `sql\``, method-call openers like `db.query(`), then inserts tag on the line above. Bucket B sites must be hand-tagged with the special `// TODO(catch-swallow): bucket-B breadcrumb pending — <reason>` marker (the gate counter recognizes this distinct from regular C).

Tag conventions (mirrors CLAUDE.md gate spec):
- `// fire-and-forget` — bucket A
- `// TODO(catch-swallow): bucket-B breadcrumb pending — <reason>` — bucket B
- `// TODO(catch-swallow): migrate to safeQuery[ — <reason>]` — bucket C

## What this branch contains

Phase 1a PR (branch `phase-1a/catch-swallow-tag-sweep`):
- 18 files, +110/-1 lines, comment-only diff
- 2 new scripts (`catch-swallow-gate.mjs`, `catch-swallow-tag.mjs`)
- Original prep doc (`docs/catch-swallow-prep-2026-05-05.md`) updated with finalized counts
