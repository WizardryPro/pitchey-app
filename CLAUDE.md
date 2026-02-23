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

## Launch Roadmap — Stage 3 of 4

### Stage 1: Foundation — COMPLETE
- Edge-first architecture live (Cloudflare Workers + Pages + Neon + R2 + Upstash Redis)
- Better Auth sessions (cookie-based, KV-backed)
- 120+ API endpoints operational
- Frontend RBAC: 50 permissions, 5 roles
- CI/CD pipeline: 59 test files, 1261 tests, zero failures, TypeScript blocking

### Stage 2: Core Platform — COMPLETE
- All 3 dashboards hardened (per-section errors, connectivity awareness, skeleton loading)
- Creator flow: pitch CRUD, character management, calendar, team invites (Resend)
- Investor flow: browse, save, invest, NDA full lifecycle, portfolio analytics (real SQL)
- Production flow: browse, save, feasibility heuristics, pitch evaluation
- Public pitch endpoint returns full field set; `transformPitchData` maps all fields
- WebSocket live (NotificationHub DO) with polling fallback
- Search, saved pitches, connectivity awareness on all key pages

### Stage 3: Communication + Credits — COMPLETE
**Messaging (user-to-user):**
- Conversation-based messaging aligned with migration 019 schema (`type`, `created_by` columns)
- Simple DMs + conversation CRUD: send, thread view, unread count, mark-read
- WebSocket delivers real-time `new_message`, typing indicators, online status
- Frontend Messages page built (1124 lines) with emoji picker, file attachment UI
- **Remaining P2**: message edit/delete (frontend shows "not implemented"), file attachment upload

**Credit system (internal ledger):**
- `user_credits` and `credit_transactions` tables live in production (migration 038)
- Demo accounts seeded with 100 credits each
- Full CRUD: balance check, purchase, use, history, invoices
- 9 credit actions with costs (basic_upload, word_doc, picture_doc, extra_image, video_link, promoted_pitch, view_pitch, nda_request, send_message)
- Server-side credit enforcement on uploads (10/3/5/1), messaging (2, free for investors), NDA requests (10)
- `deductCreditsInternal()` helper checks unlimited subscription tiers, validates balance, records transactions
- Free credits loophole closed: dev fallback gated behind `ENVIRONMENT !== 'production'`
- New users seeded with 10 starter credits on registration

**Stripe integration (payment gateway):**
- `StripeService` at `src/services/stripe.service.ts` — Workers-native (fetch + Web Crypto, no SDK dependency)
- `POST /api/payments/subscribe` → Stripe Checkout Session (subscription mode)
- `POST /api/payments/credits/purchase` → Stripe Checkout Session (payment mode); production requires Stripe
- `POST /api/payments/cancel-subscription` → `cancel_at_period_end` via Stripe API
- `POST /api/payments/payment-methods` → Stripe SetupIntent for adding cards
- `DELETE /api/payments/payment-methods/:id` → detach from Stripe + mark inactive in DB
- `POST /api/webhooks/stripe` → handles `checkout.session.completed`, `subscription.deleted/updated`, `invoice.paid`
- Webhook signature verification via Web Crypto HMAC-SHA256 with replay protection

**Email (Resend):**
- `RESEND_API_KEY` secret is SET and live
- Sender: `noreply@pitchey.com` (domain verified in Resend)
- Welcome/verification emails send on registration
- Team invite emails pass `env.RESEND_API_KEY` through to email service (Workers-compatible)
- Email templates in `src/services/worker-email.ts` (NDA, team invite, message, investment) and `src/services/email-service.ts` (welcome, password reset)

**Password security:**
- PBKDF2 hashing (100K iterations, SHA-256) via `src/utils/worker-password.ts`
- All new registrations store hashed passwords (prefixed `pbkdf2:`)
- All 3 login paths verify against hash; plaintext passwords auto-upgrade on successful login
- Demo accounts still use hardcoded `Demo123` check

### Stage 4: Launch Readiness — IN PROGRESS

#### Portal Readiness for Real Users

**Creator Portal: READY**
- Registration → verification email → onboarding → dashboard: full flow works
- Pitch CRUD, characters, calendar, messages, analytics, settings: all functional
- Known gaps: message edit/delete (toasts "not implemented"), file attachments in messages (no upload endpoint)

**Investor Portal: READY (with known gaps)**
- Registration → onboarding → dashboard → browse → save → NDA → invest: works
- NDA request button now on InvestorPitchView (was missing — fixed Feb 2026)
- Known gaps: `GET /api/investment/recommendations` 404s (path mismatch, should be `/api/investor/recommendations`), `withdrawInvestment()` calls unregistered endpoint

