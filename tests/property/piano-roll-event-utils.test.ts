import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  isOnResizeHandle,
} from '@/components/PianoRoll/event-utils';
import { beatToPixelX, DEFAULT_COORDINATE_CONFIG } from '@/components/PianoRoll/coordinate-utils';
import { RESIZE_HANDLE_WIDTH } from '@/components/PianoRoll/constants';
import type { Note } from '@/types/note';

/**
 * Feature: piano-roll-refactor, Property 5: Resize Handle Detection
 *
 * *For any* note and any pixel X position:
 * - `isOnResizeHandle(pixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH)` shall return
 *   `true` if and only if `pixelX` is within `RESIZE_HANDLE_WIDTH` pixels of the note's right edge
 * - More formally: `noteEndPixelX - RESIZE_HANDLE_WIDTH ≤ pixelX ≤ noteEndPixelX` where
 *   `noteEndPixelX = beatToPixelX(note.start + note.duration)`
 *
 * **Validates: Requirements 6.4**
 */
describe('Property 5: Resize Handle Detection', () => {
  // Arbitrary for valid container width (reasonable screen sizes)
  const containerWidthArb = fc.integer({ min: 400, max: 2000 });

  // Arbitrary for visible region with valid bounds
  const visibleRegionArb = fc.record({
    startBeat: fc.float({ min: 0, max: 32, noNaN: true }),
    endBeat: fc.float({ min: 16, max: 64, noNaN: true }),
    startPitch: fc.integer({ min: 0, max: 108 }),
    endPitch: fc.integer({ min: 20, max: 128 }),
  }).filter((region) => region.endBeat > region.startBeat && region.endPitch > region.startPitch);

  it('should return true when pixelX is exactly at the note end', () => {
    fc.assert(
      fc.property(
        containerWidthArb,
        visibleRegionArb,
        (containerWidth, visibleRegion) => {
          // Generate a note within visible region
          const note: Note = {
            id: 'test-note',
            pitch: Math.floor((visibleRegion.startPitch + visibleRegion.endPitch) / 2),
            start: visibleRegion.startBeat + (visibleRegion.endBeat - visibleRegion.startBeat) / 4,
            duration: 1,
            velocity: 100,
          };

          const noteEndBeat = note.start + note.duration;
          const noteEndPixelX = beatToPixelX(noteEndBeat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

          // Position exactly at the note end should be within resize handle
          const result = isOnResizeHandle(noteEndPixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH);
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return true when pixelX is within RESIZE_HANDLE_WIDTH of note end', () => {
    fc.assert(
      fc.property(
        containerWidthArb,
        visibleRegionArb,
        fc.float({ min: 0, max: RESIZE_HANDLE_WIDTH, noNaN: true }),
        (containerWidth, visibleRegion, offsetFromEnd) => {
          const note: Note = {
            id: 'test-note',
            pitch: Math.floor((visibleRegion.startPitch + visibleRegion.endPitch) / 2),
            start: visibleRegion.startBeat + (visibleRegion.endBeat - visibleRegion.startBeat) / 4,
            duration: 1,
            velocity: 100,
          };

          const noteEndBeat = note.start + note.duration;
          const noteEndPixelX = beatToPixelX(noteEndBeat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

          // Position within RESIZE_HANDLE_WIDTH pixels of note end
          const pixelX = noteEndPixelX - offsetFromEnd;

          const result = isOnResizeHandle(pixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH);
          return result === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return false when pixelX is outside RESIZE_HANDLE_WIDTH of note end (to the left)', () => {
    fc.assert(
      fc.property(
        containerWidthArb,
        visibleRegionArb,
        fc.float({ min: 1, max: 100, noNaN: true }), // Offset beyond RESIZE_HANDLE_WIDTH
        (containerWidth, visibleRegion, extraOffset) => {
          const note: Note = {
            id: 'test-note',
            pitch: Math.floor((visibleRegion.startPitch + visibleRegion.endPitch) / 2),
            start: visibleRegion.startBeat + (visibleRegion.endBeat - visibleRegion.startBeat) / 4,
            duration: 1,
            velocity: 100,
          };

          const noteEndBeat = note.start + note.duration;
          const noteEndPixelX = beatToPixelX(noteEndBeat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

          // Position more than RESIZE_HANDLE_WIDTH pixels to the left of note end
          const pixelX = noteEndPixelX - RESIZE_HANDLE_WIDTH - extraOffset;

          const result = isOnResizeHandle(pixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH);
          return result === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return false when pixelX is past the note end (to the right)', () => {
    fc.assert(
      fc.property(
        containerWidthArb,
        visibleRegionArb,
        fc.float({ min: 1, max: 100, noNaN: true }), // Offset past note end
        (containerWidth, visibleRegion, extraOffset) => {
          const note: Note = {
            id: 'test-note',
            pitch: Math.floor((visibleRegion.startPitch + visibleRegion.endPitch) / 2),
            start: visibleRegion.startBeat + (visibleRegion.endBeat - visibleRegion.startBeat) / 4,
            duration: 1,
            velocity: 100,
          };

          const noteEndBeat = note.start + note.duration;
          const noteEndPixelX = beatToPixelX(noteEndBeat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

          // Position to the right of the note end
          const pixelX = noteEndPixelX + extraOffset;

          const result = isOnResizeHandle(pixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH);
          return result === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should satisfy the formal property: true iff noteEndPixelX - RESIZE_HANDLE_WIDTH ≤ pixelX ≤ noteEndPixelX', () => {
    fc.assert(
      fc.property(
        containerWidthArb,
        visibleRegionArb,
        fc.float({ min: -50, max: 500, noNaN: true }), // Wide range of pixelX offsets from note end
        (containerWidth, visibleRegion, pixelXOffset) => {
          const note: Note = {
            id: 'test-note',
            pitch: Math.floor((visibleRegion.startPitch + visibleRegion.endPitch) / 2),
            start: visibleRegion.startBeat + (visibleRegion.endBeat - visibleRegion.startBeat) / 4,
            duration: 1,
            velocity: 100,
          };

          const noteEndBeat = note.start + note.duration;
          const noteEndPixelX = beatToPixelX(noteEndBeat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

          // Generate pixelX as an offset from some base position
          const basePixelX = noteEndPixelX - RESIZE_HANDLE_WIDTH / 2;
          const pixelX = basePixelX + pixelXOffset;

          const result = isOnResizeHandle(pixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH);

          // Expected: true iff pixelX is within [noteEndPixelX - RESIZE_HANDLE_WIDTH, noteEndPixelX]
          const expected = pixelX >= noteEndPixelX - RESIZE_HANDLE_WIDTH && pixelX <= noteEndPixelX;

          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle notes at different positions within the visible region', () => {
    fc.assert(
      fc.property(
        containerWidthArb,
        visibleRegionArb,
        fc.integer({ min: 1, max: 9 }), // Position decile (1-9, representing 10%-90%)
        fc.integer({ min: 1, max: 16 }), // Duration in quarter beats
        (containerWidth, visibleRegion, positionDecile, durationQuarters) => {
          const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
          const positionRatio = positionDecile / 10;
          const noteStart = visibleRegion.startBeat + visibleBeats * positionRatio;
          const duration = durationQuarters * 0.25; // Convert to beats

          const note: Note = {
            id: 'test-note',
            pitch: Math.floor((visibleRegion.startPitch + visibleRegion.endPitch) / 2),
            start: noteStart,
            duration: duration,
            velocity: 100,
          };

          const noteEndBeat = note.start + note.duration;
          const noteEndPixelX = beatToPixelX(noteEndBeat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

          // Test at exact boundary
          const atEnd = isOnResizeHandle(noteEndPixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH);
          const atBoundary = isOnResizeHandle(
            noteEndPixelX - RESIZE_HANDLE_WIDTH,
            note,
            containerWidth,
            visibleRegion,
            RESIZE_HANDLE_WIDTH
          );
          const justOutside = isOnResizeHandle(
            noteEndPixelX - RESIZE_HANDLE_WIDTH - 1,
            note,
            containerWidth,
            visibleRegion,
            RESIZE_HANDLE_WIDTH
          );

          return atEnd === true && atBoundary === true && justOutside === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return consistent results (deterministic behavior)', () => {
    fc.assert(
      fc.property(
        containerWidthArb,
        visibleRegionArb,
        fc.float({ min: 0, max: 500, noNaN: true }),
        (containerWidth, visibleRegion, pixelX) => {
          const note: Note = {
            id: 'test-note',
            pitch: Math.floor((visibleRegion.startPitch + visibleRegion.endPitch) / 2),
            start: visibleRegion.startBeat + (visibleRegion.endBeat - visibleRegion.startBeat) / 4,
            duration: 1,
            velocity: 100,
          };

          // Call multiple times - should always return same result
          const result1 = isOnResizeHandle(pixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH);
          const result2 = isOnResizeHandle(pixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH);
          const result3 = isOnResizeHandle(pixelX, note, containerWidth, visibleRegion, RESIZE_HANDLE_WIDTH);

          return result1 === result2 && result2 === result3;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should work correctly with custom resize handle widths', () => {
    fc.assert(
      fc.property(
        containerWidthArb,
        visibleRegionArb,
        fc.integer({ min: 1, max: 50 }), // Custom resize handle width
        (containerWidth, visibleRegion, customHandleWidth) => {
          const note: Note = {
            id: 'test-note',
            pitch: Math.floor((visibleRegion.startPitch + visibleRegion.endPitch) / 2),
            start: visibleRegion.startBeat + (visibleRegion.endBeat - visibleRegion.startBeat) / 4,
            duration: 1,
            velocity: 100,
          };

          const noteEndBeat = note.start + note.duration;
          const noteEndPixelX = beatToPixelX(noteEndBeat, containerWidth, visibleRegion, DEFAULT_COORDINATE_CONFIG);

          // Test exactly at the custom boundary
          const atCustomBoundary = isOnResizeHandle(
            noteEndPixelX - customHandleWidth,
            note,
            containerWidth,
            visibleRegion,
            customHandleWidth
          );

          // Test just outside custom boundary
          const justOutsideCustom = isOnResizeHandle(
            noteEndPixelX - customHandleWidth - 1,
            note,
            containerWidth,
            visibleRegion,
            customHandleWidth
          );

          return atCustomBoundary === true && justOutsideCustom === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});
