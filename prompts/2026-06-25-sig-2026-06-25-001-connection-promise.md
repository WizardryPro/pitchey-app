---
id: prompt-2026-06-25-001
date: 2026-06-25
source_signal: sig-2026-06-25-001
signal_status: confirmed
band: 1
gates: optional
action: execute
---

> Target stack: Cloudflare Worker — hand-rolled `RouteRegistry` in `src/worker-integrated.ts` (no framework) · Neon Postgres via `@neondatabase/serverless` + `postgres` driver, **raw SQL only** · custom `pitchey-session` auth · **the worker is esbuild-bundled and NOT type-checked in CI** (resolved from STACK.md)

## Task: Fix TS2322 in `src/db/connection.ts:54` (unknown → Promise<unknown>)

### Context
`type-lint-audit` confirmed (via a separate Explore verifier) a worker type error on a live path. `src/db/connection.ts:54` returns a value typed `unknown` where `Promise<unknown>` is expected. Signal `sig-2026-06-25-001`.

### Fix
1. Read `src/db/connection.ts:54` and the enclosing function signature.
2. Correct the type so the returned promise is properly typed — likely a missing `await`, a wrong generic argument, or a return annotation that should be `Promise<T>`. Make the value and the declared return type agree honestly.

### Constraints
- Scope the change to the file(s) named above. Do **not** silence the checker with `any`, `as` casts, or `@ts-ignore` — fix the actual type mismatch.
- Do not touch PROTECTED parked paths (`src/workflows/`, crawl4ai/console-analysis — #60/#61).

### Done When
- [ ] `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error(s) gone **and introduces no new errors** (diff the before/after error counts — the worker has no CI type-check, so this gate is the only safety net)
- [ ] `npm run build:worker` still bundles clean
