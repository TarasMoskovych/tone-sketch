import { Midi } from '@tonejs/midi';
import { v4 as uuidv4 } from 'uuid';
import type { Note } from '../types/note';

/**
 * Result of a MIDI import operation.
 */
export interface MidiImportResult {
  /** Array of notes extracted from the MIDI file */
  notes: Note[];
  /** Tempo in BPM (extracted from MIDI file or default 120) */
  tempo: number;
}

/**
 * Error thrown when MIDI import fails.
 */
export class MidiImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MidiImportError';
  }
}

/** Maximum allowed MIDI file size in bytes (5MB) */
export const MAX_MIDI_FILE_SIZE = 5 * 1024 * 1024;

/** Default tempo if no tempo information is found in the MIDI file */
export const DEFAULT_TEMPO = 120;

/**
 * Validates that a file is within the allowed size limit.
 * @param file - The file to validate
 * @throws MidiImportError if the file exceeds the maximum size
 */
export function validateFileSize(file: File): void {
  if (file.size > MAX_MIDI_FILE_SIZE) {
    throw new MidiImportError(
      `File exceeds maximum allowed size of 5MB. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
    );
  }
}

/**
 * Converts MIDI velocity (0-127) to application velocity (0-1).
 * @param midiVelocity - MIDI velocity value (0-127)
 * @returns Normalized velocity value (0-1)
 */
export function convertMidiVelocity(midiVelocity: number): number {
  return Math.max(0, Math.min(1, midiVelocity / 127));
}

/**
 * Extracts the initial tempo from a MIDI file.
 * Returns the tempo from the first tempo event, or default if none found.
 * @param midi - Parsed MIDI object
 * @returns Tempo in BPM (integer)
 */
export function extractTempo(midi: Midi): number {
  // @tonejs/midi stores tempo in the header
  // The tempos array contains all tempo changes, we want the first (initial) one
  if (midi.header.tempos.length > 0) {
    // Round to nearest integer as per requirements
    return Math.round(midi.header.tempos[0].bpm);
  }
  return DEFAULT_TEMPO;
}

/**
 * Converts a @tonejs/midi note to our application's Note format.
 * NOTE: This function is currently unused as conversion is done inline,
 * but kept for potential future refactoring.
 * @param midiNote - Note from @tonejs/midi
 * @returns Note in application format
 */
 
function _convertMidiNote(midiNote: {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
}): Note {
  // @tonejs/midi already converts ticks to seconds based on tempo
  // We need to convert time (in seconds) to beats
  // However, @tonejs/midi also provides ticks which we can convert using PPQ

  return {
    id: uuidv4(),
    pitch: Math.max(0, Math.min(127, midiNote.midi)),
    // time is in seconds, but we need beats. The Midi class provides time in seconds,
    // so we need to use the track's ticks and PPQ for accurate beat conversion
    start: midiNote.time, // Will be converted to beats below
    duration: Math.max(0.001, midiNote.duration), // Ensure minimum duration
    velocity: convertMidiVelocity(midiNote.velocity * 127), // velocity is already 0-1 in @tonejs/midi
  };
}

/**
 * Parses a MIDI file and converts all tracks to Note objects.
 * Supports Standard MIDI File format types 0 and 1.
 * Multiple tracks are merged into a single melody.
 *
 * @param file - The MIDI file to parse
 * @returns Promise resolving to MidiImportResult with notes and tempo
 * @throws MidiImportError if the file is invalid, corrupted, or exceeds size limit
 *
 * @example
 * ```typescript
 * const result = await parseMidiFile(file);
 * console.log(`Imported ${result.notes.length} notes at ${result.tempo} BPM`);
 * ```
 */
export async function parseMidiFile(file: File): Promise<MidiImportResult> {
  // Validate file size
  validateFileSize(file);

  // Read file as ArrayBuffer
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new MidiImportError('Could not read MIDI file. The file may be corrupted.');
  }

  // Parse MIDI file
  let midi: Midi;
  try {
    midi = new Midi(arrayBuffer);
  } catch (error) {
    throw new MidiImportError(
      `Could not parse MIDI file. Please ensure it's a valid .mid file. ${error instanceof Error ? error.message : ''}`
    );
  }

  // Extract tempo (first tempo event)
  const tempo = extractTempo(midi);

  // Get PPQ (pulses per quarter note) for accurate beat conversion
  // Note: Using tempo-based conversion instead for simplicity
   
  const _ppq = midi.header.ppq;

  // Merge all tracks into a single notes array
  const notes: Note[] = [];

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      // @tonejs/midi provides time in seconds, but we need beats
      // Convert using the tempo at that point (simplified: use initial tempo)
      // time (seconds) * (tempo / 60) = beats
      const startInBeats = (note.time * tempo) / 60;
      const durationInBeats = (note.duration * tempo) / 60;

      const convertedNote: Note = {
        id: uuidv4(),
        pitch: Math.max(0, Math.min(127, note.midi)),
        start: Math.max(0, startInBeats),
        duration: Math.max(0.001, durationInBeats),
        // @tonejs/midi velocity is already 0-1
        velocity: Math.max(0, Math.min(1, note.velocity)),
      };

      notes.push(convertedNote);
    }
  }

  // Sort notes by start time for consistent ordering
  notes.sort((a, b) => a.start - b.start);

  return {
    notes,
    tempo,
  };
}

/**
 * MidiImporter class providing a class-based interface for MIDI import.
 * Implements the MidiImporter interface from the design document.
 */
export class MidiImporter {
  /**
   * Parses a MIDI file and converts it to the application's note format.
   * @param file - The MIDI file to parse
   * @returns Promise resolving to MidiImportResult
   * @throws MidiImportError if parsing fails
   */
  async parse(file: File): Promise<MidiImportResult> {
    return parseMidiFile(file);
  }
}

// Default export for convenient importing
export default MidiImporter;
