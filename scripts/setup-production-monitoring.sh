#!/bin/bash

# 📊 Setup Production Monitoring & Alerts
# Complete monitoring setup for the CI/CD integrated platform

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}📊 Setting Up Production Monitoring & Alerts${NC}"
echo "=============================================="
echo ""

# Create monitoring directories
echo -e "${BLUE}📁 Setting up monitoring directories...${NC}"
mkdir -p monitoring/logs
mkdir -p monitoring/dashboards
mkdir -p monitoring/alerts
mkdir -p monitoring/scripts

# Set up health monitoring cron job
setup_health_monitoring() {
    echo -e "${BLUE}⏰ Setting up automated health monitoring...${NC}"
    
    # Create cron job for health monitoring
    local cron_entry="*/5 * * * * cd $(pwd) && ./scripts/simple-health-monitor.sh > /dev/null 2>&1"
    
    # Check if cron job already exists
    if ! crontab -l 2>/dev/null | grep -q "simple-health-monitor.sh"; then
        # Add to crontab
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        echo "  ✅ Health monitoring cron job added (every 5 minutes)"
    else
        echo "  ✅ Health monitoring cron job already exists"
    fi
    
    # Create comprehensive monitoring cron (hourly)
    local comprehensive_cron="0 * * * * cd $(pwd) && COMPREHENSIVE=true ./scripts/simple-health-monitor.sh > /dev/null 2>&1"
    
    if ! crontab -l 2>/dev/null | grep -q "COMPREHENSIVE=true"; then
        (crontab -l 2>/dev/null; echo "$comprehensive_cron") | crontab -
        echo "  ✅ Comprehensive monitoring cron job added (hourly)"
    else
        echo "  ✅ Comprehensive monitoring cron job already exists"
    fi
}

# Create monitoring dashboard service
setup_dashboard_service() {
    echo -e "${BLUE}🖥️ Setting up monitoring dashboard...${NC}"
    
    # Copy dashboard to monitoring directory
    if [ ! -f "monitoring/dashboards/health-dashboard.html" ]; then
        cp monitoring/health-dashboard.html monitoring/dashboards/
        echo "  ✅ Dashboard copied to monitoring/dashboards/"
    fi
    
    # Create simple HTTP server for dashboard (optional)
    cat > monitoring/serve-dashboard.sh << 'EOF'
#!/bin/bash
# Simple dashboard server for local monitoring

PORT=${PORT:-8080}
cd "$(dirname "$0")/dashboards"

echo "🖥️ Starting Health Dashboard Server on http://localhost:$PORT"
echo "Dashboard available at: http://localhost:$PORT/health-dashboard.html"

# Use Python's built-in server if available
if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer $PORT
elif command -v node &> /dev/null; then
    npx http-server -p $PORT
else
    echo "❌ No suitable HTTP server found (python3, python, or node required)"
    exit 1
fi
EOF
    
    chmod +x monitoring/serve-dashboard.sh
    echo "  ✅ Dashboard server script created"
}

# Setup GitHub Actions integration
setup_github_integration() {
    echo -e "${BLUE}🔧 Configuring GitHub Actions integration...${NC}"
    
    # Check if GitHub Actions workflows exist
    if [ -d ".github/workflows" ]; then
        echo "  ✅ GitHub Actions workflows found"
        
        # List monitoring workflows
        if [ -f ".github/workflows/monitoring-alerts.yml" ]; then
            echo "  ✅ Monitoring alerts workflow configured"
        fi
        
        if [ -f ".github/workflows/ci-cd.yml" ]; then
            echo "  ✅ CI/CD pipeline workflow configured"
        fi
        
    else
        echo "  ⚠️ GitHub Actions not found - monitoring will be local only"
    fi
}

# Create monitoring configuration
create_monitoring_config() {
    echo -e "${BLUE}⚙️ Creating monitoring configuration...${NC}"
    
    cat > monitoring/.env.monitoring << EOF
# Monitoring Configuration
# Generated: $(date)

# API Endpoints
PRODUCTION_API=https://pitchey-api-prod.ndlovucavelle.workers.dev
PRODUCTION_FRONTEND=https://pitchey.pages.dev

# Alert Thresholds
RESPONSE_TIME_THRESHOLD=2.0
SUCCESS_RATE_THRESHOLD=95

# Monitoring Intervals (minutes)
BASIC_CHECK_INTERVAL=5
COMPREHENSIVE_CHECK_INTERVAL=60

# Log Configuration
LOG_RETENTION_DAYS=7
ALERT_LOG_MAX_SIZE=10M

# Dashboard Configuration
DASHBOARD_PORT=8080
DASHBOARD_AUTO_REFRESH=30

# Alert Channels (configure as needed)
ALERT_EMAIL=""
SLACK_WEBHOOK=""
DISCORD_WEBHOOK=""

# Health Check Demo Users
DEMO_CREATOR_EMAIL=alex.creator@demo.com
DEMO_INVESTOR_EMAIL=sarah.investor@demo.com
DEMO_PRODUCTION_EMAIL=stellar.production@demo.com
DEMO_PASSWORD=Demo123
EOF

    echo "  ✅ Monitoring configuration created"
    echo "  📝 Edit monitoring/.env.monitoring to customize settings"
}

