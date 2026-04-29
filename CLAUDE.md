# Claude Instructions — Pitchey

Movie pitch platform connecting creators, investors, and production companies. Edge-first serverless architecture on Cloudflare.

See `docs/roadmap-post-launch-2026-04-20.md` for the post-launch execution plan.

## Architecture
- **Frontend**: Cloudflare Pages — React 18 + Vite + Zustand + TailwindCSS
- **Backend**: Cloudflare Worker (`src/worker-integrated.ts`) — single entry point for all API routing
- **Database**: Neon PostgreSQL — raw SQL, no ORM
- **Auth**: Mixed model. Primary session handling is custom — legacy `users`/`sessions` tables, `pitchey-session` UUID cookie, custom login/logout/refresh handlers inlined in `src/worker-integrated.ts`. **Better Auth is also genuinely live**: `src/auth/better-auth-config.ts:51` calls `betterAuth({...})` and the resulting instance is reached from (a) `src/routes/user-profile.ts` via `auth-adapter.ts` for `/api/users/profile` + `/api/users/settings`, and (b) `src/services/worker-realtime.service.ts` via `better-auth-session-handler.ts` for WebSocket auth. What IS disabled is the separate `createAuthAdapter` import at `worker-integrated.ts:20` (commented since `41850ea1`, 2025-12-18) — a *different* adapter from a *different* file than the live BA wiring. Earlier doc revisions conflated the two and framed BA as "vestigial"; it isn't. Decision on rip-out vs migrate for the live BA paths still tracked in issue #19.
- **Cache**: Upstash Redis (global)
- **Storage**: Cloudflare R2
- **Parked features — DO NOT modify, import from, "helpfully wire up", or delete.** The decision to keep these is explicit and tracked in issues, not in code:
  - `src/workflows/` — self-contained, never-deployed Cloudflare Workflows worker (3 Workflow classes for investment/production/NDA orchestration). Own `wrangler.toml`/`package.json`/`tsconfig.json`. Multiple decisions block revival (no main-worker bindings, placeholder CF account/Hyperdrive/KV IDs, DocuSign absent, contradicts the no-NDA-expiry decision from `0a92edb0`). Tracked in issue #60.
  - `src/workers/crawl4ai-worker.ts` (480 LOC) + `src/services/console-analysis-crawler.ts` (741 LOC) — parked market-intelligence worker (industry news, pitch validation, market trends, box office, competitor analysis). Splits into a Python worker that doesn't exist; companion service file imports from a non-existent path. The features are valuable but the architecture isn't — revival should rebuild on top of the existing Claude Haiku 4.5 integration + paid APIs, not the current scraper design. Tracked in issue #61.
  
  If you find yourself editing files under any of these paths, stop and check the linked issue. The owner has chosen to keep the code as a reference point for future revival, not because it's pending integration.

## Quick Reference

