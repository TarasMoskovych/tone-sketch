import type { VisibleRegion, ScrollbarState } from '@/types/grid';
import { CANVAS_CONFIG } from './constants';

/**
 * Configuration subset required for coordinate conversion functions.
 * Allows functions to accept explicit config values for testability.
 */
export interface CoordinateConfig {
  /** Width of the pitch label area on the left */
  PITCH_LABEL_WIDTH: number;
  /** Width of the vertical scrollbar on the right */
  SCROLLBAR_WIDTH: number;
  /** Height of the time marker area on top */
  TIME_MARKER_HEIGHT: number;
  /** Height of the horizontal scrollbar at the bottom */
  SCROLLBAR_HEIGHT: number;
}

/**
 * Default coordinate config using CANVAS_CONFIG values.
 * Provides sensible defaults while allowing overrides for testing.
 */
export const DEFAULT_COORDINATE_CONFIG: CoordinateConfig = {
  PITCH_LABEL_WIDTH: CANVAS_CONFIG.PITCH_LABEL_WIDTH,
  SCROLLBAR_WIDTH: CANVAS_CONFIG.SCROLLBAR_WIDTH,
  TIME_MARKER_HEIGHT: CANVAS_CONFIG.TIME_MARKER_HEIGHT,
  SCROLLBAR_HEIGHT: CANVAS_CONFIG.SCROLLBAR_HEIGHT,
};

/**
 * Checks if a MIDI note is a C (octave boundary).
 *
 * Requirement 4.5: Extract isOctaveBoundary helper function
 *
 * @param midiNote - MIDI note number (0-127)
 * @returns true if the note is C (octave boundary)
 *
 * @example
 * isOctaveBoundary(0)   // true  - C-1
 * isOctaveBoundary(12)  // true  - C0
 * isOctaveBoundary(60)  // true  - C4 (middle C)
 * isOctaveBoundary(61)  // false - C#4
 */
export function isOctaveBoundary(midiNote: number): boolean {
  return midiNote % 12 === 0;
}

/**
 * Calculates the scrollbar state from the visible region.
 *
 * Requirement 4.4: Extract calculateScrollbarState function
 *
 * Property 23: Scrollbar-Visible Region Synchronization
 * - Scrollbar position = (visibleRegion.start - minRange) / (maxRange - minRange)
 * - Thumb size = (visibleRegion.end - visibleRegion.start) / (maxRange - minRange)
 *
 * @param visibleRegion - Current visible region
 * @param totalBeats - Total horizontal range (timeline length)
 * @param totalPitchRange - Total vertical range (128 for MIDI 0-127)
 * @returns ScrollbarState with normalized positions and thumb sizes
 */
export function calculateScrollbarState(
  visibleRegion: VisibleRegion,
  totalBeats: number,
  totalPitchRange: number
): ScrollbarState {
  // Calculate horizontal scrollbar state
  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
  const horizontalThumbSize = Math.min(1, visibleBeats / totalBeats);
  // Position is normalized: 0 = start, 1 = end (accounting for thumb size)
  const horizontalRange = totalBeats - visibleBeats;
  const horizontalPosition = horizontalRange > 0
    ? visibleRegion.startBeat / horizontalRange
    : 0;

  // Calculate vertical scrollbar state
  const visiblePitches = visibleRegion.endPitch - visibleRegion.startPitch;
  const verticalThumbSize = Math.min(1, visiblePitches / totalPitchRange);
  // For vertical: higher pitch = higher position (inverted from screen coordinates)
  const verticalRange = totalPitchRange - visiblePitches;
  // Invert: when startPitch is 0 (bottom), position should be 1 (scrollbar at bottom)
  const verticalPosition = verticalRange > 0
    ? 1 - (visibleRegion.startPitch / verticalRange)
    : 0;

  return {
    horizontalPosition: Math.max(0, Math.min(1, horizontalPosition)),
    verticalPosition: Math.max(0, Math.min(1, verticalPosition)),
    horizontalThumbSize,
    verticalThumbSize,
  };
}

