#!/bin/bash

# Comprehensive Validation and Smoke Testing Suite
# Validates deployments and performs health checks for Pitchey platform

set -euo pipefail

# Configuration
PROJECT_ROOT="${PROJECT_ROOT:-/home/supremeisbeing/pitcheymovie/pitchey_v0.2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE_URL="${API_BASE_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey.pages.dev}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-30}"
MAX_RETRIES="${MAX_RETRIES:-3}"
PARALLEL_TESTS="${PARALLEL_TESTS:-5}"

# Test configuration
DEMO_CREATOR_EMAIL="alex.creator@demo.com"
DEMO_INVESTOR_EMAIL="sarah.investor@demo.com"
DEMO_PRODUCTION_EMAIL="stellar.production@demo.com"
DEMO_PASSWORD="Demo123"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging setup
setup_logging() {
    local log_dir="${PROJECT_ROOT}/logs/validation"
    mkdir -p "$log_dir"
    exec 1> >(tee -a "${log_dir}/validation-$(date +%Y%m%d-%H%M%S).log")
    exec 2> >(tee -a "${log_dir}/validation-errors-$(date +%Y%m%d-%H%M%S).log" >&2)
}

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $*${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $*${NC}" >&2
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  $*${NC}"
}

# Test result tracking
TEST_RESULTS=()
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

add_test_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$status" == "PASS" ]]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        log_success "$test_name: $details"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log_error "$test_name: $details"
    fi
    
    TEST_RESULTS+=("$test_name|$status|$details")
}

# HTTP utility functions
http_get() {
    local url="$1"
    local expected_status="${2:-200}"
    local headers="${3:-}"
    
    local response status_code
    
    if [[ -n "$headers" ]]; then
        response=$(curl -s -w "\n%{http_code}" -H "$headers" --max-time "$TIMEOUT_SECONDS" "$url" || echo "000")
    else
        response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT_SECONDS" "$url" || echo "000")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    
    if [[ "$status_code" == "$expected_status" ]]; then
        echo "PASS|$status_code"
    else
        echo "FAIL|Expected $expected_status, got $status_code"
    fi
}

http_post() {
    local url="$1"
    local data="$2"
    local expected_status="${3:-200}"
    local headers="${4:-Content-Type: application/json}"
    
    local response status_code
    response=$(curl -s -w "\n%{http_code}" -X POST -H "$headers" -d "$data" --max-time "$TIMEOUT_SECONDS" "$url" || echo "000")
    status_code=$(echo "$response" | tail -n1)
    
    if [[ "$status_code" == "$expected_status" ]]; then
        echo "PASS|$status_code"
    else
        echo "FAIL|Expected $expected_status, got $status_code"
    fi
}

# Basic connectivity tests
test_basic_connectivity() {
    log "Running basic connectivity tests..."
    
    # Test API health endpoint
    local result
    result=$(http_get "${API_BASE_URL}/api/health" 200)
    add_test_result "API Health Check" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Test frontend accessibility
    result=$(http_get "$FRONTEND_URL" 200)
    add_test_result "Frontend Accessibility" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Test DNS resolution
    if nslookup "$(echo "$API_BASE_URL" | cut -d'/' -f3)" >/dev/null 2>&1; then
        add_test_result "DNS Resolution" "PASS" "API domain resolves correctly"
    else
        add_test_result "DNS Resolution" "FAIL" "API domain resolution failed"
    fi
    
    # Test SSL certificate
    local ssl_check
    ssl_check=$(openssl s_client -connect "$(echo "$API_BASE_URL" | cut -d'/' -f3):443" -servername "$(echo "$API_BASE_URL" | cut -d'/' -f3)" < /dev/null 2>/dev/null | grep "Verify return code")
    if [[ "$ssl_check" == *"0 (ok)"* ]]; then
        add_test_result "SSL Certificate" "PASS" "Certificate is valid"
    else
        add_test_result "SSL Certificate" "FAIL" "Certificate validation failed"
    fi
}

# API endpoint tests
test_api_endpoints() {
    log "Testing API endpoints..."
    
    # Core API endpoints
    local endpoints=(
        "/api/health|GET|200"
        "/api/auth/session|GET|401"  # Should return 401 without authentication
        "/api/pitches|GET|200"
        "/api/users/profile|GET|401"  # Should require authentication
        "/api/dashboard/creator|GET|401"
        "/api/dashboard/investor|GET|401"
        "/api/dashboard/production|GET|401"
    )
    
    for endpoint_config in "${endpoints[@]}"; do
        IFS='|' read -r endpoint method expected_status <<< "$endpoint_config"
        
        local result
        if [[ "$method" == "GET" ]]; then
            result=$(http_get "${API_BASE_URL}${endpoint}" "$expected_status")
        else
            result=$(http_post "${API_BASE_URL}${endpoint}" "{}" "$expected_status")
        fi
        
        add_test_result "API ${method} ${endpoint}" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    done
}

