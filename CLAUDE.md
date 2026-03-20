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

### Stage 5: Hardening & Full Coverage — COMPLETE (except Stripe Go-Live)

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

#### 5H. UX Polish & Portal Audit (P2) — DONE

| Item | File | Status |
|------|------|--------|
| Error page flash on route navigation | `frontend/src/shared/components/layout/PortalLayout.tsx` — `PageErrorBoundary` wraps `<Outlet>` | DONE |
| Activity feed 30s auto-polling | `frontend/src/portals/creator/pages/CreatorActivity.tsx` — silent polling, no loading spinner | DONE |
| "Submit for Review" workflow | `frontend/src/pages/ManagePitches.tsx` — draft pitches get Send button → `under_review` status | DONE |
| Dead imports cleanup in App.tsx | Removed 4 unused `ProductionSettings*` imports + duplicate `/creator/:creatorId` route | DONE |

### Stage 6: Platform Integration (Mar 2026)

#### 6A. Pitch-to-Project Conversion — DONE

Production users can convert any pitch into a tracked production project.

| Component | File | Status |
|-----------|------|--------|
| StartProjectModal (reusable) | `frontend/src/portals/production/components/StartProjectModal.tsx` | DONE |
| "Start Project" button on pitch view | `frontend/src/portals/production/pages/ProductionPitchView.tsx` | DONE |
| "Start Project" button on saved pitches | `frontend/src/portals/production/pages/ProductionSaved.tsx` | DONE |
| Backend pitchId filter (duplicate prevention) | `src/handlers/production-dashboard.ts` GET `?pitchId=X` | DONE |
| Pre-fills title, budget, genre, logline, timeline from pitch | StartProjectModal | DONE |

Flow: View pitch → "Start Project" → modal pre-fills from pitch data → creates `production_pipeline` row with `pitch_id` FK → navigates to projects page.

#### 6B. Data Integrity Fixes (Mar 2026) — DONE

| Fix | Details | Status |
|-----|---------|--------|
| pitchStore localStorage persist removed | Was causing stale pitch counts across sessions | DONE |
| Investor notes/diligence → API | Migration 044: `investor_notes` + `investor_diligence_checklists` tables | DONE |
| Analytics dashboard hardcoded fallbacks removed | 8 active projects, $850K revenue, etc. all zeroed | DONE |
| Production projects scoped to user | Was returning all published pitches | DONE |
| Following tab filters wired | Sort (recent/popular/trending/genre) + filter (all/new/nda/public) | DONE |
| Analytics overview reads from `overview` sub-object | Was reading flat keys, all values were 0 | DONE |
| Time-series percentage changes computed | viewsChange/likesChange/ndasChange from first-half vs second-half | DONE |
| Messages emoji picker removed | Per user request | DONE |
| Messages duplicate "New Conversation" removed | Per user request | DONE |
| Conversation vanishing bug fixed | hookConversations sync guard | DONE |
| Production projects use `production_pipeline` table | Was querying `pitches` table instead | DONE |
| Production users can create pitches | `creator-pitches.ts` accepts both creator + production roles | DONE |

#### 6C. AI Production Auto-Fill (Mar 2026) — DONE

Upload a document (script, treatment, pitch deck) to auto-fill production assessment forms via Claude API.

| Component | File | Status |
|-----------|------|--------|
| Backend handler (Claude Haiku 4.5) | `src/handlers/ai-production-autofill.ts` | DONE |
| Route registration | `src/worker-integrated.ts` POST `/api/production/ai-autofill` | DONE |
| Service method | `frontend/src/portals/production/services/production.service.ts` | DONE |
| Auto-fill button + file upload | `frontend/src/portals/production/pages/ProductionPitchView.tsx` | DONE |

Flow: Click "Auto-fill from Document" → upload PDF/TXT/DOCX → Claude analyzes → populates checklist (10 items), team priorities (6 roles), and categorized production notes (3-8 notes). Costs 5 credits. Uses same Anthropic API key as `ai-pitch-extract.ts`.

### Stage 7: Team Collaboration (Post-Launch)