/**
 * Converts a pixel X position to a beat value.
 *
 * Requirement 4.1: Extract pixelXToBeat function
 *
 * This is a pure function that accepts explicit parameters for testability.
 * Unlike the original useCallback-based version, it doesn't depend on refs.
 *
 * @param pixelX - The X position in pixels relative to container left edge
 * @param containerWidth - Total width of the container in pixels
 * @param visibleRegion - Current visible region defining beat range
 * @param config - Configuration for layout dimensions (defaults to CANVAS_CONFIG values)
 * @returns The beat position corresponding to the pixel X coordinate
 *
 * @example
 * // With a 500px container, labels taking 50px, scrollbar 14px:
 * // Grid width = 500 - 50 - 14 = 436px
 * // For visible region 0-16 beats:
 * pixelXToBeat(50, 500, { startBeat: 0, endBeat: 16, ... }) // 0 (left edge of grid)
 * pixelXToBeat(268, 500, { startBeat: 0, endBeat: 16, ... }) // 8 (middle)
 */
export function pixelXToBeat(
  pixelX: number,
  containerWidth: number,
  visibleRegion: VisibleRegion,
  config: Pick<CoordinateConfig, 'PITCH_LABEL_WIDTH' | 'SCROLLBAR_WIDTH'> = DEFAULT_COORDINATE_CONFIG
): number {
  const gridWidth = containerWidth - config.PITCH_LABEL_WIDTH - config.SCROLLBAR_WIDTH;
  const gridX = pixelX - config.PITCH_LABEL_WIDTH;
  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;

  return visibleRegion.startBeat + (gridX / gridWidth) * visibleBeats;
}

/**
 * Converts a pixel Y position to a pitch value (MIDI note number).
 *
 * Requirement 4.2: Extract pixelYToPitch function
 *
 * This is a pure function that accepts explicit parameters for testability.
 * Note: Y increases downward on screen, but pitch increases upward musically.
 *
 * @param pixelY - The Y position in pixels relative to container top edge
 * @param containerHeight - Total height of the container in pixels
 * @param visibleRegion - Current visible region defining pitch range
 * @param config - Configuration for layout dimensions (defaults to CANVAS_CONFIG values)
 * @returns The pitch value (MIDI note number, floored to integer)
 *
 * @example
 * // With a 400px container, time markers taking 24px, scrollbar 14px:
 * // Grid height = 400 - 24 - 14 = 362px
 * // For visible region with pitch 48-72 (24 semitones):
 * pixelYToPitch(24, 400, { startPitch: 48, endPitch: 72, ... }) // 71 (top = highest pitch)
 */
export function pixelYToPitch(
  pixelY: number,
  containerHeight: number,
  visibleRegion: VisibleRegion,
  config: Pick<CoordinateConfig, 'TIME_MARKER_HEIGHT' | 'SCROLLBAR_HEIGHT'> = DEFAULT_COORDINATE_CONFIG
): number {
  const gridHeight = containerHeight - config.TIME_MARKER_HEIGHT - config.SCROLLBAR_HEIGHT;
  const gridY = pixelY - config.TIME_MARKER_HEIGHT;
  const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;

  // Y increases downward, pitch increases upward
  const relativePitchFromTop = (gridY / gridHeight) * visibleSemitones;
  return Math.floor(visibleRegion.endPitch - relativePitchFromTop);
}

/**
 * Converts a beat position to pixel X position.
 *
 * Requirement 4.3: Extract beatToPixelX function
 *
 * This is a pure function that accepts explicit parameters for testability.
 * This is the inverse of pixelXToBeat.
 *
 * @param beat - The beat position to convert
 * @param containerWidth - Total width of the container in pixels
 * @param visibleRegion - Current visible region defining beat range
 * @param config - Configuration for layout dimensions (defaults to CANVAS_CONFIG values)
 * @returns The X position in pixels relative to container left edge
 *
 * @example
 * // With a 500px container, labels taking 50px, scrollbar 14px:
 * // Grid width = 500 - 50 - 14 = 436px
 * // For visible region 0-16 beats:
 * beatToPixelX(0, 500, { startBeat: 0, endBeat: 16, ... })  // 50 (left edge of grid)
 * beatToPixelX(8, 500, { startBeat: 0, endBeat: 16, ... })  // 268 (middle)
 */
