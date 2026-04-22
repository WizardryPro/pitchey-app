#!/bin/bash

# Quick Rollback Script
# Usage: ./quick-rollback.sh [version] [environment] [reason]
#
# This script provides a fast way to rollback to the previous version
# when immediate action is required.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLOUDFLARE_API_BASE="https://api.cloudflare.com/client/v4"

# Default values
DEFAULT_ENVIRONMENT="production"
ROLLBACK_TIMEOUT=600  # 10 minutes
HEALTH_CHECK_ATTEMPTS=30

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️ $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
}

bold() {
    echo -e "${BOLD}$1${NC}"
}

# Show help
show_help() {
    cat << EOF
🔄 Quick Rollback Script

USAGE:
    $0 [VERSION] [ENVIRONMENT] [REASON]

ARGUMENTS:
    VERSION      Target version to rollback to (optional, defaults to last good version)
    ENVIRONMENT  Environment to rollback (optional, defaults to production)  
    REASON       Reason for rollback (optional, but recommended for tracking)

EXAMPLES:
    $0                                    # Rollback production to last good version
    $0 1.2.3                             # Rollback production to v1.2.3
    $0 1.2.3 staging                     # Rollback staging to v1.2.3
    $0 1.2.3 production "Critical bug"   # Rollback production with reason

ENVIRONMENT VARIABLES:
    CLOUDFLARE_API_TOKEN    Required - Cloudflare API token
    CLOUDFLARE_ACCOUNT_ID   Required - Cloudflare account ID
    CLOUDFLARE_ZONE_ID      Optional - For DNS operations
    SKIP_HEALTH_CHECK       Optional - Skip post-rollback health checks (true/false)
    DRY_RUN                 Optional - Show what would be done without executing (true/false)

FLAGS:
    -h, --help     Show this help message
    -d, --dry-run  Show what would be done without executing
    -f, --force    Force rollback without confirmation
    -s, --silent   Reduce output verbosity
    -v, --verbose  Increase output verbosity

EOF
}

# Parse command line arguments
parse_arguments() {
    FORCE_MODE=false
    DRY_RUN_MODE=false
    SILENT_MODE=false
    VERBOSE_MODE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--dry-run)
                DRY_RUN_MODE=true
                export DRY_RUN=true
                shift
                ;;
            -f|--force)
                FORCE_MODE=true
                shift
                ;;
            -s|--silent)
                SILENT_MODE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE_MODE=true
                shift
                ;;
            -*)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
            *)
                break
                ;;
        esac
    done
    
    # Parse positional arguments
    TARGET_VERSION=${1:-""}
    ENVIRONMENT=${2:-$DEFAULT_ENVIRONMENT}
    ROLLBACK_REASON=${3:-"Emergency rollback via quick-rollback script"}
}

# Validate environment
validate_environment() {
    log "Validating environment and prerequisites..."
    
    # Check required environment variables
    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        error "CLOUDFLARE_API_TOKEN environment variable is required"
        exit 1
    fi
    
    if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
        error "CLOUDFLARE_ACCOUNT_ID environment variable is required"
        exit 1
    fi
    
    # Check if we're in the project root
    if [ ! -f "$PROJECT_ROOT/wrangler.toml" ]; then
        error "wrangler.toml not found. Please run this script from the project root."
        exit 1
    fi
    
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        error "wrangler CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        error "jq is not installed. Please install it first."
        exit 1
    fi
    
    success "Environment validation passed"
}

