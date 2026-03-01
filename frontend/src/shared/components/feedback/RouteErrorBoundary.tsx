/**
 * Route Error Boundary Component
 * Catches and handles errors in portal navigation
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      errorInfo: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route error boundary caught:', error, errorInfo);
    
    // Log to error reporting service
    const windowWithSentry = window as unknown as Record<string, unknown>;
    if (windowWithSentry['Sentry']) {
      (windowWithSentry['Sentry'] as { captureException: (e: Error, ctx: unknown) => void }).captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }

    this.setState({
      error,
      errorInfo
    });
  }

  private readonly handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private readonly handleReload = () => {
    window.location.reload();
  };

  private readonly handleHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isSchemaError = this.state.error?.message?.includes('column') || 
                           this.state.error?.message?.includes('table') ||
                           this.state.error?.message?.includes('schema');

      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            
            <h2 className="mt-4 text-xl font-semibold text-white text-center">
              {isSchemaError ? 'Database Connection Issue' : 'Something went wrong'}
            </h2>
            
            <p className="mt-2 text-sm text-gray-400 text-center">
              {isSchemaError 
                ? 'We\'re experiencing a temporary issue with our database. Our team has been notified.'
                : 'An unexpected error occurred while loading this page.'}
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 p-3 bg-gray-700 rounded text-xs text-gray-300 overflow-auto max-h-32">
                <code>{this.state.error.toString()}</code>
              </div>
            )}

            <div className="mt-6 flex flex-col space-y-2">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
              >
                Reload Page
              </button>
              
              <button
                onClick={this.handleHome}
                className="flex items-center justify-center px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}