import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateScrollbarState } from '@/components/PianoRoll/coordinate-utils';
import type { VisibleRegion } from '@/types/grid';

/**
 * Feature: piano-roll-refactor, Property 2: Scrollbar State Bounds Invariant
 *
 * *For any* visible region with valid bounds (startBeat ≥ 0, 0 ≤ startPitch < endPitch ≤ 128),
 * the calculated scrollbar state shall have:
 * - horizontalPosition in range [0, 1]
 * - verticalPosition in range [0, 1]
 * - horizontalThumbSize in range (0, 1]
 * - verticalThumbSize in range (0, 1]
 * - thumbSize shall be proportional to (visible range / total range)
 *
 * **Validates: Requirements 4.4**
 */
describe('Property 2: Scrollbar State Bounds Invariant', () => {
  // Generate valid visible regions
  const visibleRegionArb: fc.Arbitrary<VisibleRegion> = fc.record({
    startBeat: fc.float({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
    endBeat: fc.float({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
    startPitch: fc.integer({ min: 0, max: 126 }),
    endPitch: fc.integer({ min: 1, max: 128 }),
  }).filter((region) => {
    // Ensure valid ranges
    return (
      region.endBeat > region.startBeat &&
      region.endPitch > region.startPitch
    );
  });

  // Generate valid total beats (must be >= visible beats)
  const totalBeatsArb = fc.float({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true });

  // Total pitch range is typically 128 (MIDI 0-127)
  const totalPitchRangeArb = fc.integer({ min: 1, max: 128 });

  describe('horizontalPosition bounds', () => {
    it('horizontalPosition should always be in range [0, 1]', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          totalBeatsArb,
          totalPitchRangeArb,
          (visibleRegion, totalBeats, totalPitchRange) => {
            // Ensure totalBeats >= visibleBeats for a valid scenario
            const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
            const effectiveTotalBeats = Math.max(totalBeats, visibleBeats);

            const state = calculateScrollbarState(visibleRegion, effectiveTotalBeats, totalPitchRange);

            expect(state.horizontalPosition).toBeGreaterThanOrEqual(0);
            expect(state.horizontalPosition).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('verticalPosition bounds', () => {
    it('verticalPosition should always be in range [0, 1]', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          totalBeatsArb,
          totalPitchRangeArb,
          (visibleRegion, totalBeats, totalPitchRange) => {
            // Ensure totalPitchRange >= visiblePitches
            const visiblePitches = visibleRegion.endPitch - visibleRegion.startPitch;
            const effectiveTotalPitchRange = Math.max(totalPitchRange, visiblePitches);
            const effectiveTotalBeats = Math.max(totalBeats, visibleRegion.endBeat - visibleRegion.startBeat);

            const state = calculateScrollbarState(visibleRegion, effectiveTotalBeats, effectiveTotalPitchRange);

            expect(state.verticalPosition).toBeGreaterThanOrEqual(0);
            expect(state.verticalPosition).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('horizontalThumbSize bounds', () => {
    it('horizontalThumbSize should always be in range (0, 1]', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          totalBeatsArb,
          (visibleRegion, totalBeats) => {
            const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
            const effectiveTotalBeats = Math.max(totalBeats, visibleBeats);

            const state = calculateScrollbarState(visibleRegion, effectiveTotalBeats, 128);

            expect(state.horizontalThumbSize).toBeGreaterThan(0);
            expect(state.horizontalThumbSize).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('verticalThumbSize bounds', () => {
    it('verticalThumbSize should always be in range (0, 1]', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          totalPitchRangeArb,
          (visibleRegion, totalPitchRange) => {
            const visiblePitches = visibleRegion.endPitch - visibleRegion.startPitch;
            const effectiveTotalPitchRange = Math.max(totalPitchRange, visiblePitches);

            const state = calculateScrollbarState(visibleRegion, 64, effectiveTotalPitchRange);

            expect(state.verticalThumbSize).toBeGreaterThan(0);
            expect(state.verticalThumbSize).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('thumbSize proportionality', () => {
    it('horizontalThumbSize should be proportional to visibleBeats/totalBeats', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          totalBeatsArb,
          (visibleRegion, totalBeats) => {
            const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
            const effectiveTotalBeats = Math.max(totalBeats, visibleBeats);

            const state = calculateScrollbarState(visibleRegion, effectiveTotalBeats, 128);

            // thumbSize = min(1, visibleBeats / totalBeats)
            const expectedThumbSize = Math.min(1, visibleBeats / effectiveTotalBeats);

            expect(state.horizontalThumbSize).toBeCloseTo(expectedThumbSize, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('verticalThumbSize should be proportional to visiblePitches/totalPitchRange', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          totalPitchRangeArb,
          (visibleRegion, totalPitchRange) => {
            const visiblePitches = visibleRegion.endPitch - visibleRegion.startPitch;
            const effectiveTotalPitchRange = Math.max(totalPitchRange, visiblePitches);

            const state = calculateScrollbarState(visibleRegion, 64, effectiveTotalPitchRange);

            // thumbSize = min(1, visiblePitches / totalPitchRange)
            const expectedThumbSize = Math.min(1, visiblePitches / effectiveTotalPitchRange);

            expect(state.verticalThumbSize).toBeCloseTo(expectedThumbSize, 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('edge cases', () => {
    it('when visible range equals total range, thumbSize should be 1', () => {
      const visibleRegion: VisibleRegion = {
        startBeat: 0,
        endBeat: 64,
        startPitch: 0,
        endPitch: 128,
      };

      const state = calculateScrollbarState(visibleRegion, 64, 128);

      expect(state.horizontalThumbSize).toBe(1);
      expect(state.verticalThumbSize).toBe(1);
    });

    it('when visible range is half of total range, thumbSize should be 0.5', () => {
      const visibleRegion: VisibleRegion = {
        startBeat: 0,
        endBeat: 32,
        startPitch: 0,
        endPitch: 64,
      };

      const state = calculateScrollbarState(visibleRegion, 64, 128);

      expect(state.horizontalThumbSize).toBeCloseTo(0.5, 10);
      expect(state.verticalThumbSize).toBeCloseTo(0.5, 10);
    });

    it('when at start position (startBeat=0, startPitch=0), positions should be 0 or 1 depending on scrollbar direction', () => {
      const visibleRegion: VisibleRegion = {
        startBeat: 0,
        endBeat: 16,
        startPitch: 0,
        endPitch: 24,
      };

      const state = calculateScrollbarState(visibleRegion, 64, 128);

      // horizontalPosition=0 means scrollbar thumb is at the left (start of timeline)
      expect(state.horizontalPosition).toBe(0);
      // verticalPosition=1 means scrollbar thumb is at the bottom (startPitch=0 is the lowest)
      expect(state.verticalPosition).toBe(1);
    });

    it('position should reflect scroll location within available range', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 48, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 0, max: 104 }),
          (startBeat, startPitch) => {
            const visibleBeats = 16;
            const visiblePitches = 24;
            const totalBeats = 64;
            const totalPitchRange = 128;

            // Constrain to valid range
            const clampedStartBeat = Math.min(startBeat, totalBeats - visibleBeats);
            const clampedStartPitch = Math.min(startPitch, totalPitchRange - visiblePitches);

            const visibleRegion: VisibleRegion = {
              startBeat: clampedStartBeat,
              endBeat: clampedStartBeat + visibleBeats,
              startPitch: clampedStartPitch,
              endPitch: clampedStartPitch + visiblePitches,
            };

            const state = calculateScrollbarState(visibleRegion, totalBeats, totalPitchRange);

            // All position values should be in [0, 1] range
            expect(state.horizontalPosition).toBeGreaterThanOrEqual(0);
            expect(state.horizontalPosition).toBeLessThanOrEqual(1);
            expect(state.verticalPosition).toBeGreaterThanOrEqual(0);
            expect(state.verticalPosition).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('scrollbar state consistency', () => {
    it('all scrollbar state values should be finite numbers', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          totalBeatsArb,
          totalPitchRangeArb,
          (visibleRegion, totalBeats, totalPitchRange) => {
            const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
            const visiblePitches = visibleRegion.endPitch - visibleRegion.startPitch;
            const effectiveTotalBeats = Math.max(totalBeats, visibleBeats);
            const effectiveTotalPitchRange = Math.max(totalPitchRange, visiblePitches);

            const state = calculateScrollbarState(visibleRegion, effectiveTotalBeats, effectiveTotalPitchRange);

            expect(Number.isFinite(state.horizontalPosition)).toBe(true);
            expect(Number.isFinite(state.verticalPosition)).toBe(true);
            expect(Number.isFinite(state.horizontalThumbSize)).toBe(true);
            expect(Number.isFinite(state.verticalThumbSize)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
