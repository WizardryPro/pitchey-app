/**
 * TypeScript interfaces for performance monitoring and optimization
 */
import type React from 'react';

// Performance metrics interfaces
export interface PerformanceMetrics {
  /** Component render time in milliseconds */
  renderTime: number;
  /** Total component load time since mount */
  loadTime: number;
  /** Name of the component being measured */
  componentName: string;
  /** Timestamp when measurement was taken */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface WebVitalsMetrics {
  /** Largest Contentful Paint in milliseconds */
  lcp?: number;
  /** First Input Delay in milliseconds */
  fid?: number;
  /** Cumulative Layout Shift score */
  cls?: number;
  /** First Contentful Paint in milliseconds */
  fcp?: number;
  /** Time to First Byte in milliseconds */
  ttfb?: number;
}

export interface MemoryInfo {
  /** Used JavaScript heap size in bytes */
  usedJSHeapSize: number;
  /** Total JavaScript heap size in bytes */
  totalJSHeapSize: number;
  /** JavaScript heap size limit in bytes */
  jsHeapSizeLimit: number;
  /** Memory usage percentage */
  usagePercentage: number;
}

export interface LongTaskInfo {
  /** Duration of the long task in milliseconds */
  duration: number;
  /** Start time of the task */
  startTime: number;
  /** Task name if available */
  name: string;
  /** Attribution if available */
  attribution?: string;
}

// Virtualization interfaces
export interface VirtualItem {
  /** Unique key for the item */
  key: string | number;
  /** Index in the original list */
  index: number;
  /** Start position in pixels */
  start: number;
  /** Size of the item in pixels */
  size: number;
  /** End position in pixels */
  end: number;
}

export interface VirtualRange {
  /** Start index of visible items */
  startIndex: number;
  /** End index of visible items */
  endIndex: number;
  /** Total number of items */
  totalItems: number;
  /** Overscan before visible area */
  overscanBefore: number;
  /** Overscan after visible area */
  overscanAfter: number;
}

// Lazy loading interfaces
export interface LazyLoadOptions {
  /** Root element for intersection observer */
  root?: Element | null;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Intersection threshold */
  threshold?: number | number[];
  /** Whether to load immediately (skip lazy loading) */
  priority?: boolean;
}

export interface ImageLoadState {
  /** Current loading state */
  status: 'loading' | 'loaded' | 'error';
  /** Whether the image is in viewport */
  isInView: boolean;
  /** Error message if loading failed */
  error?: string;
  /** Load time in milliseconds */
  loadTime?: number;
}

// Error boundary interfaces
export interface ErrorInfo {
  /** Component stack trace */
  componentStack: string;
  /** Error boundary that caught the error */
  errorBoundary?: string;
  /** Additional error metadata */
  errorMetadata?: Record<string, unknown>;
}

export interface ErrorReport {
  /** Unique error ID */
  errorId: string;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Component stack from React */
  componentStack: string;
  /** When the error occurred */
  timestamp: string;
  /** User agent string */
  userAgent: string;
  /** Current page path */
  currentPath: string;
  /** Build environment info */
  buildInfo: {
    mode: string;
    prod: boolean;
    dev: boolean;
  };
  /** React version */
  reactVersion: string;
  /** User context if available */
  userContext?: {
    userId?: string;
    userType?: string;
    sessionId?: string;
  };
}

// Bundle analysis interfaces
export interface BundleInfo {
  /** Size of the main bundle in bytes */
  mainBundleSize: number;
  /** Size of vendor bundles in bytes */
  vendorBundleSize: number;
  /** Number of dynamic chunks */
  dynamicChunks: number;
  /** Total size of all assets */
  totalSize: number;
  /** Assets breakdown */
  assets: BundleAsset[];
}

export interface BundleAsset {
  /** Asset name */
  name: string;
  /** Asset size in bytes */
  size: number;
  /** Asset type */
  type: 'js' | 'css' | 'image' | 'font' | 'other';
  /** Whether it's a dynamic chunk */
  isDynamic: boolean;
  /** Compression ratio if applicable */
  compressionRatio?: number;
}

// Cache interfaces
export interface CacheConfig {
  /** Cache name */
  name: string;
  /** Maximum cache size in bytes */
  maxSize?: number;
  /** Time to live in milliseconds */
  ttl?: number;
  /** Whether to use browser cache */
  useBrowserCache?: boolean;
}

export interface CacheEntry<T = unknown> {
  /** Cached data */
  data: T;
  /** When the entry was created */
  timestamp: number;
  /** Time to live in milliseconds */
  ttl?: number;
  /** Entry size in bytes (estimated) */
  size?: number;
}

// Network performance interfaces
export interface NetworkMetrics {
  /** Request start time */
  startTime: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Transfer size in bytes */
  transferSize: number;
  /** Response status code */
  status: number;
  /** Request URL */
  url: string;
  /** Request method */
  method: string;
  /** Response type */
  type: 'xhr' | 'fetch' | 'navigation' | 'resource';
}

// Code splitting interfaces
export interface LazyComponentOptions {
  /** Fallback component while loading */
  fallback?: React.ComponentType;
  /** Error boundary component */
  errorBoundary?: React.ComponentType<{ error: Error }>;
  /** Preload strategy */
  preload?: 'hover' | 'viewport' | 'eager' | 'none';
  /** Retry count for failed loads */
  retryCount?: number;
}

// Performance budget interfaces
export interface PerformanceBudget {
  /** Maximum bundle size in bytes */
  maxBundleSize?: number;
  /** Maximum render time in milliseconds */
  maxRenderTime?: number;
  /** Maximum LCP time in milliseconds */
  maxLCP?: number;
  /** Maximum FID time in milliseconds */
  maxFID?: number;
  /** Maximum CLS score */
  maxCLS?: number;
}

export interface PerformanceAlert {
  /** Alert type */
  type: 'warning' | 'error' | 'info';
  /** Alert message */
  message: string;
  /** Metric that triggered the alert */
  metric: keyof PerformanceBudget;
  /** Current value */
  currentValue: number;
  /** Budget limit */
  budgetLimit: number;
  /** Suggested actions */
  suggestions?: string[];
}

// Optimization interfaces
export interface OptimizationConfig {
  /** Enable image lazy loading */
  lazyImages?: boolean;
  /** Enable code splitting */
  codeSplitting?: boolean;
  /** Enable virtualization for lists */
  virtualization?: boolean;
  /** Enable performance monitoring */
  performanceMonitoring?: boolean;
  /** Enable error tracking */
  errorTracking?: boolean;
  /** Enable caching */
  caching?: boolean;
}

export interface OptimizationReport {
  /** Configuration used */
  config: OptimizationConfig;
  /** Performance improvements */
  improvements: {
    /** Bundle size reduction in bytes */
    bundleSizeReduction?: number;
    /** Render time improvement in milliseconds */
    renderTimeImprovement?: number;
    /** Memory usage reduction in bytes */
    memoryReduction?: number;
  };
  /** Recommendations */
  recommendations: string[];
}

// Accessibility performance interfaces
export interface A11yMetrics {
  /** Number of accessibility violations */
  violations: number;
  /** Number of elements with missing alt text */
  missingAltText: number;
  /** Number of elements with poor contrast */
  contrastIssues: number;
  /** Number of elements without proper labels */
  labelingIssues: number;
  /** Focus management score (0-100) */
  focusScore: number;
  /** Keyboard navigation score (0-100) */
  keyboardScore: number;
}

// Export main performance interface
export interface ApplicationPerformance {
  /** Web vitals metrics */
  webVitals: WebVitalsMetrics;
  /** Component performance metrics */
  components: PerformanceMetrics[];
  /** Memory usage information */
  memory: MemoryInfo;
  /** Bundle information */
  bundle: BundleInfo;
  /** Network metrics */
  network: NetworkMetrics[];
  /** Accessibility metrics */
  accessibility: A11yMetrics;
  /** Performance budget status */
  budget: {
    alerts: PerformanceAlert[];
    overallScore: number;
  };
}