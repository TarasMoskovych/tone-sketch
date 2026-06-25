/**
 * Canvas rendering functions for the PianoRoll component.
 *
 * Requirement 5: Rendering Functions Extraction
 * - All rendering functions extracted from PianoRollCanvas.tsx
 * - Functions accept explicit parameters instead of closures for testability
 *
 * @module renderers
 */

import type { VisibleRegion } from '@/types/grid';
import type { Note } from '@/types/note';
import { midiToNoteName, isBlackKey } from '@/lib/note-utils';
import { CANVAS_CONFIG } from './constants';
import { isOctaveBoundary, calculateScrollbarState } from './coordinate-utils';
import type { MarqueeState } from './types';

/**
 * Dimensions used for rendering, calculated once per frame.
 * Provides consistent parameter passing across all rendering functions.
 *
 * Requirement 5: All functions receive data as parameters (not closures)
 */
export interface RenderDimensions {
  /** Total display width in CSS pixels */
  displayWidth: number;
  /** Total display height in CSS pixels */
  displayHeight: number;
  /** X position where the grid area starts (after pitch labels) */
  gridX: number;
  /** Y position where the grid area starts (after time markers) */
  gridY: number;
  /** Width of the grid area (excluding labels and scrollbars) */
  gridWidth: number;
  /** Height of the grid area (excluding markers and scrollbars) */
  gridHeight: number;
}


/**
 * Configuration subset required for canvas rendering.
 * Allows functions to accept explicit config values for testability.
 */
export type RenderConfig = typeof CANVAS_CONFIG;

/**
 * Sets up the canvas with proper device pixel ratio handling.
 * This ensures crisp rendering on high-DPI displays.
 *
 * Requirement 5.9: Extract setupCanvas function
 *
 * @param canvas - The canvas element to set up
 * @param container - The container element that determines the display size
 * @returns Object with context and dimensions, or null if setup fails
 *
 * @example
 * const result = setupCanvas(canvasRef.current, containerRef.current);
 * if (result) {
 *   const { ctx, displayWidth, displayHeight, dpr } = result;
 *   // Use ctx for drawing
 * }
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
 * Calculates render dimensions from display size and config.
 * Utility function to create RenderDimensions from raw values.
 *
 * @param displayWidth - Total display width in CSS pixels
 * @param displayHeight - Total display height in CSS pixels
 * @param config - Canvas configuration with layout constants
 * @returns RenderDimensions object for use in rendering functions
 */
export function calculateRenderDimensions(
  displayWidth: number,
  displayHeight: number,
  config: Pick<RenderConfig, 'PITCH_LABEL_WIDTH' | 'TIME_MARKER_HEIGHT' | 'SCROLLBAR_WIDTH' | 'SCROLLBAR_HEIGHT'> = CANVAS_CONFIG
): RenderDimensions {
  return {
    displayWidth,
    displayHeight,
    gridX: config.PITCH_LABEL_WIDTH,
    gridY: config.TIME_MARKER_HEIGHT,
    gridWidth: displayWidth - config.PITCH_LABEL_WIDTH - config.SCROLLBAR_WIDTH,
    gridHeight: displayHeight - config.TIME_MARKER_HEIGHT - config.SCROLLBAR_HEIGHT,
  };
}

/**
 * Renders pitch labels on the vertical axis.
 * Shows full note names for all visible pitch rows (e.g., "C4", "C#4", "D4", "F#5").
 *
 * Requirement 5.4: Extract renderPitchLabels function
 *
 * Requirements:
 * - 1.3: Display pitch labels showing note names in scientific pitch notation
 * - 35.1, 35.2: Display note names for all keys using scientific pitch notation
 * - 35.4, 35.5: Keep labels visible during horizontal scrolling, visually distinguish natural from sharps
 *
 * Property 24: MIDI Note to Scientific Pitch Notation
 * - Note letter = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][N % 12]
 * - Octave = floor(N / 12) - 1
 * - Middle C (MIDI 60) = C4
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param visibleRegion - Current visible region defining pitch range
 * @param config - Canvas configuration for colors and dimensions
 */
