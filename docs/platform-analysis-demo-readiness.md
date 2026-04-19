# Pitchey Platform: Architecture-to-Business Analysis & Demo Readiness

*Generated: February 2026*

---

## What Pitchey Is (Business Output)

A **movie pitch marketplace** connecting three user types:
- **Creators** — upload film/TV pitches with media, scripts, NDAs
- **Investors** — browse, evaluate, and fund pitches
- **Production Companies** — discover projects to produce, manage submissions

Revenue model: subscription tiers + credit system (Stripe-backed, but see gaps below).

---

## Architecture Overview (Top-Down)

```
[User Browser]
     │
     ▼
[Cloudflare Pages]  ←── React + Vite frontend (pitchey.pages.dev)
     │
     │  /api/* requests proxied via Pages Functions
     ▼
[Cloudflare Worker]  ←── Single worker-integrated.ts (117+ endpoints)
     │
     ├──→ [Neon PostgreSQL]     ←── 60+ tables, raw SQL, real data
     ├──→ [Cloudflare R2]       ←── File storage (images, scripts, NDAs)
     ├──→ [Upstash Redis]       ←── STUBBED (always returns null)
     ├──→ [Stripe]              ←── Falls back to mock without key
     ├──→ [SendGrid/Email]      ←── No key = console.log only
     └──→ [Durable Objects]     ←── WebSocket rooms (declared, unclear usage)
```

**The architecture is sound** — edge-first, serverless, globally distributed. The gap is that several external integrations are either stubbed or missing secrets, making them silently non-functional.

---

## What WORKS End-to-End (Demo-Safe)

These features have real database backing, real API endpoints, and functional frontend:

| Feature | Flow | Status |
|---------|------|--------|
| **Sign up & Login** | Register → pick portal type → session cookie → dashboard | Solid |
| **Create a Pitch** | Multi-step form → file upload to R2 → save to DB → publish | Solid |
| **Edit a Pitch** | Load existing data → modify → image preview → save | Solid |
| **Browse Marketplace** | Filter by genre/format/budget → paginated results → pitch cards with images | Solid |
| **View Pitch Detail** | Public pitch view with hero image, logline, synopsis, creator info | Solid |
| **NDA Workflow** | Request → approve → sign → track history (full state machine) | Solid |
| **Creator Dashboard** | Stats grid, pitch list, milestones, quick actions | Solid |
| **Production Dashboard** | Overview, browse marketplace, NDA management | Solid |
| **Follow System** | Follow creators/companies, mutual followers, suggestions | Real DB |
| **View Tracking** | Every pitch view logged with device/location/user | Real DB |
| **File Uploads** | Images, PDFs, videos → R2 storage with chunked upload support | Real |
| **Team Management** | Create teams, invite members, assign roles | Real DB |
| **Messaging** | Conversations, send/receive, read status | Real DB |
| **Demo Accounts** | One-click login for all 3 portals (Demo123) | Works |

---

## What LOOKS Like It Works But Doesn't (Demo Risks)

These features have UI, routes, and API endpoints — but return empty/mock data:

### 1. Investor Portfolio & Analytics — EMPTY DATA
- **UI**: Beautiful dashboards with charts, ROI metrics, deal pipelines
- **Reality**: Backend endpoints return `{ success: true }` with zero values
- **Demo impact**: Investor dashboard shows all zeros. No portfolio performance, no ROI
- **Files**: `InvestorDashboard.tsx`, `InvestorAnalytics.tsx`, `InvestorPortfolio.tsx`

### 2. Creator Revenue & Advanced Analytics — PARTIAL
- **UI**: Revenue charts, engagement breakdowns, comparisons
- **Reality**: Routes exist but calculation logic is incomplete. Views are tracked but not aggregated
- **Demo impact**: Analytics section shows basic numbers but revenue is always $0
- **Files**: `CreatorAnalyticsPage.tsx`, `EnhancedCreatorAnalytics.tsx`

### 3. Payment/Billing System — MOCK STRIPE
- **UI**: Credit purchase flow, subscription selection, billing page
- **Reality**: Without `STRIPE_SECRET_KEY`, entire system uses `stripe-mock.service.ts`
- **Demo impact**: User can "buy credits" but nothing happens. Subscription appears active but isn't

### 4. Email Verification — DOESN'T SEND
- **UI**: "Check your inbox" screen after registration
- **Reality**: No `SENDGRID_API_KEY` = emails are console.logged, never delivered
- **Demo impact**: New user signs up, told to check email, nothing arrives. **They are stuck.**
- **Workaround**: Demo accounts bypass verification

