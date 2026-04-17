# Pitchey — Platform Evolution

Historical record of Pitchey's architectural journey from the Deno/Fresh prototype to the current Cloudflare Workers + Pages stack. This doc exists so future sessions (human or agent) can answer questions like *"why did we migrate off Drizzle?"* or *"when did the portal security hole get closed?"* without trawling git history.

**For current state, always consult:**
- Root `CLAUDE.md` — live architecture, feature inventory, schema drift registry
- `frontend/CLAUDE.md` — connectivity, auth, Pages Functions proxy notes
- `docs/context-frontend.md` / `context-backend.md` / `context-deployment.md` — domain details

**This doc is historical. If it contradicts `CLAUDE.md`, `CLAUDE.md` wins.**

---

## Era 0 — Deno / Fresh Prototype (≈ mid 2024)

The original Pitchey stack:

- Deno runtime, Fresh framework
- Netlify deployment
- Drizzle ORM against Neon PostgreSQL
- Custom JWT auth (bespoke signing/verification)
- WebSocket auth and JWT/session management were a recurring pain
- React frontend bundled with Vite — suffered from `useSyncExternalStore` errors and chunk-split issues

Two parallel efforts orbited the core product at this stage: a TikTok trends scraping pipeline (Playwright + Creative Center + TikTok Studio scrapers → MySQL → Flask API → iOS app) and an enterprise e-commerce analytics SaaS concept using the same Deno/Fresh pattern. Neither ended up in the Pitchey codebase.

---

## Era 1 — Foundational Breakage (late 2024)

Comprehensive platform testing at this point surfaced three platform-breaking classes of issue:

**Missing tables.** Code referenced `follows`, `portfolio`, `notifications`, `analytics_events`, `nda_requests`, but none existed in the actual schema. Social features, investment tracking, notifications, and NDA workflow were all completely non-functional. Symptom was endless `NeonDbError: relation "X" does not exist` in logs.

**DATABASE_URL not reaching services.** Pitch creation and all write operations failed with *"DATABASE_URL not configured"*. Root cause was services not receiving the connection string in Deno Deploy's execution context — a configuration propagation bug, not a credentials bug.

**Redis service initialisation failures.** Errors like `TypeError: this.redis.keys is not a function` and `ReferenceError: nativeRedisService is not defined` broke caching, draft auto-sync, and WebSocket fan-out. Service imports were inconsistent across `dashboard-cache.service.ts`, `draft-sync.service.ts`, `notification.service.ts`.

At this point the platform was ~75% implemented but only a small fraction actually worked end-to-end. All three issues were resolved during the migration that followed. All the "missing" tables have since shipped and are live. Follows, portfolio, notifications, and analytics are core features today.

**Lesson preserved:** the platform felt more broken than it was because infrastructure and config problems masqueraded as missing features. Distinguishing "doesn't exist" from "exists but can't reach its deps" was the first big diagnostic win.

---

## Era 2 — The Big Migration (late 2024 → early 2025)

Several migrations happened in overlapping waves:

**Drizzle ORM → raw SQL via `@neondatabase/serverless`.** Motivation: bundle size and edge performance. Drizzle was also throwing intermittent `Cannot convert undefined or null to object` from `orderSelectedFields` on some queries, which was hard to diagnose at the ORM boundary. Raw SQL gave us full control and visibility.

**Deno Deploy → Cloudflare Workers.** An intermediate worker name `pitchey-optimized.ndlovucavelle.workers.dev` appears in docs from this era. The production worker is now `pitchey-api-prod.ndlovucavelle.workers.dev`. Any reference to the optimised URL is a stale artefact from this transition. (Verified 2026-04-17: zero code references remain.)

**Netlify → Cloudflare Pages.** Frontend moved to Pages with `wrangler pages deploy`.

**Custom JWT → Better Auth.** Hybrid validation existed briefly during cutover — try Better Auth session first, fall back to JWT. The fallback path is gone in current code; sessions are cookie-only now.

