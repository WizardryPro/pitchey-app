---
id: sig-2026-06-25-004
date: 2026-06-25
severity: low
source: audit-type-errors
status: confirmed
---

**Finding:** src/handlers/promo-codes.ts:335 — TS2322: string assigned where number expected (template metadata).

**Evidence:**
```
src/handlers/promo-codes.ts(335,9): error TS2322: Type 'string' is not assignable to type 'number'.
```
(worker type-check: `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` — CI never runs this; worker is esbuild-bundled with no type-check.)

**Verifier verdict:** real finding — registered in worker-integrated.ts:3833-3842 (live); low-impact, non-critical path.

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run)
