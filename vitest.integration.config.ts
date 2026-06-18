import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Integration tier — drives the REAL worker `fetch()` (src/worker-integrated.ts)
// against a throwaway Neon branch (TEST_DATABASE_URL). This is the tier the
// backend unit config explicitly defers ("anything that needs Worker bindings
// belongs in an integration tier we haven't built yet"). It exercises the live
// router, handlers, services, and raw SQL — the path with 0% unit coverage.
//
// Run: TEST_DATABASE_URL=<neon-branch-pooler-url> npx vitest run --config vitest.integration.config.ts
//
// Kept OUT of the default backend suite (different config) because it needs a DB
// and runs slower; CI runs it as its own job on the per-PR Neon branch.
export default defineConfig({
  test: {
    root: __dirname,
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    // Integration tests share one throwaway DB; run serially to avoid cross-test
    // data races on shared rows (demo accounts, etc.).
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage-integration',
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**', 'dist/**', 'src/workflows/**',
        'src/workers/crawl4ai-worker.ts', 'src/services/console-analysis-crawler.ts',
        '**/*.test.ts', '**/__tests__/**', 'src/test/**', 'src/tests/**', '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
