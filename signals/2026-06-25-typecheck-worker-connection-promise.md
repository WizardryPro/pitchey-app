---
id: sig-2026-06-25-001
date: 2026-06-25
severity: medium
source: audit-type-errors
status: confirmed
---

**Finding:** src/db/connection.ts:54 — TS2322: 'unknown' not assignable to 'Promise<unknown>' (live DB connection helper).

**Evidence:**
```
src/db/connection.ts(54,32): error TS2322: Type 'unknown' is not assignable to type 'Promise<unknown>'.
```
(worker type-check: `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` — CI never runs this; worker is esbuild-bundled with no type-check.)

**Verifier verdict:** real finding — imported by live handlers (collaborator/creator-value/promo-codes) via worker-integrated.ts.

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run)
