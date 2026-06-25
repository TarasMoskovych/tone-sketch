/**
 * Selection utility functions for multi-note selection
 *
 * This module provides utility functions for handling multi-note selection
 * in the piano roll editor, including platform-specific modifier key detection.
 */

import type { Note } from '../types/note';

/**
 * Checks if the platform-appropriate modifier key is pressed.
 * Returns true for Cmd (metaKey) on macOS, Ctrl (ctrlKey) on Windows/Linux.
 *
 * This function enables platform-native selection behavior:
 * - macOS users expect Cmd+click for toggle/additive selection
 * - Windows/Linux users expect Ctrl+click for the same behavior
 *
 * @param event - A MouseEvent or KeyboardEvent to check for modifier keys
 * @returns true if the platform-appropriate modifier key is pressed
 *
 * @example
 * // In a click handler
 * function handleNoteClick(event: MouseEvent, noteId: string) {
 *   if (isPlatformModifierKey(event)) {
 *     // Toggle selection (Cmd on macOS, Ctrl on Windows/Linux)
 *     toggleNoteSelection(noteId);
 *   } else {
 *     // Replace selection with single note
 *     selectNote(noteId);
 *   }
 * }
 *
 * @example
 * // In a keyboard handler
 * function handleKeyDown(event: KeyboardEvent) {
 *   if (isPlatformModifierKey(event) && event.key === 'a') {
 *     // Ctrl+A on Windows/Linux, Cmd+A on macOS
 *     selectAllNotes();
 *   }
 * }
 */
export function isPlatformModifierKey(event: MouseEvent | KeyboardEvent): boolean {
  // Check if running on macOS by looking at the navigator.platform
  // macOS platforms include: 'MacIntel', 'MacPPC', 'Mac68K', 'MacM1' (ARM)
  // Modern approach also checks navigator.userAgentData when available
  const isMacOS =
    typeof navigator !== 'undefined' &&
    (navigator.platform?.toLowerCase().includes('mac') ||
      // @ts-expect-error - userAgentData is not yet in TypeScript's lib.dom.d.ts
      navigator.userAgentData?.platform?.toLowerCase() === 'macos');

  // On macOS, use metaKey (Cmd); on Windows/Linux, use ctrlKey
  return isMacOS ? event.metaKey : event.ctrlKey;
}


/**
 * Gets the range of notes between two notes by start time.
 * Used for Shift-click range selection.
 *
 * The function returns the IDs of all notes whose start times fall between
 * (inclusive) the anchor note's start time and the target note's start time.
 * Works regardless of whether anchor comes before or after target in time.
 *
 * @param notes - The array of all notes in the piano roll
 * @param anchorNoteId - The ID of the anchor note (last non-Shift clicked note)
 * @param targetNoteId - The ID of the target note (the Shift-clicked note)
 * @returns Array of note IDs in the range, or empty array if either note not found
 *
 * @example
 * // Select all notes between the anchor and clicked note
 * const noteIds = getNoteRange(notes, anchorId, clickedId);
 * addToSelection(noteIds);
 *
 * Validates: Requirements 1.5, 1.6
 */
export function getNoteRange(
  notes: Note[],
  anchorNoteId: string,
  targetNoteId: string
): string[] {
  // Find the anchor and target notes
  const anchorNote = notes.find((note) => note.id === anchorNoteId);
  const targetNote = notes.find((note) => note.id === targetNoteId);

  // If either note is not found, return empty array
  if (!anchorNote || !targetNote) {
    return [];
  }

  // Determine the range bounds (min and max start times)
  const minStart = Math.min(anchorNote.start, targetNote.start);
  const maxStart = Math.max(anchorNote.start, targetNote.start);

  // Return IDs of all notes whose start time falls within the range (inclusive)
  return notes
    .filter((note) => note.start >= minStart && note.start <= maxStart)
    .map((note) => note.id);
}


/**
 * Rectangle in beat/pitch coordinates for marquee selection.
 */
export interface SelectionRect {
  /** Start beat of the selection rectangle */
  startBeat: number;
  /** End beat of the selection rectangle */
  endBeat: number;
  /** Start pitch (lower bound, inclusive) */
  startPitch: number;
  /** End pitch (upper bound, exclusive) */
  endPitch: number;
}

/**
 * Finds all notes that intersect with a rectangle (for marquee selection).
 *
 * A note intersects the rectangle if:
 * - The note's horizontal extent overlaps the rectangle's beat range
 * - The note's pitch falls within the rectangle's pitch range
 *
 * The intersection formula is:
 * - `note.start < endBeat` (note starts before rect ends)
 * - `note.start + note.duration > startBeat` (note ends after rect starts)
 * - `note.pitch >= startPitch` (note pitch at or above lower bound)
 * - `note.pitch < endPitch` (note pitch below upper bound)
 *
 * @param notes - The array of all notes in the piano roll
 * @param rect - The selection rectangle in beat/pitch coordinates
 * @param _visibleRegion - The current visible region (reserved for future optimizations)
 * @returns Array of note IDs that intersect with the rectangle
 *
 * @example
 * // Find all notes within a marquee selection
 * const rect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };
 * const selectedIds = getNotesInRect(notes, rect, visibleRegion);
 *
 * Validates: Requirements 2.2
 */
