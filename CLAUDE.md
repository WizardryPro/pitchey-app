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
| Write tests / expand coverage | `test-writer` |

Available slash commands: `/deploy`, `/test`, `/migrate`

## Domain Context Docs
Detailed context split by domain to keep LLM context focused:
- **[Frontend](docs/context-frontend.md)** — React, Zustand, routing, testing patterns, dashboard architecture
- **[Backend](docs/context-backend.md)** — Worker API, auth endpoints, database, caching, RBAC
- **[Deployment](docs/context-deployment.md)** — CI/CD, environment setup, service URLs, deploy commands

## Launch Roadmap — Stage 5 of 5

### Stages 1-4: COMPLETE (Summary)
- **Stage 1 (Foundation)**: Edge-first architecture, Better Auth, 120+ endpoints, RBAC, CI/CD
- **Stage 2 (Core Platform)**: 3 dashboards hardened, all portal flows, WebSocket live, search/browse
- **Stage 3 (Communication + Credits)**: Messaging (edit/delete/attachments), credit system (9 actions), Stripe code, email (Resend), PBKDF2 passwords
- **Stage 4 (Launch Readiness)**: Legal pages, terms acceptance, production submissions workflow, E2E in CI

### Stage 5: Hardening & Full Coverage — IN PROGRESS

#### 5A. Stripe Go-Live (User Action Required)

| Step | Command / Action | Status |
|------|-----------------|--------|
| 1 | Create Products + Prices in Stripe Dashboard | TODO |
| 2 | `wrangler secret put STRIPE_SECRET_KEY` | TODO |
| 3 | `wrangler secret put STRIPE_WEBHOOK_SECRET` | TODO |
| 4 | Set `stripePriceId` in `src/config/subscription-plans.ts` | TODO |
| 5 | Test checkout flow end-to-end | TODO |

#### 5B. Production Portal Data Persistence (P1) — DONE
`ProductionPitchView.tsx` now persists notes, checklist, and team to real API.

| Task | Files | Status |
|------|-------|--------|
| Create `production_notes` + `production_checklists` + `production_team_assignments` tables | `src/db/migrations/040_production_pitch_data.sql` | DONE |
| Add CRUD endpoints for notes, checklist, team | `src/handlers/production-pitch-data.ts` | DONE |
| Register 8 new routes in worker-integrated.ts | `src/worker-integrated.ts` | DONE |
| Replace localStorage reads/writes in ProductionPitchView | `frontend/src/pages/production/ProductionPitchView.tsx` | DONE |
| Add service methods (getPitchNotes, createPitchNote, etc.) | `frontend/src/services/production.service.ts` | DONE |
| Optimistic updates with rollback on error | ProductionPitchView handlers | DONE |

#### 5C. Wire Action Button Stubs (P1) — DONE

| Button | Before | After | Status |
|--------|--------|-------|--------|
| "Request Full Script" | Toast + navigate to messages | Navigates to messages with pre-filled subject + body for script request | DONE |
| "Schedule Meeting" | Opens ScheduleMeetingModal | Already wired to `ScheduleMeetingModal` component (calendar integration) | DONE |
| "Save Team Configuration" | No-op button | Calls `ProductionService.updatePitchTeam()` with toast feedback | DONE |

#### 5D. Backend Stub Cleanup (P1) — DONE

| Stub | Resolution | Status |
|------|-----------|--------|
| `collaborations-real.ts` | Already fully implemented (332 lines, CRUD). Added generic `/api/collaborations` route aliases | DONE |
| `withdrawInvestment()` | Already registered at `POST /api/investor/investments/:id/withdraw` (line 2287) | ALREADY DONE |
| `advanced-search.ts` | Already routed via `this.advancedSearch()`. Removed dead commented-out code | DONE |
| Client error tracking | Backend endpoint already exists (`handleClientError` at line 4005). Wired ErrorBoundary to call it | DONE |
| Dead commented-out code | Removed ~60 lines of TEMPORARILY DISABLED imports + route registrations | DONE |

#### 5E. Legacy Cleanup (P2) — DONE

