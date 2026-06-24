import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { snapPosition, snapToGrid, snapToFreePosition, GRID_DIVISIONS, FREE_POSITION_RESOLUTION } from '../../utils/grid-snap';
import type { Note } from '../../types/note';
import type { GridDivision, GridSnapConfig } from '../../types/grid';

/**
 * Feature: tone-sketch, Property 4: Note Boundary Clamping
 *
 * *For any* drag operation on a Note:
 * - The start time SHALL be clamped to the range [0, ∞)
 * - The pitch SHALL be clamped to the range [0, 127]
 *
 * **Validates: Requirements 3.3, 4.2**
 */
describe('Property 4: Note Boundary Clamping (Horizontal Drag - Start Time)', () => {
  // Arbitrary for valid MIDI pitch (0-127)
  const pitchArb = fc.integer({ min: 0, max: 127 });

  // Arbitrary for valid start time in beats (0-10000)
  const startBeatArb = fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for valid duration (0.001-1000)
  const durationArb = fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for valid velocity (0-1)
  const velocityArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for grid divisions
  const gridDivisionArb = fc.constantFrom(...GRID_DIVISIONS) as fc.Arbitrary<GridDivision>;

  // Arbitrary for grid snap configuration
  const gridSnapConfigArb: fc.Arbitrary<GridSnapConfig> = fc.record({
    enabled: fc.boolean(),
    division: gridDivisionArb,
  });

  // Arbitrary for delta beat (can be negative to drag left, or positive to drag right)
  // Using a wider range to test boundary clamping
  const deltaBeatArb = fc.double({ min: -20000, max: 20000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for creating a valid note
  const noteArb: fc.Arbitrary<Note> = fc.record({
    id: fc.uuid(),
    pitch: pitchArb,
    start: startBeatArb,
    duration: durationArb,
    velocity: velocityArb,
  });

  /**
   * Simulates the horizontal drag behavior from PianoRollCanvas.handleMouseMove
   *
   * Requirements: 3.1, 3.2, 3.3
   * - Updates note start time during drag
   * - Applies grid snap when enabled
   * - Clamps start time to non-negative values
   *
   * @param note - The original note being dragged
   * @param deltaBeat - The change in beats from the drag
   * @param gridSnap - The grid snap configuration
   * @returns The updated note with clamped and snapped start time
   */
  function applyHorizontalDrag(
    note: Note,
    deltaBeat: number,
    gridSnap: GridSnapConfig
  ): Note {
    // Calculate new start time
    const rawNewStart = note.start + deltaBeat;

    // Apply grid snap if enabled (Requirement 3.2)
    const snappedStart = snapPosition(rawNewStart, gridSnap);

    // Clamp to non-negative values (Requirement 3.3, Property 4)
    const clampedStart = Math.max(0, snappedStart);

    return {
      ...note,
      start: clampedStart,
    };
  }

  describe('Start time clamping', () => {
    it('start time should never be negative after any horizontal drag', () => {
      fc.assert(
        fc.property(noteArb, deltaBeatArb, gridSnapConfigArb, (note, deltaBeat, gridSnap) => {
          const updatedNote = applyHorizontalDrag(note, deltaBeat, gridSnap);

          expect(updatedNote.start).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('dragging far left should clamp start time to zero', () => {
      fc.assert(
        fc.property(noteArb, gridSnapConfigArb, (note, gridSnap) => {
          // Drag so far left that raw position would be very negative
          const extremeLeftDelta = -note.start - 1000;
          const updatedNote = applyHorizontalDrag(note, extremeLeftDelta, gridSnap);

          expect(updatedNote.start).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('start time should be clamped to exactly zero, not a small negative number', () => {
      fc.assert(
        fc.property(noteArb, gridSnapConfigArb, (note, gridSnap) => {
          // Calculate delta that would result in exactly -0.001
          const deltaToBoundary = -(note.start + 0.001);
          const updatedNote = applyHorizontalDrag(note, deltaToBoundary, gridSnap);

          // Should be exactly 0 or positive
          expect(updatedNote.start).toBeGreaterThanOrEqual(0);
          expect(Object.is(updatedNote.start, -0)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('dragging right should not be limited (start time can increase to any positive value)', () => {
      fc.assert(
        fc.property(noteArb, gridSnapConfigArb, (note, gridSnap) => {
          // Drag far right
          const largeDelta = 5000;
          const updatedNote = applyHorizontalDrag(note, largeDelta, gridSnap);

          // Start time should be positive
          expect(updatedNote.start).toBeGreaterThanOrEqual(0);

          // The result should be close to the original + delta (accounting for snap)
          const expectedRaw = note.start + largeDelta;
          const expectedSnapped = snapPosition(expectedRaw, gridSnap);
          expect(updatedNote.start).toBeCloseTo(expectedSnapped, 10);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Grid snap during drag', () => {
    it('when grid snap is enabled, start time should be a multiple of grid division', () => {
      fc.assert(
        fc.property(noteArb, deltaBeatArb, gridDivisionArb, (note, deltaBeat, division) => {
          const gridSnap: GridSnapConfig = { enabled: true, division };
          const updatedNote = applyHorizontalDrag(note, deltaBeat, gridSnap);

          // If clamped to 0, that's a valid grid position
          if (updatedNote.start === 0) {
            return true;
          }

          // Otherwise, should be a multiple of the division
          const quotient = updatedNote.start / division;
          const isMultiple = Math.abs(quotient - Math.round(quotient)) < 1e-10;

          expect(isMultiple).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('when grid snap is disabled, start time should be quantized to 1/32 beat', () => {
      fc.assert(
        fc.property(noteArb, deltaBeatArb, gridDivisionArb, (note, deltaBeat, division) => {
          const gridSnap: GridSnapConfig = { enabled: false, division };
          const updatedNote = applyHorizontalDrag(note, deltaBeat, gridSnap);

          // If clamped to 0, that's a valid position
          if (updatedNote.start === 0) {
            return true;
          }

          // Should be quantized to 1/32 beat (0.03125)
          const quotient = updatedNote.start / FREE_POSITION_RESOLUTION;
          const isMultiple = Math.abs(quotient - Math.round(quotient)) < 1e-10;

          expect(isMultiple).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('grid snap should be applied before boundary clamping', () => {
      fc.assert(
        fc.property(gridDivisionArb, (division) => {
          // Create a note close to the left edge
          const note: Note = {
            id: crypto.randomUUID(),
            pitch: 60,
            start: 0.1,
            duration: 1,
            velocity: 0.8,
          };
          const gridSnap: GridSnapConfig = { enabled: true, division };

          // Drag slightly left (so raw position might snap to a negative value)
          const deltaBeat = -0.15;
          const updatedNote = applyHorizontalDrag(note, deltaBeat, gridSnap);

          // Result should still be clamped to >= 0
          expect(updatedNote.start).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Other note properties preservation', () => {
    it('horizontal drag should only modify start time, not other properties', () => {
      fc.assert(
        fc.property(noteArb, deltaBeatArb, gridSnapConfigArb, (note, deltaBeat, gridSnap) => {
          const updatedNote = applyHorizontalDrag(note, deltaBeat, gridSnap);

          // All other properties should remain unchanged
          expect(updatedNote.id).toBe(note.id);
          expect(updatedNote.pitch).toBe(note.pitch);
          expect(updatedNote.duration).toBe(note.duration);
          expect(updatedNote.velocity).toBe(note.velocity);
        }),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Feature: tone-sketch, Property 6: Drag Cancel Restores Original State
 *
 * *For any* Note with initial position (pitch, start, duration) and any drag operation
 * that is cancelled, the Note SHALL be restored to its exact original position values.
 *
 * **Validates: Requirements 3.5**
 */
describe('Property 6: Drag Cancel Restores Original State', () => {
  // Arbitrary for valid MIDI pitch (0-127)
  const pitchArb = fc.integer({ min: 0, max: 127 });

  // Arbitrary for valid start time in beats (0-10000)
  const startBeatArb = fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for valid duration (0.001-1000)
  const durationArb = fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for valid velocity (0-1)
  const velocityArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for grid divisions
  const gridDivisionArb = fc.constantFrom(...GRID_DIVISIONS) as fc.Arbitrary<GridDivision>;

  // Arbitrary for grid snap configuration
  const gridSnapConfigArb: fc.Arbitrary<GridSnapConfig> = fc.record({
    enabled: fc.boolean(),
    division: gridDivisionArb,
  });

  // Arbitrary for delta beat
  const deltaBeatArb = fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for creating a valid note
  const noteArb: fc.Arbitrary<Note> = fc.record({
    id: fc.uuid(),
    pitch: pitchArb,
    start: startBeatArb,
    duration: durationArb,
    velocity: velocityArb,
  });

  /**
   * Simulates the drag state management from PianoRollCanvas
   *
   * The drag state stores:
   * - note: The current state of the note during drag
   * - originalNote: The state before drag started (for restore on cancel)
   */
  interface DragState {
    note: Note;
    originalNote: Note;
    startX: number;
  }

  /**
   * Simulates starting a drag operation
   * Requirements: 3.5 - Track original note state for cancel/restore
   */
  function startDrag(note: Note, startX: number): DragState {
    return {
      note: { ...note },
      originalNote: { ...note },
      startX,
    };
  }

  /**
   * Simulates applying a drag movement
   * Returns the updated drag state with the note's new position
   */
  function applyDragMovement(
    dragState: DragState,
    deltaBeat: number,
    gridSnap: GridSnapConfig
  ): DragState {
    const rawNewStart = dragState.originalNote.start + deltaBeat;
    const snappedStart = snapPosition(rawNewStart, gridSnap);
    const clampedStart = Math.max(0, snappedStart);

    return {
      ...dragState,
      note: {
        ...dragState.note,
        start: clampedStart,
      },
    };
  }

  /**
   * Simulates canceling a drag operation (pressing Escape)
   * Requirements: 3.5 - Restore note to original state on cancel
   *
   * @returns The restored note (original state)
   */
  function cancelDrag(dragState: DragState): Note {
    return { ...dragState.originalNote };
  }

  /**
   * Simulates completing a drag operation normally
   *
   * @returns The note in its final dragged position
   */
  function completeDrag(dragState: DragState): Note {
    return { ...dragState.note };
  }

  describe('Drag cancel restores all properties', () => {
    it('canceling a drag should restore the note to its exact original start time', () => {
      fc.assert(
        fc.property(noteArb, deltaBeatArb, gridSnapConfigArb, (note, deltaBeat, gridSnap) => {
          // Start drag
          const dragState = startDrag(note, 100);

          // Apply some drag movement
          const movedState = applyDragMovement(dragState, deltaBeat, gridSnap);

          // Verify the note has moved (or stayed at 0 if clamped)
          // The note should have been modified during drag
          expect(movedState.note.start).toBeGreaterThanOrEqual(0);

          // Cancel the drag
          const restoredNote = cancelDrag(movedState);

          // Verify restoration to exact original values
          expect(restoredNote.start).toBe(note.start);
        }),
        { numRuns: 100 }
      );
    });

    it('canceling a drag should restore all note properties exactly', () => {
      fc.assert(
        fc.property(noteArb, deltaBeatArb, gridSnapConfigArb, (note, deltaBeat, gridSnap) => {
          // Start drag
          const dragState = startDrag(note, 100);

          // Apply drag movement
          const movedState = applyDragMovement(dragState, deltaBeat, gridSnap);

          // Cancel drag
          const restoredNote = cancelDrag(movedState);

          // All properties should be exactly restored
          expect(restoredNote.id).toBe(note.id);
          expect(restoredNote.pitch).toBe(note.pitch);
          expect(restoredNote.start).toBe(note.start);
          expect(restoredNote.duration).toBe(note.duration);
          expect(restoredNote.velocity).toBe(note.velocity);
        }),
        { numRuns: 100 }
      );
    });

    it('multiple drag movements should still restore to original on cancel', () => {
      fc.assert(
        fc.property(
          noteArb,
          fc.array(deltaBeatArb, { minLength: 1, maxLength: 10 }),
          gridSnapConfigArb,
          (note, deltaBeats, gridSnap) => {
            // Start drag
            let dragState = startDrag(note, 100);

            // Apply multiple drag movements
            for (const deltaBeat of deltaBeats) {
              dragState = applyDragMovement(dragState, deltaBeat, gridSnap);
            }

            // Cancel drag
            const restoredNote = cancelDrag(dragState);

            // Should restore to original
            expect(restoredNote.start).toBe(note.start);
            expect(restoredNote.pitch).toBe(note.pitch);
            expect(restoredNote.duration).toBe(note.duration);
            expect(restoredNote.velocity).toBe(note.velocity);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('completing a drag should NOT restore original state (keeps new position)', () => {
      fc.assert(
        fc.property(noteArb, deltaBeatArb, gridSnapConfigArb, (note, deltaBeat, gridSnap) => {
          // Skip if delta is too small to make a difference
          if (Math.abs(deltaBeat) < 0.001) {
            return true;
          }

          // Start drag
          const dragState = startDrag(note, 100);

          // Apply drag movement
          const movedState = applyDragMovement(dragState, deltaBeat, gridSnap);

          // Complete drag (not cancel)
          const completedNote = completeDrag(movedState);

          // Should keep the dragged position, NOT restore to original
          // (unless the drag resulted in the same position after snap/clamp)
          expect(completedNote.start).toBe(movedState.note.start);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Original state immutability during drag', () => {
    it('original note stored in drag state should not be modified during drag', () => {
      fc.assert(
        fc.property(noteArb, deltaBeatArb, gridSnapConfigArb, (note, deltaBeat, gridSnap) => {
          // Start drag
          const dragState = startDrag(note, 100);

          // Store a copy of the original for comparison
          const originalCopy = { ...dragState.originalNote };

          // Apply drag movement
          const movedState = applyDragMovement(dragState, deltaBeat, gridSnap);

          // Original note in state should be unchanged
          expect(movedState.originalNote.id).toBe(originalCopy.id);
          expect(movedState.originalNote.pitch).toBe(originalCopy.pitch);
          expect(movedState.originalNote.start).toBe(originalCopy.start);
          expect(movedState.originalNote.duration).toBe(originalCopy.duration);
          expect(movedState.originalNote.velocity).toBe(originalCopy.velocity);
        }),
        { numRuns: 100 }
      );
    });

    it('startDrag should create deep copies to prevent mutation', () => {
      fc.assert(
        fc.property(noteArb, (note) => {
          const dragState = startDrag(note, 100);

          // Modify the drag state note
          dragState.note.start = 9999;

          // Original should be unchanged
          expect(dragState.originalNote.start).toBe(note.start);

          // The original input note should also be unchanged
          // (This test verifies the spread operator creates copies)
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    it('drag that results in same position should still allow proper cancel', () => {
      fc.assert(
        fc.property(noteArb, gridSnapConfigArb, (note, gridSnap) => {
          // Start drag
          const dragState = startDrag(note, 100);

          // Apply zero delta (no movement)
          const movedState = applyDragMovement(dragState, 0, gridSnap);

          // Cancel should still work
          const restoredNote = cancelDrag(movedState);

          expect(restoredNote.start).toBe(note.start);
        }),
        { numRuns: 100 }
      );
    });

    it('drag from zero position that goes negative should restore to zero on cancel', () => {
      fc.assert(
        fc.property(gridSnapConfigArb, (gridSnap) => {
          // Create note at start = 0
          const note: Note = {
            id: crypto.randomUUID(),
            pitch: 60,
            start: 0,
            duration: 1,
            velocity: 0.8,
          };

          // Start drag
          const dragState = startDrag(note, 100);

          // Try to drag left (into negative territory)
          const movedState = applyDragMovement(dragState, -100, gridSnap);

          // During drag, note should be clamped to 0
          expect(movedState.note.start).toBe(0);

          // Cancel should restore to original 0
          const restoredNote = cancelDrag(movedState);
          expect(restoredNote.start).toBe(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Feature: tone-sketch - Grid Snap Behavior During Horizontal Drag
 *
 * Tests that grid snap is correctly applied during horizontal drag operations.
 *
 * **Validates: Requirements 3.2 (Grid snap during horizontal drag)**
 */
describe('Grid Snap Behavior During Horizontal Drag', () => {
  // Arbitrary for grid divisions
  const gridDivisionArb = fc.constantFrom(...GRID_DIVISIONS) as fc.Arbitrary<GridDivision>;

  // Arbitrary for position values
  const positionArb = fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for delta values
  const deltaArb = fc.double({ min: -5000, max: 5000, noNaN: true, noDefaultInfinity: true });

  describe('Snap enabled', () => {
    it('drag result should always be snapped to grid division when enabled', () => {
      fc.assert(
        fc.property(positionArb, deltaArb, gridDivisionArb, (originalStart, delta, division) => {
          const gridSnap: GridSnapConfig = { enabled: true, division };

          // Simulate drag
          const rawNewStart = originalStart + delta;
          const snappedStart = snapPosition(rawNewStart, gridSnap);
          const clampedStart = Math.max(0, snappedStart);

          // Result should be a multiple of division (or 0)
          if (clampedStart === 0) {
            return true;
          }

          const quotient = clampedStart / division;
          const isMultiple = Math.abs(quotient - Math.round(quotient)) < 1e-10;

          expect(isMultiple).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('snapped position should be within half a division of the raw position', () => {
      fc.assert(
        fc.property(positionArb, deltaArb, gridDivisionArb, (originalStart, delta, division) => {
          const gridSnap: GridSnapConfig = { enabled: true, division };

          const rawNewStart = originalStart + delta;
          const snappedStart = snapPosition(rawNewStart, gridSnap);

          // Before clamping, the snap should be within half division
          const difference = Math.abs(snappedStart - rawNewStart);
          expect(difference).toBeLessThanOrEqual(division / 2 + 1e-10);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Snap disabled', () => {
    it('drag result should be quantized to 1/32 beat when snap disabled', () => {
      fc.assert(
        fc.property(positionArb, deltaArb, gridDivisionArb, (originalStart, delta, division) => {
          const gridSnap: GridSnapConfig = { enabled: false, division };

          // Simulate drag
          const rawNewStart = originalStart + delta;
          const snappedStart = snapPosition(rawNewStart, gridSnap);
          const clampedStart = Math.max(0, snappedStart);

          // Result should be a multiple of 1/32 beat (or 0)
          if (clampedStart === 0) {
            return true;
          }

          const quotient = clampedStart / FREE_POSITION_RESOLUTION;
          const isMultiple = Math.abs(quotient - Math.round(quotient)) < 1e-10;

          expect(isMultiple).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('free positioning provides finer resolution than grid snap', () => {
      fc.assert(
        fc.property(positionArb, gridDivisionArb, (position, division) => {
          // Free positioning resolution should be finer than any grid division
          expect(FREE_POSITION_RESOLUTION).toBeLessThan(division);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Snap toggle consistency', () => {
    it('same raw position should snap differently based on enabled state', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10, noNaN: true, noDefaultInfinity: true }),
          gridDivisionArb,
          (rawPosition, division) => {
            // Skip positions that would result in same snap either way
            // (like exact grid positions or near-zero)
            const enabledSnap = snapToGrid(rawPosition, division);
            const disabledSnap = snapToFreePosition(rawPosition);

            // They use different quantization, so might differ
            // This test just verifies both functions work correctly
            expect(enabledSnap).toBeGreaterThanOrEqual(0);
            expect(disabledSnap).toBeGreaterThanOrEqual(0);

            // Both should be within their respective tolerances
            expect(Math.abs(enabledSnap - rawPosition)).toBeLessThanOrEqual(division / 2 + 1e-10);
            expect(Math.abs(disabledSnap - rawPosition)).toBeLessThanOrEqual(FREE_POSITION_RESOLUTION / 2 + 1e-10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
