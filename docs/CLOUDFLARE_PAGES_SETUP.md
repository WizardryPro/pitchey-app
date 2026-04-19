# Cloudflare Pages Setup Documentation

## Current Deployment Architecture

### Active Cloudflare Pages Project

The project uses a **single** Cloudflare Pages project:

**Project: `pitchey`**
- **Production URL**: https://pitchey.pages.dev
- **Deployment Method**: GitHub Actions (automated) via `wrangler pages deploy ... --project-name=pitchey`
- **Status**: ✅ ACTIVE — where all CI/CD deploys land

> **Historical note (2026-04):** A second project `pitchey-5o8` (URL `pitchey-5o8-66n.pages.dev`) existed from an earlier manual setup. It was retired in this refactor — all source, config, and workflow references were consolidated onto the `pitchey` project. The old `pitchey-5o8` project may still show in the Cloudflare dashboard and can be safely deleted there. Any lingering external references to `pitchey-5o8.pages.dev` will 500 (Cloudflare error 1101) since its last deploy is broken.

## How It Works

### Communication Flow
```
User Browser → Cloudflare Pages (Frontend) → Cloudflare Workers (API)
     ↓                    ↓                            ↓
pitchey.pages.dev    React App    pitchey-api-prod.ndlovucavelle.workers.dev
```

### Frontend-Backend Communication

The frontend (at `pitchey.pages.dev`) communicates with the backend API through:

1. **API Endpoint**: `https://pitchey-api-prod.ndlovucavelle.workers.dev`
2. **WebSocket Endpoint**: `wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws`

These URLs are baked into the frontend build via environment variables:
- `VITE_API_URL`: Points to the Worker API
- `VITE_WS_URL`: Points to the Worker WebSocket endpoint

### GitHub Actions Deployment

When you push to the `main` branch:

1. GitHub Actions triggers the `deploy-frontend.yml` workflow
2. The workflow:
   - Builds the frontend with production API URLs
   - Uses `wrangler pages deploy` to deploy to the `pitchey` project
   - Creates a unique deployment URL: `https://[deployment-id].pitchey.pages.dev`
   - Updates the production URL: `https://pitchey.pages.dev`

## Deployment Commands

### Via GitHub Actions (Recommended)
```bash
# Automatic deployment on push
git push origin main

# Manual trigger
gh workflow run deploy-frontend.yml
```

### Via Wrangler CLI (Manual)
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=pitchey
```

## URLs Summary

### Frontend URLs
- **Production**: https://pitchey.pages.dev
- **Individual Deployments**: https://[deployment-id].pitchey.pages.dev

### Backend URLs
- **API**: https://pitchey-api-prod.ndlovucavelle.workers.dev
- **WebSocket**: wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws

### Database
- **Neon PostgreSQL**: `ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech`

## Configuration Files

### frontend/wrangler.toml
```toml
name = "pitchey"
compatibility_date = "2026-01-05"
pages_build_output_dir = "frontend/dist"
```

### GitHub Workflow
The `deploy-frontend.yml` workflow automatically deploys to the `pitchey` project, which resolves to `pitchey.pages.dev`.

## Custom Domain Setup (Optional)

To add a custom domain (e.g., `app.yourdomain.com`):

1. Go to Cloudflare Dashboard → Pages → pitchey → Custom domains
2. Add your domain
3. Update DNS records as instructed
4. Update frontend environment variables if needed

## Troubleshooting

### If deployment goes to wrong URL
The project name in the workflow determines the URL:
- `--project-name=pitchey` → `pitchey.pages.dev` ✅ correct
- Any other `--project-name=...` → will deploy to a different (possibly non-existent) Pages project

## Security Notes

- API authentication uses Better Auth with session cookies
- All API calls go through Cloudflare Workers (edge security)
- Database connections use SSL/TLS encryption
- Frontend-backend communication is always over HTTPS/WSS
