# GitHub Actions Deployment Setup Guide

This guide will help you set up automatic deployment to Cloudflare Pages when you push to GitHub.

## Prerequisites

1. A Cloudflare account
2. A GitHub repository for your project
3. Your project must be pushed to GitHub

## Step 1: Get Your Cloudflare Credentials

### 1.1 Get Your Cloudflare Account ID

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. On the right sidebar, find your **Account ID**
4. Copy this value - you'll need it for `CLOUDFLARE_ACCOUNT_ID`

### 1.2 Create a Cloudflare API Token

1. Go to [My Profile > API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use the **Custom token** template with these permissions:
   - **Account**: Cloudflare Pages:Edit
   - **Zone**: Page Rules:Edit (if you have a custom domain)
4. Click **Continue to summary**
5. Click **Create Token**
6. Copy the token - you'll need it for `CLOUDFLARE_API_TOKEN`

**⚠️ IMPORTANT**: Save this token securely! You won't be able to see it again.

## Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

### Required Secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `CLOUDFLARE_API_TOKEN` | Your API token from Step 1.2 | Used to authenticate with Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | Your Account ID from Step 1.1 | Identifies your Cloudflare account |

### Optional Secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `SENTRY_DSN` | Your Sentry DSN | For error tracking (optional) |
| `NEON_DATABASE_URL` | PostgreSQL connection string | If running tests in CI |
| `JWT_SECRET` | Your JWT secret | If running tests in CI |

## Step 3: Create Your Cloudflare Pages Project

### Option A: Via Dashboard (Easiest)

1. Go to [Cloudflare Pages](https://dash.cloudflare.com/?to=/:account/pages)
2. Click **Create a project**
3. Select **Direct Upload**
4. Name your project: `pitchey`
5. Upload any file (we'll deploy the real app via GitHub Actions)
6. Click **Deploy**

### Option B: Via Wrangler CLI

```bash
# Install wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create the Pages project
wrangler pages project create pitchey
```

## Step 4: Test the Deployment

### Manual Trigger (Recommended for First Test)

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Deploy Frontend to Cloudflare Pages**
4. Click **Run workflow** → **Run workflow**
5. Watch the logs to ensure it completes successfully

### Automatic Trigger

Simply push changes to the `main` branch:

```bash
# Make a small change
echo "# Test deployment" >> README.md

# Commit and push
git add .
git commit -m "Test: Trigger automatic deployment"
git push origin main
```

## Step 5: Verify Deployment

After the workflow completes:

1. Check the GitHub Actions logs for the deployment URL
2. Visit your site at: https://pitchey.pages.dev
3. Alternative URL: https://[project-name].pages.dev

## Troubleshooting

### "Project not found" Error

If you get this error, the Pages project doesn't exist yet:
1. Create it via the Cloudflare dashboard (Step 3, Option A)
2. Or let the first deployment create it automatically

### "Authentication failed" Error

Double-check your secrets:
```bash
# Test your API token locally
export CLOUDFLARE_API_TOKEN="your-token-here"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# Try a deployment
cd frontend
npx wrangler pages deploy dist --project-name=pitchey
```

### "Build failed" Error

Check that all environment variables are set:
- `VITE_API_URL` should point to your backend
- `VITE_WS_URL` should point to your WebSocket endpoint
- Build works locally: `cd frontend && npm run build`

### Deployment Succeeds but Site Doesn't Update

1. Clear Cloudflare cache:
   - Go to your domain in Cloudflare
   - Click **Caching** → **Configuration**
   - Click **Purge Everything**

2. Wait 1-2 minutes for global propagation

3. Try hard refresh in browser:
   - Chrome/Edge: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Firefox: Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)

## Workflow Features

The deployment workflow (`deploy-frontend.yml`) includes:

✅ **Automatic deployment** on push to main branch
✅ **Manual deployment** via workflow_dispatch
✅ **Build caching** for faster deployments
✅ **Environment variables** properly configured
✅ **Deployment notifications** in the logs
✅ **Branch deployments** for preview environments

## Security Best Practices

1. **Never commit secrets** to your repository
2. **Use GitHub Secrets** for all sensitive values
3. **Rotate API tokens** periodically
4. **Use least-privilege tokens** (only the permissions needed)
5. **Enable 2FA** on both GitHub and Cloudflare accounts

## Next Steps

Once deployment is working:

1. **Set up preview deployments** for pull requests
2. **Add deployment status checks** to PRs
3. **Configure custom domain** in Cloudflare Pages
4. **Set up deployment notifications** (Slack, Discord, etc.)
5. **Add rollback workflow** for quick reversions

## Support

If you encounter issues:

1. Check the [GitHub Actions logs](../../actions)
2. Review [Cloudflare Pages docs](https://developers.cloudflare.com/pages/)
3. Check [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/)
4. Open an issue in the repository

---

*Last Updated: January 2025*
*Workflow Version: 1.0*