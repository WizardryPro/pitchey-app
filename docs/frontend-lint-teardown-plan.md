# Frontend ESLint Teardown Plan

**Created:** 2026-06-28 · **Baseline at planning:** 8837 errors / 184 warnings (after slice 1)

The frontend ESLint debt is gated by a one-way ratchet (`scripts/frontend-lint-gate.mjs`,
the twin of `scripts/worker-typecheck-gate.mjs`). The number can only go down: any PR that
adds a lint error fails CI. This document scopes the path from 8837 → ~0.

> **Cadence (every slice):** fix → `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
> clean → run the touched-area vitest → **lower `BASELINE` in `scripts/frontend-lint-gate.mjs`
> in the same PR** → merge. One verifiable slice per PR. Multi-session by design.

> **Hard rule:** do not silence with `any`/`as`/`@ts-ignore`, and do **not** downgrade rule
> severity to drop the count — that is hiding debt, not fixing it (the #20 laundering shape).

## The error population (measured 2026-06-28 on main)

| Bucket | Count | Nature |
|---|---|---|
| `any` / `no-unsafe-*` complex | 6740 (76%) | Root-caused at the API boundary; **cascades** to consumers |
| `no-misused-promises` + `no-floating-promises` | 989 (11%) | Cross-cutting; **real hardening value** (a floating rejection is the silent-breakage class) |
| `no-unused-vars` | 947 (11%) | Mechanical dead-code removal |
| Small rules (`no-undef` 71, `require-await` 36, `no-case-declarations` 15, `import/no-duplicates` 8, `no-empty` 7, `no-useless-escape` 4, `no-async-promise-executor` 1, misc) | ~161 | Quick mechanical wins |

By rule (top): `no-unsafe-member-access` 3238, `no-unsafe-assignment` 1605,
`no-explicit-any` 1122, `no-unused-vars` 947, `no-misused-promises` 582,
`no-unsafe-argument` 445, `no-floating-promises` 407, `no-unsafe-call` 193,
`no-unsafe-return` 137.

By directory: `src/portals` 2654, `src/pages` 2352, `src/features` 2206,
`src/shared` 458, `src/components` 362, `src/lib` 357, `src/services` 121, `src/store` 71.

**Concentration:** 362 files have errors; top 50 = 55%, top 100 = 77%. But the big
page-level counts are **downstream** — they read `any` out of untyped service/API responses.
Proof: `nda.service.ts` (177 errors) is 100% `no-unsafe-*` with *zero* `no-explicit-any` —
the `any` flows in from untyped API calls. **So typing the boundary cascade-clears the pages.**

## The root-cause pattern (and the masked-bug gotcha)

`apiClient.get<{X: T}>()` returns `TypedApiResponse<{X:T}>` with `data?: T` already typed
(`src/lib/api-client.ts:62`). The debt comes from two shapes:

1. **Unnecessary casts** — `(response.data as any)?.X` generates BOTH `no-explicit-any` and
   the downstream `no-unsafe-member-access`. Fix: delete the cast → `response.data?.X`
   (TS narrows correctly after the `!response.data?.X` guard).
2. **Untyped reads** — a service calls `apiClient.get(...)` with no generic (or reads a raw
   `any`), then accesses members → pure `no-unsafe-*`. Fix: supply the response generic /
   declare the row type, then access typed.

⚠️ **Masked-bug gotcha:** double-wrapped generics `get<ApiResponse<{X}>>` type `response.data`
one level too deep; the `as any` hides it. Unwrap to `get<{X}>`. (A real, previously-hidden
stats-access bug was found this way in slice 1.) Removing a file's casts often orphans a local
`ApiResponse` interface → delete it too (else a new `no-unused-vars`).

## Workstreams & sequence

### A — API / service boundary typing (root of the `any`-complex)
Each slice clears the file **and** cascade-clears downstream consumers.

| Slice | Target | Direct errors | Risk | Status |
|---|---|---|---|---|
| A1 | team + collaboration services | 71 | — | ✅ done (PR #382) |
| A2 | `src/lib/api.ts` — type `transformPitchData(pitch: any): any`, `safeParseJsonArray`, Pitch `any`-fields | 199 + cascade | Med (shared transform) | next |
| A3 | feature services: `nda.service` (177), `investment.service` (95), `pitch.service` (93) | 365 + cascade | Med | |
| A4 | remaining services: `apiServices.ts` (88), `ui-actions` (57), `slate` (28), `user` (14), `content` (16) | ~203 | Low–Med | |

### B — shared types + contexts (high blast radius — fix consumers in the same PR)
| Target | Errors | Note |
|---|---|---|
| `src/shared/types/index.ts` (60) + `src/shared/types/api.ts` (18) | 78 | `any`-typed definitions; tightening forces consumer fixes |
| `WebSocketContext.tsx` (150) + `PollingContext.tsx` (64) | 214 | type the WS/poll message payloads |

### C — cross-cutting mechanical (independent of A/B; parallelizable)
| Slice | Rule(s) | Errors | Risk |
|---|---|---|---|
| C1 | `no-floating-promises` + `no-misused-promises` | 989 | Med — **do for hardening**, not cosmetics |
| C2 | `no-unused-vars` | 947 | Low — watch side-effect-only imports |
| C3 | small rules (no-undef, require-await, case-decl, dup-imports, no-empty, …) | ~161 | Low — one fast PR |

### D — page / portal residue
The bulk of the 6740 lives in pages/portals (ProductionDashboard 342, Following 261,
PitchDetail 144, InvestorWallet 144, …), but most of it is **downstream of A+B** and will
evaporate as the boundary gets typed. Do per-page cleanup only on what remains after A+B land.
This is the long, low-value cosmetic tail.

## Recommended order & rationale
**A2 → A3 → C1 → C3 → C2 → B → re-measure → D-tail.**

Value is front-loaded: the API layer (A2/A3) plus the promise slice (C1) deliver the most
*risk reduction* per PR. The page-residue tail (D) is mostly cosmetic and should be done last,
after re-measuring how much A+B already cleared.

**Effort:** realistically 15–25 PRs / several sessions to reach ~0. But the gate already
stops regressions today, so this can proceed opportunistically — every slice is an
independent, shippable win, and the ratchet locks each one.

## Tracking
Slice status lives in the memory note `project_frontend_lint_teardown` and (if opened) the
GitHub tracking issue. Update the gate `BASELINE` comment with the slice number + delta on
every merge.
