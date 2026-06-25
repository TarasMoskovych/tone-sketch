/**
 * Touch Gesture Utilities
 *
 * Pure utility functions for touch gesture calculations used in pinch-to-zoom
 * and other multi-touch interactions.
 *
 * @module touch-utils
 */

/**
 * Calculate the Euclidean distance between two touch points.
 *
 * @param touches - The TouchList from a touch event
 * @returns The distance in pixels between the first two touches, or 0 if fewer than 2 touches
 *
 * @example
 * ```ts
 * const distance = getTouchDistance(event.touches);
 * ```
 */
export function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate the center point between two touch points.
 *
 * @param touches - The TouchList from a touch event
 * @returns The center point coordinates. If fewer than 2 touches, returns the first touch's position or (0,0)
 *
 * @example
 * ```ts
 * const center = getTouchCenter(event.touches);
 * // center.x and center.y are the midpoint coordinates
 * ```
 */
export function getTouchCenter(touches: TouchList): { x: number; y: number } {
  if (touches.length < 2) {
    return { x: touches[0]?.clientX ?? 0, y: touches[0]?.clientY ?? 0 };
  }
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}
