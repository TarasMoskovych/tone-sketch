import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatDuration } from '@/utils/duration';

/**
 * Feature: homepage-visualizer, Property 2: Duration Formatting Decomposition
 *
 * *For any* non-negative number of seconds, the formatted duration string SHALL correctly
 * decompose the value into its hours, minutes, and seconds components such that parsing
 * the formatted string back yields the original floored-second value. Specifically:
 * - The seconds component (last two characters) equals Math.floor(totalSeconds) % 60
 * - The minutes component equals Math.floor(totalSeconds / 60) % 60
 * - The hours component (if present) equals Math.floor(totalSeconds / 3600)
 *
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
 */
describe('Property 2: Duration Formatting Decomposition', () => {
  /**
   * Helper to parse a formatted duration string back into its components.
   * Supports formats: "M:SS", "H:MM:SS"
   */
  function parseDuration(formatted: string): { hours: number; minutes: number; seconds: number } {
    const parts = formatted.split(':');
    if (parts.length === 3) {
      return {
        hours: parseInt(parts[0], 10),
        minutes: parseInt(parts[1], 10),
        seconds: parseInt(parts[2], 10),
      };
    }
    return {
      hours: 0,
      minutes: parseInt(parts[0], 10),
      seconds: parseInt(parts[1], 10),
    };
  }

  it('should decompose seconds component correctly (last two characters equal Math.floor(totalSeconds) % 60)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 100000, noNaN: true }),
        (durationSeconds) => {
          const formatted = formatDuration(durationSeconds);
          const parsed = parseDuration(formatted);
          const expectedSeconds = Math.floor(durationSeconds) % 60;
          expect(parsed.seconds).toBe(expectedSeconds);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should decompose minutes component correctly (equals Math.floor(totalSeconds / 60) % 60)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 100000, noNaN: true }),
        (durationSeconds) => {
          const formatted = formatDuration(durationSeconds);
          const parsed = parseDuration(formatted);
          const expectedMinutes = Math.floor(durationSeconds / 60) % 60;
          expect(parsed.minutes).toBe(expectedMinutes);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should decompose hours component correctly when present (equals Math.floor(totalSeconds / 3600))', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 3600, max: 100000, noNaN: true }),
        (durationSeconds) => {
          const formatted = formatDuration(durationSeconds);
          const parsed = parseDuration(formatted);
          const expectedHours = Math.floor(durationSeconds / 3600);
          expect(parsed.hours).toBe(expectedHours);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce zero hours component when duration is less than 3600 seconds', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 3599.999, noNaN: true }),
        (durationSeconds) => {
          const formatted = formatDuration(durationSeconds);
          const parts = formatted.split(':');
          // Format should be "M:SS" (2 parts), not "H:MM:SS" (3 parts)
          expect(parts.length).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reconstruct the floored-second value from parsed components', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 100000, noNaN: true }),
        (durationSeconds) => {
          const formatted = formatDuration(durationSeconds);
          const parsed = parseDuration(formatted);
          const reconstructed = parsed.hours * 3600 + parsed.minutes * 60 + parsed.seconds;
          const expectedTotal = Math.floor(durationSeconds);
          expect(reconstructed).toBe(expectedTotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should zero-pad seconds component to two digits', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 100000, noNaN: true }),
        (durationSeconds) => {
          const formatted = formatDuration(durationSeconds);
          const parts = formatted.split(':');
          const secondsPart = parts[parts.length - 1];
          expect(secondsPart.length).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should zero-pad minutes component to two digits in H:MM:SS format', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 3600, max: 100000, noNaN: true }),
        (durationSeconds) => {
          const formatted = formatDuration(durationSeconds);
          const parts = formatted.split(':');
          expect(parts.length).toBe(3);
          const minutesPart = parts[1];
          expect(minutesPart.length).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
