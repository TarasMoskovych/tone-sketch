import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  snapToGrid,
  snapToFreePosition,
  getMinimumDuration,
  enforceMinimumDuration,
  GRID_DIVISIONS,
  FREE_POSITION_RESOLUTION,
  MIN_DURATION_SNAP_DISABLED,
} from '../../utils/grid-snap';
import type { GridDivision, GridSnapConfig } from '../../types/grid';

/**
 * Feature: tone-sketch, Property 3: Grid Snap Quantization
 *
 * *For any* position value P and grid division D (where D ∈ {1, 0.5, 0.25, 0.125, 0.0625}),
 * when grid snap is enabled, the snapped position SHALL equal `round(P / D) * D`.
 *
 * **Validates: Requirements 2.3, 3.2, 5.2, 7.4**
 */
describe('Property 3: Grid Snap Quantization', () => {
  // Arbitrary for grid divisions
  const gridDivisionArb = fc.constantFrom(...GRID_DIVISIONS) as fc.Arbitrary<GridDivision>;

  // Arbitrary for reasonable position values (beats can be 0-10000 per validation constraints)
  const positionArb = fc.double({ min: -100, max: 10000, noNaN: true, noDefaultInfinity: true });

  it('snapped position should equal round(P / D) * D for all valid positions and divisions', () => {
    fc.assert(
      fc.property(positionArb, gridDivisionArb, (position, division) => {
        const snappedPosition = snapToGrid(position, division);
        const expectedPosition = Math.round(position / division) * division;

        // Handle -0 normalization
        const normalizedExpected = expectedPosition === 0 ? 0 : expectedPosition;

        expect(snappedPosition).toBeCloseTo(normalizedExpected, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('snapped position should always be a multiple of the grid division', () => {
    fc.assert(
      fc.property(positionArb, gridDivisionArb, (position, division) => {
        const snappedPosition = snapToGrid(position, division);

        // The snapped position divided by division should be an integer (or very close to one)
        const quotient = snappedPosition / division;
        const isMultiple = Math.abs(quotient - Math.round(quotient)) < 1e-10;

        expect(isMultiple).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('snapped position should be within half a division from the original position', () => {
    fc.assert(
      fc.property(positionArb, gridDivisionArb, (position, division) => {
        const snappedPosition = snapToGrid(position, division);
        const difference = Math.abs(snappedPosition - position);

        // The snapped position should be at most half a division away from the original
        expect(difference).toBeLessThanOrEqual(division / 2 + 1e-10);
      }),
      { numRuns: 100 }
    );
  });

  it('snapping an already-snapped position should return the same value (idempotent)', () => {
    fc.assert(
      fc.property(positionArb, gridDivisionArb, (position, division) => {
        const snappedOnce = snapToGrid(position, division);
        const snappedTwice = snapToGrid(snappedOnce, division);

        expect(snappedTwice).toBeCloseTo(snappedOnce, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle exact grid positions correctly (no change)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 1000 }),
        gridDivisionArb,
        (multiplier, division) => {
          const exactPosition = multiplier * division;
          const snappedPosition = snapToGrid(exactPosition, division);

          expect(snappedPosition).toBeCloseTo(exactPosition, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should work correctly for all supported grid divisions', () => {
    // Test each division explicitly
    for (const division of GRID_DIVISIONS) {
      fc.assert(
        fc.property(positionArb, (position) => {
          const snappedPosition = snapToGrid(position, division);
          const expectedPosition = Math.round(position / division) * division;
          const normalizedExpected = expectedPosition === 0 ? 0 : expectedPosition;

          expect(snappedPosition).toBeCloseTo(normalizedExpected, 10);
        }),
        { numRuns: 20 }
      );
    }
  });
});

/**
 * Feature: tone-sketch, Property 5: Minimum Duration Enforcement
 *
 * *For any* resize operation on a Note:
 * - When grid snap is enabled, the minimum duration SHALL be the current grid division
 * - When grid snap is disabled, the minimum duration SHALL be 0.1 beats
 *
 * **Validates: Requirements 5.3, 5.4**
 */
describe('Property 5: Minimum Duration Enforcement', () => {
  // Arbitrary for grid divisions
  const gridDivisionArb = fc.constantFrom(...GRID_DIVISIONS) as fc.Arbitrary<GridDivision>;

  // Arbitrary for duration values (including values below minimum)
  const durationArb = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for grid snap config
  const gridSnapConfigArb: fc.Arbitrary<GridSnapConfig> = fc.record({
    enabled: fc.boolean(),
    division: gridDivisionArb,
  });

  describe('getMinimumDuration', () => {
    it('when grid snap is enabled, minimum duration should equal the current grid division', () => {
      fc.assert(
        fc.property(gridDivisionArb, (division) => {
          const config: GridSnapConfig = { enabled: true, division };
          const minDuration = getMinimumDuration(config);

          expect(minDuration).toBe(division);
        }),
        { numRuns: 100 }
      );
    });

    it('when grid snap is disabled, minimum duration should be 0.1 beats regardless of division setting', () => {
      fc.assert(
        fc.property(gridDivisionArb, (division) => {
          const config: GridSnapConfig = { enabled: false, division };
          const minDuration = getMinimumDuration(config);

          expect(minDuration).toBe(MIN_DURATION_SNAP_DISABLED);
          expect(minDuration).toBe(0.1);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('enforceMinimumDuration', () => {
    it('should return at least the minimum duration for any input', () => {
      fc.assert(
        fc.property(durationArb, gridSnapConfigArb, (duration, config) => {
          const enforcedDuration = enforceMinimumDuration(duration, config);
          const minDuration = getMinimumDuration(config);

          expect(enforcedDuration).toBeGreaterThanOrEqual(minDuration);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve durations that already meet or exceed the minimum', () => {
      fc.assert(
        fc.property(gridSnapConfigArb, (config) => {
          const minDuration = getMinimumDuration(config);
          // Generate durations >= minimum
          fc.assert(
            fc.property(
              fc.double({ min: minDuration, max: 100, noNaN: true, noDefaultInfinity: true }),
              (duration) => {
                const enforcedDuration = enforceMinimumDuration(duration, config);
                expect(enforcedDuration).toBe(duration);
              }
            ),
            { numRuns: 20 }
          );
        }),
        { numRuns: 10 }
      );
    });

    it('should increase durations that are below the minimum to exactly the minimum', () => {
      fc.assert(
        fc.property(gridDivisionArb, (division) => {
          const config: GridSnapConfig = { enabled: true, division };
          const belowMinDuration = division / 2;
          const enforcedDuration = enforceMinimumDuration(belowMinDuration, config);

          expect(enforcedDuration).toBe(division);
        }),
        { numRuns: 100 }
      );
    });

    it('when snap enabled, durations below grid division should be raised to grid division', () => {
      fc.assert(
        fc.property(gridDivisionArb, (division) => {
          const config: GridSnapConfig = { enabled: true, division };
          // Test with various small durations
          fc.assert(
            fc.property(
              fc.double({ min: 0, max: division - 0.0001, noNaN: true, noDefaultInfinity: true }),
              (smallDuration) => {
                const enforcedDuration = enforceMinimumDuration(smallDuration, config);
                expect(enforcedDuration).toBe(division);
              }
            ),
            { numRuns: 20 }
          );
        }),
        { numRuns: 10 }
      );
    });

    it('when snap disabled, durations below 0.1 should be raised to 0.1', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 0.09999, noNaN: true, noDefaultInfinity: true }),
          gridDivisionArb,
          (smallDuration, division) => {
            const config: GridSnapConfig = { enabled: false, division };
            const enforcedDuration = enforceMinimumDuration(smallDuration, config);

            expect(enforcedDuration).toBe(0.1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('zero duration should be raised to minimum', () => {
      fc.assert(
        fc.property(gridSnapConfigArb, (config) => {
          const enforcedDuration = enforceMinimumDuration(0, config);
          const minDuration = getMinimumDuration(config);

          expect(enforcedDuration).toBe(minDuration);
        }),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Feature: tone-sketch, Property 8: Free Positioning Resolution
 *
 * *For any* note position when grid snap is disabled, the position SHALL be quantized
 * to 1/32 beat resolution (0.03125 beats).
 *
 * **Validates: Requirements 7.5**
 */
describe('Property 8: Free Positioning Resolution', () => {
  // Arbitrary for reasonable position values
  const positionArb = fc.double({ min: -100, max: 10000, noNaN: true, noDefaultInfinity: true });

  it('free position should be quantized to 1/32 beat resolution (0.03125 beats)', () => {
    fc.assert(
      fc.property(positionArb, (position) => {
        const snappedPosition = snapToFreePosition(position);

        // The position should be a multiple of 1/32 beat (0.03125)
        const quotient = snappedPosition / FREE_POSITION_RESOLUTION;
        const isMultiple = Math.abs(quotient - Math.round(quotient)) < 1e-10;

        expect(isMultiple).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('free position quantization should equal round(P / 0.03125) * 0.03125', () => {
    fc.assert(
      fc.property(positionArb, (position) => {
        const snappedPosition = snapToFreePosition(position);
        const expectedPosition = Math.round(position / FREE_POSITION_RESOLUTION) * FREE_POSITION_RESOLUTION;

        // Handle -0 normalization
        const normalizedExpected = expectedPosition === 0 ? 0 : expectedPosition;

        expect(snappedPosition).toBeCloseTo(normalizedExpected, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('snapped position should be within half of 1/32 beat from the original position', () => {
    fc.assert(
      fc.property(positionArb, (position) => {
        const snappedPosition = snapToFreePosition(position);
        const difference = Math.abs(snappedPosition - position);

        // The snapped position should be at most half of 1/32 beat away
        expect(difference).toBeLessThanOrEqual(FREE_POSITION_RESOLUTION / 2 + 1e-10);
      }),
      { numRuns: 100 }
    );
  });

  it('snapping an already-quantized position should return the same value (idempotent)', () => {
    fc.assert(
      fc.property(positionArb, (position) => {
        const snappedOnce = snapToFreePosition(position);
        const snappedTwice = snapToFreePosition(snappedOnce);

        expect(snappedTwice).toBeCloseTo(snappedOnce, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle exact 1/32 beat multiples correctly (no change)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -3200, max: 320000 }), (multiplier) => {
        const exactPosition = multiplier * FREE_POSITION_RESOLUTION;
        const snappedPosition = snapToFreePosition(exactPosition);

        expect(snappedPosition).toBeCloseTo(exactPosition, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('FREE_POSITION_RESOLUTION constant should equal 1/32 beat (0.03125)', () => {
    expect(FREE_POSITION_RESOLUTION).toBe(0.03125);
    expect(FREE_POSITION_RESOLUTION).toBe(1 / 32);
  });

  it('free positioning provides finer resolution than all grid snap divisions', () => {
    // Free positioning (1/32 = 0.03125) should be finer than the smallest grid division (1/16 = 0.0625)
    for (const division of GRID_DIVISIONS) {
      expect(FREE_POSITION_RESOLUTION).toBeLessThan(division);
    }
  });

  it('free positioning resolution should be exactly half of the finest grid division', () => {
    // 1/32 = 0.03125 is half of 1/16 = 0.0625
    const finestGridDivision = Math.min(...GRID_DIVISIONS);
    expect(FREE_POSITION_RESOLUTION).toBe(finestGridDivision / 2);
  });
});
