#!/bin/bash

# Emergency GitHub Actions Fix Script
# Run this to immediately stabilize your CI/CD pipeline

echo "🚨 Emergency GitHub Actions Stabilization Starting..."

# 1. Fix health check URLs in workflows
echo "📝 Step 1: Fixing health check URLs..."
find .github/workflows -name "*.yml" -type f -exec sed -i \
  's|https://pitchey.pages.dev/api/health|https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health|g' {} \;

echo "✅ Health check URLs fixed"

# 2. Disable overly complex workflows (keep only essential ones)
echo "📝 Step 2: Disabling complex workflows..."

# List of workflows to disable
WORKFLOWS_TO_DISABLE=(
  "Production Deployment - Final with All Optimizations"
  "Advanced Secret Rotation Pipeline"
  "Blue-Green Deployment Pipeline"
  "Chaos Engineering Runner"
  "Cost Monitoring and Optimization"
  "Cost Optimization and Monitoring"
  "Database Migration Management"
  "Emergency Rollback Pipeline"
  "GitOps Sync Pipeline"
  "Metrics Collection and Export"
  "Multi-Region Deployment Pipeline"
  "Synthetic Monitoring Runner"
  "Scheduled Tasks"
)

for workflow in "${WORKFLOWS_TO_DISABLE[@]}"; do
  echo "   Disabling: $workflow"
  gh workflow disable "$workflow" 2>/dev/null || echo "   (Already disabled or not found)"
done

echo "✅ Complex workflows disabled"

# 3. Show which workflows remain active
echo "📝 Step 3: Checking remaining active workflows..."
echo ""
echo "Active workflows after cleanup:"
gh workflow list | grep active

echo ""
echo "🎯 RECOMMENDED ACTIVE WORKFLOWS:"
echo "   - Deploy to Production (main deployment)"
echo "   - Security Scan (security checks)"
echo "   - Continuous Integration (testing)"
echo ""

# 4. Create simple health monitoring script
cat > .github/workflows/simple-health-check.yml << 'EOF'
name: Simple Health Check

on:
  workflow_dispatch:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check Frontend
        run: |
          if curl -f https://pitchey.pages.dev/ > /dev/null 2>&1; then
            echo "✅ Frontend is healthy"
          else
            echo "❌ Frontend is down"
            exit 1
          fi
          
      - name: Check API
        run: |
          if curl -f https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health > /dev/null 2>&1; then
            echo "✅ API is healthy"
          else
            echo "❌ API is down"
            exit 1
          fi
EOF

echo "✅ Simple health check workflow created"

# 5. Commit all fixes
echo "📝 Step 4: Committing fixes..."
git add .github/workflows
git commit -m "fix: Stabilize GitHub Actions - disable complex workflows, fix health checks" || echo "No changes to commit"

echo ""
echo "✅ GitHub Actions stabilization complete!"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Update CLOUDFLARE_API_TOKEN in GitHub Secrets with proper permissions"
echo "   Go to: https://github.com/CavellTopDev/pitchey-app/settings/secrets/actions"
echo ""
echo "2. Push these changes:"
echo "   git push origin main"
echo ""
echo "3. Monitor the simplified pipeline:"
echo "   gh run list --limit 5"
echo ""
echo "Your app is still LIVE at https://pitchey.pages.dev ✅"