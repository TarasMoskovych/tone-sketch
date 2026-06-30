import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateBarHeight } from '@/components/AudioVisualizer';

/**
 * Feature: homepage-visualizer, Property 4: Bar Height Proportional Scaling
 *
 * *For any* frequency amplitude value in the range [0, 255] and *for any*
 * visualizer height in the range [32, 48] pixels, the rendered bar height
 * SHALL equal `(amplitude / 255) * visualizerHeight`, where amplitude 0
 * produces height 0 and amplitude 255 produces full visualizer height.
 *
 * **Validates: Requirements 3.7, 3.8**
 */
describe('Property 4: Bar Height Proportional Scaling', () => {
  // Arbitrary for amplitude values in [0, 255]
  const amplitudeArb: fc.Arbitrary<number> = fc.double({ min: 0, max: 255, noNaN: true });

  // Arbitrary for visualizer height in [32, 48] pixels
  const heightArb: fc.Arbitrary<number> = fc.double({ min: 32, max: 48, noNaN: true });

  it('should compute bar height equal to (amplitude / 255) * canvasHeight', () => {
    fc.assert(
      fc.property(amplitudeArb, heightArb, (amplitude, canvasHeight) => {
        const result = calculateBarHeight(amplitude, canvasHeight);
        const expected = (amplitude / 255) * canvasHeight;
        expect(result).toBeCloseTo(expected, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('should return 0 when amplitude is 0', () => {
    fc.assert(
      fc.property(heightArb, (canvasHeight) => {
        const result = calculateBarHeight(0, canvasHeight);
        expect(result).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should return full canvasHeight when amplitude is 255', () => {
    fc.assert(
      fc.property(heightArb, (canvasHeight) => {
        const result = calculateBarHeight(255, canvasHeight);
        expect(result).toBe(canvasHeight);
      }),
      { numRuns: 100 }
    );
  });

  it('should always return a value between 0 and canvasHeight (inclusive)', () => {
    fc.assert(
      fc.property(amplitudeArb, heightArb, (amplitude, canvasHeight) => {
        const result = calculateBarHeight(amplitude, canvasHeight);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(canvasHeight);
      }),
      { numRuns: 100 }
    );
  });
});