export function renderPitchLabels(
  ctx: CanvasRenderingContext2D,
  dimensions: RenderDimensions,
  visibleRegion: VisibleRegion,
  config: RenderConfig = CANVAS_CONFIG
): void {
  const { displayHeight, gridHeight } = dimensions;
  const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_HEIGHT, PITCH_LABEL_COLOR, GRID_BACKGROUND, BLACK_KEY_COLOR } = config;


  // Draw pitch label background
  ctx.fillStyle = GRID_BACKGROUND;
  ctx.fillRect(0, TIME_MARKER_HEIGHT, PITCH_LABEL_WIDTH, displayHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT);

  // Defensive check: ensure visibleRegion has valid pitch values
  const startPitch = visibleRegion?.startPitch ?? 48;
  const endPitch = visibleRegion?.endPitch ?? 72;
  const visibleSemitones = endPitch - startPitch;

  // Prevent division by zero
  if (visibleSemitones <= 0 || gridHeight <= 0) return;

  const pixelsPerSemitone = gridHeight / visibleSemitones;

  // Draw all pitch labels for visible range
  for (let pitch = Math.floor(startPitch); pitch < Math.ceil(endPitch); pitch++) {
    // Skip invalid MIDI note values
    if (pitch < 0 || pitch > 127) continue;

    const relativePitch = pitch - startPitch;
    // Y increases downward, pitch increases upward
    const y = TIME_MARKER_HEIGHT + gridHeight - ((relativePitch + 1) * pixelsPerSemitone);
    const rowHeight = pixelsPerSemitone;

    // Draw background for black keys (sharps) with darker color to visually distinguish
    if (isBlackKey(pitch)) {
      ctx.fillStyle = BLACK_KEY_COLOR;
      ctx.fillRect(0, y, PITCH_LABEL_WIDTH, rowHeight);
    }

    // Draw note name label
    // Only show text if row is tall enough (at least 8px)
    if (rowHeight >= 8) {
      ctx.fillStyle = PITCH_LABEL_COLOR;
      ctx.font = rowHeight >= 14 ? '11px monospace' : '9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const noteName = midiToNoteName(pitch);
      // Center vertically in the row
      const textY = y + (rowHeight / 2);
      ctx.fillText(noteName, PITCH_LABEL_WIDTH - 4, textY);
    }
  }

  // Draw a subtle border on the right edge of the pitch label area
  ctx.strokeStyle = '#3d3d5c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT);
  ctx.lineTo(PITCH_LABEL_WIDTH, displayHeight - SCROLLBAR_HEIGHT);
  ctx.stroke();
}


/**
 * Renders time markers on the horizontal axis.
 * Shows beat numbers at intervals of 1 beat.
 *
 * Requirement 5.5: Extract renderTimeMarkers function
 * Requirement 1.4: Display time markers showing beat numbers at intervals of 1 beat
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param visibleRegion - Current visible region defining beat range
 * @param config - Canvas configuration for colors and dimensions
 */
export function renderTimeMarkers(
  ctx: CanvasRenderingContext2D,
  dimensions: RenderDimensions,
  visibleRegion: VisibleRegion,
  config: RenderConfig = CANVAS_CONFIG
): void {
  const { displayWidth, gridWidth } = dimensions;
  const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, TIME_MARKER_COLOR, GRID_BACKGROUND } = config;

  // Draw time marker background
  ctx.fillStyle = GRID_BACKGROUND;
  ctx.fillRect(PITCH_LABEL_WIDTH, 0, displayWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH, TIME_MARKER_HEIGHT);

  // Draw time markers
  ctx.fillStyle = TIME_MARKER_COLOR;
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
  const pixelsPerBeat = gridWidth / visibleBeats;

  for (let beat = Math.ceil(visibleRegion.startBeat); beat <= visibleRegion.endBeat; beat++) {
    const relativeBeat = beat - visibleRegion.startBeat;
    const x = PITCH_LABEL_WIDTH + (relativeBeat * pixelsPerBeat);

    // Show beat number
    ctx.fillText(beat.toString(), x, TIME_MARKER_HEIGHT / 2);
  }
}