# Get current deployment state
get_current_state() {
    log "Getting current deployment state for $ENVIRONMENT..."
    
    # Get current worker
    CURRENT_WORKER_INFO=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "$CLOUDFLARE_API_BASE/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" | \
        jq -r '.result[] | select(.id | contains("pitchey")) | select(.id | contains("'$ENVIRONMENT'")) | {id: .id, created_on: .created_on, modified_on: .modified_on}' | \
        head -1)
    
    if [ "$CURRENT_WORKER_INFO" != "null" ] && [ -n "$CURRENT_WORKER_INFO" ]; then
        CURRENT_WORKER_ID=$(echo "$CURRENT_WORKER_INFO" | jq -r '.id')
        CURRENT_WORKER_MODIFIED=$(echo "$CURRENT_WORKER_INFO" | jq -r '.modified_on')
        
        log "Current worker: $CURRENT_WORKER_ID (modified: $CURRENT_WORKER_MODIFIED)"
    else
        warning "No current worker found for $ENVIRONMENT environment"
        CURRENT_WORKER_ID=""
    fi
    
    # Get current pages deployment
    CURRENT_PAGES_INFO=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "$CLOUDFLARE_API_BASE/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects" | \
        jq -r '.result[] | select(.name | contains("pitchey")) | select(.name | contains("'$ENVIRONMENT'") or (. | contains("'$ENVIRONMENT'") | not and "'$ENVIRONMENT'" == "production")) | {name: .name, created_on: .created_on}' | \
        head -1)
    
    if [ "$CURRENT_PAGES_INFO" != "null" ] && [ -n "$CURRENT_PAGES_INFO" ]; then
        CURRENT_PAGES_NAME=$(echo "$CURRENT_PAGES_INFO" | jq -r '.name')
        log "Current pages: $CURRENT_PAGES_NAME"
    else
        warning "No current pages deployment found for $ENVIRONMENT environment"
        CURRENT_PAGES_NAME=""
    fi
}

# Determine target version
determine_target_version() {
    log "Determining target version for rollback..."
    
    cd "$PROJECT_ROOT"
    
    if [ -n "$TARGET_VERSION" ]; then
        # Validate specified version
        if ! git tag | grep -q "^v$TARGET_VERSION$"; then
            error "Version v$TARGET_VERSION not found in git tags"
            exit 1
        fi
        
        log "Using specified target version: v$TARGET_VERSION"
    else
        # Find last good version (previous to current)
        CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
        
        if [ -n "$CURRENT_TAG" ]; then
            # Get the tag before current
            PREVIOUS_TAG=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -2 | tail -1)
            
            if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$CURRENT_TAG" ]; then
                TARGET_VERSION=$(echo "$PREVIOUS_TAG" | sed 's/^v//')
                log "Auto-detected target version: v$TARGET_VERSION (previous good version)"
            else
                error "Could not determine previous version to rollback to"
                exit 1
            fi
        else
            error "No git tags found. Cannot determine rollback target."
            exit 1
        fi
    fi
    
    # Validate target version is different from current
    if [ -n "$CURRENT_TAG" ]; then
        CURRENT_VERSION=$(echo "$CURRENT_TAG" | sed 's/^v//')
        if [ "$TARGET_VERSION" == "$CURRENT_VERSION" ]; then
            warning "Target version v$TARGET_VERSION is the same as current version"
            if [ "$FORCE_MODE" != "true" ]; then
                error "Use --force to proceed anyway"
                exit 1
            fi
        fi
    fi
}

# Create backup before rollback
create_backup() {
    log "Creating backup before rollback..."
    
    BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="$PROJECT_ROOT/.rollback_backups"
    BACKUP_PATH="$BACKUP_DIR/backup_${BACKUP_TIMESTAMP}"
    
    mkdir -p "$BACKUP_PATH"
    
    # Backup current worker if exists
    if [ -n "$CURRENT_WORKER_ID" ]; then
        curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            "$CLOUDFLARE_API_BASE/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$CURRENT_WORKER_ID" \
            > "$BACKUP_PATH/worker_script.js" || warning "Failed to backup worker script"
        
        curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            "$CLOUDFLARE_API_BASE/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/$CURRENT_WORKER_ID/settings" \
            > "$BACKUP_PATH/worker_settings.json" || warning "Failed to backup worker settings"
    fi
    
    # Backup DNS records if zone ID is available
    if [ -n "$CLOUDFLARE_ZONE_ID" ]; then
        curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            "$CLOUDFLARE_API_BASE/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
            > "$BACKUP_PATH/dns_records.json" || warning "Failed to backup DNS records"
    fi
    
    # Create backup manifest
    cat > "$BACKUP_PATH/manifest.json" << EOF
{
    "timestamp": "$BACKUP_TIMESTAMP",
    "environment": "$ENVIRONMENT",
    "current_worker": "$CURRENT_WORKER_ID",
    "current_pages": "$CURRENT_PAGES_NAME",
    "rollback_target": "v$TARGET_VERSION",
    "reason": "$ROLLBACK_REASON"
}
EOF
    
    success "Backup created at: $BACKUP_PATH"
    echo "$BACKUP_PATH" > "$PROJECT_ROOT/.last_rollback_backup"
}

