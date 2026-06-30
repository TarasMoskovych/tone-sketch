import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeMelodyDuration } from '@/lib/duration';
import type { Note } from '@/types/note';

/**
 * Feature: homepage-visualizer, Property 1: Duration Computation Correctness
 *
 * *For any* non-empty array of notes with positive start and duration values,
 * and *for any* positive tempo value, the computed `durationSeconds` SHALL equal
 * `Math.round((Math.max(...notes.map(n => n.start + n.duration)) / tempo * 60) * 100) / 100`,
 * and for empty notes or non-positive tempo the result SHALL be 0.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */
describe('Property 1: Duration Computation Correctness', () => {
  // Arbitrary for a single note with positive start and duration
  const noteArb: fc.Arbitrary<Note> = fc.record({
    id: fc.uuid(),
    pitch: fc.integer({ min: 0, max: 127 }),
    start: fc.double({ min: 0.001, max: 10000, noNaN: true }),
    duration: fc.double({ min: 0.001, max: 1000, noNaN: true }),
    velocity: fc.double({ min: 0, max: 1, noNaN: true }),
  });

  // Arbitrary for a non-empty array of notes
  const notesArb: fc.Arbitrary<Note[]> = fc.array(noteArb, { minLength: 1, maxLength: 50 });

  // Arbitrary for a positive tempo
  const tempoArb: fc.Arbitrary<number> = fc.double({ min: 1, max: 300, noNaN: true });

  it('should compute duration matching the formula for non-empty notes and positive tempo', () => {
    fc.assert(
      fc.property(notesArb, tempoArb, (notes, tempo) => {
        const result = computeMelodyDuration(notes, tempo);
        const maxEndBeat = Math.max(...notes.map((n) => n.start + n.duration));
        const expected = Math.round((maxEndBeat / tempo) * 60 * 100) / 100;
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('should return 0 for an empty notes array', () => {
    fc.assert(
      fc.property(tempoArb, (tempo) => {
        const result = computeMelodyDuration([], tempo);
        expect(result).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should return 0 for non-positive tempo', () => {
    fc.assert(
      fc.property(
        notesArb,
        fc.double({ min: -1000, max: 0, noNaN: true }),
        (notes, tempo) => {
          const result = computeMelodyDuration(notes, tempo);
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 0 when both notes are empty and tempo is non-positive', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 0, noNaN: true }),
        (tempo) => {
          const result = computeMelodyDuration([], tempo);
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always return a non-negative value', () => {
    fc.assert(
      fc.property(notesArb, tempoArb, (notes, tempo) => {
        const result = computeMelodyDuration(notes, tempo);
        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should always return a value rounded to at most 2 decimal places', () => {
    fc.assert(
      fc.property(notesArb, tempoArb, (notes, tempo) => {
        const result = computeMelodyDuration(notes, tempo);
        // Verify that rounding to 2 decimal places yields the same value
        expect(result).toBe(Math.round(result * 100) / 100);
      }),
      { numRuns: 100 }
    );
  });
});
