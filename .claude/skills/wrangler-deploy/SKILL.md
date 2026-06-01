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
- Production Frontend: https://pitchey-5o8.pages.dev (ndlovucavelle account; `pitchey.pages.dev` was deleted 2026-04-21)

## Deployment Commands

### Frontend (Pages)
**TWO CRITICAL flags/rules — get either wrong and the deploy looks successful but isn't live:**

1. **Must run from `frontend/` directory, NOT repo root.** Running from root skips the Functions bundle (`functions/`) and breaks SPA routing (all non-root URLs 404). Note: **bash cwd resets between turns** — always re-`cd` in the same command; a `cd` from a previous turn does NOT persist.
2. **Must pass `--branch=main`.** Without it the deploy publishes a *preview* (a `<hash>.pitchey-5o8.pages.dev` alias) and the canonical `pitchey-5o8.pages.dev` keeps serving the OLD build. The CLI prints a hashed URL either way, so the printed URL does NOT tell you whether prod updated — you must verify the canonical hostname (below).

```bash
# Build + deploy production (MUST be in frontend/, MUST pass --branch=main)
cd frontend && npm run build
npx wrangler pages deploy dist/ --project-name=pitchey --branch=main

# Check deployment status
npx wrangler pages deployment list --project-name pitchey
```

**MANDATORY verification — confirm canonical prod serves the new bundle.** The build prints the entry hash (`dist/assets/index-XXXX.js`); confirm the live canonical host serves the same hash:
```bash
curl -s https://pitchey-5o8.pages.dev/ | grep -oE 'assets/index-[A-Za-z0-9_]+\.js' | head -1
# Must match the index-XXXX.js the build just emitted. If it doesn't, you shipped a preview
# (forgot --branch=main) or deployed from the wrong dir.
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

# 2. Build + deploy frontend (MUST cd into frontend/, MUST pass --branch=main)
cd frontend && npm run build && npx wrangler pages deploy dist/ --project-name=pitchey --branch=main

# 3. Verify both — canonical hosts, not the printed preview alias
curl -s https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq
curl -s https://pitchey-5o8.pages.dev/ | grep -oE 'assets/index-[A-Za-z0-9_]+\.js' | head -1  # match build hash
```

### Auto-deploy topology (GitHub Actions)
Pushing to `main` also auto-deploys via `deploy-frontend.yml` (frontend) and `deploy-worker.yml` (worker), both on Node 22. There is **NO Cloudflare Git integration** — all deploys are ad-hoc/wrangler (verified). A manual `wrangler pages deploy` and a CI run do the same thing; don't disable one believing the other is a CF-native build. Verify what's actually live via the deployments API / bundle hash, not CI history.

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

# Pages rollback: redeploy previous git commit (MUST be in frontend/, MUST pass --branch=main)
git checkout PREVIOUS_COMMIT
cd frontend && npm run build
npx wrangler pages deploy dist/ --project-name=pitchey --branch=main
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