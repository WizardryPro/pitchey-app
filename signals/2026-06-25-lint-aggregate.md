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
- 2026-06-28 — still present (automated nightly run): 8465 problems (8281 errors, 184 warnings) — down 625 from yesterday's 9090. Genuine improvement: 4 lint-fix PRs merged 2026-06-28 via the teardown plan (#382 team/collab service slice-1, #385 A2a transformPitchData, #387 A3 nda/investment/pitch services, #388 C1a void-navigate). Ratchet gate BASELINE in `scripts/frontend-lint-gate.mjs` stepped 9090→8837→8736→8371→8283 in matching PRs; today's 8281 errors is 2 below the gate (pass). Top rules: no-unsafe-member-access 2937 (−329), no-unsafe-assignment 1460 (−145), no-explicit-any 1105 (−45), no-unused-vars 943 (−5), no-misused-promises 582 (unchanged). Parsing errors on `functions/` + `vite.config*.ts` files are pre-existing (not in tsconfig project scope). Verifier confirmed: genuine reduction, no config-masking or suppression; tsc-clean result genuine.
- 2026-06-29 — still present (automated nightly run): 7330 problems (7151 errors, 179 warnings) — down 1135 from yesterday's 8465. Genuine improvement: 9 lint-fix commits merged 2026-06-28/29 (C1a void-navigate −88, C1b-1 void bare promises −261, C1b-2 clear floating promises −58, C1c scope no-misused-promises −556, C1c-residual-1 wrap timer promises −15, A3 type feature-service boundaries −365, C3a disable no-undef for TS −87, C3b merge dup imports −12, C2a remove unused imports −143). Ratchet gate BASELINE stepped to 7151 (synchronized with count — exactly at gate, pass). Top rules: no-unsafe-member-access 2937 (unchanged), no-unsafe-assignment 1460 (unchanged), no-explicit-any 1105 (unchanged), no-unused-vars 800 (−143 from import cleanup), no-unsafe-argument 447. `no-misused-promises` dropped out of top-5 (−556 from C1c scoping). Verifier confirmed: genuine reduction; ESLint config clean (no new suppression/masking); all reductions traced to specific PRs.
- 2026-06-30 — still present (automated nightly run): 7330 problems (7151 errors, 179 warnings) — UNCHANGED from yesterday. Plateau day: today's commits (#402–#405, R6/R8/R13 resilience + reputation) were backend-only (worker-integrated.ts, src/handlers/, src/services/, test/integration/); the one frontend PR (#403 R8) added 5 files with zero eslint-disable directives. Ratchet gate BASELINE = 7151, today's errors = 7151 (pass). Top rules unchanged: no-unsafe-member-access 2937, no-unsafe-assignment 1460, no-explicit-any 1105, no-unused-vars 800, no-unsafe-argument 447. Verifier independently re-ran eslint and confirmed the count (genuine plateau, no masking or new suppression).
- 2026-07-01 — still present (automated nightly run): 7330 problems (7151 errors, 179 warnings) — UNCHANGED from yesterday. Second consecutive plateau day. Top rules unchanged: no-unsafe-member-access 2937, no-unsafe-assignment 1460, no-explicit-any 1105, no-unused-vars 800, no-unsafe-argument 447. Ratchet gate BASELINE = 7151, today = 7151 (pass). Verifier confirmed genuine plateau: both tsc outputs (worker + frontend) are 0-byte/0-line (clean), lint output verified independently at 7330 problems with no PROTECTED-path hits and no masking/suppression; consistent with no new frontend commits in window.
- 2026-07-02 — still present (automated nightly run): 7328 problems (7149 errors, 179 warnings) — down 2 from yesterday's 7330. Minor genuine improvement: commit #412 (`feat(pitches): human-readable slug URLs`) replaced 18 inline `` `/pitch/${pitch.id}` `` template literals with a typed `pitchUrl(pitch)` helper, eliminating 2 `no-unsafe-member-access` hits (`.id` on loosely-typed pitch objects). Top rules: no-unsafe-member-access 2935 (−2), no-unsafe-assignment 1459 (−1), no-explicit-any 1105 (unchanged), no-unused-vars 800 (unchanged), no-unsafe-argument 448 (+1). No masking or new eslint-disable lines; `frontend/eslint.config.js` unchanged since 2026-06-30. Ratchet gate BASELINE = 7151, today errors = 7149 (pass). Worker tsc 0 errors, frontend tsc 0 errors. Verifier confirmed: genuine-clean-run, delta traceable to specific commit, no suppression.
