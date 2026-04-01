import * as Sentry from '@sentry/react'
import { useBetterAuthStore } from '../store/betterAuthStore'

// Performance monitoring configuration
const REPLAY_SAMPLE_RATE = import.meta.env.PROD ? 0.1 : 0.5 // 10% in production
const TRACES_SAMPLE_RATE = import.meta.env.PROD ? 0.1 : 1.0

// Initialize Sentry
export function initSentry() {
  const dsn = import.meta.env['VITE_SENTRY_DSN'] as string

  if (!dsn) {
    console.warn('Sentry DSN not configured')
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: (import.meta.env['VITE_APP_VERSION'] as string) || 'unknown',

    // Performance Monitoring
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration(),

      // Session replay for debugging
      Sentry.replayIntegration({
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
        networkDetailAllowUrls: [
          'pitchey-api-prod.ndlovucavelle.workers.dev'
        ],
        networkCaptureBodies: true,
        networkRequestHeaders: ['X-Request-ID'],
        networkResponseHeaders: ['X-Response-Time']
      }),

      // Capture console errors (only errors, not warnings — warnings like
      // "auth required" on login pages are expected and create noise)
      Sentry.captureConsoleIntegration({
        levels: ['error']
      })
    ],

    // Attach sentry-trace + baggage headers to outgoing API requests so
    // frontend traces connect to backend traces.
    // - /\/api\// matches all same-origin requests through the Pages proxy (production)
    // - localhost matches dev against http://localhost:8001
    // - the Worker hostname matches direct-to-Worker calls (WebSocket auth, etc.)
    tracePropagationTargets: [
      /\/api\//,
      'localhost',
      'pitchey-api-prod.ndlovucavelle.workers.dev'
    ],

    // Performance monitoring sample rate
    tracesSampleRate: TRACES_SAMPLE_RATE,

    // Session replay sample rates (must be at init level, not inside replayIntegration)
    replaysSessionSampleRate: REPLAY_SAMPLE_RATE,
    replaysOnErrorSampleRate: 1.0,

    // Session tracking
    autoSessionTracking: true,

    // Release tracking
    attachStacktrace: true,

    // Error filtering
    ignoreErrors: [
      // Browser extensions
      'Non-Error promise rejection captured',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',

      // Network errors
      'NetworkError',
      'Network request failed',
      'Failed to fetch',

      // Known third-party errors
      'top.GLOBALS',
      'Script error',
      'Cross-Origin',

      // Ignore specific error messages
      /401/,
      /403/,
      /404/
    ],

    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,

      // Other browsers
      /^moz-extension:\/\//i,
      /^safari-extension:\/\//i
    ],

    // User context
    beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
      // Filter out auth-timing noise (API calls that fire before session is established)
      const message = (hint.originalException as any)?.message
        || event.message
        || event.exception?.values?.[0]?.value
        || '';
      if (/Authentication required|not available.*Authentication|Could not get WebSocket token|Module resolved without default export|ChunkLoadError|Loading chunk/i.test(message)) {
        return null;
      }

      // Add custom context
      if (event.exception) {
        const error = hint.originalException as any;

        // Add custom error tags
        event.tags = {
          ...event.tags,
          component: error?.component || 'unknown',
          portal: window.location.pathname.split('/')[1] || 'public'
        }

        // Add breadcrumbs for better debugging
        event.breadcrumbs = [
          ...(event.breadcrumbs || []),
          {
            timestamp: Date.now() / 1000,
            category: 'custom',
            message: 'Error context',
            level: 'info',
            data: {
              url: window.location.href,
              userAgent: navigator.userAgent,
              viewport: `${window.innerWidth}x${window.innerHeight}`
            }
          }
        ]
      }

      // Filter sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies
      }

      return event
    },

    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null
      }

      // Enhance navigation breadcrumbs
      if (breadcrumb.category === 'navigation') {
        breadcrumb.data = {
          ...breadcrumb.data,
          timestamp: new Date().toISOString()
        }
      }

      return breadcrumb
    }
  })

  // Set initial user context
  const user = getUserFromStore()
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      ip_address: '{{auto}}'
    })
  }
}

