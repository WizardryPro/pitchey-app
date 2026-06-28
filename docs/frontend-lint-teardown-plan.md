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
| A2a | `src/lib/api.ts` — type `transformPitchData` **input** (`RawPitch`) + `safeParseJsonArray` | 101 | Low | ✅ done (PR #385) |
| A2b | `src/lib/api.ts` — axios response-envelope typing (`api.get<{...}>` per endpoint) | ~98 | Low–Med | |
| A3 | feature services: `nda.service` (177), `investment.service` (95), `pitch.service` (93) — **type inputs, keep returns loose** (see B0 caveat) | 365 | Med | |
| A4 | remaining services: `apiServices.ts` (88), `ui-actions` (57), `slate` (28), `user` (14), `content` (16) | ~203 | Low–Med | |

### B — shared types + contexts (high blast radius — fix consumers in the same PR)
| Target | Errors | Note |
|---|---|---|
| **B0 — `Pitch`/core type-tree unification** (scoped below) | gates the page cascade | **prerequisite** for tightening any service/transform *return* type |
| `src/shared/types/index.ts` (60) + `src/shared/types/api.ts` (18) | 78 | `any`-typed definitions; tightening forces consumer fixes |
| `WebSocketContext.tsx` (150) + `PollingContext.tsx` (64) | 214 | type the WS/poll message payloads |

#### B0 — `Pitch` / core type-tree unification (scoped 2026-06-28)

Discovered while doing A2: tightening a service/transform **return** type to `Pitch`
cascades because **there is no single `Pitch` type** — there are many, and they *conflict*.

**Inventory (measured):** **21 `Pitch` definitions** — 3 exported "library" types
(`shared/types/index.ts`, `shared/types/api.ts`, `lib/api.ts`) + **18 local ad-hoc
`interface Pitch`** in pages/components. Siblings duplicated too: **NDA ×8, Investment ×7,
User ×6, Creator ×5, Deal ×3**.

**They conflict (not clean subsets):**
| Field | Variants seen |
|---|---|
| `id` / `userId` | `number` (most) vs **`string`** (`CreatorPitchView.tsx`) |
| `status` | `'draft'\|'published'\|'under_review'\|'archived'` vs `'draft'\|'published'\|'in_review'\|'optioned'\|'produced'` vs `'published'\|'draft'` vs `string` |
| `genre` | `string` vs union-literal vs `PitchGenre` |
| `budget` | `any` vs `string` |
| `likes` | `any[]` vs `Like[]` vs `number` (count) |

**Canonical pick:** `shared/types/index.ts` — it self-declares *"Single source of truth …
consolidates all interface definitions to prevent duplication"* and uses named sub-types
(`PitchGenre`, `PitchStatus`, `Like[]`). Irony: it's the **least imported** (3 files);
de-facto usage leaders are `features/pitches/services/pitch.service.ts` (**35 importers**)
and `lib/api.ts` (**20**).

**Plan:**
- **B0.1 reconcile** a canonical superset `Pitch` in `shared/types/index.ts`: widen
  `status` to cover every observed variant (or `PitchStatus` enum + a `productionStage`
  field for `optioned`/`produced`), keep `id`/`userId` as **`number`** (the `string`
  variants are drift — consistent with the backend number-id decision), pick real types
  for `budget`/`likes`. No consumer changes yet.
- **B0.2 collapse the 3 library types** → re-export the canonical from `lib/api.ts` and
  `shared/types/api.ts` (or repoint their importers), one at a time.
- **B0.3..n migrate consumers** cluster by cluster (portfolio components → browse → pitch
  services → the 3 pitch-view pages → admin), replacing each local `interface Pitch` with
  `import type { Pitch }` and fixing the conflicts each surfaces. One cluster per PR.
- Apply the same to **NDA / Investment / User / Creator** after `Pitch`.

**Effort: LARGE — ~8–12 PRs, HIGH risk** (35+ importer files; real type conflicts, not
just dedup). This is the **gate** for the page-level `any`-complex cascade (workstream D and
most `no-unsafe-*` in pages). Do it **after** the low-risk, non-dependent wins (A3 input
typing, C1 promises, C2/C3 mechanical, A2b).

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
**A3 → C1 → C3 → C2 → A2b → B0 (canonical reconcile) → B0.x (migrate) → B(contexts) → re-measure → D-tail.**

(Revised 2026-06-28 after the A2 discovery.) Do the **non-dependent, low-risk** wins first —
A3 (input typing, same safe pattern as A1/A2a), C1 (promises = hardening), C3/C2 (mechanical),
A2b (axios envelopes). These need **no** type-tree unification. Then tackle **B0** (the
`Pitch`/core unification) which is the gate that lets *return* types tighten and collapses the
page-level cascade. Do **D** last, after re-measuring how much B0 already cleared.

**Amended A-rule:** on boundary code, type the **input/param** (zero cascade) and keep the
**return loose** until B0 lands. A1/A2a followed this; A3/A4 should too.

**Effort:** realistically 15–25 PRs / several sessions to reach ~0. But the gate already
stops regressions today, so this can proceed opportunistically — every slice is an
independent, shippable win, and the ratchet locks each one.

## Tracking
Slice status lives in the memory note `project_frontend_lint_teardown` and (if opened) the
GitHub tracking issue. Update the gate `BASELINE` comment with the slice number + delta on
every merge.