/**
 * Renders the main grid with beat lines and pitch rows.
 *
 * Requirement 5.1: Extract renderGrid function
 * Requirement 1.1: Display grid with horizontal axis representing time in beats
 *                  and vertical axis representing pitch from MIDI note 0 to 127
 * Requirement 40.5: Highlight piano row background when keyboard piano key is held
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param visibleRegion - Current visible region defining beat and pitch range
 * @param activePitches - Set of pitches currently active from keyboard piano
 * @param playingPitches - Set of pitches currently being played by notes
 * @param config - Canvas configuration for colors and dimensions
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  dimensions: RenderDimensions,
  visibleRegion: VisibleRegion,
  activePitches: Set<number>,
  playingPitches: Set<number>,
  config: RenderConfig = CANVAS_CONFIG
): void {
  const { gridX, gridY, gridWidth, gridHeight } = dimensions;
  const {
    GRID_BACKGROUND,
    BEAT_LINE_COLOR,
    MEASURE_LINE_COLOR,
    PITCH_ROW_COLOR,
    BLACK_KEY_COLOR,
    OCTAVE_LINE_COLOR,
    HIGHLIGHTED_PITCH_COLOR,
  } = config;

  // Fill grid background
  ctx.fillStyle = GRID_BACKGROUND;
  ctx.fillRect(gridX, gridY, gridWidth, gridHeight);

  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
  const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;
  const pixelsPerBeat = gridWidth / visibleBeats;
  const pixelsPerSemitone = gridHeight / visibleSemitones;


  // Draw pitch rows (horizontal bands)
  // Note: visibleRegion pitch values can be floats, but MIDI pitches are integers
  // We iterate through integer pitches that fall within the visible range
  const startPitchInt = Math.floor(visibleRegion.startPitch);
  const endPitchInt = Math.ceil(visibleRegion.endPitch);

  for (let pitch = startPitchInt; pitch < endPitchInt; pitch++) {
    const relativePitch = pitch - visibleRegion.startPitch;
    // Y increases downward, pitch increases upward
    const y = gridY + gridHeight - ((relativePitch + 1) * pixelsPerSemitone);
    const rowHeight = pixelsPerSemitone;

    // Fill black key rows with darker color
    if (isBlackKey(pitch)) {
      ctx.fillStyle = BLACK_KEY_COLOR;
      ctx.fillRect(gridX, y, gridWidth, rowHeight);
    }

    // Highlight pitch rows where notes are currently playing (FL Studio style)
    if (playingPitches.has(pitch)) {
      ctx.fillStyle = HIGHLIGHTED_PITCH_COLOR;
      ctx.fillRect(gridX, y, gridWidth, rowHeight);
    }

    // Highlight keyboard piano active pitches (Requirement 40.5)
    // Support multiple simultaneous highlights for polyphony (Requirement 40.7)
    if (activePitches.has(pitch)) {
      ctx.fillStyle = HIGHLIGHTED_PITCH_COLOR;
      ctx.fillRect(gridX, y, gridWidth, rowHeight);
    }

    // Draw octave boundary lines (C notes)
    if (isOctaveBoundary(pitch)) {
      ctx.strokeStyle = OCTAVE_LINE_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gridX, y + rowHeight);
      ctx.lineTo(gridX + gridWidth, y + rowHeight);
      ctx.stroke();
    }
  }


  // Draw pitch row lines (horizontal)
  ctx.strokeStyle = PITCH_ROW_COLOR;
  ctx.lineWidth = 0.5;
  for (let pitch = startPitchInt; pitch <= endPitchInt; pitch++) {
    const relativePitch = pitch - visibleRegion.startPitch;
    const y = gridY + gridHeight - (relativePitch * pixelsPerSemitone);

    ctx.beginPath();
    ctx.moveTo(gridX, y);
    ctx.lineTo(gridX + gridWidth, y);
    ctx.stroke();
  }

  // Draw beat lines (vertical)
  for (let beat = Math.ceil(visibleRegion.startBeat); beat <= visibleRegion.endBeat; beat++) {
    const relativeBeat = beat - visibleRegion.startBeat;
    const x = gridX + (relativeBeat * pixelsPerBeat);

    // Use different color for measure lines (every 4 beats)
    if (beat % 4 === 0) {
      ctx.strokeStyle = MEASURE_LINE_COLOR;
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = BEAT_LINE_COLOR;
      ctx.lineWidth = 0.5;
    }

    ctx.beginPath();
    ctx.moveTo(x, gridY);
    ctx.lineTo(x, gridY + gridHeight);
    ctx.stroke();
  }
}


/**
 * Calculates the rendering position and dimensions for a note.
 *
 * Requirement 5.8: Extract calculateNotePosition function
 *
 * Property 1: Note Rendering Position Calculation
 * - X position = start time × pixels per beat
 * - Y position = (127 - pitch) × pixels per semitone (adjusted for visible region)
 * - Width = duration × pixels per beat
 *
 * @param note - The note to calculate position for
 * @param pixelsPerBeat - Pixels per beat in the current view
 * @param pixelsPerSemitone - Pixels per semitone in the current view
 * @param gridX - X offset of the grid area
 * @param gridY - Y offset of the grid area
 * @param gridHeight - Height of the grid area
 * @param visibleRegion - Current visible region defining view bounds
 * @returns Object with x, y, width, height or null if note is not visible
 */
