# Frontend — Connectivity & Auth Reference

Loads automatically when working in `frontend/`. For general architecture see root CLAUDE.md.

## API Communication Path

All API calls go through the **Pages Functions proxy** (`functions/api/_middleware.ts`).
- Production `API_URL` is `''` (empty string) — requests are same-origin via the proxy
- The proxy rewrites cookies: removes `Domain`, changes `SameSite=None` to `Lax`
- The proxy strips all CORS headers from backend responses (unnecessary when same-origin)
- Dev uses `http://localhost:8001` (or `VITE_API_URL`)

Key file: `src/config.ts` — lazy-initialized Proxy, exports `API_URL`, `WS_URL`, `config`

## Auth Session Flow

Cookie: `pitchey-session` (HttpOnly, Secure, 30-day expiry on backend). Despite the file naming, the live backend auth is **custom handlers on the legacy `sessions` table**, not Better Auth — see root CLAUDE.md "Auth" section and issue #19. The `better-auth-*` files named below still work on the frontend because they're thin wrappers around `fetch(/api/auth/...)` with `credentials: 'include'`; they never call Better Auth's server APIs. Rename deferred to avoid a noisy refactor while issue #19's decision is pending.

1. `src/lib/better-auth-client.tsx` — session-fetch client (name is legacy), `baseURL` is empty in prod, `credentials: 'include'`
2. `src/store/betterAuthStore.ts` — primary auth state (Zustand), talks to the custom backend handlers
3. `src/store/sessionCache.ts` — localStorage cache (5min TTL), invalidated when cookie fingerprint changes
4. `src/lib/session-manager.ts` — deduplicates session checks (30s min interval), returns in-progress promise to prevent races

### 401 Handling Gotcha
`src/lib/api-client.ts` lines 223-259: on 401, it first verifies the session endpoint before redirecting.
A `_handlingAuth401` flag prevents multiple 401 redirects firing simultaneously.
The flag resets after 3 seconds — if auth is broken for longer, subsequent calls queue up.

## API Client Retry Logic

File: `src/lib/api-client.ts` (singleton `apiClient`)
- Max 2 retries with linear-ish backoff (`retryDelay * (retryCount + 1)`)
- Does NOT retry: CORS errors, `Failed to fetch`, `Cross-Origin`, `Access-Control`
- DOES retry: `NetworkError`, DNS failures (`ERR_NAME_NOT_RESOLVED`, `ENOTFOUND`)
- All requests include `credentials: 'include'`

## WebSocket — Different Origin

WebSocket connects **directly** to the Worker (not through the proxy).
- URL: `wss://pitchey-api-prod.ndlovucavelle.workers.dev` (default in `src/config.ts`, exported via lazy proxy)
- Pages Functions do not support WebSocket proxying
- Context: `src/shared/contexts/WebSocketContext.tsx` wraps `useWebSocketAdvanced` hook
- Falls back to polling via `src/features/notifications/services/polling.service.ts`

**Gotcha**: WebSocket is cross-origin, so it needs the `pitchey-session` cookie with `SameSite=None`.
The backend sets this, but the proxy rewrites it to `Lax` for API calls. Only the initial cookie
set (before proxy rewrite) makes the cookie available for WebSocket. If the user logs in and
the cookie is set with `SameSite=Lax` only, WebSocket auth may fail silently.

## Error Boundaries

- Main: `src/shared/components/feedback/ErrorBoundary.tsx` — reports to `/api/errors/client`
- Portal: `src/components/ErrorBoundary/PortalErrorBoundary.tsx` — Sentry-tagged by portal
- Chunk errors: auto-reload on `ChunkLoadError` (stale deployment detection)

## Sentry Config

File: `src/monitoring/sentry-config.ts`
- 10% trace sampling in prod, 100% replay on error
- **Replay masking (2026-04-17)**: `maskAllText: true`, `maskAllInputs: true`, `blockAllMedia: true`, `networkCaptureBodies: false`. Pitch content + auth bodies no longer leak into 90-day-retained replays. Opt specific elements back in with `className="replay-safe"` (use sparingly — only for chrome you need visible in replays for debugging, never for pitch content).
- Filters out 401/403/404 and auth-timing noise in `beforeSend`
- `tracePropagationTargets` is set so traces flow frontend → backend
- WebSocket reconnection breadcrumbs are emitted from `useWebSocketAdvanced.ts`

## Sentry Tunnel

`frontend/functions/api/monitoring/envelope.ts` proxies Sentry envelopes same-origin so ad/privacy blockers don't drop events. **Uses `request.arrayBuffer()`, never `request.text()`** — `.text()` lossy-decodes binary rrweb payloads and Sentry upstream returns 400 with `"missing newline after header or payload"`. Between tunnel deployment and the 2026-04-17 fix, zero replays reached Sentry; the feature was silently dark. If you ever see envelope 400s upstream, check this tunnel first.

## Deployment & Routing

- `wrangler pages deploy dist/` **must run from `frontend/`** not repo root — otherwise `functions/` isn't detected and the Functions bundle silently doesn't compile (no error shown)
- `_redirects` is **ignored** when Pages Functions exist — SPA fallback is handled by `functions/_middleware.ts` which serves `index.html` for non-API, non-asset routes. It calls `context.next()` for `/api/*` to pass through to the api middleware.
- `functions/api/_middleware.ts` handles the API proxy. **Middleware runs BEFORE specific routes in CF Pages** (opposite of catchall priority) — so it has an explicit passthrough list (`SPECIFIC_ROUTES` Set) for paths that need to hit their own handler. Currently only `/api/monitoring/envelope` (Sentry tunnel).
- Filenames avoid `[[name]].ts` catchall syntax: wrangler's bundler translates `[[name]]` → `routePath: "/:name*"` (v6 syntax) but ships path-to-regexp v8 which rejects it → CF 1101 on every route. See `docs/sessions/2026-04-21-URGENT-status.md`.
- If middleware is removed or renamed, every direct URL navigation or page refresh will 404.
