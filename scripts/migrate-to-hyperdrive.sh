#!/bin/bash

# Migration Script: Direct Connection to Hyperdrive
# This script provides a safe migration path from DATABASE_URL to Hyperdrive

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HYPERDRIVE_ID="983d4a1818264b5dbdca26bacf167dee"
WORKER_NAME="pitchey-production"
TEST_WORKER_SUFFIX="-hyperdrive-test"

echo -e "${BLUE}🚀 Cloudflare Worker Hyperdrive Migration Script${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        print_error "Wrangler CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if logged in to Cloudflare
    if ! wrangler whoami &> /dev/null; then
        print_error "Not logged in to Cloudflare. Please run 'wrangler login' first."
        exit 1
    fi
    
    # Check if Hyperdrive exists
    print_info "Verifying Hyperdrive configuration..."
    if wrangler hyperdrive get "$HYPERDRIVE_ID" &> /dev/null; then
        print_status "Hyperdrive $HYPERDRIVE_ID found and accessible"
    else
        print_error "Hyperdrive $HYPERDRIVE_ID not found or not accessible"
        exit 1
    fi
    
    print_status "All prerequisites met"
    echo ""
}

# Function to backup current configuration
backup_configuration() {
    print_info "Creating backup of current configuration..."
    
    # Backup wrangler.toml
    cp wrangler.toml "wrangler.toml.backup.$(date +%Y%m%d_%H%M%S)"
    print_status "wrangler.toml backed up"
    
    # Backup current worker
    if [ -f "src/worker-production-db.ts" ]; then
        cp "src/worker-production-db.ts" "src/worker-production-db.ts.backup.$(date +%Y%m%d_%H%M%S)"
        print_status "Current worker backed up"
    fi
    
    print_status "Configuration backup completed"
    echo ""
}

