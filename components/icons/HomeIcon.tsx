'use client';

import type { IconProps } from './index';

/**
 * Home icon component
 *
 * Used in PageErrorFallback for home navigation.
 *
 * @param className - Optional CSS class names for Tailwind styling
 * @param size - Optional size in pixels (applies to both width and height)
 * @param aria-hidden - Whether the icon should be hidden from assistive technologies (default: true)
 *
 * Requirements: 39.1, 39.4
 */
export function HomeIcon({
  className = '',
  size,
  'aria-hidden': ariaHidden = true,
}: IconProps) {
  const sizeStyle = size ? { width: size, height: size } : undefined;

  return (
    <svg
      className={className}
      style={sizeStyle}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export default HomeIcon;
