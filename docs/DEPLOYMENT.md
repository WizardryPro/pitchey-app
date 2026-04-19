# Pitchey Platform - Comprehensive Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Environment Setup](#environment-setup)
5. [Database Setup](#database-setup)
6. [Worker Deployment](#worker-deployment)
7. [Frontend Deployment](#frontend-deployment)
8. [Authentication Setup](#authentication-setup)
9. [Automated CI/CD](#automated-cicd)
10. [Manual Deployment](#manual-deployment)
11. [Testing & Validation](#testing--validation)
12. [Monitoring & Health Checks](#monitoring--health-checks)
13. [Troubleshooting](#troubleshooting)
14. [Rollback Procedures](#rollback-procedures)
15. [Cost Management](#cost-management)
16. [Security Considerations](#security-considerations)

## Overview

### Production URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | https://pitchey.pages.dev | React application (Cloudflare Pages) |
| **API** | https://pitchey-api-prod.ndlovucavelle.workers.dev | Cloudflare Worker API |
| **WebSocket** | wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws | Real-time communications |

### Technology Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Cloudflare Workers (Edge API)
- **Database**: Neon PostgreSQL (Serverless)
- **Cache**: Upstash Redis (Optional)
- **Authentication**: Better Auth (Session-based)
- **Storage**: Cloudflare R2 (Optional)
- **CDN**: Cloudflare Pages (Global)

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Users (Global)                      │
└──────────────────┬───────────────────────────────────┘
                   │ HTTPS/WSS
                   ▼
┌──────────────────────────────────────────────────────┐
│            Cloudflare Edge Network                    │
├──────────────────────────────────────────────────────┤
│  ┌────────────────┐        ┌──────────────────┐     │
│  │ Cloudflare     │        │ Cloudflare       │     │
│  │ Pages          │◄───────┤ Workers          │     │
│  │ (Frontend)     │ API    │ (Backend API)    │     │
│  └────────────────┘        └─────────┬────────┘     │
│                                      │               │
│  Edge Services:                      │               │
│  • KV Storage (Sessions)             │               │
│  • R2 Storage (Files)                │               │
│  • Durable Objects (WebSocket)       │               │
└──────────────────────────────────────┼───────────────┘
                                      │ PostgreSQL
                                      ▼
┌──────────────────────────────────────────────────────┐
│                   Data Layer                          │
├──────────────────────────────────────────────────────┤
│  ┌────────────────┐        ┌──────────────────┐     │
│  │ Neon           │        │ Upstash Redis    │     │
│  │ PostgreSQL     │        │ (Optional Cache) │     │
│  └────────────────┘        └──────────────────┘     │
└──────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Accounts

1. **Cloudflare Account**
   - Sign up at https://cloudflare.com
   - Enable Workers & Pages
   - Note your Account ID: `002bd5c0e90ae753a387c60546cf6869`

2. **Neon PostgreSQL**
   - Sign up at https://neon.tech
   - Create a new database project
   - Save your connection string

3. **GitHub Account**
   - For repository hosting
   - For CI/CD with GitHub Actions

### Required Tools

```bash
# Install Node.js 20+ and npm
curl -fsSL https://fnm.vercel.app/install | bash
fnm use 20

# Install Wrangler CLI
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login

# Verify installation
wrangler --version
node --version
npm --version
```

### Optional Services

- **Upstash Redis**: For caching (https://upstash.com)
- **Sentry**: For error tracking (https://sentry.io)
- **SendGrid**: For email notifications (https://sendgrid.com)

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/pitchey.git
cd pitchey_v0.2
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Configure Secrets

#### Required Secrets

```bash
# Database connection (REQUIRED)
wrangler secret put DATABASE_URL
# Enter: postgresql://user:pass@ep-xxx.neon.tech/pitchey?sslmode=require

# Authentication secrets (REQUIRED)
wrangler secret put BETTER_AUTH_SECRET
# Enter: Generate with: openssl rand -hex 32

wrangler secret put BETTER_AUTH_URL
# Enter: https://pitchey-api-prod.ndlovucavelle.workers.dev

# Session management (REQUIRED for Better Auth)
wrangler secret put JWT_SECRET
# Enter: Generate with: openssl rand -hex 32
```

#### Optional Secrets

```bash
# Redis cache (OPTIONAL - improves performance)
wrangler secret put UPSTASH_REDIS_REST_URL
wrangler secret put UPSTASH_REDIS_REST_TOKEN

# Error tracking (OPTIONAL - recommended)
wrangler secret put SENTRY_DSN

# Email service (OPTIONAL - for notifications)
wrangler secret put SENDGRID_API_KEY

# Payment processing (OPTIONAL - for premium features)
wrangler secret put STRIPE_SECRET_KEY

# Admin access (OPTIONAL - for admin endpoints)
wrangler secret put ADMIN_TOKEN
```

### 4. Environment Files

Create `.env.production` for frontend:

```bash
# frontend/.env.production
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_ENV=production
VITE_ENABLE_WEBSOCKET=true
VITE_ENABLE_ANALYTICS=true
```

## Database Setup

### 1. Create Neon Database

1. Visit https://console.neon.tech
2. Create new project "pitchey-production"
3. Copy connection string

### 2. Run Migrations

```bash
# Set database URL
export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/pitchey?sslmode=require"

# Run Better Auth schema migration
psql "$DATABASE_URL" -f src/db/better-auth-schema.sql

# Run application migrations
npm run db:migrate:prod

# Verify database health
npm run db:health-check
```

### 3. Seed Demo Data (Optional)

```bash
# Create demo accounts for testing
psql "$DATABASE_URL" -f src/db/seed-demo-accounts.sql
```

Demo accounts (Password: `Demo123`):
- Creator: alex.creator@demo.com
- Investor: sarah.investor@demo.com
- Production: stellar.production@demo.com

## Worker Deployment

### 1. Configure KV Namespaces

```bash
# Create KV namespace for sessions (REQUIRED)
wrangler kv:namespace create "SESSIONS_KV"
# Note the ID and update wrangler.toml

# Create KV namespace for cache (OPTIONAL)
wrangler kv:namespace create "KV"
# Note the ID and update wrangler.toml
```

### 2. Configure R2 Storage (Optional)

```bash
# Create R2 bucket for file uploads
wrangler r2 bucket create pitchey-uploads

# Verify creation
wrangler r2 bucket list
```

### 3. Deploy Worker

```bash
# Build the worker
npm run build:worker

# Deploy to production
npm run deploy:production

# Or manually with wrangler
wrangler deploy --env production

# Verify deployment
wrangler tail --env production
```

## Frontend Deployment

### Method 1: Cloudflare Pages (Recommended)

#### Via Dashboard

1. Visit Cloudflare Dashboard → Pages
2. Click "Create a project"
3. Connect to Git repository
4. Configure build settings:
   ```yaml
   Framework preset: React
   Build command: npm run build
   Build output directory: dist
   Root directory: frontend
   Node version: 20
   ```
5. Add environment variables:
   ```
   VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
   VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
   VITE_ENV=production
   ```
6. Deploy

#### Via CLI

```bash
# Build frontend
cd frontend
npm run build

# Deploy to Pages
npx wrangler pages deploy dist \
  --project-name=pitchey \
  --branch=main

# Verify deployment
curl -I https://pitchey.pages.dev
```

### Method 2: Direct Upload

```bash
# Build and deploy in one step
cd frontend
npm run build
wrangler pages deploy dist --project-name=pitchey
```

## Authentication Setup

### Better Auth Configuration

Better Auth is now the primary authentication system, replacing JWT tokens with session-based authentication.

#### Key Points

- **Session Storage**: Server-side sessions stored in KV
- **Cookie-Based**: No Authorization headers needed
- **Portal Compatibility**: All portals use unified Better Auth

#### Authentication Endpoints

```javascript
// Primary endpoints
POST /api/auth/sign-in      // Unified sign-in
POST /api/auth/sign-up      // User registration
POST /api/auth/sign-out     // Session termination
GET  /api/auth/session      // Check current session
POST /api/auth/session/refresh // Refresh session

// Legacy portal endpoints (route to Better Auth internally)
POST /api/auth/creator/login    // Creator portal
POST /api/auth/investor/login   // Investor portal
POST /api/auth/production/login // Production portal
```

## Automated CI/CD

### GitHub Actions Setup

1. Add repository secrets in GitHub:

```yaml
# Required GitHub Secrets
CLOUDFLARE_API_TOKEN     # Create at https://dash.cloudflare.com/profile/api-tokens
CLOUDFLARE_ACCOUNT_ID    # 002bd5c0e90ae753a387c60546cf6869
DATABASE_URL             # Neon PostgreSQL connection
BETTER_AUTH_SECRET       # Better Auth secret
JWT_SECRET              # Legacy JWT support
```

2. The workflow automatically triggers on:
   - Push to main branch
   - Manual workflow dispatch
   - Pull request to main

### Deployment Pipeline

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    # Runs tests and type checking
  
  migrate:
    # Applies database migrations
    
  deploy-worker:
    # Deploys Cloudflare Worker
    
  deploy-frontend:
    # Deploys frontend to Pages
    
  validate:
    # Runs post-deployment checks
```

## Manual Deployment

### Complete Deployment Script

```bash
#!/bin/bash
# deploy-production.sh

set -e

echo "🚀 Starting Pitchey Production Deployment"

# 1. Build application
echo "📦 Building application..."
npm run build

# 2. Run tests
echo "🧪 Running tests..."
npm run test:ci

# 3. Deploy database migrations
echo "🗄️ Running migrations..."
npm run db:migrate:prod

# 4. Deploy Worker
echo "☁️ Deploying Worker..."
npm run deploy:production

# 5. Deploy Frontend
echo "🎨 Deploying Frontend..."
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=pitchey
cd ..

# 6. Warm cache
echo "🔥 Warming cache..."
npm run cache:warm

# 7. Health check
echo "✅ Running health check..."
npm run health:check

echo "✨ Deployment complete!"
```

Make executable and run:

```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

## Testing & Validation

### 1. Health Check

```bash
# Basic health check
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-12-30T...",
  "services": {
    "database": "connected",
    "cache": "connected",
    "worker": "running"
  }
}
```

### 2. Authentication Test

```bash
# Test login
curl -X POST https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }'
```

### 3. API Endpoint Test

```bash
# Test public endpoint
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/trending

# Test authenticated endpoint (use session cookie from login)
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/dashboard/creator/metrics \
  -H "Cookie: better-auth.session=..."
```

### 4. WebSocket Test

```javascript
// Test WebSocket connection
const ws = new WebSocket('wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
```

### 5. Performance Test

```bash
# Load test with Apache Bench
ab -n 100 -c 10 https://pitchey.pages.dev/

# API performance test
ab -n 100 -c 10 https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health
```

## Monitoring & Health Checks

### Real-time Monitoring

```bash
# Watch Worker logs
wrangler tail --env production

# Watch Worker metrics
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/metrics
```

### Cloudflare Analytics

1. Visit Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your project
4. View Analytics tab for:
   - Request volume
   - Error rates
   - Response times
   - Geographic distribution

### Custom Health Endpoints

```bash
# Detailed health check
GET /api/health/detailed

# Database health
GET /api/health/database

# Cache health
GET /api/health/cache

# WebSocket health
GET /api/health/websocket
```

## Troubleshooting

### Common Issues and Solutions

#### Frontend Not Loading

```bash
# Check deployment status
wrangler pages deployment list --project-name=pitchey

# Check build logs in Cloudflare Dashboard
# Verify environment variables are set
```

#### API Connection Errors

```bash
# Check Worker logs
wrangler tail --env production

# Test CORS headers
curl -I -X OPTIONS https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health \
  -H "Origin: https://pitchey.pages.dev"

# Verify secrets are set
wrangler secret list
```

#### Database Connection Issues

```bash
# Test connection directly
psql "$DATABASE_URL" -c "SELECT 1"

# Check Worker environment
wrangler tail --env production --format json | grep DATABASE

# Verify migrations
npm run db:migrate:status
```

#### Authentication Failures

```bash
# Check Better Auth setup
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/session

# Verify KV namespace
wrangler kv:key list --namespace-id=YOUR_SESSIONS_KV_ID

# Check cookie settings in browser DevTools
```

#### WebSocket Connection Failed

```bash
# Test direct WebSocket connection
wscat -c wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws

# Check Durable Objects (if enabled)
wrangler tail --env production --format json | grep durable
```

### Debug Mode

Enable debug logging:

```bash
# Set in Worker environment
wrangler secret put DEBUG_MODE
# Enter: true

# View detailed logs
wrangler tail --env production --format json
```

## Rollback Procedures

### Worker Rollback

```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback --env production

# Or rollback to specific deployment
wrangler rollback --env production --deployment-id=abc123
```

### Frontend Rollback

```bash
# Via Dashboard
# 1. Go to Pages → Project → Deployments
# 2. Find previous successful deployment
# 3. Click "Rollback to this deployment"

# Via CLI
wrangler pages deployment rollback --project-name=pitchey
```

### Database Rollback

```bash
# Rollback last migration
npm run db:migrate:rollback

# Restore from backup
psql "$DATABASE_URL" < backup_20241230.sql
```

## Cost Management

### Free Tier Limits

| Service | Free Tier | Current Usage | Upgrade Threshold |
|---------|-----------|---------------|-------------------|
| **Cloudflare Workers** | 100K req/day | ~80K/day | >90K/day → $5/mo |
| **Cloudflare Pages** | Unlimited | - | Always free |
| **Neon PostgreSQL** | 3GB storage | ~2GB | >2.5GB → $19/mo |
| **Upstash Redis** | 10K cmd/day | ~8K/day | >9K/day → $10/mo |
| **Cloudflare KV** | 100K reads/day | ~50K/day | >90K/day → $5/mo |
| **Cloudflare R2** | 10GB storage | ~5GB | >10GB → $0.015/GB |

### Optimization Strategies

1. **Aggressive Caching**
   - Cache at edge with KV
   - Set appropriate TTLs
   - Use stale-while-revalidate

2. **Request Consolidation**
   - Batch API calls
   - Use GraphQL for flexible queries
   - Implement pagination

3. **Storage Optimization**
   - Compress images before upload
   - Implement lazy loading
   - Archive old data

### Monthly Cost Projection

```
Current (Free Tier):  $0/month
10K Users:           $50/month
100K Users:         $250/month
1M Users:         $2,000/month
```

## Security Considerations

### Security Headers

Automatically applied by Worker:

```javascript
{
  'Content-Security-Policy': "default-src 'self'; ...",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000'
}
```

### Rate Limiting

Configured in Worker:
- 100 requests/minute per IP
- 1000 requests/hour per user
- Automatic DDoS protection via Cloudflare

### Secret Rotation

```bash
# Rotate secrets quarterly
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put JWT_SECRET
wrangler secret put DATABASE_URL
```

### Security Checklist

- [ ] All secrets configured via `wrangler secret`
- [ ] HTTPS enforced on all endpoints
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] SQL injection prevention via parameterized queries
- [ ] XSS protection headers set
- [ ] Regular security updates applied

---

## Support & Resources

### Documentation
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Neon PostgreSQL Docs](https://neon.tech/docs)
- [Better Auth Docs](https://better-auth.com/docs)

### Monitoring Dashboards
- **Cloudflare Analytics**: https://dash.cloudflare.com
- **Worker Logs**: `wrangler tail --env production`
- **Database Console**: https://console.neon.tech

### Emergency Contacts
- **Cloudflare Support**: https://support.cloudflare.com
- **Neon Support**: support@neon.tech
- **GitHub Issues**: https://github.com/your-org/pitchey/issues

---

**Document Version**: 2.0.0  
**Last Updated**: December 30, 2024  
**Platform Status**: Production Active  
**Primary Maintainer**: Development Team