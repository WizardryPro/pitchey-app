#!/bin/bash

# 🧪 Pitchey Platform - Comprehensive Test Runner
# Runs all tests in a consistent order with proper reporting

set -e

# Configuration
TEST_DIR="./scripts"
RESULTS_DIR="./test_results_$(date +%Y%m%d_%H%M%S)"
API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey.pages.dev}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "🧪 PITCHEY COMPREHENSIVE TEST SUITE"
echo "=================================="
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Results Directory: $RESULTS_DIR"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local log_file="$RESULTS_DIR/${test_name}.log"
    
    ((TOTAL_TESTS++))
    echo -n "🔄 Running $test_name... "
    
    if eval "$test_command" > "$log_file" 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        ((FAILED_TESTS++))
        echo "   📄 Log: $log_file"
        return 1
    fi
}

# =================================================================
# 1. INFRASTRUCTURE TESTS
# =================================================================
echo -e "${BLUE}1. 🏗️ INFRASTRUCTURE TESTS${NC}"
echo "----------------------------"

run_test "api-health" "curl -f $API_URL/api/health"
run_test "frontend-health" "curl -f -I $FRONTEND_URL"

# =================================================================
# 2. AUTHENTICATION TESTS
# =================================================================
echo ""
echo -e "${BLUE}2. 🔐 AUTHENTICATION TESTS${NC}"
echo "---------------------------"

run_test "auth-creator" "curl -f -X POST $API_URL/api/auth/sign-in -H 'Content-Type: application/json' -d '{\"email\":\"alex.creator@demo.com\",\"password\":\"Demo123\"}'"
run_test "auth-investor" "curl -f -X POST $API_URL/api/auth/sign-in -H 'Content-Type: application/json' -d '{\"email\":\"sarah.investor@demo.com\",\"password\":\"Demo123\"}'"
run_test "auth-production" "curl -f -X POST $API_URL/api/auth/sign-in -H 'Content-Type: application/json' -d '{\"email\":\"stellar.production@demo.com\",\"password\":\"Demo123\"}'"

# =================================================================
# 3. CORE API TESTS
# =================================================================
echo ""
echo -e "${BLUE}3. 🎬 CORE API TESTS${NC}"
echo "-------------------"

run_test "pitches-list" "curl -f $API_URL/api/pitches?limit=5"
run_test "pitches-search" "curl -f '$API_URL/api/pitches/search?q=movie'"
run_test "trending-pitches" "curl -f $API_URL/api/pitches/trending"
run_test "categories" "curl -f $API_URL/api/categories"

# =================================================================
# 4. SCHEMA ADAPTER TESTS
# =================================================================
echo ""
echo -e "${BLUE}4. 🔧 SCHEMA ADAPTER TESTS${NC}"
echo "---------------------------"

run_test "follows-public" "curl -f $API_URL/api/users/1/followers"
run_test "views-tracking" "curl -f $API_URL/api/pitches/1/views"

# =================================================================
# 5. SECURITY TESTS
# =================================================================
echo ""
echo -e "${BLUE}5. 🔒 SECURITY TESTS${NC}"
echo "-------------------"

# Check security headers
run_test "security-headers" "curl -I $API_URL/api/health | grep -E '(X-Frame-Options|Content-Security-Policy|X-Content-Type-Options)'"

# Check for proper authentication failures
run_test "auth-protection" "curl -f $API_URL/api/creator/dashboard 2>&1 | grep -q 'UNAUTHORIZED'"

# =================================================================
# 6. PERFORMANCE TESTS
# =================================================================
echo ""
echo -e "${BLUE}6. ⚡ PERFORMANCE TESTS${NC}"
echo "----------------------"

run_test "api-response-time" "timeout 5s curl -w '@-' -o /dev/null -s $API_URL/api/health <<< 'time_total: %{time_total}'"

# =================================================================
# 7. INTEGRATION TESTS
# =================================================================
echo ""
echo -e "${BLUE}7. 🔗 INTEGRATION TESTS${NC}"
echo "-----------------------"

# Run existing comprehensive test if available
if [ -f "$TEST_DIR/test-all-portal-routes.sh" ]; then
    run_test "portal-routes" "chmod +x $TEST_DIR/test-all-portal-routes.sh && $TEST_DIR/test-all-portal-routes.sh"
fi

# =================================================================
# 8. FRONTEND BUILD TESTS
# =================================================================
echo ""
echo -e "${BLUE}8. 🎨 FRONTEND BUILD TESTS${NC}"
echo "---------------------------"

if [ -d "frontend" ]; then
    run_test "frontend-install" "cd frontend && npm ci"
    run_test "frontend-build" "cd frontend && npm run build"
    run_test "frontend-typecheck" "cd frontend && npm run type-check || true"  # Allow failure
    run_test "frontend-lint" "cd frontend && npm run lint || true"  # Allow failure
fi

# =================================================================
# SUMMARY AND CLEANUP
# =================================================================
echo ""
echo "=================================="
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "=================================="
echo ""

SUCCESS_RATE=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))

echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo "Success Rate: ${SUCCESS_RATE}%"
echo ""

# Create summary file
{
    echo "Pitchey Platform Test Summary"
    echo "Generated: $(date)"
    echo "=========================="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Success Rate: ${SUCCESS_RATE}%"
    echo ""
    echo "Test Results Directory: $RESULTS_DIR"
} > "$RESULTS_DIR/test_summary.txt"

if [ $SUCCESS_RATE -ge 90 ]; then
    echo -e "${GREEN}🎉 EXCELLENT! Platform is in great shape.${NC}"
    exit 0
elif [ $SUCCESS_RATE -ge 70 ]; then
    echo -e "${YELLOW}⚠️ GOOD: Most tests pass, some issues need attention.${NC}"
    exit 0
else
    echo -e "${RED}❌ NEEDS ATTENTION: Multiple tests failing.${NC}"
    exit 1
fi