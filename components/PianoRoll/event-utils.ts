import type { Note } from '@/types/note';
import type { VisibleRegion } from '@/types/grid';
import { CANVAS_CONFIG, RESIZE_HANDLE_WIDTH } from './constants';
import {
  pixelXToBeat,
  pixelYToPitch,
  beatToPixelX,
  calculateScrollbarState,
  type CoordinateConfig,
  DEFAULT_COORDINATE_CONFIG,
} from './coordinate-utils';

/**
 * Configuration for scrollbar hit detection
 */
export interface ScrollbarHitConfig {
  /** Width of the pitch label area on the left */
  PITCH_LABEL_WIDTH: number;
  /** Height of the time marker area on top */
  TIME_MARKER_HEIGHT: number;
  /** Width of the vertical scrollbar on the right */
  SCROLLBAR_WIDTH: number;
  /** Height of the horizontal scrollbar at the bottom */
  SCROLLBAR_HEIGHT: number;
  /** Minimum thumb size in pixels */
  MIN_THUMB_SIZE: number;
  /** Total pitch range (128 for MIDI 0-127) */
  TOTAL_PITCH_RANGE: number;
}

/**
 * Default scrollbar hit detection config using CANVAS_CONFIG values
 */
export const DEFAULT_SCROLLBAR_HIT_CONFIG: ScrollbarHitConfig = {
  PITCH_LABEL_WIDTH: CANVAS_CONFIG.PITCH_LABEL_WIDTH,
  TIME_MARKER_HEIGHT: CANVAS_CONFIG.TIME_MARKER_HEIGHT,
  SCROLLBAR_WIDTH: CANVAS_CONFIG.SCROLLBAR_WIDTH,
  SCROLLBAR_HEIGHT: CANVAS_CONFIG.SCROLLBAR_HEIGHT,
  MIN_THUMB_SIZE: CANVAS_CONFIG.MIN_THUMB_SIZE,
  TOTAL_PITCH_RANGE: CANVAS_CONFIG.TOTAL_PITCH_RANGE,
};

/**
 * Result of finding a note at a pixel position
 */
export interface NoteAtPixelResult {
  /** The note found at the position */
  note: Note;
  /** Whether the position is on the resize handle */
  isResize: boolean;
}

/**
 * Checks if a click position overlaps with an existing note.
 *
 * Requirement 6.3: Extract isClickOnExistingNote function
 *
 * This is a pure function that accepts explicit parameters for testability.
 *
 * @param notes - Array of notes to check against
 * @param clickBeat - The beat position of the click
 * @param clickPitch - The pitch of the click (integer)
 * @returns true if there is an existing note at this position
 *
 * @example
 * const notes = [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 100 }];
 * isClickOnExistingNote(notes, 0.5, 60); // true (within note)
 * isClickOnExistingNote(notes, 1.5, 60); // false (after note)
 * isClickOnExistingNote(notes, 0.5, 61); // false (wrong pitch)
 */
export function isClickOnExistingNote(
  notes: Note[],
  clickBeat: number,
  clickPitch: number
): boolean {
  return notes.some(note => {
    const noteEndBeat = note.start + note.duration;
    return (
      note.pitch === clickPitch &&
      clickBeat >= note.start &&
      clickBeat < noteEndBeat
    );
  });
}

/**
 * Finds the note at a given beat and pitch position.
 *
 * Requirement 6.1: Extract findNoteAtPosition function
 *
 * This is a pure function that accepts explicit parameters for testability.
 *
 * Property 4: Note Hit Detection Consistency
 * - If this function returns a note, that note's bounds contain the query position
 * - isClickOnExistingNote returns true iff this returns non-null
 *
 * @param notes - Array of notes to search
 * @param clickBeat - The beat position to check
 * @param clickPitch - The pitch to check (integer)
 * @returns The note at that position, or null if none found
 *
 * @example
 * const notes = [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 100 }];
 * findNoteAtPosition(notes, 0.5, 60); // returns the note
 * findNoteAtPosition(notes, 1.5, 60); // returns null
 */
