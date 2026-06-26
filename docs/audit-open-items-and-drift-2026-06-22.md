# Open-Items & Drift Audit — 2026-06-22

Grounded against live `main`, GitHub issues/PRs, and production `/api/health` by a 4-agent
verification sweep (not from memory — memory and docs were found to drift in both directions).
Answers: *what's actually open, what's drift, and how far from "the website is undoubtedly a reality."*

## TL;DR

- **Production was DOWN at audit time** — Neon Postgres hit its **compute-time quota (HTTP 402)**.
  Frontend served (200) but login 503'd, authenticated pages failed, and the marketplace
  silently returned `data:[]`. Smoke test #348 caught it. **Operational/billing issue, not code.**
  This — not any missing feature — is the gap between "deployed" and "undoubtedly real" today.
- **Memory massively *understated* progress**: ~a dozen entries said "pushed NOT merged" /
  "uncommitted on main" — **all had merged** (PRs #322–#347).
- **Feature-completeness is essentially there** for a demand-first launch (~1–2 wks polish).
  The real remaining work is (a) operational reliability, (b) silent-breakage hardening,
  (c) the monetization foundation (moat #7 structured thesis schema).

## 1. Live incident (audit-time)

`GET /api/health` → `status: degraded`, `database.error: "HTTP 402 ... exceeded the compute
time quota ... neon:retryable:true"`. Redis/Stripe/email/rate-limit all healthy.
- Frontend `index-BRg4v0Xc.js` served 200; login `/api/auth/*/login` → 503.
- Detection: smoke (#348, every 2h) caught it; `simple-health-check` (hourly) had last run at
  16:32 *before* the ~17:38 onset — **not a probe gap** (it already inspects per-service DB
  status via the "Check service statuses" step), just cron latency.
- **Action (owner): raise/upgrade the Neon plan** or wait for the quota window to reset
  (`retryable:true`). Related: #281 (admin cold-start) and the gated `KEEP_WARM_DB` are the
  same Neon-compute-cost tradeoff.

## 2. Drift reconciliation

### Memory was stale — these are ON MAIN (merged, mostly via squash)
| Item | Evidence |
|---|---|
| Analytics fabrication #287/#288 | `0ee5dff0` — hardcoded fakes removed from InvestorDashboard |
| NDA approve table-split #285 / mig 105 | `bd631350` |
| Saved searches #314 / mig 107 | `6ecb879f` (+#317/#319) |
| Media URL norm #313 / mig 108 | on main |
| Comment anonymity mig 106 | `26f1b93a` |
| Coverage gate "can never fail" | now ENFORCED — `quality-gates.yml` floors FE 42 / BE 2, `exit 1` |

### Other drift symptoms — RESOLVED (memory/docs stale)
- `json-summary` reporter + codecov paths fixed (the "never-written coverage-summary.json" bug).
- Catch-swallow gate wired (`ci-cd.yml`, `--include-worker --threshold 0`).
- `/api/company/verify` orphan **unregistered** 2026-06-21 (live: `/api/production/verify`).
- `FRONTEND_URL` correct (`pitchey-5o8.pages.dev`); `AXIOM_TOKEN` fail-closed in prod.
- `docs/reversibility-audit.md` **exists** — CLAUDE.md TODO was stale (now fixed).
- `verification_tier` **live** (reputation cron wired, silver via Stripe Identity / gold earned) —
  not "always grey."
- Watcher Phase 2 **partially built** (a `FollowFeed` exists in WatcherDashboard).
- Orchestrator (pillar 3) **both prerequisites met** (catch-swallow 0 untagged + rollback drill
  documented) — unblocked, not started.

### Still genuinely OPEN (small, low-risk)
- **#43** `notification_templates` table missing in prod — `EmailTemplateService` rip-vs-repair
  decision unmade.
- **Empty Better Auth tables** (`user/session/account/verification`) never dropped — verified
  safe (no live refs); drop migration just unwritten.
- **MEMORY.md over size cap** (~27.6KB vs 24.4KB) — trimmed in this pass.
- A drift-in-the-audit-itself: one agent *speculated* the health-check lacked a DB probe — it
  doesn't; verify before acting.

## 3. Open-work ledger

**(A) Launch-blockers (code):** none. Only the Neon quota (operational).

**(B) Post-launch enhancements:**
- #296 Notification gaps (messages, Stripe payment-failed/credits/subscription, team-join) —
  succeed but write no in-app notification. (messages + payment-failed = High.)
- #281 Admin cold-start slowness — Neon billing decision (`KEEP_WARM_DB`).
- #308 / #104 Orphan-code mass (~half of `src/` unreachable; frontend tree unaudited) —
  per-cluster decisions, no mass delete.
- Production dashboard Overview↔tabs duplication — open IA decision, not a bug.

**(C) Parked / deferred (explicit — do not touch):** #158 submissions pipeline, #60 Workflows
worker (PROTECTED), #61 crawl4ai (PROTECTED), VirusTotal malware scan (`scanFile()` stub returns
`clean:true`).

**(D) Strategy / moat-next:**
- **Moat #7 — structured investment-thesis schema: still just a free-text bio**
  (`InvestorSettingsProfile` maps "thesis" onto `bio`). The monetization foundation — without it
  the ~60 production buyers have nothing structured to pay for. *Named "build FIRST."*
- Pillar 2 unit-economics dashboard — scoped (`docs/`), unbuilt.
- Pillar 3 orchestrator — unblocked, not started.
- Stripe post-launch items (idempotency poisoning, dup `subscription_history`, EUR→GBP) —
  tracked, none addressed.

## 4. Distance to "undoubtedly a reality"

1. **Up & trustworthy (now):** ❌ blocked by Neon quota — fixable in hours via a billing decision.
2. **Feature-complete for launch:** ✅ effectively there (~1–2 wks polish). Deepest quality risk:
   the **silent-breakage class** — integration tests assert status codes, not side-effects, so
   flows can "succeed" doing nothing (3 critical flows had shipped broken, caught only manually).
3. **Durable as a business:** moat built but not yet monetizable — #7 thesis schema →
   deal-servicing → buy-side retention is the remaining arc.

**Bottom line:** feature-completeness is not the gap. Operational reliability (Neon) and
trust-in-correctness (silent-breakage + #7) are.

## In-flight branches
- PR #349 `feat/activity-feed-event-sourcing` — done, awaiting merge (CI red until Neon restores).
- PR #337 `docs/state-of-app-2026-06-19` — open docs snapshot.
- Stale branches pruned: `feat/revive-saved-searches`, `fix/analytics-fabrication-287-288`.
