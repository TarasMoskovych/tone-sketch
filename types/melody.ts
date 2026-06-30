import type { Note } from './note';
import type { SynthesizerConfig } from './synth';

/**
 * Complete composition with metadata.
 * Contains all data needed to fully represent a saved melody.
 */
export interface Melody {
  /** UUID v4 */
  id: string;
  /** Melody title (1-200 characters) */
  title: string;
  /** Array of notes in the melody (max 10000 notes) */
  notes: Note[];
  /** Tempo in BPM (integer) */
  tempo: number;
  /** Synthesizer configuration */
  synth: SynthesizerConfig;
  /** Creation timestamp */
  createdAt: Date;
  /** Owner's UUID v4 identifier */
  ownerId: string;
}

/**
 * Summary representation of a melody for feed display.
 * Contains only the data needed for listing melodies.
 */
export interface MelodySummary {
  /** UUID v4 */
  id: string;
  /** Melody title */
  title: string;
  /** ISO 8601 formatted creation date string */
  createdAt: string;
  /** Total melody duration in seconds, rounded to 2 decimal places */
  durationSeconds: number;
}
