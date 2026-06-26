---
id: prompt-2026-06-25-003
date: 2026-06-25
source_signal: sig-2026-06-25-003
signal_status: confirmed
band: 1
gates: optional
action: execute
---

> Target stack: Cloudflare Worker — hand-rolled `RouteRegistry` in `src/worker-integrated.ts` (no framework) · Neon Postgres via `@neondatabase/serverless` + `postgres` driver, **raw SQL only** · custom `pitchey-session` auth · **the worker is esbuild-bundled and NOT type-checked in CI** (resolved from STACK.md)

## Task: Fix TS2352 null→string cast in `src/handlers/creator-value.ts:133`

### Context
`type-lint-audit` confirmed `TS2352` at `src/handlers/creator-value.ts:133` — an unsound `null → string` conversion on a live endpoint (registered `worker-integrated.ts:3636`). Signal `sig-2026-06-25-003`.

### Fix
1. Read line 133. The code casts a possibly-`null` value to `string`. Handle the null case explicitly (guard / default / early return) instead of asserting it away.

### Constraints
- Scope the change to the file(s) named above. Do **not** silence the checker with `any`, `as` casts, or `@ts-ignore` — fix the actual type mismatch.
- Do not touch PROTECTED parked paths (`src/workflows/`, crawl4ai/console-analysis — #60/#61).

### Done When
- [ ] `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error(s) gone **and introduces no new errors** (diff the before/after error counts — the worker has no CI type-check, so this gate is the only safety net)
- [ ] `npm run build:worker` still bundles clean
