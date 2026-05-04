#!/bin/bash

# 🔄 Emergency Rollback System for Pitchey Production
# This script provides emergency rollback capabilities for production deployment

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
WORKER_NAME="pitchey-production"
FRONTEND_PROJECT="pitchey"
WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"

# Rollback options
ROLLBACK_WORKER=false
ROLLBACK_FRONTEND=false
ROLLBACK_SECRETS=false
ROLLBACK_ALL=false
DRY_RUN=false
FORCE=false

# Logging
ROLLBACK_LOG="rollback-$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$ROLLBACK_LOG")

echo_header() {
    echo -e "${RED}${BOLD}======================================${NC}"
    echo -e "${RED}${BOLD}🚨 EMERGENCY ROLLBACK SYSTEM 🚨${NC}"
    echo -e "${RED}${BOLD}======================================${NC}"
    echo -e "${YELLOW}Account: ndlovucavelle@gmail.com${NC}"
    echo -e "${YELLOW}Platform: Cloudflare Workers + Pages${NC}"
    echo -e "${YELLOW}Timestamp: $(date)${NC}"
    echo -e "${YELLOW}Log: $ROLLBACK_LOG${NC}"
    echo -e "${RED}${BOLD}======================================${NC}"
    echo
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

show_help() {
    echo "🔄 Pitchey Emergency Rollback System"
    echo
    echo "USAGE:"
    echo "  $0 [options]"
    echo
    echo "OPTIONS:"
    echo "  --worker          Rollback Cloudflare Worker only"
    echo "  --frontend        Rollback Cloudflare Pages frontend only"
    echo "  --secrets         Reset worker secrets to safe defaults"
    echo "  --all             Rollback everything (worker + frontend + secrets)"
    echo "  --dry-run         Show what would be done without making changes"
    echo "  --force           Skip confirmation prompts"
    echo "  --help            Show this help message"
    echo
    echo "EXAMPLES:"
    echo "  $0 --all                    # Full emergency rollback"
    echo "  $0 --worker --dry-run       # Test worker rollback"
    echo "  $0 --frontend --force       # Immediate frontend rollback"
    echo
    echo "EMERGENCY SCENARIOS:"
    echo "  🔥 Site completely down     → Use --all"
    echo "  ⚠️  API issues only         → Use --worker"
    echo "  🎨 Frontend issues only     → Use --frontend"
    echo "  🔐 Authentication broken    → Use --secrets"
    echo
}

confirm_action() {
    local action="$1"
    
    if [[ "$FORCE" == "true" ]]; then
        echo_warning "Force mode enabled - skipping confirmation"
        return 0
    fi
    
    echo
    echo_warning "⚠️  CONFIRMATION REQUIRED ⚠️"
    echo_warning "You are about to: $action"
    echo_warning "This will affect PRODUCTION systems!"
    echo
    echo "Type 'ROLLBACK' to confirm (or Ctrl+C to cancel): "
    read -r confirmation
    
    if [[ "$confirmation" != "ROLLBACK" ]]; then
        echo_error "Rollback cancelled by user"
        exit 1
    fi
    
    echo_info "Rollback confirmed. Proceeding..."
}

check_prerequisites() {
    echo_info "Checking rollback prerequisites..."
    
    # Check wrangler CLI
    if ! command -v wrangler &> /dev/null; then
        echo_error "Wrangler CLI not found. Installing..."
        npm install -g wrangler@latest || {
            echo_error "Failed to install wrangler"
            exit 1
        }
    fi
    
    # Check authentication
    if ! wrangler auth whoami &> /dev/null; then
        echo_error "Not authenticated with Cloudflare"
        echo_error "Please run: wrangler auth login"
        exit 1
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        echo_error "Git not found. Some rollback operations may not work."
    fi
    
    echo_success "Prerequisites check passed"
}

get_worker_versions() {
    echo_info "Fetching worker deployment history..."
    
    # Get deployment versions from Cloudflare
    local versions
    if versions=$(wrangler deployments list 2>/dev/null); then
        echo_info "Available worker versions:"
        echo "$versions" | head -10
        return 0
    else
        echo_warning "Could not fetch worker deployment history"
        return 1
    fi
}

rollback_worker_to_previous() {
    echo_info "Rolling back Cloudflare Worker..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo_info "[DRY RUN] Would rollback worker to previous version"
        return 0
    fi
    
    # Method 1: Try to rollback to previous deployment
    if wrangler rollback 2>/dev/null; then
        echo_success "Worker rolled back to previous version"
        return 0
    fi
    
    echo_warning "Direct rollback failed. Deploying emergency worker..."
    deploy_emergency_worker
}

deploy_emergency_worker() {
    echo_info "Deploying emergency minimal worker..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo_info "[DRY RUN] Would deploy emergency worker"
        return 0
    fi
    
    # Create minimal emergency worker
    local emergency_worker="/tmp/emergency-worker.ts"
    cat > "$emergency_worker" << 'EOF'
/**
 * Emergency Minimal Worker for Pitchey Platform
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  
  // Health check endpoint
  if (url.pathname === '/api/health') {
    return new Response(JSON.stringify({
      status: 'maintenance',
      message: 'System is under maintenance. Please try again later.',
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
  
  // All other requests return maintenance message
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({
      error: 'Service temporarily unavailable',
      message: 'The service is currently under maintenance. Please try again later.',
      code: 'MAINTENANCE_MODE'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
  
  // Return maintenance page for all other requests
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Maintenance - Pitchey Platform</title>
      <style>
        body { font-family: system-ui; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; }
        h1 { color: #e74c3c; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔧 Maintenance Mode</h1>
        <p>The Pitchey platform is currently undergoing maintenance.</p>
        <p>Please check back in a few minutes.</p>
        <p><small>Last Update: ${new Date().toLocaleString()}</small></p>
      </div>
    </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
    }
  })
}
EOF
    
    # Backup current worker file
    if [[ -f "src/worker-platform-fixed.ts" ]]; then
        cp "src/worker-platform-fixed.ts" "src/worker-platform-fixed.ts.backup-$(date +%s)"
        echo_info "Current worker backed up"
    fi
    
    # Deploy emergency worker
    cp "$emergency_worker" "src/worker-platform-fixed.ts"
    
    if wrangler deploy; then
        echo_success "Emergency worker deployed successfully"
        echo_warning "System is now in maintenance mode"
    else
        echo_error "Failed to deploy emergency worker"
        return 1
    fi
    
    # Cleanup
    rm -f "$emergency_worker"
}

rollback_frontend() {
    echo_info "Rolling back Cloudflare Pages frontend..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo_info "[DRY RUN] Would rollback frontend to previous deployment"
        return 0
    fi
    
    echo_info "Deploying emergency maintenance page..."
    deploy_emergency_frontend
}

deploy_emergency_frontend() {
    echo_info "Deploying emergency maintenance frontend..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo_info "[DRY RUN] Would deploy emergency maintenance page"
        return 0
    fi
    
    # Create emergency maintenance page
    local emergency_dir="/tmp/emergency-frontend"
    mkdir -p "$emergency_dir"
    
    cat > "$emergency_dir/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maintenance - Pitchey Platform</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            margin: 0;
        }
        .container {
            text-align: center;
            max-width: 600px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        h1 { font-size: 2.5rem; margin-bottom: 20px; }
        .emoji { font-size: 4rem; margin-bottom: 20px; }
        p { font-size: 1.1rem; line-height: 1.6; margin-bottom: 20px; }
        .status-box { background: rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 20px; margin: 20px 0; }
        .btn { background: #00b4db; color: white; border: none; padding: 12px 30px; border-radius: 25px; font-size: 1rem; cursor: pointer; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="emoji">🔧</div>
        <h1>We'll be right back!</h1>
        <p>The Pitchey platform is currently undergoing maintenance to improve your experience.</p>
        
        <div class="status-box">
            <p><strong>Status:</strong> Under Maintenance</p>
            <p><strong>Started:</strong> <span id="maintenance-time"></span></p>
            <p><strong>Expected:</strong> Shortly</p>
        </div>
        
        <p>Thank you for your patience. The platform will return to normal service soon.</p>
        
        <button class="btn" onclick="window.location.reload()">🔄 Refresh Page</button>
    </div>
    
    <script>
        document.getElementById('maintenance-time').textContent = new Date().toLocaleString();
        setTimeout(() => window.location.reload(), 60000);
    </script>
</body>
</html>
EOF
    
    # Deploy emergency frontend
    if wrangler pages deploy "$emergency_dir" --project-name="$FRONTEND_PROJECT"; then
        echo_success "Emergency maintenance page deployed"
        echo_warning "Frontend is now showing maintenance page"
    else
        echo_error "Failed to deploy emergency maintenance page"
        return 1
    fi
    
    # Cleanup
    rm -rf "$emergency_dir"
}

reset_worker_secrets() {
    echo_info "Resetting worker secrets to safe defaults..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo_info "[DRY RUN] Would reset worker secrets"
        return 0
    fi
    
    # Reset to safe default secrets
    echo_warning "Setting emergency secrets configuration..."
    
    # Disable database in emergency mode
    echo "false" | wrangler secret put USE_DATABASE || true
    echo "false" | wrangler secret put USE_EMAIL || true
    echo "false" | wrangler secret put USE_STORAGE || true
    
    # Set a temporary JWT secret (will force re-login)
    echo "emergency_jwt_secret_$(date +%s)" | wrangler secret put JWT_SECRET || true
    
    echo_success "Worker secrets reset to emergency configuration"
    echo_warning "This will log out all users and disable some features"
}

generate_rollback_report() {
    local report_file="rollback-report-$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# 🔄 Pitchey Emergency Rollback Report

**Date**: $(date)  
**Account**: ndlovucavelle@gmail.com  

## 🚨 Rollback Summary

### Actions Taken
- **Worker Rollback**: $([[ "$ROLLBACK_WORKER" == "true" ]] && echo "✅ Executed" || echo "❌ Skipped")
- **Frontend Rollback**: $([[ "$ROLLBACK_FRONTEND" == "true" ]] && echo "✅ Executed" || echo "❌ Skipped")
- **Secrets Reset**: $([[ "$ROLLBACK_SECRETS" == "true" ]] && echo "✅ Executed" || echo "❌ Skipped")

### Next Steps
1. Investigate root cause
2. Fix problems in codebase
3. Test thoroughly
4. Deploy fixed version
5. Monitor after restoration

### Recovery Commands
\`\`\`bash
# Test current status
curl $WORKER_URL/api/health

# Deploy fixed version
./deploy-production-orchestrated.sh
\`\`\`

---
**Status**: 🔄 System Rolled Back
EOF

    echo_success "Rollback report generated: $report_file"
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --worker)
                ROLLBACK_WORKER=true
                shift
                ;;
            --frontend)
                ROLLBACK_FRONTEND=true
                shift
                ;;
            --secrets)
                ROLLBACK_SECRETS=true
                shift
                ;;
            --all)
                ROLLBACK_ALL=true
                ROLLBACK_WORKER=true
                ROLLBACK_FRONTEND=true
                ROLLBACK_SECRETS=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                echo_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # If no specific options provided, show help
    if [[ "$ROLLBACK_WORKER" == "false" && "$ROLLBACK_FRONTEND" == "false" && "$ROLLBACK_SECRETS" == "false" ]]; then
        show_help
        exit 1
    fi
    
    # Display header
    echo_header
    
    # Show what will be done
    echo_info "Rollback plan:"
    [[ "$ROLLBACK_WORKER" == "true" ]] && echo_info "  ✅ Rollback Cloudflare Worker"
    [[ "$ROLLBACK_FRONTEND" == "true" ]] && echo_info "  ✅ Rollback Cloudflare Pages"
    [[ "$ROLLBACK_SECRETS" == "true" ]] && echo_info "  ✅ Reset Worker Secrets"
    [[ "$DRY_RUN" == "true" ]] && echo_warning "  🧪 DRY RUN MODE (no changes)"
    echo
    
    # Confirm action
    local action_description="rollback production systems"
    [[ "$DRY_RUN" == "true" ]] && action_description="simulate rollback (dry run)"
    confirm_action "$action_description"
    
    # Check prerequisites
    check_prerequisites
    
    # Execute rollback operations
    local rollback_success=true
    
    if [[ "$ROLLBACK_SECRETS" == "true" ]]; then
        echo_info "=== RESETTING SECRETS ==="
        reset_worker_secrets || rollback_success=false
        echo
    fi
    
    if [[ "$ROLLBACK_WORKER" == "true" ]]; then
        echo_info "=== ROLLING BACK WORKER ==="
        rollback_worker_to_previous || rollback_success=false
        echo
    fi
    
    if [[ "$ROLLBACK_FRONTEND" == "true" ]]; then
        echo_info "=== ROLLING BACK FRONTEND ==="
        rollback_frontend || rollback_success=false
        echo
    fi
    
    # Generate report
    generate_rollback_report
    
    # Final status
    echo
    if [[ "$rollback_success" == "true" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            echo_success "🧪 Dry run completed successfully!"
        else
            echo_success "🔄 Rollback completed successfully!"
            echo_warning "⚠️  System may be in maintenance mode"
        fi
    else
        echo_error "❌ Rollback encountered errors"
        exit 1
    fi
    
    echo_info "📋 Rollback log: $ROLLBACK_LOG"
    echo_info "🔍 Monitor: curl $WORKER_URL/api/health"
}

# Handle script interruption
trap 'echo_error "Rollback interrupted"; exit 1' INT TERM

# Run main function
main "$@"