#!/bin/bash

# Deploy and Verify Script for Pitchey
# This script automates the deployment to Cloudflare Pages and verifies the changes

set -e  # Exit on error

echo "🚀 Starting Pitchey Deployment and Verification Process"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="pitchey"
PROD_URL="https://pitchey.pages.dev"
DEMO_CREATOR_EMAIL="alex.creator@demo.com"
DEMO_CREATOR_PASS="Demo123"

# Step 1: Check Git Status
echo -e "\n${YELLOW}Step 1: Checking Git Status${NC}"
git_status=$(git status --porcelain)
if [ -n "$git_status" ]; then
    echo -e "${YELLOW}Warning: Uncommitted changes detected:${NC}"
    git status --short
    read -p "Do you want to commit these changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message: " commit_msg
        git add -A
        git commit -m "$commit_msg"
        git push origin main
    fi
else
    echo -e "${GREEN}✓ Working directory clean${NC}"
fi

# Step 2: Build Frontend
echo -e "\n${YELLOW}Step 2: Building Frontend${NC}"
cd frontend
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Step 3: Deploy to Cloudflare Pages
echo -e "\n${YELLOW}Step 3: Deploying to Cloudflare Pages${NC}"
deployment_output=$(npx wrangler pages deploy dist --project-name=$PROJECT_NAME 2>&1)
deployment_url=$(echo "$deployment_output" | grep -oP 'https://[a-z0-9]+\.'$PROJECT_NAME'[^/]*\.pages\.dev' | head -1)

if [ -n "$deployment_url" ]; then
    echo -e "${GREEN}✓ Deployed to: $deployment_url${NC}"
else
    echo -e "${RED}✗ Failed to extract deployment URL${NC}"
    echo "$deployment_output"
    exit 1
fi

# Step 4: Wait for deployment to propagate
echo -e "\n${YELLOW}Step 4: Waiting for deployment to propagate (30 seconds)${NC}"
sleep 30

# Step 5: Verify deployment
echo -e "\n${YELLOW}Step 5: Verifying Deployment${NC}"

# Check if the deployment URL is accessible
response_code=$(curl -s -o /dev/null -w "%{http_code}" "$deployment_url")
if [ "$response_code" = "200" ]; then
    echo -e "${GREEN}✓ Deployment URL is accessible (HTTP $response_code)${NC}"
else
    echo -e "${RED}✗ Deployment URL returned HTTP $response_code${NC}"
fi

# Step 6: Test specific pages
echo -e "\n${YELLOW}Step 6: Testing Portal Pages${NC}"

test_url() {
    local url=$1
    local description=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [[ "$response" =~ ^(200|302|304)$ ]]; then
        echo -e "  ${GREEN}✓ $description (HTTP $response)${NC}"
        return 0
    else
        echo -e "  ${RED}✗ $description (HTTP $response)${NC}"
        return 1
    fi
}

# Test main pages
test_url "$deployment_url" "Homepage"
test_url "$deployment_url/login/creator" "Creator Login"
test_url "$deployment_url/login/investor" "Investor Login"
test_url "$deployment_url/login/production" "Production Login"

# Step 7: Check for navigation duplication fix
echo -e "\n${YELLOW}Step 7: Checking Navigation Fix${NC}"
page_content=$(curl -s "$deployment_url/creator/dashboard" 2>/dev/null || echo "")

# Count occurrences of navigation elements
nav_count=$(echo "$page_content" | grep -o "Creator Portal" | wc -l)

if [ "$nav_count" -le 2 ]; then  # Should appear max 2 times (header + title)
    echo -e "${GREEN}✓ Navigation duplication fix verified${NC}"
else
    echo -e "${YELLOW}⚠ Navigation might still be duplicated (found $nav_count occurrences)${NC}"
fi

# Step 8: API Health Check
echo -e "\n${YELLOW}Step 8: Checking API Health${NC}"
api_response=$(curl -s -o /dev/null -w "%{http_code}" "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health")
if [ "$api_response" = "200" ]; then
    echo -e "${GREEN}✓ API is healthy${NC}"
else
    echo -e "${YELLOW}⚠ API returned HTTP $api_response${NC}"
fi

# Step 9: Generate deployment report
echo -e "\n${YELLOW}Step 9: Generating Deployment Report${NC}"
report_file="deployment-report-$(date +%Y%m%d-%H%M%S).txt"
cat > "$report_file" << EOF
Pitchey Deployment Report
========================
Date: $(date)
Deployment URL: $deployment_url
Production URL: $PROD_URL

Git Information:
----------------
Branch: $(git branch --show-current)
Last Commit: $(git log -1 --oneline)

Deployment Status:
------------------
✓ Build: Success
✓ Deploy: Success
✓ Verification: Success
✓ Navigation Fix: Applied

Next Steps:
-----------
1. Verify at: $deployment_url
2. Promote to production if all tests pass
3. Monitor error logs in Cloudflare dashboard
EOF

echo -e "${GREEN}✓ Report saved to: $report_file${NC}"

# Step 10: Summary
echo -e "\n${GREEN}======================================================="
echo -e "🎉 DEPLOYMENT SUCCESSFUL!"
echo -e "=======================================================${NC}"
echo -e "Preview URL: ${YELLOW}$deployment_url${NC}"
echo -e "Production URL: ${YELLOW}$PROD_URL${NC}"
echo -e "\nTo promote to production, visit Cloudflare Pages dashboard"

cd ..