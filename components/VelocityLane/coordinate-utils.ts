import type { Note } from '@/types/note';
import type { VisibleRegion } from '@/types/grid';
import type { VelocityRenderDimensions } from './types';
import { VELOCITY_LANE_CONFIG } from './constants';

/**
 * Clamp a velocity value to [0, 1].
 * Requirements: 4.2, 5.2
 */
export function clampVelocity(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Convert a pointer Y position within the lane to a velocity value [0, 1].
 * The lane bottom represents velocity 0, and the lane top represents velocity 1.
 * Requirements: 4.1, 4.2
 *
 * @param pointerY - The Y position in pixels relative to the grid top (gridY)
 * @param laneHeight - The height of the velocity lane grid area in pixels
 * @returns Velocity value clamped to [0, 1]
 */
export function pointerYToVelocity(pointerY: number, laneHeight: number): number {
  if (laneHeight <= 0) {
    return 0;
  }
  return clampVelocity((laneHeight - pointerY) / laneHeight);
}

/**
 * Convert a velocity value to a bar height in pixels.
 * Requirements: 2.4
 *
 * @param velocity - Velocity value in [0, 1]
 * @param laneHeight - The height of the velocity lane grid area in pixels
 * @returns Bar height in pixels
 */
export function velocityToBarHeight(velocity: number, laneHeight: number): number {
  if (laneHeight <= 0) {
    return 0;
  }
  return clampVelocity(velocity) * laneHeight;
}

/**
 * Convert a velocity value to a bar Y position (bottom-anchored, bars grow upward).
 * Requirements: 2.5
 *
 * @param velocity - Velocity value in [0, 1]
 * @param laneHeight - The height of the velocity lane grid area in pixels
 * @param gridY - The Y position where the grid area starts
 * @returns The top-left Y coordinate of the bar
 */
export function velocityToBarY(velocity: number, laneHeight: number, gridY: number): number {
  if (laneHeight <= 0) {
    return gridY;
  }
  const barHeight = velocityToBarHeight(velocity, laneHeight);
  return gridY + laneHeight - barHeight;
}

/**
 * Calculate pixelsPerBeat from the visible region and grid width.
 * Guards against division by zero when the visible beat range is zero.
 */
function pixelsPerBeat(visibleRegion: VisibleRegion, gridWidth: number): number {
  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
  if (visibleBeats <= 0 || gridWidth <= 0) {
    return 0;
  }
  return gridWidth / visibleBeats;
}

/**
 * Calculate bar X position from note start and visible region.
 * Uses the same horizontal formula as PianoRollCanvas: (beat - startBeat) × pixelsPerBeat
 * Requirements: 2.2, 3.1, 3.5
 *
 * @param noteStart - The note's start beat position
 * @param visibleRegion - Current visible region
 * @param gridWidth - Width of the grid area in pixels
 * @param gridX - X position where the grid area starts
 * @returns The X pixel position of the bar's left edge
 */
export function noteToBarX(
  noteStart: number,
  visibleRegion: VisibleRegion,
  gridWidth: number,
  gridX: number
): number {
  const ppb = pixelsPerBeat(visibleRegion, gridWidth);
  return gridX + (noteStart - visibleRegion.startBeat) * ppb;
}

/**
 * Calculate bar width from note duration and visible region.
 * Uses the same horizontal formula as PianoRollCanvas: duration × pixelsPerBeat
 * Requirements: 2.3
 *
 * @param noteDuration - The note's duration in beats
 * @param visibleRegion - Current visible region
 * @param gridWidth - Width of the grid area in pixels
 * @returns The width of the bar in pixels
 */
export function noteToBarWidth(
  noteDuration: number,
  visibleRegion: VisibleRegion,
  gridWidth: number
): number {
  const ppb = pixelsPerBeat(visibleRegion, gridWidth);
  return noteDuration * ppb;
}

/**
 * Find which note's velocity bar is at a given pixel position.
 * When multiple bars overlap, prefers selected notes (they render on top).
 * Among same-selection-state bars, prefers the one whose top edge is closest.
 * Requirements: 3.5
 *
 * @param notes - Array of notes to check
 * @param x - X pixel position relative to the canvas
 * @param y - Y pixel position relative to the canvas
 * @param visibleRegion - Current visible region
 * @param dimensions - Render dimensions of the velocity lane
 * @param selectedNoteIds - Set of selected note IDs (selected bars have priority)
 * @returns The note whose bar is at the position, or null if none
 */
export function findBarAtPosition(
  notes: Note[],
  x: number,
  y: number,
  visibleRegion: VisibleRegion,
  dimensions: VelocityRenderDimensions,
  selectedNoteIds?: Set<string>
): Note | null {
  const { gridX, gridY, gridWidth, gridHeight } = dimensions;

  let bestMatch: Note | null = null;
  let bestIsSelected = false;
  let bestDistance = Infinity;

  for (const note of notes) {
    const barX = noteToBarX(note.start, visibleRegion, gridWidth, gridX);
    let barWidth = noteToBarWidth(note.duration, visibleRegion, gridWidth);

    // Enforce minimum bar width for clickability
    barWidth = Math.max(barWidth, VELOCITY_LANE_CONFIG.MIN_BAR_WIDTH);

    const barHeight = velocityToBarHeight(note.velocity, gridHeight);
    const barY = velocityToBarY(note.velocity, gridHeight, gridY);

    if (x >= barX && x <= barX + barWidth && y >= barY && y <= barY + barHeight) {
      const isSelected = selectedNoteIds?.has(note.id) ?? false;
      const distanceToTop = Math.abs(y - barY);

      // Selected notes always win over unselected (they render on top)
      // Among same selection state, prefer closest top edge
      if (
        (isSelected && !bestIsSelected) ||
        (isSelected === bestIsSelected && distanceToTop < bestDistance)
      ) {
        bestDistance = distanceToTop;
        bestIsSelected = isSelected;
        bestMatch = note;
      }
    }
  }

  return bestMatch;
}

/**
 * Compute multi-note delta application with independent clamping.
 * For each entry, computes clamp(vᵢ + delta, 0, 1).
 * Requirements: 5.1, 5.2
 *
 * @param originalVelocities - Map of note IDs to their original velocity values at drag start
 * @param delta - The velocity delta to apply (currentDragVelocity - originalDraggedNoteVelocity)
 * @returns Map of note IDs to their new clamped velocity values
 */
export function applyVelocityDelta(
  originalVelocities: Map<string, number>,
  delta: number
): Map<string, number> {
  const result = new Map<string, number>();
  for (const [noteId, originalVelocity] of originalVelocities) {
    result.set(noteId, clampVelocity(originalVelocity + delta));
  }
  return result;
}
