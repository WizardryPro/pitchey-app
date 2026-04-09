---
name: wrangler-deploy
description: Cloudflare Wrangler deployment patterns for Pitchey. Activates when deploying, publishing, or releasing to Cloudflare Pages or Workers.
triggers:
  - deploy
  - wrangler
  - publish
  - cloudflare
  - pages
  - production
  - release
---

# Pitchey Deployment Patterns

## Project Details
- Frontend Project: `pitchey` (Cloudflare Pages)
- Worker Name: `pitchey-api-prod`
- Production API: https://pitchey-api-prod.ndlovucavelle.workers.dev
- Production Frontend: https://pitchey-5o8.pages.dev

## Deployment Commands

### Frontend (Pages)
**CRITICAL: Must run from `frontend/` directory, NOT repo root.**
Running from root skips the Functions bundle (`functions/`) and breaks SPA routing (all non-root URLs 404).
```bash
# Build + deploy (MUST be in frontend/)
cd frontend && npm run build
npx wrangler pages deploy dist/ --project-name=pitchey

# Check deployment status
npx wrangler pages deployment list --project-name pitchey
```

### Backend (Workers)
```bash
# Run from repo root (where wrangler.toml lives)
npx wrangler deploy
# Verify deployment
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq
```

### Full Deploy Sequence
```bash
# 1. Deploy Worker API (from repo root)
npx wrangler deploy

# 2. Build + deploy frontend (MUST cd into frontend/)
cd frontend && npm run build && npx wrangler pages deploy dist/ --project-name=pitchey

# 3. Verify both
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq
curl -s -o /dev/null -w "%{http_code}" https://pitchey-5o8.pages.dev
```

## Pre-Deploy Checklist
1. Run `npm run build` - must succeed with no errors
2. Run `npx wrangler types` if wrangler.jsonc bindings changed
3. Test locally with `npx wrangler dev --remote`
4. Deploy to preview first, test, then deploy to production

## Post-Deploy Verification
```bash
# Stream logs for errors (keep running)
npx wrangler tail pitchey-api-prod --status error --format pretty

# Quick health check
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/health | jq

# Test key endpoints
curl -s "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/browse?tab=trending&limit=1" | jq
```

## Rollback Procedures
```bash
# Rollback Worker to previous version
npx wrangler rollback

# List deployments to find version
npx wrangler deployments list

# Rollback to specific version
npx wrangler rollback --version VERSION_ID

# Pages rollback: redeploy previous git commit (MUST be in frontend/)
git checkout PREVIOUS_COMMIT
cd frontend && npm run build
npx wrangler pages deploy dist/ --project-name=pitchey
```

## Common Deployment Issues

### Binding errors after deploy
```bash
npx wrangler types  # Regenerate types
```

### 500 errors after deploy
```bash
npx wrangler tail pitchey-api-prod --status error  # Check stack traces
```

### CORS errors
- Verify origins in wrangler.jsonc match frontend URL
- Check `Access-Control-Allow-Credentials: true` is set

### Build failures
- Check Node version matches (use 18+)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`