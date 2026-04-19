# Pitchey Platform System Architecture

## Executive Summary

Pitchey is a comprehensive movie pitch marketplace platform connecting creators, investors, and production companies. The platform employs a modern edge-first serverless architecture utilizing Cloudflare's global infrastructure, Neon PostgreSQL for data persistence, and progressive enhancement strategies for scalability and performance.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      GLOBAL USER BASE                           │
│    Creators (Worldwide) | Investors | Production Companies      │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS/WSS
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE GLOBAL EDGE NETWORK                     │
│                    (200+ Points of Presence)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ Cloudflare     │  │  Cloudflare     │  │  Cloudflare    │  │
│  │    Pages       │  │    Workers      │  │      R2        │  │
│  │  (React SPA)   │  │  (API Gateway)  │  │ (File Storage) │  │
│  └────────────────┘  └─────────────────┘  └────────────────┘  │
│         ▲                    │                      ▲           │
│         │                    │                      │           │
│  ┌──────┴──────────┐  ┌─────▼──────┐  ┌───────────┴────────┐  │
│  │  Edge Cache     │  │ Hyperdrive  │  │  KV Namespace      │  │
│  │  (Static Assets)│  │ (DB Pooling)│  │  (Session Cache)   │  │
│  └─────────────────┘  └─────────────┘  └────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Proxied Requests
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVICES                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Cloudflare Worker (Primary)                   │ │
│  │  • Better Auth Session Management                          │ │
│  │  • Request Routing & Rate Limiting                         │ │
│  │  • File Upload Handling (R2)                               │ │
│  │  • Edge Caching & Optimization                             │ │
│  └────────────────────┬───────────────────────────────────────┘ │
│                       │                                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ SQL Queries
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA PERSISTENCE                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Neon PostgreSQL                           │ │
│  │  • 55+ Tables (Users, Pitches, NDAs, etc.)                │ │
│  │  • Serverless with Auto-scaling                           │ │
│  │  • Connection Pooling via Hyperdrive                      │ │
│  │  • Point-in-time Recovery                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            Upstash Redis (When Available)                  │ │
│  │  • Session Management Fallback                             │ │
│  │  • Real-time Metrics Cache                                 │ │
│  │  • Rate Limiting Counters                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React on Cloudflare Pages)

**URL**: https://pitchey.pages.dev

- **Technology Stack**: React 18, TypeScript, Vite, Tailwind CSS
- **Deployment**: Cloudflare Pages with automatic CI/CD
- **Features**:
  - Single Page Application with client-side routing
  - Three distinct portals (Creator, Investor, Production)
  - Progressive Web App capabilities
  - Real-time updates via WebSocket polling (free tier)

### API Layer (Cloudflare Worker)

**URL**: https://pitchey-api-prod.ndlovucavelle.workers.dev

- **Purpose**: Edge API gateway and request processor
- **Responsibilities**:
  - Better Auth session management (cookie-based)
  - Request validation and rate limiting
  - File uploads to R2 storage
  - Edge caching with KV namespace
  - Processing all API endpoints natively
- **Bindings**:
  - `KV`: Session and cache storage
  - `R2_BUCKET`: File storage
  - `HYPERDRIVE`: Database connection pooling
  - `EMAIL_QUEUE`: Async email processing

### Backend Services (Cloudflare Workers)

#### Cloudflare Worker (Primary)
- Handles authentication via Better Auth
- Processes file uploads to R2
- Manages edge caching
- Implements rate limiting for free tier
- All business logic, WebSocket handling, and background jobs

### Database (Neon PostgreSQL)

- **Connection**: Via Hyperdrive pooling (ID: 983d4a1818264b5dbdca26bacf167dee)
- **Schema**: 55+ tables managed with raw SQL
- **Key Tables**:
  - `users`: Multi-portal user accounts
  - `pitches`: Movie pitch content
  - `ndas`: Non-disclosure agreements
  - `sessions`: Better Auth sessions
  - `messages`: User communications
  - `analytics_events`: Platform metrics

### Cache Layer

#### Cloudflare KV (Primary)
- Session storage for Better Auth
- API response caching
- Rate limiting counters
- Static asset metadata

#### Upstash Redis (Optional)
- Fallback session storage
- Real-time metrics
- WebSocket state management
- Available only when configured

