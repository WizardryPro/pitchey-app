import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
    outputFile: {
      json: './test-results/vitest-report.json',
      junit: './test-results/junit.xml',
    },
    coverage: {
      provider: 'v8',
      // Write the coverage report even when a test fails. Vitest otherwise skips
      // report generation on any failure, so one flaky/env-dependent test in CI
      // leaves coverage-summary.json missing → the gate reads 0% and (now that it
      // enforces) fails. Coverage % and test pass/fail are separate concerns: the
      // test job gates pass/fail; the coverage gate gates the %.
      reportOnFailure: true,
      // json-summary writes coverage/coverage-summary.json, which the CI
      // coverage-gate (quality-gates.yml) reads for the headline %. Without it,
      // CI silently fell back to scraping the HTML report (or 0).
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '*.config.*',
        'coverage/**',
        'e2e/**',
        'playwright-report/**',
        'test-results/**',
        'src/test/**',
        'src/tests/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'worker/**',
        'functions/**'
      ],
      include: [
        'src/**/*.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@app': resolve(__dirname, './src/app'),
      '@features': resolve(__dirname, './src/features'),
      '@portals': resolve(__dirname, './src/portals'),
      '@shared': resolve(__dirname, './src/shared'),
      '@config': resolve(__dirname, './src/config'),
      '@': resolve(__dirname, './src'),
    },
  },
})