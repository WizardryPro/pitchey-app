---
id: prompt-2026-06-25-007
date: 2026-06-25
source_signal: sig-2026-06-25-007
signal_status: confirmed
band: 1
gates: recommended
action: execute
---

> Target stack: Cloudflare Worker — hand-rolled `RouteRegistry` in `src/worker-integrated.ts` (no framework) · Neon Postgres via `@neondatabase/serverless` + `postgres` driver, **raw SQL only** · custom `pitchey-session` auth · **the worker is esbuild-bundled and NOT type-checked in CI** (resolved from STACK.md)

## Task: Fix TS2322 in core DB service `src/services/worker-database.ts:137`

### Context
`type-lint-audit` confirmed `TS2322` at `src/services/worker-database.ts:137` — `unknown` not assignable to `Promise<unknown>` in the **core DB service** imported at `worker-integrated.ts:219` and instantiated at :722/:845/:879 (every route uses it). Signal `sig-2026-06-25-007`.

### Fix
1. Read line 137 and the method’s declared return type. Same shape as the `connection.ts` issue — make the returned value and the `Promise<...>` return type agree (missing `await`, wrong generic, or annotation). Because all routes use this service, keep the fix minimal and type-honest.

### Constraints
- Scope the change to the file(s) named above. Do **not** silence the checker with `any`, `as` casts, or `@ts-ignore` — fix the actual type mismatch.
- Do not touch PROTECTED parked paths (`src/workflows/`, crawl4ai/console-analysis — #60/#61).

### Done When
- [ ] `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error(s) gone **and introduces no new errors** (diff the before/after error counts — the worker has no CI type-check, so this gate is the only safety net)
- [ ] `npm run build:worker` still bundles clean