### Storage (Cloudflare R2)

- **Bucket**: pitchey-uploads
- **Purpose**: 
  - Pitch documents (PDFs, scripts)
  - User profile images
  - NDA documents
  - Video content (future)
- **Features**:
  - Zero egress fees
  - S3-compatible API
  - Global distribution

## Data Flow

### Request Processing Pipeline

```
1. User Request → Cloudflare Pages (React)
2. API Call → Cloudflare Worker
3. Worker Processing:
   a. Check KV cache → Return if hit
   b. Validate session (Better Auth)
   c. Apply rate limiting
   d. Route request → Process directly
4. Database Query via Hyperdrive
5. Cache response in KV
6. Return response with CORS headers
```

### File Upload Flow

```
1. User selects file → Frontend validation
2. Multipart upload → Worker endpoint
3. Worker processes:
   a. Validate file type/size
   b. Generate unique key
   c. Stream to R2 bucket
4. Store metadata in PostgreSQL
5. Return public URL
```

## Authentication Flow (Better Auth)

### Current Implementation

```
1. User Login Request
   └─> POST /api/auth/sign-in
       └─> Better Auth validates credentials
           └─> Create session in PostgreSQL
               └─> Set secure HTTP-only cookie
                   └─> Return user data

2. Authenticated Request
   └─> Cookie sent automatically
       └─> Worker validates session
           └─> Query user from cache/DB
               └─> Process request

3. Portal-Specific Access
   └─> Check user.user_type field
       └─> Enforce portal boundaries
           └─> Redirect if unauthorized
```

### Session Management
- **Storage**: PostgreSQL `sessions` table + KV cache
- **Duration**: 24 hours with auto-refresh
- **Security**: HTTP-only, Secure, SameSite cookies
- **Portal Isolation**: Separate session validation per portal type

## WebSocket Implementation

### Current State (Free Tier Limitations)

```javascript
// Worker-based polling fallback (no Durable Objects on free tier)
class PollingService {
  - Long polling for real-time updates
  - 30-second timeout with reconnection
  - Message queuing in KV
  - Presence tracking via timestamps
}
```

### Features Supported
- Real-time notifications
- Dashboard metric updates
- Draft auto-save status
- User presence indicators
- Message delivery confirmation

### Migration Path
1. **Current**: HTTP polling with KV storage
2. **Next**: WebSocket via Worker (paid tier)
3. **Future**: Durable Objects for room management

## Key Design Decisions

### 1. Edge-First Architecture
- **Rationale**: Global performance and reduced latency
- **Implementation**: Cloudflare Workers at 200+ locations
- **Benefits**: <50ms response times globally

### 2. Completed Migration
- **From**: Monolithic Deno backend (fully removed)
- **To**: Cloudflare Workers (single integrated Worker)
- **Result**: All endpoints migrated, Deno dependency fully removed

### 3. Better Auth over JWT
- **Previous**: JWT with manual token management
- **Current**: Session-based with Better Auth
- **Benefits**: Enhanced security, automatic refresh, simpler client code

### 4. Raw SQL over ORM
- **Decision**: Direct SQL queries in Worker
- **Rationale**: Smaller bundle size, better performance
- **Trade-off**: Less type safety, manual query writing

### 5. Free Tier Optimization
- **Constraints**: No Durable Objects, limited KV operations
- **Solutions**: Aggressive caching, polling fallbacks, request batching

## Scalability Considerations

### Horizontal Scaling
- **Workers**: Auto-scale to millions of requests
- **Database**: Neon serverless auto-scaling
- **Cache**: Distributed KV across edge locations
- **Storage**: Unlimited R2 capacity

### Performance Optimizations
- **Edge Caching**: 5-minute TTL for public data
- **Connection Pooling**: Hyperdrive for database
- **Static Assets**: Cached at edge indefinitely
- **Code Splitting**: Route-based chunking

### Cost Optimization
```
Current (Free Tier):
- Workers: 100K requests/day
- KV: 100K reads, 1K writes/day
- R2: 10GB storage
- Database: 3GB storage

Scaling Thresholds:
- 10K users: ~$50/month
- 100K users: ~$250/month
- 1M users: ~$2,000/month
```

## Technology Stack

