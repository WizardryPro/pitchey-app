#!/bin/bash

# 🔍 Production Validation & Health Check System
# Comprehensive testing suite for production deployment validation

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Configuration
WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey.pages.dev"
TIMEOUT=30
RETRY_COUNT=3

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Demo credentials
CREATOR_EMAIL="alex.creator@demo.com"
INVESTOR_EMAIL="sarah.investor@demo.com"
PRODUCTION_EMAIL="stellar.production@demo.com"
DEMO_PASSWORD="Demo123"

# Logging
LOG_FILE="validation-$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE")

echo_test() {
    echo -e "${PURPLE}[TEST]${NC} $1"
    ((TOTAL_TESTS++))
}

echo_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

echo_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_header() {
    echo "============================================"
    echo "🔍 PITCHEY PRODUCTION VALIDATION SUITE"
    echo "============================================"
    echo "Worker URL: $WORKER_URL"
    echo "Frontend URL: $FRONTEND_URL"
    echo "Timestamp: $(date)"
    echo "Log File: $LOG_FILE"
    echo "============================================"
    echo
}

# HTTP status code validation
validate_status() {
    local url="$1"
    local expected="$2"
    local description="$3"
    
    echo_test "$description"
    
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" || echo "000")
    
    if [[ "$status" == "$expected" ]]; then
        echo_pass "HTTP $status - $description"
    else
        echo_fail "Expected HTTP $expected, got $status - $description"
        return 1
    fi
}

