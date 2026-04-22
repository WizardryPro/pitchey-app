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

Live login writes the `pitchey-session` cookie from `handlePortalLogin()` in
`worker-integrated.ts`. `pitchey-session` holds a UUID, is keyed to a row in the
legacy `sessions` table, and is validated by the custom session handler —
**not** by Better Auth. `auth/better-auth-cloudflare-config.ts` exists but its
`createBetterAuth()` output is never wired into the live request path (issue
#19 tracks the cleanup decision).

- Name: `pitchey-session`
- `SameSite=None`, `Secure`, `HttpOnly`, 30-day expiry, `path=/`
- Session lookup: legacy `sessions` table, UUID key, refresh-on-use
- Sign-out theatre: the sign-out handler also returns `Set-Cookie: better-auth-session=; Max-Age=0`
  but nothing ever sets that cookie — it's a leftover from an earlier BA attempt
  and can be removed in the issue #19 rip-out/migrate/document decision

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

### Neon client call convention (2026-04-22)

Two call shapes are valid; the third is not:
- ✅ Tagged template: `` sql`SELECT * FROM users WHERE id = ${id}` `` — preferred for static queries.
- ✅ Parameterized: `sql.query('SELECT * FROM users WHERE id = $1', [id])` — use when the query string is assembled dynamically (e.g. `WhereBuilder`).
- ❌ Call-form: `sql('SELECT $1', [id])` — **throws at runtime**. The Neon `postgres` client rejects it with "This function can now be called only as a tagged-template function... use sql.query(...)".

The `SqlQuery` type in `db/queries/base.ts` no longer advertises the call-form overload, so any remaining misuse is a type error. 27 pre-existing sites were migrated 2026-04-22 (commit `a99ac28`) — see root CLAUDE.md "Error cluster" entry.

### SQLCommenter + Trace ID — DONE (wired end-to-end)
- [x] `db/trace-context.ts` — `AsyncLocalStorage<TraceContext>` carries per-request trace context
- [x] `WorkerDatabase.executeQuery()` calls `annotateQueryWithTrace()` on every query
- [x] `RouteRegistry.handle()` wraps handler in `traceStorage.run()` with traceparent + matched route
- [x] Trace ID sourced from `traceparent` → `sentry-trace` → `x-trace-id` headers (in priority order)
- [x] `LoggedDatabase` also has `withTraceContext()` for any code paths using it directly
- Values are percent-encoded (`encodeURIComponent` + `%27`/`%2A`) — injection-safe

## Health & waitUntil

- `GET /api/health` checks DB, KV, R2, Resend, Better Auth (3s timeout each) → `healthy | degraded | unhealthy`. The Better Auth check only verifies the module imports; the adapter is not wired into live auth (see Cookie Configuration above and issue #19).
- All `ctx.waitUntil()` promises catch internally, never break requests (fire-and-forget telemetry)
