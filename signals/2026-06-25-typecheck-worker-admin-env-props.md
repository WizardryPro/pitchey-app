---
id: sig-2026-06-25-009
date: 2026-06-25
severity: medium
source: audit-type-errors
status: confirmed
---

**Finding:** src/worker-modules/admin-endpoints.ts — 5× TS2339: Env type missing UPSTASH_REDIS_REST_URL/TOKEN, STRIPE_SECRET_KEY; affects /api/admin/* intercept handler.

**Evidence:**
```
src/worker-modules/admin-endpoints.ts(1769-1778): error TS2339: Property 'UPSTASH_REDIS_REST_URL'/'STRIPE_SECRET_KEY' does not exist on type 'Env'.
```
(worker type-check: `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` — CI never runs this; worker is esbuild-bundled with no type-check.)

**Verifier verdict:** real finding — imported worker-integrated.ts:368, instantiated :777 as this.adminHandler (live admin intercept).

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run)