export function calculateNotePosition(
  note: Note,
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  gridX: number,
  gridY: number,
  gridHeight: number,
  visibleRegion: VisibleRegion
): { x: number; y: number; width: number; height: number } | null {
  // Check if note is within visible region
  const noteEndBeat = note.start + note.duration;

  // Skip notes outside visible beat range
  if (noteEndBeat < visibleRegion.startBeat || note.start > visibleRegion.endBeat) {
    return null;
  }

  // Skip notes outside visible pitch range
  if (note.pitch < visibleRegion.startPitch || note.pitch >= visibleRegion.endPitch) {
    return null;
  }


  // Calculate X position relative to visible region
  // X = (start - startBeat) × pixelsPerBeat + gridX
  const relativeStart = note.start - visibleRegion.startBeat;
  const x = gridX + relativeStart * pixelsPerBeat;

  // Calculate width based on duration
  // Width = duration × pixelsPerBeat
  const width = note.duration * pixelsPerBeat;

  // Calculate Y position
  // Y position uses (visibleRegion.endPitch - 1 - pitch) because:
  // - Higher pitches should appear higher on screen (lower Y value)
  // - We need to account for the visible region offset
  const relativePitch = note.pitch - visibleRegion.startPitch;
  // Y increases downward, pitch increases upward, so we invert
  // The note occupies the row from (relativePitch) to (relativePitch + 1)
  const y = gridY + gridHeight - ((relativePitch + 1) * pixelsPerSemitone);

  // Height is one semitone
  const height = pixelsPerSemitone;

  return { x, y, width, height };
}


/**
 * Renders notes as rectangular blocks on the canvas.
 *
 * Requirement 5.2: Extract renderNotes function
 * Requirement 1.2: Render existing notes as rectangular blocks positioned
 *                  according to their pitch, start time, and duration
 *
 * Notes are rendered with:
 * - Fill color based on selection state
 * - Border for visual distinction
 * - Rounded corners for aesthetics
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param notes - Array of notes to render
 * @param selectedNoteIds - Set of selected note IDs
 * @param visibleRegion - Current visible region defining view bounds
 * @param isPlaying - Whether playback is currently active
 * @param playheadPosition - Current playhead position in beats (undefined = no playhead)
 * @param config - Canvas configuration for colors and dimensions
 */