# Authentication flow tests
test_authentication_flow() {
    log "Testing authentication flows..."
    
    # Test creator login
    local login_data='{"email":"'$DEMO_CREATOR_EMAIL'","password":"'$DEMO_PASSWORD'"}'
    local result
    result=$(http_post "${API_BASE_URL}/api/auth/sign-in" "$login_data" 200)
    add_test_result "Creator Authentication" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Test investor login
    login_data='{"email":"'$DEMO_INVESTOR_EMAIL'","password":"'$DEMO_PASSWORD'"}'
    result=$(http_post "${API_BASE_URL}/api/auth/sign-in" "$login_data" 200)
    add_test_result "Investor Authentication" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Test production login
    login_data='{"email":"'$DEMO_PRODUCTION_EMAIL'","password":"'$DEMO_PASSWORD'"}'
    result=$(http_post "${API_BASE_URL}/api/auth/sign-in" "$login_data" 200)
    add_test_result "Production Authentication" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Test invalid credentials
    local invalid_data='{"email":"invalid@test.com","password":"wrongpass"}'
    result=$(http_post "${API_BASE_URL}/api/auth/sign-in" "$invalid_data" 401)
    add_test_result "Invalid Credentials Rejection" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
}

# Database connectivity tests
test_database_connectivity() {
    log "Testing database connectivity..."
    
    # Test database health via API
    local result
    result=$(http_get "${API_BASE_URL}/api/health/database" 200)
    add_test_result "Database Health Check" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Test if we can retrieve data (pitches endpoint should work without auth for public pitches)
    result=$(http_get "${API_BASE_URL}/api/pitches?public=true" 200)
    add_test_result "Database Data Retrieval" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
}

# Cache functionality tests
test_cache_functionality() {
    log "Testing cache functionality..."
    
    # Test Redis connectivity via API
    local result
    result=$(http_get "${API_BASE_URL}/api/health/cache" 200)
    add_test_result "Cache Health Check" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Test cache performance by making repeated requests
    local start_time end_time first_request_time cached_request_time
    
    # First request (should hit database)
    start_time=$(date +%s%3N)
    http_get "${API_BASE_URL}/api/pitches" 200 >/dev/null
    end_time=$(date +%s%3N)
    first_request_time=$((end_time - start_time))
    
    # Second request (should hit cache)
    start_time=$(date +%s%3N)
    http_get "${API_BASE_URL}/api/pitches" 200 >/dev/null
    end_time=$(date +%s%3N)
    cached_request_time=$((end_time - start_time))
    
    if [[ $cached_request_time -lt $first_request_time ]]; then
        add_test_result "Cache Performance" "PASS" "Cached response faster: ${cached_request_time}ms vs ${first_request_time}ms"
    else
        add_test_result "Cache Performance" "FAIL" "No performance improvement detected"
    fi
}

# WebSocket connectivity tests
test_websocket_connectivity() {
    log "Testing WebSocket connectivity..."
    
    # Test WebSocket endpoint availability
    local ws_url="${API_BASE_URL/https/wss}/ws"
    
    # Simple WebSocket test using curl
    if command -v wscat >/dev/null 2>&1; then
        # If wscat is available, use it for WebSocket testing
        timeout 10s wscat -c "$ws_url" --execute 'ping' >/dev/null 2>&1
        if [[ $? -eq 0 ]]; then
            add_test_result "WebSocket Connectivity" "PASS" "WebSocket connection successful"
        else
            add_test_result "WebSocket Connectivity" "FAIL" "WebSocket connection failed"
        fi
    else
        # Fallback: Test WebSocket upgrade endpoint
        local result
        result=$(curl -s -I -H "Upgrade: websocket" -H "Connection: Upgrade" "$ws_url" | head -1)
        if [[ "$result" == *"101"* ]] || [[ "$result" == *"200"* ]]; then
            add_test_result "WebSocket Endpoint" "PASS" "WebSocket endpoint responds correctly"
        else
            add_test_result "WebSocket Endpoint" "FAIL" "WebSocket endpoint not responding"
        fi
    fi
}

# File upload tests
test_file_upload_functionality() {
    log "Testing file upload functionality..."
    
    # Create a test file
    local test_file="/tmp/test-upload-$(date +%s).txt"
    echo "Test file content for validation" > "$test_file"
    
    # Test upload endpoint (requires authentication, so expect 401)
    local result
    result=$(curl -s -w "%{http_code}" -F "file=@$test_file" "${API_BASE_URL}/api/upload/test" || echo "000")
    
    if [[ "$result" == "401" ]] || [[ "$result" == "403" ]]; then
        add_test_result "File Upload Endpoint" "PASS" "Upload endpoint properly requires authentication"
    else
        add_test_result "File Upload Endpoint" "FAIL" "Upload endpoint response unexpected: $result"
    fi
    
    # Cleanup
    rm -f "$test_file"
}

