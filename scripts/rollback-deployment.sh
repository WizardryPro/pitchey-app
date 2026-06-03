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
WORKER_NAME="pitchey-api-prod"          # matches wrangler.toml `name`
FRONTEND_PROJECT="pitchey"              # CF Pages project name (served at pitchey-5o8.pages.dev)
FRONTEND_BRANCH="main"                  # prod branch — without it `pages deploy` makes a PREVIEW
WORKER_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"

# Wrangler is a LOCAL devDependency here — always invoke via npx, never assume a
# global install (the old `command -v wrangler` + `npm i -g` path died on EACCES).
WRANGLER="npx --no-install wrangler"

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

    # A dry run makes no changes — don't gate it behind the interactive prompt
    # (this is what lets the drill run --dry-run non-interactively in CI/automation).
    if [[ "$DRY_RUN" == "true" ]]; then
        echo_info "Dry run — no confirmation required (no changes will be made)"
        return 0
    fi

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

    # Check wrangler is resolvable via npx (local devDependency)
    if ! $WRANGLER --version &> /dev/null; then
        echo_error "Wrangler not found. Run 'npm ci' in the repo root first."
        exit 1
    fi

    # Check authentication (command is `whoami`, NOT `auth whoami`)
    if ! $WRANGLER whoami &> /dev/null; then
        echo_error "Not authenticated with Cloudflare"
        echo_error "Please run: npx wrangler login"
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
    if versions=$($WRANGLER deployments list 2>/dev/null); then
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
    
    # Method 1: roll back to the immediately-previous version. `-y` auto-confirms
    # (bare `wrangler rollback` prompts interactively and would hang during an
    # incident). With no version-id, wrangler targets the version before the
    # current active one.
    if $WRANGLER rollback -y -m "emergency rollback via rollback-deployment.sh"; then
        echo_success "Worker rolled back to previous version"
        return 0
    fi

    echo_warning "Direct rollback failed. Deploying emergency worker..."
    deploy_emergency_worker
}

deploy_emergency_worker() {
    echo_info "Deploying emergency minimal worker..."

    if [[ "$DRY_RUN" == "true" ]]; then
        echo_info "[DRY RUN] Would deploy emergency maintenance worker as '$WORKER_NAME'"
        return 0
    fi

    # Build a self-contained maintenance worker in a temp dir with its OWN minimal
    # wrangler config — deployed under the same worker name so it replaces the live
    # worker with a 503 maintenance page. We do NOT touch src/ (the real entry is
    # src/worker-integrated.ts; the old script wrote to a non-existent
    # src/worker-platform-fixed.ts and would have deployed the real worker instead).
    local emergency_dir
    emergency_dir="$(mktemp -d)"

    # Module-syntax worker (service-worker `addEventListener` is incompatible with
    # the module config the platform uses).
    cat > "$emergency_dir/worker.js" << 'EOF'
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*' };

    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({
        status: 'maintenance',
        message: 'System is under maintenance. Please try again later.',
        timestamp: new Date().toISOString(),
      }), { status: 503, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'The service is currently under maintenance. Please try again later.',
        code: 'MAINTENANCE_MODE',
      }), { status: 503, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    return new Response(
      '<!DOCTYPE html><html><head><title>Maintenance - Pitchey</title>' +
      '<style>body{font-family:system-ui;text-align:center;padding:50px;background:#f5f5f5}' +
      '.c{max-width:600px;margin:0 auto;background:#fff;padding:40px;border-radius:8px}' +
      'h1{color:#e74c3c}</style></head><body><div class="c"><h1>🔧 Maintenance Mode</h1>' +
      '<p>The Pitchey platform is currently undergoing maintenance.</p>' +
      '<p>Please check back in a few minutes.</p></div></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html', ...cors } }
    );
  }
};
EOF

    cat > "$emergency_dir/wrangler.toml" << EOF
name = "$WORKER_NAME"
main = "worker.js"
compatibility_date = "2025-01-01"
EOF

    if $WRANGLER deploy --config "$emergency_dir/wrangler.toml"; then
        echo_success "Emergency maintenance worker deployed as '$WORKER_NAME'"
        echo_warning "System is now in maintenance mode (503). Roll forward with the normal deploy to restore."
    else
        echo_error "Failed to deploy emergency worker"
        rm -rf "$emergency_dir"
        return 1
    fi

    rm -rf "$emergency_dir"
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
    
    # Deploy emergency frontend. --branch is REQUIRED for the canonical prod URL —
    # without it CF Pages publishes a preview deployment, not pitchey-5o8.pages.dev.
    if $WRANGLER pages deploy "$emergency_dir" --project-name="$FRONTEND_PROJECT" --branch="$FRONTEND_BRANCH"; then
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
    echo "false" | $WRANGLER secret put USE_DATABASE || true
    echo "false" | $WRANGLER secret put USE_EMAIL || true
    echo "false" | $WRANGLER secret put USE_STORAGE || true

    # Set a temporary JWT secret (will force re-login)
    echo "emergency_jwt_secret_$(date +%s)" | $WRANGLER secret put JWT_SECRET || true
    
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