export function getNotesInRect(
  notes: Note[],
  rect: SelectionRect,
  _visibleRegion?: { startBeat: number; endBeat: number; startPitch: number; endPitch: number }
): string[] {
  const { startBeat, endBeat, startPitch, endPitch } = rect;

  // Filter notes that intersect with the rectangle
  return notes
    .filter((note) => {
      const noteEndBeat = note.start + note.duration;

      // Horizontal intersection: note overlaps beat range
      const horizontalIntersect = note.start < endBeat && noteEndBeat > startBeat;

      // Vertical intersection: pitch within range (startPitch inclusive, endPitch exclusive)
      const verticalIntersect = note.pitch >= startPitch && note.pitch < endPitch;

      return horizontalIntersect && verticalIntersect;
    })
    .map((note) => note.id);
}


/**
 * Result of calculating group movement constraints.
 */
export interface GroupMoveConstraintsResult {
  /** The constrained delta for beat movement */
  constrainedDeltaBeat: number;
  /** The constrained delta for pitch movement */
  constrainedDeltaPitch: number;
}

/**
 * Calculates group movement constraints to keep all notes in valid bounds.
 *
 * When moving a group of selected notes, this function ensures that no note
 * will exceed the valid boundaries:
 * - start time must be >= 0
 * - pitch must be >= 0 and <= 127 (valid MIDI range)
 *
 * The function constrains the movement deltas such that ALL notes remain
 * within valid bounds. If any note would exceed a boundary, the delta is
 * reduced to prevent that violation.
 *
 * @param selectedNotes - Array of notes that are being moved together
 * @param deltaBeat - The requested horizontal movement in beats
 * @param deltaPitch - The requested vertical movement in pitch units
 * @returns Object with constrained deltas that keep all notes in valid bounds
 *
 * @example
 * // Notes at different positions
 * const notes = [
 *   { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
 *   { id: '2', pitch: 65, start: 2, duration: 1, velocity: 0.8 }
 * ];
 *
 * // Try to move left by 3 beats (would make first note start at -3)
 * const result = calculateGroupMoveConstraints(notes, -3, 0);
 * // result.constrainedDeltaBeat === 0 (constrained to keep note at start >= 0)
 *
 * @example
 * // Note at high pitch
 * const notes = [{ id: '1', pitch: 125, start: 4, duration: 1, velocity: 0.8 }];
 *
 * // Try to move up by 5 pitches (would exceed 127)
 * const result = calculateGroupMoveConstraints(notes, 0, 5);
 * // result.constrainedDeltaPitch === 2 (constrained to keep pitch <= 127)
 *
 * Validates: Requirements 4.4, 4.5, 4.6
 */
export function calculateGroupMoveConstraints(
  selectedNotes: Note[],
  deltaBeat: number,
  deltaPitch: number
): GroupMoveConstraintsResult {
  // If no notes are selected, return the original deltas unchanged
  if (selectedNotes.length === 0) {
    return {
      constrainedDeltaBeat: deltaBeat,
      constrainedDeltaPitch: deltaPitch,
    };
  }

  // Find the minimum start time and pitch range among all selected notes
  let minStart = Infinity;
  let minPitch = Infinity;
  let maxPitch = -Infinity;

  for (const note of selectedNotes) {
    if (note.start < minStart) {
      minStart = note.start;
    }
    if (note.pitch < minPitch) {
      minPitch = note.pitch;
    }
    if (note.pitch > maxPitch) {
      maxPitch = note.pitch;
    }
  }

  // Constrain deltaBeat to keep all notes with start >= 0
  // The note with the smallest start time determines the maximum leftward movement
  let constrainedDeltaBeat = deltaBeat;
  if (minStart + deltaBeat < 0) {
    // Constrain to prevent negative start time
    constrainedDeltaBeat = -minStart;
  }
  // Normalize -0 to 0
  if (constrainedDeltaBeat === 0) constrainedDeltaBeat = 0;

  // Constrain deltaPitch to keep all notes within valid MIDI range [0, 127]
  let constrainedDeltaPitch = deltaPitch;

  // Check lower bound: the note with the lowest pitch determines max downward movement
  if (minPitch + deltaPitch < 0) {
    constrainedDeltaPitch = -minPitch;
  }

  // Check upper bound: the note with the highest pitch determines max upward movement
  if (maxPitch + deltaPitch > 127) {
    constrainedDeltaPitch = 127 - maxPitch;
  }
  // Normalize -0 to 0
  if (constrainedDeltaPitch === 0) constrainedDeltaPitch = 0;

  return {
    constrainedDeltaBeat,
    constrainedDeltaPitch,
  };
}