# Performance benchmarks
test_performance_benchmarks() {
    log "Running performance benchmarks..."
    
    # Response time test
    local total_time=0
    local num_requests=10
    
    for ((i=1; i<=num_requests; i++)); do
        local start_time end_time request_time
        start_time=$(date +%s%3N)
        http_get "${API_BASE_URL}/api/health" 200 >/dev/null
        end_time=$(date +%s%3N)
        request_time=$((end_time - start_time))
        total_time=$((total_time + request_time))
    done
    
    local avg_response_time=$((total_time / num_requests))
    
    if [[ $avg_response_time -lt 1000 ]]; then
        add_test_result "Average Response Time" "PASS" "${avg_response_time}ms (< 1000ms threshold)"
    else
        add_test_result "Average Response Time" "FAIL" "${avg_response_time}ms (>= 1000ms threshold)"
    fi
    
    # Concurrent request test
    local concurrent_requests=5
    local success_count=0
    
    for ((i=1; i<=concurrent_requests; i++)); do
        {
            if http_get "${API_BASE_URL}/api/health" 200 >/dev/null; then
                ((success_count++))
            fi
        } &
    done
    
    wait  # Wait for all background requests to complete
    
    if [[ $success_count -eq $concurrent_requests ]]; then
        add_test_result "Concurrent Requests" "PASS" "All $concurrent_requests requests successful"
    else
        add_test_result "Concurrent Requests" "FAIL" "Only $success_count/$concurrent_requests requests successful"
    fi
}

# Security validation tests
test_security_validations() {
    log "Running security validation tests..."
    
    # Test HTTPS enforcement
    local http_url="${API_BASE_URL/https/http}"
    local result
    result=$(curl -s -w "%{http_code}" --max-time 10 "$http_url/api/health" || echo "000")
    
    if [[ "$result" == "301" ]] || [[ "$result" == "302" ]] || [[ "$result" == "000" ]]; then
        add_test_result "HTTPS Enforcement" "PASS" "HTTP requests properly redirected or blocked"
    else
        add_test_result "HTTPS Enforcement" "FAIL" "HTTP requests not properly handled: $result"
    fi
    
    # Test security headers
    local headers
    headers=$(curl -s -I "${API_BASE_URL}/api/health")
    
    if echo "$headers" | grep -qi "strict-transport-security"; then
        add_test_result "HSTS Header" "PASS" "Strict-Transport-Security header present"
    else
        add_test_result "HSTS Header" "FAIL" "Strict-Transport-Security header missing"
    fi
    
    if echo "$headers" | grep -qi "x-content-type-options"; then
        add_test_result "Content-Type Options" "PASS" "X-Content-Type-Options header present"
    else
        add_test_result "Content-Type Options" "FAIL" "X-Content-Type-Options header missing"
    fi
    
    # Test CORS configuration
    local cors_response
    cors_response=$(curl -s -I -H "Origin: https://example.com" -H "Access-Control-Request-Method: POST" -X OPTIONS "${API_BASE_URL}/api/auth/sign-in")
    
    if echo "$cors_response" | grep -qi "access-control"; then
        add_test_result "CORS Configuration" "PASS" "CORS headers present"
    else
        add_test_result "CORS Configuration" "WARN" "CORS headers not detected"
    fi
}

# Business logic validation
test_business_logic() {
    log "Testing business logic validation..."
    
    # Test pitch creation workflow (should require authentication)
    local pitch_data='{"title":"Test Pitch","description":"Test Description","genre":"Drama"}'
    local result
    result=$(http_post "${API_BASE_URL}/api/pitches" "$pitch_data" 401)
    add_test_result "Pitch Creation Auth Check" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Test user profile access (should require authentication)
    result=$(http_get "${API_BASE_URL}/api/users/profile" 401)
    add_test_result "Profile Access Auth Check" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Test investment workflow (should require authentication)
    local investment_data='{"pitch_id":"123","amount":10000,"message":"Interested"}'
    result=$(http_post "${API_BASE_URL}/api/investments" "$investment_data" 401)
    add_test_result "Investment Creation Auth Check" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
}

# Container health tests (if applicable)
test_container_health() {
    log "Testing container health..."
    
    # Test if running in containerized environment
    if [[ -f /.dockerenv ]] || grep -q docker /proc/1/cgroup 2>/dev/null; then
        add_test_result "Container Environment" "PASS" "Running in containerized environment"
        
        # Test container resource limits
        if [[ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]]; then
            local memory_limit
            memory_limit=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
            add_test_result "Memory Limit Detection" "PASS" "Memory limit: $memory_limit bytes"
        fi
    else
        add_test_result "Container Environment" "SKIP" "Not running in container"
    fi
    
    # Test application health endpoint
    local result
    result=$(http_get "${API_BASE_URL}/api/health/detailed" 200)
    add_test_result "Detailed Health Check" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
}

