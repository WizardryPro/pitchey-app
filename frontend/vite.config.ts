import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

// Upload source maps to Sentry so frontend stack traces de-minify (otherwise
// every Sentry error is unreadable). Injects debug IDs → no fragile release-name
// matching. Only active when SENTRY_AUTH_TOKEN is present (CI builds); a local
// build without it is a clean no-op. `filesToDeleteAfterUpload` strips the .map
// files from the deployed output so they're NOT served publicly from
// pitchey-5o8.pages.dev (they were fetchable = a minor source leak) while Sentry
// still keeps them privately.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const sentryPlugins = sentryAuthToken
  ? [
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: sentryAuthToken,
        release: { name: process.env.VITE_APP_VERSION || process.env.GITHUB_SHA || undefined },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      }),
    ]
  : []

// SIMPLIFIED CONFIG WITH PWA SUPPORT
export default defineConfig(() => {
  return {
    plugins: [
      react({
        // Force production JSX runtime - completely disable development transforms
        jsxRuntime: 'automatic',
        jsxImportSource: 'react',
        // Disable Fast Refresh in production builds to prevent dev transforms
        fastRefresh: false,
        // Explicitly set Babel to not include development plugins
        babel: {
          compact: true,
          minified: true,
        },
      }),
      // Must come after other plugins so it sees the final build output.
      ...sentryPlugins,
    ],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, './src/app'),
      '@features': path.resolve(__dirname, './src/features'),
      '@portals': path.resolve(__dirname, './src/portals'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@config': path.resolve(__dirname, './src/config'),
      '@': path.resolve(__dirname, './src'),
      // Force single React instance
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    target: 'es2020',
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Only split foundational deps that have no circular risk.
            // Heavy libs (recharts, framer-motion, radix) are already
            // deferred by React.lazy() — Rollup creates async chunks
            // for them automatically without cross-chunk TDZ issues.
            if (
              id.includes('/react-dom/') ||
              id.includes('/react/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('react-router') || id.includes('@remix-run')) {
              return 'vendor-router';
            }
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  esbuild: {
    // Force production JSX transform - no development helpers
    jsx: 'automatic',
    jsxDev: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    '__DEV__': 'false',
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': JSON.stringify('production'),
  },
  mode: 'production',
  }
})