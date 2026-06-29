# R14 — NDA lifecycle hardening: expiration enforcement + request rate-limit

**Action:** execute

---

You are working in the Pitchey repo (Cloudflare Worker backend, live router at `src/worker-integrated.ts`; raw SQL via `@neondatabase/serverless`, no ORM; Neon Postgres; migrations are numbered `NNN_*.sql` applied via `scripts/migrate.mjs` + the `schema_migrations` table). Stripe is LIVE — do NOT touch the credit-charge logic.

## Goal
Harden the NDA lifecycle in two ways, both additive:
1. **Expiration enforcement** — `ndas.expires_at` is stored but the NDA access gate in `getPitch` never checks it, so an expired NDA still grants access to gated documents (pitch deck / script / trailer). Add an expiry clause to the gate. NULL `expires_at` = non-expiring (must keep granting access).
2. **Request rate-limit** — `requestNDA` has no per-user rate limit, so a user can spam 10-credit NDA-request charges. Add a per-user rate limit as additive friction. **Do NOT remove, reduce, or bypass the 10-credit charge — that is a LOCKED product decision.**

This keeps the NDA-intent graph clean (no spam edges, accurate access state).

## Pre-flight (do these first, before editing)
1. Confirm the live router is `src/worker-integrated.ts` (`grep -n 'main = ' wrangler.toml` → expect `src/worker-integrated.ts`).
2. There are TWO `getPitch`-style access gates in `worker-integrated.ts`. Locate both and read them fully:
   - Gate A around **line 6167–6230** (`let hasNDAAccess = false;` then an `ndaCheck`/`sessions`-style block ending `hasNDAAccess = ndaCheck.length > 0;`).
   - Gate B around **line 6494–6554** (`let hasNDAAccess = false;` then a `signer_id` branch ~6524, a `user_id` fallback branch ~6534, and a `pitch_access` branch ~6545).
   Run: `grep -n 'hasNDAAccess' src/worker-integrated.ts` to get current line numbers (they drift).
3. In Gate B, confirm the **`pitch_access` branch already** has `(expires_at IS NULL OR expires_at > NOW())` — that is the exact pattern to mirror onto the `ndas` branches. The `ndas` `signer_id` and `user_id` branches do NOT have it.
4. Locate `requestNDA`: `grep -n 'private async requestNDA' src/worker-integrated.ts` (currently ~line 8655). Read it. Note it calls `this.requireAuth(request, Permission.NDA_REQUEST)` first, then validates the pitch, dedups against `ndas`, checks credit balance (10 credits), and inserts.
5. Inventory existing rate-limit helpers and pick ONE to reuse — do NOT write a new strategy:
   - `grep -n 'rateLimiters\|getRateLimiter\|applyRateLimit\|RateLimiter\|checkLimit' src/worker-integrated.ts`
   - Note the Redis-backed pattern already used in this file: `const { RateLimiter, RATE_LIMIT_CONFIGS, applyRateLimit } = await import('./utils/rate-limiter');` then `new RateLimiter(this.redis)` and `applyRateLimit(request, rateLimiter, '<config>')` (see ~line 12434). Also `rateLimiters.login.checkLimit(clientIP)` at ~line 1896 and `getRateLimiter()`/`createRateLimitMiddleware` at ~line 4370. Read `src/utils/rate-limiter.ts` to see `RateLimiter.checkLimit(identifier, config)` returns a result object — prefer a **per-user identifier** (`authResult.user.id`), NOT per-IP, since the abuse vector is a logged-in user spamming charges.

## Implementation

### Part 1 — Expiration enforcement (access gate)
In BOTH Gate A and Gate B, for every branch that reads from the `ndas` table to set `hasNDAAccess = true`, add the expiry clause so expired NDAs no longer grant access:
- Add `AND (expires_at IS NULL OR expires_at > NOW())` to each `ndas` SELECT in the gate (the `signer_id` branch and the `user_id` fallback branch in Gate B, and the equivalent `ndas`-reading branch in Gate A).
- Keep each branch wrapped in its existing `try { … } catch { /* column may not exist in all envs */ }` so older envs missing the column can't 500 the pitch view. (If `expires_at` is referenced and the column is absent, the catch already swallows it — verify the fallback chain still resolves; see G3.)
- Do NOT alter the `pitch_access` branch (already correct).
- Mirror the EXACT clause already present in the `pitch_access` branch for consistency: `(expires_at IS NULL OR expires_at > NOW())`.
- After editing, re-grep to confirm no `ndas`-reading access-grant branch in `getPitch` is left without the expiry clause: `grep -n 'FROM ndas' src/worker-integrated.ts` and inspect each that feeds `hasNDAAccess`.