**Neon `$1` parameter substitution bug.** Early code tried to use traditional parameterised queries with the Neon serverless driver and hit `syntax error at or near "$1"` in the hundreds per hour. A manual substitution layer was introduced as a workaround. This is no longer present — current code uses tagged-template syntax (`` sql`...` ``) which the serverless driver handles natively.

**React 18 AsyncMode deprecation.** `Warning: React.AsyncMode is deprecated` on every page load. Patched with a Vite plugin (`frontend/vite-react-fix.js`, exporting `reactAsyncModeFix()`) that wraps React property assignments in try/catch. The plugin still exists in the repo but is only referenced by `vite.config.complex.ts` — the active `vite.config.ts` does not use it, so current builds don't need the shim.

**Portal access control breach.** Systematic vulnerability — any authenticated user could hit any portal's API. A creator could `GET /api/investor/dashboard` with their own token and receive investor data. Fixed by `PortalAccessController.validatePortalAccess()` middleware (now at `src/middleware/portal-access-control.ts`) that inspects `userType` against per-portal allowlists and logs security violations. This predates the current role-based RBAC system but was the first meaningful access control layer.

**CORS violations.** Frontend at `pitchey-5o8.pages.dev` calling the worker directly hit `Access-Control-Allow-Origin` failures. Solved first with a comprehensive CORS header helper, later obsoleted entirely by the Pages Functions proxy (Era 3).

**Lesson preserved:** a custom JWT implementation buys you nothing and costs you real time when you also need 2FA, password reset, session revocation, and brute-force protection. Better Auth with plugins replaced hundreds of lines of bespoke auth code including the MFA implementation. The `twoFactor()` plugin replaced a hand-rolled version entirely.

---

## Era 3 — Architectural Stabilisation (early → mid 2025)

**Pages Functions proxy (same-origin architecture).** The single most consequential post-migration change. `functions/api/[[path]].ts` proxies API calls from the frontend origin to the worker. This:

- Eliminated cross-origin cookie issues (no more `SameSite=None` juggling for API calls)
- Stripped CORS headers entirely (unnecessary when same-origin)
- Let the proxy rewrite cookies: remove `Domain`, downgrade `SameSite=None` to `Lax`

Critical side-effect: **WebSocket is still cross-origin** because Pages Functions don't proxy WS. So the initial login cookie has to be set with `SameSite=None` before the proxy rewrites it to `Lax` for subsequent API calls. If auth ever breaks for WebSocket specifically, this is the place to look.

A related gotcha: `wrangler pages deploy dist/` **must run from `frontend/`** — running from repo root silently skips the Functions bundle compile with no error. And `_redirects` is ignored when Functions exist; SPA fallback is handled by `functions/[[catchall]].ts`.

**API response format migration (Nov 2025).** Frontend expected `{ success, data: { pitches: [...] } }` but the backend was returning `{ success, items: [...], message }`. The symptom was "marketplace is empty" — users couldn't see any pitches and individual pitch pages worked fine because that endpoint had a different (correct) response shape. A long debugging report misattributed this to a broader frontend-backend connectivity issue before the root cause (one unwrapping line in `pitchAPI.getPublic()`) was identified. Also during this period, a user reported "pitch pages don't work" — they were testing `/pitch/162` which didn't exist; the four actual pitches (IDs 1–4) all rendered correctly. The debugging report for that one consumed hours before someone checked whether the ID existed.

**Vite chunk-splitting white screen.** `Cannot read properties of undefined (reading 'useLayoutEffect')` — React hooks undefined because vendor chunks loaded before React initialised. Fixed by forcing React into a dedicated `react-core` manual chunk and explicit hook re-exports in `frontend/src/react-global.tsx`.

**Endpoint mismatch cleanup.** A significant amount of work went into aligning frontend service calls with actual worker routes. `MarketplaceEnhanced.tsx` in particular had a fallback chain trying `/api/pitches/browse/enhanced` and `/api/pitches/browse/general` — both 404s. Simplified to direct `getPublicPitches()` calls.