### Frontend
- **Framework**: React 18.2
- **Build Tool**: Vite 5.0
- **Styling**: Tailwind CSS 3.4
- **State**: Zustand + React Query
- **TypeScript**: 5.3

### Backend
- **Runtime**: Cloudflare Workers
- **Database**: PostgreSQL 15 (Neon)
- **Cache**: Cloudflare KV + Upstash Redis
- **Auth**: Better Auth 1.0
- **File Storage**: Cloudflare R2

### DevOps
- **CI/CD**: GitHub Actions
- **Monitoring**: Cloudflare Analytics
- **Logging**: Worker tail logs
- **Deployments**: Wrangler CLI

### Development
- **Local Backend**: Port 8001 (required)
- **Local Frontend**: Port 5173 (Vite)
- **Database GUI**: Drizzle Studio
- **API Testing**: Thunder Client/Postman

## Migration Roadmap

### Phase 0: Foundation (✅ Complete)
- Frontend on Cloudflare Pages
- Basic authentication working

### Phase 1: Edge Services (✅ Complete)
- All endpoints running on Cloudflare Worker
- Edge caching implemented
- Rate limiting active

### Phase 2: Authentication (✅ Complete)
- Better Auth migration complete
- JWT dependencies removed
- Session-based cookies only

### Phase 3: Full Migration (✅ Complete)
- All endpoints migrated to Worker
- Deno dependency fully removed

### Phase 4: Enhancement (🔮 Future)
- Implement Durable Objects (paid tier)
- GraphQL API layer
- Real-time collaboration
- Advanced analytics

## Security Architecture

### Authentication & Authorization
- Session-based auth with secure cookies
- Portal-based access control
- Role-based permissions per portal
- Automatic session expiry and refresh

### Data Protection
- HTTPS everywhere with forced SSL
- Encrypted database connections
- Secure file upload validation
- Input sanitization and validation

### Rate Limiting & DDoS Protection
- Cloudflare DDoS protection (automatic)
- Per-endpoint rate limiting
- IP-based throttling
- Suspicious pattern detection

## Monitoring & Observability

### Current Implementation
- Cloudflare Analytics dashboard
- Worker tail for real-time logs
- KV metrics for cache performance
- Database query performance tracking

### Health Checks
```typescript
GET /api/health
{
  "status": "healthy",
  "timestamp": "2024-12-30T10:00:00Z",
  "services": {
    "database": "connected",
    "cache": "operational",
    "storage": "available",
    "auth": "ready"
  }
}
```

## Local Development Setup

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL (or Neon account)
- Wrangler CLI

### Environment Configuration
```bash
# Frontend (.env)
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001

# Backend (wrangler.toml)
DATABASE_URL=<neon-connection-string>
BETTER_AUTH_SECRET=<secret>
FRONTEND_URL=http://localhost:5173
```

### Starting Development
```bash
# Terminal 1: Backend
wrangler dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

## Production URLs

- **Frontend**: https://pitchey.pages.dev
- **API**: https://pitchey-api-prod.ndlovucavelle.workers.dev

## Key Architectural Patterns

### 1. Request/Response Caching
- Cache-first strategy for read operations
- Invalidation on write operations
- TTL-based expiry with fallback

### 2. Database Connection Management
- Connection pooling via Hyperdrive
- Query optimization with indexes
- Prepared statements for security

### 3. File Upload Strategy
- Direct streaming to R2
- Chunked uploads for large files
- Metadata stored separately in DB

### 4. Error Handling
- Centralized error handler in Worker
- Structured error responses
- Graceful degradation for failures

## Known Limitations

### Free Tier Constraints
- No Durable Objects (WebSocket rooms)
- Limited KV operations per day
- Worker CPU time limits
- Database connection limits

### Technical Debt
- WebSocket polling instead of true WebSocket
- Some missing database tables

## Future Enhancements

### Short Term (Q1 2025)
- Complete Worker migration
- Add Durable Objects for WebSocket
- Implement GraphQL API
- Enhanced monitoring

### Long Term (2025+)
- Video streaming infrastructure
- AI-powered pitch analysis
- Blockchain integration for contracts
- Global CDN for media content

---

**Document Version**: 2.0.0  
**Last Updated**: December 30, 2024  
**Architecture Status**: Production Active — Cloudflare Workers Only (Deno fully removed)  
**Next Review**: January 2025