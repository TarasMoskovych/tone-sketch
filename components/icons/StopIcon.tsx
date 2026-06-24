'use client';

import type { IconProps } from './index';

/**
 * Stop icon component
 *
 * Used in TransportControls for stopping playback, MelodyCard for stop preview.
 *
 * @param className - Optional CSS class names for Tailwind styling
 * @param size - Optional size in pixels (applies to both width and height)
 * @param aria-hidden - Whether the icon should be hidden from assistive technologies (default: true)
 *
 * Requirements: 39.1, 39.4
 */
export function StopIcon({
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
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}

export default StopIcon;
