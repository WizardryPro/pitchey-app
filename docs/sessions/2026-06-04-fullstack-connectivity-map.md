# Pitchey Full-Stack Connectivity + Observability Map

**Date:** 2026-06-04 (~03:46–03:55 UTC)
**Scope:** Browser → Cloudflare Pages proxy → Worker (`pitchey-api-prod`) → Neon Postgres, plus the cross-origin WebSocket side-path.
**Mode:** READ-ONLY. No code changed. Synthesizes five independent specialist reports (FE→edge, edge→backend, live CF observability, end-to-end latency, connection mechanics), de-duplicated and re-verified against live telemetry + live HTTP probes by the author.
**Worker version live:** `026c7367-1753-4443-94e7-d48fb48b6ff2`, deployed `2026-06-04T01:41:14Z`.

> **One-line verdict:** The whole path is **healthy and correctly wired** — zero server-side errors across ~29k successful invocations in 24h. The only structural defects are a **WebSocket cookie-auth fallback that is broken by design** (mitigated by a working token path) and a **bare-`neon()` call in the session store that skips cold-start retry**. Everything else is config hygiene or stale findings.

---

## 1. Hop-by-hop diagram (mechanism + live metric per hop)

```
                                            LIVE 24h WINDOW (2026-06-03 → 06-04, scriptName=pitchey-api-prod)
                                            requests=28,974 success · errors=0 · subrequests=93,571 (~3.2/req)
                                            wall P50=291ms / P99=1,672ms · cpu P50=5.5ms / P99=41.6ms

 ┌─────────────┐   HTTPS/2 TLS1.3            ┌────────────────────────┐   server-to-server     ┌──────────────────────┐   Neon HTTP driver     ┌──────────────┐
 │  Browser    │   fetch credentials:       │ Cloudflare Pages        │   subrequest within   │  Worker               │   @neondatabase/        │  Neon         │
 │  React/Vite │──include, API_URL=''──────▶│ Functions /api/* proxy  │──CF network (same PoP)▶│  pitchey-api-prod      │──serverless (HTTP),────▶│  Postgres 17  │
 │             │   same-origin /api/*       │ _middleware.ts          │   redirect:manual     │  worker-integrated.ts  │   retry 530/1016        │  (8 published │
 │             │                            │                         │                       │                        │                         │   pitches)    │
 └─────────────┘                            └────────────────────────┘                       └──────────────────────┘                         └──────────────┘
       │  HOP 1                                    HOP 2                                            HOP 3                                            HOP 4
       │  edge: DNS~2ms TCP~11ms TLS~26ms          rewrites Set-Cookie SameSite=None→Lax,          RouteRegistry match → validateAuth             ~3.2 subreq/req; dashboards
       │  Pages / TTFB ~42ms                       strips Domain, strips ALL CORS headers,         (pitchey-session cookie → KV → sessions        fan out 3–5 parallel queries.
       │  [OK]                                      passthrough only /api/monitoring/envelope.     table) → handler in traceStorage.run().        cold-start = the P99 tail.
       │                                            measured tax: +17–33ms TTFB. [OK]              [OK]                                           [OK]
       │
       │  ╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
       └─▶║  WEBSOCKET SIDE-PATH (does NOT use the proxy — connects cross-origin DIRECT to the Worker)                                       ║
          ║                                                                                                                                  ║
          ║   Browser ──(1) GET /api/ws/token  SAME-ORIGIN via proxy, cookie forwarded──▶ Worker returns {token=<sessionId>}                 ║
          ║           ──(2) wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws?token=<sessionId>  CROSS-ORIGIN──▶ NotificationHub (DO)       ║
          ║                                                                                                                                  ║
          ║   Primary token path = OK. Cookie FALLBACK = BROKEN: proxy-set cookie is SameSite=Lax, never sent cross-origin. [WARN]           ║
          ╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

**Key files:** `frontend/src/lib/api-client.ts`, `frontend/src/config.ts` (API_URL='' in prod), `frontend/functions/api/_middleware.ts`, `src/worker-integrated.ts`, `src/services/worker-database.ts`, `src/db/connection.ts`, `src/auth/session-store.ts`, `src/config/session.config.ts`.

---

## 2. Health verdict per hop (telemetry-backed)

| Hop | Mechanism | Live signal | Verdict |
|---|---|---|---|
| **1. Browser → Pages CDN** | HTTPS/2, TLS 1.3, anycast. `API_URL=''` makes all `/api/*` same-origin. | Pages `/` TTFB **42ms**; DNS 2ms / TCP 11ms / TLS 26ms (flat both origins). TLS cert valid (Google WE1, exp 2026-07-15). | **OK** |
| **2. Pages Functions proxy → Worker** | `_middleware.ts` forwards, deletes Host, **strips all CORS headers**, rewrites `Set-Cookie SameSite=None→Lax` + strips Domain. | Proxy tax measured **+17–33ms** TTFB (`/api/version` proxy 62ms vs direct 43ms — author-measured). CORS strip verified live (zero `access-control-*` on proxy `/api/health`). | **OK** |
| **3. Worker dispatch + auth** | `websocketSafeHandler` → AXIOM gate → Sentry wrap → `RouteRegistry.handle()` → `validateAuth` (cookie → KV session cache, 1h TTL → `sessions` JOIN `users`). Router cached per-isolate. | **28,974 success / 0 errors** (24h). cpu P50 5.5ms / **P99 41.6ms** (under 50ms limit). | **OK** |
| **4. Worker → Neon** | `@neondatabase/serverless` HTTP; `WorkerDatabase.getSql()` + `getDb()` both retry HTTP 530/1016 cold-start. ~3.2 subreq/req. | `/api/health` → `database: connected`. wall **P50 291ms / P99 1,672ms** (cold-start tail). 8 published pitches in prod. | **OK** (tail = WARN, see §5) |
| **WS side-path** | Direct cross-origin `wss://…workers.dev/ws`. Token via same-origin `/api/ws/token`; cookie fallback secondary. | 0 WS-origin errors in telemetry — but **failures are absorbed silently by polling fallback** (no alerting). | **WARN** |

No hop is FAIL. The single highest-severity issue (WS cookie fallback) degrades to a working alternative, so it is a latent WARN rather than an outage.

---

## 3. Connection-mechanics correctness (cookies / CORS / TLS / WS)

**Cookies — correct for HTTP, structurally hostile to cross-origin WS.**
- Worker issues `pitchey-session` with `SameSite=None; Secure; HttpOnly; Max-Age=604800` (`session.config.ts:21` `COOKIE_SAME_SITE='None'`).
- The proxy **rewrites every `Set-Cookie` to `SameSite=Lax` and strips Domain** (`_middleware.ts` ~line 99–103). This is the *correct* posture for same-origin API traffic on the Pages domain.
- Consequence: a session established through the proxy is `Lax` and **will not be sent on the cross-origin WebSocket upgrade**. This is by design and is the root of the WS fallback gap (§4, issue 1).

**CORS — correct and clean.**
- Direct Worker echoes `access-control-allow-origin: https://pitchey-5o8.pages.dev` + `allow-credentials: true` (verified live). Origin regex also covers hash/branch preview subdomains of `pitchey-5o8.pages.dev`.
- Proxy **strips all CORS headers** on `/api/*` responses (verified live — none present), which is right because the browser sees those calls as same-origin.

**TLS — green on both origins.** TLS 1.3, `TLS_AES_256_GCM_SHA384 / X25519MLKEM768`, Google Trust Services WE1. Pages cert exp 2026-07-15 (41d), Worker `*.ndlovucavelle.workers.dev` exp 2026-08-31 (88d). Handshake a flat ~26ms, fully amortized by keep-alive — **no TLS tax**.

**WebSocket — token path sound, cookie fallback broken.** Pages Functions cannot proxy HTTP→WS upgrades, so the client connects cross-origin directly. The implemented primary path (fetch `/api/ws/token` same-origin with cookie → connect `wss://…/ws?token=<sessionId>`) works because the token endpoint is same-origin. The cookie fallback in `handleWebSocketUpgrade` cannot work for proxy-set sessions (Lax). On token failure the app silently falls to polling.

---

## 4. Drift / risks / bottlenecks (prioritized)

### P1 — WebSocket cookie-auth fallback is structurally broken (HIGH, confidence: high)
Proxy rewrites the session cookie to `SameSite=Lax`; browsers never send it on the cross-origin `wss://…workers.dev` upgrade. The `?token=` path (token from same-origin `/api/ws/token`) is the only working auth path. If `/api/ws/token` 401s during a login race or transient network error, the cookieless fallback always 401s and the user **silently drops to polling with no telemetry signal**.
*Evidence:* `_middleware.ts` SameSite rewrite; `handleWebSocketUpgrade` cookie fallback (`worker-integrated.ts` ~11803–11815); `session.config.ts:21`. Documented in `frontend/CLAUDE.md`.
*Fix options (not applied):* (a) allowlist `pitchey-session` to skip the SameSite rewrite in the proxy; (b) make WS auth token-only and delete the cookie fallback; (c) add a metric/alert when token-fetch fails so the silent degradation becomes visible.

### P2 — `session-store.ts` uses bare `neon()` with NO cold-start retry (MEDIUM, confidence: high — verified live)
`src/auth/session-store.ts:46` is `neon(env.HYPERDRIVE?.connectionString || env.DATABASE_URL)` with no `wrapWithRetry`/`getSql()` proxy. `createSession`/`findSession` run on **every login**, so a Neon cold-start there throws HTTP 530/1016 **without retry** — the exact shape of the 2026-06-03 signup-500 bug (`project_neon_coldstart_retry.md`). The Cloud-1 retry fix covered `WorkerDatabase` and `getDb()` but **not** the session store.
*Fix (not applied):* route session-store reads/writes through `getDb()` or wrap the client in the existing retry proxy.

### P3 — Neon cold-start dominates the latency tail (MEDIUM/WARN, confidence: high)
Success wall **P99 1.67s vs P50 0.29s = 5.8× spread**, driven by Neon serverless cold-start (Hyperdrive pooling was removed in `5b9a7d8f`, so each isolate opens a fresh HTTP connection). Residual transients surface as "Network connection lost" on DB-backed routes (`/api/pitches/hot`, `/api/ndas/outgoing-requests`) even with the 530/1016 classifier. This also inflates the **clientDisconnected** bucket (users abandon slow requests). Consider a keep-warm ping on hot routes or re-evaluating Hyperdrive.

### P4 — CPU P99 (41.6ms) is 8.4ms under the 50ms hard limit (MEDIUM, confidence: high)
bcrypt login is the heaviest synchronous consumer (~300–347ms wall). Already past the 45ms documented warning band on some requests. Any new heavy synchronous handler risks 1102 CPU-exceeded errors. Recommend a budget/alarm at 45ms.

### P5 — `X-Frame-Options` split: `SAMEORIGIN` (static) vs `DENY` (API/Worker) (MEDIUM, confidence: high — verified live)
Pages static `/` returns `SAMEORIGIN` (from `_headers`); `/api/*` and direct Worker return `DENY` (`security-fix.ts`). Worker also emits `frame-ancestors 'none'` (the stronger directive), so security is *not* weakened — but the split is audit-confusing config debt.

### P6 — Narrow Worker CSP leaks onto `/api/*` (LOW, confidence: high — verified live)
Worker `response.ts` CSP allows only `cdn.jsdelivr.net`/`unpkg.com` for `script-src` (no Stripe, Turnstile, Sentry). Harmless for JSON, but would break payment/challenge flows if any Worker route ever returns HTML. The wide, correct CSP lives only in `frontend/public/_headers` for SPA routes — split CSP ownership.

### P7 — Stale env / dead code (LOW, confidence: high)
- `frontend/.env.production:5` `VITE_FRONTEND_URL=https://pitchey.pages.dev` (NXDOMAIN since 2026-04-21). **Not read anywhere** in `frontend/src/` today — zero runtime impact, latent footgun for future share-link/email features.
- `frontend/src/services/auth.service.ts` is an orphan calling Better-Auth SDK methods whose backend was ripped (PR #70). No live importer. Risk only if a future dev mistakes it for the real auth path.
- `betterAuthStore.login/.register` (`:194/:229`) use bare `${import.meta.env.VITE_API_URL}` without `|| ''`; effectively unused (portal logins use the fallback-safe path) but diverges from the established pattern.
- Cosmetic: `api-client.ts:7` imports `config` but never uses it.

### P8 — `www.pitchey.com` missing from CORS `ALLOWED_ORIGINS` (LOW, confidence: medium)
`src/utils/response.ts` lists `pitchey.com` but not `www.pitchey.com` (a live proxied CNAME per `project_turnstile_domain_issue.md`). Latent only — the marketing stub makes no authenticated API calls today.

### P9 — `useWebSocketAdvanced` cleanup unconditionally `disconnect()`s (MEDIUM→re-graded LOW, confidence: medium)
`useWebSocketAdvanced.ts:1221` returns `() => disconnect()` with `connectionStatus.connected/connecting` in deps (`:1224`), so a successful connect re-runs the effect and clean-closes the just-opened socket, generating spurious reconnect cycles that feed the circuit breaker. **One specialist attributed the 14.5% clientDisconnected rate to this; that attribution is weak** — clientDisconnected is better explained by the Neon slow tail + mobile backgrounding + polling lifecycle (three of five reports agree). Treat as a real but lower-impact React lifecycle smell.

---

## 5. Contradictions resolved + confidence notes

| Topic | Reports disagreed | Resolution | Confidence |
|---|---|---|---|
| **`pitchey_score_avg` "column does not exist" on `getFeedbackProgress`** | Latency report flagged 3 live error events as an active #20 schema-drift bug. | **STALE / RESOLVED.** Author verified the column **exists** in prod (`pitches.pitchey_score_avg`), and `git` shows commit `1086fb01` "feedback-progress drift" — the **exact code in live worker `026c7367` deployed 2026-06-04T01:41:14Z**. The 3 events occurred *earlier in the 24h window, before that deploy*. Not a live bug. | High (DB + git + deploy-time triangulated) |
| **clientDisconnected attribution** | FE report → WS cleanup loop; others → Neon tail + mobile/polling. | Multi-cause; **dominant driver is the slow DB tail + polling/WS lifecycle**, not the cleanup loop alone. WS cleanup is a contributor at most. | Medium |
| **Total invocations / success count** | 33,719 / 33,787 / 33,788 across reports; success 28,974–29,469. | Snapshot drift across slightly different 24h windows. **Author's live pull: success=28,974, clientDisconnected=4,199, responseStreamDisconnected=50, errors=0.** All consistent within window jitter. | High |
| **Proxy hop cost** | 12ms / 17–33ms / "~300–500ms". | The **~300–500ms** figure conflated a Neon-cold `/api/health` call with proxy overhead. True proxy tax on non-DB endpoints is **+17–33ms** (author re-measured `/api/version`: +19ms). The 300ms was cold-start, not the proxy. | High |
| **WS hop healthy true/false** | FE said healthy:true; edge/e2e said healthy:false. | **Both right at different layers:** token path = healthy; cookie fallback = broken. Net verdict **WARN**. | High |
| **Observability telemetry endpoint reachable** | One report: 404/unparseable, "must use MCP." | **Reachable.** Author got a clean 50-event sample via `POST /accounts/{id}/workers/observability/telemetry/query` with `parameters.filters` + `type:"string"`. The MCP response parser **flakes intermittently** on certain event payload shapes (errors with "reading 'map'") — endpoint and auth are fine. | High |

---

## 6. Headline numbers (live, 24h, author-verified)

| Metric | Value | Source |
|---|---|---|
| **Successful Worker invocations (24h)** | **28,974** (errors **0**) | GraphQL `workersInvocationsAdaptive`, author pull |
| **Server-side error rate** | **0.00%** | 0 invocation errors across all status buckets |
| clientDisconnected | 4,199 (~12.6% of 33,223) | structurally expected (polling/WS/slow-tail) |
| responseStreamDisconnected | 50 (~0.15%) | — |
| Subrequests (24h) | 93,571 (**~3.2 / req**) | dashboard parallel-query fan-out |
| **Wall-time P50 / P99 (success)** | **291ms / 1,672ms** | P99 = 84% of 2,000ms warn threshold |
| **CPU P50 / P99 (success)** | **5.5ms / 41.6ms** | P99 = 83% of 50ms CF hard limit |
| **Proxy hop cost** | **+17–33ms TTFB** (+19ms author-measured on `/api/version`) | NOT a bottleneck; ~50× smaller than cold-start tail |
| Edge front-of-path | DNS ~2ms / TCP ~11ms / TLS ~26ms | flat across both origins (same CF edge) |
| `/api/health` TTFB (warm) | proxy 671ms / direct 603ms | serial DB+Redis+Stripe+Email fan-out |
| Health services | database, redis, stripe, email all **connected** | `GET /api/health` |
| Live worker version | `026c7367…` @ 2026-06-04T01:41:14Z | includes the feedback-drift fix |

---

## 7. Reading paths

- **On-call / triage:** §2 verdict table → §6 headline numbers → §4 P1–P2.
- **Architects:** §1 diagram → §3 connection mechanics → §5 contradictions.
- **Next-action owners:** §4 prioritized list. Top two: WS cookie fallback (P1) and session-store retry gap (P2) are the only items with real failure modes; the rest is config hygiene or stale.