### 5. Redis Cache Layer — COMPLETELY STUBBED
- **Code**: `redis.ts` — `async get() { return null; }`, `async set() { return 'OK'; }`
- **Impact**: All "cached" features hit the database every time or return nothing
- **Demo impact**: Invisible — things just run slower

### 6. Real-Time Features — POLLING ONLY
- **Docs claim**: WebSocket notifications, live dashboard, presence tracking
- **Reality**: Durable Objects declared but integration unclear. Falls back to polling
- **Demo impact**: No live updates — user must refresh to see new notifications

---

## Pages That Are Stubs (Will Show "Coming Soon")

| Page | Route |
|------|-------|
| Creator Pitch Reviews | `/creator/pitches/review` |
| Creator Pitch Analytics | `/creator/pitches/analytics` |

Only 2 stub pages out of 80+ — the rest have real implementations (400-1100 lines each).

---

## Critical External Service Gaps

| Service | Variable | Status | Impact |
|---------|----------|--------|--------|
| **Database** | Neon PostgreSQL | CONNECTED | Core data works |
| **Storage** | Cloudflare R2 | CONNECTED | File uploads work |
| **Sentry (backend)** | `SENTRY_DSN` | SET | Backend errors tracked |
| **Stripe** | `STRIPE_SECRET_KEY` | MISSING | All payments mocked |
| **Email** | `SENDGRID_API_KEY` | MISSING | No emails sent |
| **Redis** | `UPSTASH_REDIS_*` | STUBBED IN CODE | No caching at all |
| **Sentry (frontend)** | `VITE_SENTRY_DSN` | MISSING | No frontend error tracking |
| **Axiom** | `AXIOM_TOKEN` | MISSING | No log aggregation |
| **n8n** | `N8N_WEBHOOK_URL` | POINTS TO LOCALHOST | Video processing fails |

---

## Demo Strategy

### Safe Demo Path (Show These)
1. **Homepage** → Trending pitches, marketplace browse
2. **Sign in as Creator** (alex.creator@demo.com / Demo123)
3. **Creator Dashboard** → Stats, milestones, pitch list, bold Create button at top
4. **Create New Pitch** → Full multi-step form with image upload
5. **Edit Existing Pitch** → Show image preview
6. **Marketplace** → Browse with filters, view pitch detail
7. **Sign in as Production** → Dashboard with prominent Create button
8. **NDA Flow** → Request an NDA on a pitch, show approval workflow
9. **Register page** → Show card-style account type selector

### Avoid During Demo
- Investor portal analytics/portfolio (all zeros)
- New user registration live (email verification won't arrive)
- Billing/Payments page (mock Stripe, nothing real happens)
- Creator "Pitch Reviews" tab ("Coming Soon")
- Advanced search (endpoint disabled, will 404)
- Real-time notification demos (polling only, no WebSocket)

### If Client Asks About Payments/Billing
*"Payment integration is architected and ready — Stripe webhook handlers, subscription tiers, and credit system are all built. We connect the production Stripe keys to go live."* This is true — the code exists, just needs secrets.

---

## Quantitative Summary

| Metric | Count |
|--------|-------|
| API Endpoints | 117+ fully routed |
| Database Tables | 60+ |
| Frontend Pages | 80+ (only 2 are stubs) |
| Frontend Components | 100+ |
| Service Files | 36 API service files |
| Backend (worker-integrated.ts) | 16,000+ lines |
| External Services Connected | 3 of 8 (DB, R2, Sentry backend) |
| External Services Needing Keys | 5 (Stripe, Email, Redis, Sentry FE, Axiom) |

### Architecture Completeness: ~85%
### Demo Readiness (safe path): ~90%
### Full Production Readiness: ~60% (blocked by external service secrets + analytics gaps)

---

## Path to Production Readiness

To move from 60% to 100%, these items need addressing:

1. **Set Stripe production keys** → Payments go live immediately
2. **Set SendGrid/Resend key** → Email verification and NDA notifications work
3. **Implement Redis properly** → Replace stub with real Upstash client
4. **Add investor seed data** → Portfolio, investments, ROI calculations
5. **Complete analytics aggregation** → Creator revenue, engagement rollups
6. **Fix n8n webhook URL** → Point to production instance (currently localhost)
7. **Set frontend Sentry DSN** → Enable frontend error tracking
8. **Remove demo account bypass** → NDA auto-approve for @demo.com
