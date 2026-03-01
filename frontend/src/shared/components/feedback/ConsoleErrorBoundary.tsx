/**
 * Console Error Boundary Component
 * Catches and logs errors properly, sends to Sentry for monitoring
 * Displays user-friendly error messages
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
// Temporary: Disable Sentry integration for console monitoring
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface SentryScope {
  setLevel: (level: string) => void;
  setContext: (key: string, ctx: Record<string, unknown>) => void;
  addBreadcrumb: (breadcrumb: Record<string, unknown>) => void;
}

interface SentryGlobalType {
  withScope: (fn: (scope: SentryScope) => void) => void;
  captureException: (error: Error) => void;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  level?: 'page' | 'component' | 'global';
  showDetails?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
  showDetails: boolean;
  consoleErrors: ConsoleError[];
  reportSent: boolean;
}

interface ConsoleError {
  type: 'error' | 'warn' | 'log';
  message: string;
  timestamp: string;
  stack?: string;
  component?: string;
  route?: string;
}

export class ConsoleErrorBoundary extends Component<Props, State> {
  private readonly originalConsole = {
    error: console.error,
    warn: console.warn,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      showDetails: props.showDetails ?? false,
      consoleErrors: [],
      reportSent: false
    };
  }

  componentDidMount() {
    // Intercept console methods to track errors
    this.interceptConsole();

    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    // Restore original console methods
    this.restoreConsole();

    // Remove event listeners
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private readonly interceptConsole = () => {
    // Intercept console.error
    console.error = (...args: unknown[]) => {
      this.logConsoleError('error', args);
      this.originalConsole.error.apply(console, args as Parameters<typeof console.error>);
    };

    // Intercept console.warn
    console.warn = (...args: unknown[]) => {
      this.logConsoleError('warn', args);
      this.originalConsole.warn.apply(console, args as Parameters<typeof console.warn>);
    };

    if (import.meta.env.MODE === 'production') {
      // intentionally empty
    }
  };

  private readonly restoreConsole = () => {
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
  };

  private readonly logConsoleError = (type: 'error' | 'warn' | 'log', args: unknown[]) => {
    const message = args.map(arg => {
      try {
        return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
      } catch {
        return String(arg);
      }
    }).join(' ');

    const error: ConsoleError = {
      type,
      message,
      timestamp: new Date().toISOString(),
      stack: new Error().stack,
      component: this.getComponentName(),
      route: window.location.pathname
    };

    this.setState(prevState => ({
      consoleErrors: [...prevState.consoleErrors.slice(-19), error] // Keep last 20 errors
    }));

    // Send critical errors to monitoring
    if (type === 'error' && message.includes('Cannot read property')) {
      void this.sendToMonitoring(error);
    }
  };

  private readonly getComponentName = (): string => {
    // Try to extract component name from stack trace
    const stack = new Error().stack ?? '';
    const match = stack.match(/at (\w+Component|\w+Page|\w+View|\w+Modal)/);
    return match?.[1] ?? 'Unknown';
  };

  private readonly handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = new Error(`Unhandled Promise Rejection: ${String(event.reason)}`);
    void this.logError(error, { context: 'unhandledRejection' });
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;

    // Log to console with proper formatting
    this.originalConsole.error(
      `[${level.toUpperCase()} ERROR BOUNDARY]`,
      error.message,
      '\nComponent Stack:',
      errorInfo.componentStack
    );

    // Send to Sentry if available
    const SentryGlobal = (window as unknown as Record<string, unknown>).Sentry as SentryGlobalType | undefined;
    if (SentryGlobal !== undefined) {
      SentryGlobal.withScope((scope: SentryScope) => {
        scope.setLevel('error');
        scope.setContext('errorBoundary', {
          level,
          componentStack: errorInfo.componentStack,
          route: window.location.pathname,
          timestamp: new Date().toISOString()
        });

        // Add console errors as breadcrumbs
        this.state.consoleErrors.forEach(consoleError => {
          scope.addBreadcrumb({
            category: 'console',
            level: consoleError.type === 'error' ? 'error' : 'warning',
            message: consoleError.message,
            timestamp: consoleError.timestamp
          });
        });

        SentryGlobal.captureException(error);
      });
    }

    // Update state
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
      reportSent: true
    }));

    // Call custom error handler if provided
    onError?.(error, errorInfo);

    // Log to backend for analysis
    void this.logError(error, errorInfo);
  }

  private readonly logError = async (error: Error, context: Record<string, unknown> | ErrorInfo) => {
    try {
      await fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          context,
          consoleErrors: this.state.consoleErrors,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          level: this.props.level ?? 'component'
        })
      });
    } catch (err) {
      // Silently fail - don't cause more errors
      this.originalConsole.error('Failed to log error to backend:', err);
    }
  };

  private readonly sendToMonitoring = async (error: ConsoleError) => {
    // Send critical console errors to monitoring service
    try {
      await fetch('/api/monitoring/console-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(error)
      });
    } catch {
      // Silently fail
    }
  };

  private readonly handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      consoleErrors: [],
      reportSent: false
    });
  };

  private readonly handleReload = () => {
    window.location.reload();
  };

  private readonly handleHome = () => {
    window.location.href = '/';
  };

  private readonly toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  render() {
    const { hasError, error, errorInfo, showDetails, errorCount, reportSent, consoleErrors } = this.state;
    const { children, fallback, level = 'component' } = this.props;

    if (hasError && error !== null) {
      // Use custom fallback if provided
      if (fallback !== undefined) {
        return <>{fallback}</>;
      }

      // Default error UI
      return (
        <div className={`error-boundary ${level}`}>
          <div className="min-h-[400px] flex items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="text-red-500 mt-1" size={24} />
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-red-900 mb-2">
                      {level === 'global' ? 'Application Error' :
                       level === 'page' ? 'Page Error' :
                       'Component Error'}
                    </h2>

                    <p className="text-red-700 mb-4">
                      {error.message !== '' ? error.message : 'An unexpected error occurred'}
                    </p>

                    {reportSent && (
                      <p className="text-sm text-red-600 mb-4">
                        Error report has been sent to our team
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={this.handleReset}
                        className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <RefreshCw size={16} />
                        Try Again
                      </button>

                      <button
                        onClick={this.handleReload}
                        className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
                      >
                        Reload Page
                      </button>

                      {level !== 'global' && (
                        <button
                          onClick={this.handleHome}
                          className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                          <Home size={16} />
                          Go Home
                        </button>
                      )}
                    </div>

                    {/* Error details toggle */}
                    <button
                      onClick={this.toggleDetails}
                      className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {showDetails ? 'Hide' : 'Show'} Technical Details
                    </button>

                    {/* Technical details */}
                    {showDetails && (
                      <div className="mt-4 p-4 bg-red-100 rounded text-xs">
                        <div className="mb-2">
                          <strong>Error Count:</strong> {errorCount}
                        </div>

                        <div className="mb-2">
                          <strong>Error Message:</strong>
                          <pre className="mt-1 whitespace-pre-wrap break-all">
                            {error.message}
                          </pre>
                        </div>

                        {error.stack !== undefined && (
                          <div className="mb-2">
                            <strong>Stack Trace:</strong>
                            <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] max-h-40 overflow-auto">
                              {error.stack}
                            </pre>
                          </div>
                        )}

                        {errorInfo?.componentStack != null && (
                          <div className="mb-2">
                            <strong>Component Stack:</strong>
                            <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] max-h-40 overflow-auto">
                              {errorInfo.componentStack}
                            </pre>
                          </div>
                        )}

                        {consoleErrors.length > 0 && (
                          <div>
                            <strong>Recent Console Errors:</strong>
                            <div className="mt-1 max-h-40 overflow-auto">
                              {consoleErrors.map((ce, idx) => (
                                <div key={idx} className="mb-1 p-1 bg-red-50 rounded">
                                  <span className={`font-semibold ${
                                    ce.type === 'error' ? 'text-red-600' : 'text-yellow-600'
                                  }`}>
                                    [{ce.type.toUpperCase()}]
                                  </span>
                                  <span className="ml-2 text-[10px]">
                                    {ce.message.substring(0, 100)}...
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {import.meta.env.MODE === 'development' && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Development Mode:</strong> Check browser console for detailed error information
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ConsoleErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ConsoleErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName ?? Component.name})`;

  return WrappedComponent;
}

// Specialized error boundaries for different contexts
export const PageErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ConsoleErrorBoundary level="page" showDetails={false}>
    {children}
  </ConsoleErrorBoundary>
);

export const GlobalErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ConsoleErrorBoundary level="global" showDetails={true}>
    {children}
  </ConsoleErrorBoundary>
);

export default ConsoleErrorBoundary;