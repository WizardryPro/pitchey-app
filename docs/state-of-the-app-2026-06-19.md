# State of the Application — 2026-06-19

A current-state snapshot + weak-parts map for ideation, ~1–2 weeks before a **demand-first
launch** (~60 production companies seed first and drive everything; supply populated by their
trusted networks). Produced from a 4-agent grounded audit (backend, frontend/UX, product/moat,
quality/ops). Companion docs: `creator-portal-visual-rework-scope.md` (per-page UI grades),
`pitchey-moat-and-value-plan-2026-06-12.md` (strategy).

---

## Executive summary

**Where we are.** The product is feature-complete for a demand-first launch and the
production-company path is verified healthy end-to-end (3 launch-hardening audits, all green).
This session shipped the moat backlog (open-call notify, who-viewed tier-gate, provenance,
tracked slate shares, **Creator Deal Inbox — which also un-bricked the entire deal subsystem**,
value dashboard, verification) and built the missing safety net (a backend **integration tier**
driving the real worker against a Neon branch + an **enforcing** coverage gate). All of it is
live in prod.

**The defining risk** is a single pattern that recurs across every dimension: **silent
breakage** — code that "succeeds" without throwing and without failing a unit test. Three
business-critical flows had *never worked* in prod and nobody knew (the deal subsystem's 3 dead
DB triggers, a dead `*`-wildcard route, a phantom-column verify endpoint, ~39 no-op toasts). We
caught these by *manually driving flows*, not by tooling. The net now guards the *known* past
failures; the open question is how many *unknown* ones remain.

**The 6 highest-leverage weak parts** (across all dimensions, ranked):

1. ~~**Branch protection doesn't mark the now-working gates as REQUIRED**~~ — ✅ **DONE
   (2026-06-20).** `main` now requires *Code Coverage Quality Gate*, *⚡ Worker Tests*, and
   *🎨 Frontend Tests* before merge (codified in `scripts/setup-branch-protection.sh`). A red
   gate can no longer merge. Follow-up: make the path-filtered `integration` job an always-run
   skip-pass gate so it too can be required.
2. **The silent-wrong-answer class is only guarded at "didn't 500"** — integration tests assert
   status, not side-effects (DB row written? credit changed? access granted correctly?). Most
   expensive on the money (Stripe/credits) and trust (NDA/verification) paths.