# Confirm rollback action
confirm_rollback() {
    if [ "$FORCE_MODE" == "true" ] || [ "$DRY_RUN_MODE" == "true" ]; then
        return 0
    fi
    
    bold "\n🚨 ROLLBACK CONFIRMATION 🚨"
    echo
    echo "Environment: $ENVIRONMENT"
    echo "Current version: $(git describe --tags --abbrev=0 2>/dev/null || echo 'unknown')"
    echo "Target version: v$TARGET_VERSION"
    echo "Reason: $ROLLBACK_REASON"
    echo
    echo "Current deployments:"
    [ -n "$CURRENT_WORKER_ID" ] && echo "  - Worker: $CURRENT_WORKER_ID"
    [ -n "$CURRENT_PAGES_NAME" ] && echo "  - Pages: $CURRENT_PAGES_NAME"
    echo
    
    read -p "Are you sure you want to proceed with this rollback? (type 'ROLLBACK' to confirm): " confirmation
    
    if [ "$confirmation" != "ROLLBACK" ]; then
        log "Rollback cancelled by user"
        exit 0
    fi
    
    log "Rollback confirmed, proceeding..."
}

# Execute rollback
execute_rollback() {
    log "Starting rollback to v$TARGET_VERSION..."
    
    cd "$PROJECT_ROOT"
    
    if [ "$DRY_RUN_MODE" == "true" ]; then
        log "DRY RUN MODE - No actual changes will be made"
        echo "Would execute rollback with:"
        echo "  - Target version: v$TARGET_VERSION"
        echo "  - Environment: $ENVIRONMENT"
        echo "  - Worker rollback: Yes"
        echo "  - Pages rollback: Yes"
        return 0
    fi
    
    # Checkout target version
    log "Checking out target version v$TARGET_VERSION..."
    git checkout "v$TARGET_VERSION" || {
        error "Failed to checkout v$TARGET_VERSION"
        exit 1
    }
    
    # Deploy worker
    log "Deploying worker from v$TARGET_VERSION..."
    if wrangler deploy --compatibility-date=2024-11-01; then
        success "Worker deployment completed"
    else
        error "Worker deployment failed"
        
        # Attempt to restore from backup
        warning "Attempting to restore from backup..."
        git checkout main
        exit 1
    fi
    
    # Deploy pages if frontend exists
    if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        log "Building and deploying frontend from v$TARGET_VERSION..."
        
        cd frontend
        
        if npm ci && npm run build; then
            cd ..
            if wrangler pages deploy frontend/dist --project-name=pitchey; then
                success "Pages deployment completed"
            else
                warning "Pages deployment failed, but worker rollback was successful"
            fi
        else
            warning "Frontend build failed, skipping pages deployment"
        fi
        
        cd "$PROJECT_ROOT"
    fi
    
    # Return to main branch
    git checkout main
    
    success "Rollback execution completed"
}

