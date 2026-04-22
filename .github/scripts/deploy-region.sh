#!/bin/bash

# Multi-Region Deployment Script
# Usage: ./deploy-region.sh <region> <environment>

set -e

REGION=$1
ENVIRONMENT=${2:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️ $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Validate inputs
if [ -z "$REGION" ]; then
    error "Region is required. Usage: $0 <region> <environment>"
    exit 1
fi

# Region configuration mapping
configure_region() {
    case "$REGION" in
        us-east)
            WORKER_NAME="pitchey-$ENVIRONMENT-use1"
            PAGES_PROJECT="pitchey-$ENVIRONMENT-use1"
            SUBDOMAIN_PREFIX="use1"
            DATA_CENTER="IAD"
            ;;
        us-west)
            WORKER_NAME="pitchey-$ENVIRONMENT-usw2"
            PAGES_PROJECT="pitchey-$ENVIRONMENT-usw2"
            SUBDOMAIN_PREFIX="usw2"
            DATA_CENTER="SJC"
            ;;
        us-central)
            WORKER_NAME="pitchey-$ENVIRONMENT-usc1"
            PAGES_PROJECT="pitchey-$ENVIRONMENT-usc1"
            SUBDOMAIN_PREFIX="usc1"
            DATA_CENTER="DFW"
            ;;
        eu-west)
            WORKER_NAME="pitchey-$ENVIRONMENT-euw1"
            PAGES_PROJECT="pitchey-$ENVIRONMENT-euw1"
            SUBDOMAIN_PREFIX="euw1"
            DATA_CENTER="LHR"
            ;;
        eu-central)
            WORKER_NAME="pitchey-$ENVIRONMENT-euc1"
            PAGES_PROJECT="pitchey-$ENVIRONMENT-euc1"
            SUBDOMAIN_PREFIX="euc1"
            DATA_CENTER="FRA"
            ;;
        asia-pacific)
            WORKER_NAME="pitchey-$ENVIRONMENT-ap1"
            PAGES_PROJECT="pitchey-$ENVIRONMENT-ap1"
            SUBDOMAIN_PREFIX="ap1"
            DATA_CENTER="SIN"
            ;;
        ap-southeast)
            WORKER_NAME="pitchey-$ENVIRONMENT-apse2"
            PAGES_PROJECT="pitchey-$ENVIRONMENT-apse2"
            SUBDOMAIN_PREFIX="apse2"
            DATA_CENTER="SIN"
            ;;
        ap-northeast)
            WORKER_NAME="pitchey-$ENVIRONMENT-apne1"
            PAGES_PROJECT="pitchey-$ENVIRONMENT-apne1"
            SUBDOMAIN_PREFIX="apne1"
            DATA_CENTER="NRT"
            ;;
        *)
            error "Unknown region: $REGION"
            exit 1
            ;;
    esac
}

# Create region-specific configuration
create_region_config() {
    log "Creating region-specific configuration for $REGION..."
    
    cd "$PROJECT_ROOT"
    
    # Determine KV namespace based on environment and region
    if [ "$ENVIRONMENT" == "production" ]; then
        KV_ID="${CLOUDFLARE_KV_ID:-98c88a185eb448e4868fcc87e458b3ac}"
        R2_BUCKET="pitchey-uploads"
    else
        KV_ID="${CLOUDFLARE_KV_ID_STAGING:-staging-kv-id}"
        R2_BUCKET="pitchey-uploads-staging"
    fi
    
    # Create region-specific wrangler.toml
    cat > "wrangler-$REGION.toml" << EOF
name = "$WORKER_NAME"
main = "src/worker-production-db.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
account_id = "$CLOUDFLARE_ACCOUNT_ID"

[vars]
ENVIRONMENT = "$ENVIRONMENT"
REGION = "$REGION"
DATA_CENTER = "$DATA_CENTER"
FRONTEND_URL = "https://$SUBDOMAIN_PREFIX.pitchey-5o8.pages.dev"

# Regional KV namespace
[[kv_namespaces]]
binding = "KV"
id = "$KV_ID"

# Regional R2 bucket (with path prefix)
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "$R2_BUCKET"

# Durable Objects (shared across regions)
[[durable_objects.bindings]]
name = "WEBSOCKET_ROOM"
class_name = "WebSocketRoom"

[[durable_objects.bindings]]
name = "NOTIFICATION_ROOM" 
class_name = "NotificationRoom"

# Regional routes
[[routes]]
pattern = "$SUBDOMAIN_PREFIX-api.pitchey.com/*"
zone_id = "$CLOUDFLARE_ZONE_ID"

# Performance optimizations for region
[build]
command = ""

[vars.REGION_CONFIG]
PREFERRED_DATA_CENTER = "$DATA_CENTER"
LATENCY_TARGET_MS = "50"
ERROR_BUDGET = "0.1"
EOF
    
    success "Regional configuration created: wrangler-$REGION.toml"
}

# Deploy worker to region
deploy_worker() {
    log "Deploying worker to $REGION..."
    
    cd "$PROJECT_ROOT"
    
    # Validate configuration file exists
    if [ ! -f "wrangler-$REGION.toml" ]; then
        error "Region configuration file not found: wrangler-$REGION.toml"
        return 1
    fi
    
    # Deploy using region-specific config
    if wrangler deploy --config "wrangler-$REGION.toml" --compatibility-date=2024-11-01; then
        success "Worker deployed successfully to $REGION"
    else
        error "Worker deployment failed for $REGION"
        return 1
    fi
    
    # Clean up temporary config file
    rm -f "wrangler-$REGION.toml"
}

