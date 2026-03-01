import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, ExternalLink } from 'lucide-react';
// Sentry temporarily removed to resolve initialization errors

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableSentryReporting?: boolean;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
  userAgent: string;
  timestamp: string;
  currentPath: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      errorId: '',
      userAgent: '',
      timestamp: '',
      currentPath: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = Math.random().toString(36).substr(2, 9);
    const timestamp = new Date().toISOString();
    const currentPath = window.location.pathname + window.location.search;
    const userAgent = navigator.userAgent;

    return { 
      hasError: true, 
      error,
      errorId,
      timestamp,
      currentPath,
      userAgent
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Detect stale chunk errors (e.g. after a deploy) and auto-reload once
    const isChunkError = error.message &&
      (/dynamically imported module/i.test(error.message) ||
       /loading chunk/i.test(error.message) ||
       /failed to fetch/i.test(error.message));

    if (isChunkError) {
      const reloadedKey = 'pitchey_chunk_reload';
      if (!sessionStorage.getItem(reloadedKey)) {
        sessionStorage.setItem(reloadedKey, '1');
        window.location.reload();
        return;
      }
      // Already reloaded once — fall through to show error UI
    }

    this.setState({ error, errorInfo });

    // Enhanced error logging
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: this.state.timestamp,
      userAgent: this.state.userAgent,
      currentPath: this.state.currentPath,
      buildInfo: {
        mode: import.meta.env.MODE,
        prod: import.meta.env.PROD,
        dev: import.meta.env.DEV,
      },
      reactVersion: React.version,
    };

    // Detailed console logging
    console.group(`🚨 React Error Boundary - ${this.state.errorId}`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.table(errorReport);
    console.groupEnd();

    // Store error globally for debugging
    const winDebug = window as unknown as Record<string, unknown>;
    winDebug['__errorBoundaryError'] = error;
    winDebug['__errorBoundaryInfo'] = errorInfo;
    winDebug['__errorBoundaryReport'] = errorReport;
    
    // Send to error reporting service if enabled
    // Sentry reporting temporarily disabled to resolve initialization errors
    console.group('🚨 Error Boundary Report');
    console.error('Error caught by Error Boundary:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.table(errorReport);
    console.groupEnd();

    // Send client errors to backend for tracking (endpoint: POST /api/errors/client)
    fetch('/api/errors/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorReport),
      credentials: 'include'
    }).catch(() => { /* fire-and-forget */ });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  copyErrorDetails = () => {
    const { error, errorInfo, errorId, timestamp, currentPath } = this.state;
    const errorDetails = {
      errorId,
      timestamp,
      path: currentPath,
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      buildInfo: {
        mode: import.meta.env.MODE,
        prod: import.meta.env.PROD,
        dev: import.meta.env.DEV,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        alert('Error details copied to clipboard!');
      })
      .catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = JSON.stringify(errorDetails, null, 2);
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Error details copied to clipboard!');
      });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const showDetails = this.props.showErrorDetails ?? (!import.meta.env.PROD || import.meta.env.MODE === 'development');

      // Enhanced error UI
      return (
        <div 
          className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
          data-testid="error-boundary"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" aria-hidden="true" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2" data-testid="error-title">
                Something went wrong
              </h2>
              <p className="text-gray-600 text-sm mb-2" data-testid="error-message">
                We encountered an unexpected error. Please try refreshing the page or go back to the home page.
              </p>
              
              {/* Error ID for reference */}
              <div className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600 mt-2" data-testid="error-id">
                <span>Error ID: {this.state.errorId}</span>
                <span>•</span>
                <span>{new Date(this.state.timestamp).toLocaleString()}</span>
              </div>
            </div>

            {/* Show error details */}
            {showDetails && this.state.error && (
              <div className="mb-6 space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-red-800">Error Details</h3>
                    <button
                      onClick={this.copyErrorDetails}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                      data-testid="copy-error-button"
                      aria-label="Copy error details to clipboard"
                    >
                      <Copy className="w-3 h-3" />
                      Copy Details
                    </button>
                  </div>
                  
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="font-medium text-red-800 mb-1">Message:</p>
                      <p className="text-red-700 font-mono bg-red-100 p-2 rounded break-all">
                        {this.state.error.message}
                      </p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-red-800 mb-1">Location:</p>
                      <p className="text-red-700 bg-red-100 p-2 rounded">
                        {this.state.currentPath}
                      </p>
                    </div>

                    {this.state.errorInfo?.componentStack && (
                      <details className="mt-3">
                        <summary className="font-medium text-red-800 cursor-pointer hover:text-red-900">
                          Component Stack
                        </summary>
                        <pre className="mt-2 text-red-700 bg-red-100 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}

                    {this.state.error.stack && (
                      <details className="mt-3">
                        <summary className="font-medium text-red-800 cursor-pointer hover:text-red-900">
                          JavaScript Stack Trace
                        </summary>
                        <pre className="mt-2 text-red-700 bg-red-100 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                          {this.state.error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                data-testid="retry-button"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                data-testid="go-home-button"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
              {!showDetails && (
                <button
                  onClick={() => this.setState({ ...this.state })}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  Report Issue
                </button>
              )}
            </div>

            {/* Development tips */}
            {showDetails && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <p className="font-medium mb-1">💡 Development Tips:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-600">
                  <li>Check the browser console for additional error details</li>
                  <li>Ensure all lazy imports are correctly configured</li>
                  <li>Verify that all route components exist and export correctly</li>
                  <li>Check for circular dependencies in your module imports</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC wrapper for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  return (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
}

export default ErrorBoundary;