import type { Note } from '../types/note';
import type { GridSnapConfig } from '../types/grid';
import { snapPosition, getMinimumDuration } from './usePianoRoll';

/**
 * Represents a note stored in the clipboard with relative timing.
 * Offsets are relative to the earliest note in the copied selection.
 */
export interface ClipboardNote {
  /** Relative start offset in beats (earliest note = 0) */
  startOffset: number;
  /** MIDI pitch (0-127) */
  pitch: number;
  /** Duration in beats */
  duration: number;
  /** Velocity (0-1) */
  velocity: number;
}

/**
 * Normalizes selected notes to relative offsets for clipboard storage.
 * The earliest note gets startOffset = 0; all others are offset relative to it.
 *
 * Validates: Requirements 1.4, 2.1
 */
export function normalizeNotesToClipboard(notes: Note[]): ClipboardNote[] {
  if (notes.length === 0) {
    return [];
  }

  const earliestStart = Math.min(...notes.map((note) => note.start));

  return notes.map((note) => ({
    startOffset: note.start - earliestStart,
    pitch: note.pitch,
    duration: note.duration,
    velocity: note.velocity,
  }));
}

/**
 * Creates new notes from clipboard data at a given anchor position.
 * Applies grid snap to the anchor position, then offsets all notes relative to it.
 * Validates boundary constraints on all created notes.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 5.4
 */
export function pasteNotesAtPosition(
  clipboardNotes: ClipboardNote[],
  anchorPosition: number,
  gridSnap: GridSnapConfig
): Note[] {
  if (clipboardNotes.length === 0) {
    return [];
  }

  // Snap anchor position based on grid snap config
  const snappedAnchor = snapPosition(anchorPosition, gridSnap);

  return clipboardNotes.map((clipboardNote) => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      pitch: Math.max(0, Math.min(127, clipboardNote.pitch)),
      start: Math.max(0, snappedAnchor + clipboardNote.startOffset),
      duration: Math.max(getMinimumDuration(gridSnap), clipboardNote.duration),
      velocity: Math.max(0, Math.min(1, clipboardNote.velocity)),
    };

    return newNote;
  });
}

/**
 * Calculates the duplicate anchor position: end time of the latest note
 * in the selection (max of start + duration), snapped if grid snap is enabled.
 *
 * Validates: Requirements 4.1, 4.2, 4.3
 */
export function calculateDuplicateAnchor(
  selectedNotes: Note[],
  gridSnap: GridSnapConfig
): number {
  if (selectedNotes.length === 0) {
    return 0;
  }

  const latestEndTime = Math.max(
    ...selectedNotes.map((note) => note.start + note.duration)
  );

  return snapPosition(latestEndTime, gridSnap);
}

/**
 * Validates and clamps a note's properties to valid ranges.
 * - Pitch: clamped to [0, 127]
 * - Start: clamped to >= 0
 * - Duration: clamped to >= minimum grid subdivision
 * - Velocity: clamped to [0, 1]
 *
 * Validates: Requirements 5.2, 5.3, 5.4
 */
export function validateNoteProperties(note: Note, gridSnap: GridSnapConfig): Note {
  return {
    id: note.id,
    pitch: Math.max(0, Math.min(127, note.pitch)),
    start: Math.max(0, note.start),
    duration: Math.max(getMinimumDuration(gridSnap), note.duration),
    velocity: Math.max(0, Math.min(1, note.velocity)),
  };
}
