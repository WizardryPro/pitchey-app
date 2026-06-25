---
id: prompt-2026-06-25-004
date: 2026-06-25
source_signal: sig-2026-06-25-004
signal_status: confirmed
band: 1
gates: optional
action: execute
---

> Target stack: Cloudflare Worker — hand-rolled `RouteRegistry` in `src/worker-integrated.ts` (no framework) · Neon Postgres via `@neondatabase/serverless` + `postgres` driver, **raw SQL only** · custom `pitchey-session` auth · **the worker is esbuild-bundled and NOT type-checked in CI** (resolved from STACK.md)

## Task: Fix TS2322 string→number in `src/handlers/promo-codes.ts:335`

### Context
`type-lint-audit` confirmed `TS2322` at `src/handlers/promo-codes.ts:335` — a `string` assigned where a `number` is expected (template metadata). Registered `worker-integrated.ts:3833-3842`. Signal `sig-2026-06-25-004`.

### Fix
1. Read line 335. Either parse the string to a number (`Number(...)`/`parseInt`, with NaN handling) or correct the target field’s type if the value is genuinely a string — whichever matches the column/usage.

### Constraints
- Scope the change to the file(s) named above. Do **not** silence the checker with `any`, `as` casts, or `@ts-ignore` — fix the actual type mismatch.
- Do not touch PROTECTED parked paths (`src/workflows/`, crawl4ai/console-analysis — #60/#61).

### Done When
- [ ] `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error(s) gone **and introduces no new errors** (diff the before/after error counts — the worker has no CI type-check, so this gate is the only safety net)
- [ ] `npm run build:worker` still bundles clean