**Lesson preserved:** response format contracts between frontend and backend need contract tests, not just "I'll check manually after each deploy". An `items` vs `data.pitches` mismatch took down the core browse experience for days before it was noticed.

---

## Era 4 — Observability Build-Out (mid 2025 → early 2026)

Started from basically nothing — a `/health` endpoint returning `{status: 'healthy'}` — and evolved in distinct phases.

**Phase 1: Error tracking.** Sentry DSN wired in via `@sentry/cloudflare` with `withSentry()` wrapper. 10% trace sampling. `beforeSend` filters out 401/403/404 and auth-timing noise. `frontend/src/monitoring/sentry-config.ts` on the frontend with replay-on-error at 100%.

**Phase 2: Log aggregation.** Axiom dataset `pitchey-logs`, token via `wrangler secret put AXIOM_TOKEN`. Free tier handles ingest volume. APL queries for error detection, slow request analysis, auth failure patterns by IP.

**Phase 3: Metrics at edge.** Cloudflare Analytics Engine bindings, initially a handful, grew to 7 datasets: `pitchey_metrics`, `pitchey_database_metrics`, `pitchey_performance_metrics`, `pitchey_error_tracking`, `pitchey_trace_events`, `pitchey_container_metrics`, `pitchey_job_analytics`. High-cardinality metrics without the cost of a full metrics store.

**Phase 4: Structured logging + auth observability.** `src/lib/production-logger.ts` (structured JSON, auto-redaction, requestId/traceId propagation). `src/lib/auth-observability.ts` tracks `login_success`, `login_failed`, `logout`, `signup`, `session_created`, `session_expired`, `password_reset_requested`, `two_factor_enabled`, `account_locked`, `suspicious_activity`. Brute-force detection alerts Sentry after 5 failures in 15 minutes.

**Phase 5: Tracing.** W3C Trace Context propagation, 10% sampling, 30-day retention in R2 + Analytics Engine. `tracePropagationTargets` added to frontend `Sentry.init()` so traces flow frontend → backend. WebSocket reconnection breadcrumbs in `frontend/src/features/notifications/hooks/useWebSocketAdvanced.ts`.

**Phase 6: Automatic Tracing + 5-layer model.** Cloudflare Workers Automatic Tracing enabled (`[observability]` in `wrangler.toml`, 100% log sampling). Resulted in the current 5-layer observability stack documented in `CLAUDE.md`: Browser (chrome-devtools MCP) / Edge (CF Observability) / Errors (Sentry) / Logs (Axiom) / Metrics (Analytics Engine + PG). Each layer sees different signals — no redundancy.

**Thresholds settled on:**

- Response time warning: 2000 ms
- Error rate warning: 1%, critical: 5%
- Worker CPU warning: 45 ms (CF hard limit: 50 ms)
- Cache hit rate warning: < 60%
- Login failure alert: 5/15min same account, 10+ same IP

**Lesson preserved:** Sentry + Axiom + Analytics Engine each solve a different problem. Sentry for "something broke", Axiom for "what happened at 3:47am", Analytics Engine for "how often does this happen". Trying to use one for all three leads to cost or information loss.

---

## Era 5 — CI/CD Hardening (January 2026)

A concentrated cleanup of a pipeline that was succeeding ~10% of the time:

- **Frontend test failures (11 in `PitchForm.test.tsx`)** — DataTransfer API compat, NDA config text assertions. Fixed; 3 placeholder tests remain.
- **TypeScript compilation** — wrong `tsc` package being resolved in CI. Explicit typescript install added.
- **ESLint** — 2700+ warnings. Added `continue-on-error` to unblock the pipeline; treated as technical debt rather than blocker.
- **Scheduled monitoring workflows** — generating failure noise. Disabled via `gh` CLI.
- **Cloudflare API token permissions** — the final blocker. Required `Account:Cloudflare Pages:Edit`, `Account:Workers Scripts:Edit`, `User Details:Read`. Setup guide was written and executed manually.

Pipeline went from ~10% to ~100% success rate after the token was updated.

