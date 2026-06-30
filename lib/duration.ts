import type { Note } from '@/types/note';

/**
 * Compute the total duration of a melody in seconds.
 *
 * Calculates the maximum end beat (start + duration) across all notes,
 * converts from beats to seconds using the given tempo, and rounds
 * to 2 decimal places.
 *
 * @param notes - Array of notes in the melody
 * @param tempo - Tempo in beats per minute
 * @returns Duration in seconds rounded to 2 decimal places, or 0 for empty notes / non-positive tempo
 */
export function computeMelodyDuration(notes: Note[], tempo: number): number {
  if (notes.length === 0 || tempo <= 0) return 0;
  const maxEndBeat = Math.max(...notes.map((n) => n.start + n.duration));
  const seconds = (maxEndBeat / tempo) * 60;
  return Math.round(seconds * 100) / 100;
}
