import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isOctaveBoundary } from '@/components/PianoRoll/coordinate-utils';

/**
 * Feature: piano-roll-refactor, Property 3: Octave Boundary Detection
 *
 * *For any* MIDI note number in the valid range [0, 127], `isOctaveBoundary(note)` shall
 * return `true` if and only if `note % 12 === 0` (the note is C).
 *
 * **Validates: Requirements 4.5**
 */
describe('Property 3: Octave Boundary Detection', () => {
  // Arbitrary for valid MIDI notes (0-127)
  const midiNoteArb = fc.integer({ min: 0, max: 127 });

  it('should return true iff note % 12 === 0 for all MIDI notes', () => {
    fc.assert(
      fc.property(midiNoteArb, (midiNote) => {
        const result = isOctaveBoundary(midiNote);
        const expected = midiNote % 12 === 0;
        return result === expected;
      }),
      { numRuns: 128 } // Test all MIDI notes (128 values)
    );
  });

  it('should return true for all C notes (octave boundaries)', () => {
    // C notes are at MIDI values: 0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120
    const cNotes = [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120];

    fc.assert(
      fc.property(fc.constantFrom(...cNotes), (cNote) => {
        return isOctaveBoundary(cNote) === true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return false for all non-C notes', () => {
    // Generate non-C notes (notes where note % 12 !== 0)
    const nonCNoteArb = fc.integer({ min: 0, max: 127 }).filter((n) => n % 12 !== 0);

    fc.assert(
      fc.property(nonCNoteArb, (nonCNote) => {
        return isOctaveBoundary(nonCNote) === false;
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly identify octave boundaries for each octave', () => {
    // Test each octave boundary explicitly
    for (let octave = 0; octave <= 10; octave++) {
      const cNote = octave * 12;
      if (cNote <= 127) {
        expect(isOctaveBoundary(cNote)).toBe(true);

        // Test the notes immediately around each C
        if (cNote > 0) {
          expect(isOctaveBoundary(cNote - 1)).toBe(false); // B below
        }
        if (cNote < 127) {
          expect(isOctaveBoundary(cNote + 1)).toBe(false); // C# above
        }
      }
    }
  });

  it('should handle all 12 chromatic notes within each octave correctly', () => {
    // For each octave, test all 12 chromatic notes
    const octaveArb = fc.integer({ min: 0, max: 9 }); // Octaves 0-9 cover MIDI notes 0-119

    fc.assert(
      fc.property(octaveArb, (octave) => {
        const baseNote = octave * 12;

        // Only C (offset 0) should be an octave boundary
        for (let offset = 0; offset < 12; offset++) {
          const midiNote = baseNote + offset;
          if (midiNote <= 127) {
            const result = isOctaveBoundary(midiNote);
            const expected = offset === 0;
            if (result !== expected) {
              return false;
            }
          }
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return consistent results (deterministic behavior)', () => {
    fc.assert(
      fc.property(midiNoteArb, (midiNote) => {
        // Call the function multiple times and ensure consistent results
        const result1 = isOctaveBoundary(midiNote);
        const result2 = isOctaveBoundary(midiNote);
        const result3 = isOctaveBoundary(midiNote);

        return result1 === result2 && result2 === result3;
      }),
      { numRuns: 128 }
    );
  });
});