export function renderNotes(
  ctx: CanvasRenderingContext2D,
  dimensions: RenderDimensions,
  notes: Note[],
  selectedNoteIds: Set<string>,
  visibleRegion: VisibleRegion,
  isPlaying: boolean,
  playheadPosition: number | undefined,
  config: RenderConfig = CANVAS_CONFIG
): void {
  const { gridX, gridY, gridWidth, gridHeight } = dimensions;
  const {
    NOTE_COLOR,
    NOTE_SELECTED_COLOR,
    NOTE_BORDER_COLOR,
    NOTE_SELECTED_BORDER_COLOR,
    NOTE_PLAYING_COLOR,
    NOTE_PLAYING_BORDER_COLOR,
  } = config;

  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
  const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;
  const pixelsPerBeat = gridWidth / visibleBeats;
  const pixelsPerSemitone = gridHeight / visibleSemitones;


  // Render each note
  for (const note of notes) {
    const position = calculateNotePosition(
      note,
      pixelsPerBeat,
      pixelsPerSemitone,
      gridX,
      gridY,
      gridHeight,
      visibleRegion
    );

    if (!position) continue;

    const { x, y, width, height } = position;
    const isSelected = selectedNoteIds.has(note.id);

    // Check if note is currently being played
    const isCurrentlyPlaying = isPlaying &&
      playheadPosition !== undefined &&
      playheadPosition >= note.start &&
      playheadPosition < note.start + note.duration;

    // Add small padding for visual clarity
    const padding = 1;
    const cornerRadius = 2;

    // Clip the note to the grid boundaries
    const clippedX = Math.max(x, gridX);
    const clippedWidth = Math.min(x + width, gridX + gridWidth) - clippedX;

    // Skip if note is completely outside the grid
    if (clippedWidth <= 0) continue;


    // Draw note fill with rounded corners (playing > selected > default)
    ctx.fillStyle = isCurrentlyPlaying
      ? NOTE_PLAYING_COLOR
      : isSelected
        ? NOTE_SELECTED_COLOR
        : NOTE_COLOR;
    ctx.beginPath();

    // Use roundRect if available, otherwise draw regular rect
    if (ctx.roundRect) {
      ctx.roundRect(
        clippedX + padding,
        y + padding,
        clippedWidth - padding * 2,
        height - padding * 2,
        cornerRadius
      );
    } else {
      ctx.rect(
        clippedX + padding,
        y + padding,
        clippedWidth - padding * 2,
        height - padding * 2
      );
    }
    ctx.fill();

    // Draw note border (playing > selected > default)
    ctx.strokeStyle = isCurrentlyPlaying
      ? NOTE_PLAYING_BORDER_COLOR
      : isSelected
        ? NOTE_SELECTED_BORDER_COLOR
        : NOTE_BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}


/**
 * Renders the playhead as a vertical line at the current playback position.
 *
 * Requirement 5.3: Extract renderPlayhead function
 * Requirements 8.1, 8.2, 8.3: Display playhead at all times, move synchronized at 60fps,
 *                            retain position when playback stops
 *
 * The playhead is rendered on top of notes (after renderNotes in render order)
 * and spans the full height of the grid area.
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param playheadPosition - Current playhead position in beats (undefined = no playhead)
 * @param visibleRegion - Current visible region defining view bounds
 * @param config - Canvas configuration for colors and dimensions
 */
export function renderPlayhead(
  ctx: CanvasRenderingContext2D,
  dimensions: RenderDimensions,
  playheadPosition: number | undefined,
  visibleRegion: VisibleRegion,
  config: RenderConfig = CANVAS_CONFIG
): void {
  // Don't render playhead if position is undefined
  if (playheadPosition === undefined) return;

  const { gridX, gridY, gridWidth, gridHeight } = dimensions;
  const { PLAYHEAD_COLOR, PLAYHEAD_WIDTH } = config;

  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
  const pixelsPerBeat = gridWidth / visibleBeats;

  // Calculate playhead X position relative to visible region
  const relativeBeat = playheadPosition - visibleRegion.startBeat;
  const playheadX = gridX + (relativeBeat * pixelsPerBeat);

  // Only render if playhead is within visible region
  if (playheadX < gridX || playheadX > gridX + gridWidth) return;


  // Draw playhead line spanning full grid height
  ctx.strokeStyle = PLAYHEAD_COLOR;
  ctx.lineWidth = PLAYHEAD_WIDTH;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(playheadX, gridY);
  ctx.lineTo(playheadX, gridY + gridHeight);
  ctx.stroke();
}


/**
 * Renders the scrollbars (horizontal and vertical) on the canvas.
 *
 * Requirement 5.6: Extract renderScrollbars function
 * Requirements 34.1, 34.2, 34.6:
 * - Horizontal scrollbar at bottom for time navigation
 * - Vertical scrollbar on right for pitch navigation
 * - Thumb size proportional to visible region / total range
 *
 * Property 23: Scrollbar-Visible Region Synchronization
 * - Scrollbar position and thumb size are synchronized with visible region
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param visibleRegion - Current visible region defining view bounds
 * @param effectiveTotalBeats - Total timeline length in beats
 * @param config - Canvas configuration for colors and dimensions
 */
export function renderScrollbars(
  ctx: CanvasRenderingContext2D,
  dimensions: RenderDimensions,
  visibleRegion: VisibleRegion,
  effectiveTotalBeats: number,
  config: RenderConfig = CANVAS_CONFIG
): void {
  const { displayWidth, displayHeight } = dimensions;
  const {
    SCROLLBAR_WIDTH,
    SCROLLBAR_HEIGHT,
    MIN_THUMB_SIZE,
    SCROLLBAR_TRACK_COLOR,
    SCROLLBAR_THUMB_COLOR,
    TOTAL_PITCH_RANGE,
    PITCH_LABEL_WIDTH,
    TIME_MARKER_HEIGHT,
  } = config;


  // Calculate scrollbar state from current visible region
  const scrollbarState = calculateScrollbarState(visibleRegion, effectiveTotalBeats, TOTAL_PITCH_RANGE);

  // === Horizontal Scrollbar (bottom) ===
  const hTrackX = PITCH_LABEL_WIDTH;
  const hTrackY = displayHeight - SCROLLBAR_HEIGHT;
  const hTrackWidth = displayWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
  const hTrackHeight = SCROLLBAR_HEIGHT;

  // Draw horizontal scrollbar track
  ctx.fillStyle = SCROLLBAR_TRACK_COLOR;
  ctx.fillRect(hTrackX, hTrackY, hTrackWidth, hTrackHeight);

  // Calculate horizontal thumb dimensions
  const hThumbWidth = Math.max(MIN_THUMB_SIZE, hTrackWidth * scrollbarState.horizontalThumbSize);
  const hThumbMaxX = hTrackX + hTrackWidth - hThumbWidth;
  const hThumbX = hTrackX + (scrollbarState.horizontalPosition * (hTrackWidth - hThumbWidth));
  const hThumbY = hTrackY + 2;
  const hThumbHeight = hTrackHeight - 4;

  // Draw horizontal thumb with rounded corners
  ctx.fillStyle = SCROLLBAR_THUMB_COLOR;
  ctx.beginPath();
  const hCornerRadius = Math.min(3, hThumbHeight / 2);
  if (ctx.roundRect) {
    ctx.roundRect(
      Math.max(hTrackX, Math.min(hThumbMaxX, hThumbX)),
      hThumbY,
      hThumbWidth,
      hThumbHeight,
      hCornerRadius
    );
  } else {
    ctx.rect(
      Math.max(hTrackX, Math.min(hThumbMaxX, hThumbX)),
      hThumbY,
      hThumbWidth,
      hThumbHeight
    );
  }
  ctx.fill();


  // === Vertical Scrollbar (right) ===
  const vTrackX = displayWidth - SCROLLBAR_WIDTH;
  const vTrackY = TIME_MARKER_HEIGHT;
  const vTrackWidth = SCROLLBAR_WIDTH;
  const vTrackHeight = displayHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

  // Draw vertical scrollbar track
  ctx.fillStyle = SCROLLBAR_TRACK_COLOR;
  ctx.fillRect(vTrackX, vTrackY, vTrackWidth, vTrackHeight);

  // Calculate vertical thumb dimensions
  const vThumbHeight = Math.max(MIN_THUMB_SIZE, vTrackHeight * scrollbarState.verticalThumbSize);
  const vThumbMaxY = vTrackY + vTrackHeight - vThumbHeight;
  const vThumbX = vTrackX + 2;
  const vThumbY = vTrackY + (scrollbarState.verticalPosition * (vTrackHeight - vThumbHeight));
  const vThumbWidth = vTrackWidth - 4;

  // Draw vertical thumb with rounded corners
  ctx.fillStyle = SCROLLBAR_THUMB_COLOR;
  ctx.beginPath();
  const vCornerRadius = Math.min(3, vThumbWidth / 2);
  if (ctx.roundRect) {
    ctx.roundRect(
      vThumbX,
      Math.max(vTrackY, Math.min(vThumbMaxY, vThumbY)),
      vThumbWidth,
      vThumbHeight,
      vCornerRadius
    );
  } else {
    ctx.rect(
      vThumbX,
      Math.max(vTrackY, Math.min(vThumbMaxY, vThumbY)),
      vThumbWidth,
      vThumbHeight
    );
  }
  ctx.fill();

  // === Corner box (where scrollbars meet) ===
  ctx.fillStyle = SCROLLBAR_TRACK_COLOR;
  ctx.fillRect(displayWidth - SCROLLBAR_WIDTH, displayHeight - SCROLLBAR_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT);
}


/**
 * Renders the marquee selection rectangle during drag.
 *
 * Requirement 5.7: Extract renderMarquee function
 * Requirements: 2.1, 2.6 - Display selection rectangle with semi-transparent fill and visible border
 *
 * @param ctx - Canvas 2D rendering context
 * @param dimensions - Render dimensions for the canvas
 * @param marqueeState - Current marquee state (null if not selecting)
 * @param config - Canvas configuration for colors and dimensions
 */
export function renderMarquee(
  ctx: CanvasRenderingContext2D,
  dimensions: RenderDimensions,
  marqueeState: MarqueeState | null,
  config: RenderConfig = CANVAS_CONFIG
): void {
  if (!marqueeState) return;

  const { displayWidth, displayHeight } = dimensions;
  const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = config;

  // Calculate the rectangle coordinates
  // Clamp coordinates to grid boundaries
  const minX = Math.max(PITCH_LABEL_WIDTH, Math.min(marqueeState.startX, marqueeState.currentX));
  const maxX = Math.min(displayWidth - SCROLLBAR_WIDTH, Math.max(marqueeState.startX, marqueeState.currentX));
  const minY = Math.max(TIME_MARKER_HEIGHT, Math.min(marqueeState.startY, marqueeState.currentY));
  const maxY = Math.min(displayHeight - SCROLLBAR_HEIGHT, Math.max(marqueeState.startY, marqueeState.currentY));

  const width = maxX - minX;
  const height = maxY - minY;

  // Don't render if the rectangle is too small
  if (width < 1 || height < 1) return;


  // Draw semi-transparent fill
  // Requirements: 2.6 - Semi-transparent fill to distinguish from notes
  ctx.fillStyle = 'rgba(99, 102, 241, 0.2)'; // Light indigo with transparency
  ctx.fillRect(minX, minY, width, height);

  // Draw visible border
  // Requirements: 2.6 - Visible border to distinguish from notes
  ctx.strokeStyle = '#6366f1'; // Indigo border color
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 2]); // Dashed line for visual distinction
  ctx.strokeRect(minX + 0.5, minY + 0.5, width - 1, height - 1);
  ctx.setLineDash([]); // Reset line dash
}
