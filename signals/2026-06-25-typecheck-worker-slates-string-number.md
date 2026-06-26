---
id: sig-2026-06-25-005
date: 2026-06-25
severity: medium
source: audit-type-errors
status: confirmed
---

**Finding:** src/handlers/slates.ts — 8× TS2345: string|null passed where number|null expected (id args to live /api/slates/*).

**Evidence:**
```
src/handlers/slates.ts(56,33) +7: error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
```
(worker type-check: `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` — CI never runs this; worker is esbuild-bundled with no type-check.)

**Verifier verdict:** real finding — registered in worker-integrated.ts:3763-3814 (live slate endpoints).

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run)
