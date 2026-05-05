// CRITICAL: Import React global setup FIRST before anything else
// React Router v7 doesn't need use-sync-external-store polyfill
import './react-global';

// TypeScript declarations for debugging
declare global {
  interface Window {
    __lastError?: Error;
    __lastRejection?: any;
    __appInitError?: Error;
    __fatalInitError?: Error;
    __errorBoundaryError?: Error;
  }
}

// Debug: Mark that main.tsx is executing

// ENSURE React is available globally before any other imports
import * as React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';


import './index.css'
import './lib/fix-all-apis.ts' // Fix all API URLs globally
import App from './App.tsx'
import { initSentry } from './monitoring/sentry-config'

// Initialize Sentry for production error tracking
initSentry()

// OpenTelemetry RUM — lazy-loaded after first paint so the SDK doesn't block initial render.
// Exports spans to /api/_otel/v1/traces (proxied to Axiom by the worker envelope handler).
// setTimeout fallback exists for Safari (no requestIdleCallback support as of 2026); don't simplify.
const scheduleIdle: (cb: () => void) => unknown =
  (window as Window & { requestIdleCallback?: (cb: () => void) => unknown }).requestIdleCallback
  ?? ((cb) => setTimeout(cb, 1500));
scheduleIdle(() => {
  import('./monitoring/otel-init')
    .then((m) => m.initOtel())
    .catch((err) => console.warn('[otel] dynamic import failed', err));
});

// Handle stale chunk errors after deployment — Vite fires this when a
// lazy-loaded module can't be fetched (e.g. old hash no longer on CDN).
// Auto-reload once to pick up the new index.html with correct hashes.
window.addEventListener('vite:preloadError', (event) => {
  const reloadedKey = 'pitchey_chunk_reload';
  if (!sessionStorage.getItem(reloadedKey)) {
    sessionStorage.setItem(reloadedKey, '1');
    window.location.reload();
  }
  // Prevent the error from propagating if we've already reloaded once
  event.preventDefault();
});

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    
    // Wrap App in error boundary for debugging
    const AppWithErrorCapture = () => {
      try {
        return React.createElement(App);
      } catch (error) {
        console.warn('App initialization error:', error);
        window.__appInitError = error as Error;
        throw error;
      }
    };
    
    root.render(
      React.createElement(AppWithErrorCapture)
    );

    // Clear the chunk reload flag on successful render — ensures future
    // deploys can trigger a fresh reload if needed.
    sessionStorage.removeItem('pitchey_chunk_reload');
  } catch (error) {
    console.warn('main.tsx: Fatal error during app initialization:', error);
    window.__fatalInitError = error as Error;
    const err = error as Error;
    // Display error on page
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: monospace;">
        <h1>Initialization Error</h1>
        <pre>${err.message}</pre>
        <pre>${err.stack}</pre>
      </div>
    `;
  }
} else {
  console.warn('main.tsx: Root element not found!');
}
