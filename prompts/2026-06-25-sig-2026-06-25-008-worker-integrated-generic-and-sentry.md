---
id: prompt-2026-06-25-008
date: 2026-06-25
source_signal: sig-2026-06-25-008
signal_status: confirmed
band: 1
gates: recommended
action: execute
---

> Target stack: Cloudflare Worker — hand-rolled `RouteRegistry` in `src/worker-integrated.ts` (no framework) · Neon Postgres via `@neondatabase/serverless` + `postgres` driver, **raw SQL only** · custom `pitchey-session` auth · **the worker is esbuild-bundled and NOT type-checked in CI** (resolved from STACK.md)

## Task: Fix 5 type errors in the worker entry `src/worker-integrated.ts` (generic-T props + Sentry options)

### Context
`type-lint-audit` confirmed 5 errors in `src/worker-integrated.ts` itself (the worker entry, `wrangler.toml` main):
- `TS2339` lines 327-330: properties `title_image` / `thumbnail_url` / `titleImage` / `thumbnailUrl` accessed on a generic `T` that doesn’t declare them.
- `TS2345` line 22244: a Sentry options factory `(env: Env) => {...}` not assignable to `(env: unknown) => CloudflareOptions`.
Signal `sig-2026-06-25-008`.

### Fix
1. Lines 327-330: constrain the generic (`<T extends { title_image?: ...; thumbnail_url?: ...; titleImage?: ...; thumbnailUrl?: ... }>`) or type the parameter to the actual row/media shape so the property reads are sound. Do not cast to `any`.
2. Line 22244: align the Sentry options factory signature with `CloudflareOptions` (param typed `unknown` then narrowed, or return type annotated `CloudflareOptions`) so `withSentry()` accepts it. Confirm the returned object still carries `dsn`/`release`/`environment`/`tracesSampleRate`.

### Constraints
- Scope the change to the file(s) named above. Do **not** silence the checker with `any`, `as` casts, or `@ts-ignore` — fix the actual type mismatch.
- Do not touch PROTECTED parked paths (`src/workflows/`, crawl4ai/console-analysis — #60/#61).

### Done When
- [ ] `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error(s) gone **and introduces no new errors** (diff the before/after error counts — the worker has no CI type-check, so this gate is the only safety net)
- [ ] `npm run build:worker` still bundles clean
