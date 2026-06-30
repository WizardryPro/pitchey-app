# R11 — Public investor-thesis rendering endpoint + creator-facing matching UI

**Action:** execute

---

You are working in the Pitchey repo (`/home/supremeisbeing/pitcheymovie/pitchey_v0.2`). Stack: Cloudflare Worker with a single hand-rolled live router at `src/worker-integrated.ts` (raw SQL via `@neondatabase/serverless`, NO ORM); React 18 + Vite + Zustand frontend under `frontend/src`; Neon Postgres; Stripe live; Sentry/Axiom observability. Migrations are numbered `NNN_*.sql` in `src/db/migrations/` with `IF NOT EXISTS` patterns, applied via `scripts/migrate.mjs` + the `schema_migrations` table.

GOAL (moat #7 phase-2): Investors can already publish structured thesis data and the pitch↔investor matching/notify backend is LIVE (PRs #371-375). What is MISSING is the *public read surface*: there is no endpoint that serves an investor's thesis to creators/anon, and the creator-facing rendering of matching investors is unverified/incomplete. The `investor_thesis.is_public` flag exists but is unused. Close this gap so investors publish intent and creators can see it — which drives organic NDA requests (the moat-native action).

=== PHASE 0 — PRE-FLIGHT (do this first, report findings before writing any code) ===
Do NOT assume the premise. Verify the current state with grep/read, then summarize what you found:

1. Confirm the investor-thesis backend exists and its schema:
   - `grep -rn "investor_thesis" src/` and read the migration that creates it (look for the `investor_thesis` table, its columns, and `is_public`). Note the EXACT column names — especially anything sensitive like `check_size`, `budget`, `min_check`, `max_check`, fund name, etc. This is gate G1.
   - `grep -rn "/api/investor/thesis" src/worker-integrated.ts` — find the existing GET/PUT thesis routes (the owner-private read/write path). Read those handlers to reuse their query shape and column list.

2. Confirm the matching backend is live (R5 dependency, gate G2):
   - `grep -rn "matching-investors" src/worker-integrated.ts` — confirm `GET /api/pitches/:id/matching-investors` is registered and read its handler. Note its exact response shape (field names) so the frontend renders the real fields.
   - Confirm `investor_thesis` is actually POPULATED in prod before building UI on top of it. If you have Neon MCP / psql access, run `SELECT count(*), count(*) FILTER (WHERE is_public) FROM investor_thesis;`. If you cannot reach prod, state that explicitly and proceed but flag G2 as "needs manual confirmation".

3. Confirm the frontend pieces:
   - `grep -rn "matching-investors\|matchingInvestors\|InvestorThesis" frontend/src/` — does any component already fetch/render matching investors? Is there a partial `InvestorThesisView`? Read `CreatorPitchView` (find it: `grep -rln "CreatorPitchView" frontend/src/`).
   - Identify the investor public profile page component (the page a creator lands on when viewing an investor).

4. Read the lines the roadmap flagged: `src/worker-integrated.ts` around lines 3636-3652 (publicEndpoints registration / route area) to understand how public routes are added.

REPORT the above findings (especially the thesis column list and which fields are sensitive vs. opt-in-public) before proceeding to Phase 1.

=== PHASE 1 — BACKEND: public thesis endpoint ===
Add `GET /api/users/:id/thesis` (public read). Requirements:
- Gate on `is_public = true`. If the row doesn't exist or `is_public` is false, return 404 (do NOT leak existence/non-existence beyond a plain not-found).
- SELECT ONLY the columns the investor opted to publish. Concretely: NEVER return raw `check_size` / `budget` / financial bounds unless the schema has an explicit per-field publish flag OR the product intent is that publishing makes the whole structured thesis public. If unsure, default to the SAFE subset (fund name, thesis statement, preferred genres/formats/stages — the taxonomy fields reused from the pitch taxonomy) and EXCLUDE financials. State your choice in the PR description. This is gate G1.
- Reuse the existing thesis query module / column list from the owner-private GET handler rather than re-deriving SQL. Use `sql.query(text, params)` form (Neon cannot compose nested `sql\`\`` fragments — known gotcha).
- Register the route in `src/worker-integrated.ts` next to the existing thesis routes, AND add it to the `publicEndpoints` allowlist (around the area you read in Phase 0). CRITICAL: the publicEndpoints entry must have NO trailing slash (documented gotcha — a trailing slash silently breaks the bypass). This is gate G3.
- Error handling: do NOT use silent `.catch(() => default)`. On a real DB error, let it surface (the catch-swallow gate runs `--include-worker --threshold 0`). Use the project pattern in catch blocks: `const e = err instanceof Error ? err : new Error(String(err))`.

=== PHASE 2 — FRONTEND: creator-facing matching cards ===
On the creator pitch view (`CreatorPitchView`), render an "Investors matching your pitch" section that fetches `GET /api/pitches/:id/matching-investors` and renders one card per matching investor using the REAL response field names you confirmed in Phase 0. Each card links to the investor's public thesis/profile. Use `credentials: 'include'` on the fetch (project convention) and the existing api-client. Handle empty state ("No matching investors yet") and loading. Use defensive utils (`safeArray`, `safeAccess`) per project convention.

=== PHASE 3 — FRONTEND: public thesis view ===
Add/complete an `InvestorThesisView` component that renders the public thesis (from `GET /api/users/:id/thesis`) on the investor public profile page. Show fund name, thesis statement, and the published taxonomy fields. If the thesis is not public / not found, render nothing or a neutral empty state — never an error toast for a normal not-public case.

Match existing visual conventions (Tailwind, portal brand colors — investor is indigo-violet `#5B4FC7`, NOT green; canonical tokens are `brand.portal-*` in `tailwind.config.js`).

=== VERIFICATION GATES (all must pass before opening/merging the PR) ===
G1 — Privacy: The public endpoint returns ONLY `is_public=true` theses, and returns 404 (not 403/empty-with-detail) for private/missing ones. It does NOT expose `check_size`/budget/financial bounds beyond what the investor explicitly opted to publish. Prove with: the SELECT column list in the handler + a curl/test against a private vs public thesis id showing 404 vs the safe subset.
G2 — Dependency on R5: Confirm `GET /api/pitches/:id/matching-investors` is live AND `investor_thesis` has ≥1 public row in prod (or explicitly flag as needing manual confirmation if prod is unreachable). Do not ship creator UI that renders against an empty/non-existent backend.
G3 — publicEndpoints entry has NO trailing slash; verify by hitting the endpoint logged-out and confirming it does NOT return 401 from `validateAuth`.
G4 — Type checks pass: worker (`npx tsc --noEmit` on the root tsconfig) and frontend (`cd frontend && npx tsc --noEmit -p tsconfig.app.json`). The worker is NOT type-checked in CI by default, so run it manually.
G5 — No swallowed errors introduced: new code has no untagged `.catch(() => default)`; DB errors propagate.

When done: report the exact files changed (absolute paths), the migration number if you added one (likely none — schema already exists), the chosen public-field subset, and the curl commands proving G1/G3. Do not commit or push unless asked; show me the diff first.
