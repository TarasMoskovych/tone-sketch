'use client';

import type { IconProps } from './index';

/**
 * Extended props for ChevronIcon with direction support
 */
export interface ChevronIconProps extends IconProps {
  /** Direction the chevron points to (default: 'down') */
  direction?: 'up' | 'down' | 'left' | 'right';
}

/**
 * Chevron icon component
 *
 * Used for expandable sections, dropdowns, and navigation indicators.
 * Supports four directions: up, down, left, right.
 *
 * @param className - Optional CSS class names for Tailwind styling
 * @param size - Optional size in pixels (applies to both width and height)
 * @param aria-hidden - Whether the icon should be hidden from assistive technologies (default: true)
 * @param direction - Direction the chevron points to (default: 'down')
 *
 * Requirements: 39.1, 39.4
 */
export function ChevronIcon({
  className = '',
  size,
  'aria-hidden': ariaHidden = true,
  direction = 'down',
}: ChevronIconProps) {
  const sizeStyle = size ? { width: size, height: size } : undefined;

  // Rotation angles for each direction
  const rotationMap: Record<string, string> = {
    down: '0',
    up: '180',
    left: '90',
    right: '-90',
  };

  const rotation = rotationMap[direction] || '0';

  return (
    <svg
      className={className}
      style={{
        ...sizeStyle,
        transform: `rotate(${rotation}deg)`,
      }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default ChevronIcon;
