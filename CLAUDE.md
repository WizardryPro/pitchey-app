# Claude Instructions — Pitchey

Movie pitch platform connecting creators, investors, and production companies. Edge-first serverless architecture on Cloudflare.

## Architecture
- **Frontend**: Cloudflare Pages — React 18 + Vite + Zustand + TailwindCSS
- **Backend**: Cloudflare Worker (`src/worker-integrated.ts`) — single entry point for all API routing
- **Database**: Neon PostgreSQL — raw SQL, no ORM
- **Auth**: Better Auth — session cookies only, no JWT
- **Cache**: Upstash Redis (global)
- **Storage**: Cloudflare R2

## Project Structure
- **12 root files**: package.json, tsconfig.json, wrangler.toml, eslint.config.js, esbuild.config.js, CLAUDE.md, README.md, etc.
- **10 directories**: src/, frontend/, .github/, docs/, scripts/, node_modules/, dist/, .wrangler/, .claude/, .git/

## Quick Reference

| Task | Command |
|------|---------|
| Backend dev | `wrangler dev` |
| Frontend dev | `cd frontend && npm run dev` |
| Deploy frontend | `cd frontend && wrangler pages deploy dist/ --project-name=pitchey` |
| Deploy backend | `wrangler deploy` |
| Run tests | `cd frontend && npx vitest run` |
| Type check | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` |

## Demo Accounts (Password: Demo123)
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com

## Code Conventions
- TypeScript for all new code
- Raw SQL only (no ORM)
- Better Auth sessions only (no JWT)
- `credentials: 'include'` on all API calls
- Defensive utils (`safeAccess`, `safeNumber`, `safeArray`) for runtime safety
- In `catch` blocks: `const e = err instanceof Error ? err : new Error(String(err))`

## Subagent Routing

When delegating tasks, use the Task tool with these subagent types:

| User Request | Subagent |
|---|---|
| Deploy backend or frontend | `cloudflare-deployer` |
| Debug frontend / React / component / build | `frontend-debugger` |
| Debug API / Worker / 4xx / 5xx / CORS | `worker-debugger` |
| Debug database / query / connection | `db-debugger` (READ-ONLY) |
| Migrate / schema change | `database-migrator` |
| Review code / PR | `code-reviewer` |

Available slash commands: `/deploy`, `/test`, `/migrate`

## Domain Context Docs
Detailed context split by domain to keep LLM context focused:
- **[Frontend](docs/context-frontend.md)** — React, Zustand, routing, testing patterns, dashboard architecture
- **[Backend](docs/context-backend.md)** — Worker API, auth endpoints, database, caching, RBAC
- **[Deployment](docs/context-deployment.md)** — CI/CD, environment setup, service URLs, deploy commands

## Current Status (February 2026)
- 120+ API endpoints operational
- 59 test files, 1261 tests, zero failures
- TypeScript type-check blocking in CI (zero errors)
- All 3 dashboards hardened (per-section errors, connectivity awareness, skeleton loading)
- Connectivity awareness on all key pages (Messages, PitchEdit, SearchPage)
- Portfolio analytics use real SQL aggregation (no mock data)
- Saved pitches APIs enriched with views, likes, verified, budget, thumbnail
- Investments API enriched with stake (equity_percentage), stage, risk level
- Feasibility scores use deterministic heuristics (not random)
- Public pitch endpoint returns full field set for PitchView pages
- `transformPitchData` maps all snake_case API fields to camelCase
- Creator analytics: topPitches + audienceBreakdown from real DB queries
- Calendar: full CRUD (GET synthesized + custom events, POST new events)
- Team invite emails wired via Resend API
- Frontend RBAC: 50 permissions, 5 roles

### Known Gaps
- Stripe payment endpoints are stubs (5 endpoints: payment-methods CRUD, subscribe, cancel-subscription)
- Playwright E2E tests exist but are not run in CI
- Test coverage: 22% pages (30/135), 14% services (4/28); Production portal and Admin portal at 0%
