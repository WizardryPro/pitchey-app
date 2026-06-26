---
id: prompt-2026-06-25-002
date: 2026-06-25
source_signal: sig-2026-06-25-002
signal_status: confirmed
band: 1
gates: optional
action: execute
---

> Target stack: Cloudflare Worker — hand-rolled `RouteRegistry` in `src/worker-integrated.ts` (no framework) · Neon Postgres via `@neondatabase/serverless` + `postgres` driver, **raw SQL only** · custom `pitchey-session` auth · **the worker is esbuild-bundled and NOT type-checked in CI** (resolved from STACK.md)

## Task: Fix 7× TS7006 implicit-any params in `src/handlers/collaborator.ts`

### Context
`type-lint-audit` confirmed 7 `TS7006 implicit-any` errors in `src/handlers/collaborator.ts` (params `c` at 211/486/504/505/506/551 and `a` at 877) — registered live at `worker-integrated.ts:3429-3482`. Signal `sig-2026-06-25-002`.

### Fix
1. For each cited line, give the callback parameter an explicit type. These are almost certainly array-callback params (`.map`/`.filter`/`.find`/`.sort`) over query rows — type them from the row shape the query returns, not `any`.
2. Prefer a small shared row interface if the same shape repeats, rather than repeating an inline type 7 times.

### Constraints
- Scope the change to the file(s) named above. Do **not** silence the checker with `any`, `as` casts, or `@ts-ignore` — fix the actual type mismatch.
- Do not touch PROTECTED parked paths (`src/workflows/`, crawl4ai/console-analysis — #60/#61).

### Done When
- [ ] `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` shows the cited error(s) gone **and introduces no new errors** (diff the before/after error counts — the worker has no CI type-check, so this gate is the only safety net)
- [ ] `npm run build:worker` still bundles clean
