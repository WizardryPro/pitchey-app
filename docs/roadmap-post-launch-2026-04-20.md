# Post-Launch Roadmap — Pitchey Platform

_Captured 2026-04-20 during the CI/CD unblock session. This is a reference document, not a session task list — execute phase-by-phase across sessions, not in one sitting._

## Context

Pitchey is technically feature-complete: 664 API routes, 4 portals + Admin, 88 migrations, 5-layer observability stack. Tonight (2026-04-20) we shipped PR #35 which unblocked CI/CD — the `🚀 Pitchey Platform CI/CD` workflow had been failing silently on every main push for weeks because `wrangler secret put SENTRY_DSN` collided with the `[vars]` binding in `wrangler.toml:208`. That's now merged.

But "feature-complete" ≠ "ready to run in production with real users". The operational-readiness audit from this session puts the platform at roughly **65% ops maturity**:

- **Solid:** observability (Sentry/Axiom/Analytics Engine/CF), auth observability, health check, migration runner, security scanning, CI permissions.
- **Partial:** ~180 silent `.catch(() => [])` sites remaining (down from ~196; `safeQuery` helper already in use across 10 files / 39 sites), Better Auth adapter not wired (issue #19, architectural debt), rollback script exists but never tested under incident.
- **Missing:** DR runbook, incident response playbook, capacity/load testing, automated dependency updates, Stripe go-live, change log / release tagging.

This plan is the path from "technically launched" to "operating the platform with confidence." It's phased so you can stop after any phase and still have a meaningfully-better system.

## Phase A — Close tonight's loose ends (this week, ~1 day)

Clear the in-flight work before starting anything new.

Verified state of open PRs via `gh pr list --state open` (2026-04-20 post-merge-of-#35): **#2, #30, #31, #34**. PR #16 (Zod v4) already merged 2026-04-19 at commit `1ef7cb5` — do **not** rework.

1. **Verify PR #35 fix landed correctly.** Watch the next push-to-main CI run; confirm `🔐 Sync Worker secrets` completes and all 5 wrangler secret puts succeed. Logs: `gh run view <id> --log` on the next run for workflow "🚀 Pitchey Platform CI/CD".
2. **Close #32 (orphan DOs).** Tonight's Cloudflare MCP check found zero orphans — all 6 PR-related DO namespaces map to Workers whose PRs are open (#30, #31, #34). Close with reference to this session's audit.
3. **Merge or decide the four actually-open PRs:**
   - **PR #34** — CORS tightening to scoped allow-list (closes #27). **Security blocker candidate** — merge first after a local CORS smoke (loading the frontend from allow-listed origins still works; a non-allow-listed origin is blocked).
   - **PR #30** — docs-vs-code drift audit + CI gate. Ship it. This is the meta-fix that would have caught the SENTRY_DSN config/secret split before it reached prod (see "Structural observation" below).
   - **PR #31** — CSP tightening for preview Workers (issue #18 Gap 2). Ship after confirming a preview deploy still loads.
   - **PR #2** — Blacksmith runner migration. Review benchmark; if no perf win vs GitHub-hosted, close. Don't leave it open as ambient decision debt.
4. **File follow-up issues** for the tech-debt surfaced this session:
   - Dormant `deploy-staging` job in `ci-cd.yml:156-194` that would deploy to **production** if ever triggered.
   - ZAP scan creates a new duplicate issue every push (current #17/#22 behavior) — make it diff-aware or gate by severity.
   - **Deno-era dead code sweep.** Commit `784488d refactor: Remove all Deno references from project` did not actually remove them — 95 `Deno.*` calls remain across 20 files. `worker-integrated.ts` has zero Deno calls (live path is clean), but 5+ handler/service files containing Deno code have zero importers and are dead: `src/handlers/webhooks/stripe.ts`, `src/handlers/video.ts`, `src/services/video.service.ts`, `src/services/transcoding.service.ts`, `src/handlers/websocket/messaging-ws.ts`, `src/testing/run-tests.ts`. Another ~14 files with 1-5 Deno calls need per-file import checks. Scope: 1-day cleanup PR that deletes confirmed-dead files and either ports or deletes the ambiguous ones. Run `grep -rn "\bDeno\." src/ | wc -l` before starting (baseline 95) and after (target 0).
5. **Issue #19 (Better Auth) — document-pass only, ~2 hours.** Three paths exist: rip out (3–5 days), migrate properly (2–4 weeks), or document the current hybrid. **Do the document-pass now** — it's 2 hours. Defer the rip-out/migrate decision until Phase B lands. Rationale: touching auth internals during the Stripe sprint is the worst possible time to discover a regression. The doc-pass is cheap and compatible with any future path. *This item can run in parallel with Phase B — it does not touch production code.*

### Structural observation

Tonight's session discovered **five independent "this has been silently broken/ignored for weeks" findings**: the CI/CD SENTRY_DSN collision (PR #35), the release-management workflow (PRs #28/#29), the Pages deploy misattribution, the ZAP-duplicate-issue noise, and the Deno "refactor: Remove all Deno references" commit that didn't actually remove them. The unifying pattern isn't any individual bug — it's that **refactors/fixes are declared done without verification, and CI doesn't scream when silent rot accumulates**. PR #30's drift audit + the CI-failure-visibility follow-up + grep-based completion gates are the meta-fix family. Treat them as Phase A priorities, not tech-debt cleanup.

Rule of thumb going forward: a refactor that claims to have removed all instances of X should end with `grep -rn "X" src/ | wc -l` → 0, committed as part of the refactor. Anything less is aspiration, not completion.

## Phase B — Revenue unlock (next 2–3 weeks, dominant focus)

Nothing else matters if the platform can't take money. This is the single biggest business-impact item on the board. During this phase, the strong default is **no non-Stripe production-code work** — context-switching away mid-flight is where go-lives fail.

### B.0 Scope pre-check (done during planning — collapses the phase)

Originally the concern was that `src/handlers/webhooks/stripe.ts` used `Deno.env.get` and needed porting to Workers runtime. **Verified 2026-04-20 — that file is dead code.** The live Stripe webhook is already fully Workers-native:

- **Live handler**: inlined in `src/worker-integrated.ts:9799-10104` (`handleStripeWebhook` method), ~300 lines, uses `this.env.STRIPE_WEBHOOK_SECRET`, proper signature verification, handles payment/subscription events, writes to `stripe_webhook_events` table from migration `076_stripe_webhook_idempotency.sql`, Sentry breadcrumbs on each branch.
- **Live route**: `POST /api/webhooks/stripe` registered at `worker-integrated.ts:2739`.
- **Live service class**: `src/services/stripe.service.ts` is Workers-native, imported at `worker-integrated.ts:29`.
- **Dead code**: `src/handlers/webhooks/stripe.ts` (`StripeWebhookHandler` class) has zero importers. Safe to delete as part of the Phase A Deno sweep.
- **Other dead Deno-era files** with zero importers: `src/handlers/video.ts`, `src/services/video.service.ts`, `src/services/transcoding.service.ts`, `src/handlers/websocket/messaging-ws.ts`, `src/testing/run-tests.ts`. Collectively ~45 Deno calls in dead files.

**Net Phase B scope**: no handler work. Go straight to Stripe dashboard configuration + secrets + smoke test. Realistic timeline is **3–5 days of focused work**, not 2–3 weeks.

### B.1 Stripe go-live (main work)

1. **Create products + prices in Stripe Dashboard** matching `src/config/subscription-plans.ts` tiers (creator €19.99/€29.99/€39.99, production-aligned).
2. **Populate `stripePriceId`** in `subscription-plans.ts` for each tier.
3. **Set CF secrets**: `wrangler secret put STRIPE_SECRET_KEY`, `wrangler secret put STRIPE_WEBHOOK_SECRET`. (These are real secrets — unlike SENTRY_DSN they don't belong in `[vars]`.)
4. **Configure the Stripe webhook endpoint** in the Stripe Dashboard to point at `https://pitchey-api-prod.ndlovucavelle.workers.dev/api/webhooks/stripe` (confirmed live route).
5. **End-to-end test**: subscribe with a test card from each portal, confirm `user_type`/`subscription_tier` updates in Neon, confirm webhook event logged in Axiom and written to `stripe_webhook_events`, confirm Sentry has zero new errors during the flow.

### B.2 Billing ops setup

Stripe dashboard alerts for failed payments, chargeback emails to a monitored inbox, tax/VAT configured for the right jurisdictions (especially EU given € pricing). Failed-payment dunning flow tested.

### B.3 Paywall smoke test

Log in as each portal type (creator, investor, production, watcher), exercise every paywalled action (credits, subscription upgrades, NDA gate purchases), confirm Stripe checkout → webhook → DB update → UI reflects new entitlement.

### B.4 Weekly drift-check (Fridays, ~30 minutes)

Three weeks of focused Stripe work is three weeks when nobody's watching the rest of the system. Budget **30 minutes every Friday** during Phase B to:

- Run the drift-audit script from PR #30 (once merged in Phase A) — any new drift flagged?
- Skim Sentry top errors — any new error pattern introduced by Stripe work or unrelated?
- Skim `gh run list --status failure --limit 20` — any CI workflow silently failing the way SENTRY_DSN did?
- Check the CF MCP for any new `secret`-triggered deploy bursts that indicate another silent loop.

Log findings in a running note (e.g. `docs/sessions/phase-b-drift-log.md`). If something real surfaces, file an issue — do **not** sidetrack into fixing it during the sprint unless it's a security regression. The goal is to finish Phase B with a known drift delta, not an unknown one.

## Phase C — Ops maturity sprint (weeks 3–6)

With revenue flowing, harden the operational posture. **Priority-ordered, and item 1 is load-bearing — do it before anything else.** Every other Phase C item assumes "if we break prod we can recover," so rollback must be proven first.

1. **⭐ Rollback drill — PROMOTED TO #1.** Test `scripts/rollback-deployment.sh --worker --dry-run` against staging. Then test the non-dry-run path — roll forward, confirm rollback restores the previous version. **Known unknowns to verify**: (a) does `wrangler rollback` actually exist in 4.83.0 and do what the script assumes? (b) the emergency-maintenance-worker fallback deploys a 503 page — does it actually deploy under load? (c) the script auto-confirms with a `ROLLBACK` text prompt — is that safe against fat-fingering? If any of these fail, **fixing the rollback script becomes Phase C item 1.5 before anything else**. A rollback script that's never been tested under incident conditions is effectively a prayer.
2. **Incident runbook** (`docs/INCIDENT_RESPONSE.md`, new). Severity matrix (SEV1/2/3), escalation ladder, who does what during an outage, status-page update procedure, post-mortem template. Link from CLAUDE.md. Now credible because the rollback from item 1 actually works.
3. **Finish the silent-error sweep.** **Important baseline correction**: the catch-swallow audit was written 2026-04-17; significant migration has since happened. Current reality (grep-verified 2026-04-20):
   - `safeQuery` is in use in **10 files / 39 call sites** — notably `pitch-feedback.ts` (7), `follows.ts` (7), `creator-dashboard.ts` (5, the exemplar), `analytics-endpoints.ts` (4), `pitch-interactions.ts` (2), `slates.ts` (2), `portfolio-share.ts` (2), plus `production-logger.ts`, `connection.ts`, and the helper itself.
   - Silent `.catch(() => …)` count is now **180 occurrences across 25 files** (down from ~196 at audit time).
   - The "0%" framing in the original audit is stale. Regenerate numbers before starting: `grep -rn "safeQuery\b" src/ | wc -l` and `grep -rn "\.catch\s*(\s*(\s*)\s*=>" src/ | wc -l`.
   - **Remaining Tier 1 work**: `slates.ts` has ~4 silent catches alongside its safeQuery uses; `creator-dashboard.ts` has ~7; `portfolio-share.ts` has ~1. Finish migrating the Tier 1 files fully before touching Tier 2.
   - **Largest single remaining target**: `src/worker-integrated.ts` has **59 silent catches** — but the audit warns many of these are intentional `ctx.waitUntil(...).catch(() => {})` for fire-and-forget telemetry. Needs human judgment per site; defer to Phase C.5 once Tier 1 is clean.
4. **Dependabot.** Enable in repo settings, scope to security updates on `main` only, weekly cadence. Cleanup existing `>10 outdated` packages flagged by quality-gates.
5. **DR runbook** (`docs/DISASTER_RECOVERY.md`, new). RTO/RPO targets, Neon point-in-time-restore procedure, R2 bucket backup validation, secret rotation checklist. Run a restore drill against a throwaway Neon branch to prove backups actually restore.

## Phase D — Scale readiness (weeks 7–10)

Before marketing drives real traffic, know how much traffic the system can absorb.

1. **Load test.** k6 or Artillery against a Neon branch + isolated Worker (not prod). Target: 100 concurrent logins, 500 concurrent pitch views, 50 concurrent NDA signs, 10 concurrent Stripe checkouts. Measure p50/p95/p99 latency and Worker CPU (CF hard limit 50ms). Document the ceiling in `docs/CAPACITY.md`.
2. **Perf regression gate.** Extend existing Lighthouse CI to assert budgets (LCP < 2.5s, CLS < 0.1, TBT < 300ms) on PR. Add a daily production perf probe via `chrome-devtools` MCP to catch regressions that only manifest under real load.
3. **Chaos drill.** Deliberately break one of: database connection, Axiom token, Upstash Redis. Verify Sentry fires, health check flips red, on-call gets notified, rollback procedure works. Document gaps.

## Phase E — Ongoing operational cadence

Once the above phases are shipped, the steady-state rhythm is:

- **Weekly:** review Sentry top errors, Axiom slow-query report, CF cost dashboard, any failed CI runs.
- **Monthly:** rotate one class of secret (JWT_SECRET, DATABASE_URL, etc.), review outdated dependencies, read the health-check-failure issues archive.
- **Quarterly:** load test, DR drill, security scan deep-dive (manual review of top SonarCloud findings), revisit deferred features (malware scanning via VirusTotal, crew availability calendars, rate cards) based on user demand.

## Critical Files & Commands

- `CLAUDE.md` — source of truth for platform state, TODO section has deferred items.
- `docs/catch-swallow-audit-2026-04-17.md` — tiered migration list (numbers now stale; regenerate before Phase C).
- `docs/observability-audit-2026-04-17.md` — baseline for what observability looks like.
- `docs/sessions/2026-04-20-handoff.md` — most recent session handoff (context for the issues worth closing).
- `src/db/safe-query.ts` — helper already in use; reuse for remaining Phase C work.
- `src/handlers/webhooks/stripe.ts` — confirmed dead code (zero importers); delete as part of Phase A item 4 Deno sweep.
- `src/config/subscription-plans.ts` — where `stripePriceId` needs to be populated for Phase B.
- `src/worker-integrated.ts` — live Stripe webhook (lines 9799-10104, route at 2739); also the largest remaining silent-catch surface (59 sites, many intentional).
- `scripts/rollback-deployment.sh` — rollback script to drill in Phase C item 1 **before** anything else.
- `scripts/migrate.mjs` — migration runner, used for any schema changes during any phase.

### Quick-reference verification commands

```bash
# Real open PRs (not trusting any agent's memory)
gh pr list --state open --limit 30 --json number,title,isDraft

# Is a specific PR merged?
gh pr view <n> --json state,mergedAt,mergeCommit

# Phase A Deno cleanup: baseline and target
grep -rn "\bDeno\." src/ | wc -l                       # baseline 95, target 0
grep -rn "\bDeno\." src/worker-integrated.ts | wc -l   # already 0 — live path is clean
grep -rn "StripeWebhookHandler" src/                   # dead class — cleanup confirms no live importers

# Phase B live-route verification (NOT the dead file)
grep -n "webhooks/stripe\|handleStripeWebhook" src/worker-integrated.ts

# Phase C item 3 baseline: current migration state
grep -rn "safeQuery\b" src/ | wc -l                    # should be ≥39
grep -rnE "\.catch\s*\(\s*\(\s*\)\s*=>" src/ | wc -l   # should be ≤180
```

## Verification

- **Phase A:** `gh pr list --state open` shows only PRs you *chose* to keep open. The next push-to-main CI run passes end-to-end. `docs/` has a short Better Auth hybrid-state note (2-hour doc-pass complete, even if #19 still open).
- **Phase B:** B.0 pre-check complete (webhook handler confirmed Workers-native, routing verified). End-to-end paid subscription from each portal succeeds, `SELECT * FROM users WHERE subscription_tier IS NOT NULL LIMIT 5` in Neon shows real updates, Stripe Dashboard → Events shows webhook 200s, Sentry shows zero new errors during the flow. `docs/sessions/phase-b-drift-log.md` has 2–3 weekly drift-check entries.
- **Phase C:** Rollback drill in item 1 passes end-to-end against staging (roll forward → rollback → service restored). `docs/INCIDENT_RESPONSE.md` + `docs/DISASTER_RECOVERY.md` exist and are linked from CLAUDE.md. `grep -rnE "\.catch\s*\(\s*\(\s*\)\s*=>" src/handlers/` on the Tier 1 files returns zero or near-zero hits. Dependabot PRs appear weekly.
- **Phase D:** `docs/CAPACITY.md` exists with documented ceilings; Lighthouse CI fails a PR that regresses LCP; a deliberately-broken binding produces a Sentry alert + health check red within 5 minutes.
- **Phase E:** This cadence just runs. Evidence = issues filed and closed weekly, Sentry error volume trending flat or down, no surprise outages.

## What this plan deliberately does not include

- **Marketing / growth.** Out of scope for technical planning; should be tracked in a separate plan owned by whoever runs acquisition.
- **New features.** Crew availability calendars, rate cards, VirusTotal malware scanning — all marked post-launch in CLAUDE.md. Revisit after Phase D based on actual user demand, not speculation.
- **Better Auth migration.** Deferred per Phase A recommendation; revisit after Phase B is stable.
- **Multi-region / HA.** Workers are already global-edge; Neon has PITR. Further HA work is premature until capacity testing (Phase D) shows the current setup won't hold.

## How to execute this document

This plan spans 6–10 weeks of work across many sessions. **Do not try to execute it in one sitting.** Pick one Phase A item per fresh session until Phase A is complete, then move to Phase B as a dedicated multi-day focus. Phases C–E follow naturally once revenue is flowing and you have data from real users.

The value of this document is as a **reference**: any future session can open it, check the quick-reference commands to re-verify current state, and pick up the next item without re-deriving context.
