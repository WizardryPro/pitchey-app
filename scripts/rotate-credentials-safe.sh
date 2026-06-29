#!/bin/bash

# Safe Credential Rotation Script
set -e

echo "🔐 SAFE CREDENTIAL ROTATION"
echo "==========================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Generate new credentials
echo -e "${YELLOW}Generating new secure credentials...${NC}"
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
NEW_DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '=')

echo -e "${GREEN}✅ New credentials generated${NC}"
echo ""

# Save credentials to secure file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CREDENTIALS_FILE="./credentials_${TIMESTAMP}.secure"

cat > "$CREDENTIALS_FILE" << CREDS
# Generated on $(date)
# STORE THESE SECURELY AND DELETE THIS FILE AFTER UPDATING

JWT_SECRET="${NEW_JWT_SECRET}"
DATABASE_PASSWORD="${NEW_DB_PASSWORD}"

# Cloudflare Commands to Update:
echo "${NEW_JWT_SECRET}" | wrangler secret put JWT_SECRET --name pitchey-api-prod
echo "postgresql://neondb_owner:${NEW_DB_PASSWORD}@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" | wrangler secret put DATABASE_URL --name pitchey-api-prod

# Neon Database Update Command:
# Go to Neon Dashboard and reset password to: ${NEW_DB_PASSWORD}
CREDS

chmod 600 "$CREDENTIALS_FILE"

echo -e "${GREEN}✅ Credentials saved to: $CREDENTIALS_FILE${NC}"
echo ""
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo "1. First, update Neon database password in dashboard"
echo "2. Then run the Cloudflare commands from $CREDENTIALS_FILE"
echo "3. Deploy with: wrangler deploy"
echo "4. Test the deployment"
echo "5. Delete $CREDENTIALS_FILE after confirming everything works"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Do NOT commit $CREDENTIALS_FILE to git!${NC}"
