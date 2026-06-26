import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizeNotesToClipboard } from '../../hooks/clipboard-operations';
import type { Note } from '../../types/note';

/**
 * Feature: copy-paste-notes, Property 1: Clipboard stores relative timing offsets
 *
 * *For any* set of selected notes with varying start times, after normalization,
 * the clipboard SHALL store each note's start as an offset where the earliest note
 * has offset 0 and all other notes have offset equal to (their original start -
 * minimum start in the selection).
 *
 * **Validates: Requirements 1.4, 2.1**
 */
describe('Property 1: Clipboard stores relative timing offsets', () => {
  // Custom arbitrary for a valid Note
  const noteArb: fc.Arbitrary<Note> = fc.record({
    id: fc.uuid(),
    pitch: fc.integer({ min: 0, max: 127 }),
    start: fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
    duration: fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true }),
    velocity: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  });

  // Arbitrary for a non-empty array of notes
  const notesArb = fc.array(noteArb, { minLength: 1, maxLength: 50 });

  it('the earliest note in the result always has startOffset === 0', () => {
    fc.assert(
      fc.property(notesArb, (notes) => {
        const result = normalizeNotesToClipboard(notes);

        const minOffset = Math.min(...result.map((n) => n.startOffset));
        expect(minOffset).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('all notes have startOffset === (originalStart - minStart)', () => {
    fc.assert(
      fc.property(notesArb, (notes) => {
        const result = normalizeNotesToClipboard(notes);
        const minStart = Math.min(...notes.map((n) => n.start));

        for (let i = 0; i < notes.length; i++) {
          const expectedOffset = notes[i].start - minStart;
          expect(result[i].startOffset).toBeCloseTo(expectedOffset, 10);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('pitch, duration, and velocity are preserved exactly', () => {
    fc.assert(
      fc.property(notesArb, (notes) => {
        const result = normalizeNotesToClipboard(notes);

        for (let i = 0; i < notes.length; i++) {
          expect(result[i].pitch).toBe(notes[i].pitch);
          expect(result[i].duration).toBe(notes[i].duration);
          expect(result[i].velocity).toBe(notes[i].velocity);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('empty input returns empty output', () => {
    const result = normalizeNotesToClipboard([]);
    expect(result).toEqual([]);
  });

  it('the number of clipboard notes equals the number of input notes', () => {
    fc.assert(
      fc.property(notesArb, (notes) => {
        const result = normalizeNotesToClipboard(notes);
        expect(result.length).toBe(notes.length);
      }),
      { numRuns: 100 }
    );
  });
});