# Health check after rollback
health_check() {
    if [ "$SKIP_HEALTH_CHECK" == "true" ] || [ "$DRY_RUN_MODE" == "true" ]; then
        log "Skipping health check"
        return 0
    fi
    
    log "Performing post-rollback health check..."
    
    # Determine health check URL based on environment
    if [ "$ENVIRONMENT" == "production" ]; then
        HEALTH_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health"
        FRONTEND_URL="https://pitchey-5o8.pages.dev"
    else
        HEALTH_URL="https://pitchey-$ENVIRONMENT.ndlovucavelle.workers.dev/api/health"
        FRONTEND_URL="https://pitchey-$ENVIRONMENT.pages.dev"
    fi
    
    # Wait for propagation
    log "Waiting for changes to propagate..."
    sleep 30
    
    # Check worker health
    log "Checking worker health at $HEALTH_URL..."
    
    for i in $(seq 1 $HEALTH_CHECK_ATTEMPTS); do
        if [ "$VERBOSE_MODE" == "true" ] || [ $((i % 5)) -eq 0 ]; then
            log "Health check attempt $i/$HEALTH_CHECK_ATTEMPTS..."
        fi
        
        RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" "$HEALTH_URL" 2>/dev/null || echo "HTTPSTATUS:000;TIME:0")
        HTTP_CODE=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://' | cut -d';' -f1)
        
        if [ "$HTTP_CODE" -eq 200 ]; then
            success "Worker health check passed"
            break
        fi
        
        if [ $i -eq $HEALTH_CHECK_ATTEMPTS ]; then
            error "Worker health check failed after $HEALTH_CHECK_ATTEMPTS attempts"
            return 1
        fi
        
        sleep 10
    done
    
    # Check frontend health
    log "Checking frontend health at $FRONTEND_URL..."
    
    FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")
    
    if [ "$FRONTEND_CODE" -eq 200 ]; then
        success "Frontend health check passed"
    else
        warning "Frontend health check failed (HTTP $FRONTEND_CODE) but may be acceptable"
    fi
    
    success "Health check completed"
}

# Generate rollback report
generate_report() {
    log "Generating rollback report..."
    
    REPORT_FILE="$PROJECT_ROOT/rollback_report_$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$REPORT_FILE" << EOF
{
    "rollback_id": "quick-rollback-$(date +%Y%m%d_%H%M%S)",
    "timestamp": "$(date -u --iso-8601=seconds)",
    "environment": "$ENVIRONMENT",
    "target_version": "$TARGET_VERSION",
    "reason": "$ROLLBACK_REASON",
    "executed_by": "$(whoami)",
    "script_version": "quick-rollback.sh v1.0",
    "dry_run": $DRY_RUN_MODE,
    "force_mode": $FORCE_MODE,
    "current_state": {
        "worker": "$CURRENT_WORKER_ID",
        "pages": "$CURRENT_PAGES_NAME"
    },
    "backup_location": "$(cat "$PROJECT_ROOT/.last_rollback_backup" 2>/dev/null || echo 'not_created')",
    "status": "completed",
    "urls": {
        "frontend": "$FRONTEND_URL",
        "api": "$HEALTH_URL"
    }
}
EOF
    
    success "Rollback report saved to: $REPORT_FILE"
    
    if [ "$SILENT_MODE" != "true" ]; then
        bold "\n📊 ROLLBACK SUMMARY"
        echo "==================="
        echo "Environment: $ENVIRONMENT"
        echo "Target Version: v$TARGET_VERSION"
        echo "Reason: $ROLLBACK_REASON"
        echo "Status: Completed"
        echo "Report: $REPORT_FILE"
        echo
        echo "URLs:"
        echo "  Frontend: $FRONTEND_URL"
        echo "  API: $HEALTH_URL"
        echo
    fi
}

# Cleanup function
cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Main execution
main() {
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Parse command line arguments
    parse_arguments "$@"
    
    if [ "$SILENT_MODE" != "true" ]; then
        bold "🔄 QUICK ROLLBACK SCRIPT"
        echo "========================="
    fi
    
    # Validate environment and prerequisites
    validate_environment
    
    # Get current deployment state
    get_current_state
    
    # Determine target version
    determine_target_version
    
    # Create backup
    create_backup
    
    # Confirm rollback
    confirm_rollback
    
    # Execute rollback
    execute_rollback
    
    # Health check
    health_check
    
    # Generate report
    generate_report
    
    if [ "$DRY_RUN_MODE" == "true" ]; then
        success "Dry run completed successfully"
    else
        success "Rollback completed successfully!"
    fi
}

# Execute main function with all arguments
main "$@"