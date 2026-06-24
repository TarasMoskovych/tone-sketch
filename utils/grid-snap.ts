import type { GridDivision, GridSnapConfig } from '../types/grid';

/**
 * Valid grid division values for snapping
 * 1 = whole beat, 0.5 = half beat (1/2), 0.25 = quarter beat (1/4),
 * 0.125 = eighth beat (1/8), 0.0625 = sixteenth beat (1/16)
 */
export const GRID_DIVISIONS: GridDivision[] = [1, 0.5, 0.25, 0.125, 0.0625];

/**
 * Free positioning resolution when grid snap is disabled (1/32 beat)
 * Property 8: Free Positioning Resolution
 */
export const FREE_POSITION_RESOLUTION = 0.03125;

/**
 * Minimum duration when grid snap is disabled
 * Property 5: Minimum Duration Enforcement
 */
export const MIN_DURATION_SNAP_DISABLED = 0.1;

/**
 * Snaps a position to the nearest grid division.
 * Property 3: Grid Snap Quantization
 *
 * Formula: round(P / D) * D
 *
 * @param position - The position in beats to snap
 * @param division - The grid division to snap to (must be one of GRID_DIVISIONS)
 * @returns The snapped position in beats
 *
 * Validates: Requirements 2.3, 3.2, 5.2, 7.4
 */
export function snapToGrid(position: number, division: GridDivision): number {
  // Handle edge cases
  if (!Number.isFinite(position)) {
    return 0;
  }

  // Apply the quantization formula: round(P / D) * D
  const result = Math.round(position / division) * division;

  // Normalize -0 to 0 for consistency
  return result === 0 ? 0 : result;
}

/**
 * Snaps a position to free positioning resolution (1/32 beat) when grid snap is disabled.
 * Property 8: Free Positioning Resolution
 *
 * @param position - The position in beats to snap
 * @returns The position quantized to 1/32 beat resolution
 *
 * Validates: Requirements 7.5
 */
export function snapToFreePosition(position: number): number {
  // Handle edge cases
  if (!Number.isFinite(position)) {
    return 0;
  }

  // Quantize to 1/32 beat resolution
  const result = Math.round(position / FREE_POSITION_RESOLUTION) * FREE_POSITION_RESOLUTION;

  // Normalize -0 to 0 for consistency
  return result === 0 ? 0 : result;
}

/**
 * Snaps a position based on the current grid snap configuration.
 * Uses snapToGrid when enabled, snapToFreePosition when disabled.
 *
 * @param position - The position in beats to snap
 * @param config - The grid snap configuration
 * @returns The snapped position in beats
 *
 * Validates: Requirements 7.4, 7.5
 */
export function snapPosition(position: number, config: GridSnapConfig): number {
  if (config.enabled) {
    return snapToGrid(position, config.division);
  }
  return snapToFreePosition(position);
}

/**
 * Gets the minimum allowed duration based on grid snap state.
 * Property 5: Minimum Duration Enforcement
 *
 * @param config - The grid snap configuration
 * @returns The minimum duration in beats
 *
 * Validates: Requirements 5.3, 5.4
 */
export function getMinimumDuration(config: GridSnapConfig): number {
  if (config.enabled) {
    // When grid snap is enabled, minimum duration is the current grid division
    return config.division;
  }
  // When grid snap is disabled, minimum duration is 0.1 beats
  return MIN_DURATION_SNAP_DISABLED;
}

/**
 * Enforces minimum duration on a given duration value.
 *
 * @param duration - The duration to enforce minimum on
 * @param config - The grid snap configuration
 * @returns The duration, constrained to at least the minimum
 *
 * Validates: Requirements 5.3, 5.4
 */
export function enforceMinimumDuration(duration: number, config: GridSnapConfig): number {
  const minDuration = getMinimumDuration(config);
  return Math.max(duration, minDuration);
}

/**
 * Calculates the snapped end time and ensures minimum duration.
 * Useful for resize operations where the end time needs to be snapped
 * and the resulting duration needs to meet minimum requirements.
 *
 * @param startTime - The note's start time in beats
 * @param endTime - The desired end time in beats (will be snapped)
 * @param config - The grid snap configuration
 * @returns The snapped end time that ensures minimum duration
 *
 * Validates: Requirements 5.2, 5.3, 5.4
 */
export function calculateSnappedEndTime(
  startTime: number,
  endTime: number,
  config: GridSnapConfig
): number {
  // Snap the end time
  const snappedEndTime = snapPosition(endTime, config);

  // Calculate the resulting duration
  const duration = snappedEndTime - startTime;

  // Get minimum duration for current config
  const minDuration = getMinimumDuration(config);

  // If duration is less than minimum, return start + minimum
  if (duration < minDuration) {
    return startTime + minDuration;
  }

  return snappedEndTime;
}

/**
 * Validates that a value is a valid grid division.
 *
 * @param value - The value to check
 * @returns True if the value is a valid grid division
 */
export function isValidGridDivision(value: number): value is GridDivision {
  return GRID_DIVISIONS.includes(value as GridDivision);
}
