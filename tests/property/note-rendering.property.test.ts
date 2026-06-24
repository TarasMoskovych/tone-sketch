import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateNotePositionSimple } from '../../utils/note-rendering';
import type { Note } from '../../types/note';

// Feature: tone-sketch, Property 1: Note Rendering Position Calculation
/**
 * Property 1: Note Rendering Position Calculation
 *
 * *For any* Note with valid pitch (0-127), start time (≥0), and duration (>0),
 * the rendered rectangle position SHALL be calculated as:
 * - X position = (start time - startBeat) × pixels per beat
 * - Y position = gridHeight - ((pitch - startPitch + 1) × pixels per semitone)
 * - Width = duration × pixels per beat
 * - Height = pixels per semitone
 *
 * **Validates: Requirements 1.2**
 */
describe('Property 1: Note Rendering Position Calculation', () => {
  // Arbitrary for valid MIDI pitch (0-127)
  const pitchArb = fc.integer({ min: 0, max: 127 });

  // Arbitrary for valid start time (0-10000)
  const startArb = fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for valid duration (0.001-1000)
  const durationArb = fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for velocity (0-1)
  const velocityArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for pixels per beat (reasonable range for UI)
  const pixelsPerBeatArb = fc.double({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for pixels per semitone (reasonable range for UI)
  const pixelsPerSemitoneArb = fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for start beat offset
  const startBeatArb = fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for start pitch offset
  const startPitchArb = fc.integer({ min: 0, max: 120 });

  // Arbitrary for grid height
  const gridHeightArb = fc.double({ min: 100, max: 5000, noNaN: true, noDefaultInfinity: true });

  // Generate a valid Note
  const noteArb: fc.Arbitrary<Note> = fc.record({
    id: fc.uuid(),
    pitch: pitchArb,
    start: startArb,
    duration: durationArb,
    velocity: velocityArb,
  });

  it('X position should equal (start - startBeat) × pixelsPerBeat', () => {
    fc.assert(
      fc.property(
        noteArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (note, pixelsPerBeat, pixelsPerSemitone, startBeat, startPitch, gridHeight) => {
          const result = calculateNotePositionSimple(
            note,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          const expectedX = (note.start - startBeat) * pixelsPerBeat;
          expect(result.x).toBeCloseTo(expectedX, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Y position should equal gridHeight - ((pitch - startPitch + 1) × pixelsPerSemitone)', () => {
    fc.assert(
      fc.property(
        noteArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (note, pixelsPerBeat, pixelsPerSemitone, startBeat, startPitch, gridHeight) => {
          const result = calculateNotePositionSimple(
            note,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          const relativePitch = note.pitch - startPitch;
          const expectedY = gridHeight - ((relativePitch + 1) * pixelsPerSemitone);
          expect(result.y).toBeCloseTo(expectedY, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Width should equal duration × pixelsPerBeat', () => {
    fc.assert(
      fc.property(
        noteArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (note, pixelsPerBeat, pixelsPerSemitone, startBeat, startPitch, gridHeight) => {
          const result = calculateNotePositionSimple(
            note,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          const expectedWidth = note.duration * pixelsPerBeat;
          expect(result.width).toBeCloseTo(expectedWidth, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Height should equal pixelsPerSemitone', () => {
    fc.assert(
      fc.property(
        noteArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (note, pixelsPerBeat, pixelsPerSemitone, startBeat, startPitch, gridHeight) => {
          const result = calculateNotePositionSimple(
            note,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          expect(result.height).toBeCloseTo(pixelsPerSemitone, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all position calculations should be consistent with the Note Rendering formula', () => {
    fc.assert(
      fc.property(
        noteArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (note, pixelsPerBeat, pixelsPerSemitone, startBeat, startPitch, gridHeight) => {
          const result = calculateNotePositionSimple(
            note,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          // X = (start - startBeat) × pixelsPerBeat
          const expectedX = (note.start - startBeat) * pixelsPerBeat;

          // Width = duration × pixelsPerBeat
          const expectedWidth = note.duration * pixelsPerBeat;

          // Y = gridHeight - ((pitch - startPitch + 1) × pixelsPerSemitone)
          const relativePitch = note.pitch - startPitch;
          const expectedY = gridHeight - ((relativePitch + 1) * pixelsPerSemitone);

          // Height = pixelsPerSemitone
          const expectedHeight = pixelsPerSemitone;

          expect(result.x).toBeCloseTo(expectedX, 10);
          expect(result.y).toBeCloseTo(expectedY, 10);
          expect(result.width).toBeCloseTo(expectedWidth, 10);
          expect(result.height).toBeCloseTo(expectedHeight, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('notes with same start time should have the same X position', () => {
    fc.assert(
      fc.property(
        startArb,
        durationArb,
        velocityArb,
        pitchArb,
        pitchArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (
          start,
          duration,
          velocity,
          pitch1,
          pitch2,
          pixelsPerBeat,
          pixelsPerSemitone,
          startBeat,
          startPitch,
          gridHeight
        ) => {
          const note1: Note = {
            id: 'note-1',
            pitch: pitch1,
            start,
            duration,
            velocity,
          };
          const note2: Note = {
            id: 'note-2',
            pitch: pitch2,
            start,
            duration,
            velocity,
          };

          const result1 = calculateNotePositionSimple(
            note1,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );
          const result2 = calculateNotePositionSimple(
            note2,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          expect(result1.x).toBeCloseTo(result2.x, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('notes with same pitch should have the same Y position', () => {
    fc.assert(
      fc.property(
        pitchArb,
        startArb,
        startArb,
        durationArb,
        durationArb,
        velocityArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (
          pitch,
          start1,
          start2,
          duration1,
          duration2,
          velocity,
          pixelsPerBeat,
          pixelsPerSemitone,
          startBeat,
          startPitch,
          gridHeight
        ) => {
          const note1: Note = {
            id: 'note-1',
            pitch,
            start: start1,
            duration: duration1,
            velocity,
          };
          const note2: Note = {
            id: 'note-2',
            pitch,
            start: start2,
            duration: duration2,
            velocity,
          };

          const result1 = calculateNotePositionSimple(
            note1,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );
          const result2 = calculateNotePositionSimple(
            note2,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          expect(result1.y).toBeCloseTo(result2.y, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('notes with same duration should have the same width', () => {
    fc.assert(
      fc.property(
        durationArb,
        pitchArb,
        pitchArb,
        startArb,
        startArb,
        velocityArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (
          duration,
          pitch1,
          pitch2,
          start1,
          start2,
          velocity,
          pixelsPerBeat,
          pixelsPerSemitone,
          startBeat,
          startPitch,
          gridHeight
        ) => {
          const note1: Note = {
            id: 'note-1',
            pitch: pitch1,
            start: start1,
            duration,
            velocity,
          };
          const note2: Note = {
            id: 'note-2',
            pitch: pitch2,
            start: start2,
            duration,
            velocity,
          };

          const result1 = calculateNotePositionSimple(
            note1,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );
          const result2 = calculateNotePositionSimple(
            note2,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          expect(result1.width).toBeCloseTo(result2.width, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('width should scale linearly with pixelsPerBeat', () => {
    fc.assert(
      fc.property(
        noteArb,
        pixelsPerBeatArb,
        fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (note, pixelsPerBeat, scaleFactor, pixelsPerSemitone, startBeat, startPitch, gridHeight) => {
          const result1 = calculateNotePositionSimple(
            note,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );
          const result2 = calculateNotePositionSimple(
            note,
            pixelsPerBeat * scaleFactor,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          expect(result2.width).toBeCloseTo(result1.width * scaleFactor, 8);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('height should scale linearly with pixelsPerSemitone', () => {
    fc.assert(
      fc.property(
        noteArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (note, pixelsPerBeat, pixelsPerSemitone, scaleFactor, startBeat, startPitch, gridHeight) => {
          const result1 = calculateNotePositionSimple(
            note,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );
          const result2 = calculateNotePositionSimple(
            note,
            pixelsPerBeat,
            pixelsPerSemitone * scaleFactor,
            startBeat,
            startPitch,
            gridHeight
          );

          expect(result2.height).toBeCloseTo(result1.height * scaleFactor, 8);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('higher pitch notes should have lower Y position (closer to top of grid)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 126 }),
        startArb,
        durationArb,
        velocityArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (
          lowPitch,
          start,
          duration,
          velocity,
          pixelsPerBeat,
          pixelsPerSemitone,
          startBeat,
          startPitch,
          gridHeight
        ) => {
          const highPitch = lowPitch + 1;

          const lowNote: Note = {
            id: 'low-note',
            pitch: lowPitch,
            start,
            duration,
            velocity,
          };
          const highNote: Note = {
            id: 'high-note',
            pitch: highPitch,
            start,
            duration,
            velocity,
          };

          const lowResult = calculateNotePositionSimple(
            lowNote,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );
          const highResult = calculateNotePositionSimple(
            highNote,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          // Higher pitch should have lower Y value (closer to top)
          expect(highResult.y).toBeLessThan(lowResult.y);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('later start times should have higher X position', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 9999, noNaN: true, noDefaultInfinity: true }),
        pitchArb,
        durationArb,
        velocityArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (
          earlyStart,
          pitch,
          duration,
          velocity,
          pixelsPerBeat,
          pixelsPerSemitone,
          startBeat,
          startPitch,
          gridHeight
        ) => {
          const lateStart = earlyStart + 1;

          const earlyNote: Note = {
            id: 'early-note',
            pitch,
            start: earlyStart,
            duration,
            velocity,
          };
          const lateNote: Note = {
            id: 'late-note',
            pitch,
            start: lateStart,
            duration,
            velocity,
          };

          const earlyResult = calculateNotePositionSimple(
            earlyNote,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );
          const lateResult = calculateNotePositionSimple(
            lateNote,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          // Later start time should have higher X value (more to the right)
          expect(lateResult.x).toBeGreaterThan(earlyResult.x);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('longer duration notes should have greater width', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 999, noNaN: true, noDefaultInfinity: true }),
        pitchArb,
        startArb,
        velocityArb,
        pixelsPerBeatArb,
        pixelsPerSemitoneArb,
        startBeatArb,
        startPitchArb,
        gridHeightArb,
        (
          shortDuration,
          pitch,
          start,
          velocity,
          pixelsPerBeat,
          pixelsPerSemitone,
          startBeat,
          startPitch,
          gridHeight
        ) => {
          const longDuration = shortDuration + 0.1;

          const shortNote: Note = {
            id: 'short-note',
            pitch,
            start,
            duration: shortDuration,
            velocity,
          };
          const longNote: Note = {
            id: 'long-note',
            pitch,
            start,
            duration: longDuration,
            velocity,
          };

          const shortResult = calculateNotePositionSimple(
            shortNote,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );
          const longResult = calculateNotePositionSimple(
            longNote,
            pixelsPerBeat,
            pixelsPerSemitone,
            startBeat,
            startPitch,
            gridHeight
          );

          // Longer duration should have greater width
          expect(longResult.width).toBeGreaterThan(shortResult.width);
        }
      ),
      { numRuns: 100 }
    );
  });
});