| Task | Command |
|------|---------|
| Backend dev | `wrangler dev` |
| Frontend dev | `cd frontend && npm run dev` |
| Deploy frontend | `cd frontend && wrangler pages deploy dist/ --project-name=pitchey` |
| Deploy backend | `wrangler deploy` |
| Run tests | `cd frontend && npx vitest run` |
| Type check | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` |

## Demo Accounts (Password: Demo123)
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com
- Watcher: jamie.watcher@demo.com

## Code Conventions
- TypeScript for all new code
- Raw SQL only (no ORM)
- Sessions live in the legacy `sessions` table; cookie is `pitchey-session` (UUID). No JWT. Better Auth imports are **not vestigial** — see root "Auth" section; BA is live on `/api/users/profile`, `/api/users/settings`, and WebSocket auth.
- `credentials: 'include'` on all API calls
- Defensive utils (`safeAccess`, `safeNumber`, `safeArray`) for runtime safety
- In `catch` blocks: `const e = err instanceof Error ? err : new Error(String(err))`
- **Before adding a route or handler, grep for existing implementations.** Pitchey has accumulated multiple parallel handler trees across migrations (Era 0–6); the live one is wired through `src/worker-integrated.ts` — anything else is an orphan no matter how complete it looks. If two implementations of the same endpoint exist, the live one wins. Don't extend the orphan, don't migrate to it, don't "consolidate" without an explicit revive decision. Recent example: like-button bug (Apr 2026) — frontend was wired to call `/api/pitches/:id/like` while only `/api/pitches/:id/save` was registered; handlers existed in `pitch-interactions.ts` but were never imported. Cost weeks of broken UX. Pre-flight check before route/handler work: `grep -rn "register.*<endpoint>" src/worker-integrated.ts` and `grep -rn "<HandlerName>" src/worker-integrated.ts` — if zero hits, the handler is orphaned even if the file looks live.

## Subagent Routing

| User Request | Subagent |
|---|---|
| Deploy backend or frontend | `cloudflare-deployer` |
| Debug frontend / React / component / build | `frontend-debugger` |
| Debug API / Worker / 4xx / 5xx / CORS | `worker-debugger` |
| Debug database / query / connection | `db-debugger` (READ-ONLY) |
| Migrate / schema change | `database-migrator` |
| Review code / PR | `code-reviewer` |
| Write tests / expand coverage | `test-writer` |

Available slash commands: `/deploy`, `/test`, `/migrate`

## Domain Context Docs
- **[Frontend](docs/context-frontend.md)** — React, Zustand, routing, testing patterns, dashboard architecture
- **[Backend](docs/context-backend.md)** — Worker API, auth endpoints, database, caching, RBAC
- **[Deployment](docs/context-deployment.md)** — CI/CD, environment setup, service URLs, deploy commands
- **[Platform Evolution](docs/PLATFORM_EVOLUTION.md)** — historical record (Era 0 → Era 6): why we migrated, what broke, what was learned

## Platform Status

### Completed (Stages 1-11)
- **Foundation**: 619+ API routes, 3 portals + Admin + Watcher, RBAC, CI/CD
- **Core Platform**: Dashboards, WebSocket + polling, search/browse, marketplace
- **Communication**: Messaging (edit/delete/attachments), credit system (9 actions), email via Resend
- **Security**: Email OTP 2FA, passwordless login, JWT verification, rate limiting (4 strategies), file validation
- **Collaboration**: Scoped collaborator access to pipeline projects (not a fourth portal)
- **AI**: Auto-fill production assessments from uploaded documents (Claude Haiku 4.5, 5 credits)
- **Data Quality**: Follow system (user + pitch), NDA messaging gate, snake_case normalization
- **Notifications**: Email (new follower, pitch publish), WebSocket push, 401 auto-redirect
- **Production Portal**: 26-issue remediation complete (uploads, dead buttons, stubs, settings, calendar)
- **Tests**: 193 files, 3606 tests, 0 failures. 19 pre-existing assertion failures cleared 2026-04-22 across 9 files (dashboard title drift after "Welcome back, <name>" refactor, `PermissionGuard` viewer → `/watcher/dashboard`, `PortalSelect` / `PitchDetail` navigate 2-arg signature, `CreatePitch` NDA section relocated into `DocumentUploadHub`). The 5 `PitchForm` NDA tests were *moved* rather than fixed: NDA coverage now lives in `src/features/ndas/components/__tests__/NDAUploadSection.test.tsx` (7 tests, tighter unit boundary) because the PitchForm-level tests reached three layers deep (CreatePitch → DocumentUploadHub → NDAUploadSection) and didn't paint reliably in isolation. Deleted tests cite the replacement file and test names.
- **Watcher Portal**: Browse-only portal (like/save/drafts/credits, no NDAs)
- **Company Verification**: Region-adaptive (USA EIN, UK Companies House, insurance fallback), auto-checks, admin review panel
- **Portfolio Sharing**: Token-based share links with labels, view tracking, revocation (`/portfolio/s/:token`)
- **Production Tier Repricing**: Aligned to creator price ladder (€19.99/€29.99/€39.99)
- **Project Close + NDA Retention**: Close collaborations without revoking NDAs (`closed_at`, `closed_by` on collaborations)
- **Collaboration Timeline**: 7-milestone progress timeline derived from existing tables (NDA, views, messages, collaboration status)
- **Slate System**: Curated pitch collections — CRUD + add/remove/reorder pitches, public view, drag-and-drop editor. 10 API routes, 2 creator pages, nav wired.
- **Heat Score Algorithm**: Bayesian + role-weighted scoring — PG function `recalculate_heat_scores()`, `heat_role_weights` config table, 3 API routes (`/pitches/hot`, `/pitches/:id/heat`, admin recalc). Marketplace "Hottest" sort + heat badges (Hot/Trending). Trending endpoint now sorts by heat_score.
- **Structured Feedback**: 5 API routes (submit/update/delete/public/mine), structured form with star rating + strengths/weaknesses/suggestions lists + anonymous option. Integrated into PitchDetail (all viewers) and CreatorPitchView feedback tab. Uses existing `pitch_feedback` table. Watchers excluded, self-review blocked.
- **Heat Visualisation**: Shared `HeatBadge` component (pill/inline variants) on PitchDetail, BrowseTopRated, MarketplaceEnhanced. Refactored marketplace to use shared component.
- **Consumption Gating**: 30s minimum view time before feedback submission. Backend check in `submitPitchFeedback()`, `GET /api/pitches/:id/consumption-status` endpoint. Frontend progress bar in FeedbackSection.
- **Trust Badges**: Gold/Silver/Grey verification tiers based on auto_checks results. Migration 074 adds `verification_tier` to users, auto-updates on verify/approve/reject. `VerificationBadge` component on PitchDetail + MarketplaceEnhanced. All pitch queries include `creator_verification_tier`.
- **Watcher Audience-Only Rework** (2026-04-15, commit `9aff8b0`): Reverted paid upgrade flow (`e45a346`). Watchers are pure audience — browse, like, save, comment; no in-app upgrade. Backend: `handleSubscribe` 403s viewers, Stripe webhook no longer mutates `user_type`, `VIEWER` role revoked `PITCH_CREATE/EDIT_OWN/DELETE_OWN`. Gating: synopsis truncated to 300 chars with `synopsisTruncated` flag for watchers + anonymous; `/api/pitches/:id/engagement` returns `likerBreakdown` (role counts) to all viewers but restricts named likers/viewers to owner + NDA-signed. `SocialProofBadge` extended with breakdown-only render variant.
- **NDA Detection on PitchDetail** (2026-04-15, commit `9aff8b0`): Fixed silent failure where NDA-signed users saw "Request NDA Access". `getPitch` now returns `hasSignedNDA`/`hasNDA` directly from a permissive query across historical schemas (`ndas.signer_id` → `ndas.requester_id` → `pitch_access.user_id`), replacing the frontend's inference-from-protected-fields heuristic. Each query branch wrapped in `try/catch` so column/table drift in older envs can't 500 the pitch view.
- **Post-Login Redirect** (2026-04-17, commit `0c65290`): `frontend/src/utils/postLoginRedirect.ts` carries intended destination through the login flow via `location.state.from` (primary) and a `pitchey:pendingReturnTo` localStorage key (fallback for MFA/OTP flows that lose router state). Open-redirect guard blocks `//`, `/\`, and auth-route loopbacks. Wired into all 4 portal logins, generic `/login`, `/register`, `/login/email`, `/mfa/challenge`. `PublicPitchView` and `PortalSelect` forward the current path on click-to-login.
- **Observability Hardening** (2026-04-17, PR #3): Closed three interlocking gaps in one pass. **Migration runner** (`scripts/migrate.mjs`) with `schema_migrations` tracking + shared CI gate (`.github/actions/deploy-preflight/`); prod baselined at 87 files. **`safeQuery` helper** (`src/db/safe-query.ts`) — discriminated union splitting "query returned empty" from "query exploded"; fixes the category of bug that hid the consumption-gate failure for weeks. **Sentry Replay masking** — `maskAllText: true`, `blockAllMedia: true`, `networkCaptureBodies: false`; closed the PII/NDA liability from 90-day replay retention. **Sentry tunnel fix** (`frontend/functions/api/monitoring/envelope.ts`) — switched to `arrayBuffer()`; discovered during masking validation that zero replays had reached Sentry since the tunnel deployed. **AE pruned** 7 → 2 datasets (kept `ANALYTICS`, `PITCHEY_ANALYTICS`; the other five had no readers). **`AXIOM_TOKEN`** is now a hard requirement in production — deploy fails if missing, worker returns 503 on first request if absent. **CI alerts have teeth** — `simple-health-check.yml` routes failures to Slack + opens a deduplicated GitHub issue. Full audit in `docs/observability-audit-2026-04-17.md`; catch-swallow migration plan in `docs/catch-swallow-audit-2026-04-17.md`.
- **CI Permissions Sweep** (2026-04-18, PR #14): workflow-level `permissions` blocks added to 4 workflows (`security-scan`, `quality-gates`, `neon-preview`, `simple-health-check`); created missing `health-check-failure` + `incident` labels. Closed silent 403s on PR comments, issue creation, Pages deploy recording, and health-check alerting.
- **Drizzle Subgraph Retirement** (2026-04-18, PR #14, commit `4d61b37`): -9.4k LOC / 13 files of Era 2 drizzle code deleted (3 schemas, 5 notification/transaction services, 3 background workers, `connection-manager`, `better-auth-neon-config`). Zero first-party `drizzle-orm` imports remain; "Raw SQL only" rule fully honored in the live path.
- **URL Consolidation — corrected model** (2026-04-18 → 2026-04-21): PRs #14 + #21 swept hostname references from `pitchey-5o8.pages.dev` to `pitchey.pages.dev` under an incorrect "same project, two subdomains" mental model. In reality, these were **two separate Pages projects on two separate CF accounts**, both literally named `pitchey` — CF suffixes `-5o8` when the global `<name>.pages.dev` slot is already claimed. Cavelltheleaddev's `pitchey` project (stale December 2025 canonical) was **deleted 2026-04-21**: 402 deployments purged + project DELETE'd via CF API. `pitchey.pages.dev` now NXDOMAINs. Ndlovucavelle's `pitchey` project, served at `pitchey-5o8.pages.dev` (account ID `002bd5c0e90ae753a387c60546cf6869`), is the actual live frontend. `pitchey.com` is a `pitchey-coming-soon` marketing stub on a separate Pages project — not the real frontend. `FRONTEND_URL` in `wrangler.toml:159` still stale (points at the dead subdomain); needs a Worker redeploy with the correct value. See `docs/sessions/2026-04-21-URGENT-status.md` for the full timeline.
- **Zod v4 Migration** (2026-04-18, PR #16 — draft, pending auth smoke test): root→`zod@^4.3.4` aligning with frontend; `better-auth-cloudflare@^0.3.0` closes GHSA-gpj5-g38j-94v9 (drizzle-orm SQLi) transitively. Mechanical fixes: 19× `z.record(X) → z.record(z.string(), X)`, 2× `.error.errors → .error.issues`, 4× `z.nativeEnum → z.enum`. Transitive `better-auth` 1.4.9 → 1.6.5 requires 4-portal login + MFA smoke test before merge.

### TODO
- **Stripe Go-Live**: Create products/prices in Stripe Dashboard, set secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), set `stripePriceId` in `src/config/subscription-plans.ts`
- **Malware Scanning**: VirusTotal integration deferred — needs `VIRUSTOTAL_API_KEY` (free tier: 4 req/min)
- **Full Crew Features**: Availability calendars, rate cards — deferred post-launch

### Current Numbers (2026-04-22)
- 664 API routes, 161 pages, 182 components, 30 frontend services, 4 stores
- 112 backend services, 71 handlers, 89 migrations (tracked in `schema_migrations`, runner at `scripts/migrate.mjs`)
- 4 portals (Creator, Investor, Production, Watcher — audience-only) + Admin shell
- 13 CI/CD workflows, 7 R2 buckets, 5 KV namespaces, 2 Durable Objects, 2 Analytics Engine datasets

### Session 2026-04-22 — shipped
- **Marketplace nav refresh** (`ba8aff3`) — pill-tab sort replacing `<select>`, genre quick-chips, mobile hamburger + slide-down menu; color-coded active states (`brand.featured` Hot, `brand.trending` Trending, `brand.new` New); homepage parity (adds "How It Works").
- **CI hygiene — deploy-staging retired** (`36a0bda`, closes #36) — removed a dormant `deploy-staging` job that would have run `wrangler deploy` against production if triggered (no `--env` flag + referenced the deleted `pitchey` Pages project). Trimmed `staging, develop` from `push.branches`.
- **Dashboard SQL drift fix** (`a99ac28` + `5ef44e8`, closes #40) — four prod error fingerprints cleared in one sweep: Neon `sql(str, params)` → `sql.query(...)` migration across 27 sites in 7 query modules (with `SqlQuery` type corrected so the old call-form can no longer type-check), `getRevenueMetrics` JOIN alias qualification, `u.avatar` → `u.avatar_url`, migration 081 backfilling `subscription_history.new_tier` and friends. Post-deploy observability confirms all six fingerprints at zero events.
- **Test drift cleanup** (`4d89f89`) — 19 → 0 pre-existing failures. 14 fixes were stale assertions vs. current components (dashboard "Welcome back" refactor, `/watcher/dashboard` viewer redirect, `navigate()` 2-arg shape, NDA-gated creator name, DocumentUploadHub relocation). 5 `PitchForm` NDA tests *moved* to `src/features/ndas/components/__tests__/NDAUploadSection.test.tsx` (7 tests) — tighter unit boundary, each deletion cites the replacement test name.
- **ZAP dedup** (`3be1c10`, closes #37 + #41) — `.zap/rules.tsv` IGNOREs the five rule IDs that opened an issue per push (cloud-metadata probes, UUID-matched-as-Base64, Sec-Fetch-* request-headers-on-server confusion, marketing-route cacheability). Workflow now `allow_issue_writing: false` + `fail_action: true` — routine runs file no issue; genuine new Med/High tripping the fail threshold route through the existing CI-failure alert path.
- **Deno-era dead code sweep closeout** (`ef839f1`, closes #38) — three orphan files deleted (`environment-config.ts`, `router/router.ts`, `database-cache.service.ts`, -817 LOC). Acceptance gate `grep -rn "\bDeno\." src/ | wc -l` → 0.
- **URL consolidation — CI side** (`bf11007`) — 23 refs across 13 `.github/` files swept from the NXDOMAINing `pitchey.pages.dev` to the canonical `pitchey-5o8.pages.dev`. Fixes Lighthouse CI's `CHROME_INTERSTITIAL_ERROR`, plus the scheduled health-check and SSL-cert-expiry probes that had been silently failing.
- **CORS allowed-origins flip** (`697de63` + `21bd7bd`) — `src/utils/response.ts` had the URL-consolidation model backwards; `pitchey.pages.dev` labeled "Primary production" and `pitchey-5o8` labeled "Legacy alias." Flipped to reality. Preview regex switched from `*.pitchey.pages.dev` (matches nothing) to `*.pitchey-5o8.pages.dev`.
- **Email link rot** (`9b78932` + `bdd6b3d`) — swept stale `pitchey.pages.dev` from email templates + fallbacks; fixed `pitch-interactions.ts` which was shipping `pitchey.com/pitches/${id}` (wrong host + wrong path) in follower-notification emails; deleted 1130-line dead `src/services/nda.service.ts`. Side-effect finding: `notification_templates` table missing in prod despite baseline marking migration applied — filed as **#43** (architecture question on `EmailTemplateService` rip-vs-repair, not fixed in this session).
- **Live-worker URL fallbacks** (`12a1d2f`) — 8 remaining `pitchey.pages.dev` fallbacks in `worker-integrated.ts`, `worker-modules/*`, `middleware/optimized-cache.ts`, and `middleware/csrf-protection.ts` (which also had a duplicate entry in `ALLOWED_ORIGINS`). Live-worker region now zero stale refs.

### Session 2026-04-23 — shipped
- **Better Auth dead-file rip** (`a28551d`, issue #19 remains open for the live paths) — deleted 5 orphan files in `src/auth/` (2083 LOC): `better-auth-cloudflare-config.ts`, `better-auth-cloudflare.ts`, `better-auth-worker-handler.ts`, `better-auth-worker-integration.ts`, `raw-sql-auth.ts`. 5 live BA files remain (`auth-adapter.ts`, `better-auth-config.ts`, `better-auth-neon-raw-sql.ts`, `better-auth-session-handler.ts`, `cors-config.ts`) — genuinely in the live request path for `/api/users/profile`, `/api/users/settings`, and WebSocket auth. The full rip-vs-migrate decision for those live paths is unresolved and needs proper scoping — not a session-end call.

### #20 near-misses from 2026-04-22/23

Two instances this session where stale CLAUDE.md framing nearly caused wrong action:
- **"Tests: 3639+, zero failures"** → actually 19 failures across 9 files. Almost laundered 5 PitchForm NDA tests into `.skip` with an aspirational "covered elsewhere" comment; caught by verifying coverage doesn't exist, then writing the targeted NDAUploadSection.test.tsx as real replacement before deleting the PitchForm NDA block.
- **"Better Auth is vestigial, `createAuthAdapter` commented out"** → true for `auth-adapter.ts` but a *different* adapter `createBetterAuthInstance` from `better-auth-neon-raw-sql.ts` is imported AND called in `worker-integrated.ts:766`, and `auth-adapter.ts` itself is live via `routes/user-profile.ts`. Almost ripped live auth code; caught by re-tracing imports through `rg` one more pass before `rm`.

Takeaway: run the drift-audit check *before* any cleanup/rip, not during. Cheap to verify, expensive to undo.

## Observability & Analysis Stack

5 layers — browser, edge, errors, logs, metrics. No redundancy; each sees different signals.

```
Browser (chrome-devtools MCP)     — DOM, console, network, render perf, Lighthouse
Edge (Cloudflare Observability)   — Worker CPU, request duration, 100% log sampling
Errors (Sentry @sentry/cloudflare) — Exceptions, breadcrumbs, releases, 10% trace sampling
Logs (Axiom)                      — Structured request logs, slow queries, auth events
Metrics (Analytics Engine + PG)   — 2 datasets, request_logs/error_logs tables, health checks
```

### CLI Browser Analysis (chrome-devtools MCP)

Launch Chrome: `google-chrome-stable --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug`

**Production Frontend**: `https://pitchey-5o8.pages.dev` (ndlovucavelle) | **Marketing stub**: `https://pitchey.com` (coming-soon Pages project, separate)

| Tool | Purpose |
|------|---------|
| `navigate_page` / `take_snapshot` / `take_screenshot` | Navigate, inspect a11y tree, visual capture |
| `fill_form` + `click` + `wait_for` | Login with demo accounts, drive UI |
| `list_console_messages` / `list_network_requests` | Console errors, API call status codes |
| `get_network_request` | Response body, headers, timing for specific request |
| `lighthouse_audit` / `performance_start_trace` | Performance audits and traces |
| `evaluate_script` / `take_memory_snapshot` | Run JS in page, heap snapshots |

### Server-Side

- **Cloudflare**: `[observability]` enabled in `wrangler.toml`, 100% sampling. Live tail: `wrangler tail`
- **Sentry**: `@sentry/cloudflare` with `withSentry()`, DSN in wrangler.toml. MCP server removed — use dashboard directly
- **Axiom**: Dataset `pitchey-logs`, token via `wrangler secret put AXIOM_TOKEN`
- **Analytics Engine**: 2 bindings — `pitchey_metrics`, `pitchey_database_metrics` (pruned from 7 on 2026-04-17; see `docs/observability-audit-2026-04-17.md`)
- **Health**: `GET /api/health` (see `handleHealth` in `worker-integrated.ts`) checks DB, Upstash Redis, Stripe, Resend; reports `ok` or `degraded`. No Better Auth probe in the live handler — earlier documentation claimed one existed and described behavior the code didn't implement (another drift instance, see the 2026-04-23 BA near-miss below).
- **Logging**: `src/lib/production-logger.ts` — structured JSON, auto-redaction, requestId/traceId propagation
- **Auth**: `src/lib/auth-observability.ts` — login/signup/session events, brute force detection (5+ failures/15min)
- **Tracing**: W3C Trace Context, 10% sampling, 30-day retention in R2 + Analytics Engine

### Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | 2000ms | — |
| Error rate | 1% | 5% |
| Worker CPU | 45ms | 50ms (CF limit) |
| Cache hit rate | <60% | — |
| Login failures | 5/15min | 10+ same IP |

### Docs
- `docs/OBSERVABILITY.md` | `docs/LOGGING.md` | `docs/SENTRY_ERROR_TRACKING.md` | `docs/monitoring-guide.md`

## Schema Drift Detection & Resolution

Cloudflare Workers Observability (100% log sampling) surfaces SQL errors as they happen. Use the Cloudflare MCP to query telemetry without leaving the CLI.

### Detection (Cloudflare MCP)
```js
// Find SQL errors in last 24h
telemetry/query → view: "events", filters: [
  { key: "$metadata.service", operation: "eq", value: "pitchey-api-prod" },
  { key: "$metadata.level", operation: "eq", value: "error" }
]
```
Common patterns: `relation "X" does not exist` (missing table), `column X.Y does not exist` (missing column)

### Resolution Workflow
1. **Detect** — Query Cloudflare MCP for `$metadata.level = error` events
2. **Trace** — Match error to handler in `src/worker-integrated.ts` (grep for table/column name)
3. **Cross-reference** — Check `src/db/migrations/` for the intended schema
4. **Migrate** — Write numbered migration (`NNN_desc.sql`) with `IF NOT EXISTS` patterns
5. **Test** — Run on Neon branch first (`mcp__neon__create_branch` → `mcp__neon__run_sql`)
6. **Apply** — Run on production (`mcp__neon__run_sql` on main branch)
7. **Deploy** — `wrangler deploy` if Worker code also changed
8. **Verify** — Re-query Cloudflare MCP for errors, expect zero

### Live Tail (alternative)
`wrangler tail --format=json | grep "does not exist"`

### Migration Tracking (2026-04-17: runner live)

Runner: `scripts/migrate.mjs` (Node, uses `postgres` package). Tracks applied state in `schema_migrations` (filename-keyed, SHA-256). Commands: `npm run db:migrate[:status|:check|:baseline]`. CI gate in `deploy-production.yml` fails the deploy if any `.sql` under `src/db/migrations/` is not recorded.

**Baseline completed 2026-04-17**: 87 existing files recorded as applied (no execution — prod was hand-migrated). Going forward, every new migration file must be applied before the deploy will pass the gate.

**Known historical drift** (resolved or bounded — kept for context):
- **Migration gaps 048–067** — numbered slots skipped entirely. Unfixable without re-numbering; baseline locks current state.
- **Duplicate migration numbers** — three `001_*.sql`, two each of `003_*`, `011_*`, `012_*`, `013_*`, `020_*`, `026_*`; four `0001_*` variants. The runner uses filename (not number) as the unique key, so this no longer breaks anything.
- **`999_consolidated_schema.sql`** claims source-of-truth but omits rating tables — **patched by `078_pitchey_score_patch.sql`** (applied to prod 2026-04-17).
- **`pitch_views.viewer_id` is canonical** — any code referencing `pitch_views.user_id` is a bug (migrations 073/075 heat functions already use `pv.viewer_id`). Session `78e` realigned 9 files.
- **NDA signer drift** — `ndas.signer_id` vs `ndas.requester_id` vs `pitch_access.user_id` coexist across history; `getPitch` in `worker-integrated.ts` catches each branch defensively.
- **`view_duration` now populated** — `analytics-endpoints.ts:handleTrackView` writes the frontend heartbeat `duration` via `GREATEST(COALESCE(view_duration, 0), $1::int)`. Consumption gate can now open organically.

**Error cluster — 2026-04-22 Cloudflare Observability sweep, resolved same day** (commits `a99ac28` + `5ef44e8`, closed #40):
- **Neon client API misuse** — handler calls `sql("SELECT $1", [value])` (function-call form); the `postgres` client only accepts tagged templates (``sql`SELECT ${value}` ``) or explicit `sql.query(...)`. Fired on `GET /api/creator/dashboard` from 3 subqueries (notifications, investments, NDA). **Fix**: 27-site migration to `sql.query(...)` across 7 query modules; `SqlQuery` type in `base.ts` rewritten so the old call-form no longer type-checks.
- **`column reference "status" is ambiguous`** — `GET /api/creator/dashboard` revenue metrics; missing table alias in a JOIN. **Fix**: qualified 5 references as `i.status` / `i.amount` / `i.investor_id` in `getRevenueMetrics`.
- **`column "new_tier" does not exist`** — `GET /api/payments/subscription-status`; schema drift because `047_fix_schema_drift.sql` uses `CREATE TABLE IF NOT EXISTS` and was a silent no-op against a pre-existing partial table. **Fix**: migration `081_subscription_history_column_backfill.sql` with `ADD COLUMN IF NOT EXISTS` for every expected column.
- **`column u.avatar does not exist`** — `GET /api/user/notifications`; lone typo. **Fix**: `u.avatar` → `u.avatar_url`.

Post-deploy observability verified zero events across all six fingerprints in the 7-minute post-deploy window, including manually-exercised dashboard traffic. Schema-drift entries (`new_tier`, `u.avatar`) were fresh instances of the pattern tracked in **#20**; the silent-`CREATE TABLE IF NOT EXISTS` mechanism is a specific variant worth watching for in future migration audits.

### Anti-Pattern: Silent `.catch(() => default)` on DB Queries — helper now available

The consumption-gate drift stayed invisible for weeks because handlers use `sql\`…\`.catch(() => [{ total_duration: 0 }])` — any schema error returns a zero-ish default silently. **Helper: `src/db/safe-query.ts`** — `safeQuery()` returns a discriminated union `{ ok, rows, errored, error }` and reports to Sentry by default. Exemplar patched: `creatorRevenueHandler` in `handlers/creator-dashboard.ts`. Full tier-ordered migration plan in `docs/catch-swallow-audit-2026-04-17.md` (196 sites across 26 files).

### Observability Stack — Pruned 2026-04-17

AE bindings went from 7 to 2 (`ANALYTICS`, `PITCHEY_ANALYTICS`). Removed: `CONTAINER_ANALYTICS`, `JOB_ANALYTICS` (zero writers), `PITCHEY_PERFORMANCE`, `PITCHEY_ERRORS`, `TRACE_ANALYTICS` (write-only — no readers). Sentry covers errors; Axiom covers logs. See `docs/observability-audit-2026-04-17.md`.

Sentry Replay: `maskAllText: true`, `blockAllMedia: true`, `networkCaptureBodies: false`. `frontend/functions/api/monitoring/envelope.ts` tunnel now uses `request.arrayBuffer()` — before the fix, replay envelopes were 400'd upstream because `request.text()` corrupted binary payloads (no replay had reached Sentry since the tunnel was deployed).

`AXIOM_TOKEN` is a hard requirement in production — deploy workflow fails if the secret is missing; worker returns 503 on first request if `env.ENVIRONMENT=production` and the token is absent.
