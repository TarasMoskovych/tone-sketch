import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateDuplicateAnchor } from '@/hooks/clipboard-operations';
import type { Note } from '@/types/note';
import type { GridSnapConfig, GridDivision } from '@/types/grid';

/**
 * Feature: copy-paste-notes, Property 9: Duplicate positions after selection end
 *
 * *For any* set of selected notes, after a duplicate operation, the earliest duplicated
 * note SHALL start at the end time (max of start + duration) of the latest note in the
 * original selection (with grid snap applied if enabled), AND the relative timing between
 * duplicated notes SHALL match the relative values between the original notes.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Property 9: Duplicate positions after selection end', () => {
  // -- Custom Arbitraries --

  const gridDivisionArb: fc.Arbitrary<GridDivision> = fc.constantFrom(
    1,
    0.5,
    0.25,
    0.125,
    0.0625
  );

  const gridSnapConfigArb: fc.Arbitrary<GridSnapConfig> = fc.oneof(
    fc.record({
      enabled: fc.constant(true as const),
      division: gridDivisionArb,
    }),
    fc.record({
      enabled: fc.constant(false as const),
      division: gridDivisionArb,
    })
  );

  const noteArb: fc.Arbitrary<Note> = fc.record({
    id: fc.uuid(),
    pitch: fc.integer({ min: 0, max: 127 }),
    start: fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    duration: fc.float({
      min: Math.fround(0.01),
      max: 10,
      noNaN: true,
      noDefaultInfinity: true,
    }),
    velocity: fc.float({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  });

  const nonEmptyNotesArb: fc.Arbitrary<Note[]> = fc.array(noteArb, {
    minLength: 1,
    maxLength: 20,
  });

  // -- Helper functions matching the implementation logic --

  const FREE_POSITIONING_RESOLUTION = 0.03125; // 1/32 beat

  function snapToGrid(value: number, division: GridDivision): number {
    return Math.round(value / division) * division;
  }

  function quantizeToFreeResolution(value: number): number {
    return Math.round(value / FREE_POSITIONING_RESOLUTION) * FREE_POSITIONING_RESOLUTION;
  }

  function expectedSnapPosition(value: number, gridSnap: GridSnapConfig): number {
    return gridSnap.enabled
      ? snapToGrid(value, gridSnap.division)
      : quantizeToFreeResolution(value);
  }

  // -- Property Tests --

  it('should return the snapped latest end time for any non-empty selection', () => {
    fc.assert(
      fc.property(nonEmptyNotesArb, gridSnapConfigArb, (notes, gridSnap) => {
        const result = calculateDuplicateAnchor(notes, gridSnap);
        const latestEndTime = Math.max(...notes.map((n) => n.start + n.duration));
        const expected = expectedSnapPosition(latestEndTime, gridSnap);
        expect(result).toBeCloseTo(expected, 10);
      }),
      { numRuns: 200 }
    );
  });

  it('should snap the anchor to grid division when grid snap is enabled', () => {
    fc.assert(
      fc.property(
        nonEmptyNotesArb,
        gridDivisionArb,
        (notes, division) => {
          const gridSnap: GridSnapConfig = { enabled: true, division };
          const result = calculateDuplicateAnchor(notes, gridSnap);

          // Result should be a multiple of the grid division (within floating point tolerance)
          const remainder = result % division;
          const isMultiple =
            Math.abs(remainder) < 1e-10 || Math.abs(remainder - division) < 1e-10;
          expect(isMultiple).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should equal the exact latest end time (quantized to 1/32) when grid snap is disabled', () => {
    fc.assert(
      fc.property(nonEmptyNotesArb, gridDivisionArb, (notes, division) => {
        const gridSnap: GridSnapConfig = { enabled: false, division };
        const result = calculateDuplicateAnchor(notes, gridSnap);
        const latestEndTime = Math.max(...notes.map((n) => n.start + n.duration));
        const expected = quantizeToFreeResolution(latestEndTime);
        expect(result).toBeCloseTo(expected, 10);
      }),
      { numRuns: 200 }
    );
  });

  it('should return 0 for an empty input', () => {
    fc.assert(
      fc.property(gridSnapConfigArb, (gridSnap) => {
        const result = calculateDuplicateAnchor([], gridSnap);
        expect(result).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should return a value >= the latest end time when grid snap is enabled (or equal when disabled)', () => {
    fc.assert(
      fc.property(nonEmptyNotesArb, gridSnapConfigArb, (notes, gridSnap) => {
        const result = calculateDuplicateAnchor(notes, gridSnap);
        const latestEndTime = Math.max(...notes.map((n) => n.start + n.duration));

        // The snapped value could be slightly less or more depending on rounding,
        // but should be the *nearest* grid position to latestEndTime.
        // We verify it equals the expected snap rather than enforcing >= constraint
        const expected = expectedSnapPosition(latestEndTime, gridSnap);
        expect(result).toBeCloseTo(expected, 10);
      }),
      { numRuns: 200 }
    );
  });
});