**Production Portal: READY**
- Registration → onboarding → dashboard → browse → save → messages: works
- Settings profile saves to real API (fixed Feb 2026)
- Project CRUD: POST/PUT registered (fixed Feb 2026)
- Submissions: accept/reject/shortlist/archive all functional via `saved_pitches.review_status` (migration 039)
- Analytics: queries `production_projects` and `saved_pitches` (rewritten Feb 2026)
- Known gaps: PitchView action buttons ("Request Script", "Schedule Meeting") are UI stubs

#### Remaining Items

| Priority | Item | Status |
|----------|------|--------|
| **P0** | `wrangler secret put STRIPE_SECRET_KEY` | Needs your Stripe key |
| **P0** | `wrangler secret put STRIPE_WEBHOOK_SECRET` | Needs Stripe webhook endpoint |
| **P0** | Set `stripePriceId` in `src/config/subscription-plans.ts` | Needs Stripe Products created |
| ~~P1~~ | ~~Fix investor recommendation endpoint path mismatch~~ | **DONE** — alias registered |
| ~~P1~~ | ~~Register POST/PUT /api/production/projects~~ | **DONE** — CRUD registered |
| ~~P1~~ | ~~Fix production analytics data model~~ | **DONE** — queries saved_pitches |
| ~~P2~~ | ~~Message file attachments~~ | **DONE** — upload to R2, attachments JSONB |
| ~~P2~~ | ~~Message edit/delete~~ | **DONE** — 15min edit window, soft delete |
| ~~P2~~ | ~~Production submissions accept/reject~~ | **DONE** — review_status workflow |
| ~~P2~~ | ~~Playwright E2E in CI~~ | **DONE** — runs after deploy, continue-on-error |

### Current Numbers
- 120+ API endpoints, 165 test files, 3133 tests
- TypeScript: zero errors (CI-enforced)
- 3 portals (Creator, Investor, Production) + Admin shell
- WebSocket + polling fallback live in production
- Email: `noreply@pitchey.com` via Resend (live)

## Test Coverage Campaign

Use the `test-writer` subagent to systematically expand test coverage. Run `/test write <batch>` to execute a batch.

| Batch | Scope | Pages | Current | Target |
|-------|-------|-------|---------|--------|
| 1 | Production Portal | 25 | 0% | 80%+ |
| 2 | Creator Portal | 11 | 8% | 80%+ |
| 3 | Admin Portal | 5 | 0% | 100% |
| 4 | Shared Pages | ~35 | 34% | 70%+ |
| 5 | Investor Portal | 18 | 40% | 80%+ |
| 6 | Services | 24 | 14% | 70%+ |

### Sub-batches (for parallel agent execution)

**Batch 1 — Production Portal:**
- 1a: Core (Dashboard, PitchView, Saved, Analytics, Stats, Activity, Revenue, Pipeline) — 8 pages
- 1b: Submissions (Submissions, New, Review, Shortlisted, Accepted, Rejected, Archive) — 7 pages
- 1c: Projects + Settings (Projects, Active, Development, Post, Completed, Collaborations, TeamRoles, TeamInvite, Settings×4) — 12 pages

**Batch 2 — Creator Portal:**
- 2a: Core (Dashboard, PitchView, AnalyticsPage, ManagePitches, BudgetAllocation) — 5 pages
- 2b: Features (Calendar, Characters, TeamInvite, Messages, Onboarding, Settings) — 6 pages

**Batch 3 — Admin Portal:**
- 3a: All (AdminDashboard, UserManagement, ContentModeration, Transactions, SystemSettings) — 5 pages

**Batch 4 — Shared Pages:**
- 4a: Browse (BrowseGenres, BrowseTopRated, MarketplaceEnhanced, SearchPage) — 4 pages
- 4b: Auth + Landing (Login×3, Register, Landing, About, Pricing, NotFound) — ~8 pages
- 4c: Features (Messages, NDA, PitchDetail, Profile, Settings) — ~5 pages

**Batch 5 — Investor Portal:**
- 5a: Analytics (Analytics, Performance, MarketTrends, RiskAssessment) — 4 pages
- 5b: Network + Views (Network, CoInvestors, Creators, ProductionCompanies, PitchView) — 5 pages

**Batch 6 — Services:**
- 6a: Core (auth, api, pitch, investment, nda, messaging) — 6 services
- 6b: Features (search, analytics, portfolio, calendar, team, credit) — 6 services
- 6c: Infrastructure (websocket, notification, cache, error-tracking) — 4 services

Cross-batch parallelism: different conversations can run different batches simultaneously (no file conflicts).
