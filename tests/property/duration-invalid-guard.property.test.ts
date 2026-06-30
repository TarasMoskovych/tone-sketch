import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatDuration } from '../../utils/duration';

// Feature: homepage-visualizer, Property 3: Invalid Duration Guard
/**
 * Property 3: Invalid Duration Guard
 *
 * *For any* value that is undefined, null, negative, or zero, the `formatDuration`
 * function SHALL return the string "0:00", regardless of the value's magnitude or type.
 *
 * **Validates: Requirements 2.6**
 */
describe('Property 3: Invalid Duration Guard', () => {
  describe('Negative numbers produce "0:00"', () => {
    it('should return "0:00" for any negative number', () => {
      fc.assert(
        fc.property(
          fc.double({ max: -Number.MIN_VALUE, noNaN: true }),
          (value) => {
            expect(formatDuration(value)).toBe('0:00');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return "0:00" for negative integers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1_000_000, max: -1 }),
          (value) => {
            expect(formatDuration(value)).toBe('0:00');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return "0:00" for -Infinity', () => {
      expect(formatDuration(-Infinity)).toBe('0:00');
    });
  });

  describe('Zero produces "0:00"', () => {
    it('should return "0:00" for zero', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should return "0:00" for negative zero', () => {
      expect(formatDuration(-0)).toBe('0:00');
    });
  });

  describe('Undefined and null produce "0:00"', () => {
    it('should return "0:00" for undefined', () => {
      expect(formatDuration(undefined)).toBe('0:00');
    });

    it('should return "0:00" for null', () => {
      expect(formatDuration(null)).toBe('0:00');
    });
  });

  describe('Combined invalid inputs via oneOf', () => {
    it('should return "0:00" for any invalid input (undefined, null, negative, or zero)', () => {
      const invalidInputArb = fc.oneof(
        fc.constant(undefined),
        fc.constant(null),
        fc.constant(0),
        fc.constant(-0),
        fc.constant(-Infinity),
        fc.double({ max: -Number.MIN_VALUE, noNaN: true }),
        fc.integer({ min: -1_000_000, max: -1 })
      );

      fc.assert(
        fc.property(invalidInputArb, (value) => {
          expect(formatDuration(value)).toBe('0:00');
        }),
        { numRuns: 100 }
      );
    });
  });
});
