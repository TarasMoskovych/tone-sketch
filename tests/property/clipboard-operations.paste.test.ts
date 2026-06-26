import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { pasteNotesAtPosition } from '@/hooks/clipboard-operations';
import type { ClipboardNote } from '@/hooks/clipboard-operations';
import type { GridSnapConfig, GridDivision } from '@/types/grid';
import { snapPosition, getMinimumDuration } from '@/hooks/usePianoRoll';

// --- Custom Arbitraries ---

const gridDivisionArb: fc.Arbitrary<GridDivision> = fc.constantFrom(
  1,
  0.5,
  0.25,
  0.125,
  0.0625
);

const gridSnapConfigArb: fc.Arbitrary<GridSnapConfig> = fc.record({
  enabled: fc.boolean(),
  division: gridDivisionArb,
});

const clipboardNoteArb: fc.Arbitrary<ClipboardNote> = fc.record({
  startOffset: fc.double({ min: 0, max: 100, noNaN: true }),
  pitch: fc.integer({ min: 0, max: 127 }),
  duration: fc.double({ min: 0.01, max: 50, noNaN: true }),
  velocity: fc.double({ min: 0, max: 1, noNaN: true }),
});

/** Generates clipboard notes that may have out-of-range values for boundary testing */
const clipboardNoteWithOutOfRangeArb: fc.Arbitrary<ClipboardNote> = fc.record({
  startOffset: fc.double({ min: -50, max: 100, noNaN: true }),
  pitch: fc.integer({ min: -20, max: 150 }),
  duration: fc.double({ min: -1, max: 50, noNaN: true }),
  velocity: fc.double({ min: -0.5, max: 1.5, noNaN: true }),
});

const nonEmptyClipboardArb: fc.Arbitrary<ClipboardNote[]> = fc.array(clipboardNoteArb, {
  minLength: 1,
  maxLength: 20,
});

const anchorPositionArb: fc.Arbitrary<number> = fc.double({
  min: 0,
  max: 200,
  noNaN: true,
});

// --- Property Tests ---