**Lesson preserved:** `continue-on-error` is a valid tool when the alternative is a broken pipeline. The 2700 ESLint warnings are still technical debt and should be chipped away at gradually — but the pipeline working is a prerequisite to doing anything else.

---

## Era 6 — Current State (mid-2026, not historical)

See root `CLAUDE.md`. High-level markers of "where we are" as of April 2026:

- 664 API routes, 161 pages, 182 components, 30 frontend services
- 118 backend services, 71 handlers, 85 migrations
- 4 portals (Creator, Investor, Production, Watcher) + Admin shell
- Slate system, heat score algorithm, structured feedback, trust badges, consumption gating, verification tiers all shipped
- Schema drift registry is being actively maintained in `CLAUDE.md` (no migration runner in prod; 85 migration files with unknown applied state is a known-unknown)

---

## Cross-cutting Lessons

These came up often enough across eras to warrant their own section:

**Silent `.catch(() => default)` on database queries is an anti-pattern that hides schema drift for weeks.** The consumption gate feature was broken for a long time because `sql\`...\`.catch(() => [{ total_duration: 0 }])` swallowed the error that would have surfaced the underlying `view_duration` never-populated bug. Future work: a helper that `Sentry.captureException`s the swallowed error before returning the default.

**Infrastructure bugs masquerade as feature bugs.** Missing tables, unreachable env vars, and uninitialised Redis clients all presented to users as "social features don't work" — not "database connection is misconfigured". Diagnosis has to go beyond the UI-level symptom.

**Document staleness accumulates fast.** The nine docs this consolidation replaced were all confidently written as current state at the time. The rate of architectural change between 2024 and 2026 means any doc older than ~6 months should be read as history unless explicitly maintained. `CLAUDE.md` is the single source of truth precisely because it's the only doc with an enforced update discipline.

**Response format contracts need tests.** An `items` vs `data.pitches` mismatch broke the core browse experience and took days to identify. Contract tests between frontend services and backend handlers would have caught this at CI time.

**Migration hygiene is a standalone concern.** 85 migration files with no runner, empty `schema_migrations` table, duplicate numbers, and a `999_consolidated_schema.sql` that doesn't match reality — this is technical debt with compounding interest. It wasn't a problem until it was, and when it became a problem (rating tables missing post-deploy) the resolution was painful.

---

## Superseded Documents

This consolidation replaces nine files. All content worth preserving has been folded in above. Deletion is pending explicit approval — do not `rm` these without confirming:

```
docs/CRITICAL_ISSUES_REPORT.md
docs/ERROR_LOG_ANALYSIS_AND_FIXES.md
docs/ERROR_STACK_SUMMARY.md
docs/MONITORING_AND_ERROR_FIXES.md
docs/WHITE_SCREEN_DEBUG_GUIDE.md
docs/TESTING_CHECKLIST.md
docs/cicd-fixes-status.md
frontend/FRONTEND_DEBUGGING_REPORT.md
frontend/FRONTEND_BACKEND_ISSUE_ANALYSIS.md
```

## Decision Needed: `docs/OBSERVABILITY.md`

Not in the deletion list above because the root `CLAUDE.md` references it as live documentation:

```
### Docs
- `docs/OBSERVABILITY.md` | `docs/LOGGING.md` | `docs/SENTRY_ERROR_TRACKING.md` | `docs/monitoring-guide.md`
```

The version currently on disk describes a 3-layer model (Sentry/Axiom/Cloudflare) and predates the current 5-layer stack, the browser layer, and `src/lib/production-logger.ts`. Three options:

1. **Delete + update `CLAUDE.md`** — remove the reference, rely on the Era 4 section of this doc plus the inline stack description in `CLAUDE.md` itself.
2. **Rewrite `docs/OBSERVABILITY.md`** from scratch to match the current 5-layer model. Keeps the reference valid.
3. **Keep as-is** — accept that it's a partial description and let readers fall through to `CLAUDE.md` for the full picture.

Recommendation: option 2. The observability stack is complex enough that a dedicated doc earns its place, and `CLAUDE.md` only has room for the one-paragraph summary.
