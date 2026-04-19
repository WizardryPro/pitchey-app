# Cloudflare API Token Setup Guide

## Required Permissions for CI/CD

To fix the authentication error [code: 10000], create a new Cloudflare API token with these exact permissions:

### 1. Go to Cloudflare Dashboard
Visit: https://dash.cloudflare.com/002bd5c0e90ae753a387c60546cf6869/api-tokens

### 2. Create Custom Token
Click "Create Token" and select "Custom token"

### 3. Configure Permissions

#### Account Permissions:
- **Cloudflare Pages:Edit** ✅ (REQUIRED)
- **Account Settings:Read** ✅ (REQUIRED)
- **Workers Scripts:Edit** ✅ (REQUIRED for Worker deployment)

#### User Permissions:
- **User Details:Read** ✅ (REQUIRED)

#### Zone Permissions (if you have a custom domain):
- **Page Rules:Edit** (optional)
- **DNS:Edit** (optional for custom domains)

### 4. Account Resources
- **Include**: Your account (Ndlovucavelle@gmail.com's Account)
- **Account ID**: 002bd5c0e90ae753a387c60546cf6869

### 5. Client IP Address Filtering (optional)
- Leave blank for CI/CD usage

### 6. TTL
- Start date: Today
- End date: No expiry (or set as needed)

## Update GitHub Secret

After creating the token, update it in GitHub:

```bash
# Using GitHub CLI
gh secret set CLOUDFLARE_API_TOKEN --repo CavellTopDev/pitchey-app

# Paste the new token when prompted
```

## Verify Token Permissions

Test the token locally first:

```bash
export CLOUDFLARE_API_TOKEN="your-new-token-here"
export CLOUDFLARE_ACCOUNT_ID="002bd5c0e90ae753a387c60546cf6869"

# Test Pages access
curl -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json"

# Should return 200 OK with project list
```

## Common Issues

### Error: Authentication error [code: 10000]
- Token lacks required permissions
- Token expired or invalid
- Wrong account ID

### Error: Project not found
- Pages project doesn't exist yet
- Need to create it first: `wrangler pages project create pitchey`

## Current Production URLs
- Frontend: https://pitchey.pages.dev
- API: https://pitchey-api-prod.ndlovucavelle.workers.dev