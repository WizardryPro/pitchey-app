# Backend Worker — Connectivity & Observability Reference

Loads automatically when working in `src/`. For general architecture see root CLAUDE.md.

## CORS Configuration

File: `utils/response.ts` — `getCorsHeaders()` (line 82)

Allowed origins (canonical model as of 2026-04-22):
- `pitchey-5o8.pages.dev` — live production frontend (Ndlovucavelle's `pitchey` Pages project; CF auto-suffixes because the global `pitchey.pages.dev` slot is held by the separate `pitchey-coming-soon` marketing project)
- `pitchey.com` — marketing stub (separate account, unlikely to hit the Worker API)
- `localhost:5173/3000` (+ `127.0.0.1` equivalents) — local dev
- Dynamic: `^https://[a-f0-9]+\.pitchey-5o8\.pages\.dev$` (hash-prefixed previews) and `^https://[a-zA-Z0-9-]+\.pitchey-5o8\.pages\.dev$` (branch/PR-prefixed previews)

**Do not reintroduce `pitchey.pages.dev` as an origin** — it NXDOMAINs since the Cavelltheleaddev project was deleted 2026-04-21. Reverting to the old model was PR #14/#21's mistake; flipped back to reality in commit `697de63`.

Allowed headers (line 102):
```
Content-Type, Authorization, X-Request-Id, X-Client-Id, sentry-trace, baggage, traceparent
```

### Trace Headers — DONE
- [x] `sentry-trace, baggage, traceparent` added to `Access-Control-Allow-Headers` (line 102 of response.ts)

## Handler Signatures (Orphan Smell)

Live handlers MUST type their parameters strictly. The deprecated signature `(request: Request, env: any, authResult: any)` is the canonical marker of dead code in this repo — every parallel-router file deleted in the 2026-04-29 sweep used it (12 functions in `nda-handlers.ts`, plus chained orphan modules under `worker-modules/`). If you find yourself writing `env: any` or `authResult: any`, stop: you're either (a) duplicating a live handler that already exists, or (b) extending the orphan tree.

- ✅ Live convention: `async function fooHandler(request: Request, env: Env): Promise<Response>` — auth is extracted inside via `getUserId(request, env)` from `utils/auth-extract.ts`, not passed as a parameter.
- ❌ Orphan convention: `async function handleFoo(request: Request, env: any, authResult: any): Promise<Response>` — pre-extracted auth, untyped env, paired with a separate router file under `worker-modules/`. None of these are live; if they look live to you, re-trace the import chain through to `wrangler.toml:8` (`main = "src/worker-integrated.ts"`).

Pre-flight check before writing a new handler: grep `src/worker-integrated.ts` for an existing `register('METHOD', '/api/<path>', ...)` line. If the route exists, find and modify the existing handler. Don't add a parallel one.

## Cookie Configuration

Live login writes the `pitchey-session` cookie from `handlePortalLogin()` in
`worker-integrated.ts`. `pitchey-session` holds a UUID, is keyed to a row in the
legacy `sessions` table, and is validated by the custom session handler.

Better Auth ALSO runs alongside, not instead: `src/auth/better-auth-config.ts`
line 51 invokes `betterAuth({...})`, and that instance is live on
`/api/users/profile` + `/api/users/settings` (via `routes/user-profile.ts` →
`auth-adapter.ts`) and on WebSocket session auth (via `worker-realtime.service.ts`
→ `better-auth-session-handler.ts`). Mixed model is deliberate for now;
full rip-or-migrate tracked in issue #19.

- Name: `pitchey-session`
- `SameSite=None`, `Secure`, `HttpOnly`, 30-day expiry, `path=/`
- Session lookup: legacy `sessions` table, UUID key, refresh-on-use
- Legacy cookie name `better-auth-session` is still *read* on sign-in
  (backward-compat fallback in `utils/auth.ts`, `utils/auth-extract.ts`)
  and cleared on sign-out. Writers are the BA paths mentioned above.

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

- `GET /api/health` (see `handleHealth` in `worker-integrated.ts:4489`) checks DB (`SELECT NOW()`), Upstash Redis (`/ping`), Stripe (`/v1/balance`), and Resend (`/domains`). Reports `ok` or `degraded` — not a tri-state, and no Better Auth probe in the live handler (earlier doc claimed one; it never existed in this function).
- All `ctx.waitUntil()` promises catch internally, never break requests (fire-and-forget telemetry)
