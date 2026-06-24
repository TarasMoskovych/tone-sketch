'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorIcon, RefreshIcon, HomeIcon } from './icons';

/**
 * Props for the PageErrorFallback component
 * Requirements: 39.2, 39.3, 39.5
 */
export interface PageErrorFallbackProps {
  /** The error that occurred */
  error?: Error | null;
  /** Custom error message to display */
  message?: string;
  /** Custom title for the error display */
  title?: string;
  /** Whether to show the retry button (default: true) */
  showRetry?: boolean;
  /** Whether to show the home button (default: true) */
  showHomeButton?: boolean;
  /** Custom retry callback */
  onRetry?: () => void;
}

/**
 * PageErrorFallback component
 *
 * Full-page error fallback for page-level errors.
 * Displays a user-friendly error message with retry and home navigation options.
 *
 * Requirements:
 * - 19.6: Display error message with retry option on failure
 * - Error handling from Design: Graceful error display
 */
export function PageErrorFallback({
  error,
  message,
  title = 'Something went wrong',
  showRetry = true,
  showHomeButton = true,
  onRetry,
}: PageErrorFallbackProps) {
  const router = useRouter();

  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    } else {
      // Default behavior: reload the page
      window.location.reload();
    }
  }, [onRetry]);

  const handleGoHome = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-gray-900 text-gray-100"
      role="alert"
      aria-live="assertive"
    >
      <ErrorIcon className="w-20 h-20 text-red-500 mb-6" />

      <h1 className="text-3xl font-bold text-gray-100 mb-3">
        {title}
      </h1>

      <p className="text-lg text-gray-400 max-w-md mb-8">
        {message || 'An unexpected error occurred. Please try again or return to the home page.'}
      </p>

      {/* Error details (development only) */}
      {process.env.NODE_ENV === 'development' && error && (
        <div className="mb-8 p-4 bg-gray-800 rounded-lg text-left max-w-2xl w-full overflow-auto">
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

      <div className="flex gap-4">
        {showRetry && (
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            <RefreshIcon className="w-5 h-5" />
            Try Again
          </button>
        )}

        {showHomeButton && (
          <button
            type="button"
            onClick={handleGoHome}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            <HomeIcon className="w-5 h-5" />
            Go Home
          </button>
        )}
      </div>
    </div>
  );
}

export default PageErrorFallback;
