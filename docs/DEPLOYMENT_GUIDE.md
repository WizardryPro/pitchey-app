# Pitchey Platform Deployment Guide

## Overview
This guide covers deployment procedures for the Pitchey platform across development, staging, and production environments.

## Architecture Overview
- **Frontend**: React/Vite application deployed on Cloudflare Pages
- **Backend**: Cloudflare Worker (`worker-integrated.ts`) deployed via `wrangler deploy`
- **Database**: PostgreSQL hosted on Neon (raw SQL, no ORM)
- **Cache**: Upstash Redis (global distributed)
- **Auth**: Better Auth (session-based cookies, no JWT)

## Local Development Setup

### Prerequisites
- **Node.js 18+** for frontend
- **Wrangler CLI** for backend Worker development and deployment
- **Git** for version control

### Quick Start
```bash
# Clone repository
git clone <repository-url>
cd pitchey

# Start backend (Terminal 1)
wrangler dev

# Start frontend (Terminal 2)
cd frontend && npm install && npm run dev
```

### Detailed Setup

#### 1. Backend Configuration
```bash
# Start Worker locally with bindings
wrangler dev
```

#### 3. Frontend Configuration
```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
VITE_NODE_ENV=development
EOF

# Start development server
npm run dev
```

### Development Scripts

```bash
# Backend
wrangler dev

# Frontend
cd frontend && npm run dev
cd frontend && npm run build && npm run preview
```

## Production Deployment

### Environment Variables

#### Backend (Cloudflare Worker)
Environment variables are configured via `wrangler.toml` `[vars]` section or Cloudflare dashboard secrets.

```bash
# Key variables (set via wrangler secret)
FRONTEND_URL=https://pitchey.pages.dev
UPSTASH_REDIS_REST_URL=<upstash-redis-url>
UPSTASH_REDIS_REST_TOKEN=<upstash-token>
SENTRY_DSN=<sentry-dsn>
```

#### Frontend (Cloudflare Pages)
```bash
# Build-time variables
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_NODE_ENV=production

# Optional
VITE_SENTRY_DSN=<frontend-sentry-dsn>
```

### Backend Deployment (Cloudflare Workers)

#### Automatic Deployment (GitHub Actions)
The CI/CD pipeline in `.github/workflows/ci-cd.yml` deploys automatically on push to `main`.

#### Manual Deployment
```bash
# Deploy Worker to production
wrangler deploy
```

### Frontend Deployment (Cloudflare Pages)

#### Automatic Deployment
Cloudflare Pages automatically deploys from the `main` branch when connected to GitHub.

#### Manual Deployment
```bash
cd frontend

# Build for production
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=pitchey
```

### Database Setup (Neon)

#### Initial Setup
1. **Create Neon Project**
   - Visit [console.neon.tech](https://console.neon.tech)
   - Create new project
   - Copy connection string

2. **Configure Connection**
   ```bash
   # Format: postgresql://user:pass@host:port/db?sslmode=require
   DATABASE_URL="postgresql://neondb_owner:password@ep-xyz.eu-west-2.aws.neon.tech/neondb?sslmode=require"
   ```

3. **Run Migrations**
   ```bash
   # Run migrations via the Worker's migrate endpoint or directly
   npx tsx src/db/migrate.ts
   ```

## Database Management

### Schema Management

#### Current Schema Status
```sql
-- ✅ Existing tables
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    username VARCHAR(100),
    company_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pitches (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    logline TEXT,
    genre VARCHAR(50),
    format VARCHAR(50),
    short_synopsis TEXT,
    long_synopsis TEXT,
    budget VARCHAR(50),
    creator_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ❌ Missing tables (CRITICAL)
-- These need to be created for full functionality
```

#### Required Schema Fixes
```sql
-- Social features table
CREATE TABLE follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id),
    following_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
);

-- Investment tracking table
CREATE TABLE portfolio (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    pitch_id INTEGER NOT NULL REFERENCES pitches(id),
    investment_amount DECIMAL,
    investment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications system
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics tracking
CREATE TABLE analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    pitch_id INTEGER REFERENCES pitches(id),
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NDA management
CREATE TABLE nda_requests (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    pitch_id INTEGER NOT NULL REFERENCES pitches(id),
    creator_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    request_message TEXT,
    response_message TEXT,
    signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messaging system enhancement
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    participant_1_id INTEGER NOT NULL REFERENCES users(id),
    participant_2_id INTEGER NOT NULL REFERENCES users(id),
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(participant_1_id, participant_2_id)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    sender_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Migration Scripts

#### Apply Schema Fixes
```bash
# Create migration script
cat > fix-schema.sql << 'EOF'
-- Add missing tables for production functionality

-- Social features
CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
);

