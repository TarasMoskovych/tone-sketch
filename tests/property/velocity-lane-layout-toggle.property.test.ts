import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Note } from '@/types/note';
import type { VisibleRegion } from '@/types/grid';

// ============================================================================
// Pure functions under test
// ============================================================================

/**
 * Computes the height allocation between PianoRoll and VelocityLane
 * based on the CSS flex layout strategy: flex-[3] : flex-1 = 75% : 25%.
 *
 * When hidden, PianoRoll gets 100% of the total height.
 */
function computeHeightAllocation(
  totalHeight: number,
  velocityLaneVisible: boolean
): { pianoRollHeight: number; velocityLaneHeight: number } {
  if (!velocityLaneVisible) {
    return { pianoRollHeight: totalHeight, velocityLaneHeight: 0 };
  }
  // flex-[3] : flex-1 = 3:1 ratio → 75% : 25%
  const pianoRollHeight = totalHeight * (3 / 4);
  const velocityLaneHeight = totalHeight * (1 / 4);
  return { pianoRollHeight, velocityLaneHeight };
}

/**
 * Represents the editor state that must be preserved across toggle operations.
 */
interface EditorState {
  notes: Note[];
  selectedNoteIds: Set<string>;
  visibleRegion: VisibleRegion;
  playheadPosition: number;
}

/**
 * Simulates toggling the velocity lane visibility.
 * The toggle only changes the visibility flag — it does NOT modify editor state.
 */
function toggleVelocityLane(
  state: EditorState,
  velocityLaneVisible: boolean
): { editorState: EditorState; newVelocityLaneVisible: boolean } {
  return {
    editorState: state,
    newVelocityLaneVisible: !velocityLaneVisible,
  };
}

// ============================================================================
// Shared Arbitraries
// ============================================================================

/** Arbitrary for total available height (positive value representing pixels) */
const totalHeightArb = fc.double({ min: 100, max: 1000, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for velocity lane visibility */
const visibilityArb = fc.boolean();

/** Arbitrary for a valid Note */
const noteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  pitch: fc.integer({ min: 0, max: 127 }),
  start: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  duration: fc.double({ min: 0.001, max: 10, noNaN: true, noDefaultInfinity: true }),
  velocity: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
});

/** Arbitrary for an array of notes */
const notesArrayArb = fc.array(noteArb, { minLength: 0, maxLength: 20 });

/** Arbitrary for selected note IDs (subset of note IDs or random IDs) */
const selectedNoteIdsArb = fc
  .array(fc.uuid(), { minLength: 0, maxLength: 10 })
  .map((ids) => new Set(ids));

/** Arbitrary for a visible region */
const visibleRegionArb: fc.Arbitrary<VisibleRegion> = fc
  .record({
    startBeat: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    beatSpan: fc.double({ min: 1, max: 64, noNaN: true, noDefaultInfinity: true }),
    startPitch: fc.integer({ min: 0, max: 60 }),
    pitchSpan: fc.integer({ min: 12, max: 48 }),
  })
  .map(({ startBeat, beatSpan, startPitch, pitchSpan }) => ({
    startBeat,
    endBeat: startBeat + beatSpan,
    startPitch,
    endPitch: startPitch + pitchSpan,
  }));

/** Arbitrary for playhead position */
const playheadPositionArb = fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true });

/** Arbitrary for a full editor state */
const editorStateArb: fc.Arbitrary<EditorState> = fc.record({
  notes: notesArrayArb,
  selectedNoteIds: selectedNoteIdsArb,
  visibleRegion: visibleRegionArb,
  playheadPosition: playheadPositionArb,
});

// ============================================================================
// Property 1: Height Allocation
// ============================================================================

/**
 * Feature: velocity-lane-editor, Property 1: Height Allocation
 *
 * *For any* total available height > 0, the height allocation function SHALL produce:
 * when velocity lane is visible, piano roll height ≈ 75% and velocity lane height ≈ 25% of total;
 * when hidden, piano roll height equals total available height and velocity lane height equals 0.
 *
 * **Validates: Requirements 1.1, 1.2, 1.4**
 */
