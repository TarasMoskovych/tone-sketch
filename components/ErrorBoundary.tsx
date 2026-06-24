'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Props for the ErrorBoundary component
 */
interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Optional fallback component to render on error */
  fallback?: ReactNode;
  /** Optional callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional custom error message to display */
  errorMessage?: string;
  /** Optional title for the error display */
  errorTitle?: string;
  /** Whether to show the retry button (default: true) */
  showRetry?: boolean;
  /** Whether to show the home button (default: true) */
  showHomeButton?: boolean;
  /** Optional custom retry action */
  onRetry?: () => void;
}

/**
 * State for the ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error icon component
 */
function ErrorIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

/**
 * Refresh icon component
 */
function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

/**
 * Home icon component
 */
function HomeIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

/**
 * ErrorBoundary component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the
 * component tree that crashed.
 *
 * Requirements:
 * - 19.6: Display error message with retry option on failure
 * - Error handling from Design: Graceful degradation for rendering errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({ errorInfo });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Reset the error boundary state to allow retry
   */
  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call custom retry handler if provided
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  /**
   * Navigate to home page
   */
  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    const {
      hasError,
      error,
    } = this.state;

    const {
      children,
      fallback,
      errorMessage,
      errorTitle = 'Something went wrong',
      showRetry = true,
      showHomeButton = true,
    } = this.props;

    if (hasError) {
      // If a custom fallback is provided, render it
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div
          className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gray-900 text-gray-100"
          role="alert"
          aria-live="assertive"
        >
          <ErrorIcon className="w-16 h-16 text-red-500 mb-4" />

          <h2 className="text-2xl font-semibold text-gray-100 mb-2">
            {errorTitle}
          </h2>

          <p className="text-gray-400 max-w-md mb-6">
            {errorMessage || 'An unexpected error occurred. Please try again or return to the home page.'}
          </p>

          {/* Error details (development only) */}
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mb-6 p-4 bg-gray-800 rounded-lg text-left max-w-lg w-full overflow-auto">
              <p className="text-red-400 text-sm font-mono mb-2">
                {error.name}: {error.message}
              </p>
              {error.stack && (
                <pre className="text-gray-500 text-xs font-mono whitespace-pre-wrap break-words">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {showRetry && (
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                <RefreshIcon className="w-4 h-4" />
                Try Again
              </button>
            )}

            {showHomeButton && (
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                <HomeIcon className="w-4 h-4" />
                Go Home
              </button>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