Note: this is gate logic only — no migration needed (the column already exists). If you find `expires_at` does NOT exist on `ndas` in the live schema, STOP and report (the premise would be wrong); do not invent a migration without confirming via `grep -rn 'expires_at' src/db/migrations/ | grep -i nda` and the `ndas` table schema.

### Part 2 — Request rate-limit (requestNDA)
In `requestNDA`, AFTER the `requireAuth` success and BEFORE the credit-balance check / insert, add a per-user rate-limit gate:
- Reuse the existing Redis-backed `RateLimiter` pattern already used in this file (dynamic import of `./utils/rate-limiter`, `new RateLimiter(this.redis)`).
- Identifier: `` `nda-request:${authResult.user.id}` `` (per-user, not per-IP).
- Choose a sensible window/limit appropriate for a 10-credit action — e.g. max ~5 NDA requests per hour per user. If `RATE_LIMIT_CONFIGS` has a suitable existing config, use it; otherwise pass an explicit `{ windowMs, maxRequests }` via the helper's custom path. Do NOT add a brand-new exported strategy to the rate-limit module unless none can be reused.
- On limit exceeded, return a 429 using the existing `ApiResponseBuilder` (`builder.error(...)`) with a clear message like "Too many NDA requests. Please try again later." Match the error-response shape already used in this handler.
- The 10-credit charge logic stays exactly as-is. The rate-limit is a gate placed BEFORE any credit deduction so a rejected request neither charges nor inserts.
- Wrap the rate-limit call defensively: if Redis is unavailable, fail OPEN (allow the request) rather than 500 — match how other rate-limit call sites in this file degrade. Do NOT silently swallow in a way that hides real errors; log via the existing logger if other call sites do.

## Verification gates (ALL must pass before opening/merging the PR)
- **G1 — Expiry enforced, NULL preserved:** Every `ndas`-reading branch in both getPitch gates that sets `hasNDAAccess` includes `(expires_at IS NULL OR expires_at > NOW())`. Confirm by grep + manual read. A signed NDA with `expires_at = NULL` STILL grants access (NULL = non-expiring); a signed NDA with `expires_at` in the past does NOT. Verify with a Neon branch test if possible: `mcp__neon__create_branch` → insert a signed NDA with past `expires_at` and one with NULL → run the gate's SELECTs → expired returns 0 rows, NULL returns 1 row. Do NOT run against prod main.
- **G2 — Credit charge untouched:** `git diff` shows ZERO changes to the `ndaCreditCost = 10`, the balance check, the deduction, or any credit/Stripe path. The rate-limit is purely additive and sits before the charge. Confirm: `git diff src/worker-integrated.ts | grep -i 'credit\|10'` shows no semantic change to charge logic.
- **G3 — Fallback chain intact:** The access-gate fallback order (signer_id → user_id → pitch_access → company-team/collaboration) still resolves after adding the expiry clause; each branch remains inside its own try/catch so a missing `expires_at` column in an older env cannot 500 the pitch view. Manually trace that an early `hasNDAAccess = true` still short-circuits later branches (the `if (!hasNDAAccess)` guards must remain).
- **G4 — Rate-limit is per-user and fails open:** Identifier is keyed to `authResult.user.id`. Redis-unavailable path allows the request (no 500). A 6th request within the window returns 429 with the builder error shape; the 1st–5th succeed (or whatever limit you chose — state it in the PR description).
- **G5 — Type check passes:** `npx tsc --noEmit` against the worker tsconfig (root `tsconfig.json`) is clean for the edited file. (Note: the worker is not type-checked in CI, so this is a manual gate — run it.)
- **G6 — Catch-swallow discipline:** Any new `.catch`/try-catch you add complies with the repo's catch-swallow gate (`scripts/catch-swallow-gate.mjs --include-worker --threshold 0`). A fire-and-forget Redis-degradation catch must be tagged `// fire-and-forget` on the prior line if it intentionally swallows; an error the user is told "succeeded" must NOT be swallowed.

## Deliverable
- Edits to `src/worker-integrated.ts` only (unless G1's Neon test reveals the column is missing, in which case STOP and report rather than adding a migration unprompted).
- A branch (do not commit to `main`), then a PR. PR body must: state the chosen rate-limit window/limit, list G1–G6 results, and confirm the 10-credit charge is untouched.
- End the commit message with:
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

Depends on R10 — if R10 (whatever it scoped for the NDA layer) is not yet merged, check for conflicts in the same gate region before editing.
