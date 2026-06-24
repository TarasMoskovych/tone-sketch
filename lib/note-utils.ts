/**
 * Note utility functions for MIDI note number conversions
 *
 * This module provides utility functions for converting between
 * MIDI note numbers and scientific pitch notation, generating note IDs,
 * and validating note fields.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Note, ValidationResult, ValidationError } from '../types/note';

/** Array of note names in chromatic order starting from C */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Black key positions within an octave (indices where sharps occur) */
const BLACK_KEY_INDICES = [1, 3, 6, 8, 10] as const;

/** Note validation constraints */
const NOTE_CONSTRAINTS = {
  pitch: { min: 0, max: 127 },
  start: { min: 0, max: 10000 },
  duration: { min: 0.001, max: 1000 },
  velocity: { min: 0, max: 1 },
} as const;

/**
 * Converts a MIDI note number to scientific pitch notation.
 *
 * Scientific pitch notation represents notes as a letter (with optional sharp)
 * followed by an octave number. Middle C (MIDI 60) is represented as C4.
 *
 * @param midiNote - MIDI note number (0-127)
 * @returns Note name in scientific pitch notation (e.g., "C4", "C#4", "G9")
 *
 * @example
 * midiToNoteName(0)   // Returns "C-1"
 * midiToNoteName(60)  // Returns "C4" (Middle C)
 * midiToNoteName(69)  // Returns "A4" (Concert A, 440Hz)
 * midiToNoteName(72)  // Returns "C5"
 * midiToNoteName(127) // Returns "G9"
 */
export function midiToNoteName(midiNote: number): string {
  // Note letter = NOTE_NAMES[N % 12]
  const noteName = NOTE_NAMES[midiNote % 12];
  // Octave = floor(N / 12) - 1
  const octave = Math.floor(midiNote / 12) - 1;
  return `${noteName}${octave}`;
}

/**
 * Checks if a MIDI note corresponds to a black key on a piano.
 *
 * Black keys are the sharps/flats: C#, D#, F#, G#, A#
 *
 * @param midiNote - MIDI note number (0-127)
 * @returns true if the note is a black key (sharp), false if white key (natural)
 *
 * @example
 * isBlackKey(60)  // Returns false (C4 is a white key)
 * isBlackKey(61)  // Returns true (C#4 is a black key)
 * isBlackKey(64)  // Returns false (E4 is a white key)
 */
export function isBlackKey(midiNote: number): boolean {
  const noteInOctave = midiNote % 12;
  return BLACK_KEY_INDICES.includes(noteInOctave as 1 | 3 | 6 | 8 | 10);
}

/**
 * Checks if a MIDI note corresponds to a white key on a piano.
 *
 * White keys are the natural notes: C, D, E, F, G, A, B
 *
 * @param midiNote - MIDI note number (0-127)
 * @returns true if the note is a white key (natural), false if black key (sharp)
 *
 * @example
 * isWhiteKey(60)  // Returns true (C4 is a white key)
 * isWhiteKey(61)  // Returns false (C#4 is a black key)
 */
export function isWhiteKey(midiNote: number): boolean {
  return !isBlackKey(midiNote);
}

/**
 * Gets the note letter (without octave) for a MIDI note.
 *
 * @param midiNote - MIDI note number (0-127)
 * @returns Note letter (e.g., "C", "C#", "D")
 *
 * @example
 * getNoteLetter(60)  // Returns "C"
 * getNoteLetter(61)  // Returns "C#"
 */
export function getNoteLetter(midiNote: number): string {
  return NOTE_NAMES[midiNote % 12];
}

/**
 * Gets the octave number for a MIDI note.
 *
 * Uses standard scientific pitch notation where:
 * - MIDI 0-11 = octave -1
 * - MIDI 12-23 = octave 0
 * - MIDI 60 (Middle C) = octave 4
 *
 * @param midiNote - MIDI note number (0-127)
 * @returns Octave number (-1 to 9)
 *
 * @example
 * getOctave(0)   // Returns -1
 * getOctave(60)  // Returns 4
 * getOctave(127) // Returns 9
 */
export function getOctave(midiNote: number): number {
  return Math.floor(midiNote / 12) - 1;
}

/**
 * Generates a unique note ID using UUID v4.
 *
 * @returns A UUID v4 string for use as a note identifier
 *
 * @example
 * generateNoteId() // Returns something like "550e8400-e29b-41d4-a716-446655440000"
 */
export function generateNoteId(): string {
  return uuidv4();
}

/**
 * Validates a Note object against the defined constraints.
 *
 * Validation constraints:
 * - pitch: integer, 0 ≤ pitch ≤ 127
 * - start: number, 0 ≤ start ≤ 10000
 * - duration: number, 0.001 ≤ duration ≤ 1000
 * - velocity: number, 0 ≤ velocity ≤ 1
 *
 * @param note - The Note object to validate
 * @returns ValidationResult with valid flag and array of errors
 *
 * @example
 * // Valid note
 * validateNote({ id: 'abc', pitch: 60, start: 0, duration: 1, velocity: 0.8 })
 * // Returns { valid: true, errors: [] }
 *
 * // Invalid note
 * validateNote({ id: 'abc', pitch: 128, start: -1, duration: 0, velocity: 1.5 })
 * // Returns { valid: false, errors: [...] }
 */
export function validateNote(note: Note): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate pitch: must be an integer between 0 and 127
  if (typeof note.pitch !== 'number' || !Number.isInteger(note.pitch)) {
    errors.push({
      field: 'pitch',
      message: 'pitch must be an integer',
    });
  } else if (note.pitch < NOTE_CONSTRAINTS.pitch.min || note.pitch > NOTE_CONSTRAINTS.pitch.max) {
    errors.push({
      field: 'pitch',
      message: `pitch must be between ${NOTE_CONSTRAINTS.pitch.min} and ${NOTE_CONSTRAINTS.pitch.max}`,
    });
  }

  // Validate start: must be a number between 0 and 10000
  if (typeof note.start !== 'number' || !Number.isFinite(note.start)) {
    errors.push({
      field: 'start',
      message: 'start must be a number',
    });
  } else if (note.start < NOTE_CONSTRAINTS.start.min || note.start > NOTE_CONSTRAINTS.start.max) {
    errors.push({
      field: 'start',
      message: `start must be between ${NOTE_CONSTRAINTS.start.min} and ${NOTE_CONSTRAINTS.start.max}`,
    });
  }

  // Validate duration: must be a number between 0.001 and 1000
  if (typeof note.duration !== 'number' || !Number.isFinite(note.duration)) {
    errors.push({
      field: 'duration',
      message: 'duration must be a number',
    });
  } else if (note.duration < NOTE_CONSTRAINTS.duration.min || note.duration > NOTE_CONSTRAINTS.duration.max) {
    errors.push({
      field: 'duration',
      message: `duration must be between ${NOTE_CONSTRAINTS.duration.min} and ${NOTE_CONSTRAINTS.duration.max}`,
    });
  }

  // Validate velocity: must be a number between 0 and 1
  if (typeof note.velocity !== 'number' || !Number.isFinite(note.velocity)) {
    errors.push({
      field: 'velocity',
      message: 'velocity must be a number',
    });
  } else if (note.velocity < NOTE_CONSTRAINTS.velocity.min || note.velocity > NOTE_CONSTRAINTS.velocity.max) {
    errors.push({
      field: 'velocity',
      message: `velocity must be between ${NOTE_CONSTRAINTS.velocity.min} and ${NOTE_CONSTRAINTS.velocity.max}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Exported constants for use in other modules */
export { NOTE_NAMES, BLACK_KEY_INDICES, NOTE_CONSTRAINTS };
