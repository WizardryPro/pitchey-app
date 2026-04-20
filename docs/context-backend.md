# Backend Context — Pitchey

Cloudflare Worker handling all API routing, auth, database, caching, and storage.

## Architecture
- **Single Worker**: `src/worker-integrated.ts` — handles all routing via `wrangler deploy`
- **Build**: esbuild (`esbuild.config.js` at root)
- **Runtime**: Cloudflare Workers (V8 isolates, not Node.js)

## Authentication — Custom Handlers on Legacy Sessions

The header used to say "Better Auth ONLY." It wasn't true. The live path is:

- **Login**: `handlePortalLogin()` in `worker-integrated.ts` — direct SQL against `users`, writes a row to the legacy `sessions` table, returns a `pitchey-session` UUID cookie.
- **Session lookup**: custom middleware reads `pitchey-session`, joins `sessions`.
- **Sign-out**: deletes the `sessions` row; cookie-clear header also zeros a stray `better-auth-session` cookie name that nothing ever sets (theatre).
- **No JWT headers**: `Authorization: Bearer …` is not used anywhere in the live flow.

Better Auth is imported but the `createAuthAdapter` call in
`src/worker-integrated.ts` has been commented out since commit `41850ea1`
(2025-12-18). Grep to find the current site:

```typescript
// Initialize Better Auth adapter (commented out - causing runtime error)
// this.authAdapter = createAuthAdapter(env);
```

BA's `user`, `session`, `account`, and `verification` tables are empty in prod;
the `src/auth/better-auth-*.ts` files are code that doesn't execute. Some
imports still compile-check against your handler shapes, which is where the
"Better Auth is live" docs drift came from — types validated against BA's API
surface even though no runtime call reached it.

**Known side-effect**: `src/auth/auth-adapter.ts` returns 503 "Authentication
system is being upgraded" for any non-demo email from its `authenticate()`
fallback branch. `UserProfileRoutes` calls this adapter's `requireAuth()` in
five handlers, so user-profile endpoints 503 for real (non-demo) users. Either
the endpoints aren't hit by anyone real yet, or there's a bigger-than-BA bug
hiding here. Flagged in issue #19.

**Decision pending** (issue #19):
1. Rip BA out entirely (smallest diff, requires grep sweep)
2. Find the Dec 2025 runtime error, fix it, actually wire BA in (2–4 weeks)
3. Document and leave (what this doc update does — least work, most honest)

### Primary Endpoints
- `POST /api/auth/sign-in` — unified sign-in
- `POST /api/auth/sign-up` — registration
- `POST /api/auth/sign-out` — logout
- `GET /api/auth/session` — session check
- `POST /api/auth/session/refresh` — refresh

### Portal-Specific (Backward Compatibility)
- `POST /api/auth/creator/login`
- `POST /api/auth/investor/login`
- `POST /api/auth/production/login`

### Demo Accounts (Password: Demo123)
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com

## Database — Neon PostgreSQL
- **Raw SQL only** — no ORM, uses postgres.js client directly
- **Connection**: Neon pooler (`ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech`)
- **Migrations**: SQL scripts in `src/db/migrations/`, runner at `src/db/migrate.ts`
- **Edge Pooling**: Via Neon's built-in connection pooler
- 120+ API endpoints operational

### Notable Tables
- `calendar_events` — user-created events (columns: `start_date`/`end_date` as timestamp, `attendees` as jsonb, `color`, `reminder`)
- `pitch_engagement` — viewer tracking with `viewer_type` for audience breakdown

## Caching — Upstash Redis
- Global distributed Redis for session/notification caching
- Memory fallback when Redis is unavailable
- Dashboard metrics cached with 5-minute TTL
- Redis services use lazy-loaded getters to avoid static initialization issues

## Storage — Cloudflare R2
- S3-compatible object storage for documents, images, videos
- Accessed via Worker bindings (not HTTP API)

## Cloudflare Bindings
- **R2**: Object storage
- **KV**: Edge caching for frequently accessed data
- **WebSockets**: Via Workers (Durable Objects planned for future)

## RBAC
- Backend: `rbac.service.ts` — 50 permissions across 5 roles
- Roles: admin, creator, investor, production, viewer
- Frontend mirrors this via `usePermissions` hook + `PermissionGuard`

## Key Implementation Details
- All API endpoints route through Worker (no direct backend access)
- Raw SQL queries via postgres.js
- Error responses follow `{ success: false, error: { message: string } }` pattern
- Success responses follow `{ success: true, data: any }` pattern

## Commands
- Local dev: `wrangler dev` (runs on port 8787)
- Deploy: `wrangler deploy`
- Config: `wrangler.toml` at project root
