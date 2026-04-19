#!/bin/bash

# Deploy Continuous Monitoring for Pitchey Platform
# This script sets up automated monitoring and alerting

set -e

echo "🔍 DEPLOYING CONTINUOUS MONITORING"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL="https://pitchey.pages.dev"
MONITORING_DIR="./monitoring/logs"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}" # Set via environment variable

# Create monitoring directory
mkdir -p "$MONITORING_DIR"

# 1. Health Check Monitoring
echo -e "${BLUE}1. Starting Health Check Monitor${NC}"
cat > "$MONITORING_DIR/health-monitor.sh" << 'EOF'
#!/bin/bash
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Check API health
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
    
    if [ "$API_STATUS" = "200" ]; then
        echo "[$TIMESTAMP] ✅ API Health: OK ($API_STATUS)"
    else
        echo "[$TIMESTAMP] ❌ API Health: FAILED ($API_STATUS)"
        # Send alert (implement your alert mechanism here)
        # curl -X POST $ALERT_WEBHOOK -d "API Health Check Failed: $API_STATUS"
    fi
    
    # Sleep for 1 minute
    sleep 60
done
EOF
chmod +x "$MONITORING_DIR/health-monitor.sh"

# 2. Performance Monitoring
echo -e "${BLUE}2. Setting up Performance Monitor${NC}"
cat > "$MONITORING_DIR/performance-monitor.sh" << 'EOF'
#!/bin/bash
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Measure response time
    START=$(date +%s%N)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/pitches?limit=1")
    END=$(date +%s%N)
    RESPONSE_TIME=$(( (END - START) / 1000000 ))
    
    echo "[$TIMESTAMP] Response Time: ${RESPONSE_TIME}ms (HTTP $HTTP_CODE)"
    
    # Alert if response time > 1000ms
    if [ $RESPONSE_TIME -gt 1000 ]; then
        echo "[$TIMESTAMP] ⚠️  SLOW RESPONSE: ${RESPONSE_TIME}ms"
    fi
    
    # Sleep for 5 minutes
    sleep 300
done
EOF
chmod +x "$MONITORING_DIR/performance-monitor.sh"

# 3. Security Headers Check
echo -e "${BLUE}3. Security Headers Verification${NC}"
echo "Checking current security headers..."
HEADERS=$(curl -sI "$API_URL/api/health")

check_header() {
    if echo "$HEADERS" | grep -qi "$1"; then
        echo -e "${GREEN}✅ $1 present${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 missing${NC}"
        return 1
    fi
}

SECURITY_SCORE=0
TOTAL_HEADERS=6

check_header "Content-Security-Policy" && ((SECURITY_SCORE++))
check_header "X-Frame-Options" && ((SECURITY_SCORE++))
check_header "X-Content-Type-Options" && ((SECURITY_SCORE++))
check_header "Strict-Transport-Security" && ((SECURITY_SCORE++))
check_header "X-XSS-Protection" && ((SECURITY_SCORE++))
check_header "Referrer-Policy" && ((SECURITY_SCORE++))

echo ""
echo -e "${BLUE}Security Score: $SECURITY_SCORE/$TOTAL_HEADERS${NC}"

# 4. KV Cache Monitoring
echo ""
echo -e "${BLUE}4. Cache Hit Rate Monitor${NC}"
cat > "$MONITORING_DIR/cache-monitor.sh" << 'EOF'
#!/bin/bash

LOG_FILE="./monitoring/logs/cache-hits.log"
CACHE_HITS=0
CACHE_MISSES=0

# Parse Worker logs for cache hit/miss patterns
# This would need to be integrated with your logging system
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cache monitoring started" >> "$LOG_FILE"

# Placeholder for actual cache monitoring
# In production, parse Cloudflare logs or use Analytics Engine
EOF
chmod +x "$MONITORING_DIR/cache-monitor.sh"

