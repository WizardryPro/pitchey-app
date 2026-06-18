import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Backend (Cloudflare Worker) unit-test runner.
// Node environment with the DB / Redis / network boundary mocked per-test — we do
// NOT spin up workerd here. Pure-logic services, handlers, and utils are the target;
// anything that genuinely needs Worker bindings belongs in an integration tier we
// haven't built yet. Frontend has its own config under frontend/.
//
// IMPORTANT: this file is deliberately NOT named `vitest.config.ts`. A root-level
// `vitest.config.ts` gets auto-discovered when running the FRONTEND suite from
// frontend/, which resets vitest's project root to the repo root and makes
// frontend's relative `setupFiles: ['./src/test/setup.ts']` resolve to THIS
// backend setup (node env, no jest-dom) — silently breaking ~all frontend tests.
// Run this explicitly: `vitest --config vitest.backend.config.ts` (see root
// package.json scripts). `root` is pinned to __dirname so paths never depend on cwd.
export default defineConfig({
  test: {
    root: __dirname,
    globals: true,
    environment: 'node',
    // NOT under src/test/ — that path collides with frontend's own
    // ./src/test/setup.ts and vitest would cross-resolve them, loading this
    // node-env setup into the frontend (jsdom) suite and breaking ~all of it.
    setupFiles: [resolve(__dirname, './test/backend-setup.ts')],
    include: ['src/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      'dist/**',
      'frontend/**',
      // Parked, never-deployed Workflows worker — owns its own vitest.config.ts (issue #60).
      'src/workflows/**',
      // sql-injection.test.ts — rewritten 2026-06-16 to assert the WHITELIST+THROW
      // security model (SafeQueryBuilder). Now runs in the default suite.
      // notification-scheduler.test.ts — DELETED 2026-06-16; the service
      // (notification-scheduler.service.ts) never existed. Test imported
      // `../../db/client` (Drizzle sweep deleted it) and `notificationChannelManager`
      // (no such service). Pure orphan with no live code to test.
    ],
    passWithNoTests: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    outputFile: {
      json: './test-results/backend-vitest-report.json',
      junit: './test-results/backend-junit.xml',
    },
    coverage: {
      provider: 'v8',
      // Always write the report, even if a test fails (e.g. the env-dependent
      // worker-jwt crypto test that only trips under coverage instrumentation in
      // CI). Otherwise a single failure leaves coverage-summary.json missing and
      // the quality gate reads 0% → false-fails. Test pass/fail is gated by the
      // separate test job, not here.
      reportOnFailure: true,
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/workflows/**',
        'src/workers/crawl4ai-worker.ts',
        'src/services/console-analysis-crawler.ts',
        '**/*.test.ts',
        '**/__tests__/**',
        'src/test/**',
        'src/tests/**',
        '**/*.d.ts',
      ],
      // No global threshold yet — backend coverage starts near zero. CI reports the
      // number without gating; raise this deliberately as coverage climbs.
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