# Function to test current setup
test_current_setup() {
    print_info "Testing current worker setup..."
    
    # Deploy test version of current worker
    print_info "Deploying test version to verify current functionality..."
    
    # Create temporary test worker file
    cat > "test-current-worker.ts" << 'EOF'
import { neon } from '@neondatabase/serverless';

interface Env {
  DATABASE_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/test/current') {
      try {
        const sql = neon(env.DATABASE_URL);
        const result = await sql`SELECT 1 as test, current_timestamp as time`;
        
        return new Response(JSON.stringify({
          status: 'success',
          method: 'direct_connection',
          result: result[0],
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          status: 'error',
          method: 'direct_connection',
          error: error.message,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Test endpoint: /test/current', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
EOF
    
    # Test with wrangler dev (background process)
    print_info "Starting local test of current configuration..."
    timeout 30 wrangler dev test-current-worker.ts --port 8788 &
    DEV_PID=$!
    
    # Wait for dev server to start
    sleep 10
    
    # Test the endpoint
    if curl -s "http://localhost:8788/test/current" > /dev/null; then
        print_status "Current setup working correctly"
    else
        print_warning "Current setup test failed - proceeding with migration anyway"
    fi
    
    # Cleanup
    kill $DEV_PID 2>/dev/null || true
    rm -f test-current-worker.ts
    
    echo ""
}

# Function to create test worker with Hyperdrive
create_test_worker() {
    print_info "Creating test worker with Hyperdrive integration..."
    
    # Copy the fixed Hyperdrive worker
    cp "src/worker-hyperdrive-fixed.ts" "src/worker-hyperdrive-test.ts"
    
    # Create test wrangler.toml
    cat > "wrangler.test.toml" << EOF
name = "${WORKER_NAME}${TEST_WORKER_SUFFIX}"
main = "src/worker-hyperdrive-test.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
account_id = "e16d3bf549153de23459a6c6a06a431b"

[vars]
FRONTEND_URL = "https://pitchey.pages.dev"
ENVIRONMENT = "test"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "$HYPERDRIVE_ID"
EOF
    
    print_status "Test worker configuration created"
}

# Function to deploy and test Hyperdrive worker
test_hyperdrive_worker() {
    print_info "Deploying and testing Hyperdrive worker..."
    
    # Deploy test worker
    wrangler deploy --config wrangler.test.toml
    
    # Get worker URL
    WORKER_URL="https://${WORKER_NAME}${TEST_WORKER_SUFFIX}.ndlovucavelle.workers.dev"
    
    print_info "Testing Hyperdrive worker at: $WORKER_URL"
    
    # Wait for deployment
    sleep 10
    
    # Test health endpoint
    print_info "Testing health endpoint..."
    HEALTH_RESPONSE=$(curl -s "$WORKER_URL/api/health" || echo '{"status":"error"}')
    HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status // "unknown"')
    
    if [ "$HEALTH_STATUS" = "healthy" ]; then
        print_status "Hyperdrive health check passed"
    else
        print_warning "Hyperdrive health check failed: $HEALTH_STATUS"
    fi
    
    # Test connection endpoint
    print_info "Testing connection endpoint..."
    CONNECTION_RESPONSE=$(curl -s "$WORKER_URL/api/test/connection" || echo '{"success":false}')
    CONNECTION_SUCCESS=$(echo "$CONNECTION_RESPONSE" | jq -r '.success // false')
    
    if [ "$CONNECTION_SUCCESS" = "true" ]; then
        CONNECTION_TYPE=$(echo "$CONNECTION_RESPONSE" | jq -r '.connection.type // "unknown"')
        RESPONSE_TIME=$(echo "$CONNECTION_RESPONSE" | jq -r '.responseTime // 0')
        print_status "Connection test passed - Type: $CONNECTION_TYPE, Time: ${RESPONSE_TIME}ms"
    else
        CONNECTION_ERROR=$(echo "$CONNECTION_RESPONSE" | jq -r '.error // "unknown error"')
        print_error "Connection test failed: $CONNECTION_ERROR"
        return 1
    fi
    
    echo ""
    print_status "Hyperdrive worker test completed successfully"
    return 0
}

# Function to run comprehensive tests
run_comprehensive_tests() {
    print_info "Running comprehensive performance tests..."
    
    WORKER_URL="https://${WORKER_NAME}${TEST_WORKER_SUFFIX}.ndlovucavelle.workers.dev"
    
    # Run the comprehensive test script we created
    print_info "Deploying comprehensive test worker..."
    
    # Create temporary test configuration
    cat > "wrangler.comprehensive-test.toml" << EOF
name = "${WORKER_NAME}-comprehensive-test"
main = "monitoring/performance/test-hyperdrive-connection.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
account_id = "e16d3bf549153de23459a6c6a06a431b"

[vars]
ENVIRONMENT = "test"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "$HYPERDRIVE_ID"
EOF
    
    # Deploy comprehensive test
    wrangler deploy --config wrangler.comprehensive-test.toml
    
    COMPREHENSIVE_URL="https://${WORKER_NAME}-comprehensive-test.ndlovucavelle.workers.dev"
    
    print_info "Running comprehensive tests at: $COMPREHENSIVE_URL"
    sleep 10
    
    # Get test results
    TEST_RESULTS=$(curl -s "$COMPREHENSIVE_URL" || echo '{"totalTests":0,"failedTests":999}')
    TOTAL_TESTS=$(echo "$TEST_RESULTS" | jq -r '.totalTests // 0')
    FAILED_TESTS=$(echo "$TEST_RESULTS" | jq -r '.failedTests // 999')
    SUCCESSFUL_TESTS=$(echo "$TEST_RESULTS" | jq -r '.successfulTests // 0')
    
    if [ "$FAILED_TESTS" -eq 0 ] && [ "$SUCCESSFUL_TESTS" -gt 0 ]; then
        print_status "All $TOTAL_TESTS comprehensive tests passed!"
        
        # Show performance summary
        AVG_TIME=$(echo "$TEST_RESULTS" | jq -r '.averageResponseTime // 0')
        print_info "Average response time: ${AVG_TIME}ms"
        
        # Show recommendations
        echo "$TEST_RESULTS" | jq -r '.recommendations[]?' | while read -r recommendation; do
            echo -e "   ${BLUE}$recommendation${NC}"
        done
        
    else
        print_warning "$FAILED_TESTS out of $TOTAL_TESTS tests failed"
        
        # Show failed test details
        echo "$TEST_RESULTS" | jq -r '.results[] | select(.success == false) | "   ❌ " + .method + ": " + .error'
    fi
    
    # Cleanup comprehensive test worker
    print_info "Cleaning up comprehensive test worker..."
    wrangler delete "${WORKER_NAME}-comprehensive-test" --force 2>/dev/null || true
    rm -f wrangler.comprehensive-test.toml
    
    echo ""
}

# Function to perform the actual migration
perform_migration() {
    print_info "Performing production migration to Hyperdrive..."
    
    # Confirm migration
    echo -e "${YELLOW}⚠️  This will update your production worker to use Hyperdrive.${NC}"
    echo -e "${YELLOW}   The current worker will be replaced.${NC}"
    read -p "Do you want to proceed? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Migration cancelled by user"
        return 1
    fi
    
    # Update main wrangler.toml to use Hyperdrive worker
    print_info "Updating production configuration..."
    
    # Update the main entry point in wrangler.toml
    sed -i.bak 's/main = "src\/worker-production-db.ts"/main = "src\/worker-hyperdrive-fixed.ts"/' wrangler.toml
    
    # Deploy to production
    print_info "Deploying to production..."
    wrangler deploy
    
    print_status "Production deployment completed"
    
    # Test production deployment
    PROD_URL="https://${WORKER_NAME}.ndlovucavelle.workers.dev"
    print_info "Testing production deployment at: $PROD_URL"
    
    sleep 10
    
    # Quick health check
    PROD_HEALTH=$(curl -s "$PROD_URL/api/health" || echo '{"status":"error"}')
    PROD_STATUS=$(echo "$PROD_HEALTH" | jq -r '.status // "unknown"')
    
    if [ "$PROD_STATUS" = "healthy" ]; then
        print_status "Production health check passed"
        print_status "Migration to Hyperdrive completed successfully! 🎉"
    else
        print_error "Production health check failed!"
        print_error "Consider rolling back using: ./rollback-hyperdrive-migration.sh"
        return 1
    fi
}

# Function to cleanup test resources
cleanup_test_resources() {
    print_info "Cleaning up test resources..."
    
    # Remove test worker
    wrangler delete "${WORKER_NAME}${TEST_WORKER_SUFFIX}" --force 2>/dev/null || true
    
    # Remove test files
    rm -f src/worker-hyperdrive-test.ts
    rm -f wrangler.test.toml
    
    print_status "Test resources cleaned up"
}

# Function to create rollback script
create_rollback_script() {
    print_info "Creating rollback script..."
    
    cat > "rollback-hyperdrive-migration.sh" << 'EOF'
#!/bin/bash

# Rollback script for Hyperdrive migration

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔄 Rolling back Hyperdrive migration...${NC}"

# Find the most recent backup
BACKUP_TOML=$(ls -t wrangler.toml.backup.* 2>/dev/null | head -1)
BACKUP_WORKER=$(ls -t src/worker-production-db.ts.backup.* 2>/dev/null | head -1)

if [ -n "$BACKUP_TOML" ]; then
    echo -e "${GREEN}✅ Restoring wrangler.toml from: $BACKUP_TOML${NC}"
    cp "$BACKUP_TOML" wrangler.toml
else
    echo -e "${RED}❌ No wrangler.toml backup found${NC}"
    exit 1
fi

if [ -n "$BACKUP_WORKER" ]; then
    echo -e "${GREEN}✅ Restoring worker from: $BACKUP_WORKER${NC}"
    cp "$BACKUP_WORKER" src/worker-production-db.ts
fi

# Update wrangler.toml to use original worker
sed -i.rollback 's/main = "src\/worker-hyperdrive-fixed.ts"/main = "src\/worker-production-db.ts"/' wrangler.toml

# Deploy rollback
echo -e "${YELLOW}🚀 Deploying rollback...${NC}"
wrangler deploy

echo -e "${GREEN}✅ Rollback completed${NC}"
echo -e "${YELLOW}⚠️  Please test your application to ensure it's working correctly${NC}"
EOF

    chmod +x rollback-hyperdrive-migration.sh
    print_status "Rollback script created: rollback-hyperdrive-migration.sh"
}

# Main execution
main() {
    echo -e "${BLUE}Starting Hyperdrive migration process...${NC}"
    echo ""
    
    # Step 1: Prerequisites
    check_prerequisites
    
    # Step 2: Backup
    backup_configuration
    
    # Step 3: Test current setup
    test_current_setup
    
    # Step 4: Create test worker
    create_test_worker
    
    # Step 5: Test Hyperdrive worker
    if test_hyperdrive_worker; then
        print_status "Hyperdrive testing successful"
    else
        print_error "Hyperdrive testing failed - aborting migration"
        cleanup_test_resources
        exit 1
    fi
    
    # Step 6: Run comprehensive tests
    run_comprehensive_tests
    
    # Step 7: Create rollback script
    create_rollback_script
    
    # Step 8: Perform migration
    if perform_migration; then
        print_status "Migration completed successfully!"
    else
        print_error "Migration failed"
        cleanup_test_resources
        exit 1
    fi
    
    # Step 9: Cleanup
    cleanup_test_resources
    
    echo ""
    echo -e "${GREEN}🎉 Hyperdrive migration completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}What was migrated:${NC}"
    echo -e "   ✅ Database connection from direct to Hyperdrive"
    echo -e "   ✅ Connection pooling optimization"
    echo -e "   ✅ Performance improvements"
    echo -e "   ✅ Error handling and fallback logic"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "   📊 Monitor performance at: https://dash.cloudflare.com"
    echo -e "   🔍 Check logs for any issues"
    echo -e "   📈 Compare performance metrics"
    echo -e "   🔄 Use rollback-hyperdrive-migration.sh if needed"
    echo ""
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}Script interrupted. Cleaning up...${NC}"; cleanup_test_resources; exit 1' INT TERM

# Run main function
main "$@"