// Performance monitoring utilities
export const SentryPerformance = {
  // Start a span (Sentry v8 API)
  startTransaction(name: string, op: string = 'navigation') {
    return Sentry.startInactiveSpan({
      name,
      op,
      attributes: {
        portal: window.location.pathname.split('/')[1] || 'public'
      }
    })
  },

  // Measure component render time
  measureComponent(componentName: string) {
    return Sentry.startInactiveSpan({
      op: 'react.component',
      name: componentName
    })
  },

  // Track API calls
  trackAPICall(url: string, method: string, startTime: number) {
    const duration = Date.now() - startTime

    Sentry.addBreadcrumb({
      category: 'api',
      message: `${method} ${url}`,
      level: 'info',
      data: {
        method,
        url,
        duration,
        status: 'success'
      }
    })

    // Track slow API calls
    if (duration > 3000) {
      Sentry.captureMessage(`Slow API call: ${method} ${url} took ${duration}ms`, 'warning')
    }
  },

  // Track user interactions
  trackInteraction(action: string, category: string, label?: string) {
    Sentry.addBreadcrumb({
      category: 'ui.click',
      message: `${category}: ${action}`,
      level: 'info',
      data: {
        action,
        category,
        label
      }
    })
  },

  // Track custom metrics
  trackMetric(name: string, value: number, unit: string = 'ms') {
    // Sentry v8: Use measurements API instead of transactions
    Sentry.setMeasurement(name, value, unit);
  }
}

// Error boundary component
export const SentryErrorBoundary = Sentry.ErrorBoundary

// Profile user sessions
export function profileUser(userId: string, traits: Record<string, any>) {
  Sentry.setUser({
    id: userId,
    ...traits
  })
}

// Track custom events
export function trackEvent(eventName: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    category: 'custom',
    message: eventName,
    level: 'info',
    data
  })
}

// Capture custom errors with context
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.withScope((scope: Sentry.Scope) => {
    if (context) {
      scope.setContext('custom', context)
    }
    Sentry.captureException(error)
  })
}

// Web Vitals monitoring
export function trackWebVitals() {
  if ('PerformanceObserver' in window) {
    // Track Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]

      if (lastEntry) {
        SentryPerformance.trackMetric('lcp', lastEntry.startTime, 'ms')

        if (lastEntry.startTime > 2500) {
          Sentry.captureMessage(`Poor LCP: ${lastEntry.startTime}ms`, 'warning')
        }
      }
    })

    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

    // Track First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry: any) => {
        SentryPerformance.trackMetric('fid', entry.processingStart - entry.startTime, 'ms')

        if (entry.processingStart - entry.startTime > 100) {
          Sentry.captureMessage(`Poor FID: ${entry.processingStart - entry.startTime}ms`, 'warning')
        }
      })
    })

    fidObserver.observe({ entryTypes: ['first-input'] })

    // Track Cumulative Layout Shift (CLS)
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
        }
      }

      SentryPerformance.trackMetric('cls', clsValue, 'score')

      if (clsValue > 0.1) {
        Sentry.captureMessage(`Poor CLS: ${clsValue}`, 'warning')
      }
    })

    clsObserver.observe({ entryTypes: ['layout-shift'] })
  }
}

// Helper to get user from auth store
function getUserFromStore() {
  return useBetterAuthStore.getState().user ?? null
}

// Resource timing monitoring
export function monitorResourceTiming() {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resource = entry as PerformanceResourceTiming

          // Track slow resources
          if (resource.duration > 1000) {
            Sentry.addBreadcrumb({
              category: 'resource',
              message: `Slow resource: ${resource.name}`,
              level: 'warning',
              data: {
                duration: resource.duration,
                transferSize: resource.transferSize,
                type: resource.initiatorType
              }
            })
          }
        }
      }
    })

    observer.observe({ entryTypes: ['resource'] })
  }
}

// Memory monitoring
export function monitorMemory() {
  if ('memory' in performance) {
    setInterval(() => {
      const memory = (performance as any).memory

      // Check for memory leaks
      if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
        Sentry.captureMessage('High memory usage detected', 'warning')
      }

      SentryPerformance.trackMetric('memory.used', memory.usedJSHeapSize, 'bytes')
      SentryPerformance.trackMetric('memory.limit', memory.jsHeapSizeLimit, 'bytes')
    }, 30000) // Check every 30 seconds
  }
}

export default {
  init: initSentry,
  Performance: SentryPerformance,
  ErrorBoundary: SentryErrorBoundary,
  profileUser,
  trackEvent,
  captureError,
  trackWebVitals,
  monitorResourceTiming,
  monitorMemory
}