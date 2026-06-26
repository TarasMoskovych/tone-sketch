/**
 * Canvas rendering functions for the VelocityLane component.
 *
 * Requirements: 2.1, 2.4, 2.5, 2.6, 6.1, 9.1, 9.4, 9.5, 9.6
 * - All rendering functions extracted from VelocityLaneCanvas
 * - Functions accept explicit parameters instead of closures for testability
 * - Uses devicePixelRatio scaling matching PianoRoll pattern
 *
 * @module VelocityLane/renderers
 */

import type { VisibleRegion } from '@/types/grid';
import type { Note } from '@/types/note';
import type { VelocityRenderDimensions, VelocityDragState } from './types';
import { VELOCITY_LANE_CONFIG } from './constants';

/**
 * Sets up the canvas with proper device pixel ratio handling.
 * This ensures crisp rendering on high-DPI displays.
 *
 * Requirement 9.1: Canvas buffer size = CSS size × devicePixelRatio,
 * context scaled by dpr, matching PianoRoll setupCanvas approach.
 *
 * @param canvas - The canvas element to set up
 * @param container - The container element that determines the display size
 * @returns Object with context and dimensions, or null if canvas or container is null
 */
export function setupCanvas(
  canvas: HTMLCanvasElement | null,
  container: HTMLDivElement | null
): { ctx: CanvasRenderingContext2D; displayWidth: number; displayHeight: number; dpr: number } | null {
  if (!canvas || !container) return null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Get device pixel ratio for high-DPI display support
  const dpr = window.devicePixelRatio || 1;

  // Get the display size from the container
  const rect = container.getBoundingClientRect();
  const displayWidth = rect.width;
  const displayHeight = rect.height;

  // Set the canvas buffer size accounting for device pixel ratio
  canvas.width = Math.floor(displayWidth * dpr);
  canvas.height = Math.floor(displayHeight * dpr);

  // Set the CSS display size
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  // Scale the context to account for device pixel ratio
  ctx.scale(dpr, dpr);

  return { ctx, displayWidth, displayHeight, dpr };
}

/**
 * Renders velocity bars for visible notes.
 *
 * Requirements:
 * - 2.1: Render one bar for each note whose horizontal extent overlaps the visible region
 * - 2.4: Bar height = note.velocity × laneHeight (linear proportional mapping)
 * - 2.5: Bars anchored to bottom of lane (grow upward from baseline)
 * - 2.6: When no notes, render only baseline and scale indicator
 * - 6.1: Selected bars use BAR_SELECTED_COLOR, unselected use BAR_COLOR
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param notes - Array of notes to render velocity bars for
 * @param selectedNoteIds - Set of selected note IDs
 * @param visibleRegion - Current visible region defining beat range
 * @param dragState - Current drag state (null if not dragging)
 */
export function renderVelocityBars(
  ctx: CanvasRenderingContext2D,
  dimensions: VelocityRenderDimensions,
  notes: Note[],
  selectedNoteIds: Set<string>,
  visibleRegion: VisibleRegion,
  dragState: VelocityDragState | null
): void {
  const { gridX, gridY, gridWidth, gridHeight } = dimensions;

  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;

  // Guard against division by zero
  if (visibleBeats <= 0 || gridWidth <= 0 || gridHeight <= 0) return;

  const pixelsPerBeat = gridWidth / visibleBeats;

  // Two-pass rendering: unselected bars first, selected bars on top
  // This ensures selected bars are always visually on top and clickable
  for (let pass = 0; pass < 2; pass++) {
    const renderSelected = pass === 1;

    for (const note of notes) {
      const isSelected = selectedNoteIds.has(note.id);
      if (isSelected !== renderSelected) continue;

      const noteEnd = note.start + note.duration;

      // Only render bars for notes overlapping the visible region (Requirement 2.1)
      if (noteEnd <= visibleRegion.startBeat || note.start >= visibleRegion.endBeat) {
        continue;
      }

      // Determine the effective velocity (may be modified during drag)
      let velocity = note.velocity;
      if (dragState && dragState.originalVelocities.has(note.id)) {
        // During drag, the note's velocity prop is being updated in real-time
        // so we just use the current velocity value
        velocity = note.velocity;
      }

      // Calculate bar x position: same formula as PianoRoll (Requirement 9.6)
      const barX = gridX + (note.start - visibleRegion.startBeat) * pixelsPerBeat;

      // Calculate bar width: same formula as PianoRoll
      let barWidth = note.duration * pixelsPerBeat;

      // Enforce minimum bar width for clickability
      if (barWidth < VELOCITY_LANE_CONFIG.MIN_BAR_WIDTH) {
        barWidth = VELOCITY_LANE_CONFIG.MIN_BAR_WIDTH;
      }

      // Calculate bar height: velocity × laneHeight (Requirement 2.4)
      const barHeight = velocity * gridHeight;

      // Calculate bar Y position: bottom-anchored, bars grow upward (Requirement 2.5)
      const barY = gridY + gridHeight - barHeight;

      // Choose color based on selection state (Requirement 6.1)
      ctx.fillStyle = isSelected
        ? VELOCITY_LANE_CONFIG.BAR_SELECTED_COLOR
        : VELOCITY_LANE_CONFIG.BAR_COLOR;

      // Render the bar
      ctx.fillRect(barX, barY, barWidth, barHeight);
    }
  }
}