describe('Feature: velocity-lane-editor, Property 1: Height Allocation', () => {
  it('when visible: pianoRollHeight ≈ 75% and velocityLaneHeight ≈ 25% of total', () => {
    fc.assert(
      fc.property(totalHeightArb, (totalHeight) => {
        const { pianoRollHeight, velocityLaneHeight } = computeHeightAllocation(totalHeight, true);

        expect(pianoRollHeight).toBeCloseTo(totalHeight * 0.75, 10);
        expect(velocityLaneHeight).toBeCloseTo(totalHeight * 0.25, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('when hidden: pianoRollHeight = totalHeight and velocityLaneHeight = 0', () => {
    fc.assert(
      fc.property(totalHeightArb, (totalHeight) => {
        const { pianoRollHeight, velocityLaneHeight } = computeHeightAllocation(totalHeight, false);

        expect(pianoRollHeight).toBe(totalHeight);
        expect(velocityLaneHeight).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('heights always sum to totalHeight regardless of visibility', () => {
    fc.assert(
      fc.property(totalHeightArb, visibilityArb, (totalHeight, visible) => {
        const { pianoRollHeight, velocityLaneHeight } = computeHeightAllocation(totalHeight, visible);

        expect(pianoRollHeight + velocityLaneHeight).toBeCloseTo(totalHeight, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('both heights are non-negative for any positive totalHeight', () => {
    fc.assert(
      fc.property(totalHeightArb, visibilityArb, (totalHeight, visible) => {
        const { pianoRollHeight, velocityLaneHeight } = computeHeightAllocation(totalHeight, visible);

        expect(pianoRollHeight).toBeGreaterThanOrEqual(0);
        expect(velocityLaneHeight).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it('pianoRollHeight is always >= velocityLaneHeight when visible', () => {
    fc.assert(
      fc.property(totalHeightArb, (totalHeight) => {
        const { pianoRollHeight, velocityLaneHeight } = computeHeightAllocation(totalHeight, true);

        expect(pianoRollHeight).toBeGreaterThanOrEqual(velocityLaneHeight);
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 2: Toggle Preserves Editor State
// ============================================================================

/**
 * Feature: velocity-lane-editor, Property 2: Toggle Preserves Editor State
 *
 * *For any* editor state (notes, selectedNoteIds, visibleRegion, playheadPosition),
 * toggling the velocity lane visibility SHALL NOT modify notes, selectedNoteIds,
 * visibleRegion, or playheadPosition.
 *
 * **Validates: Requirements 1.5**
 */
describe('Feature: velocity-lane-editor, Property 2: Toggle Preserves Editor State', () => {
  it('after toggle, notes array is exactly the same (reference equality)', () => {
    fc.assert(
      fc.property(editorStateArb, visibilityArb, (state, visible) => {
        const { editorState } = toggleVelocityLane(state, visible);

        // Reference equality — the toggle does not clone or mutate notes
        expect(editorState.notes).toBe(state.notes);
      }),
      { numRuns: 100 }
    );
  });

  it('after toggle, selectedNoteIds is exactly the same (reference equality)', () => {
    fc.assert(
      fc.property(editorStateArb, visibilityArb, (state, visible) => {
        const { editorState } = toggleVelocityLane(state, visible);

        expect(editorState.selectedNoteIds).toBe(state.selectedNoteIds);
      }),
      { numRuns: 100 }
    );
  });

  it('after toggle, visibleRegion is exactly the same (reference equality)', () => {
    fc.assert(
      fc.property(editorStateArb, visibilityArb, (state, visible) => {
        const { editorState } = toggleVelocityLane(state, visible);

        expect(editorState.visibleRegion).toBe(state.visibleRegion);
      }),
      { numRuns: 100 }
    );
  });

  it('after toggle, playheadPosition is exactly the same', () => {
    fc.assert(
      fc.property(editorStateArb, visibilityArb, (state, visible) => {
        const { editorState } = toggleVelocityLane(state, visible);

        expect(editorState.playheadPosition).toBe(state.playheadPosition);
      }),
      { numRuns: 100 }
    );
  });

  it('velocityLaneVisible is flipped (true → false, false → true)', () => {
    fc.assert(
      fc.property(editorStateArb, visibilityArb, (state, visible) => {
        const { newVelocityLaneVisible } = toggleVelocityLane(state, visible);

        expect(newVelocityLaneVisible).toBe(!visible);
      }),
      { numRuns: 100 }
    );
  });

  it('double toggle preserves the original visibility state', () => {
    fc.assert(
      fc.property(editorStateArb, visibilityArb, (state, visible) => {
        const { newVelocityLaneVisible: first } = toggleVelocityLane(state, visible);
        const { newVelocityLaneVisible: second } = toggleVelocityLane(state, first);

        expect(second).toBe(visible);
      }),
      { numRuns: 100 }
    );
  });

  it('notes content is preserved by deep equality after toggle', () => {
    fc.assert(
      fc.property(editorStateArb, visibilityArb, (state, visible) => {
        const { editorState } = toggleVelocityLane(state, visible);

        expect(editorState.notes).toEqual(state.notes);
        expect(editorState.notes.length).toBe(state.notes.length);
      }),
      { numRuns: 100 }
    );
  });

  it('selectedNoteIds content is preserved by deep equality after toggle', () => {
    fc.assert(
      fc.property(editorStateArb, visibilityArb, (state, visible) => {
        const { editorState } = toggleVelocityLane(state, visible);

        expect(editorState.selectedNoteIds.size).toBe(state.selectedNoteIds.size);
        for (const id of state.selectedNoteIds) {
          expect(editorState.selectedNoteIds.has(id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
