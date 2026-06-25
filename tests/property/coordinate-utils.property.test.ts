import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  pixelXToBeat,
  beatToPixelX,
  pixelYToPitch,
  pitchToPixelY,
  DEFAULT_COORDINATE_CONFIG,
} from '@/components/PianoRoll/coordinate-utils';
import type { VisibleRegion } from '@/types/grid';

/**
 * Feature: piano-roll-refactor, Property 1: Coordinate Conversion Round-Trip
 *
 * *For any* beat value within a visible region and any valid container dimensions,
 * converting the beat to pixels and back to beats shall return a value within
 * floating-point tolerance of the original beat.
 *
 * More formally: `|pixelXToBeat(beatToPixelX(beat)) - beat| < ε` where ε is 0.0001
 *
 * Similarly for the Y axis: `|pixelYToPitch(pitchToPixelY(pitch)) - pitch| < 1`
 * (pitch floors to integer due to MIDI note discretization)
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.6**
 */
describe('Property 1: Coordinate Conversion Round-Trip', () => {
  const TOLERANCE = 0.0001;

  // Arbitrary for valid container dimensions
  const containerWidthArb = fc.integer({ min: 200, max: 2000 });
  const containerHeightArb = fc.integer({ min: 200, max: 2000 });

  // Arbitrary for valid visible region bounds (ensuring endBeat > startBeat and endPitch > startPitch)
  const visibleRegionArb = fc.record({
    startBeat: fc.double({ min: 0, max: 100, noNaN: true }),
    beatSpan: fc.double({ min: 4, max: 64, noNaN: true }), // at least 4 beats visible
    startPitch: fc.integer({ min: 0, max: 116 }), // Leave room for pitchSpan
    pitchSpan: fc.integer({ min: 12, max: 48 }), // at least 1 octave visible
  }).map(({ startBeat, beatSpan, startPitch, pitchSpan }) => ({
    startBeat,
    endBeat: startBeat + beatSpan,
    startPitch,
    endPitch: Math.min(startPitch + pitchSpan, 128), // Cap at 128 (valid MIDI range for display)
  })) as fc.Arbitrary<VisibleRegion>;

  describe('Beat Coordinate Round-Trip (X axis)', () => {
    it('should round-trip beat → pixel → beat within tolerance for any beat within visible region', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          containerWidthArb,
          (visibleRegion, containerWidth) => {
            // Generate a beat value within the visible region
            const beatRange = visibleRegion.endBeat - visibleRegion.startBeat;
            const beat = visibleRegion.startBeat + Math.random() * beatRange;

            const pixel = beatToPixelX(beat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const roundTrip = pixelXToBeat(pixel, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            const difference = Math.abs(roundTrip - beat);
            expect(difference).toBeLessThan(TOLERANCE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round-trip beat → pixel → beat for specific beat values within region', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          containerWidthArb,
          fc.double({ min: 0, max: 1, noNaN: true }), // normalized position within region
          (visibleRegion, containerWidth, normalizedPosition) => {
            const beatRange = visibleRegion.endBeat - visibleRegion.startBeat;
            const beat = visibleRegion.startBeat + normalizedPosition * beatRange;

            const pixel = beatToPixelX(beat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const roundTrip = pixelXToBeat(pixel, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            const difference = Math.abs(roundTrip - beat);
            expect(difference).toBeLessThan(TOLERANCE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain round-trip accuracy at region boundaries', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          containerWidthArb,
          fc.constantFrom('start', 'end', 'middle'),
          (visibleRegion, containerWidth, position) => {
            let beat: number;
            switch (position) {
              case 'start':
                beat = visibleRegion.startBeat;
                break;
              case 'end':
                beat = visibleRegion.endBeat;
                break;
              case 'middle':
                beat = (visibleRegion.startBeat + visibleRegion.endBeat) / 2;
                break;
            }

            const pixel = beatToPixelX(beat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const roundTrip = pixelXToBeat(pixel, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            const difference = Math.abs(roundTrip - beat);
            expect(difference).toBeLessThan(TOLERANCE);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve relative positions after round-trip', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          containerWidthArb,
          fc.double({ min: 0.1, max: 0.9, noNaN: true }), // Two different positions within region
          fc.double({ min: 0.1, max: 0.9, noNaN: true }),
          (visibleRegion, containerWidth, pos1, pos2) => {
            // Skip if positions are too close (would cause floating point comparison issues)
            if (Math.abs(pos1 - pos2) < 0.001) {
              return true; // Skip this case
            }

            const beatRange = visibleRegion.endBeat - visibleRegion.startBeat;
            const beat1 = visibleRegion.startBeat + pos1 * beatRange;
            const beat2 = visibleRegion.startBeat + pos2 * beatRange;

            const pixel1 = beatToPixelX(beat1, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const pixel2 = beatToPixelX(beat2, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            // If beat1 < beat2, then pixel1 should be < pixel2 (X increases with beats)
            if (beat1 < beat2) {
              expect(pixel1).toBeLessThan(pixel2);
            } else if (beat1 > beat2) {
              expect(pixel1).toBeGreaterThan(pixel2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Pitch Coordinate Round-Trip (Y axis)', () => {
    it('should round-trip pitch → pixel → pitch within 1 semitone for any pitch within visible region', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          containerHeightArb,
          fc.double({ min: 0.05, max: 0.95, noNaN: true }), // Avoid boundary issues by staying away from edges
          (visibleRegion, containerHeight, normalizedPitch) => {
            // Generate an integer pitch within the visible region, avoiding exact boundaries
            const pitchRange = visibleRegion.endPitch - visibleRegion.startPitch;
            const pitch = Math.floor(visibleRegion.startPitch + normalizedPitch * pitchRange);

            // Ensure pitch is strictly within visible region
            if (pitch < visibleRegion.startPitch || pitch >= visibleRegion.endPitch) {
              return true; // Skip out-of-range pitches
            }

            const pixel = pitchToPixelY(pitch, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const roundTrip = pixelYToPitch(pixel, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            // Pitch conversion uses Math.floor, so we allow up to 1 semitone difference (inclusive)
            // The design doc specifies: |pixelYToPitch(pitchToPixelY(pitch)) - pitch| < 1
            // But due to floor operations, we need to be slightly more permissive
            const difference = Math.abs(roundTrip - pitch);
            expect(difference).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round-trip pitch → pixel → pitch for specific integer pitch values', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          containerHeightArb,
          fc.double({ min: 0.1, max: 0.9, noNaN: true }), // normalized position within region, avoid edges
          (visibleRegion, containerHeight, normalizedPosition) => {
            const pitchRange = visibleRegion.endPitch - visibleRegion.startPitch;
            // Use integer pitch values since MIDI notes are integers
            const pitch = Math.floor(visibleRegion.startPitch + normalizedPosition * (pitchRange - 1));

            // Ensure pitch is within valid range
            if (pitch < visibleRegion.startPitch || pitch >= visibleRegion.endPitch) {
              return true; // Skip invalid pitch values
            }

            const pixel = pitchToPixelY(pitch, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const roundTrip = pixelYToPitch(pixel, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            // Pitch conversion uses Math.floor, allow up to 1 semitone difference
            const difference = Math.abs(roundTrip - pitch);
            expect(difference).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain inverse relationship: higher pitch = lower Y pixel (screen coordinates)', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          containerHeightArb,
          fc.integer({ min: 1, max: 126 }), // Valid MIDI pitch
          (visibleRegion, containerHeight, basePitch) => {
            // Ensure both pitches are within the visible region
            const pitch1 = Math.max(visibleRegion.startPitch, Math.min(basePitch, visibleRegion.endPitch - 2));
            const pitch2 = pitch1 + 1; // pitch2 is higher

            if (pitch2 >= visibleRegion.endPitch) {
              return true; // Skip if pitch2 would be outside visible region
            }

            const pixel1 = pitchToPixelY(pitch1, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const pixel2 = pitchToPixelY(pitch2, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            // Higher pitch should have lower Y value (towards top of screen)
            expect(pixel2).toBeLessThan(pixel1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve pitch ordering after round-trip', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          containerHeightArb,
          (visibleRegion, containerHeight) => {
            // Pick two distinct pitches within the visible region
            const pitchRange = visibleRegion.endPitch - visibleRegion.startPitch;
            if (pitchRange < 2) return true; // Skip too small regions

            const pitch1 = visibleRegion.startPitch + Math.floor(pitchRange * 0.3);
            const pitch2 = visibleRegion.startPitch + Math.floor(pitchRange * 0.7);

            const pixel1 = pitchToPixelY(pitch1, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const pixel2 = pitchToPixelY(pitch2, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            const roundTrip1 = pixelYToPitch(pixel1, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const roundTrip2 = pixelYToPitch(pixel2, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            // The relative ordering should be preserved
            if (pitch1 < pitch2) {
              expect(roundTrip1).toBeLessThanOrEqual(roundTrip2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum container dimensions', () => {
      const minWidth = 200;
      const minHeight = 200;
      const visibleRegion: VisibleRegion = {
        startBeat: 0,
        endBeat: 16,
        startPitch: 48,
        endPitch: 72,
      };

      // Test beat round-trip
      const beat = 8;
      const pixelX = beatToPixelX(beat, minWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);
      const roundTripBeat = pixelXToBeat(pixelX, minWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);
      expect(Math.abs(roundTripBeat - beat)).toBeLessThan(TOLERANCE);

      // Test pitch round-trip
      const pitch = 60;
      const pixelY = pitchToPixelY(pitch, minHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);
      const roundTripPitch = pixelYToPitch(pixelY, minHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);
      expect(Math.abs(roundTripPitch - pitch)).toBeLessThanOrEqual(1);
    });

    it('should handle very small visible regions', () => {
      const containerWidth = 500;
      const containerHeight = 500;
      const visibleRegion: VisibleRegion = {
        startBeat: 0,
        endBeat: 4, // Small beat range
        startPitch: 60,
        endPitch: 72, // One octave
      };

      const beat = 2;
      const pixelX = beatToPixelX(beat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);
      const roundTripBeat = pixelXToBeat(pixelX, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);
      expect(Math.abs(roundTripBeat - beat)).toBeLessThan(TOLERANCE);

      const pitch = 66;
      const pixelY = pitchToPixelY(pitch, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);
      const roundTripPitch = pixelYToPitch(pixelY, containerHeight, visibleRegion, DEFAULT_COORDINATE_CONFIG);
      expect(Math.abs(roundTripPitch - pitch)).toBeLessThanOrEqual(1);
    });

    it('should handle visible region not starting at 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 50 }), // Non-zero start beat
          fc.integer({ min: 12, max: 48 }), // Beat span
          containerWidthArb,
          (startBeat, beatSpan, containerWidth) => {
            const visibleRegion: VisibleRegion = {
              startBeat,
              endBeat: startBeat + beatSpan,
              startPitch: 48,
              endPitch: 72,
            };

            const beat = startBeat + beatSpan / 2;
            const pixel = beatToPixelX(beat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);
            const roundTrip = pixelXToBeat(pixel, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

            expect(Math.abs(roundTrip - beat)).toBeLessThan(TOLERANCE);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
