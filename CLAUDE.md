# Claude Instructions — Pitchey

Movie pitch platform connecting creators, investors, and production companies. Edge-first serverless architecture on Cloudflare.

## Architecture
- **Frontend**: Cloudflare Pages — React 18 + Vite + Zustand + TailwindCSS
- **Backend**: Cloudflare Worker (`src/worker-integrated.ts`) — single entry point for all API routing
- **Database**: Neon PostgreSQL — raw SQL, no ORM
- **Auth**: Better Auth — session cookies only, no JWT
- **Cache**: Upstash Redis (global)
- **Storage**: Cloudflare R2

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

## Code Conventions
- TypeScript for all new code
- Raw SQL only (no ORM)
- Better Auth sessions only (no JWT)
- `credentials: 'include'` on all API calls
- Defensive utils (`safeAccess`, `safeNumber`, `safeArray`) for runtime safety
- In `catch` blocks: `const e = err instanceof Error ? err : new Error(String(err))`

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

## Platform Status

### Completed (Stages 1-11)
- **Foundation**: 619 API routes, 3 portals + Admin, RBAC, CI/CD
- **Core Platform**: Dashboards, WebSocket + polling, search/browse, marketplace
- **Communication**: Messaging (edit/delete/attachments), credit system (9 actions), email via Resend
- **Security**: Email OTP 2FA, passwordless login, JWT verification, rate limiting (4 strategies), file validation
- **Collaboration**: Scoped collaborator access to pipeline projects (not a fourth portal)
- **AI**: Auto-fill production assessments from uploaded documents (Claude Haiku 4.5, 5 credits)
- **Data Quality**: Follow system (user + pitch), NDA messaging gate, snake_case normalization
- **Notifications**: Email (new follower, pitch publish), WebSocket push, 401 auto-redirect
- **Production Portal**: 26-issue remediation complete (uploads, dead buttons, stubs, settings, calendar)
- **Tests**: 192 files, 3639+ tests, zero failures

### TODO
- **Stripe Go-Live**: Create products/prices in Stripe Dashboard, set secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), set `stripePriceId` in `src/config/subscription-plans.ts`
- **Malware Scanning**: VirusTotal integration deferred — needs `VIRUSTOTAL_API_KEY` (free tier: 4 req/min)
- **Full Crew Features**: Availability calendars, rate cards — deferred post-launch

### Current Numbers
- 619 API routes, 135 pages, 166 components, 28 services, 3 stores
- 114 backend service files, 65 handlers, 77 migrations
- 3 portals (Creator, Investor, Production) + Admin shell
- 13 CI/CD workflows, 7 R2 buckets, 5 KV namespaces, 2 Durable Objects

## Observability & Analysis Stack

5 layers — browser, edge, errors, logs, metrics. No redundancy; each sees different signals.

```
Browser (chrome-devtools MCP)     — DOM, console, network, render perf, Lighthouse
Edge (Cloudflare Observability)   — Worker CPU, request duration, 100% log sampling
Errors (Sentry @sentry/cloudflare) — Exceptions, breadcrumbs, releases, 10% trace sampling
Logs (Axiom)                      — Structured request logs, slow queries, auth events
Metrics (Analytics Engine + PG)   — 7 datasets, request_logs/error_logs tables, health checks
```

### CLI Browser Analysis (chrome-devtools MCP)

Launch Chrome: `google-chrome-stable --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug`

**Staging**: `https://pitchey-5o8.pages.dev` | **Production**: `https://pitchey.com`

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
- **Analytics Engine**: 7 bindings — `pitchey_metrics`, `pitchey_database_metrics`, `pitchey_performance_metrics`, `pitchey_error_tracking`, `pitchey_trace_events`, `pitchey_container_metrics`, `pitchey_job_analytics`
- **Health**: `GET /api/health` checks DB, KV, R2, Resend, Better Auth (3s timeout each)
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
