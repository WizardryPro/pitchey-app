# Backend Worker — Connectivity & Observability Reference

Loads automatically when working in `src/`. For general architecture see root CLAUDE.md.

## CORS Configuration

File: `utils/response.ts` — `getCorsHeaders()` (line 82)

Allowed origins: `pitchey.pages.dev`, `pitchey.com`, `localhost:5173/3000`
Plus dynamic: any `*.pitchey.pages.dev` Cloudflare preview deployment.

Allowed headers (line 102):
```
Content-Type, Authorization, X-Request-Id, X-Client-Id
```

### Trace Headers — DONE
- [x] `sentry-trace, baggage, traceparent` added to `Access-Control-Allow-Headers` (line 102 of response.ts)

## Cookie Configuration

File: `auth/better-auth-cloudflare-config.ts` — `createBetterAuth()` (line 44)
- Name: `pitchey-session`
- `SameSite=None`, `Secure`, `HttpOnly`, 30-day expiry, `path=/`
- Session update age: 24 hours (avoids DB writes on every request)
- Cookie cache: 5min (Better Auth built-in)

**Gotcha**: The Pages Functions proxy (`frontend/functions/api/[[path]].ts`) rewrites
`SameSite=None` to `Lax` and strips `Domain`. This is correct for same-origin API calls
but means the cookie may not be sent on cross-origin WebSocket connections if it was
only ever set through the proxy path.

## Sentry Integration

File: `worker-integrated.ts` (near end of file — line numbers drift as file grows)
- `withSentry()` wraps the main handler (non-WebSocket requests only)
- 10% trace sampling, filters `/health` and `/favicon` transactions
- DSN and release from `env.SENTRY_DSN` and `env.CF_VERSION_METADATA`

## Cloudflare Observability

wrangler.toml: `[observability]` enabled, logs at 100% sampling, persisted.

### Automatic Tracing — DONE
- [x] `[observability.traces]` with `enabled = true`, `head_sampling_rate = 0.1` configured in wrangler.toml (lines 245-247)

## Axiom Logging

Files: `middleware/axiom-logging.ts` (middleware wrapper), `lib/observability.ts` (AxiomClient class)
- `createAxiomLogger(env)` exists and works — sends to `pitchey-logs` dataset
- Secret: `AXIOM_TOKEN` (set via `wrangler secret put AXIOM_TOKEN`)

### Axiom wired into main handler — DONE
- [x] `createAxiomLogger` imported in `worker-integrated.ts` (line 16)
- [x] `ctx.waitUntil(logger.logRequest(...).catch(()=>{}))` fires after every non-WebSocket response
- [x] `ctx.waitUntil(logger.logError(...).catch(()=>{}))` fires when the Sentry-wrapped handler throws
- [x] WebSocket upgrades skip Axiom (101 responses are not standard HTTP response objects)
- [x] `AXIOM_TOKEN` absence is handled inside `createAxiomLogger` — returns early, no throw
- All `ctx.waitUntil()` calls have a `.catch(()=>{})` guard so Axiom network failures never surface

## Database Instrumentation

File: `db/logged-connection.ts` — `LoggedDatabase` wrapper
- Query timing with configurable slow threshold (default 1000ms)
- Sentry breadcrumbs on every query (slow queries get `level: 'warning'`)
- Metrics: totalQueries, slowQueries, failedQueries, totalDuration

### SQLCommenter + Trace ID — DONE (wired end-to-end)
- [x] `db/trace-context.ts` — `AsyncLocalStorage<TraceContext>` carries per-request trace context
- [x] `WorkerDatabase.executeQuery()` calls `annotateQueryWithTrace()` on every query
- [x] `RouteRegistry.handle()` wraps handler in `traceStorage.run()` with traceparent + matched route
- [x] Trace ID sourced from `traceparent` → `sentry-trace` → `x-trace-id` headers (in priority order)
- [x] `LoggedDatabase` also has `withTraceContext()` for any code paths using it directly
- Values are percent-encoded (`encodeURIComponent` + `%27`/`%2A`) — injection-safe

## Health & waitUntil

- `GET /api/health` checks DB, KV, R2, Resend, Better Auth (3s timeout each) → `healthy | degraded | unhealthy`
- All `ctx.waitUntil()` promises catch internally, never break requests (fire-and-forget telemetry)
