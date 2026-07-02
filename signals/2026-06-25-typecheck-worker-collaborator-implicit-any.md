---
id: sig-2026-06-25-002
date: 2026-06-25
severity: low
source: audit-type-errors
status: confirmed
---

**Finding:** src/handlers/collaborator.ts — 7× TS7006 implicit-any params ('c','a'); blocks strict, cosmetic.

**Evidence:**
```
src/handlers/collaborator.ts(211,38) +6: error TS7006: Parameter 'c'/'a' implicitly has an 'any' type.
```
(worker type-check: `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` — CI never runs this; worker is esbuild-bundled with no type-check.)

**Verifier verdict:** real finding — registered in worker-integrated.ts:3429-3482 (live collaboration handlers).

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run)
- 2026-06-26 — resolved: no longer present in worker tsc output; fixed via PR #359 (fix/trio-handler-type-errors).
