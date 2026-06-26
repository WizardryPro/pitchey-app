# STACK.md — Pitchey project profile

> Resolved by `oneshot-prompt-generator` (+ the roadmap/gate skills) when generating prompts.
> Prompt quality is bounded by this file. Verified against the live repo on 2026-06-25
> (package.json, wrangler.toml, src/CLAUDE.md, src/worker-integrated.ts) — not memory.
> Keep it honest; correct a line the moment reality drifts.

## Stack banner (the line every generated prompt carries)

> Target stack: Cloudflare Worker — single hand-rolled `RouteRegistry` (NOT Hono, NOT
> Express) in `src/worker-integrated.ts` · React 18 + Vite + Zustand + Tailwind on Cloudflare
> Pages · Neon PostgreSQL via `@neondatabase/serverless` + `postgres` driver, **raw SQL only
> (no ORM, Drizzle fully retired)** · **custom session auth** (`pitchey-session` UUID cookie +
> JWT bearer fallback — Better Auth was ripped 2026-05-04) · same-origin via Pages Functions
> proxy (`frontend/functions/api/[[path]].ts`)

## Commands (verified from package.json)

| Task | Command | Notes |
|---|---|---|
| Backend dev | `wrangler dev` (`npm run dev`) | Worker on local |
| Frontend dev | `cd frontend && npm run dev` | Vite, port 5173 |
| Frontend build | `cd frontend && npm run build` | Vite |
| Worker bundle | `npm run build:worker` | esbuild → `dist/worker.js`; doubles as a worker syntax/bundle check |
| Frontend type-check | `cd frontend && npm run type-check` | `tsc --noEmit -p tsconfig.app.json` — **the gate for any FE type fix** |
| Worker type-check | `npx tsc --noEmit -p tsconfig.json` | root tsconfig (strict). `typescript` is now a root devDep. esbuild (the deploy build) still doesn't type-check, so **CI gates this** via the ratchet `node scripts/worker-typecheck-gate.mjs` in the `⚡ Worker Tests` job — fails on any error count above the baseline. Lower the baseline in that script as errors are fixed. |
| Lint | `cd frontend && npm run lint` (`eslint .`) | **frontend only — no backend ESLint exists** |
| Test (backend) | `npm test` → `vitest --config vitest.backend.config.ts` | pure-logic ring around utils/lib |
| Test (integration) | `npm run test:integration` → `vitest.integration.config.ts` | real `worker.fetch()` vs throwaway Neon branch (`TEST_DATABASE_URL`) |
| Test (frontend) | `cd frontend && npx vitest run` | |
| Migrations | `npm run db:migrate[:status\|:check\|:baseline]` → `scripts/migrate.mjs` | tracked in `schema_migrations` (SHA-256, filename-keyed) |
| Deploy worker | `npx wrangler deploy` (from repo root) → `pitchey-api-prod` | |
| Deploy frontend | `cd frontend && npx wrangler pages deploy dist --project-name=pitchey --branch=main` | `--branch=main` makes it canonical, not a preview |
| Package manager | `npm` (no `packageManager` field; lockfile is `package-lock.json`) | |

## Architecture & directory semantics

- **Single Worker entry**: `src/worker-integrated.ts` (`wrangler.toml:8` `main = "src/worker-integrated.ts"`, ~22.5k lines, 705 routes). All API routing flows through one `RouteRegistry` class — routes are wired with `this.register('METHOD', '/api/path', handler.bind(this))` inside `registerRoutes()`. There is **no framework router**; "hono" in the tree is only comment text / unrelated strings, not a dependency.
- **Frontend**: React 18 + Vite + Zustand (3 stores) + TailwindCSS on Cloudflare Pages. Feature-grouped under `frontend/src/features/<feature>/` plus shared `frontend/src/components/`, `pages/`, `services/`, `stores/`.
- **Same-origin only**: frontend→API goes through the Pages Functions proxy at `frontend/functions/api/[[path]].ts` (it rewrites `SameSite=None`→`Lax` and strips `Domain`). Do NOT introduce direct cross-origin calls. All API calls use `credentials: 'include'`.
- **Backend service layout**: `src/handlers/`, `src/services/`, `src/routes/*.routes.ts`, `src/worker-modules/`, `src/middleware/`, `src/db/`, `src/auth/`.

