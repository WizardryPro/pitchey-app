---
description: Deploy Pitchey to Cloudflare with pre-flight checks
allowed-tools: Bash(npm run:*), Bash(npx wrangler:*), Bash(git:*), Read, Grep
---

## Deployment Pre-flight Checks

Current branch: !`git branch --show-current`
Uncommitted changes: !`git status --porcelain | head -5`

## Your Task

### 1. Validate Code Quality
- Run TypeScript checks: `npm run type-check`
- If errors, stop and report them

### 2. Build Frontend
- Build frontend:
  ```bash
  cd frontend && npm run build
  ```

### 3. Deploy Based on Target

Ask user for deployment target (staging/production):

#### For Production:
1. Deploy Worker: `CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN npx wrangler deploy`
2. Deploy Pages (MUST run from frontend/ dir): `cd frontend && CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN npx wrangler pages deploy dist/ --project-name=pitchey`
3. Report deployment URLs

#### For Staging:
1. Deploy Worker: `CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN npx wrangler deploy --env staging`
2. Deploy Pages (MUST run from frontend/ dir): `cd frontend && CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN npx wrangler pages deploy dist/ --project-name=pitchey --branch staging`

### 4. Post-Deployment Verification
- Check Worker status in logs
- Test API health endpoint: `curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health`
- Report any errors from deployment output

### 5. Final Report
Provide:
- Deployment URLs (Worker and Pages)
- Any warnings or errors encountered
- Suggested next steps for testing