export function findNoteAtPosition(
  notes: Note[],
  clickBeat: number,
  clickPitch: number
): Note | null {
  return notes.find(note => {
    const noteEndBeat = note.start + note.duration;
    return (
      note.pitch === clickPitch &&
      clickBeat >= note.start &&
      clickBeat < noteEndBeat
    );
  }) ?? null;
}

/**
 * Checks if a pixel X position is on the right edge (resize handle) of a note.
 *
 * Requirement 6.4: Extract isOnResizeHandle function
 *
 * Requirements: 5.1 - Detect when mouse is on right edge of a note
 *
 * Property 5: Resize Handle Detection
 * - Returns true iff pixelX is within resizeHandleWidth pixels of the note's right edge
 *
 * @param pixelX - The X position in pixels relative to container
 * @param note - The note to check against
 * @param containerWidth - Width of the container in pixels
 * @param visibleRegion - Current visible region
 * @param resizeHandleWidth - Width of the resize handle zone (defaults to RESIZE_HANDLE_WIDTH)
 * @param config - Coordinate config for layout dimensions
 * @returns true if the position is within the resize handle zone
 *
 * @example
 * // Note ending at beat 4, with beatToPixelX(4) = 200
 * isOnResizeHandle(196, note, 500, visibleRegion); // true (within 8px of end)
 * isOnResizeHandle(180, note, 500, visibleRegion); // false (too far from end)
 */
export function isOnResizeHandle(
  pixelX: number,
  note: Note,
  containerWidth: number,
  visibleRegion: VisibleRegion,
  resizeHandleWidth: number = RESIZE_HANDLE_WIDTH,
  config: Pick<CoordinateConfig, 'PITCH_LABEL_WIDTH' | 'SCROLLBAR_WIDTH'> = DEFAULT_COORDINATE_CONFIG
): boolean {
  const noteEndBeat = note.start + note.duration;
  const noteEndPixelX = beatToPixelX(noteEndBeat, containerWidth, visibleRegion, config);

  // Check if pixelX is within resizeHandleWidth pixels of the right edge
  return pixelX >= noteEndPixelX - resizeHandleWidth && pixelX <= noteEndPixelX;
}

/**
 * Finds a note at a given pixel position and determines if it's on the resize handle.
 *
 * Requirement 6.2: Extract findNoteAtPixelPosition function
 *
 * Requirements: 5.1 - Detect resize handle zone
 *
 * This function combines pixel-to-beat/pitch conversion with note hit detection.
 *
 * @param notes - Array of notes to search
 * @param pixelX - The X position in pixels relative to container
 * @param pixelY - The Y position in pixels relative to container
 * @param containerWidth - Width of the container in pixels
 * @param containerHeight - Height of the container in pixels
 * @param visibleRegion - Current visible region
 * @param resizeHandleWidth - Width of the resize handle zone (defaults to RESIZE_HANDLE_WIDTH)
 * @param config - Coordinate config for layout dimensions
 * @returns Object with note and isResize flag, or null if no note at position
 *
 * @example
 * const result = findNoteAtPixelPosition(notes, 150, 200, 500, 400, visibleRegion);
 * if (result) {
 *   console.log(result.note.id, result.isResize);
 * }
 */
export function findNoteAtPixelPosition(
  notes: Note[],
  pixelX: number,
  pixelY: number,
  containerWidth: number,
  containerHeight: number,
  visibleRegion: VisibleRegion,
  resizeHandleWidth: number = RESIZE_HANDLE_WIDTH,
  config: CoordinateConfig = DEFAULT_COORDINATE_CONFIG
): NoteAtPixelResult | null {
  const clickBeat = pixelXToBeat(pixelX, containerWidth, visibleRegion, config);
  const clickPitch = pixelYToPitch(pixelY, containerHeight, visibleRegion, config);
  const note = findNoteAtPosition(notes, clickBeat, clickPitch);

  if (!note) return null;

  const isResize = isOnResizeHandle(pixelX, note, containerWidth, visibleRegion, resizeHandleWidth, config);
  return { note, isResize };
}