## ⚠️ Orphan / parallel-handler reality (READ before any route or dead-code work)

Pitchey has accumulated multiple parallel handler trees across migrations (Era 0–6). **The live one is ONLY what `RouteRegistry.registerRoutes()` in `src/worker-integrated.ts` actually wires.** A handler file can look complete and be dead.

- **Orphan smell (documented in `src/CLAUDE.md`)**: the signature `(request: Request, env: any, authResult: any)` is the canonical marker of dead code. Live handlers are `async function fooHandler(request: Request, env: Env): Promise<Response>` and extract auth *inside* via `getUserId(request, env)` from `utils/auth-extract.ts`.
- **Dead-route detection here ≠ file-based routing.** "Orphan" = a handler/route file under `src/handlers/`, `src/routes/`, or `src/worker-modules/` that is never imported into `worker-integrated.ts` and has no `register('METHOD', '/path', ...)` referencing it. Pre-flight: `grep -rn "register.*<endpoint>" src/worker-integrated.ts` and `grep -rn "<HandlerName>" src/worker-integrated.ts` — zero hits = orphaned.
- **`/api/admin/*` gotcha**: every `/api/admin/*` request is intercepted by `AdminEndpointsHandler` (`worker-modules/admin-endpoints.ts`) BEFORE registered-route dispatch. A `register('GET','/api/admin/foo',…)` is **dead on arrival** unless its prefix is added to the exclusion list in `worker-integrated.ts` AND the handler enforces admin itself. Current exclusions: `metrics`, `health`, `promo-codes`, `verifications`, `heat-scores`, `subscription-grants`.
- **PROTECTED — never modify/import/delete** (decisions tracked in issues, not code): `src/workflows/` (#60), `src/workers/crawl4ai-worker.ts` + `src/services/console-analysis-crawler.ts` (#61). A dead-route sweep must **exclude** these — they are intentionally parked, not orphans to flag.

## Data layer

- **Neon PostgreSQL**, accessed via `@neondatabase/serverless` (HTTP) and the `postgres` driver (3.4.4). **Raw SQL only — no ORM.** Drizzle was fully retired (PR #14); zero first-party `drizzle-orm` imports remain. Schema is the source of truth.
- **Neon client call convention** (gotcha — wrong form throws at runtime):
  - ✅ tagged template: `` sql`SELECT * FROM users WHERE id = ${id}` ``
  - ✅ parameterized: `sql.query('SELECT * FROM users WHERE id = $1', [id])` — for dynamically-assembled queries; Neon **cannot compose nested `sql`` fragments**.
  - ❌ call-form `sql('SELECT $1', [id])` — throws.
- **Migrations**: numbered raw-SQL files in `src/db/migrations/` (`NNN_desc.sql`, `IF NOT EXISTS` patterns), applied by `scripts/migrate.mjs`, tracked in `schema_migrations`. A CI gate fails the deploy if any `.sql` is unrecorded. (Historical drift: numbering gaps 048–067, duplicate numbers — runner keys on filename, so this is bounded.)
- **Connection caveat**: Neon can hit a compute-time quota → HTTP 402 on every query (prod-down 2026-04-30 #65, 2026-06-22). Errors are often swallowed → marketplace silently empty.

## Auth (this is Pitchey's REAL auth — NOT Better Auth)

- **Custom session auth.** Cookie `pitchey-session` (UUID) keyed to a row in the legacy `sessions` table; `SameSite=None; Secure; HttpOnly; path=/; 30-day`. Login/register/logout inlined in `worker-integrated.ts` via `src/auth/session-store.ts` (raw SQL). JWT bearer tokens accepted as fallback in `src/auth/auth-adapter.ts:validateAuth` (used by `/api/users/profile`, `/api/users/settings`). WebSocket auth via `src/auth/legacy-session-handler.ts`.
- **Better Auth was ripped 2026-05-04 (issue #19); deps uninstalled 2026-06-05.** Remaining `better-auth-*`-named files are legacy-named raw-SQL shims, NOT the BA library. Do NOT reintroduce Better Auth or treat those filenames as a real BA integration. (The sibling repo this harness came from also removed BA — coincidence, not shared code.)
- Email OTP 2FA, passwordless login, rate limiting, Turnstile on login forms (gated by `TURNSTILE_ENABLED`, off in tests).

## Conventions & gotchas

- **Workers runtime — no Node APIs.** No `fs`/`path`/`process.env`; config/secrets/bindings come from `env` (the `Env` type). esbuild externalizes node builtins.
- TypeScript for all new code. `catch` idiom: `const e = err instanceof Error ? err : new Error(String(err))`.
- Defensive utils: `safeAccess`, `safeNumber`, `safeArray`; DB reads should prefer `src/db/safe-query.ts` (`safeQuery()` discriminated union) over silent `.catch(() => default)`.
- **Silent-error gate already exists**: `scripts/catch-swallow-gate.mjs --include-worker --threshold 0` — zero untagged `.catch(() => …)` across `src/`. A `// fire-and-forget` tag on anything the user is told "succeeded" is laundering. The harness's catch-swallow finder should reuse / defer to this gate, not reinvent a competing rule.
- snake_case DB columns; frontend normalizes. `credentials: 'include'` on all API calls.

## Observability

- **Sentry** (`@sentry/cloudflare` 8.x, `withSentry()`, 10% trace sampling) + **Axiom** (structured logs, `pitchey-logs` dataset, `AXIOM_TOKEN` — hard prod requirement, worker 503s without it). Worker + frontend share one Sentry project. Cloudflare Observability `[observability]` at 100% log sampling. Analytics Engine: 2 datasets (`ANALYTICS`, `PITCHEY_ANALYTICS`).
- Detect SQL drift live via Cloudflare Observability / `wrangler tail` for `relation "X" does not exist` / `column X.Y does not exist`.

## Deployment

- Cloudflare Pages + Workers via Wrangler; CI/CD via GitHub Actions (19 workflows). NO CF Git integration — all deploys are wrangler/ad-hoc (`deploy-frontend.yml`, `deploy-worker.yml`).
- **Live frontend**: `https://pitchey-5o8.pages.dev` (the `-5o8` suffix is PERMANENT — not a preview/orphan). Former `pitchey.pages.dev` was deleted 2026-04-21 and NXDOMAINs — do NOT reintroduce it as an origin/URL.
- **Live worker**: `pitchey-api-prod` (`*.ndlovucavelle.workers.dev`). Marketing stub `pitchey.com` is a separate coming-soon Pages project.

## Tech inventory (verified versions)

| Layer | Tech | Version |
|---|---|---|
| Runtime / API | Cloudflare Worker · hand-rolled `RouteRegistry` (no framework) | wrangler ^4.95 |
| Frontend | React 18 · Vite · Zustand · TailwindCSS on Cloudflare Pages | — |
| Data | Neon Postgres · `@neondatabase/serverless` ^1.0.2 · `postgres` 3.4.4 · **raw SQL, no ORM** | — |
| Validation | Zod | ^4.3.4 |
| Auth | Custom sessions (`pitchey-session`) + JWT bearer fallback · **no Better Auth, no Drizzle** | — |
| AI | `@anthropic-ai/sdk` (Claude Haiku 4.5 — auto-fill assessments, 5 credits) | ^0.78.0 |
| Cache / Storage | Upstash Redis · Cloudflare R2 (7 buckets) · 5 KV · 2 Durable Objects | — |
| Observability | Sentry (`@sentry/cloudflare` 8.x) · Axiom · CF Observability · Analytics Engine | — |
| Payments | Stripe (LIVE — webhooks/portal/prices) | — |
| CI/CD | GitHub Actions · Wrangler · esbuild · Vitest 4 | — |

## What this product is

Pitchey — a film/TV pitch marketplace connecting **creators, investors, and production companies** (plus an audience-only Watcher portal + Admin). Creators publish pitches (content-hash "sealed" for provenance); investors/production sign NDAs to access protected detail and record deals; the moat thesis is a cross-role NDA-intent graph. Edge-first serverless on Cloudflare.