# Generate test report
generate_test_report() {
    local output_file="${PROJECT_ROOT}/reports/validation-report-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p "$(dirname "$output_file")"
    
    cat > "$output_file" <<EOF
# Validation and Smoke Test Report

**Generated**: $(date)
**Environment**: $(basename "$API_BASE_URL")
**Total Tests**: $TOTAL_TESTS
**Passed**: $PASSED_TESTS
**Failed**: $FAILED_TESTS
**Success Rate**: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%

## Test Results Summary

| Test Category | Status | Details |
|---------------|---------|---------|
EOF

    # Add test results to report
    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r test_name status details <<< "$result"
        local status_icon
        case "$status" in
            "PASS") status_icon="✅" ;;
            "FAIL") status_icon="❌" ;;
            "SKIP") status_icon="⏭️" ;;
            "WARN") status_icon="⚠️" ;;
            *) status_icon="❓" ;;
        esac
        echo "| $test_name | $status_icon $status | $details |" >> "$output_file"
    done
    
    cat >> "$output_file" <<EOF

## Performance Metrics

- Average API response time measured during tests
- Concurrent request handling capability
- Cache performance impact

## Security Validation

- HTTPS enforcement verification
- Security header presence
- CORS configuration validation
- Authentication requirement enforcement

## Recommendations

EOF

    if [[ $FAILED_TESTS -gt 0 ]]; then
        echo "- **Critical**: $FAILED_TESTS tests failed and require immediate attention" >> "$output_file"
    fi
    
    if [[ $(( (PASSED_TESTS * 100) / TOTAL_TESTS )) -lt 95 ]]; then
        echo "- **Warning**: Success rate below 95% threshold" >> "$output_file"
    fi
    
    echo "- Regular validation testing should be performed after each deployment" >> "$output_file"
    echo "- Consider implementing automated validation in CI/CD pipeline" >> "$output_file"
    
    log_success "Test report generated: $output_file"
}

# Smoke test for post-deployment validation
run_smoke_tests() {
    log "Running smoke tests (essential validations only)..."
    
    # Essential tests for quick post-deployment validation
    test_basic_connectivity
    
    # Quick API health check
    local result
    result=$(http_get "${API_BASE_URL}/api/health" 200)
    add_test_result "API Health" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Basic authentication test
    local login_data='{"email":"'$DEMO_CREATOR_EMAIL'","password":"'$DEMO_PASSWORD'"}'
    result=$(http_post "${API_BASE_URL}/api/auth/sign-in" "$login_data" 200)
    add_test_result "Authentication" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
    
    # Database connectivity
    result=$(http_get "${API_BASE_URL}/api/health/database" 200)
    add_test_result "Database" "$(echo "$result" | cut -d'|' -f1)" "$(echo "$result" | cut -d'|' -f2-)"
}

# Full test suite
run_full_validation() {
    log "Running full validation test suite..."
    
    test_basic_connectivity
    test_api_endpoints
    test_authentication_flow
    test_database_connectivity
    test_cache_functionality
    test_websocket_connectivity
    test_file_upload_functionality
    test_performance_benchmarks
    test_security_validations
    test_business_logic
    test_container_health
}

# Main execution
main() {
    setup_logging
    
    log "Starting Pitchey Platform Validation Suite"
    log "API Base URL: $API_BASE_URL"
    log "Frontend URL: $FRONTEND_URL"
    
    case "${1:-smoke}" in
        "smoke")
            run_smoke_tests
            ;;
        "full")
            run_full_validation
            ;;
        "api")
            test_api_endpoints
            ;;
        "auth")
            test_authentication_flow
            ;;
        "performance")
            test_performance_benchmarks
            ;;
        "security")
            test_security_validations
            ;;
        "business")
            test_business_logic
            ;;
        *)
            echo "Usage: $0 {smoke|full|api|auth|performance|security|business}"
            echo "  smoke: Quick smoke tests for post-deployment validation"
            echo "  full: Complete validation test suite"
            echo "  api: API endpoint tests only"
            echo "  auth: Authentication flow tests only"
            echo "  performance: Performance benchmark tests only"
            echo "  security: Security validation tests only"
            echo "  business: Business logic validation tests only"
            exit 1
            ;;
    esac
    
    log "Validation completed: $PASSED_TESTS/$TOTAL_TESTS tests passed"
    
    generate_test_report
    
    # Exit with appropriate code
    if [[ $FAILED_TESTS -gt 0 ]]; then
        log_error "Validation failed with $FAILED_TESTS failed tests"
        exit 1
    else
        log_success "All validations passed successfully"
        exit 0
    fi
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi