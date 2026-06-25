---
id: prompt-2026-06-25-005
date: 2026-06-25
source_signal: sig-2026-06-25-005
signal_status: confirmed
band: 1
gates: optional
action: execute
---

> Target stack: Cloudflare Worker — hand-rolled `RouteRegistry` in `src/worker-integrated.ts` (no framework) · Neon Postgres via `@neondatabase/serverless` + `postgres` driver, **raw SQL only** · custom `pitchey-session` auth · **the worker is esbuild-bundled and NOT type-checked in CI** (resolved from STACK.md)

## Task: Fix 8× TS2345 string|null→number|null id args in `src/handlers/slates.ts`

### Context
`type-lint-audit` confirmed 8× `TS2345` in `src/handlers/slates.ts` (lines 56/100/156/211/314/351/423/472) — `string | null` passed where `number | null` is expected, i.e. slate/pitch id args. Registered live `worker-integrated.ts:3763-3814`. Signal `sig-2026-06-25-005`.

### Fix
1. These are id values arriving as strings (from path/query params) and passed to functions expecting numeric ids. Parse to number once at the boundary (guarding NaN → 400/null) and pass the numeric value through, rather than casting at each of the 8 call sites.
2. If a shared helper already coerces ids elsewhere in the worker, reuse it for consistency.

### Constraints
- Scope the change to the file(s) named above. Do **not** silence the checker with `any`, `as` casts, or `@ts-ignore` — fix the actual type mismatch.
- Do not touch PROTECTED parked paths (`src/workflows/`, crawl4ai/console-analysis — #60/#61).

### Done When
- [ ] `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error(s) gone **and introduces no new errors** (diff the before/after error counts — the worker has no CI type-check, so this gate is the only safety net)
- [ ] `npm run build:worker` still bundles clean