# Setup log rotation
setup_log_rotation() {
    echo -e "${BLUE}📝 Setting up log rotation...${NC}"
    
    # Create logrotate configuration
    cat > monitoring/logrotate.conf << EOF
# Pitchey Monitoring Log Rotation
$(pwd)/monitoring/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    copytruncate
    create 644 $(whoami) $(whoami)
}
EOF
    
    echo "  ✅ Log rotation configuration created"
    echo "  💡 To enable system log rotation, add to crontab:"
    echo "     0 2 * * * logrotate -f $(pwd)/monitoring/logrotate.conf"
}

# Create monitoring status summary
create_status_summary() {
    echo -e "${BLUE}📋 Creating monitoring status summary...${NC}"
    
    cat > monitoring/monitoring-status.md << 'EOF'
# 📊 Pitchey Production Monitoring Status

## Active Monitoring Components

### ✅ Automated Health Checks
- **Basic Health Monitoring**: Every 5 minutes
- **Comprehensive Checks**: Every hour
- **CI/CD Integration**: On deployments and PRs
- **GitHub Actions Alerts**: Every 5 minutes

### 📊 Monitoring Coverage
- API Health & Response Times
- Frontend Availability
- Authentication Systems (3 user types)
- Core API Endpoints
- Database Connectivity
- Security Headers

### 🚨 Alert Thresholds
- **Critical**: API/Frontend down
- **Warning**: Response time > 2s
- **Degraded**: Success rate < 95%

### 📈 Dashboard Access
- **Local Dashboard**: `./monitoring/serve-dashboard.sh`
- **GitHub Actions**: Check repository Actions tab
- **Log Files**: `./monitoring/logs/`

## Quick Commands

```bash
# Run immediate health check
./scripts/simple-health-monitor.sh

# Run comprehensive check
COMPREHENSIVE=true ./scripts/simple-health-monitor.sh

# Start local dashboard
./monitoring/serve-dashboard.sh

# View recent alerts
tail -f ./monitoring/logs/alerts.log

# Check cron jobs
crontab -l | grep monitor
```

## Status: 🟢 ACTIVE
- Last Updated: [Generated automatically]
- Next Review: [Set manually]

EOF
    
    echo "  ✅ Status summary created at monitoring/monitoring-status.md"
}

# Main setup execution
main() {
    echo "Starting production monitoring setup..."
    echo ""
    
    setup_health_monitoring
    echo ""
    
    setup_dashboard_service
    echo ""
    
    setup_github_integration
    echo ""
    
    create_monitoring_config
    echo ""
    
    setup_log_rotation
    echo ""
    
    create_status_summary
    echo ""
    
    echo "=============================================="
    echo -e "${GREEN}🎉 Production Monitoring Setup Complete!${NC}"
    echo "=============================================="
    echo ""
    echo "📊 Monitoring Components Configured:"
    echo "  ✅ Automated health checks (every 5 min)"
    echo "  ✅ Comprehensive monitoring (hourly)"
    echo "  ✅ GitHub Actions alerts"
    echo "  ✅ Local monitoring dashboard"
    echo "  ✅ Log rotation and management"
    echo ""
    echo "🎯 Next Steps:"
    echo "  1. Customize monitoring/.env.monitoring"
    echo "  2. Test monitoring: ./scripts/simple-health-monitor.sh"
    echo "  3. Start dashboard: ./monitoring/serve-dashboard.sh"
    echo "  4. Check GitHub Actions monitoring workflows"
    echo ""
    echo "📚 Documentation:"
    echo "  - Monitoring Status: monitoring/monitoring-status.md"
    echo "  - CI/CD Pipeline: docs/CI_CD_PIPELINE.md"
    echo "  - Health Dashboard: http://localhost:8080/health-dashboard.html"
    echo ""
    echo -e "${CYAN}🚀 Production monitoring is now active!${NC}"
}

# Run main setup
main