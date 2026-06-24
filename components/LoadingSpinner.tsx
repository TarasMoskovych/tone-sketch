'use client';

/**
 * Props for the LoadingSpinner component
 */
export interface LoadingSpinnerProps {
  /** Size variant of the spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS class names */
  className?: string;
  /** Loading message to display */
  message?: string;
  /** Whether to display as full-page loader */
  fullPage?: boolean;
}

/**
 * Size configuration for the spinner
 */
const sizeConfig = {
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-3',
  lg: 'w-12 h-12 border-4',
  xl: 'w-16 h-16 border-4',
};

const textSizeConfig = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

/**
 * LoadingSpinner component
 *
 * Consistent loading indicator for async operations.
 *
 * Requirements:
 * - 19.2: Display loading indicator while fetching melody data
 * - 23.4: Display loading indicator while fetching preview
 */
export function LoadingSpinner({
  size = 'md',
  className = '',
  message,
  fullPage = false,
}: LoadingSpinnerProps) {
  const spinnerClasses = `
    ${sizeConfig[size]}
    border-indigo-500
    border-t-transparent
    rounded-full
    animate-spin
  `;

  const content = (
    <div
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
      role="status"
      aria-label={message || 'Loading'}
    >
      <div className={spinnerClasses} />
      {message && (
        <p className={`text-gray-300 ${textSizeConfig[size]}`}>
          {message}
        </p>
      )}
      <span className="sr-only">{message || 'Loading...'}</span>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">
        {content}
      </div>
    );
  }

  return content;
}

export default LoadingSpinner;
