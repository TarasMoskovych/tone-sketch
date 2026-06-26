import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  noteToBarX,
  noteToBarWidth,
  velocityToBarHeight,
  velocityToBarY,
  pointerYToVelocity,
  applyVelocityDelta,
  clampVelocity,
} from '@/components/VelocityLane/coordinate-utils';
import { beatToPixelX } from '@/components/PianoRoll/coordinate-utils';
import type { VisibleRegion } from '@/types/grid';

// --- Shared Arbitraries ---

/** Arbitrary for a valid visible region with positive beat span */
const visibleRegionArb: fc.Arbitrary<VisibleRegion> = fc
  .record({
    startBeat: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    beatSpan: fc.double({ min: 1, max: 64, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ startBeat, beatSpan }) => ({
    startBeat,
    endBeat: startBeat + beatSpan,
    startPitch: 48,
    endPitch: 72,
  }));

/** Arbitrary for grid dimensions */
const gridWidthArb = fc.double({ min: 100, max: 2000, noNaN: true, noDefaultInfinity: true });
const gridXArb = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });
const laneHeightArb = fc.double({ min: 50, max: 500, noNaN: true, noDefaultInfinity: true });
const gridYArb = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for a velocity value in [0, 1] */
const velocityArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for note start position */
const noteStartArb = fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for note duration (positive) */
const noteDurationArb = fc.double({ min: 0.001, max: 100, noNaN: true, noDefaultInfinity: true });

/**
 * Feature: velocity-lane-editor, Property 4: Bar Horizontal Positioning
 *
 * *For any* note and visible region with pixelsPerBeat = gridWidth / (endBeat - startBeat),
 * the velocity bar's x-offset SHALL equal gridX + (note.start - visibleRegion.startBeat) × pixelsPerBeat.
 *
 * **Validates: Requirements 2.2**
 */