/**
 * Checks if a pixel position is within a scrollbar thumb.
 *
 * Requirement 6.5: Extract getScrollbarAtPosition function
 *
 * Requirements: 34.3 - Detect scrollbar thumb for drag interactions
 *
 * Property 6: Scrollbar Hit Detection
 * - Returns 'horizontal' if position is within horizontal scrollbar thumb
 * - Returns 'vertical' if position is within vertical scrollbar thumb
 * - Returns null if position is outside all scrollbar thumbs
 * - A position cannot be in both thumbs simultaneously
 *
 * @param pixelX - The X position in pixels relative to container
 * @param pixelY - The Y position in pixels relative to container
 * @param containerWidth - Width of the container in pixels
 * @param containerHeight - Height of the container in pixels
 * @param visibleRegion - Current visible region
 * @param totalBeats - Total horizontal range (timeline length)
 * @param config - Scrollbar hit detection config
 * @returns 'horizontal', 'vertical', or null if not over a scrollbar thumb
 *
 * @example
 * // Check if mouse is over a scrollbar thumb
 * const scrollbar = getScrollbarAtPosition(480, 380, 500, 400, visibleRegion, 64);
 * if (scrollbar === 'horizontal') {
 *   // Start horizontal scrollbar drag
 * }
 */
export function getScrollbarAtPosition(
  pixelX: number,
  pixelY: number,
  containerWidth: number,
  containerHeight: number,
  visibleRegion: VisibleRegion,
  totalBeats: number,
  config: ScrollbarHitConfig = DEFAULT_SCROLLBAR_HIT_CONFIG
): 'horizontal' | 'vertical' | null {
  const {
    PITCH_LABEL_WIDTH,
    TIME_MARKER_HEIGHT,
    SCROLLBAR_WIDTH,
    SCROLLBAR_HEIGHT,
    MIN_THUMB_SIZE,
    TOTAL_PITCH_RANGE,
  } = config;

  // Calculate scrollbar state from current visible region
  const scrollbarState = calculateScrollbarState(visibleRegion, totalBeats, TOTAL_PITCH_RANGE);

  // Check horizontal scrollbar (bottom)
  const hTrackX = PITCH_LABEL_WIDTH;
  const hTrackY = containerHeight - SCROLLBAR_HEIGHT;
  const hTrackWidth = containerWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
  const hTrackHeight = SCROLLBAR_HEIGHT;

  if (pixelY >= hTrackY && pixelY <= hTrackY + hTrackHeight && pixelX >= hTrackX && pixelX <= hTrackX + hTrackWidth) {
    // Check if over the thumb
    const hThumbWidth = Math.max(MIN_THUMB_SIZE, hTrackWidth * scrollbarState.horizontalThumbSize);
    const hThumbX = hTrackX + (scrollbarState.horizontalPosition * (hTrackWidth - hThumbWidth));

    if (pixelX >= hThumbX && pixelX <= hThumbX + hThumbWidth) {
      return 'horizontal';
    }
  }

  // Check vertical scrollbar (right)
  const vTrackX = containerWidth - SCROLLBAR_WIDTH;
  const vTrackY = TIME_MARKER_HEIGHT;
  const vTrackWidth = SCROLLBAR_WIDTH;
  const vTrackHeight = containerHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

  if (pixelX >= vTrackX && pixelX <= vTrackX + vTrackWidth && pixelY >= vTrackY && pixelY <= vTrackY + vTrackHeight) {
    // Check if over the thumb
    const vThumbHeight = Math.max(MIN_THUMB_SIZE, vTrackHeight * scrollbarState.verticalThumbSize);
    const vThumbY = vTrackY + (scrollbarState.verticalPosition * (vTrackHeight - vThumbHeight));

    if (pixelY >= vThumbY && pixelY <= vThumbY + vThumbHeight) {
      return 'vertical';
    }
  }

  return null;
}
