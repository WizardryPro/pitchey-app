#!/usr/bin/env node

/**
 * API Endpoint Verification Script
 * Tests all critical API endpoints for frontend-backend connection issues
 * 
 * Usage:
 *   node api-endpoint-verification.js
 *   node api-endpoint-verification.js --verbose
 *   node api-endpoint-verification.js --test-pitch=162
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const API_BASE_URL = 'https://pitchey-optimized.ndlovucavelle.workers.dev';
const TEST_PITCH_ID = process.argv.find(arg => arg.startsWith('--test-pitch='))?.split('=')[1] || '162';
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');
const TIMEOUT = 10000; // 10 seconds

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Logging functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    debug: `${colors.cyan}🔍${colors.reset}`
  };
  
  console.log(`${prefix[type]} [${timestamp}] ${message}`);
}

function logVerbose(message) {
  if (VERBOSE) {
    log(message, 'debug');
  }
}

// HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Pitchey-API-Test/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: TIMEOUT
    };

    logVerbose(`Making ${requestOptions.method} request to ${url}`);

    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: data,
            parsedData: null
          };

          // Try to parse JSON
          if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
            try {
              result.parsedData = JSON.parse(data);
            } catch (parseError) {
              result.parseError = parseError.message;
            }
          }

          logVerbose(`Response: ${res.statusCode} ${res.statusMessage}`);
          logVerbose(`Content-Type: ${res.headers['content-type']}`);
          logVerbose(`Response length: ${data.length} bytes`);

          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      logVerbose(`Request error: ${error.message}`);
      reject(error);
    });

    req.on('timeout', () => {
      logVerbose(`Request timeout after ${TIMEOUT}ms`);
      req.destroy();
      reject(new Error(`Request timeout after ${TIMEOUT}ms`));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test definitions
const tests = [
  {
    name: 'Root Health Check',
    url: `${API_BASE_URL}/`,
    description: 'Basic connectivity test to the root endpoint',
    critical: false,
    expectedStatus: [200, 404], // 404 is acceptable for root
    validate: (response) => {
      return response.status === 200 || response.status === 404;
    }
  },
  {
    name: 'API Health Endpoint',
    url: `${API_BASE_URL}/api/health`,
    description: 'Health check endpoint for API status',
    critical: false,
    expectedStatus: [200],
    validate: (response) => {
      return response.status === 200;
    }
  },
  {
    name: 'Public Pitches List',
    url: `${API_BASE_URL}/api/pitches/public`,
    description: 'Get list of all public pitches (marketplace data)',
    critical: true,
    expectedStatus: [200],
    validate: (response) => {
      if (response.status !== 200) return false;
      if (!response.parsedData) return false;
      
      // Check if response contains pitches in expected format
      const data = response.parsedData;
      if (data.success && data.data && Array.isArray(data.data.pitches)) return true;
      if (Array.isArray(data.pitches)) return true;
      if (Array.isArray(data)) return true;
      
      return false;
    }
  },
  {
    name: 'Specific Pitch Detail',
    url: `${API_BASE_URL}/api/pitches/public/${TEST_PITCH_ID}`,
    description: `Get specific pitch details for ID ${TEST_PITCH_ID}`,
    critical: true,
    expectedStatus: [200],
    validate: (response) => {
      if (response.status !== 200) return false;
      if (!response.parsedData) return false;
      
      // Check if response contains pitch data
      const data = response.parsedData;
      if (data.success && data.data && data.data.pitch) return true;
      if (data.pitch && data.pitch.id) return true;
      if (data.id) return true;
      
      return false;
    }
  },
  {
    name: 'API Version/Info',
    url: `${API_BASE_URL}/api/version`,
    description: 'Check API version and configuration',
    critical: false,
    expectedStatus: [200, 404], // 404 acceptable if endpoint doesn't exist
    validate: (response) => {
      return response.status === 200 || response.status === 404;
    }
  },
  {
    name: 'CORS Preflight Check',
    url: `${API_BASE_URL}/api/pitches/public`,
    description: 'Test CORS configuration for frontend requests',
    critical: true,
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Content-Type, Authorization'
    },
    expectedStatus: [200, 204],
    validate: (response) => {
      if (response.status !== 200 && response.status !== 204) return false;
      
      // Check CORS headers
      const corsHeader = response.headers['access-control-allow-origin'];
      return corsHeader === '*' || corsHeader === 'http://localhost:5173' || corsHeader === 'https://pitchey.pages.dev';
    }
  }
];

// Enhanced analysis functions
function analyzeResponse(test, response) {
  const analysis = {
    passed: false,
    issues: [],
    warnings: [],
    details: {}
  };

  // Basic status check
  if (!test.expectedStatus.includes(response.status)) {
    analysis.issues.push(`Unexpected status code: ${response.status} (expected: ${test.expectedStatus.join(' or ')})`);
  }

  // Content-Type check
  if (response.status === 200 && test.url.includes('/api/')) {
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      analysis.issues.push(`Missing or incorrect Content-Type header: ${contentType}`);
    }
  }

  // JSON parsing check
  if (response.status === 200 && response.data && !response.parsedData && !response.parseError) {
    analysis.issues.push('Response is not valid JSON');
  }

  if (response.parseError) {
    analysis.issues.push(`JSON parse error: ${response.parseError}`);
  }

  // Custom validation
  if (test.validate) {
    try {
      const validationResult = test.validate(response);
      if (!validationResult) {
        analysis.issues.push('Custom validation failed');
      }
    } catch (validationError) {
      analysis.issues.push(`Validation error: ${validationError.message}`);
    }
  }

  // Response data analysis
  if (response.parsedData) {
    analysis.details.responseStructure = Object.keys(response.parsedData);
    
    // Check for specific data patterns
    if (test.url.includes('/pitches/public') && !test.url.match(/\/\d+$/)) {
      // Public pitches list
      const data = response.parsedData;
      let pitchCount = 0;
      
      if (data.success && data.data && Array.isArray(data.data.pitches)) {
        pitchCount = data.data.pitches.length;
      } else if (Array.isArray(data.pitches)) {
        pitchCount = data.pitches.length;
      } else if (Array.isArray(data)) {
        pitchCount = data.length;
      }
      
      analysis.details.pitchCount = pitchCount;
      
      if (pitchCount === 0) {
        analysis.warnings.push('No pitches found in response');
      }
    }
    
    if (test.url.includes(`/pitches/public/${TEST_PITCH_ID}`)) {
      // Individual pitch
      const data = response.parsedData;
      let pitch = null;
      
      if (data.success && data.data && data.data.pitch) {
        pitch = data.data.pitch;
      } else if (data.pitch) {
        pitch = data.pitch;
      } else if (data.id) {
        pitch = data;
      }
      
      if (pitch) {
        analysis.details.pitchTitle = pitch.title;
        analysis.details.pitchId = pitch.id;
        analysis.details.creatorName = pitch.creator?.username || pitch.creator?.companyName;
        
        if (pitch.id != TEST_PITCH_ID) {
          analysis.warnings.push(`Pitch ID mismatch: got ${pitch.id}, expected ${TEST_PITCH_ID}`);
        }
      }
    }
  }

  // Determine overall pass/fail
  analysis.passed = analysis.issues.length === 0;

  return analysis;
}

function generateReport(results) {
  console.log(`\n${colors.bold}📊 API ENDPOINT VERIFICATION REPORT${colors.reset}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Test Target: ${API_BASE_URL}`);
  console.log(`Test Pitch ID: ${TEST_PITCH_ID}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Total Tests: ${results.length}`);
  
  const passed = results.filter(r => r.analysis.passed);
  const failed = results.filter(r => !r.analysis.passed);
  const criticalFailed = failed.filter(r => r.test.critical);
  
  console.log(`✓ Passed: ${colors.green}${passed.length}${colors.reset}`);
  console.log(`✗ Failed: ${colors.red}${failed.length}${colors.reset}`);
  console.log(`🚨 Critical Failed: ${colors.red}${criticalFailed.length}${colors.reset}`);
  
  // Overall status
  if (criticalFailed.length === 0) {
    console.log(`\n${colors.green}✅ OVERALL STATUS: API is working correctly${colors.reset}`);
  } else {
    console.log(`\n${colors.red}❌ OVERALL STATUS: Critical API issues detected${colors.reset}`);
  }
  
  console.log(`\n${colors.bold}📋 TEST DETAILS${colors.reset}`);
  console.log(`${'='.repeat(60)}`);
  
  results.forEach((result, index) => {
    const { test, response, analysis, duration, error } = result;
    const status = error ? colors.red + '💥' : analysis.passed ? colors.green + '✓' : colors.red + '✗';
    const critical = test.critical ? ' 🚨' : '';
    
    console.log(`\n${index + 1}. ${status} ${test.name}${critical}${colors.reset}`);
    console.log(`   ${test.description}`);
    console.log(`   URL: ${test.url}`);
    console.log(`   Duration: ${duration}ms`);
    
    if (error) {
      console.log(`   ${colors.red}Error: ${error.message}${colors.reset}`);
    } else {
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (analysis.issues.length > 0) {
        console.log(`   ${colors.red}Issues:${colors.reset}`);
        analysis.issues.forEach(issue => console.log(`     • ${issue}`));
      }
      
      if (analysis.warnings.length > 0) {
        console.log(`   ${colors.yellow}Warnings:${colors.reset}`);
        analysis.warnings.forEach(warning => console.log(`     • ${warning}`));
      }
      
      if (VERBOSE && Object.keys(analysis.details).length > 0) {
        console.log(`   Details:`);
        Object.entries(analysis.details).forEach(([key, value]) => {
          console.log(`     ${key}: ${JSON.stringify(value)}`);
        });
      }
    }
  });
  
  // Recommendations
  if (criticalFailed.length > 0) {
    console.log(`\n${colors.bold}🔧 RECOMMENDATIONS${colors.reset}`);
    console.log(`${'='.repeat(60)}`);
    
    criticalFailed.forEach((result, index) => {
      console.log(`\n${index + 1}. ${colors.red}${result.test.name}${colors.reset}`);
      if (result.error) {
        console.log(`   Network/Connection Issue: ${result.error.message}`);
        console.log(`   → Check if the Cloudflare Worker is deployed and accessible`);
        console.log(`   → Verify DNS resolution for pitchey-optimized.ndlovucavelle.workers.dev`);
      } else {
        result.analysis.issues.forEach(issue => {
          console.log(`   Issue: ${issue}`);
        });
        
        if (result.test.url.includes('/pitches/public')) {
          console.log(`   → Check if the public pitches endpoint is properly implemented`);
          console.log(`   → Verify database connection and data availability`);
          console.log(`   → Check API response format consistency`);
        }
        
        if (result.test.method === 'OPTIONS') {
          console.log(`   → Configure CORS headers in Cloudflare Worker`);
          console.log(`   → Allow Origin: * or specific domains`);
          console.log(`   → Allow Methods: GET, POST, OPTIONS`);
        }
      }
    });
    
    console.log(`\n${colors.yellow}Next Steps:${colors.reset}`);
    console.log(`1. Fix critical API endpoint issues listed above`);
    console.log(`2. Run frontend test: open comprehensive-user-flow-test.html`);
    console.log(`3. Test marketplace page directly in browser`);
    console.log(`4. Check browser developer console for frontend errors`);
    console.log(`5. Re-run this test after fixes: node api-endpoint-verification.js`);
  } else {
    console.log(`\n${colors.green}🎉 All critical endpoints are working!${colors.reset}`);
    console.log(`\nNext steps for frontend testing:`);
    console.log(`1. Open comprehensive-user-flow-test.html in your browser`);
    console.log(`2. Navigate to the marketplace page and test pitch clicking`);
    console.log(`3. Check if React routing works for /pitch/162`);
  }
}

// Main execution
async function runTests() {
  console.log(`${colors.bold}🚀 Starting API Endpoint Verification${colors.reset}`);
  console.log(`Target: ${API_BASE_URL}`);
  console.log(`Verbose: ${VERBOSE ? 'enabled' : 'disabled'}`);
  console.log(`Timeout: ${TIMEOUT}ms`);
  console.log(`Test Pitch ID: ${TEST_PITCH_ID}\n`);
  
  const results = [];
  
  for (const test of tests) {
    log(`Testing: ${test.name}`, 'info');
    
    const startTime = Date.now();
    let result = {
      test,
      duration: 0,
      response: null,
      analysis: null,
      error: null
    };
    
    try {
      const response = await makeRequest(test.url, {
        method: test.method || 'GET',
        headers: test.headers || {}
      });
      
      result.duration = Date.now() - startTime;
      result.response = response;
      result.analysis = analyzeResponse(test, response);
      
      if (result.analysis.passed) {
        log(`✓ ${test.name} - PASSED (${result.duration}ms)`, 'success');
      } else {
        const criticalMark = test.critical ? ' [CRITICAL]' : '';
        log(`✗ ${test.name} - FAILED${criticalMark} (${result.duration}ms)`, 'error');
        if (VERBOSE) {
          result.analysis.issues.forEach(issue => log(`  └─ ${issue}`, 'error'));
        }
      }
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = error;
      
      const criticalMark = test.critical ? ' [CRITICAL]' : '';
      log(`💥 ${test.name} - ERROR${criticalMark} (${result.duration}ms): ${error.message}`, 'error');
    }
    
    results.push(result);
    
    // Small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  generateReport(results);
  
  // Exit code based on critical failures
  const criticalFailures = results.filter(r => (r.error || !r.analysis?.passed) && r.test.critical);
  process.exit(criticalFailures.length > 0 ? 1 : 0);
}

// Handle errors and exit gracefully
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'error');
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at ${promise}: ${reason}`, 'error');
  process.exit(1);
});

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    log(`Test execution failed: ${error.message}`, 'error');
    process.exit(1);
  });
}