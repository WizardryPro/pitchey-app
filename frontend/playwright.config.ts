import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 3, // Optimized for local and CI
  timeout: 90000, // Increased for comprehensive workflows
  expect: {
    // Global timeout for assertions
    timeout: 10000,
    // Visual comparison threshold
    toHaveScreenshot: { 
      threshold: 0.2,
      maxDiffPixels: 1000
    }
  },
  reporter: [
    ['html', { 
      open: 'never',
      outputFolder: 'test-results/html-report'
    }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ['line'],
    ['github'] // GitHub Actions integration
  ],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Better Auth uses cookies for session management
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    extraHTTPHeaders: {
      // Accept cookies from cross-origin requests
      'Accept': 'application/json, text/plain, */*',
    },
    // Preserve authentication state across tests
    storageState: undefined, // Will be set per test suite
    // Performance optimizations
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    // Setup project to prepare test data and environment
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 }
      },
      timeout: 120000, // Extended timeout for setup
    },

    // PRIORITY 1: Critical User Journey Tests (run first)
    {
      name: 'critical-user-journeys',
      testMatch: /(guest-conversion|investor-discovery-workflow|creator-content-nda-workflow)\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 },
        trace: 'on',
        video: 'on'
      },
      // dependencies: ['setup'], // Temporarily disabled
      timeout: 120000,
    },

    // PRIORITY 2: Core Portal Functionality
    {
      name: 'portal-functionality', 
      testMatch: /(nda-workflow|saved-pitches|portal-dashboards|creator-workflows|investor-workflows|production-workflows)\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 }
      },
      // dependencies: ['setup'], // Temporarily disabled
    },

    // PRIORITY 3: API and Integration Tests
    {
      name: 'api-integration',
      testMatch: /(api-integration|file-upload-integration)\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 }
      },
      // dependencies: ['setup'], // Temporarily disabled
    },

    // PRIORITY 4: Cross-Platform Integration
    {
      name: 'cross-platform',
      testMatch: /cross-portal-multi-browser\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 }
      },
      // dependencies: ['setup'], // Temporarily disabled
      timeout: 180000, // Extended for multi-browser tests
    },

    // PRIORITY 5: Visual Regression Testing
    {
      name: 'visual-regression',
      testMatch: /visual-regression.*\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 },
        // Optimize for visual testing
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=TranslateUI',
            '--no-default-browser-check',
            '--disable-dev-shm-usage'
          ]
        }
      },
      // dependencies: ['critical-user-journeys'], // Temporarily disabled
      timeout: 60000,
    },

    // Cross-Browser Compatibility (Firefox)
    {
      name: 'firefox-compatibility',
      testMatch: /(auth|integration|public-browsing)\.spec\.ts/,
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1400, height: 900 }
      },
      // dependencies: ['setup'], // Temporarily disabled
    },

    // Cross-Browser Compatibility (WebKit/Safari)
    {
      name: 'webkit-compatibility',
      testMatch: /(auth|public-browsing)\.spec\.ts/,
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1400, height: 900 }
      },
      // dependencies: ['setup'], // Temporarily disabled
    },

    // Mobile Responsive Testing
    {
      name: 'mobile-responsive',
      testMatch: /(public-browsing|guest-conversion)\.spec\.ts/,
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific optimizations
        launchOptions: {
          args: ['--disable-web-security']
        }
      },
      // dependencies: ['setup'], // Temporarily disabled
    },

    // Tablet Responsive Testing
    {
      name: 'tablet-responsive',
      testMatch: /(public-browsing|auth)\.spec\.ts/,
      use: { 
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 }
      },
      // dependencies: ['setup'], // Temporarily disabled
    },

    // Accessibility Testing
    {
      name: 'accessibility',
      testMatch: /.*\.accessibility\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 },
        // Accessibility-specific settings
        reducedMotion: 'reduce',
        forcedColors: 'none'
      },
      // dependencies: ['setup'], // Temporarily disabled
    },

    // Performance and Load Testing
    {
      name: 'performance',
      testMatch: /(performance|websocket-realtime)\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 },
        // Performance testing optimizations
        launchOptions: {
          args: ['--no-sandbox', '--disable-dev-shm-usage']
        }
      },
      // dependencies: ['setup'], // Temporarily disabled
      timeout: 120000,
    },

    // Final Coverage and Validation
    {
      name: 'coverage-validation',
      testMatch: /test-coverage\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 }
      },
      // dependencies: [
      //   'critical-user-journeys',
      //   'portal-functionality',
      //   'api-integration',
      //   'cross-platform'
      // ], // Temporarily disabled
    },

    // Production Tests (no local servers needed)
    {
      name: 'production',
      testMatch: /pitch-upload-with-media\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://pitchey-5o8.pages.dev',
        viewport: { width: 1400, height: 900 },
        video: 'on',
        trace: 'on'
      },
      timeout: 120000,
    },
  ],
  // Skip local servers in CI (tests run against deployed production)
  ...(process.env.CI ? {} : {
    webServer: [
      {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
        timeout: 60000,
        env: {
          VITE_API_URL: 'http://localhost:8001',
          VITE_WS_URL: 'ws://localhost:8001'
        }
      },
      {
        command: 'cd .. && npx wrangler dev',
        port: 8001,
        reuseExistingServer: true,
        timeout: 60000,
      },
    ],
  }),
  // globalSetup: './e2e/global-setup.ts', // Temporarily disabled
  globalTeardown: './e2e/global-teardown.ts',
});