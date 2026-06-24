import type { Note } from '@/types/note';
import type { VisibleRegion } from '@/types/grid';

/**
 * Result of note position calculation
 */
export interface NoteRenderPosition {
  /** X position in pixels */
  x: number;
  /** Y position in pixels */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Parameters for note position calculation
 */
export interface NoteRenderParams {
  /** Pixels per beat in the current view */
  pixelsPerBeat: number;
  /** Pixels per semitone in the current view */
  pixelsPerSemitone: number;
  /** X offset of the grid area */
  gridX: number;
  /** Y offset of the grid area */
  gridY: number;
  /** Height of the grid area */
  gridHeight: number;
  /** Current visible region */
  visibleRegion: VisibleRegion;
}

/**
 * Calculates the rendering position and dimensions for a note
 *
 * Property 1: Note Rendering Position Calculation
 * For any Note with valid pitch (0-127), start time (≥0), and duration (>0),
 * the rendered rectangle position SHALL be calculated as:
 * - X position = start time × pixels per beat
 * - Y position = (127 - pitch) × pixels per semitone (adjusted for visible region)
 * - Width = duration × pixels per beat
 *
 * Validates: Requirements 1.2
 *
 * @param note The note to calculate position for
 * @param params Rendering parameters
 * @returns Object with x, y, width, height or null if note is not visible
 */
export function calculateNoteRenderPosition(
  note: Note,
  params: NoteRenderParams
): NoteRenderPosition | null {
  const { pixelsPerBeat, pixelsPerSemitone, gridX, gridY, gridHeight, visibleRegion } = params;

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
  // Y position uses the pitch relative to visible region
  // Higher pitches should appear higher on screen (lower Y value)
  const relativePitch = note.pitch - visibleRegion.startPitch;
  // Y increases downward, pitch increases upward, so we invert
  // The note occupies the row from (relativePitch) to (relativePitch + 1)
  const y = gridY + gridHeight - ((relativePitch + 1) * pixelsPerSemitone);

  // Height is one semitone
  const height = pixelsPerSemitone;

  return { x, y, width, height };
}

/**
 * Calculates note position using simple formula without visibility checks
 * This is a pure implementation of Property 1 for testing purposes
 *
 * Property 1: Note Rendering Position Calculation
 * - X position = start time × pixels per beat
 * - Y position = grid height - ((pitch - startPitch + 1) × pixels per semitone)
 * - Width = duration × pixels per beat
 * - Height = pixels per semitone
 *
 * @param note The note to calculate position for
 * @param pixelsPerBeat Pixels per beat
 * @param pixelsPerSemitone Pixels per semitone
 * @param startBeat Start beat of visible region (for X offset)
 * @param startPitch Start pitch of visible region (for Y offset)
 * @param gridHeight Height of grid area
 * @returns Object with x, y, width, height
 */
export function calculateNotePositionSimple(
  note: Note,
  pixelsPerBeat: number,
  pixelsPerSemitone: number,
  startBeat: number = 0,
  startPitch: number = 0,
  gridHeight: number = 0
): { x: number; y: number; width: number; height: number } {
  // X = (start - startBeat) × pixelsPerBeat
  const x = (note.start - startBeat) * pixelsPerBeat;

  // Width = duration × pixelsPerBeat
  const width = note.duration * pixelsPerBeat;

  // Y = gridHeight - ((pitch - startPitch + 1) × pixelsPerSemitone)
  const relativePitch = note.pitch - startPitch;
  const y = gridHeight - ((relativePitch + 1) * pixelsPerSemitone);

  // Height = pixelsPerSemitone
  const height = pixelsPerSemitone;

  return { x, y, width, height };
}
