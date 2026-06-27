# Evolution Roadmap — Pitchey
Generated from audit: backend-health investigation + autonomous-harness findings (2026-06-25/26)
Generated: 2026-06-26

## Executive Summary
The backend isn't under-developed — it's a fast, broad codebase whose migration-era debt was never reconciled because there was no guardrail forcing it. That guardrail now exists (worker type-gate, ratcheted to 9) and the worst debt is cleared: worker `tsc` 40 → 9, the userId string/number schism fixed at the root, 2 live runtime bugs closed. This roadmap prioritizes the **remaining liabilities that can actually hurt a pre-launch product** (a recurring total prod-outage; a notification path that may be silently dropping user messages) before deepening the **monetization moat** (structured investor intent → matching → deal-servicing). Sequencing rule: **stop the bleeding that's real, clear the cheap dead weight, then deepen the moat — and don't let either block the others.**

## The Defensible Core (what we're protecting and extending)
The moat is the **cross-role NDA-intent graph** — creators, investors, and production expressing real intent (NDAs signed, deals recorded, theses declared) in a way time + liquidity make hard to copy (per `project_moat_inventory`). Band 2 deepens exactly this: turning investor "thesis" from free text into a **structured, queryable record** (moat #7) so intent becomes matchable, then building the deal-servicing layer on top.

## Sequenced Plan

### Now — Active Liabilities [Band 0]

- **R0.1 Neon compute-quota → recurring total production outage** — `risk: critical` `gates: required`
  - **Defect:** the current Neon plan can hit a compute-time quota → HTTP 402 on every query → login 503s, marketplace silently empty (errors swallowed). Took prod **fully down twice** (2026-04-30 #65, 2026-06-22).
  - **Why now:** it's not hypothetical — it has recurred, and for a pre-launch product a total outage on launch day outranks every feature. `retryable:true` resets per window but the trigger is unmanaged.
  - **Shape of fix:** primarily a **plan/billing decision** (the durable fix), plus code hardening: a fail-loud health signal (not silent-empty), and a degradation banner so a 402 reads as "degraded" not "broken/empty". Do NOT paper over it with more swallowed retries.
  - **Verify:** a forced 402 (staging) surfaces as an explicit degraded state in `/api/health` + UI, not an empty marketplace; alerting fires within minutes, not the hourly cron.

- **R0.2 Notification category filter silently drops user notifications** — `risk: high` `gates: required` (issue #361)
  - **Defect:** `notification.service.ts` reads `investmentNotifications` / `ndaNotifications` / `pitchUpdateNotifications` + quiet-hours fields the loader **never sets** → `undefined` → those categories are **always blocked**; quiet-hours inert. (These are the 9 remaining worker `tsc` errors.)
  - **Why now:** if the `sendNotification → determineChannels` path is live (plausibly is, via `notification-integration.service`), users are **not receiving NDA/investment/pitch-update notifications** — directly undermines the demand→supply loop. The compiler can't see it (values launder through mis-typed objects).
  - **Shape of fix:** **confirm liveness FIRST** (vs the direct-insert `notify()` path), then align reads to the loaded fields (`investmentNotifications`→`investmentAlerts`) and decide whether nda/pitch-update/quiet-hours become real columns or are removed. Type-add LAST (so the type follows reality). NOT a blind type fix.
  - **Verify:** an investment/NDA notification is actually delivered for a user with default prefs; worker `tsc` → 0; gate baseline lowered 9 → 0.

### Next — Inert Liabilities & Honesty Debt [Band 1 + pinned Band 3]

- **R1.1 Delete 15 confirmed-orphan handler/route files** — `risk: low` `gates: optional`
  - **Action:** delete the 15 files the `dead-route-sweep` confirmed dead (re-confirmed 2026-06-26) — never imported into `worker-integrated.ts`, several in frameworks (Express/Oak/standalone-Hono) that can't run in the Worker. The harness already generated the gated execute prompt (`orphan-batch-delete`).
  - **Kills claim:** removes a chunk of the #308 "~179 orphan files" overhang that confuses every audit (and these docs).
  - **Verify:** per-file `grep` shows zero importers at delete-time; PROTECTED paths (#60/#61) excluded; `build:worker` bundles; worker `tsc` unchanged.

- **R1.2 Resolve `gdpr-handler.ts` + `documentation.ts` (revive-or-delete)** — `risk: low` `gates: optional`
  - **Action:** make the 2 `needs-human` calls the harness surfaced. `gdpr-handler` is a REVIVE cluster (compliance) — likely keep + wire, not delete. `documentation` — confirm parked-scaffold vs abandoned.
  - **Kills claim:** stops these from re-tripping the sweep nightly.
  - **Verify:** a written verdict per file + (if revive) a one-line spec for wiring, (if delete) zero importers.

- **R1.3 Reconcile the 4 stale in-flight PRs** — `risk: low→medium` `gates: recommended for #352/#349`
  - **Action:** the feature work that predates this session is diverging from `main`. Rebase **#352** (moat #7 schema, +753) and **#349** (activity event-sourcing, +498) onto current `main` and resolve conflicts; merge the docs **#337** (state-of-app + CI-gates-required) and **#351** (drift cleanup).
  - **Kills claim (Band 3):** #337/#351 are the honesty-debt fix — they make the docs/CLAUDE.md match reality (and #337 makes CI gates *required*, a real de-risk).
  - **Verify:** each rebased PR green on current main; no regressions vs the just-merged health work.

- **R1.4 Frontend orphan audit** — `risk: low` `gates: optional` (issue #104)
  - **Action:** the frontend has a parallel unmeasured orphan tree (the #308 numbers are backend-reliable only). Run `knip`/`ts-prune` to measure before any deletion.
  - **Verify:** a reliable frontend orphan inventory (measure-only; no deletes this pass).

### Then — Moat Deepening [Band 2]

- **R2.1 Structured investment-thesis → matching/notify (moat #7)** — `risk: medium` `gates: recommended`
  - **Extends:** the cross-role NDA-intent graph — the named monetization foundation. PR **#352** builds the structured `investor_thesis` schema (was free-text `users.bio`).
  - **Compounds because:** once investor intent is a structured, queryable record, it powers **matching** (genre/format/stage) and **proactive notify** to creators — the demand→supply loop that makes the marketplace liquid. This is the highest-compounding item: every other moat feature (deal-servicing) sits on top of queryable intent.
  - **Named gap closed:** investor intent is currently unqueryable text; phase-2 (public thesis rendering + matching/notify) is the unlock.
  - **Verify:** an investor thesis persists structured; a matching query returns relevant creators; a creator gets notified on a thesis match (and that notification actually delivers — depends on R0.2).

- **R2.2 Activity-feed event-sourcing** — `risk: medium` `gates: recommended` (PR #349)
  - **Extends:** the engagement/demand-supply loop — `activity_feed` only recorded `pitch_published`; #349 instruments all 8 engagement events so the feed reflects real activity.
  - **Compounds because:** a live feed drives retention + the producer→writer acquisition loop (per `project_acquisition_loop`).
  - **Verify:** saves/comments/deals/NDA events appear in the feed; the creator `/api/creator/activities` UNION stays fresh.

- **R2.3 Deal-servicing roadmap (post-#7)** — `risk: medium` `gates: recommended`
  - **Extends:** the moat from listing/intro toward deal-servicing (escrow/contracts are currently orphan; no take-rate). Per `project_moat_inventory`, this is the **next strategic build after #7 lands** — scope it, don't start it before R2.1.

## Sequencing Rationale
**R0.1 leads** because a recurring *total* outage on a pre-launch product is the only thing here that can kill the launch outright — and its durable fix is a decision (plan), not code, so it should be raised immediately even while engineering continues elsewhere. **R0.2 is second** because it's a live, user-facing silent failure on the exact loop (notifications) the moat depends on — but it requires a liveness check first, so it's a focused investigation, not a blind fix. **R1.1 jumps ahead of most things** because it's nearly free (the harness already drafted the gated prompt) and clears dead weight that pollutes every future audit. **R1.3 (rebase the stale PRs) is the unblock** — it's the friction point between everything just merged and everything queued; #352 in particular *is* the Band-2 moat item, so reconciling it is the prerequisite to R2.1. **R2.1 starts in parallel once Band 0 is in flight** — moat work is long and shouldn't wait behind cleanup; it's the highest-compounding item and everything strategic (R2.3) sits on it. Band 3 (docs honesty) rides on R1.3 rather than standing alone.

## Risk Register (for downstream gating)

| ID | Title | Band | risk | gates | error-handling-adjacent? |
|----|-------|------|------|-------|--------------------------|
| R0.1 | Neon compute-quota prod-outage | 0 | critical | required | **yes** (DB path, health, swallowed 402s) |
| R0.2 | Notification category filter drops messages | 0 | high | required | **yes** (DB reads + notification delivery) |
| R1.1 | Delete 15 confirmed-orphan files | 1 | low | optional | no |
| R1.2 | gdpr-handler / documentation revive-or-delete | 1 | low | optional | **yes** (gdpr = compliance/data path, if revived) |
| R1.3 | Rebase 4 stale PRs (#352/#349/#337/#351) | 1 | low→med | recommended | **yes** (#352 schema, #349 event writes) |
| R1.4 | Frontend orphan audit (#104) | 1 | low | optional | no |
| R2.1 | Structured thesis → matching/notify (moat #7) | 2 | medium | recommended | **yes** (schema + notify writes) |
| R2.2 | Activity-feed event-sourcing (#349) | 2 | medium | recommended | **yes** (engagement event writes) |
| R2.3 | Deal-servicing roadmap (scope) | 2 | medium | recommended | n/a (scope only) |
