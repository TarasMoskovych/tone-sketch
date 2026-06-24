import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { v4 as uuidv4 } from 'uuid';
import { Midi } from '@tonejs/midi';
import type { Note } from '../../types/note';
import {
  createMidiFile,
  sanitizeFilename,
  generateMidiFilename,
  type ExportableMelody,
} from '../../utils/midi-exporter';

/**
 * Feature: tone-sketch, Property 10: MIDI Import/Export Round-Trip
 *
 * *For any* valid set of Notes with pitch (0-127), start (≥0), duration (>0), and velocity (0-1),
 * exporting to MIDI and re-importing SHALL produce a set of Notes with identical pitch,
 * start time, and duration values for each Note.
 *
 * **Validates: Requirements 16.7, 17.1, 17.2, 17.4**
 */
describe('Property 10: MIDI Import/Export Round-Trip', () => {
  // Arbitrary for valid MIDI pitch values (integers 0-127)
  const pitchArb = fc.integer({ min: 0, max: 127 });

  // Arbitrary for valid start times (beats, reasonable range for testing)
  const startArb = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for valid durations (beats > 0)
  // Using 0.1 as minimum to avoid MIDI quantization precision issues with very small durations
  const durationArb = fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for valid velocities (>0 to 1)
  // Note: Velocity 0 in MIDI represents note-off, so we use non-zero velocities for round-trip
  const velocityArb = fc.double({ min: 0.01, max: 1, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for tempo (BPM, reasonable range)
  const tempoArb = fc.integer({ min: 30, max: 300 });

  // Arbitrary for a valid Note with non-zero velocity (for MIDI round-trip)
  const noteArb = fc.record({
    id: fc.constant(uuidv4()),
    pitch: pitchArb,
    start: startArb,
    duration: durationArb,
    velocity: velocityArb,
  }).map((note) => ({
    ...note,
    id: uuidv4(), // Generate fresh UUID for each note
  }));

  // Arbitrary for array of notes (0-20 notes for reasonable test performance)
  const notesArrayArb = fc.array(noteArb, { minLength: 0, maxLength: 20 });

  /**
   * Helper function to parse a MIDI Blob back to notes.
   * Mimics the import process for round-trip verification.
   */
  async function parseMidiBlob(blob: Blob, originalTempo: number): Promise<Note[]> {
    const arrayBuffer = await blob.arrayBuffer();
    const midi = new Midi(arrayBuffer);

    const notes: Note[] = [];

    // Get the tempo from MIDI or use original
    const tempo = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : originalTempo;

    for (const track of midi.tracks) {
      for (const midiNote of track.notes) {
        // Convert time (seconds) back to beats
        const startInBeats = (midiNote.time * tempo) / 60;
        const durationInBeats = (midiNote.duration * tempo) / 60;

        notes.push({
          id: uuidv4(), // New IDs are generated on import
          pitch: midiNote.midi,
          start: startInBeats,
          duration: durationInBeats,
          velocity: midiNote.velocity,
        });
      }
    }

    // Sort by start time for consistent comparison
    notes.sort((a, b) => a.start - b.start);

    return notes;
  }

  /**
   * Helper to ensure notes don't have overlapping pitch+start combinations.
   * MIDI can have multiple notes at same time but it's unusual and makes
   * round-trip matching ambiguous.
   */
  function deduplicateNotes(notes: Note[]): Note[] {
    const seen = new Map<string, Note>();
    for (const note of notes) {
      const key = `${Math.round(note.pitch)}_${Math.round(note.start * 1000) / 1000}`;
      if (!seen.has(key)) {
        seen.set(key, note);
      }
    }
    return Array.from(seen.values());
  }

  it('note count should be preserved after round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(notesArrayArb, tempoArb, async (rawNotes, tempo) => {
        // Deduplicate to avoid ambiguous matching
        const notes = deduplicateNotes(rawNotes);

        const melody: ExportableMelody = {
          title: 'Test Melody',
          notes,
          tempo,
        };

        const blob = createMidiFile(melody);
        const importedNotes = await parseMidiBlob(blob, tempo);

        expect(importedNotes.length).toBe(notes.length);
      }),
      { numRuns: 100 }
    );
  });

  it('pitch values should be preserved after round-trip (within MIDI range 0-127)', async () => {
    await fc.assert(
      fc.asyncProperty(notesArrayArb, tempoArb, async (rawNotes, tempo) => {
        // Deduplicate to avoid ambiguous matching
        const notes = deduplicateNotes(rawNotes);
        if (notes.length === 0) return; // Skip empty arrays

        const melody: ExportableMelody = {
          title: 'Test Melody',
          notes,
          tempo,
        };

        const blob = createMidiFile(melody);
        const importedNotes = await parseMidiBlob(blob, tempo);

        // Should have same count
        expect(importedNotes.length).toBe(notes.length);

        // For each original note, find a matching imported note
        // Matching criteria: same pitch, similar start, similar duration
        for (const originalNote of notes) {
          const matchingNote = importedNotes.find(
            (imported) =>
              imported.pitch === Math.round(originalNote.pitch) &&
              Math.abs(imported.start - originalNote.start) < 0.1 &&
              Math.abs(imported.duration - originalNote.duration) < 0.1
          );
          expect(matchingNote).toBeDefined();
          expect(matchingNote!.pitch).toBe(Math.round(originalNote.pitch));
        }
      }),
      { numRuns: 100 }
    );
  });

  it('start times should be preserved after round-trip (within floating point tolerance)', async () => {
    await fc.assert(
      fc.asyncProperty(notesArrayArb, tempoArb, async (rawNotes, tempo) => {
        // Deduplicate to avoid ambiguous matching
        const notes = deduplicateNotes(rawNotes);
        if (notes.length === 0) return; // Skip empty arrays

        const melody: ExportableMelody = {
          title: 'Test Melody',
          notes,
          tempo,
        };

        const blob = createMidiFile(melody);
        const importedNotes = await parseMidiBlob(blob, tempo);

        // Should have same count
        expect(importedNotes.length).toBe(notes.length);

        // For each original note, find a matching imported note by pitch and verify start time
        for (const originalNote of notes) {
          const matchingNote = importedNotes.find(
            (imported) =>
              imported.pitch === Math.round(originalNote.pitch) &&
              Math.abs(imported.start - originalNote.start) < 0.1
          );
          expect(matchingNote).toBeDefined();
          // Start times should be close (within tolerance)
          expect(matchingNote!.start).toBeCloseTo(originalNote.start, 1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('durations should be preserved after round-trip (within tolerance)', async () => {
    await fc.assert(
      fc.asyncProperty(notesArrayArb, tempoArb, async (rawNotes, tempo) => {
        // Deduplicate to avoid ambiguous matching
        const notes = deduplicateNotes(rawNotes);
        if (notes.length === 0) return; // Skip empty arrays

        const melody: ExportableMelody = {
          title: 'Test Melody',
          notes,
          tempo,
        };

        const blob = createMidiFile(melody);
        const importedNotes = await parseMidiBlob(blob, tempo);

        // Should have same count
        expect(importedNotes.length).toBe(notes.length);

        // For each original note, find a matching imported note and verify duration
        for (const originalNote of notes) {
          const matchingNote = importedNotes.find(
            (imported) =>
              imported.pitch === Math.round(originalNote.pitch) &&
              Math.abs(imported.start - originalNote.start) < 0.1
          );
          expect(matchingNote).toBeDefined();
          // Durations should be close (within tolerance)
          expect(matchingNote!.duration).toBeCloseTo(originalNote.duration, 1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('velocities should be preserved after round-trip (accounting for 0-1 to 0-127 conversion)', async () => {
    await fc.assert(
      fc.asyncProperty(notesArrayArb, tempoArb, async (rawNotes, tempo) => {
        // Deduplicate to avoid ambiguous matching
        const notes = deduplicateNotes(rawNotes);
        if (notes.length === 0) return; // Skip empty arrays

        const melody: ExportableMelody = {
          title: 'Test Melody',
          notes,
          tempo,
        };

        const blob = createMidiFile(melody);
        const importedNotes = await parseMidiBlob(blob, tempo);

        // Should have same count
        expect(importedNotes.length).toBe(notes.length);

        // For each original note, find a matching imported note and verify velocity
        for (const originalNote of notes) {
          const matchingNote = importedNotes.find(
            (imported) =>
              imported.pitch === Math.round(originalNote.pitch) &&
              Math.abs(imported.start - originalNote.start) < 0.1
          );
          expect(matchingNote).toBeDefined();
          // Velocity conversion: 0-1 -> 0-127 (rounded) -> 0-1
          // Maximum error is about 1/127 ≈ 0.008, but we allow slightly more for tolerance
          expect(matchingNote!.velocity).toBeCloseTo(originalNote.velocity, 1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('tempo should be preserved in the exported MIDI file', async () => {
    await fc.assert(
      fc.asyncProperty(notesArrayArb, tempoArb, async (notes, tempo) => {
        const melody: ExportableMelody = {
          title: 'Test Melody',
          notes,
          tempo,
        };

        const blob = createMidiFile(melody);
        const arrayBuffer = await blob.arrayBuffer();
        const midi = new Midi(arrayBuffer);

        // Tempo should be preserved in the MIDI file
        expect(midi.header.tempos.length).toBeGreaterThan(0);
        expect(midi.header.tempos[0].bpm).toBeCloseTo(tempo, 1);
      }),
      { numRuns: 100 }
    );
  });

  it('empty melody should round-trip correctly', async () => {
    await fc.assert(
      fc.asyncProperty(tempoArb, async (tempo) => {
        const melody: ExportableMelody = {
          title: 'Empty Melody',
          notes: [],
          tempo,
        };

        const blob = createMidiFile(melody);
        const importedNotes = await parseMidiBlob(blob, tempo);

        expect(importedNotes.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('single note should round-trip with exact pitch preservation', async () => {
    await fc.assert(
      fc.asyncProperty(noteArb, tempoArb, async (note, tempo) => {
        const melody: ExportableMelody = {
          title: 'Single Note Melody',
          notes: [note],
          tempo,
        };

        const blob = createMidiFile(melody);
        const importedNotes = await parseMidiBlob(blob, tempo);

        expect(importedNotes.length).toBe(1);
        expect(importedNotes[0].pitch).toBe(Math.round(note.pitch));
        expect(importedNotes[0].start).toBeCloseTo(note.start, 2);
        expect(importedNotes[0].duration).toBeCloseTo(note.duration, 2);
      }),
      { numRuns: 100 }
    );
  });

  it('notes with boundary pitch values (0 and 127) should be preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(0, 127),
        startArb,
        durationArb,
        velocityArb, // Use non-zero velocity arbitrary
        tempoArb,
        async (pitch, start, duration, velocity, tempo) => {
          const note: Note = {
            id: uuidv4(),
            pitch,
            start,
            duration,
            velocity,
          };

          const melody: ExportableMelody = {
            title: 'Boundary Pitch Test',
            notes: [note],
            tempo,
          };

          const blob = createMidiFile(melody);
          const importedNotes = await parseMidiBlob(blob, tempo);

          expect(importedNotes.length).toBe(1);
          expect(importedNotes[0].pitch).toBe(pitch);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('notes with boundary velocity values should be preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        pitchArb,
        startArb,
        durationArb,
        // Test velocity boundaries that actually round-trip: small positive value and maximum
        fc.constantFrom(0.01, 1),
        tempoArb,
        async (pitch, start, duration, velocity, tempo) => {
          const note: Note = {
            id: uuidv4(),
            pitch,
            start,
            duration,
            velocity,
          };

          const melody: ExportableMelody = {
            title: 'Boundary Velocity Test',
            notes: [note],
            tempo,
          };

          const blob = createMidiFile(melody);
          const importedNotes = await parseMidiBlob(blob, tempo);

          expect(importedNotes.length).toBe(1);
          // Velocity conversion: 0-1 -> 0-127 (rounded) -> 0-1
          // Maximum error is about 1/127 ≈ 0.008
          expect(importedNotes[0].velocity).toBeCloseTo(velocity, 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: tone-sketch, Property 19: Export Filename Sanitization
 *
 * *For any* melody title, the exported MIDI filename SHALL:
 * - Replace all characters not valid in filenames with underscores
 * - End with the ".mid" extension
 *
 * **Validates: Requirements 17.3**
 */
describe('Property 19: Export Filename Sanitization', () => {
  // Characters that are invalid in filenames
  const invalidFilenameChars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];

  // Arbitrary for strings that may contain invalid filename characters
  const titleWithInvalidCharsArb = fc.string({ minLength: 0, maxLength: 50 });

  // Arbitrary for valid title strings (no chars that get modified by sanitizeFilename)
  // Excludes: invalid filename chars, leading/trailing whitespace, leading/trailing underscores, consecutive underscores
  const validTitleArb = fc.string({ minLength: 1, maxLength: 50 }).filter(
    (s) => {
      const trimmed = s.trim();
      return (
        !invalidFilenameChars.some((c) => s.includes(c)) &&
        trimmed.length > 0 &&
        trimmed === s && // No leading/trailing whitespace
        !s.startsWith('_') && // No leading underscore
        !s.endsWith('_') && // No trailing underscore
        !s.includes('__') // No consecutive underscores
      );
    }
  );

  it('filename should always end with .mid extension', () => {
    fc.assert(
      fc.property(titleWithInvalidCharsArb, (title) => {
        const filename = generateMidiFilename(title);
        expect(filename.endsWith('.mid')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('sanitized filename should not contain invalid characters', () => {
    fc.assert(
      fc.property(titleWithInvalidCharsArb, (title) => {
        const sanitized = sanitizeFilename(title);

        for (const char of invalidFilenameChars) {
          expect(sanitized).not.toContain(char);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('invalid characters should be replaced with underscores', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...invalidFilenameChars),
        (invalidChar) => {
          const title = `test${invalidChar}melody`;
          const sanitized = sanitizeFilename(title);

          // The invalid character should be replaced
          expect(sanitized).not.toContain(invalidChar);
          // The result should contain underscore or the parts around the invalid char
          expect(sanitized).toMatch(/test.*melody/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('valid titles should be preserved (with .mid extension added)', () => {
    fc.assert(
      fc.property(validTitleArb, (title) => {
        const filename = generateMidiFilename(title);

        // The filename should be the title with .mid extension
        expect(filename).toBe(`${title}.mid`);
      }),
      { numRuns: 100 }
    );
  });

  it('empty title should result in default filename', () => {
    const filename = generateMidiFilename('');
    expect(filename).toBe('melody.mid');
  });

  it('whitespace-only title should result in default filename', () => {
    const whitespaceStrings = ['   ', '\t\t', '\n\n', '  \t\n  '];
    for (const whitespaceTitle of whitespaceStrings) {
      const filename = generateMidiFilename(whitespaceTitle);
      expect(filename).toBe('melody.mid');
    }
  });

  it('title with only invalid characters should result in default filename', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...invalidFilenameChars), { minLength: 1, maxLength: 10 }),
        (invalidChars) => {
          const invalidOnlyTitle = invalidChars.join('');
          const filename = generateMidiFilename(invalidOnlyTitle);
          expect(filename).toBe('melody.mid');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('consecutive invalid characters should be collapsed to single underscore', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0 && !invalidFilenameChars.some((c) => s.includes(c))),
          fc.array(fc.constantFrom(...invalidFilenameChars), { minLength: 2, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0 && !invalidFilenameChars.some((c) => s.includes(c)))
        ),
        ([prefix, invalidChars, suffix]) => {
          const title = prefix + invalidChars.join('') + suffix;
          const sanitized = sanitizeFilename(title);

          // Should not have consecutive underscores
          expect(sanitized).not.toMatch(/__+/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('leading and trailing invalid characters should be trimmed', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(fc.constantFrom(...invalidFilenameChars), { minLength: 0, maxLength: 3 }),
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0 && !invalidFilenameChars.some((c) => s.includes(c))),
          fc.array(fc.constantFrom(...invalidFilenameChars), { minLength: 0, maxLength: 3 })
        ),
        ([leadingInvalid, validPart, trailingInvalid]) => {
          const title = leadingInvalid.join('') + validPart + trailingInvalid.join('');
          const sanitized = sanitizeFilename(title);

          // Should not start or end with underscore
          expect(sanitized).not.toMatch(/^_/);
          expect(sanitized).not.toMatch(/_$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('filename should be usable for MIDI file download', () => {
    fc.assert(
      fc.property(titleWithInvalidCharsArb, (title) => {
        const filename = generateMidiFilename(title);

        // Filename should be non-empty
        expect(filename.length).toBeGreaterThan(0);

        // Filename should end with .mid
        expect(filename.endsWith('.mid')).toBe(true);

        // Filename without extension should not be empty
        const nameWithoutExtension = filename.slice(0, -4);
        expect(nameWithoutExtension.length).toBeGreaterThan(0);

        // Should not contain any invalid filename characters
        for (const char of invalidFilenameChars) {
          expect(filename).not.toContain(char);
        }
      }),
      { numRuns: 100 }
    );
  });
});
