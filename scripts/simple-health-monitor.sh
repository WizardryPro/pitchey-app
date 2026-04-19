#!/bin/bash

# 🏥 Simple Production Health Monitor
# Lightweight monitoring script that works with CI/CD pipeline

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey.pages.dev}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-3}" # seconds
LOG_FILE="${LOG_FILE:-./monitoring/logs/health-monitor.log}"
ALERT_LOG="${ALERT_LOG:-./monitoring/logs/alerts.log}"
STATUS_FILE="${STATUS_FILE:-./monitoring/logs/latest.json}"

# Create log directories
mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$ALERT_LOG")" "$(dirname "$STATUS_FILE")"

# Health check counters
TOTAL_CHECKS=0
FAILED_CHECKS=0
CRITICAL_FAILURES=0

# JSON output for CI/CD integration
JSON_OUTPUT="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"checks\":[]}"

echo -e "${CYAN}🏥 Pitchey Production Health Monitor${NC}"
echo "========================================="
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo "Timestamp: $(date)"
echo ""

# Function to log results
log_result() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    if [ "$level" = "CRITICAL" ] || [ "$level" = "ERROR" ]; then
        echo "[$timestamp] [$level] $message" >> "$ALERT_LOG"
    fi
}

# Function to add JSON check result
add_json_result() {
    local check_name="$1"
    local status="$2"
    local response_time="${3:-0}"
    local message="${4:-}"
    
    local check_json="{\"name\":\"$check_name\",\"status\":\"$status\",\"response_time\":$response_time,\"message\":\"$message\"}"
    JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq ".checks += [$check_json]")
}

