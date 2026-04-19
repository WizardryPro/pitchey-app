# Deployment Context — Pitchey

## CI/CD Pipeline
- **Primary**: `.github/workflows/ci-cd.yml` — runs on push/PR/daily
- **Health check**: `.github/workflows/simple-health-check.yml` — every 30 min
- 13 workflow files total in `.github/workflows/`
- TypeScript type-check is **BLOCKING** — zero TS errors required
- ESLint is non-blocking (`continue-on-error: true`)
- SonarCloud: `sonarsource/sonarqube-scan-action@v6`
- Security: `github/codeql-action@v4`

## Deployment Commands

### Frontend (Cloudflare Pages)
```bash
cd frontend && npm run build && wrangler pages deploy dist/ --project-name=pitchey
```
**CRITICAL**: Must run from `frontend/` dir so `functions/` directory is found and Pages Functions proxy is included. Without this, API calls fail due to cross-origin cookies.

### Backend (Cloudflare Worker)
```bash
wrangler deploy
```

## Environment Variables

### Local Development (`frontend/.env`)
```
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
```

### Production (`frontend/.env.production`)
```
VITE_API_URL=
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_FRONTEND_URL=https://pitchey.pages.dev
VITE_DISABLE_WEBSOCKET=false
VITE_ENABLE_REALTIME=true
VITE_ENABLE_ANALYTICS=true
VITE_NODE_ENV=production
VITE_TURNSTILE_SITE_KEY=0x4AAAAAACzpFR_oniI4M7PI
VITE_SENTRY_DSN=https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536
```
`VITE_API_URL=` (empty) means API calls go same-origin through Pages Functions proxy at `frontend/functions/api/[[path]].ts`.

Frontend env vars require a restart to take effect.

## Service URLs

### Local
- Backend API: http://localhost:8001
- WebSocket: ws://localhost:8001/ws
- Frontend: http://localhost:5173
- Worker dev: http://localhost:8787

### Production
- Frontend: https://pitchey.pages.dev
- API: https://pitchey-api-prod.ndlovucavelle.workers.dev
- WebSocket: wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws

## Verification After Deploy
```bash
gh run list --branch main --limit 3          # find the run ID
gh run watch <run-id> --exit-status          # watch until completion
```

## Test Suite
```bash
cd frontend && npx vitest run                # 3639+ tests, ~21s
cd frontend && npx tsc --noEmit -p tsconfig.app.json  # type check
```

## Gotchas
- `npm run build:prod` exists in frontend but NOT at root level
- Playwright E2E tests exist (`frontend/e2e/`) but are NOT run in CI
- Deno has been fully removed from the project
- TypeScript strict mode: `catch (err)` gives `unknown` — must cast: `const e = err instanceof Error ? err : new Error(String(err))`