describe('Feature: velocity-lane-editor, Property 4: Bar Horizontal Positioning', () => {
  it('should compute x-offset as gridX + (note.start - startBeat) × pixelsPerBeat', () => {
    fc.assert(
      fc.property(
        noteStartArb,
        visibleRegionArb,
        gridWidthArb,
        gridXArb,
        (noteStart, visibleRegion, gridWidth, gridX) => {
          const result = noteToBarX(noteStart, visibleRegion, gridWidth, gridX);

          const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
          const pixelsPerBeat = gridWidth / visibleBeats;
          const expected = gridX + (noteStart - visibleRegion.startBeat) * pixelsPerBeat;

          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return gridX when note.start equals visibleRegion.startBeat', () => {
    fc.assert(
      fc.property(
        visibleRegionArb,
        gridWidthArb,
        gridXArb,
        (visibleRegion, gridWidth, gridX) => {
          const result = noteToBarX(visibleRegion.startBeat, visibleRegion, gridWidth, gridX);
          expect(result).toBeCloseTo(gridX, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: velocity-lane-editor, Property 5: Bar Width Calculation
 *
 * *For any* note with positive duration and visible region with pixelsPerBeat = gridWidth / (endBeat - startBeat),
 * the velocity bar's width SHALL equal note.duration × pixelsPerBeat.
 *
 * **Validates: Requirements 2.3**
 */
describe('Feature: velocity-lane-editor, Property 5: Bar Width Calculation', () => {
  it('should compute width as duration × pixelsPerBeat', () => {
    fc.assert(
      fc.property(
        noteDurationArb,
        visibleRegionArb,
        gridWidthArb,
        (duration, visibleRegion, gridWidth) => {
          const result = noteToBarWidth(duration, visibleRegion, gridWidth);

          const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
          const pixelsPerBeat = gridWidth / visibleBeats;
          const expected = duration * pixelsPerBeat;

          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce non-negative width for positive durations', () => {
    fc.assert(
      fc.property(
        noteDurationArb,
        visibleRegionArb,
        gridWidthArb,
        (duration, visibleRegion, gridWidth) => {
          const result = noteToBarWidth(duration, visibleRegion, gridWidth);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: velocity-lane-editor, Property 6: Bar Height and Y-Position
 *
 * *For any* velocity in [0, 1] and lane height > 0, the bar height SHALL equal velocity × laneHeight
 * AND the bar's y-position SHALL equal gridY + laneHeight - barHeight (bottom-anchored, bars grow upward).
 *
 * **Validates: Requirements 2.4, 2.5**
 */
describe('Feature: velocity-lane-editor, Property 6: Bar Height and Y-Position', () => {
  it('should compute bar height as velocity × laneHeight', () => {
    fc.assert(
      fc.property(
        velocityArb,
        laneHeightArb,
        (velocity, laneHeight) => {
          const result = velocityToBarHeight(velocity, laneHeight);
          const expected = velocity * laneHeight;
          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should compute y-position as gridY + laneHeight - barHeight (bottom-anchored)', () => {
    fc.assert(
      fc.property(
        velocityArb,
        laneHeightArb,
        gridYArb,
        (velocity, laneHeight, gridY) => {
          const result = velocityToBarY(velocity, laneHeight, gridY);
          const barHeight = velocity * laneHeight;
          const expected = gridY + laneHeight - barHeight;
          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should position velocity=0 bars at the baseline (gridY + laneHeight)', () => {
    fc.assert(
      fc.property(
        laneHeightArb,
        gridYArb,
        (laneHeight, gridY) => {
          const result = velocityToBarY(0, laneHeight, gridY);
          expect(result).toBeCloseTo(gridY + laneHeight, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should position velocity=1 bars at the top (gridY)', () => {
    fc.assert(
      fc.property(
        laneHeightArb,
        gridYArb,
        (laneHeight, gridY) => {
          const result = velocityToBarY(1, laneHeight, gridY);
          expect(result).toBeCloseTo(gridY, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: velocity-lane-editor, Property 7: Horizontal Coordinate Alignment
 *
 * *For any* beat position and shared visible region, the horizontal pixel offset computed by
 * the VelocityLane for bar positions SHALL use the same formula (beat - startBeat) × pixelsPerBeat
 * as the PianoRollCanvas, producing identical x-coordinates.
 *
 * **Validates: Requirements 3.1, 3.5**
 */
describe('Feature: velocity-lane-editor, Property 7: Horizontal Coordinate Alignment', () => {
  it('should produce identical x-coordinates as PianoRoll beatToPixelX for the same beat', () => {
    fc.assert(
      fc.property(
        visibleRegionArb,
        fc.double({ min: 200, max: 2000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true }),
        (visibleRegion, containerWidth, beat) => {
          // PianoRoll coordinate config
          const PITCH_LABEL_WIDTH = 50;
          const SCROLLBAR_WIDTH = 14;
          const pianoRollConfig = { PITCH_LABEL_WIDTH, SCROLLBAR_WIDTH };

          // PianoRoll computes: PITCH_LABEL_WIDTH + ((beat - startBeat) / visibleBeats) * gridWidth
          // where gridWidth = containerWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH
          const pianoRollX = beatToPixelX(beat, containerWidth, visibleRegion, pianoRollConfig);

          // VelocityLane with equivalent grid configuration:
          // gridX = PITCH_LABEL_WIDTH (same left offset)
          // gridWidth = containerWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH (same grid width)
          const gridX = PITCH_LABEL_WIDTH;
          const gridWidth = containerWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;

          const velocityLaneX = noteToBarX(beat, visibleRegion, gridWidth, gridX);

          // Both should produce the same x-coordinate (use 8 decimal places to account for
          // floating-point arithmetic order differences with large coordinate values)
          expect(velocityLaneX).toBeCloseTo(pianoRollX, 8);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use the same pixelsPerBeat as PianoRoll for computing width', () => {
    fc.assert(
      fc.property(
        visibleRegionArb,
        fc.double({ min: 200, max: 2000, noNaN: true, noDefaultInfinity: true }),
        noteDurationArb,
        (visibleRegion, containerWidth, duration) => {
          const PITCH_LABEL_WIDTH = 50;
          const SCROLLBAR_WIDTH = 14;
          const gridWidth = containerWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;

          // VelocityLane bar width
          const barWidth = noteToBarWidth(duration, visibleRegion, gridWidth);

          // PianoRoll equivalent: duration * (gridWidth / visibleBeats)
          const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
          const pixelsPerBeat = gridWidth / visibleBeats;
          const expectedWidth = duration * pixelsPerBeat;

          expect(barWidth).toBeCloseTo(expectedWidth, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: velocity-lane-editor, Property 8: Pointer-to-Velocity Conversion with Clamping
 *
 * *For any* pointer y-position (including positions outside the lane bounds) and lane height > 0,
 * the computed velocity SHALL be clamped to [0, 1].
 *
 * **Validates: Requirements 4.1, 4.2**
 */
describe('Feature: velocity-lane-editor, Property 8: Pointer-to-Velocity Conversion with Clamping', () => {
  it('should always return a value in [0, 1] for any pointerY', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 2000, noNaN: true, noDefaultInfinity: true }),
        laneHeightArb,
        (pointerY, laneHeight) => {
          const result = pointerYToVelocity(pointerY, laneHeight);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should compute velocity as (laneHeight - pointerY) / laneHeight when within bounds', () => {
    fc.assert(
      fc.property(
        laneHeightArb,
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (laneHeight, normalizedPos) => {
          // pointerY within [0, laneHeight]
          const pointerY = normalizedPos * laneHeight;
          const result = pointerYToVelocity(pointerY, laneHeight);
          const expected = (laneHeight - pointerY) / laneHeight;
          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clamp to 1 when pointerY is negative (above lane)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: -0.001, noNaN: true, noDefaultInfinity: true }),
        laneHeightArb,
        (pointerY, laneHeight) => {
          const result = pointerYToVelocity(pointerY, laneHeight);
          expect(result).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clamp to 0 when pointerY exceeds laneHeight (below lane)', () => {
    fc.assert(
      fc.property(
        laneHeightArb,
        fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (laneHeight, excess) => {
          const pointerY = laneHeight + excess;
          const result = pointerYToVelocity(pointerY, laneHeight);
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: velocity-lane-editor, Property 10: Multi-Note Delta Application
 *
 * *For any* set of selected notes with original velocities [v₁, v₂, ..., vₙ] at drag start,
 * and a dragged bar producing delta d, each affected note's new velocity SHALL equal
 * clamp(vᵢ + d, 0, 1).
 *
 * **Validates: Requirements 5.1, 5.2**
 */
describe('Feature: velocity-lane-editor, Property 10: Multi-Note Delta Application', () => {
  /** Arbitrary for a map of note IDs to velocities */
  const velocityMapArb = fc
    .array(
      fc.record({
        id: fc.uuid(),
        velocity: velocityArb,
      }),
      { minLength: 1, maxLength: 20 }
    )
    .map((entries) => new Map(entries.map((e) => [e.id, e.velocity])));

  const deltaArb = fc.double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true });

  it('should apply clamp(vᵢ + delta, 0, 1) independently to each note', () => {
    fc.assert(
      fc.property(velocityMapArb, deltaArb, (originalVelocities, delta) => {
        const result = applyVelocityDelta(originalVelocities, delta);

        for (const [noteId, originalVelocity] of originalVelocities) {
          const expected = clampVelocity(originalVelocity + delta);
          expect(result.get(noteId)).toBeCloseTo(expected, 10);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should produce all output values in [0, 1]', () => {
    fc.assert(
      fc.property(velocityMapArb, deltaArb, (originalVelocities, delta) => {
        const result = applyVelocityDelta(originalVelocities, delta);

        for (const [, newVelocity] of result) {
          expect(newVelocity).toBeGreaterThanOrEqual(0);
          expect(newVelocity).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve all note IDs in the output', () => {
    fc.assert(
      fc.property(velocityMapArb, deltaArb, (originalVelocities, delta) => {
        const result = applyVelocityDelta(originalVelocities, delta);
        expect(result.size).toBe(originalVelocities.size);

        for (const noteId of originalVelocities.keys()) {
          expect(result.has(noteId)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should return original velocities when delta is 0', () => {
    fc.assert(
      fc.property(velocityMapArb, (originalVelocities) => {
        const result = applyVelocityDelta(originalVelocities, 0);

        for (const [noteId, originalVelocity] of originalVelocities) {
          expect(result.get(noteId)).toBeCloseTo(originalVelocity, 10);
        }
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: velocity-lane-editor, Property 11: Multi-Note Editing Activation Condition
 *
 * *For any* selection set S and dragged note N, multi-note editing SHALL apply
 * if and only if N ∈ S AND |S| ≥ 2. Otherwise, only the dragged note's velocity is affected.
 *
 * **Validates: Requirements 5.4, 5.5**
 */
describe('Feature: velocity-lane-editor, Property 11: Multi-Note Editing Activation Condition', () => {
  /** Helper to determine multi-note activation condition */
  function isMultiNoteActive(noteId: string, selectedNoteIds: Set<string>): boolean {
    return selectedNoteIds.has(noteId) && selectedNoteIds.size >= 2;
  }

  it('should activate multi-note iff dragged note is in selection AND selection has ≥ 2 notes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
        fc.uuid(),
        fc.boolean(),
        (selectionArray, draggedNoteId, includeDraggedInSelection) => {
          const selectedNoteIds = new Set(selectionArray);
          if (includeDraggedInSelection) {
            selectedNoteIds.add(draggedNoteId);
          } else {
            selectedNoteIds.delete(draggedNoteId);
          }

          const result = isMultiNoteActive(draggedNoteId, selectedNoteIds);
          const expected = selectedNoteIds.has(draggedNoteId) && selectedNoteIds.size >= 2;

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT activate multi-note when selection has exactly 1 note (the dragged note)', () => {
    fc.assert(
      fc.property(fc.uuid(), (noteId) => {
        const selectedNoteIds = new Set([noteId]);
        const result = isMultiNoteActive(noteId, selectedNoteIds);
        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should NOT activate multi-note when dragged note is NOT in selection', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
        fc.uuid(),
        (selectionArray, draggedNoteId) => {
          const selectedNoteIds = new Set(selectionArray);
          selectedNoteIds.delete(draggedNoteId); // Ensure dragged note is not selected

          const result = isMultiNoteActive(draggedNoteId, selectedNoteIds);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should activate multi-note when dragged note IS in selection of size ≥ 2', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        fc.uuid(),
        (otherNotes, draggedNoteId) => {
          const selectedNoteIds = new Set(otherNotes);
          selectedNoteIds.add(draggedNoteId);
          // Ensure at least 2 notes in selection
          if (selectedNoteIds.size < 2) {
            selectedNoteIds.add('extra-note-id');
          }

          const result = isMultiNoteActive(draggedNoteId, selectedNoteIds);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT activate multi-note when selection is empty', () => {
    fc.assert(
      fc.property(fc.uuid(), (noteId) => {
        const selectedNoteIds = new Set<string>();
        const result = isMultiNoteActive(noteId, selectedNoteIds);
        expect(result).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