/**
 * Renders the baseline at the bottom of the grid area.
 *
 * Requirement 9.4: Horizontal baseline at velocity 0, spanning full grid width.
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 */
export function renderBaseline(
  ctx: CanvasRenderingContext2D,
  dimensions: VelocityRenderDimensions
): void {
  const { gridX, gridY, gridWidth, gridHeight } = dimensions;

  // Draw horizontal line at the bottom of the grid area (velocity 0)
  const baselineY = gridY + gridHeight;

  ctx.strokeStyle = VELOCITY_LANE_CONFIG.BASELINE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gridX, baselineY);
  ctx.lineTo(gridX + gridWidth, baselineY);
  ctx.stroke();
}

/**
 * Renders the scale indicator on the left side of the lane.
 *
 * Requirement 9.5: Fixed width (40px), labeled ticks at velocity 0, 0.5, and 1.
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 */
export function renderScaleIndicator(
  ctx: CanvasRenderingContext2D,
  dimensions: VelocityRenderDimensions
): void {
  const { gridX, gridY, gridHeight } = dimensions;
  const scaleWidth = VELOCITY_LANE_CONFIG.SCALE_INDICATOR_WIDTH;

  // Draw scale indicator background
  ctx.fillStyle = VELOCITY_LANE_CONFIG.LANE_BACKGROUND;
  ctx.fillRect(0, gridY, scaleWidth, gridHeight);

  // Draw tick marks and labels at velocity 0, 0.5, and 1
  const ticks = [
    { value: 1, label: '1' },
    { value: 0.5, label: '.5' },
    { value: 0, label: '0' },
  ];

  ctx.fillStyle = VELOCITY_LANE_CONFIG.SCALE_TEXT_COLOR;
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  ctx.strokeStyle = VELOCITY_LANE_CONFIG.SCALE_TEXT_COLOR;
  ctx.lineWidth = 0.5;

  for (const tick of ticks) {
    // Y position: bottom-anchored, so velocity 1 is at the top, 0 at the bottom
    const tickY = gridY + gridHeight - (tick.value * gridHeight);

    // Draw tick mark
    ctx.beginPath();
    ctx.moveTo(scaleWidth - 8, tickY);
    ctx.lineTo(scaleWidth - 2, tickY);
    ctx.stroke();

    // Draw label
    ctx.fillText(tick.label, scaleWidth - 10, tickY);
  }

  // Draw a subtle border on the right edge of the scale indicator area
  ctx.strokeStyle = VELOCITY_LANE_CONFIG.BASELINE_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gridX, gridY);
  ctx.lineTo(gridX, gridY + gridHeight);
  ctx.stroke();
}

/**
 * Renders beat grid lines matching the PianoRoll's horizontal axis.
 *
 * Requirement 9.6: Same horizontal time axis and x-offset formula as PianoRoll.
 * Uses: x = gridX + (beat - startBeat) × pixelsPerBeat
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param visibleRegion - Current visible region defining beat range
 */
export function renderBeatGrid(
  ctx: CanvasRenderingContext2D,
  dimensions: VelocityRenderDimensions,
  visibleRegion: VisibleRegion
): void {
  const { gridX, gridY, gridWidth, gridHeight } = dimensions;

  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;

  // Guard against division by zero
  if (visibleBeats <= 0 || gridWidth <= 0) return;

  const pixelsPerBeat = gridWidth / visibleBeats;

  // Draw beat lines (vertical) - same formula as PianoRoll renderGrid
  for (let beat = Math.ceil(visibleRegion.startBeat); beat <= visibleRegion.endBeat; beat++) {
    const relativeBeat = beat - visibleRegion.startBeat;
    const x = gridX + (relativeBeat * pixelsPerBeat);

    // Use different color for measure lines (every 4 beats)
    if (beat % 4 === 0) {
      ctx.strokeStyle = VELOCITY_LANE_CONFIG.MEASURE_LINE_COLOR;
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = VELOCITY_LANE_CONFIG.BEAT_LINE_COLOR;
      ctx.lineWidth = 0.5;
    }

    ctx.beginPath();
    ctx.moveTo(x, gridY);
    ctx.lineTo(x, gridY + gridHeight);
    ctx.stroke();
  }
}

/**
 * Renders the playhead as a red vertical line at the current playback position.
 *
 * Requirement 3.4: Playhead at same horizontal pixel offset as PianoRoll.
 * Uses the same formula: x = gridX + (playheadPosition - startBeat) × pixelsPerBeat
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param playheadPosition - Current playhead position in beats (undefined = no playhead)
 * @param visibleRegion - Current visible region defining beat range
 */
export function renderPlayhead(
  ctx: CanvasRenderingContext2D,
  dimensions: VelocityRenderDimensions,
  playheadPosition: number | undefined,
  visibleRegion: VisibleRegion
): void {
  // Don't render playhead if position is undefined
  if (playheadPosition === undefined) return;

  const { gridX, gridY, gridWidth, gridHeight } = dimensions;

  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;

  // Guard against division by zero
  if (visibleBeats <= 0 || gridWidth <= 0) return;

  const pixelsPerBeat = gridWidth / visibleBeats;

  // Calculate playhead X position relative to visible region (same as PianoRoll)
  const relativeBeat = playheadPosition - visibleRegion.startBeat;
  const playheadX = gridX + (relativeBeat * pixelsPerBeat);

  // Only render if playhead is within visible region
  if (playheadX < gridX || playheadX > gridX + gridWidth) return;

  // Draw playhead line spanning full grid height
  ctx.strokeStyle = VELOCITY_LANE_CONFIG.PLAYHEAD_COLOR;
  ctx.lineWidth = VELOCITY_LANE_CONFIG.PLAYHEAD_WIDTH;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(playheadX, gridY);
  ctx.lineTo(playheadX, gridY + gridHeight);
  ctx.stroke();
}
