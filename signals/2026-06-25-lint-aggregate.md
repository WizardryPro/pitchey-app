---
id: sig-2026-06-25-010
date: 2026-06-25
severity: low
source: audit-type-errors
status: confirmed
---

**Finding:** Frontend ESLint reports **9088 problems (8904 errors, 184 warnings)** — lint is effectively unenforced on `frontend/`. Aggregate trend signal, not per-hit. (Worker has no ESLint config; lint is frontend-only.)

**Evidence:**
```
✖ 9088 problems (8904 errors, 184 warnings)   [cd frontend && node_modules/.bin/eslint .]
Top rules by frequency:
  3266  @typescript-eslint/no-unsafe-member-access
  1604  @typescript-eslint/no-unsafe-assignment
  1148  @typescript-eslint/no-explicit-any
   948  @typescript-eslint/no-unused-vars
   582  @typescript-eslint/no-misused-promises
```

**Verifier verdict:** real finding (count is a measured fact; no per-line verification needed) — the volume (dominated by no-unsafe-* on untyped `any`) is a trend to watch, not a single fixable item.

## Timeline
- 2026-06-25 — first seen (manual harness bootstrap run): 9088 problems
- 2026-06-26 — still present (automated nightly run): 9086 problems (8902 errors, 184 warnings) — down 2 from baseline; top rules unchanged (no-unsafe-member-access 3266, no-unsafe-assignment 1604, no-explicit-any 1148).
- 2026-06-27 — still present (automated nightly run): 9090 problems (8906 errors, 184 warnings) — up +4 from yesterday; consistent with new code added in moat-feature PRs (#372/#373/#374/#375). Top rules: no-unsafe-member-access 3266, no-unsafe-assignment 1605, no-explicit-any 1150, no-unused-vars 948, no-misused-promises 582.