**Decision**: Team members are metadata records for launch (70 users). Post-launch adds scoped collaborator access.

#### Current State (Launch)
- Team tab on ProductionPitchView: 6 roles (Director, Producer, Cinematographer, Production Designer, Editor, Composer) with name + status
- `production_team_assignments` table stores team as JSONB per user/pitch
- `teams`, `team_members`, `team_invitations` tables exist with owner/editor/viewer roles
- TeamInvite page sends email invites via Resend
- Frontend types already define `'collaborator'` role but backend only accepts `'owner' | 'editor' | 'viewer'`

#### 7A. Collaborator System (Mar 2026) — DONE

Production companies invite external team members to specific pipeline projects with scoped access. Collaborator access is additive — any user can also be a collaborator. NOT a fourth portal.

Full implementation guide: `docs/collaborator-implementation.md`

| Step | Description | Files | Status |
|------|-------------|-------|--------|
| 1 | Database migration (project_collaborators + activity_log) | `src/db/migrations/045_project_collaborators.sql` | DONE |
| 2 | Invitation endpoints (invite, list, remove, update, resend) | `src/handlers/collaborator.ts` | DONE |
| 3 | Invite acceptance endpoint | `src/handlers/collaborator.ts` | DONE |
| 4 | Collaborator read endpoints (/api/my/collaborations/*) | `src/handlers/collaborator.ts` | DONE |
| 5 | Collaborator write endpoints (checklist, notes, activity) | `src/handlers/collaborator.ts` | DONE |
| 6 | Frontend: InviteCollaboratorModal + CollaboratorList | `frontend/src/portals/production/components/` | DONE |
| 7 | Frontend: AcceptInvitePage | `frontend/src/pages/AcceptInvitePage.tsx` | DONE |
| 8 | Frontend: MyCollaborations dashboard + sidebar nav | `frontend/src/pages/MyCollaborations.tsx` | DONE |
| 9 | Frontend: CollaborationProjectView (5 tabs) | `frontend/src/pages/CollaborationProjectView.tsx` | DONE |
| 10 | Email integration (invite + acceptance notifications) | Resend integration | DONE |

**Not building**: A fourth portal. Collaborators get a scoped project view within the existing routing, not a separate navigation tree. Think "guest access" not "new portal."

#### 7B. Full Crew Features (Later) — DEFERRED

Availability calendars, rate cards, crew project dashboards. Competes with StudioBinder — not where Pitchey's differentiation lies. Only build if user demand justifies it post-launch.

### Stage 8: Production Portal Remediation (Mar 2026)

26-issue audit of the production portal. 11 batches ordered by user impact. First 3 batches resolve 13 of 18 critical issues.

#### 8A. Dashboard Uploads & Alerts (Issues #1-3) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #1 | `handleSmartUpload()` shows fake "AI Analysis" alert, uploads nothing | ProductionDashboard.tsx | 770-794 |
| #2 | `handleUploadMedia()` updates local state only, never persists | ProductionDashboard.tsx | 602-639 |
| #3 | 5× `alert()` calls instead of toast | ProductionDashboard.tsx | 704, 711, 780, 785, 793 |

#### 8B. Project Pages Dead Buttons (Issues #4-8) — DONE

13 non-functional buttons across 4 project pages. All need onClick handlers wired to navigation or actions.

| Issue | Page | Dead Buttons | Lines |
|-------|------|-------------|-------|
| #4 | ProjectsActive | View Details, Dailies | 334-342 |
| #5 | ProjectsDevelopment | View Details, Edit | 321-327 |
| #6 | ProjectsPost | View Details, Dailies | 390-397 |
| #7 | ProjectsCompleted | View Details, Analytics, Download | 397-407 |
| #8 | All 4 pages | MoreVertical (3-dot menu) not clickable | various |

#### 8C. Following Page (Issues #10-11) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #10 | "Unfollow" button has no onClick handler | Following.tsx | 462-464 |
| #11 | Timeframe selector (24h/7d/30d/all) never passed to API | Following.tsx | 58, 199-208 |

#### 8D. ProductionSaved Sort & Data (Issues #12-13) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #12 | "Highest Rated" + "Most Viewed" sort options not implemented | ProductionSaved.tsx | 119-123 |
| #13 | `rating: 0` and `hasNDA: false` hardcoded for all pitches | ProductionSaved.tsx | 112-113 |

#### 8E. ProductionPipeline Data (Issue #9) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #9 | `team: 0` hardcoded, `blockers: []` always empty | ProductionPipeline.tsx | 112, 146 |

#### 8F. Submissions Pages (Issues #14-15) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #14 | "View Contract" button shows toast stub only | SubmissionsAccepted.tsx | 117 |
| #15 | Uses browser `prompt()` for notes instead of modal | SubmissionsReview.tsx | 131 |

#### 8G. Collaboration + Revenue Stubs (Issues #16-18) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #16 | "New Collaboration" button — toast stub | ProductionCollaborations.tsx | 421 |
| #17 | "Download" document button — toast stub | ProductionCollaborations.tsx | 395 |
| #18 | "Generate Invoice" button — toast stub | ProductionRevenue.tsx | 232 |

#### 8H. Settings Billing (Issues #19-21) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #19 | Hardcoded $499 plan, "Apr 1" bill date, "50 members", "1TB" | SettingsBilling.tsx | 194-260 |
| #20 | Payment methods + invoices arrays always empty, no API calls | SettingsBilling.tsx | 77, 79 |
| #21 | 4 stub buttons (save, download invoice, add/remove payment) | SettingsBilling.tsx | 102-119 |

#### 8I. Settings Security (Issues #22-23) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #22 | 2FA enable/disable, revoke session, download report — all stubs | SettingsSecurity.tsx | 153-165 |
| #23 | Sessions + security logs arrays always empty | SettingsSecurity.tsx | 70, 72 |

#### 8J. Settings Notifications (Issue #24) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #24 | "Test notification" + "Verify phone" show fake success toasts | SettingsNotifications.tsx | 173-179 |

#### 8K. Calendar (Issues #25-26) — DONE

| Issue | Description | File | Lines |
|-------|-------------|------|-------|
| #25 | 5× `alert()` calls instead of toast | Calendar.tsx | 116-209 |
| #26 | Week + Day views are placeholder stubs | Calendar.tsx | 477-513 |

### Current Numbers
- 612+ API routes, 135 pages, 166 components, 26 services, 4 stores
- 184 test files, 3450+ tests (82% page coverage)
- 114 backend service files, 57 handlers, 67 migrations
- TypeScript: zero errors (CI-enforced)
- 3 portals (Creator, Investor, Production) + Admin shell
- WebSocket + polling fallback live in production
- Email: `noreply@pitchey.com` via Resend (live)
- Legal: Terms of Service + Privacy Policy (production-ready)
- Onboarding: terms acceptance required for all portals
- NDA required for messaging (backend-enforced, Mar 2026)
- Follow system: user-to-user follows, pitch follow → follows creator
- 13 CI/CD workflows, 7 R2 buckets, 5 KV namespaces, 2 Durable Objects

### Stage 9: Data Quality & Follow System (Mar 2026) — DONE

| Fix | Details | Status |
|-----|---------|--------|
| Follow API contract | Backend accepts both `{userId}` and `{targetId, targetType}` | DONE |
| Pitch follow → creator | Following a pitch resolves to following the pitch's creator | DONE |
| Following feed enrichment | `/api/pitches/following` returns nested creator object + camelCase counts | DONE |
| Follow stats reading | Dashboard reads `data.stats.following` correctly | DONE |
| NDA messaging gate | Signed NDA required for new conversations (3 enforcement points) | DONE |
| "Unknown Creator" sweep | 9 files fixed across all portals — improved fallback chains | DONE |
| "undefined" URL guards | ProductionPitchView + InvestorPitchView message navigation guarded | DONE |
| NaN like counts | snake_case → camelCase normalization + undefined guards | DONE |
| useEffect cleanup | `useOnlineStatus()` hook extracted (10 files), redundant state→useMemo (4 files) | DONE |
| NDAs sidebar removed | Was duplicate of dashboard tab, auto-highlighted on dashboard | DONE |

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
