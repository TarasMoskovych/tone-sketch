import { Midi } from '@tonejs/midi';
import type { Note } from '../types/note';

/**
 * Interface for melody data to export.
 */
export interface ExportableMelody {
  /** Melody title (used for filename) */
  title: string;
  /** Array of notes to export */
  notes: Note[];
  /** Tempo in BPM */
  tempo: number;
}

/**
 * Error thrown when MIDI export fails.
 */
export class MidiExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MidiExportError';
  }
}

/** Default tempo if not specified */
export const DEFAULT_EXPORT_TEMPO = 120;

/** Ticks per quarter note (standard MIDI PPQ) */
export const TICKS_PER_QUARTER_NOTE = 480;

/** Characters that are invalid in filenames */
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Converts application velocity (0-1) to MIDI velocity (0-127).
 * @param velocity - Application velocity value (0-1)
 * @returns MIDI velocity value (0-127)
 */
export function convertToMidiVelocity(velocity: number): number {
  const clamped = Math.max(0, Math.min(1, velocity));
  return Math.round(clamped * 127);
}

/**
 * Converts beats to seconds based on tempo.
 * @param beats - Time in beats
 * @param tempo - Tempo in BPM
 * @returns Time in seconds
 */
export function beatsToSeconds(beats: number, tempo: number): number {
  // beats * (60 / tempo) = seconds
  return beats * (60 / tempo);
}

/**
 * Sanitizes a string to be safe for use as a filename.
 * Replaces invalid characters with underscores.
 * @param title - The melody title
 * @returns Sanitized filename (without extension)
 */
export function sanitizeFilename(title: string): string {
  if (!title || title.trim() === '') {
    return 'melody';
  }

  // Replace invalid filename characters with underscores
  let sanitized = title.replace(INVALID_FILENAME_CHARS, '_');

  // Also replace any consecutive underscores with single underscore
  sanitized = sanitized.replace(/_+/g, '_');

  // Trim leading/trailing underscores and whitespace
  sanitized = sanitized.trim().replace(/^_+|_+$/g, '');

  // If empty after sanitization, use default
  if (sanitized === '') {
    return 'melody';
  }

  return sanitized;
}

/**
 * Generates the filename for the MIDI export.
 * @param title - The melody title
 * @returns Full filename with .mid extension
 */
export function generateMidiFilename(title: string): string {
  return `${sanitizeFilename(title)}.mid`;
}

/**
 * Creates a MIDI file from melody data.
 * Produces a Standard MIDI File format type 0 (single track).
 *
 * @param melody - The melody data to export
 * @returns MIDI file as a Blob
 * @throws MidiExportError if export fails
 *
 * @example
 * ```typescript
 * const blob = createMidiFile({
 *   title: 'My Melody',
 *   notes: [...],
 *   tempo: 120
 * });
 * ```
 */
export function createMidiFile(melody: ExportableMelody): Blob {
  try {
    // Create a new MIDI object
    const midi = new Midi();

    // Set tempo
    const tempo = melody.tempo || DEFAULT_EXPORT_TEMPO;
    midi.header.setTempo(tempo);
    // Note: PPQ is read-only in @tonejs/midi, it defaults to 480 which is our target

    // Create a single track (Type 0 MIDI)
    const track = midi.addTrack();
    track.name = melody.title || 'Track 1';

    // Add notes to the track
    // @tonejs/midi expects time in seconds
    for (const note of melody.notes) {
      // Convert beats to seconds
      const timeInSeconds = beatsToSeconds(note.start, tempo);
      const durationInSeconds = beatsToSeconds(note.duration, tempo);

      track.addNote({
        midi: Math.max(0, Math.min(127, Math.round(note.pitch))),
        time: timeInSeconds,
        duration: durationInSeconds,
        velocity: note.velocity, // @tonejs/midi expects 0-1
      });
    }

    // Convert to array buffer and create blob
    const midiArray = midi.toArray();
    return new Blob([new Uint8Array(midiArray).buffer], { type: 'audio/midi' });
  } catch (error) {
    throw new MidiExportError(
      `Failed to create MIDI file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Exports a melody to a downloadable MIDI file.
 * Triggers a file download in the browser.
 *
 * @param melody - The melody data to export
 * @returns The Blob that was downloaded
 * @throws MidiExportError if export fails
 *
 * @example
 * ```typescript
 * await exportMelodyToMidi({
 *   title: 'My Melody',
 *   notes: [...],
 *   tempo: 120
 * });
 * // Browser downloads "My_Melody.mid"
 * ```
 */
export function exportMelodyToMidi(melody: ExportableMelody): Blob {
  // Create the MIDI file
  const blob = createMidiFile(melody);

  // Generate sanitized filename
  const filename = generateMidiFilename(melody.title);

  // Trigger download
  triggerDownload(blob, filename);

  return blob;
}

/**
 * Triggers a file download in the browser.
 * @param blob - The file content as a Blob
 * @param filename - The filename for the download
 */
function triggerDownload(blob: Blob, filename: string): void {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  // Create a temporary anchor element
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;

  // Append to body, click, and remove
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Revoke the object URL to free memory
  URL.revokeObjectURL(url);
}

/**
 * MidiExporter class providing a class-based interface for MIDI export.
 * Implements the MidiExporter interface from the design document.
 */
export class MidiExporter {
  /**
   * Exports a melody to MIDI format and returns it as a Blob.
   * @param melody - The melody data to export
   * @returns MIDI file as a Blob
   * @throws MidiExportError if export fails
   */
  export(melody: ExportableMelody): Blob {
    return createMidiFile(melody);
  }

  /**
   * Exports a melody and triggers a file download.
   * @param melody - The melody data to export
   * @returns The Blob that was downloaded
   * @throws MidiExportError if export fails
   */
  download(melody: ExportableMelody): Blob {
    return exportMelodyToMidi(melody);
  }

  /**
   * Generates a sanitized filename for a melody.
   * @param title - The melody title
   * @returns Filename with .mid extension
   */
  getFilename(title: string): string {
    return generateMidiFilename(title);
  }
}

// Default export for convenient importing
export default MidiExporter;
