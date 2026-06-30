# R8 — Read-only fallback for marketplace/browse during DB degradation

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker + React/Vite + Neon Postgres, raw SQL via @neondatabase/serverless, no ORM). Implement R8: a worker-side read-only cache fallback so the marketplace/browse/trending discovery surfaces keep serving last-good data (clearly marked stale) when a Neon DB read fails (HTTP 402 quota, 5xx, cold-start timeout). This protects discovery liquidity at launch (~60 production cos) when Neon hits a compute-time quota (HTTP 402 on every query) — which has taken prod down twice (2026-04-30 #65, 2026-06-22). DO NOT touch write paths.

## Background facts (already verified — do not re-derive)
- The live router is `src/worker-integrated.ts`. The discovery read handlers are private methods on that class:
  - `getTrending` (line ~9642) — registered at `GET /api/pitches/trending`, `GET /api/trending`, `GET /api/search/trending`
  - `browsePitches` (line ~9452) — registered at `GET /api/pitches/browse`, `GET /api/browse`
  - `getPitches` (line ~5842) — registered at `GET /api/pitches`
  These are the ONLY read paths in scope. (Pre-flight grep them with `grep -n "this.register('GET'" src/worker-integrated.ts | grep -E "trending|browse|/api/pitches'"` to confirm registration before editing.)
- Real Upstash usage lives in `src/db/raw-sql-connection.ts` using `import { Redis } from '@upstash/redis/cloudflare'` with `env.UPSTASH_REDIS_REST_URL` / `env.UPSTASH_REDIS_REST_TOKEN`. NOTE: `src/lib/redis.ts` is a NO-OP STUB — do NOT use it for this feature; instantiate the real `@upstash/redis/cloudflare` client.
- Frontend already has a degraded-banner system (R0.1): `frontend/src/store/serviceStatusStore.ts` (`degraded` flag), `frontend/src/shared/components/feedback/ServiceDegradedBanner.tsx` (mounted in `frontend/src/App.tsx`), and `frontend/src/lib/api-client.ts` (line ~178) already flips `setDegraded(response.status >= 500)` on any 5xx and clears it on non-5xx. You will EXTEND this — the banner currently only triggers on 5xx; stale-cache responses return 200, so the worker must signal staleness explicitly.
- 402 maps to `ErrorCode.INSUFFICIENT_FUNDS` in `src/utils/api-response.ts` for app-level billing; the Neon quota 402 is a DB-layer fetch failure (caught in the query/connection layer), distinct from that. Detect it by inspecting the thrown DB error, not by an app ErrorCode.

## Goal
When `getTrending` / `browsePitches` / `getPitches` succeed, write the serialized successful response payload to Upstash under a per-endpoint+query cache key with a bounded TTL. When the DB read THROWS (402 quota / 5xx / timeout), serve the last-good cached payload with a `X-Pitchey-Stale: true` response header and a `stale: true` field in the JSON body, HTTP 200. If no cache exists, return the normal error (503/degraded) — never fabricate data. The frontend reads `X-Pitchey-Stale` and raises the existing degraded banner with stale-specific copy.

## Files to touch
1. NEW `src/lib/read-fallback-cache.ts` — small helper:
   - `getFallbackRedis(env)` → returns a real `@upstash/redis/cloudflare` `Redis` instance or `null` if env vars absent (degrade gracefully, never throw).
   - `cacheKeyFor(endpoint: string, url: URL)` → stable key like `rofallback:v1:<endpoint>:<sorted-querystring>`.
   - `writeLastGood(env, key, payloadString, ttlSeconds)` — fire-and-forget-safe but ERROR-LOGGED (tag `// fire-and-forget` on the line before the `.catch` and log to Sentry/console; never swallow silently). Default TTL = 300s (5 min) — long enough to ride a cold-start/quota blip, short enough that recovery isn't poisoned.
   - `readLastGood(env, key)` → returns the cached string or null.
2. `src/worker-integrated.ts` — wrap the three handlers. Refactor each so the DB-producing body is in a `try`; on success, serialize the response body, write to cache, return as today; on throw, attempt `readLastGood`, and if hit, return a 200 with the cached body plus `stale:true` injected and header `X-Pitchey-Stale: true`. On miss, rethrow / return the existing error response. Keep the diff minimal — extract a private helper `private async serveWithReadFallback(endpoint, request, producer)` and call it from the three sites rather than copy-pasting.
3. `frontend/src/lib/api-client.ts` — after the existing `setDegraded(response.status >= 500)` line (~178), also flip degraded true when `response.headers.get('X-Pitchey-Stale') === 'true'`. Pass a stale reason into the store.
4. `frontend/src/store/serviceStatusStore.ts` — add an optional `stale: boolean` (and/or a `reason` string) alongside `degraded`; default false; setter updates it. Keep R0.1 behavior intact.
5. `frontend/src/shared/components/feedback/ServiceDegradedBanner.tsx` — when `stale` is set, show stale-specific copy (e.g. "Showing recent cached results — live data is temporarily unavailable.") distinct from the generic 5xx degraded copy. The banner must make it unmistakable the data is not live.

## Pre-flight checks (run before writing code)
- `grep -n "serveWithReadFallback\|read-fallback-cache" src/worker-integrated.ts` → expect zero (confirm not already done).
- Confirm the three handler registrations are live (grep above). If any handler is NOT registered in `worker-integrated.ts`, STOP — it's an orphan; do not extend it.
- `grep -rn "@upstash/redis/cloudflare" src/db/raw-sql-connection.ts` → confirm the import path and env var names match what you'll use.
- Read `frontend/src/store/serviceStatusStore.ts` and `frontend/src/lib/api-client.ts` around line 178 fully before editing — preserve the self-healing clear-on-success behavior.
- Check existing tests: `frontend/src/store/__tests__/serviceStatusStore.test.ts` and `frontend/src/shared/components/feedback/__tests__/ServiceDegradedBanner.test.tsx` — update them for the new `stale` field rather than breaking them.

## Implementation notes
- Worker error detection: the Neon quota failure surfaces as a thrown error from the `@neondatabase/serverless` query. In the producer `try/catch`, treat ANY thrown error from the DB producer as a fallback trigger — you don't need to special-case 402 vs 5xx; both mean "live read failed". (Optionally log the error class so we can see 402 vs cold-start in Sentry.)
- Only cache successful (HTTP 2xx) producer results. Never cache an error response.
- Do not change response shape on the happy path beyond an absent/`stale:false` field (additive only) — frontend consumers must keep working.
- Keep TTL + key versioning (`v1`) so a payload-shape change can be invalidated by bumping the prefix.

## Verification gates (ALL must pass before opening/merging the PR)
G1 — Stale data is never served as fresh. Stale responses MUST carry BOTH `X-Pitchey-Stale: true` header and `stale:true` in the body, AND the banner must render distinct stale copy. Manually prove: temporarily force the producer to throw in `getTrending`, hit `/api/pitches/trending`, confirm 200 + header + body flag + banner copy; revert the forced throw. (This is the #20-shape laundering gate — a cached payload returned without the stale marker is a hard fail.)
G2 — Write paths untouched. `git diff --stat` shows NO changes under NDA, credit, payment, or any POST/PUT/DELETE handler. Run `grep -n "serveWithReadFallback" src/worker-integrated.ts` and confirm every call site is one of the three GET discovery handlers only. Caching is applied to read GETs exclusively.
G3 — No cache poisoning after recovery. Confirm TTL is bounded (≤300s) and only 2xx producer results are written. Prove recovery: after a forced-throw stale hit, restore the producer, hit the endpoint again, confirm the response is fresh (`stale` absent/false) and the banner clears — the cache does not pin stale data once the DB is healthy. Bump-able key prefix (`v1`) present.
G4 — Graceful when Upstash absent. With `UPSTASH_REDIS_REST_URL` unset, `getFallbackRedis` returns null and all three handlers behave exactly as today (happy path unchanged, error path unchanged) — no thrown errors from the cache layer.
G5 — No silent swallows. Any `.catch` in the cache helper is tagged `// fire-and-forget` on the prior line AND logs the error (Sentry/console) — it must not return success-shaped data on a swallowed write. Run the repo catch-swallow gate if available: `node scripts/catch-swallow-gate.mjs --include-worker --threshold 0` (or the package script) and confirm zero new untagged catches.
G6 — Types + tests green. `cd frontend && npx tsc --noEmit -p tsconfig.app.json` and `npx vitest run src/store/__tests__/serviceStatusStore.test.ts src/shared/components/feedback/__tests__/ServiceDegradedBanner.test.tsx` both pass; worker type-check (`npx tsc --noEmit` against the root tsconfig) passes for the new file.

## Deliverable
A branch + PR titled "R8: read-only stale-cache fallback for discovery surfaces during DB degradation". PR body lists the three wrapped endpoints, the TTL/key scheme, and a checked-off G1–G6 block with the manual-proof commands you ran. Do NOT deploy — leave deploy to the user. End git commit message with the Co-Authored-By line and the PR body with the Generated-with line per repo convention.