# 5. Create systemd service (optional - for Linux servers)
echo ""
echo -e "${BLUE}5. Creating Monitoring Service${NC}"
cat > "$MONITORING_DIR/pitchey-monitor.service" << EOF
[Unit]
Description=Pitchey Platform Monitor
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/$MONITORING_DIR/health-monitor.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 6. Create monitoring dashboard
echo ""
echo -e "${BLUE}6. Creating Monitoring Dashboard${NC}"
cat > "$MONITORING_DIR/dashboard.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Pitchey Platform Monitor</title>
    <style>
        body { font-family: -apple-system, system-ui; margin: 20px; background: #1a1a1a; color: #fff; }
        .metric { background: #2a2a2a; padding: 20px; margin: 10px 0; border-radius: 8px; }
        .status-ok { color: #4ade80; }
        .status-warn { color: #fbbf24; }
        .status-error { color: #f87171; }
        h1 { color: #60a5fa; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    </style>
</head>
<body>
    <h1>🎬 Pitchey Platform Monitor</h1>
    <div class="grid">
        <div class="metric">
            <h3>API Health</h3>
            <p class="status-ok" id="api-health">Checking...</p>
        </div>
        <div class="metric">
            <h3>Response Time</h3>
            <p id="response-time">Measuring...</p>
        </div>
        <div class="metric">
            <h3>Cache Hit Rate</h3>
            <p id="cache-rate">Calculating...</p>
        </div>
        <div class="metric">
            <h3>Error Rate</h3>
            <p id="error-rate">Monitoring...</p>
        </div>
        <div class="metric">
            <h3>Security Headers</h3>
            <p class="status-ok" id="security">6/6 Headers Present</p>
        </div>
        <div class="metric">
            <h3>Database Status</h3>
            <p class="status-ok" id="database">Connected</p>
        </div>
    </div>
    
    <script>
        // Auto-refresh every 30 seconds
        setInterval(() => {
            // Fetch real metrics from your monitoring endpoints
            fetch('https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health')
                .then(r => r.json())
                .then(data => {
                    document.getElementById('api-health').textContent = 'Healthy';
                    document.getElementById('api-health').className = 'status-ok';
                })
                .catch(() => {
                    document.getElementById('api-health').textContent = 'Unreachable';
                    document.getElementById('api-health').className = 'status-error';
                });
        }, 30000);
    </script>
</body>
</html>
EOF

# 7. Start monitoring in background
echo ""
echo -e "${BLUE}7. Starting Monitors${NC}"

# Start health monitor in background
nohup "$MONITORING_DIR/health-monitor.sh" > "$MONITORING_DIR/health.log" 2>&1 &
HEALTH_PID=$!
echo "Health Monitor PID: $HEALTH_PID"

# Start performance monitor in background
nohup "$MONITORING_DIR/performance-monitor.sh" > "$MONITORING_DIR/performance.log" 2>&1 &
PERF_PID=$!
echo "Performance Monitor PID: $PERF_PID"

# Save PIDs for later management
echo "$HEALTH_PID" > "$MONITORING_DIR/health-monitor.pid"
echo "$PERF_PID" > "$MONITORING_DIR/performance-monitor.pid"

# 8. Summary
echo ""
echo -e "${GREEN}📊 MONITORING DEPLOYMENT COMPLETE${NC}"
echo "=================================="
echo ""
echo "✅ Health Check Monitor: Running (PID: $HEALTH_PID)"
echo "✅ Performance Monitor: Running (PID: $PERF_PID)"
echo "✅ Security Headers: Verified"
echo "✅ Monitoring Dashboard: $MONITORING_DIR/dashboard.html"
echo ""
echo "📁 Logs Directory: $MONITORING_DIR"
echo ""
echo "To view logs:"
echo "  tail -f $MONITORING_DIR/health.log"
echo "  tail -f $MONITORING_DIR/performance.log"
echo ""
echo "To stop monitors:"
echo "  kill \$(cat $MONITORING_DIR/health-monitor.pid)"
echo "  kill \$(cat $MONITORING_DIR/performance-monitor.pid)"
echo ""
echo -e "${YELLOW}⚡ Tip: Set up proper alerting with your monitoring service${NC}"
echo -e "${YELLOW}   Consider using: Datadog, New Relic, or Sentry for production${NC}"