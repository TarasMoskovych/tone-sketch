'use client';

import type { IconProps } from './index';

/**
 * Loading icon component (spinner)
 *
 * Used for loading states in MelodyCard and other components.
 * Includes spin animation class by default.
 *
 * @param className - Optional CSS class names for Tailwind styling (animate-spin is added by default)
 * @param size - Optional size in pixels (applies to both width and height)
 * @param aria-hidden - Whether the icon should be hidden from assistive technologies (default: true)
 *
 * Requirements: 39.1, 39.4
 */
export function LoadingIcon({
  className = '',
  size,
  'aria-hidden': ariaHidden = true,
}: IconProps) {
  const sizeStyle = size ? { width: size, height: size } : undefined;

  return (
    <svg
      className={`animate-spin ${className}`}
      style={sizeStyle}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={ariaHidden}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default LoadingIcon;
