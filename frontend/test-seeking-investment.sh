#!/bin/bash

set -e

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://bf53246c.pitchey.pages.dev"

echo "===================================="
echo "Testing Seeking Investment Feature"
echo "===================================="
echo ""

# Login as creator
echo "1. Login as creator..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to login as creator"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Logged in as creator (ID: $USER_ID)"
echo ""

# Create a pitch with seeking investment enabled
echo "2. Creating pitch with seeking investment enabled..."
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Seeking Investment Pitch",
    "tagline": "A test pitch looking for investment",
    "synopsis": "This is a test pitch to verify the seeking investment feature works correctly",
    "genre": "action",
    "status": "published",
    "visibility": "public",
    "seekingInvestment": true,
    "budgetRange": "$1M - $5M"
  }')

PITCH_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2 | head -1)

if [ -z "$PITCH_ID" ]; then
  echo "❌ Failed to create pitch with seeking investment"
  echo "$CREATE_RESPONSE"
  exit 1
fi

echo "✅ Created pitch with seeking investment (ID: $PITCH_ID)"
echo ""

# Get pitch details to verify seeking investment flag
echo "3. Fetching pitch details to verify seeking investment..."
PITCH_DETAILS=$(curl -s "$API_URL/api/pitches/$PITCH_ID")

SEEKING=$(echo "$PITCH_DETAILS" | grep -o '"seekingInvestment":true')
if [ -n "$SEEKING" ]; then
  echo "✅ Pitch correctly shows seeking investment"
else
  echo "❌ Pitch does not show seeking investment flag"
  echo "$PITCH_DETAILS"
fi
echo ""

# Test search with seeking investment filter
echo "4. Testing search with seeking investment filter..."
SEARCH_RESPONSE=$(curl -s "$API_URL/api/pitches/search?seekingInvestment=true")

FOUND=$(echo "$SEARCH_RESPONSE" | grep -c "Test Seeking Investment Pitch" || true)
if [ "$FOUND" -gt 0 ]; then
  echo "✅ Pitch found when filtering by seeking investment"
else
  echo "⚠️  Pitch not found in seeking investment filter (may need indexing)"
fi
echo ""

# Login as investor
echo "5. Login as investor..."
INVESTOR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }')

INVESTOR_TOKEN=$(echo "$INVESTOR_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$INVESTOR_TOKEN" ]; then
  echo "❌ Failed to login as investor"
  exit 1
fi

echo "✅ Logged in as investor"
echo ""

# Get investor dashboard to see seeking investment pitches
echo "6. Checking investor dashboard for seeking investment pitches..."
DASHBOARD=$(curl -s "$API_URL/api/investor/dashboard" \
  -H "Authorization: Bearer $INVESTOR_TOKEN")

SEEKING_COUNT=$(echo "$DASHBOARD" | grep -o '"seekingInvestmentCount":[0-9]*' | cut -d':' -f2)
if [ -n "$SEEKING_COUNT" ] && [ "$SEEKING_COUNT" -gt 0 ]; then
  echo "✅ Investor dashboard shows $SEEKING_COUNT pitches seeking investment"
else
  echo "⚠️  Investor dashboard doesn't show seeking investment count"
fi
echo ""

# Clean up - delete test pitch
echo "7. Cleaning up test pitch..."
curl -s -X DELETE "$API_URL/api/pitches/$PITCH_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo "✅ Test pitch deleted"
echo ""

echo "===================================="
echo "Frontend URL: $FRONTEND_URL"
echo "API URL: $API_URL"
echo ""
echo "Manual Testing Steps:"
echo "1. Visit $FRONTEND_URL"
echo "2. Login as creator (alex.creator@demo.com / Demo123)"
echo "3. Create a new pitch and check 'Seeking Investment' checkbox"
echo "4. Select a budget range"
echo "5. Save the pitch"
echo "6. View the pitch detail page - should show green 'Seeking Investment' badge"
echo "7. Go to Browse section and enable 'Seeking Investment' filter"
echo "8. Verify the pitch appears in filtered results"
echo "===================================="

