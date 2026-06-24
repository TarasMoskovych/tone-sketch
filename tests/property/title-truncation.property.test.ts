import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { truncateTitle, DEFAULT_MAX_TITLE_LENGTH, ELLIPSIS } from '../../utils/text';

// Feature: tone-sketch, Property 18: Title Truncation in Feed
/**
 * Property 18: Title Truncation in Feed
 *
 * *For any* melody title displayed in the feed:
 * - If length > 100 characters, display SHALL show first 100 characters followed by ellipsis ("...")
 * - If length ≤ 100 characters, display SHALL show the complete title
 *
 * **Validates: Requirements 22.2**
 */
describe('Property 18: Title Truncation in Feed', () => {
  const maxLength = DEFAULT_MAX_TITLE_LENGTH; // 100 characters

  // Arbitrary for short titles (within limit)
  const shortTitleArb = fc.string({ minLength: 0, maxLength });

  // Arbitrary for long titles (exceeding limit)
  const longTitleArb = fc.string({ minLength: maxLength + 1, maxLength: 1000 });

  // Arbitrary for titles of any length
  const anyTitleArb = fc.string({ minLength: 0, maxLength: 1000 });

  describe('Titles within the limit (≤100 characters)', () => {
    it('should display the complete title without truncation', () => {
      fc.assert(
        fc.property(shortTitleArb, (title) => {
          const result = truncateTitle(title);

          // The result should be exactly the original title
          expect(result).toBe(title);

          // The result should not contain the ellipsis suffix (unless it was in the original)
          if (!title.endsWith(ELLIPSIS)) {
            expect(result.endsWith(ELLIPSIS)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve the exact length of short titles', () => {
      fc.assert(
        fc.property(shortTitleArb, (title) => {
          const result = truncateTitle(title);
          expect(result.length).toBe(title.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Titles exceeding the limit (>100 characters)', () => {
    it('should truncate and show first 100 characters followed by ellipsis', () => {
      fc.assert(
        fc.property(longTitleArb, (title) => {
          const result = truncateTitle(title);

          // The result should end with the ellipsis
          expect(result.endsWith(ELLIPSIS)).toBe(true);

          // The result should have length of maxLength + ellipsis length
          expect(result.length).toBe(maxLength + ELLIPSIS.length);

          // The result (without ellipsis) should match the first maxLength chars of original
          const truncatedPart = result.slice(0, -ELLIPSIS.length);
          expect(truncatedPart).toBe(title.slice(0, maxLength));
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve the first 100 characters exactly', () => {
      fc.assert(
        fc.property(longTitleArb, (title) => {
          const result = truncateTitle(title);
          const first100Chars = title.slice(0, maxLength);

          // The result should start with the first 100 characters
          expect(result.startsWith(first100Chars)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should always add ellipsis for long titles', () => {
      fc.assert(
        fc.property(longTitleArb, (title) => {
          const result = truncateTitle(title);

          // Must end with ellipsis
          expect(result.endsWith(ELLIPSIS)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Boundary cases', () => {
    it('should not truncate title of exactly 100 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: maxLength, maxLength }),
          (title) => {
            const result = truncateTitle(title);

            // Title of exactly 100 chars should not be truncated
            expect(result).toBe(title);
            expect(result.length).toBe(maxLength);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should truncate title of exactly 101 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: maxLength + 1, maxLength: maxLength + 1 }),
          (title) => {
            const result = truncateTitle(title);

            // Title of exactly 101 chars should be truncated
            expect(result.length).toBe(maxLength + ELLIPSIS.length);
            expect(result.endsWith(ELLIPSIS)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty string', () => {
      const result = truncateTitle('');
      expect(result).toBe('');
    });

    it('should handle single character', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 1 }), (title) => {
          const result = truncateTitle(title);
          expect(result).toBe(title);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Unicode and special characters', () => {
    it('should handle Unicode characters correctly', () => {
      // Using fc.string which generates various unicode characters
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 500, unit: 'grapheme' }), (title) => {
          const result = truncateTitle(title);

          if (title.length <= maxLength) {
            expect(result).toBe(title);
          } else {
            expect(result.length).toBe(maxLength + ELLIPSIS.length);
            expect(result.endsWith(ELLIPSIS)).toBe(true);
            expect(result.slice(0, maxLength)).toBe(title.slice(0, maxLength));
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle strings with emoji', () => {
      // Create a long string with emoji
      const emojiTitle = '🎵'.repeat(60); // Each emoji is 2 characters (in JS string length)
      const result = truncateTitle(emojiTitle);

      if (emojiTitle.length <= maxLength) {
        expect(result).toBe(emojiTitle);
      } else {
        expect(result.length).toBe(maxLength + ELLIPSIS.length);
        expect(result.endsWith(ELLIPSIS)).toBe(true);
      }
    });

    it('should handle strings with newlines and tabs', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[\s\S]{0,500}$/),
          (title) => {
            const result = truncateTitle(title);

            if (title.length <= maxLength) {
              expect(result).toBe(title);
            } else {
              expect(result.length).toBe(maxLength + ELLIPSIS.length);
              expect(result.endsWith(ELLIPSIS)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Custom maxLength parameter', () => {
    it('should respect custom maxLength values', () => {
      fc.assert(
        fc.property(
          anyTitleArb,
          fc.integer({ min: 1, max: 500 }),
          (title, customMaxLength) => {
            const result = truncateTitle(title, customMaxLength);

            if (title.length <= customMaxLength) {
              expect(result).toBe(title);
            } else {
              expect(result.length).toBe(customMaxLength + ELLIPSIS.length);
              expect(result.endsWith(ELLIPSIS)).toBe(true);
              expect(result.slice(0, customMaxLength)).toBe(title.slice(0, customMaxLength));
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle maxLength of 0', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (title) => {
            const result = truncateTitle(title, 0);

            // With maxLength 0, any non-empty string should be truncated to just ellipsis
            expect(result).toBe(ELLIPSIS);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle maxLength of 1', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 100 }),
          (title) => {
            const result = truncateTitle(title, 1);

            // With maxLength 1, strings longer than 1 should be truncated
            expect(result).toBe(title.charAt(0) + ELLIPSIS);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariants', () => {
    it('truncated title should always be <= maxLength + ellipsis.length', () => {
      fc.assert(
        fc.property(anyTitleArb, (title) => {
          const result = truncateTitle(title);

          // Result should never exceed maxLength + 3 (for "...")
          expect(result.length).toBeLessThanOrEqual(maxLength + ELLIPSIS.length);
        }),
        { numRuns: 100 }
      );
    });

    it('truncation should be deterministic', () => {
      fc.assert(
        fc.property(anyTitleArb, (title) => {
          const result1 = truncateTitle(title);
          const result2 = truncateTitle(title);

          // Same input should always produce same output
          expect(result1).toBe(result2);
        }),
        { numRuns: 100 }
      );
    });

    it('result should always be a string', () => {
      fc.assert(
        fc.property(anyTitleArb, (title) => {
          const result = truncateTitle(title);
          expect(typeof result).toBe('string');
        }),
        { numRuns: 100 }
      );
    });

    it('short titles are preserved exactly (identity property)', () => {
      fc.assert(
        fc.property(shortTitleArb, (title) => {
          const result = truncateTitle(title);

          // For titles within limit, truncation is identity function
          expect(result).toBe(title);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Very long titles', () => {
    it('should handle very long titles correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: maxLength + 1, maxLength: 10000 }),
          (title) => {
            const result = truncateTitle(title);

            expect(result.length).toBe(maxLength + ELLIPSIS.length);
            expect(result.endsWith(ELLIPSIS)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should truncate consistently regardless of how much longer the title is', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: maxLength, maxLength }),
          fc.string({ minLength: 1, maxLength: 5000 }),
          (prefix, suffix) => {
            const shortTitle = prefix;
            const longTitle = prefix + suffix;

            const shortResult = truncateTitle(shortTitle);
            const longResult = truncateTitle(longTitle);

            // Both should start with the same prefix (up to maxLength)
            if (shortTitle.length <= maxLength && longTitle.length > maxLength) {
              const longTruncatedPart = longResult.slice(0, -ELLIPSIS.length);
              expect(shortResult.startsWith(longTruncatedPart)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
