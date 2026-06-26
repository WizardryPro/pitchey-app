---
id: sig-2026-06-25-003
date: 2026-06-25
severity: medium
source: audit-type-errors
status: confirmed
---

**Finding:** src/handlers/creator-value.ts:133 — TS2352: unsound null→string cast on a live endpoint.

**Evidence:**
```
src/handlers/creator-value.ts(133,16): error TS2352: Conversion of type 'null' to type 'string' may be a mistake.
```
(worker type-check: `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` — CI never runs this; worker is esbuild-bundled with no type-check.)

**Verifier verdict:** real finding — registered in worker-integrated.ts:3636 (live).

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run)