describe('Feature: copy-paste-notes, Property 4: Paste preserves note data and positions relative to playhead', () => {
  /**
   * Validates: Requirements 3.1, 3.2
   *
   * For any non-empty clipboard and playhead position, the earliest pasted note
   * starts at the snapped playhead position, all other pasted notes maintain
   * their original relative offsets, and each pasted note preserves pitch,
   * duration, and velocity from clipboard.
   */

  it('earliest pasted note starts at the snapped anchor position', () => {
    fc.assert(
      fc.property(
        nonEmptyClipboardArb,
        anchorPositionArb,
        gridSnapConfigArb,
        (clipboardNotes, anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);
          const snappedAnchor = snapPosition(anchorPosition, gridSnap);

          // Find the clipboard note with minimum offset (earliest)
          const minOffset = Math.min(...clipboardNotes.map((n) => n.startOffset));
          // The pasted note corresponding to the earliest clipboard note
          const earliestIdx = clipboardNotes.findIndex((n) => n.startOffset === minOffset);
          const earliestPastedStart = result[earliestIdx].start;

          // The earliest note start should be max(0, snappedAnchor + minOffset)
          const expectedStart = Math.max(0, snappedAnchor + minOffset);
          expect(earliestPastedStart).toBeCloseTo(expectedStart, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pasted notes maintain original relative offsets from clipboard', () => {
    fc.assert(
      fc.property(
        nonEmptyClipboardArb,
        anchorPositionArb,
        gridSnapConfigArb,
        (clipboardNotes, anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);
          const snappedAnchor = snapPosition(anchorPosition, gridSnap);

          // For each pair of notes, relative offset should be preserved
          // (unless clamped to 0 by boundary validation)
          for (let i = 0; i < clipboardNotes.length; i++) {
            const expectedStart = Math.max(0, snappedAnchor + clipboardNotes[i].startOffset);
            expect(result[i].start).toBeCloseTo(expectedStart, 10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each pasted note preserves pitch, duration, and velocity from clipboard', () => {
    fc.assert(
      fc.property(
        nonEmptyClipboardArb,
        anchorPositionArb,
        gridSnapConfigArb,
        (clipboardNotes, anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);
          const minDuration = getMinimumDuration(gridSnap);

          for (let i = 0; i < clipboardNotes.length; i++) {
            // Pitch is preserved (clamped to 0-127)
            expect(result[i].pitch).toBe(
              Math.max(0, Math.min(127, clipboardNotes[i].pitch))
            );
            // Duration is preserved (clamped to minimum)
            expect(result[i].duration).toBeCloseTo(
              Math.max(minDuration, clipboardNotes[i].duration),
              10
            );
            // Velocity is preserved (clamped to 0-1)
            expect(result[i].velocity).toBeCloseTo(
              Math.max(0, Math.min(1, clipboardNotes[i].velocity)),
              10
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: copy-paste-notes, Property 5: Paste respects grid snap configuration', () => {
  /**
   * Validates: Requirements 3.4, 3.5
   *
   * When grid snap is enabled, the anchor is snapped to the grid division.
   * When grid snap is disabled, the anchor equals the exact position
   * (quantized to 1/32 beat).
   */

  it('when grid snap is enabled, anchor is snapped to grid division', () => {
    fc.assert(
      fc.property(
        nonEmptyClipboardArb,
        anchorPositionArb,
        gridDivisionArb,
        (clipboardNotes, anchorPosition, division) => {
          const gridSnap: GridSnapConfig = { enabled: true, division };
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);

          // The snapped anchor is round(anchorPosition / division) * division
          const expectedSnappedAnchor = Math.round(anchorPosition / division) * division;

          // Check the first note's start reflects the snapped anchor
          const expectedStart = Math.max(
            0,
            expectedSnappedAnchor + clipboardNotes[0].startOffset
          );
          expect(result[0].start).toBeCloseTo(expectedStart, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when grid snap is disabled, anchor is quantized to 1/32 beat resolution', () => {
    const FREE_POSITIONING_RESOLUTION = 0.03125;

    fc.assert(
      fc.property(
        nonEmptyClipboardArb,
        anchorPositionArb,
        gridDivisionArb,
        (clipboardNotes, anchorPosition, division) => {
          const gridSnap: GridSnapConfig = { enabled: false, division };
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);

          // The anchor should be quantized to 1/32 beat
          const expectedSnappedAnchor =
            Math.round(anchorPosition / FREE_POSITIONING_RESOLUTION) *
            FREE_POSITIONING_RESOLUTION;

          const expectedStart = Math.max(
            0,
            expectedSnappedAnchor + clipboardNotes[0].startOffset
          );
          expect(result[0].start).toBeCloseTo(expectedStart, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: copy-paste-notes, Property 6: All note-creation operations produce unique IDs', () => {
  /**
   * Validates: Requirements 3.3, 5.2, 5.3, 5.4
   *
   * Every pasted note has a unique ID.
   * No two notes in the same paste operation share an ID.
   */

  it('every pasted note has a unique ID', () => {
    fc.assert(
      fc.property(
        nonEmptyClipboardArb,
        anchorPositionArb,
        gridSnapConfigArb,
        (clipboardNotes, anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);

          const ids = result.map((note) => note.id);
          const uniqueIds = new Set(ids);

          // All IDs should be unique within the paste operation
          expect(uniqueIds.size).toBe(ids.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('IDs from separate paste operations are unique', () => {
    fc.assert(
      fc.property(
        nonEmptyClipboardArb,
        anchorPositionArb,
        anchorPositionArb,
        gridSnapConfigArb,
        (clipboardNotes, anchor1, anchor2, gridSnap) => {
          const result1 = pasteNotesAtPosition(clipboardNotes, anchor1, gridSnap);
          const result2 = pasteNotesAtPosition(clipboardNotes, anchor2, gridSnap);

          const ids1 = new Set(result1.map((note) => note.id));
          const ids2 = result2.map((note) => note.id);

          // No ID from second paste should appear in first paste
          for (const id of ids2) {
            expect(ids1.has(id)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each ID is a valid UUID format', () => {
    fc.assert(
      fc.property(
        nonEmptyClipboardArb,
        anchorPositionArb,
        gridSnapConfigArb,
        (clipboardNotes, anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);

          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          for (const note of result) {
            expect(note.id).toMatch(uuidRegex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: copy-paste-notes, Property 11: Paste validates note boundaries', () => {
  /**
   * Validates: Requirements 5.2, 5.3, 5.4
   *
   * Pitch is clamped to [0, 127].
   * Start time is clamped to >= 0.
   * Duration is clamped to >= minimum grid subdivision.
   */

  it('pitch is clamped to [0, 127]', () => {
    fc.assert(
      fc.property(
        fc.array(clipboardNoteWithOutOfRangeArb, { minLength: 1, maxLength: 10 }),
        anchorPositionArb,
        gridSnapConfigArb,
        (clipboardNotes, anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);

          for (const note of result) {
            expect(note.pitch).toBeGreaterThanOrEqual(0);
            expect(note.pitch).toBeLessThanOrEqual(127);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('start time is clamped to >= 0', () => {
    fc.assert(
      fc.property(
        fc.array(clipboardNoteWithOutOfRangeArb, { minLength: 1, maxLength: 10 }),
        fc.double({ min: -50, max: 200, noNaN: true }),
        gridSnapConfigArb,
        (clipboardNotes, anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);

          for (const note of result) {
            expect(note.start).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('duration is clamped to >= minimum grid subdivision', () => {
    fc.assert(
      fc.property(
        fc.array(clipboardNoteWithOutOfRangeArb, { minLength: 1, maxLength: 10 }),
        anchorPositionArb,
        gridSnapConfigArb,
        (clipboardNotes, anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);
          const minDuration = getMinimumDuration(gridSnap);

          for (const note of result) {
            expect(note.duration).toBeGreaterThanOrEqual(minDuration);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('velocity is clamped to [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.array(clipboardNoteWithOutOfRangeArb, { minLength: 1, maxLength: 10 }),
        anchorPositionArb,
        gridSnapConfigArb,
        (clipboardNotes, anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap);

          for (const note of result) {
            expect(note.velocity).toBeGreaterThanOrEqual(0);
            expect(note.velocity).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty clipboard returns empty array', () => {
    fc.assert(
      fc.property(
        anchorPositionArb,
        gridSnapConfigArb,
        (anchorPosition, gridSnap) => {
          const result = pasteNotesAtPosition([], anchorPosition, gridSnap);
          expect(result).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
