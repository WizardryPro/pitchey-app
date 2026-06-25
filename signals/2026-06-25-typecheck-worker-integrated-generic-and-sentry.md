---
id: sig-2026-06-25-008
date: 2026-06-25
severity: high
source: audit-type-errors
status: confirmed
---

**Finding:** src/worker-integrated.ts — 5× errors in the worker entry itself: generic-T property access (title_image/thumbnail_url/titleImage/thumbnailUrl lines 327-330) + Sentry CloudflareOptions mismatch line 22244.

**Evidence:**
```
src/worker-integrated.ts(327-330): error TS2339: Property 'title_image'/... does not exist on type 'T'.
src/worker-integrated.ts(22244,3): error TS2345: ... not assignable to '(env: unknown) => CloudflareOptions'.
```
(worker type-check: `./frontend/node_modules/.bin/tsc --noEmit -p tsconfig.json` — CI never runs this; worker is esbuild-bundled with no type-check.)

**Verifier verdict:** real finding — this file IS the worker (wrangler.toml main); errors are on the live request handler.

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run)
