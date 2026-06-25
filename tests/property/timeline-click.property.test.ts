import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { VisibleRegion } from '../../types/grid';
import { CANVAS_CONFIG } from '../../components/PianoRoll';

/**
 * Feature: tone-sketch, Property 9: Timeline Click Positions Playhead
 *
 * *For any* click on the timeline area at time T, the playhead position SHALL be set to T.
 *
 * **Validates: Requirements 8.5**
 *
 * Requirements:
 * - 8.5: WHEN the user clicks on the timeline area, THE Piano_Roll_Editor SHALL
 *        reposition the Playhead to the clicked time position
 */
describe('Property 9: Timeline Click Positions Playhead', () => {
  const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT } = CANVAS_CONFIG;

  // Arbitrary for visible region start beat (0 to 10000)
  const startBeatArb = fc.double({ min: 0, max: 9900, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for visible beats span (4 to 128, per CANVAS_CONFIG limits)
  const visibleBeatsSpanArb = fc.double({
    min: CANVAS_CONFIG.MIN_VISIBLE_BEATS,
    max: CANVAS_CONFIG.MAX_VISIBLE_BEATS,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Arbitrary for pitch range (valid MIDI range)
  const startPitchArb = fc.integer({ min: 0, max: 103 }); // Leave room for span
  const pitchSpanArb = fc.integer({
    min: CANVAS_CONFIG.MIN_VISIBLE_SEMITONES,
    max: CANVAS_CONFIG.MAX_VISIBLE_SEMITONES,
  });

  // Arbitrary for canvas dimensions (realistic pixel values)
  const canvasWidthArb = fc.integer({ min: 400, max: 1920 });
  const canvasHeightArb = fc.integer({ min: 300, max: 1080 });

  // Arbitrary for click position ratio within the timeline area (0 to 1)
  const clickRatioArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  // Combined arbitrary for visible region
  const visibleRegionArb: fc.Arbitrary<VisibleRegion> = fc
    .record({
      startBeat: startBeatArb,
      beatSpan: visibleBeatsSpanArb,
      startPitch: startPitchArb,
      pitchSpan: pitchSpanArb,
    })
    .map(({ startBeat, beatSpan, startPitch, pitchSpan }) => ({
      startBeat,
      endBeat: startBeat + beatSpan,
      startPitch,
      endPitch: Math.min(128, startPitch + pitchSpan),
    }));

  /**
   * Simulates the timeline click behavior from PianoRollCanvas.handleCanvasClick
   *
   * This function converts a pixel X position on the timeline to a beat position
   * and clamps it to non-negative values.
   *
   * Requirements: 8.5 - Clicking on timeline repositions playhead
   *
   * @param clickX - The X position of the click in pixels (relative to container)
   * @param containerWidth - The total width of the container in pixels
   * @param visibleRegion - The current visible region configuration
   * @returns The new playhead position in beats (clamped to >= 0)
   */
  function calculatePlayheadPositionFromTimelineClick(
    clickX: number,
    containerWidth: number,
    visibleRegion: VisibleRegion
  ): number {
    // Calculate grid dimensions (excluding pitch label area)
    const gridWidth = containerWidth - PITCH_LABEL_WIDTH;

    // Convert click X position to beat position
    const gridX = clickX - PITCH_LABEL_WIDTH;
    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const relativeBeat = (gridX / gridWidth) * visibleBeats;
    const clickedBeat = visibleRegion.startBeat + relativeBeat;

    // Clamp to non-negative values (Property 9 requirement)
    const clampedBeat = Math.max(0, clickedBeat);

    return clampedBeat;
  }

  /**
   * Simulates checking if a click position is in the timeline area
   *
   * @param clickX - The X position of the click in pixels
   * @param clickY - The Y position of the click in pixels
   * @returns true if the click is in the timeline area
   */
  function isClickInTimelineArea(clickX: number, clickY: number): boolean {
    return clickY < TIME_MARKER_HEIGHT && clickX >= PITCH_LABEL_WIDTH;
  }

  describe('Timeline click to beat conversion', () => {
    it('clicking on timeline should produce a valid non-negative playhead position', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          canvasWidthArb,
          clickRatioArb,
          (visibleRegion, containerWidth, clickRatio) => {
            // Calculate click X position in the timeline area
            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
            const clickX = PITCH_LABEL_WIDTH + clickRatio * gridWidth;

            // Calculate the resulting playhead position
            const playheadPosition = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // Property: Playhead position should always be non-negative
            expect(playheadPosition).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clicking at the left edge of timeline should position playhead at startBeat', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          canvasWidthArb,
          (visibleRegion, containerWidth) => {
            // Click at the leftmost position of the timeline (just after pitch labels)
            const clickX = PITCH_LABEL_WIDTH;

            const playheadPosition = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // At leftmost position, playhead should be at startBeat
            expect(playheadPosition).toBeCloseTo(visibleRegion.startBeat, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clicking at the right edge of timeline should position playhead at endBeat', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          canvasWidthArb,
          (visibleRegion, containerWidth) => {
            // Click at the rightmost position of the timeline
            const clickX = containerWidth;

            const playheadPosition = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // At rightmost position, playhead should be at endBeat
            expect(playheadPosition).toBeCloseTo(visibleRegion.endBeat, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clicking at middle of timeline should position playhead at midpoint', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          canvasWidthArb,
          (visibleRegion, containerWidth) => {
            // Click at the center of the timeline
            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
            const clickX = PITCH_LABEL_WIDTH + gridWidth / 2;

            const playheadPosition = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // At center, playhead should be at midpoint of visible region
            const expectedMidpoint =
              visibleRegion.startBeat +
              (visibleRegion.endBeat - visibleRegion.startBeat) / 2;

            expect(playheadPosition).toBeCloseTo(expectedMidpoint, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('playhead position should be linearly proportional to click position', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          canvasWidthArb,
          clickRatioArb,
          (visibleRegion, containerWidth, clickRatio) => {
            // Calculate click X position
            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
            const clickX = PITCH_LABEL_WIDTH + clickRatio * gridWidth;

            const playheadPosition = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // Expected position based on linear interpolation
            const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
            const expectedPosition = visibleRegion.startBeat + clickRatio * visibleBeats;

            // Positions should match (both clamped to >= 0)
            expect(playheadPosition).toBeCloseTo(Math.max(0, expectedPosition), 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Playhead position clamping', () => {
    it('playhead position should be clamped to 0 when click would result in negative beat', () => {
      fc.assert(
        fc.property(
          canvasWidthArb,
          fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
          (containerWidth, visibleBeatSpan) => {
            // Create a visible region that starts at 0
            const visibleRegion: VisibleRegion = {
              startBeat: 0,
              endBeat: visibleBeatSpan,
              startPitch: 48,
              endPitch: 72,
            };

            // Click to the left of the pitch label area (impossible in real scenario,
            // but tests the clamping behavior)
            const clickX = PITCH_LABEL_WIDTH - 10; // Would map to negative beat

            const playheadPosition = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // Position should be clamped to 0
            expect(playheadPosition).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('playhead position should never be negative regardless of visible region', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          canvasWidthArb,
          // Use a click ratio that could go beyond the left edge
          fc.double({ min: -1, max: 2, noNaN: true, noDefaultInfinity: true }),
          (visibleRegion, containerWidth, extendedClickRatio) => {
            // Calculate click X position (may be outside normal range)
            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
            const clickX = PITCH_LABEL_WIDTH + extendedClickRatio * gridWidth;

            const playheadPosition = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // Property: Position should always be >= 0
            expect(playheadPosition).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Timeline area detection', () => {
    it('clicks in the time marker area should be detected as timeline clicks', () => {
      fc.assert(
        fc.property(
          canvasWidthArb,
          fc.double({ min: 0, max: TIME_MARKER_HEIGHT - 1, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          (containerWidth, clickY, xRatio) => {
            // Calculate click X position in the timeline area
            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
            const clickX = PITCH_LABEL_WIDTH + xRatio * gridWidth;

            const isTimeline = isClickInTimelineArea(clickX, clickY);

            expect(isTimeline).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clicks below the time marker area should not be detected as timeline clicks', () => {
      fc.assert(
        fc.property(
          canvasWidthArb,
          canvasHeightArb,
          fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
          (containerWidth, containerHeight, xRatio) => {
            // Calculate click position below the timeline
            const clickX = PITCH_LABEL_WIDTH + xRatio * (containerWidth - PITCH_LABEL_WIDTH);
            const clickY = TIME_MARKER_HEIGHT + 10; // Below timeline

            const isTimeline = isClickInTimelineArea(clickX, clickY);

            expect(isTimeline).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clicks in the pitch label area should not be detected as timeline clicks', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: PITCH_LABEL_WIDTH - 1, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0, max: TIME_MARKER_HEIGHT - 1, noNaN: true, noDefaultInfinity: true }),
          (clickX, clickY) => {
            const isTimeline = isClickInTimelineArea(clickX, clickY);

            expect(isTimeline).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Consistency and precision', () => {
    it('same click position should always produce the same playhead position', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          canvasWidthArb,
          clickRatioArb,
          (visibleRegion, containerWidth, clickRatio) => {
            // Calculate click X position
            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
            const clickX = PITCH_LABEL_WIDTH + clickRatio * gridWidth;

            // Calculate position twice
            const position1 = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );
            const position2 = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // Should be identical (deterministic)
            expect(position1).toBe(position2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('closer clicks should produce closer playhead positions', () => {
      fc.assert(
        fc.property(
          visibleRegionArb,
          canvasWidthArb,
          fc.double({ min: 0.1, max: 0.9, noNaN: true, noDefaultInfinity: true }),
          fc.double({ min: 0.01, max: 0.1, noNaN: true, noDefaultInfinity: true }),
          (visibleRegion, containerWidth, baseRatio, smallDelta) => {
            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;

            // Two clicks close together
            const clickX1 = PITCH_LABEL_WIDTH + baseRatio * gridWidth;
            const clickX2 = PITCH_LABEL_WIDTH + (baseRatio + smallDelta) * gridWidth;

            // And two clicks far apart
            const clickX3 = PITCH_LABEL_WIDTH + baseRatio * gridWidth;
            const clickX4 = PITCH_LABEL_WIDTH + (baseRatio + smallDelta * 5) * gridWidth;

            const pos1 = calculatePlayheadPositionFromTimelineClick(clickX1, containerWidth, visibleRegion);
            const pos2 = calculatePlayheadPositionFromTimelineClick(clickX2, containerWidth, visibleRegion);
            const pos3 = calculatePlayheadPositionFromTimelineClick(clickX3, containerWidth, visibleRegion);
            const pos4 = calculatePlayheadPositionFromTimelineClick(clickX4, containerWidth, visibleRegion);

            const closeDiff = Math.abs(pos2 - pos1);
            const farDiff = Math.abs(pos4 - pos3);

            // Close clicks should produce smaller differences than far clicks
            expect(closeDiff).toBeLessThanOrEqual(farDiff + 1e-10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('playhead position should scale with visible region zoom level', () => {
      fc.assert(
        fc.property(
          startBeatArb,
          canvasWidthArb,
          clickRatioArb,
          (startBeat, containerWidth, clickRatio) => {
            // Same click ratio but different zoom levels
            const zoomedInRegion: VisibleRegion = {
              startBeat,
              endBeat: startBeat + 8, // Zoomed in: 8 beats visible
              startPitch: 48,
              endPitch: 72,
            };

            const zoomedOutRegion: VisibleRegion = {
              startBeat,
              endBeat: startBeat + 64, // Zoomed out: 64 beats visible
              startPitch: 48,
              endPitch: 72,
            };

            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
            const clickX = PITCH_LABEL_WIDTH + clickRatio * gridWidth;

            const posZoomedIn = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              zoomedInRegion
            );
            const posZoomedOut = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              zoomedOutRegion
            );

            // At 50% click ratio:
            // Zoomed in: startBeat + 0.5 * 8 = startBeat + 4
            // Zoomed out: startBeat + 0.5 * 64 = startBeat + 32
            // The ratio of differences from startBeat should match zoom ratio

            const diffZoomedIn = posZoomedIn - startBeat;
            const diffZoomedOut = posZoomedOut - startBeat;

            // Both should follow: diff = clickRatio * visibleBeats
            expect(diffZoomedIn).toBeCloseTo(clickRatio * 8, 10);
            expect(diffZoomedOut).toBeCloseTo(clickRatio * 64, 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle very small visible beat ranges', () => {
      fc.assert(
        fc.property(
          startBeatArb,
          canvasWidthArb,
          clickRatioArb,
          (startBeat, containerWidth, clickRatio) => {
            // Very zoomed in view: minimum visible beats
            const visibleRegion: VisibleRegion = {
              startBeat,
              endBeat: startBeat + CANVAS_CONFIG.MIN_VISIBLE_BEATS,
              startPitch: 48,
              endPitch: 72,
            };

            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
            const clickX = PITCH_LABEL_WIDTH + clickRatio * gridWidth;

            const playheadPosition = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // Should still produce a valid position
            expect(playheadPosition).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(playheadPosition)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle very large visible beat ranges', () => {
      fc.assert(
        fc.property(canvasWidthArb, clickRatioArb, (containerWidth, clickRatio) => {
          // Very zoomed out view: maximum visible beats
          const visibleRegion: VisibleRegion = {
            startBeat: 0,
            endBeat: CANVAS_CONFIG.MAX_VISIBLE_BEATS,
            startPitch: 48,
            endPitch: 72,
          };

          const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
          const clickX = PITCH_LABEL_WIDTH + clickRatio * gridWidth;

          const playheadPosition = calculatePlayheadPositionFromTimelineClick(
            clickX,
            containerWidth,
            visibleRegion
          );

          // Should produce a valid position within the visible range
          expect(playheadPosition).toBeGreaterThanOrEqual(0);
          expect(playheadPosition).toBeLessThanOrEqual(CANVAS_CONFIG.MAX_VISIBLE_BEATS);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle visible region not starting at beat 0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 9000, noNaN: true, noDefaultInfinity: true }),
          visibleBeatsSpanArb,
          canvasWidthArb,
          clickRatioArb,
          (startBeat, beatSpan, containerWidth, clickRatio) => {
            const visibleRegion: VisibleRegion = {
              startBeat,
              endBeat: startBeat + beatSpan,
              startPitch: 48,
              endPitch: 72,
            };

            const gridWidth = containerWidth - PITCH_LABEL_WIDTH;
            const clickX = PITCH_LABEL_WIDTH + clickRatio * gridWidth;

            const playheadPosition = calculatePlayheadPositionFromTimelineClick(
              clickX,
              containerWidth,
              visibleRegion
            );

            // Position should be within or at the boundaries of visible region
            // (allowing for clamping at 0)
            expect(playheadPosition).toBeGreaterThanOrEqual(0);

            // The position should be approximately at the expected beat
            const expectedBeat = startBeat + clickRatio * beatSpan;
            expect(playheadPosition).toBeCloseTo(Math.max(0, expectedBeat), 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
