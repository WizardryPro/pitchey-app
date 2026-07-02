---
id: sig-2026-06-25-007
date: 2026-06-25
severity: high
source: audit-type-errors
status: confirmed
---

**Finding:** src/services/worker-database.ts:137 — TS2322: 'unknown' not assignable to 'Promise<unknown>' in the core DB service used by all routes.

**Evidence:**
```
src/services/worker-database.ts(137,32): error TS2322: Type 'unknown' is not assignable to type 'Promise<unknown>'.
```
(worker type-check: `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` — CI never runs this; worker is esbuild-bundled with no type-check.)

**Verifier verdict:** real finding — imported worker-integrated.ts:219, instantiated :722/:845/:879 (core DB path).

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run)
- 2026-06-26 — resolved: no longer present in worker tsc output; fixed via PR #357 (fix/db-retry-proxy-promise-type).