# Health check region deployment
health_check_region() {
    log "Performing health check for $REGION deployment..."
    
    HEALTH_URL="https://$WORKER_NAME.ndlovucavelle.workers.dev/api/health"
    MAX_ATTEMPTS=20
    RETRY_INTERVAL=15
    
    for i in $(seq 1 $MAX_ATTEMPTS); do
        log "Health check attempt $i/$MAX_ATTEMPTS for $REGION..."
        
        # Perform health check
        RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" "$HEALTH_URL" || echo "HTTPSTATUS:000;TIME:0")
        HTTP_CODE=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://' | cut -d';' -f1)
        TIME_TOTAL=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*TIME://')
        BODY=$(echo "$RESPONSE" | sed -E 's/HTTPSTATUS:.*$//')
        
        if [ "$HTTP_CODE" -eq 200 ]; then
            success "Health check passed for $REGION (${TIME_TOTAL}s)"
            
            # Parse health response for additional validation
            if command -v jq >/dev/null 2>&1; then
                REPORTED_REGION=$(echo "$BODY" | jq -r '.region // "unknown"' 2>/dev/null)
                REPORTED_ENV=$(echo "$BODY" | jq -r '.environment // "unknown"' 2>/dev/null)
                REPORTED_STATUS=$(echo "$BODY" | jq -r '.status // "unknown"' 2>/dev/null)
                
                log "Health check details:"
                log "  - Region: $REPORTED_REGION"
                log "  - Environment: $REPORTED_ENV"
                log "  - Status: $REPORTED_STATUS"
                log "  - Response Time: ${TIME_TOTAL}s"
                
                # Validate region matches
                if [ "$REPORTED_REGION" != "$REGION" ] && [ "$REPORTED_REGION" != "unknown" ]; then
                    warning "Region mismatch: expected $REGION, got $REPORTED_REGION"
                fi
            fi
            
            return 0
        fi
        
        warning "Health check failed: HTTP $HTTP_CODE (attempt $i/$MAX_ATTEMPTS)"
        
        if [ $i -lt $MAX_ATTEMPTS ]; then
            log "Retrying in ${RETRY_INTERVAL}s..."
            sleep $RETRY_INTERVAL
        fi
    done
    
    error "Health check failed for $REGION after $MAX_ATTEMPTS attempts"
    return 1
}

# Configure regional DNS
configure_regional_dns() {
    log "Configuring regional DNS for $REGION..."
    
    # Skip DNS configuration if no zone ID provided
    if [ -z "$CLOUDFLARE_ZONE_ID" ]; then
        warning "CLOUDFLARE_ZONE_ID not set, skipping DNS configuration"
        return 0
    fi
    
    # Create regional API subdomain
    DNS_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{
            "type": "CNAME",
            "name": "'$SUBDOMAIN_PREFIX'-api",
            "content": "'$WORKER_NAME'.ndlovucavelle.workers.dev",
            "ttl": 300,
            "comment": "Regional API endpoint for '$REGION'"
        }')
    
    SUCCESS=$(echo "$DNS_RESPONSE" | jq -r '.success // false')
    if [ "$SUCCESS" == "true" ]; then
        success "DNS record created: $SUBDOMAIN_PREFIX-api.pitchey.com -> $WORKER_NAME.ndlovucavelle.workers.dev"
    else
        ERROR_MSG=$(echo "$DNS_RESPONSE" | jq -r '.errors[0].message // "Unknown error"')
        if echo "$ERROR_MSG" | grep -q "already exists"; then
            warning "DNS record already exists for $SUBDOMAIN_PREFIX-api.pitchey.com"
        else
            error "Failed to create DNS record: $ERROR_MSG"
            return 1
        fi
    fi
}

# Performance test
performance_test() {
    log "Running performance test for $REGION..."
    
    HEALTH_URL="https://$WORKER_NAME.ndlovucavelle.workers.dev/api/health"
    SAMPLES=5
    TOTAL_TIME=0
    
    for i in $(seq 1 $SAMPLES); do
        TIME_TOTAL=$(curl -s -w "%{time_total}" -o /dev/null "$HEALTH_URL")
        TOTAL_TIME=$(echo "$TOTAL_TIME + $TIME_TOTAL" | bc -l)
        log "Performance sample $i/$SAMPLES: ${TIME_TOTAL}s"
    done
    
    AVG_TIME=$(echo "scale=3; $TOTAL_TIME / $SAMPLES" | bc -l)
    log "Average response time for $REGION: ${AVG_TIME}s"
    
    # Check if performance is acceptable
    if (( $(echo "$AVG_TIME > 2.0" | bc -l) )); then
        warning "Performance warning: Average response time (${AVG_TIME}s) exceeds 2s threshold"
    else
        success "Performance test passed for $REGION"
    fi
}

# Cleanup on error
cleanup() {
    log "Cleaning up temporary files..."
    rm -f "$PROJECT_ROOT/wrangler-$REGION.toml"
}

# Main execution
main() {
    log "Starting deployment to region: $REGION (environment: $ENVIRONMENT)"
    
    # Set up error handling
    trap cleanup ERR EXIT
    
    # Configure region settings
    configure_region
    
    log "Region configuration:"
    log "  - Worker Name: $WORKER_NAME"
    log "  - Subdomain: $SUBDOMAIN_PREFIX"
    log "  - Data Center: $DATA_CENTER"
    
    # Create and deploy
    create_region_config
    deploy_worker
    health_check_region
    configure_regional_dns
    performance_test
    
    success "✅ Successfully deployed to $REGION!"
    
    # Display access URLs
    log "Access URLs:"
    log "  - Worker: https://$WORKER_NAME.ndlovucavelle.workers.dev"
    log "  - Regional API: https://$SUBDOMAIN_PREFIX-api.pitchey.com"
    log "  - Health Check: https://$WORKER_NAME.ndlovucavelle.workers.dev/api/health"
}

# Execute main function
main "$@"