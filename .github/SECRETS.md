# GitHub Secrets Configuration

This document outlines the required GitHub secrets for the CI/CD pipeline.

## Required Secrets

### 🔑 Deployment Tokens
| Secret Name | Description | Required |
|-------------|-------------|----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token for Workers and Pages deployments | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier | Yes |

### 🗄️ Database Configuration
| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DATABASE_URL_STAGING` | Staging Neon PostgreSQL connection string | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_PROD` | Production Neon PostgreSQL connection string | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |

### 📊 Monitoring & Error Tracking
| Secret Name | Description | Required |
|-------------|-------------|----------|
| `SENTRY_AUTH_TOKEN` | Sentry authentication token for source map uploads | Yes |
| `SENTRY_ORG` | Sentry organization slug | Yes |
| `SENTRY_PROJECT` | Sentry project slug | Yes |
| `SENTRY_DSN` | Sentry error tracking DSN | Optional |

### 🚀 Caching (Upstash Redis)
| Secret Name | Description | Required |
|-------------|-------------|----------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | Optional |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Optional |

### 🌐 Environment URLs
| Secret Name | Description | Example |
|-------------|-------------|---------|
| `PRODUCTION_URL` | Production Worker API URL | `https://pitchey-api-prod.ndlovucavelle.workers.dev` |
| `FRONTEND_URL` | Production frontend URL | `https://pitchey-5o8.pages.dev` |

## Setting Up Secrets

### 1. Via GitHub Web Interface

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with the exact name and value

### 2. Via GitHub CLI

```bash
# Set deployment secrets
gh secret set CLOUDFLARE_API_TOKEN --body "your_cloudflare_api_token"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "your_cloudflare_account_id"

# Set database secrets
gh secret set DATABASE_URL_STAGING --body "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
gh secret set DATABASE_URL_PROD --body "postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"

# Set error tracking secrets
gh secret set SENTRY_AUTH_TOKEN --body "your_sentry_auth_token"
gh secret set SENTRY_ORG --body "your_sentry_org"
gh secret set SENTRY_PROJECT --body "your_sentry_project"

# Set caching secrets
gh secret set UPSTASH_REDIS_REST_URL --body "https://xxx.upstash.io"
gh secret set UPSTASH_REDIS_REST_TOKEN --body "your_upstash_token"

# Set environment URLs
gh secret set PRODUCTION_URL --body "https://pitchey-api-prod.ndlovucavelle.workers.dev"
gh secret set FRONTEND_URL --body "https://pitchey-5o8.pages.dev"
```

## Environment-Specific Configuration

### Staging Environment
- **Purpose**: Testing and QA validation before production
- **Database**: Separate Neon PostgreSQL branch with test data
- **Authentication**: Better Auth session-based cookies
- **Monitoring**: Optional but recommended
- **Caching**: Optional Upstash Redis instance

### Production Environment
- **Purpose**: Live production system serving real users
- **Database**: Production Neon PostgreSQL with real data
- **Authentication**: Better Auth session-based cookies (secure HTTP-only)
- **Monitoring**: Required for observability and alerting
- **Caching**: Recommended Upstash Redis for performance

## Security Best Practices

### 🛡️ Secret Management
- **Rotation**: Rotate secrets quarterly or after security incidents
- **Access**: Limit access to secrets to authorized team members only
- **Validation**: Never log or expose secrets in application code
- **Backup**: Maintain secure backup of critical secrets

### ⚠️ Common Security Issues
- ❌ Using weak or short secrets
- ❌ Sharing secrets in chat or email
- ❌ Hardcoding secrets in source code
- ❌ Using same secrets across environments
- ❌ Not rotating secrets regularly

### ✅ Security Checklist
- [ ] Cloudflare API token has minimal required permissions
- [ ] Staging and production use different database credentials
- [ ] Sentry tokens are configured for error tracking
- [ ] Database credentials have minimal required permissions
- [ ] Secrets are documented but values are not shared
- [ ] Regular secret rotation schedule is established

## Troubleshooting

### Common Issues

**❌ "Missing secret" error in workflow**
- Verify the secret name matches exactly (case-sensitive)
- Check that the secret is set at the repository level, not organization level
- Ensure the secret value is not empty

**❌ Cloudflare deployment failures**
- Verify the Cloudflare API token has Workers and Pages permissions
- Check that the account ID is correct
- Confirm `wrangler.toml` references match the configured project

**❌ Database connection failures**
- Verify Neon PostgreSQL connection string format and credentials
- Ensure `?sslmode=require` is included in the connection string
- Check that the Neon project allows connections from GitHub Actions IPs

### Debug Commands

```bash
# List all secrets (names only, not values)
gh secret list

# Test secret access in workflow
echo "Secret length: ${#SECRET_NAME}"
```

## Workflow Integration

The secrets are automatically injected into the CI/CD workflow environments:

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

For more information about the CI/CD pipeline, see [ci-cd.yml](./workflows/ci-cd.yml).
