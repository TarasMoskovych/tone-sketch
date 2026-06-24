'use client';

import type { IconProps } from './index';

/**
 * Download icon component
 *
 * Used for download actions, such as MIDI file export.
 *
 * @param className - Optional CSS class names for Tailwind styling
 * @param size - Optional size in pixels (applies to both width and height)
 * @param aria-hidden - Whether the icon should be hidden from assistive technologies (default: true)
 *
 * Requirements: 39.1, 39.4
 */
export function DownloadIcon({
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
      fill="currentColor"
      aria-hidden={ariaHidden}
    >
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </svg>
  );
}

export default DownloadIcon;