-- Investment tracking  
CREATE TABLE IF NOT EXISTS portfolio (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    investment_amount DECIMAL(15,2),
    investment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics tracking
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_pitch ON portfolio(pitch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_pitch ON analytics_events(pitch_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
EOF

# Apply to local database
psql postgresql://postgres:password@localhost:5432/pitchey < fix-schema.sql

# Apply to production database
psql "$NEON_DATABASE_URL" < fix-schema.sql
```

### Database Backup & Recovery

#### Backup Procedures
```bash
# Local backup
pg_dump postgresql://postgres:password@localhost:5432/pitchey > backup-$(date +%Y%m%d).sql

# Production backup (Neon handles this automatically)
# But you can create manual backups:
pg_dump "$NEON_DATABASE_URL" > production-backup-$(date +%Y%m%d).sql
```

#### Recovery Procedures
```bash
# Restore from backup
psql postgresql://postgres:password@localhost:5432/pitchey < backup-20250107.sql

# Production restore
psql "$NEON_DATABASE_URL" < production-backup-20250107.sql
```

## Configuration Management

### Environment Variables

#### Development (.env)
```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/pitchey

# Authentication
JWT_SECRET=test-secret-key-for-development

# Server
PORT=8001
FRONTEND_URL=http://localhost:5173

# Redis (optional for local)
REDIS_URL=redis://localhost:6379

# Features
CACHE_ENABLED=false
DEBUG=true
```

#### Production (.env.deploy)
```bash
# Database (Neon)
DATABASE_URL=postgresql://neondb_owner:npg_xyz@ep-xyz.neon.tech/neondb?sslmode=require

# Authentication (generate secure key)
JWT_SECRET=<64-character-random-string>

# CORS
FRONTEND_URL=https://pitchey.pages.dev

# Redis (Upstash)
REDIS_URL=redis://default:password@redis-host:port

# Monitoring
SENTRY_DSN=https://xyz@sentry.io/project
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=v3.4

# Features
CACHE_ENABLED=true
DEBUG=false
```

### Security Configuration

#### JWT Secret Generation
```bash
# Generate secure JWT secret
openssl rand -hex 32
# Example: 4f8b7c9d2e1a3f6b8c4d7e2a9f5b8c1d3e6a7f4b9c2d5e8a1f4b7c0d3e6a9f2b5c8
```

#### CORS Configuration
```typescript
// Backend CORS setup
const corsOptions = {
  origin: [
    'http://localhost:5173',  // Development
    'https://pitchey.pages.dev',  // Production
  ],
  credentials: true,
  optionsSuccessStatus: 200
};
```

## Monitoring & Observability

### Health Checks

#### Backend Health Endpoint
```bash
# Local
curl http://localhost:8787/api/health

# Production
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health
```

#### Expected Response
```json
{
  "status": "healthy",
  "timestamp": "2025-01-07T12:00:00Z",
  "version": "3.4",
  "services": {
    "database": "connected",
    "redis": "connected",
    "websocket": "active"
  }
}
```

### Logging Configuration

#### Structured Logging
```typescript
// Logger configuration
const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  error: (message: string, error?: Error, meta?: any) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};
```

### Error Tracking (Sentry)

#### Backend Configuration
Sentry is integrated into the Cloudflare Worker via the `@sentry/cloudflare` package. Configuration is handled in the Worker entry point.

#### Frontend Configuration
```typescript
// React Sentry setup
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 1.0,
});
```

## Performance Optimization

### Database Optimization

#### Connection Pooling
```typescript
// Database configuration
const dbConfig = {
  connectionString: DATABASE_URL,
  max: 20,           // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
```

#### Query Optimization
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_pitches_creator_id ON pitches(creator_id);
CREATE INDEX CONCURRENTLY idx_pitches_genre ON pitches(genre);
CREATE INDEX CONCURRENTLY idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_users_type ON users(user_type);
```

### Caching Strategy

#### Redis Configuration
```typescript
// Cache TTL settings
const CACHE_TTL = {
  USER_SESSION: 86400,      // 24 hours
  PITCH_LIST: 300,          // 5 minutes
  DASHBOARD_METRICS: 300,   // 5 minutes
  PUBLIC_CONTENT: 3600,     // 1 hour
  SEARCH_RESULTS: 900,      // 15 minutes
};
```

### CDN & Asset Optimization

#### cloudflare-pages Configuration
```toml
# cloudflare-pages.toml
[build]
  publish = "frontend/dist"
  command = "cd frontend && npm run build"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000"
```

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT version();"

# Check connection limits
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity;"
```

#### Redis Connection Issues
```bash
# Test Redis connection
redis-cli -u "$REDIS_URL" ping

# Check Redis info
redis-cli -u "$REDIS_URL" info
```

#### Frontend Build Issues
```bash
# Clear cache and rebuild
cd frontend
rm -rf node_modules dist .vite
npm install
npm run build
```

### Debug Procedures

#### Backend Debugging
```bash
# Start Worker in local dev mode
wrangler dev

# Check specific endpoint
curl -v http://localhost:8787/api/health
```

#### Database Debugging
```bash
# Check table existence
psql "$DATABASE_URL" -c "\dt"

# Check specific table structure
psql "$DATABASE_URL" -c "\d follows"

# Check data integrity
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

## Rollback Procedures

### Backend Rollback
```bash
# Rollback Worker to previous deployment
wrangler rollback
```

### Frontend Rollback
```bash
# Rollback via Cloudflare Pages dashboard or redeploy a previous commit
wrangler pages deployment list --project-name=pitchey
```

### Database Rollback
```bash
# Restore from backup
psql "$DATABASE_URL" < production-backup-YYYYMMDD.sql
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Weekly Tasks
- Monitor error rates in Sentry
- Review database performance metrics
- Check disk usage and connection counts
- Update dependencies with security patches

#### Monthly Tasks
- Database maintenance and optimization
- Performance review and tuning
- Security audit and updates
- Backup verification procedures

#### Emergency Procedures
- Incident response playbook
- Communication protocols
- Rollback decision criteria
- Post-incident review process