export function beatToPixelX(
  beat: number,
  containerWidth: number,
  visibleRegion: VisibleRegion,
  config: Pick<CoordinateConfig, 'PITCH_LABEL_WIDTH' | 'SCROLLBAR_WIDTH'> = DEFAULT_COORDINATE_CONFIG
): number {
  const gridWidth = containerWidth - config.PITCH_LABEL_WIDTH - config.SCROLLBAR_WIDTH;
  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;

  return config.PITCH_LABEL_WIDTH + ((beat - visibleRegion.startBeat) / visibleBeats) * gridWidth;
}

/**
 * Converts a pitch value (MIDI note number) to pixel Y position.
 *
 * Added for completeness as the inverse of pixelYToPitch.
 *
 * Note: Y increases downward on screen, but pitch increases upward musically.
 * Higher pitches appear higher on screen (lower Y values).
 *
 * @param pitch - The pitch value (MIDI note number)
 * @param containerHeight - Total height of the container in pixels
 * @param visibleRegion - Current visible region defining pitch range
 * @param config - Configuration for layout dimensions (defaults to CANVAS_CONFIG values)
 * @returns The Y position in pixels relative to container top edge
 *
 * @example
 * // With a 400px container, time markers taking 24px, scrollbar 14px:
 * // Grid height = 400 - 24 - 14 = 362px
 * // For visible region with pitch 48-72 (24 semitones):
 * pitchToPixelY(72, 400, { startPitch: 48, endPitch: 72, ... }) // ~24 (top)
 * pitchToPixelY(48, 400, { startPitch: 48, endPitch: 72, ... }) // ~386 (bottom)
 */
export function pitchToPixelY(
  pitch: number,
  containerHeight: number,
  visibleRegion: VisibleRegion,
  config: Pick<CoordinateConfig, 'TIME_MARKER_HEIGHT' | 'SCROLLBAR_HEIGHT'> = DEFAULT_COORDINATE_CONFIG
): number {
  const gridHeight = containerHeight - config.TIME_MARKER_HEIGHT - config.SCROLLBAR_HEIGHT;
  const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;

  // Higher pitch = lower Y value (towards top of screen)
  const relativePitchFromTop = visibleRegion.endPitch - pitch;
  return config.TIME_MARKER_HEIGHT + (relativePitchFromTop / visibleSemitones) * gridHeight;
}

/**
 * Constrains a visible region to valid bounds.
 *
 * Requirement 4.6: Extract constrainVisibleRegion function
 *
 * Ensures:
 * - Beats start at 0 or higher (no negative time)
 * - Pitches are between 0 and 127 (valid MIDI range, endPitch can be 128 for display)
 * - Maintains the current zoom level (span) as much as possible
 *
 * Requirements: 1.6 - Navigate visible region across full pitch range (0-127) and time range
 *
 * @param region - The visible region to constrain
 * @returns A new VisibleRegion with values clamped to valid bounds
 *
 * @example
 * // Region starting at negative beat gets shifted to 0
 * constrainVisibleRegion({ startBeat: -4, endBeat: 12, startPitch: 48, endPitch: 72 })
 * // Returns: { startBeat: 0, endBeat: 16, startPitch: 48, endPitch: 72 }
 *
 * // Region exceeding pitch range gets clamped
 * constrainVisibleRegion({ startBeat: 0, endBeat: 16, startPitch: 120, endPitch: 144 })
 * // Returns: { startBeat: 0, endBeat: 16, startPitch: 104, endPitch: 128 }
 */
export function constrainVisibleRegion(region: VisibleRegion): VisibleRegion {
  const beatSpan = region.endBeat - region.startBeat;
  const pitchSpan = region.endPitch - region.startPitch;

  let startBeat = region.startBeat;
  let endBeat = region.endBeat;
  let startPitch = region.startPitch;
  let endPitch = region.endPitch;

  // Constrain horizontal bounds (beats >= 0)
  if (startBeat < 0) {
    startBeat = 0;
    endBeat = beatSpan;
  }

  // Constrain vertical bounds (pitches 0-127, endPitch can be 128 for display purposes)
  if (startPitch < 0) {
    startPitch = 0;
    endPitch = Math.min(pitchSpan, 128);
  }
  if (endPitch > 128) {
    endPitch = 128;
    startPitch = Math.max(0, 128 - pitchSpan);
  }

  return { startBeat, endBeat, startPitch, endPitch };
}