| Item | Action Taken | Status |
|------|-------------|--------|
| Debug pages (TestNavigation, InvestorDashboardDebug) | Gated behind `import.meta.env.DEV` — hidden in production | DONE |
| ChunkedUploadTest | Not routed in App.tsx — no action needed | N/A |
| TeamManagementPage (duplicate) | Removed dead import from App.tsx (was never routed) | DONE |
| Dead backend comments | Cleaned up ~60 lines of disabled intelligence/search/cache commented code | DONE |
| ComingSoon placeholder page | Kept — serves as fallback for unreleased features | KEPT |

#### 5F. Security Hardening (P2) — DONE (except 2FA)

| Item | File | Status |
|------|------|--------|
| JWT signature verification (HMAC-SHA256) | `src/auth/auth-adapter.ts` | DONE |
| File quota enforcement with real DB | `src/services/file-validation.service.ts` | DONE |
| Rate limiting granularity (per-endpoint) | `src/middleware/advanced-rate-limit.middleware.ts` | ALREADY DONE (4 strategies) |
| File upload validation (magic bytes, extensions) | `src/services/file-validation.service.ts` | ALREADY DONE |
| 2FA/MFA | `src/config/security.production.ts` | DEFERRED — config ready, runtime not implemented |
| File upload malware scanning | `src/services/file-validation.service.ts` | DEFERRED — needs external API (ClamAV/VirusTotal) |

#### 5G. Monitoring & Observability (P2) — DONE

| Item | File | Status |
|------|------|--------|
| DB health check (`SELECT NOW()`) | `src/worker-integrated.ts` handleHealth | DONE |
| Redis/Upstash health check (PING) | `src/worker-integrated.ts` handleHealth | DONE |
| Stripe API health check (GET /v1/balance) | `src/worker-integrated.ts` handleHealth | DONE |
| Resend API health check (GET /domains) | `src/worker-integrated.ts` handleHealth | DONE |
| Email send logging to `email_logs` table | `src/services/worker-email.ts` | DONE (migration 041) |
| File quota checking against `file_storage` table | `src/services/file-validation.service.ts` | DONE (migration 041) |
| `user_storage_usage` view for quick lookups | `src/db/migrations/041_email_logs_and_file_storage.sql` | DONE |

### Current Numbers
- 607 API routes, 135 pages, 186 components, 28 services, 4 stores
- 165 test files, 3140 tests (82% page coverage)
- 114 backend service files, 56 handlers, 66 migrations
- TypeScript: zero errors (CI-enforced)
- 3 portals (Creator, Investor, Production) + Admin shell
- WebSocket + polling fallback live in production
- Email: `noreply@pitchey.com` via Resend (live)
- Legal: Terms of Service + Privacy Policy (production-ready)
- Onboarding: terms acceptance required for all portals
- 13 CI/CD workflows, 7 R2 buckets, 5 KV namespaces, 2 Durable Objects

## Test Coverage Campaign — COMPLETE

All 6 batches completed. Use `test-writer` subagent for new test files as needed.

| Batch | Scope | Status |
|-------|-------|--------|
| 1 | Production Portal (25 pages) | DONE |
| 2 | Creator Portal (11 pages) | DONE |
| 3 | Admin Portal (5 pages) | DONE |
| 4 | Shared Pages (~35 pages) | DONE |
| 5 | Investor Portal (18 pages) | DONE |
| 6 | Services (24 services) | DONE |

Final: 165 test files, 3140 tests, zero failures.

### Untested Pages (24 remaining — mostly low-priority)
- Debug/test pages: TestNavigation, ChunkedUploadTest, InvestorDashboardDebug, PitchValidationDemo
- Legacy duplicates: TeamManagement, TeamManagementPage
- Settings: SettingsProfile, NotificationSettings, PrivacySettings (settings/ variants)
- Dashboards: CreatorDashboard, ProductionDashboard, Dashboard (generic)
- Detail pages: ProductionPitchCreate, ProductionPitchDetail, ProductionAnalyticsPage
- Other: CreatorProfile, CreatorPortfolio, CreatorNDAManagement, UserPortfolio, VerifyEmail, AdvancedSearch, InvestorNDAHistory, InvestorNetwork, team/TeamMembers, team/TeamOverview