3. **Orphan / dead-code mass** — ~half of `src/` is unreachable (issue #308); duplicate handler
   trees + the int-vs-UUID id split make "fix the wrong file / revive the wrong tree" a constant
   trap (the #20 pattern).
4. **No shared frontend design-system primitives** — no `PageHero`/`StatTile`/sticky save; the
   root cause behind ~10 C/D-grade creator pages, *multiplied across 3 portals* via shared
   components (Following, Messages, Billing render identically everywhere — and the
   Investor/Production/Watcher portals were never audited).
5. **The moat's monetizable layer has no foundation** — #7 structured thesis schema is unbuilt
   (the "investment thesis" is a relabelled bio), so taste-match and a buy-side Deal Flow
   subscription can't ship; the 60 buyers have *nothing to pay for* at launch.
6. **Buy-side activation/retention is undefined** — the whole launch bets on 60 production cos
   *staying active*, but the shipped loops are creator-facing/one-shot and there's no buyer
   return-hook or activation tripwire. A quiet buy side is a silent, fatal failure mode.

---

## 1. Backend & tech debt

**Current state.** One Cloudflare Worker (`src/worker-integrated.ts`, ~22.5k lines) hosts a
hand-rolled `RouteRegistry` dispatching ~711 routes over Neon Postgres (raw SQL, no ORM) +
Upstash/KV/R2/2 DOs. Auth is consolidated and well unit-tested (~96–100% on the auth ring).
The live request path now has a real test net — the integration tier (13 files/~79 tests) — and
the coverage gate enforces. `safeQuery` (47 sites) + the migration runner are the drift-detection
muscle.

**Weak parts (for ideation):**

1. **Orphan/dead code & parallel handler trees (#308).** ~179 of 366 `src/` files unreachable
   (Era 0–6 trees, BA leftovers, 8 unbound DOs, duplicate monitoring). → *Tier-retire verified-dead
   clusters behind per-cluster decisions? A CI "reachability lint" that flags new orphans at PR
   time? In-tree annotations so an agent can't mistake orphans for live?*
2. **Router can't express wildcards, silently.** `pathToRegex` only handles `:param`; `*` becomes
   a regex quantifier → `/api/views/pitch/*` was dead its whole life. → *Startup assertion that
   rejects non-`:param` globs? A route-coverage probe that asserts every registered path matches a
   synthetic request?*
3. **Phantom-column writes (a whole bug class).** `/api/company/verify` reads/writes
   `users.verification_status` — no migration defines it (real col is `verification_tier`). Same
   shape as the production_deals triggers. → *A schema-vs-code linter: extract column refs from raw
   SQL, diff against live `information_schema`. How many more lurk?*
4. **production_deals never worked — 3 dead triggers (fixed, migration 111).** Business logic in
   phantom-schema triggers failed silently for the table's life. → *Move validation to the app
   layer? Every table-with-triggers gets ≥1 integration insert test?*
5. **Int-vs-UUID id drift.** Live tables use int PKs; Era-2 drizzle tables declare UUID
   `users(id)` FKs. Reviving any UUID-keyed orphan FK-fails (bit delete-account #316). → *Is the
   UUID half entirely dead/retirable? One-time audit of which id-typed tables hold prod rows.*
6. **NDA signer drift** (`signer_id`/`requester_id`/`pitch_access.user_id`) — `getPitch` cascades
   3 schema generations. Worked-around, but the #284 split broke NDA for all non-demo users. →
   *Collapse to one canonical `ndas` shape + delete fallbacks, or is data stranded in legacy tables?*
7. **Silent error-swallowing.** ~12 raw `.catch(() => default)` + verify's `{verified:false}`
   swallow remain; partial `safeQuery` adoption. → *Finish the migration; should the gate flag any
   `catch` returning a 2xx-shaped body?*
8. **Live-path coverage concentrated on known breakages.** ~79 integration tests vs 711 routes;
   admin/uploads/messaging/credits/search unexercised (note: `/api/admin/*` is shadowed by
   `AdminEndpointsHandler` — registered admin routes are dead unless excluded). → *Ratchet a
   behavioral route-coverage target (status≠500 across all 711)?*
9. **Structural debt** — the 22.5k-line single file + parked code (#60/#61) inflating the orphan
   surface. → *A safe extraction seam? Quarantine parked code outside `src/`?*

**Top 3 backend risks:** (1) silent phantom-column/schema-drift writes; (2) orphan mass +
int/UUID split; (3) live-path coverage only on known breakages.

---

## 2. Frontend & UX

**Current state.** React 18 + Vite + Zustand + Tailwind on CF Pages; one SPA (`App.tsx`), 4
portals + Admin under a shared `PortalLayout`, inline auth/RBAC guards, no React Query (per-page
`apiClient`). Same-origin via the Pages Functions proxy. The **Creator Dashboard is the polished
bar**; the UI shipped this session (WhoViewedPanel, CreatorDealInbox, slate share/cover) reuses
its vocabulary and is on-brand. Toast feedback (long silently broken) is fixed. FE ~45% lines,
skewed: services/store high, `components/` **4.7%**, `features/` ~26%.

**Weak parts (for ideation):**

1. **No shared design-system primitives.** Zero hits for `PageHero`/`StatTile`/`StatGrid`; every
   page hand-rolls. Root cause of most C/D grades. → *Build `PageHero`+`StatGrid`+sticky `SaveBar`
   first, then retrofit. Minimal prop API covering all 4 portals? Auto-pull brand token from
   layout context so color-drift is structurally impossible?*
2. **Cross-portal inconsistency, multiplied by shared components.** `Following`, `Messages`,
   `Billing`, `Profile`, `Settings`, `ManagePitches`, `OpportunitiesBoard` are the *same
   components* in Creator/Investor/Production — so the known-bad ones appear in every portal. The
   Investor/Production/Watcher dashboards were **never visually audited**. → *Run the same
   screenshot-audit on Investor + Production before assuming parity. Make shared pages
   portal-theme-aware.*
3. **Pages escape portal chrome → "double header."** `Following`, `CreatorPortfolio`,
   `CreatePitch` render their own `min-h-screen`/`<header>` (and Portfolio is the
   investor-facing shared surface). → *Audit `min-h-screen` page wrappers (56 matches); an ESLint
   rule: portal pages must not render their own chrome.*
4. **Brand/color drift baked into shared components.** `Following` uses investor-blue + arbitrary
   green on every line — so the *creator* portal shows blue. NDA/Billing/Messages use green. →
   *Centralize on `brand.portal-*` tokens; lint raw `blue-`/`green-` in portal pages; a
   `usePortalTheme()` hook.*
5. **Debug/operational controls leaking to users.** A fake **"E2E" encryption toggle** in
   Messages (a false security signal), auto-refresh checkboxes, live "Last updated" strips. →
   *Remove the E2E toggle (or make encryption real+ambient); replace auto-refresh with a status dot.*
6. **Two unreconciled toast systems** (one was a silent no-op for ~39 files). → *Standardize on
   one; a test asserting a `<Toaster/>` sink is mounted at root.*
7. **`components/` 4.7% coverage — exactly the reusable widgets a design refactor will rewrite.**
   → *Cover the 10 most-imported components first (reuse-weighted); per-directory coverage floor.*
8. **Dead/orphan frontend surfaces.** `ProductionPitchCreate` imported but never routed (a
   non-persisting form); `/marketplace-old`; duplicate `Enhanced*Analytics` twins vs the live
   inline tabs (#20, frontend edition). → *Drop the unrouted import + alias; catalog which
   analytics component renders per portal and delete the twin.*
9. **Anxiety copy / raw data at the UI.** Front-loaded credit warnings (CreatePitch), persistent
   credit banner in Messages, raw ISO dates (Opportunities), 💜 emoji like-counts. → *Inline
   neutral credit pill at the action point; route dates through `formatDate*`; Lucide not emoji.*

**Top 3 frontend risks:** (1) no design-system primitives (root of the C/D grades, ×3 portals);
(2) un-audited Investor/Production/Watcher inheriting the known-bad shared pages; (3) 4.7%
component coverage — the exact code a refactor rewrites, invisible until users hit it.

---

## 3. Product & moat

**Current state.** Moat = the **cross-role NDA-intent graph** (time + two-sided liquidity, not
code). All four strategy pillars now have ≥1 live item: Pillar 1 liquidity levers (#1 open-call
notify, #5 tracked slate shares, saved-search bridge — all 3 cold-start levers shipped); Pillar 2
(#2 who-viewed tier-gate); Pillar 3 trust (#4 provenance, verification silver+gold, #8 value
dashboard); Pillar 4 (#6 Deal Inbox — Pillar 4 unblocked, deal subsystem un-bricked). Launch is
demand-first (~60 production cos). Pillar-2 data-graph work is **gated** on proving NDA-graph
density moves first.

**Weak parts (for ideation):**

1. **The "investment thesis" is a relabelled bio (#7 unbuilt).** No structured columns
   (`genres[]`/`stage`/`cheque`/`regions`) — nothing to match a pitch against. Keystone of Pillar
   2. → *Minimum structured-thesis schema that gives a visibly-useful match on sparse data, as a
   60s onboarding step the 60 buyers actually complete? Bootstrap the thesis vector from implicit
   signals (views/saves/NDAs) so it doesn't depend on self-declaration?*
2. **Pillar-2 gated on liquidity you can't measure.** "Visibly move" is a vibe; no NDA-graph
   density metric or threshold exists. → *Define the single density North Star (e.g.
   NDAs-signed-per-active-buyer-per-week, or % buyers with ≥2 cross-creator NDA edges) + the
   threshold that flips the gate; surface it as an operator gauge.*
3. **Monetization is thin and mostly free.** The captured graph is barely monetized; #2 is the
   one upsell and it's creator-side; the buy-side Deal Flow subscription is blocked on #7. The 60
   buyers have **nothing to pay for** at launch. → *First thing a production co would pay for that's
   graph-powered and shippable without #7? Is who-viewed really the right upsell, or should it be
   on the buy side (higher willingness-to-pay)?*
4. **Demand-first bets everything on 60 buyers *staying active*.** Seeding ≠ activating; no
   buyer retention/activation loop described. A quiet buy side fails silently. → *Weekly reason to
   return for a production exec (digest of newly-sealed matches? a "rising on your watchlist"
   rail)? An activation tripwire (no NDA in N days → intervention)?*
5. **Retention hooks beyond deal flow are weak.** Shipped loops are transactional/one-shot; deal
   flow is inherently low-frequency; watcher follow-feed unbuilt. → *Highest-frequency *honest*
   hook per role? Make the value dashboard a weekly *push* ("your Pitchey moved") not a pull?*
6. **Several moat items are shipped-but-shallow.** Gold needs ≥3 honored NDAs (empty for months);
   Silver/Stripe Identity "needs dashboard enable" (may not be live); provenance seals the idea
   not the person; #8's "lock-in" is small while data is thin; #5's conversion is unmeasured. →
   *Which item has the worst UI-promise-vs-data-reality gap at launch — soften or accelerate?
   Lower Gold's bar for the launch cohort, or does that cheapen the signal?*

**Top 3 product risks:** (1) buy-side goes quiet (no retention/activation loop); (2) the
monetizable layer has no foundation (#7 unbuilt → no buy-side revenue); (3) the sequencing gate
can't objectively open (no density metric).

---

## 4. Quality, testing & ops

**Current state.** FE 45.2% lines (services/store high, components 4.7%/features 26% bare);
backend unit ~2.9% (utils ring only). The new **integration tier** (13 files/~79 tests) drives
the real worker vs an ephemeral Neon branch and covers the live path the unit suite can't reach
(auth, pitches, NDA #284, dashboards #40, Stripe #322, deals, slate-share, cross-role, the 3
launch guards). The coverage gate **enforces** per-tier floors with `reportOnFailure:true` (no
more flaky false-fails). 5-layer observability (Sentry/Axiom/Cloudflare/AE) + health/smoke/e2e/
error-sweep workflows. Migration runner with `schema_migrations` + deploy gate.

**Weak parts (for ideation):**

1. **Gates aren't REQUIRED in branch protection.** They fail correctly but don't block — a red
   gate merged this session. *Highest leverage / lowest effort.* → *Codify required checks as IaC
   (`gh api`/Terraform branch-protection in-repo) so the set can't drift; pre-launch assertion
   that required-checks match the gate job names.*
2. **Backend unit ~2.9% — handlers/services tested only at the HTTP boundary.** Integration
   catches "it 500'd," not "it returned the wrong number / granted wrong access." → *Direct
   table-driven unit tests for the 5 highest-blast-radius handlers (Stripe webhook, NDA approve,
   createPitch, credit-spend, RBAC). Or assert response bodies / DB side-effects in the tier.*
3. **FE components 4.7% / features 26%** — the highest-reuse, least-tested code; the floor (42)
   is met without touching them. → *Cover the 10 most-imported components; per-directory floor.*
4. **No browser-level E2E for most critical flows.** `e2e-smoke.yml` is narrow; Stripe checkout,
   full NDA cycle, slate share, deal proposal UI have no browser coverage — the silent-failure
   class only a real browser catches (toast-no-sink). → *One Playwright happy-path each for the 3
   revenue/trust flows; back E2E with the per-PR Neon branch so it doesn't need a separate secret.*
5. **Silent-breakage caught reactively, not proactively.** The catch-swallow gate stops new
   swallows and the tier guards known failures, but neither detects a *new* flow that "succeeds"
   while doing nothing. → *Assert positive success-signals (row written, balance changed,
   notification queued) for every user-facing write so "200 but did nothing" fails CI. A synthetic
   "golden journey" monitor diffing actual side-effects against prod.*
6. **Observability: do we ALERT on the 500-class?** Schema-drift 500s were found by *manually*
   querying the MCP / a daily sweep; only the money path has dedicated alerts. A new dashboard-500
   spike waits up to 24h. → *Error-rate-per-route alert at the documented 1%/5% thresholds; move
   `obs-error-sweep` to hourly (or Sentry-webhook-driven) for the launch window.*
7. **Rollback/incident readiness untested + tag-dependent.** `emergency-rollback.yml` relies on
   git tags `vX.Y.Z` that the ad-hoc `wrangler deploy` flow never creates; Slack alerts commented
   out; the rollback drill has **never been verified** end-to-end; secrets have no backup, R2 no
   versioning. → *Run the supervised rollback drill before launch; auto-tag deploys (or pin
   last-good worker version id) so rollback has a target; wire the Slack alerts.*
8. **Demo/seed-data hygiene.** Test-artifact pollution mostly cleaned this session, but
   demand-first means the *first thing 60 companies see* is seeded supply, and "is there enough
   day-1 supply" is unanswered. → *A pre-launch seed-audit script (flag test-y titles, garbage
   budgets, demo-only NDAs) + a "marketplace looks populated and real" assertion; hard-separate
   demo accounts (smoke tests) from launch-visible seed data.*

**Top 3 quality/ops risks:** (1) gates not REQUIRED (red can still merge); (2) untested,
tag-dependent rollback with no secret/R2 backup before a paying launch; (3) silent-wrong-answer
on money/trust guarded only at "didn't 500" + 500-spike alerting is daily-batch outside payments.

---

## Cross-cutting themes (patterns, not pages)

These recur across ≥2 dimensions — fixing the *pattern* beats fixing instances:

- **Silent breakage is the signature failure mode.** Phantom columns, dead triggers, dead
  routes, no-op toasts, swallowed writes — all "succeed" without erroring. Backend, frontend, and
  ops all surface it. The cheapest systemic defenses: a schema-vs-code linter, success-signal
  assertions in the tier, and per-route 500 alerting.
- **"Two implementations, the dead one wins" (#20).** Orphan backend trees, duplicate analytics
  components, the relabelled-bio thesis, shipped-but-shallow moat items — the gap between what the
  code/UI *claims* and what's *live/real*. Reachability lint + honest data audits.
- **Gates with teeth but no jaw.** The enforcing coverage gate, the integration tier, the 3
  launch guards — all advisory until branch protection makes them required. One toggle.
- **No shared primitives → drift.** Frontend has no design-system primitives (UI drift); backend
  has 3 NDA shapes + 2 id types (schema drift). Both are "everyone hand-rolls → everything
  diverges."

## Suggested ideation order

1. **Free wins to lock before launch:** mark gates REQUIRED (IaC); run the rollback drill +
   auto-tag deploys; seed-data audit; drop the fake E2E toggle + unrouted orphan imports.
2. **The launch bet:** design the buy-side activation/retention loop (the 60 must *stay active*)
   and an NDA-graph-density metric to watch — these are existential for a demand-first launch.
3. **The revenue foundation:** #7 structured thesis schema (unblocks matching + a buy-side paid
   tier) — the highest-value *product* build, and the first cold-start gate to clear.
4. **The quality compounders:** success-signal assertions in the integration tier; the
   schema-vs-code linter; the FE design-system primitives (then retrofit the C/D pages).
5. **Audit the unseen:** screenshot-audit Investor/Production/Watcher portals; map the orphan
   clusters for tier-retirement.