# Function to perform health check with timing
health_check() {
    local name="$1"
    local url="$2"
    local expected="${3:-}"
    local timeout="${4:-10}"
    
    ((TOTAL_CHECKS++))
    
    echo -n "🔍 Checking $name... "
    
    local start_time=$(date +%s.%N)
    local http_code
    local response
    
    if response=$(timeout "$timeout" curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
        local end_time=$(date +%s.%N)
        local response_time=$(echo "$end_time - $start_time" | bc)
        
        if [ "$response" = "200" ] || [ "$response" = "302" ]; then
            echo -e "${GREEN}✅ OK${NC} (${response_time}s)"
            log_result "INFO" "$name: OK - $response in ${response_time}s"
            add_json_result "$name" "healthy" "$response_time" "HTTP $response"
            
            # Check response time
            if (( $(echo "$response_time > $ALERT_THRESHOLD" | bc -l) )); then
                echo -e "  ${YELLOW}⚠️  Slow response: ${response_time}s > ${ALERT_THRESHOLD}s${NC}"
                log_result "WARNING" "$name: Slow response - ${response_time}s"
            fi
            
            return 0
        else
            echo -e "${RED}❌ HTTP $response${NC}"
            log_result "ERROR" "$name: HTTP error - $response"
            add_json_result "$name" "failed" "$response_time" "HTTP $response"
            ((FAILED_CHECKS++))
            return 1
        fi
    else
        echo -e "${RED}❌ TIMEOUT/ERROR${NC}"
        log_result "CRITICAL" "$name: Timeout or connection error"
        add_json_result "$name" "failed" "0" "Timeout or connection error"
        ((FAILED_CHECKS++))
        ((CRITICAL_FAILURES++))
        return 1
    fi
}

# Function to test API endpoint with JSON response
api_endpoint_check() {
    local name="$1"
    local endpoint="$2"
    local expected_field="${3:-}"
    
    ((TOTAL_CHECKS++))
    
    echo -n "🔍 Testing API $name... "
    
    local start_time=$(date +%s.%N)
    local response
    
    if response=$(timeout 10 curl -s "$API_URL$endpoint" 2>/dev/null); then
        local end_time=$(date +%s.%N)
        local response_time=$(echo "$end_time - $start_time" | bc)
        
        if echo "$response" | jq . > /dev/null 2>&1; then
            # Valid JSON
            if [ -n "$expected_field" ]; then
                if echo "$response" | jq -e ".$expected_field" > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ OK${NC} (${response_time}s)"
                    log_result "INFO" "$name: API working - ${response_time}s"
                    add_json_result "$name" "healthy" "$response_time" "Valid JSON with expected field"
                    return 0
                else
                    echo -e "${YELLOW}⚠️  Missing field: $expected_field${NC}"
                    log_result "WARNING" "$name: Missing expected field - $expected_field"
                    add_json_result "$name" "degraded" "$response_time" "Missing expected field: $expected_field"
                    return 1
                fi
            else
                echo -e "${GREEN}✅ OK${NC} (${response_time}s)"
                log_result "INFO" "$name: API working - ${response_time}s"
                add_json_result "$name" "healthy" "$response_time" "Valid JSON response"
                return 0
            fi
        else
            echo -e "${RED}❌ Invalid JSON${NC}"
            log_result "ERROR" "$name: Invalid JSON response"
            add_json_result "$name" "failed" "$response_time" "Invalid JSON response"
            ((FAILED_CHECKS++))
            return 1
        fi
    else
        echo -e "${RED}❌ TIMEOUT/ERROR${NC}"
        log_result "CRITICAL" "$name: API timeout or error"
        add_json_result "$name" "failed" "0" "API timeout or error"
        ((FAILED_CHECKS++))
        ((CRITICAL_FAILURES++))
        return 1
    fi
}

# Function to test authentication
auth_check() {
    local user_type="$1"
    local email="$2"
    local password="$3"
    
    ((TOTAL_CHECKS++))
    
    echo -n "🔐 Testing $user_type auth... "
    
    local start_time=$(date +%s.%N)
    local response
    local http_code
    
    response=$(timeout 10 curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/sign-in" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    local end_time=$(date +%s.%N)
    local response_time=$(echo "$end_time - $start_time" | bc)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ OK${NC} (${response_time}s)"
        log_result "INFO" "$user_type auth: Working - ${response_time}s"
        add_json_result "${user_type}_auth" "healthy" "$response_time" "Authentication successful"
        return 0
    else
        echo -e "${RED}❌ HTTP $http_code${NC}"
        log_result "ERROR" "$user_type auth: Failed - HTTP $http_code"
        add_json_result "${user_type}_auth" "failed" "$response_time" "HTTP $http_code"
        ((FAILED_CHECKS++))
        return 1
    fi
}

# =================================================================
# CORE HEALTH CHECKS
# =================================================================

echo -e "${BLUE}🏗️ INFRASTRUCTURE HEALTH${NC}"
echo "-------------------------"

health_check "API Health" "$API_URL/api/health"
health_check "Frontend" "$FRONTEND_URL"

echo ""
echo -e "${BLUE}🔐 AUTHENTICATION HEALTH${NC}"
echo "-------------------------"

auth_check "Creator" "alex.creator@demo.com" "Demo123"
auth_check "Investor" "sarah.investor@demo.com" "Demo123"
auth_check "Production" "stellar.production@demo.com" "Demo123"

echo ""
echo -e "${BLUE}📊 API ENDPOINTS HEALTH${NC}"
echo "------------------------"

api_endpoint_check "Pitches List" "/api/pitches?limit=1" "data"
api_endpoint_check "Categories" "/api/categories" "data"
api_endpoint_check "Trending" "/api/pitches/trending" "data"

# =================================================================
# ADVANCED CHECKS (if enabled)
# =================================================================

if [ "${COMPREHENSIVE:-false}" = "true" ]; then
    echo ""
    echo -e "${BLUE}🔍 COMPREHENSIVE CHECKS${NC}"
    echo "-----------------------"
    
    health_check "Database Query" "$API_URL/api/pitches/1"
    api_endpoint_check "Search" "/api/pitches/search?q=movie" "results"
    health_check "User Followers" "$API_URL/api/users/1/followers"
fi

# =================================================================
# SUMMARY AND ALERTING
# =================================================================

echo ""
echo "========================================="
echo -e "${CYAN}📊 HEALTH CHECK SUMMARY${NC}"
echo "========================================="

# Calculate success rate
SUCCESS_RATE=$(( (TOTAL_CHECKS - FAILED_CHECKS) * 100 / TOTAL_CHECKS ))

echo "Total Checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$((TOTAL_CHECKS - FAILED_CHECKS))${NC}"
echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
echo -e "Critical Failures: ${RED}$CRITICAL_FAILURES${NC}"
echo "Success Rate: $SUCCESS_RATE%"

# Add summary to JSON
JSON_OUTPUT=$(echo "$JSON_OUTPUT" | jq ".summary = {\"total\":$TOTAL_CHECKS,\"passed\":$((TOTAL_CHECKS - FAILED_CHECKS)),\"failed\":$FAILED_CHECKS,\"critical\":$CRITICAL_FAILURES,\"success_rate\":$SUCCESS_RATE}")

# Save JSON status
echo "$JSON_OUTPUT" > "$STATUS_FILE"

echo ""

# Determine overall status and exit code
if [ $CRITICAL_FAILURES -gt 0 ]; then
    echo -e "${RED}🚨 CRITICAL: Production system has critical failures!${NC}"
    log_result "CRITICAL" "Health check failed: $CRITICAL_FAILURES critical failures"
    exit 2
elif [ $SUCCESS_RATE -lt 80 ]; then
    echo -e "${RED}❌ UNHEALTHY: System performance is below acceptable levels${NC}"
    log_result "ERROR" "Health check failed: Success rate $SUCCESS_RATE% < 80%"
    exit 1
elif [ $SUCCESS_RATE -lt 95 ]; then
    echo -e "${YELLOW}⚠️ DEGRADED: Some issues detected, monitoring recommended${NC}"
    log_result "WARNING" "Health check degraded: Success rate $SUCCESS_RATE%"
    exit 0
else
    echo -e "${GREEN}✅ HEALTHY: All systems operational${NC}"
    log_result "INFO" "Health check passed: Success rate $SUCCESS_RATE%"
    exit 0
fi