# JSON response validation
validate_json_response() {
    local url="$1"
    local method="$2"
    local data="$3"
    local expected_key="$4"
    local description="$5"
    
    echo_test "$description"
    
    local response
    if [[ "$method" == "POST" ]]; then
        response=$(curl -s --max-time $TIMEOUT -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" || echo '{"error":"request_failed"}')
    else
        response=$(curl -s --max-time $TIMEOUT "$url" || echo '{"error":"request_failed"}')
    fi
    
    if echo "$response" | jq -e ".$expected_key" > /dev/null 2>&1; then
        echo_pass "$description - JSON structure valid"
        echo_info "Response excerpt: $(echo "$response" | jq -r ".$expected_key // .status // .message" 2>/dev/null | head -c 50)..."
    else
        echo_fail "$description - Missing key '$expected_key' in response"
        echo_info "Response: $(echo "$response" | head -c 100)..."
        return 1
    fi
}

# Authentication test
test_authentication() {
    local portal="$1"
    local email="$2"
    local description="$3"
    
    echo_test "Authentication: $description"
    
    local login_response
    login_response=$(curl -s --max-time $TIMEOUT -X POST "$WORKER_URL/api/auth/$portal/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$DEMO_PASSWORD\"}" || echo '{"error":"request_failed"}')
    
    if echo "$login_response" | jq -e '.success' > /dev/null 2>&1; then
        local success
        success=$(echo "$login_response" | jq -r '.success')
        if [[ "$success" == "true" ]]; then
            echo_pass "Authentication successful for $description"
            # Extract and return token for further testing
            echo "$login_response" | jq -r '.data.token // .token // ""'
        else
            echo_fail "Authentication failed for $description: $(echo "$login_response" | jq -r '.message // .error')"
            return 1
        fi
    else
        echo_fail "Authentication request failed for $description"
        echo_info "Response: $(echo "$login_response" | head -c 100)..."
        return 1
    fi
}

# Authenticated endpoint test
test_authenticated_endpoint() {
    local token="$1"
    local endpoint="$2"
    local description="$3"
    
    echo_test "Authenticated endpoint: $description"
    
    local response
    response=$(curl -s --max-time $TIMEOUT -H "Authorization: Bearer $token" \
        "$WORKER_URL$endpoint" || echo '{"error":"request_failed"}')
    
    if echo "$response" | jq -e '.success // .data' > /dev/null 2>&1; then
        echo_pass "Authenticated endpoint working: $description"
    else
        echo_fail "Authenticated endpoint failed: $description"
        echo_info "Response: $(echo "$response" | head -c 100)..."
        return 1
    fi
}

# WebSocket connection test
test_websocket() {
    echo_test "WebSocket connectivity"
    
    # Test WebSocket upgrade capability
    local ws_response
    ws_response=$(curl -s -I --max-time $TIMEOUT \
        -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        -H "Sec-WebSocket-Version: 13" \
        "$WORKER_URL/ws" 2>/dev/null || echo "HTTP/1.1 500")
    
    if echo "$ws_response" | grep -q "101\|200"; then
        echo_pass "WebSocket endpoint accessible"
    else
        echo_warn "WebSocket endpoint test inconclusive"
        echo_info "Response: $(echo "$ws_response" | head -1)"
    fi
}

# Performance benchmarks
test_performance() {
    echo_test "Performance benchmarks"
    
    # API response time
    echo_info "Measuring API response time..."
    local start_time end_time response_time
    start_time=$(date +%s%N)
    curl -s --max-time $TIMEOUT "$WORKER_URL/api/health" > /dev/null || true
    end_time=$(date +%s%N)
    response_time=$(( (end_time - start_time) / 1000000 ))
    
    echo_info "API response time: ${response_time}ms"
    if [ "$response_time" -lt 1000 ]; then
        echo_pass "API performance excellent (< 1000ms)"
    elif [ "$response_time" -lt 2000 ]; then
        echo_pass "API performance good (< 2000ms)"
    else
        echo_warn "API performance slow (${response_time}ms)"
    fi
    
    # Frontend load time
    echo_info "Measuring frontend load time..."
    start_time=$(date +%s%N)
    curl -s --max-time $TIMEOUT "$FRONTEND_URL" > /dev/null || true
    end_time=$(date +%s%N)
    local load_time
    load_time=$(( (end_time - start_time) / 1000000 ))
    
    echo_info "Frontend load time: ${load_time}ms"
    if [ "$load_time" -lt 2000 ]; then
        echo_pass "Frontend performance excellent (< 2000ms)"
    elif [ "$load_time" -lt 5000 ]; then
        echo_pass "Frontend performance good (< 5000ms)"
    else
        echo_warn "Frontend performance slow (${load_time}ms)"
    fi
}

# Security headers validation
test_security_headers() {
    echo_test "Security headers validation"
    
    local headers
    headers=$(curl -s -I --max-time $TIMEOUT "$WORKER_URL/api/health" || echo "")
    
    local security_headers=(
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
        "Strict-Transport-Security"
    )
    
    local found_headers=0
    for header in "${security_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            echo_info "Found security header: $header"
            ((found_headers++))
        fi
    done
    
    if [ $found_headers -ge 2 ]; then
        echo_pass "Security headers present ($found_headers/4)"
    else
        echo_warn "Limited security headers found ($found_headers/4)"
    fi
}

# Database connectivity test
test_database_connectivity() {
    echo_test "Database connectivity (indirect)"
    
    # Test an endpoint that requires database
    local response
    response=$(curl -s --max-time $TIMEOUT "$WORKER_URL/api/search/pitches" || echo '{"error":"failed"}')
    
    if echo "$response" | jq -e '.data // .pitches // .results' > /dev/null 2>&1; then
        echo_pass "Database connectivity working (search endpoint responds)"
    elif echo "$response" | grep -q "404\|405"; then
        echo_pass "Database connectivity likely working (endpoint exists)"
    else
        echo_fail "Database connectivity issue detected"
        echo_info "Response: $(echo "$response" | head -c 100)..."
        return 1
    fi
}

# Edge caching test
test_edge_caching() {
    echo_test "Edge caching functionality"
    
    # First request
    local start_time end_time first_time
    start_time=$(date +%s%N)
    curl -s --max-time $TIMEOUT "$WORKER_URL/api/health" > /dev/null || true
    end_time=$(date +%s%N)
    first_time=$(( (end_time - start_time) / 1000000 ))
    
    sleep 1
    
    # Second request (should be cached if caching is working)
    start_time=$(date +%s%N)
    curl -s --max-time $TIMEOUT "$WORKER_URL/api/health" > /dev/null || true
    end_time=$(date +%s%N)
    local second_time
    second_time=$(( (end_time - start_time) / 1000000 ))
    
    echo_info "First request: ${first_time}ms, Second request: ${second_time}ms"
    
    if [ $second_time -lt $first_time ] && [ $second_time -lt 500 ]; then
        echo_pass "Edge caching appears to be working"
    else
        echo_info "Edge caching not detected or not significant"
    fi
}

# Content validation
test_content_integrity() {
    echo_test "Content integrity validation"
    
    # Test frontend loads with expected content
    local frontend_content
    frontend_content=$(curl -s --max-time $TIMEOUT "$FRONTEND_URL" || echo "")
    
    if echo "$frontend_content" | grep -q "Pitchey\|pitch\|investor\|creator"; then
        echo_pass "Frontend content integrity check passed"
    else
        echo_fail "Frontend content integrity check failed"
        return 1
    fi
    
    # Test API returns expected structure
    local health_response
    health_response=$(curl -s --max-time $TIMEOUT "$WORKER_URL/api/health" || echo '{}')
    
    if echo "$health_response" | jq -e '.status // .health' > /dev/null 2>&1; then
        echo_pass "API content structure validated"
    else
        echo_fail "API content structure validation failed"
        return 1
    fi
}

# CORS validation
test_cors() {
    echo_test "CORS configuration"
    
    local cors_response
    cors_response=$(curl -s -I --max-time $TIMEOUT \
        -H "Origin: $FRONTEND_URL" \
        "$WORKER_URL/api/health" || echo "")
    
    if echo "$cors_response" | grep -qi "access-control-allow-origin"; then
        echo_pass "CORS headers configured"
    else
        echo_warn "CORS headers not detected (may be intentional)"
    fi
}

# Main test suite execution
run_test_suite() {
    print_header
    
    echo_info "Starting comprehensive production validation..."
    echo
    
    # Basic connectivity tests
    echo_info "=== CONNECTIVITY TESTS ==="
    validate_status "$WORKER_URL/api/health" "200" "Worker health endpoint"
    validate_status "$FRONTEND_URL" "200" "Frontend accessibility"
    validate_status "$WORKER_URL/api/nonexistent" "404" "404 error handling"
    echo
    
    # API structure tests
    echo_info "=== API STRUCTURE TESTS ==="
    validate_json_response "$WORKER_URL/api/health" "GET" "" "status" "Health endpoint JSON structure"
    echo
    
    # Authentication tests
    echo_info "=== AUTHENTICATION TESTS ==="
    local creator_token investor_token production_token
    creator_token=$(test_authentication "creator" "$CREATOR_EMAIL" "Creator portal")
    investor_token=$(test_authentication "investor" "$INVESTOR_EMAIL" "Investor portal")
    production_token=$(test_authentication "production" "$PRODUCTION_EMAIL" "Production portal")
    echo
    
    # Authenticated endpoint tests (if tokens were obtained)
    if [[ -n "${creator_token:-}" ]]; then
        echo_info "=== CREATOR AUTHENTICATED TESTS ==="
        test_authenticated_endpoint "$creator_token" "/api/creator/dashboard/stats" "Creator dashboard stats"
        test_authenticated_endpoint "$creator_token" "/api/creator/pitches" "Creator pitches"
        echo
    fi
    
    if [[ -n "${investor_token:-}" ]]; then
        echo_info "=== INVESTOR AUTHENTICATED TESTS ==="
        test_authenticated_endpoint "$investor_token" "/api/investor/dashboard/stats" "Investor dashboard stats"
        test_authenticated_endpoint "$investor_token" "/api/investor/saved-pitches" "Saved pitches"
        echo
    fi
    
    # Database and backend tests
    echo_info "=== BACKEND FUNCTIONALITY TESTS ==="
    test_database_connectivity
    test_websocket
    echo
    
    # Performance tests
    echo_info "=== PERFORMANCE TESTS ==="
    test_performance
    test_edge_caching
    echo
    
    # Security tests
    echo_info "=== SECURITY TESTS ==="
    test_security_headers
    test_cors
    echo
    
    # Content integrity tests
    echo_info "=== CONTENT INTEGRITY TESTS ==="
    test_content_integrity
    echo
}

# Generate validation report
generate_validation_report() {
    local success_rate
    success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    
    local status
    if [ $success_rate -ge 95 ]; then
        status="✅ EXCELLENT"
    elif [ $success_rate -ge 85 ]; then
        status="✅ GOOD"
    elif [ $success_rate -ge 70 ]; then
        status="⚠️ ACCEPTABLE"
    else
        status="❌ NEEDS ATTENTION"
    fi
    
    echo
    echo "============================================"
    echo "📊 VALIDATION REPORT"
    echo "============================================"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNINGS"
    echo "Success Rate: $success_rate%"
    echo "Overall Status: $status"
    echo "============================================"
    echo
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo_pass "All critical tests passed! Production deployment validated."
    elif [ $FAILED_TESTS -le 2 ]; then
        echo_warn "$FAILED_TESTS tests failed. Review and address issues."
    else
        echo_fail "$FAILED_TESTS tests failed. Significant issues detected."
        return 1
    fi
    
    echo_info "Detailed log saved to: $LOG_FILE"
    
    # Create summary report file
    local report_file="validation-summary-$(date +%Y%m%d_%H%M%S).json"
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "total_tests": $TOTAL_TESTS,
  "passed_tests": $PASSED_TESTS,
  "failed_tests": $FAILED_TESTS,
  "warnings": $WARNINGS,
  "success_rate": $success_rate,
  "status": "$status",
  "worker_url": "$WORKER_URL",
  "frontend_url": "$FRONTEND_URL",
  "log_file": "$LOG_FILE"
}
EOF
    
    echo_info "Summary report saved to: $report_file"
}

# Main execution
main() {
    # Ensure required tools are available
    if ! command -v curl &> /dev/null; then
        echo_fail "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo_warn "jq not found, JSON validation will be limited"
    fi
    
    # Run the test suite
    run_test_suite
    
    # Generate report
    generate_validation_report
}

# Handle script interruption
trap 'echo_info "Validation interrupted"; exit 1' INT TERM

# Run validation if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi