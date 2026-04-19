#!/bin/bash

# Pitchey Automated Console Monitoring Script
# Runs portal monitoring and generates comparison reports
# Usage: ./scripts/automated-monitoring.sh [environment] [routes]
# Example: ./scripts/automated-monitoring.sh local critical

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$PROJECT_ROOT/logs/console-monitoring"
CONFIG_FILE="$LOGS_DIR/monitoring-config.json"

# Default values
ENVIRONMENT="${1:-local}"
ROUTE_TYPE="${2:-critical}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local color=""
    
    case $level in
        "INFO")  color=$BLUE ;;
        "WARN")  color=$YELLOW ;;
        "ERROR") color=$RED ;;
        "SUCCESS") color=$GREEN ;;
    esac
    
    echo -e "${color}[$level]${NC} $(date '+%Y-%m-%d %H:%M:%S') $message"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message" >> "$LOGS_DIR/monitoring.log"
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        log "ERROR" "Node.js is not installed or not in PATH"
        exit 1
    fi
    
    # Check if Puppeteer dependencies are available
    if ! node -e "require('puppeteer')" 2>/dev/null; then
        log "ERROR" "Puppeteer is not installed. Run: npm install puppeteer"
        exit 1
    fi
    
    # Ensure logs directory exists
    mkdir -p "$LOGS_DIR"
    
    # Check if config file exists
    if [ ! -f "$CONFIG_FILE" ]; then
        log "ERROR" "Monitoring config file not found: $CONFIG_FILE"
        exit 1
    fi
    
    log "SUCCESS" "Prerequisites check passed"
}

# Check if frontend server is running
check_frontend_server() {
    local base_url
    
    if [ "$ENVIRONMENT" = "local" ]; then
        base_url="http://127.0.0.1:5173"
    else
        base_url="https://pitchey.pages.dev"
    fi
    
    log "INFO" "Checking frontend server at $base_url..."
    
    if curl -s -f "$base_url" > /dev/null; then
        log "SUCCESS" "Frontend server is responding"
        return 0
    else
        log "ERROR" "Frontend server is not responding at $base_url"
        
        if [ "$ENVIRONMENT" = "local" ]; then
            log "INFO" "To start local frontend server, run:"
            log "INFO" "  cd frontend && npm run dev"
        fi
        return 1
    fi
}

# Run console monitoring
run_monitoring() {
    log "INFO" "Starting console monitoring for $ENVIRONMENT environment..."
    log "INFO" "Monitoring route type: $ROUTE_TYPE"
    
    local base_url
    local output_file="$LOGS_DIR/monitoring-run-$TIMESTAMP.log"
    
    if [ "$ENVIRONMENT" = "local" ]; then
        base_url="http://127.0.0.1:5173"
    else
        base_url="https://pitchey.pages.dev"
    fi
    
    # Set timeout based on route type
    local timeout=300000  # 5 minutes default
    if [ "$ROUTE_TYPE" = "all" ]; then
        timeout=900000    # 15 minutes for all routes
    fi
    
    log "INFO" "Running monitoring script with timeout: ${timeout}ms"
    
    # Run the monitoring script
    if BASE_URL="$base_url" HEADLESS=true timeout 600 node "$SCRIPT_DIR/portal-console-monitor.js" > "$output_file" 2>&1; then
        log "SUCCESS" "Console monitoring completed successfully"
        log "INFO" "Output saved to: $output_file"
        return 0
    else
        local exit_code=$?
        log "ERROR" "Console monitoring failed with exit code: $exit_code"
        log "ERROR" "Check output file for details: $output_file"
        return $exit_code
    fi
}

# Generate comparison report
generate_comparison() {
    log "INFO" "Generating comparison report..."
    
    if node "$SCRIPT_DIR/monitoring-comparison.js"; then
        log "SUCCESS" "Comparison report generated"
        return 0
    else
        log "ERROR" "Failed to generate comparison report"
        return 1
    fi
}

# Send notifications (if configured)
send_notifications() {
    local status=$1
    log "INFO" "Checking notification settings..."
    
    # Check if there's a latest comparison report
    local latest_report="$LOGS_DIR/latest-comparison.json"
    if [ ! -f "$latest_report" ]; then
        log "WARN" "No comparison report found for notifications"
        return 0
    fi
    
    # Parse status from the report
    local report_status
    report_status=$(node -e "
        const report = require('$latest_report');
        console.log(report.status);
    ")
    
    log "INFO" "Current monitoring status: $report_status"
    
    # Log critical issues
    if [ "$report_status" = "CRITICAL" ]; then
        log "ERROR" "CRITICAL monitoring status detected!"
        log "ERROR" "Immediate attention required - check latest comparison report"
        
        # Could integrate with Slack, email, etc. here
        # Example: curl -X POST -H 'Content-type: application/json' \
        #   --data '{"text":"Critical monitoring alert for Pitchey platform"}' \
        #   $SLACK_WEBHOOK_URL
    fi
}

# Cleanup old files
cleanup_old_files() {
    log "INFO" "Cleaning up old monitoring files..."
    
    # Keep only last 30 days of logs (as configured)
    find "$LOGS_DIR" -name "*.log" -type f -mtime +30 -delete 2>/dev/null || true
    find "$LOGS_DIR" -name "*.json" -type f -mtime +30 -delete 2>/dev/null || true
    
    log "SUCCESS" "Cleanup completed"
}

# Generate summary report
generate_summary() {
    log "INFO" "Generating monitoring session summary..."
    
    local summary_file="$LOGS_DIR/session-summary-$TIMESTAMP.md"
    
    cat > "$summary_file" << EOF
# Monitoring Session Summary

**Date:** $(date '+%Y-%m-%d %H:%M:%S')  
**Environment:** $ENVIRONMENT  
**Route Type:** $ROUTE_TYPE  
**Duration:** $(date -d@$SECONDS -u +%M:%S) minutes  

## Results

- **Status:** $([ $? -eq 0 ] && echo "✅ Success" || echo "❌ Failed")
- **Logs Directory:** \`$LOGS_DIR\`
- **Config File:** \`$CONFIG_FILE\`

## Files Generated

\`\`\`bash
ls -la $LOGS_DIR/*$TIMESTAMP*
\`\`\`

## Next Steps

1. Review console monitoring results
2. Check comparison report for trends
3. Address any critical issues found
4. Schedule next monitoring run

---
Generated by automated-monitoring.sh
EOF

    log "SUCCESS" "Session summary saved to: $summary_file"
}

# Main execution
main() {
    log "INFO" "Starting automated console monitoring session"
    log "INFO" "Environment: $ENVIRONMENT, Routes: $ROUTE_TYPE"
    
    # Start timer
    local start_time=$(date +%s)
    
    # Run checks and monitoring
    check_prerequisites || exit 1
    
    if [ "$ENVIRONMENT" = "local" ]; then
        check_frontend_server || exit 1
    fi
    
    # Run the actual monitoring
    if run_monitoring; then
        generate_comparison
        send_notifications "success"
    else
        log "ERROR" "Monitoring run failed"
        send_notifications "failure"
        exit 1
    fi
    
    # Cleanup and summary
    cleanup_old_files
    generate_summary
    
    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "SUCCESS" "Automated monitoring completed in ${duration} seconds"
    log "INFO" "Check logs directory for detailed results: $LOGS_DIR"
}

# Show usage
show_usage() {
    echo "Pitchey Automated Console Monitoring"
    echo ""
    echo "Usage: $0 [environment] [route_type]"
    echo ""
    echo "Environments:"
    echo "  local      - Local development (http://127.0.0.1:5173)"
    echo "  production - Production site (https://pitchey.pages.dev)"
    echo ""
    echo "Route Types:"
    echo "  critical   - Critical routes only (default)"
    echo "  high       - High priority routes"
    echo "  all        - All routes (longer run time)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Local environment, critical routes"
    echo "  $0 production all     # Production environment, all routes"
    echo "  $0 local high        # Local environment, high priority routes"
}

# Handle command line arguments
case "${1:-}" in
    -h|--help|help)
        show_usage
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac