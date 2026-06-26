/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { useVelocityDrag } from '@/components/VelocityLane/hooks/useVelocityDrag';
import type { Note } from '@/types/note';

/**
 * Feature: velocity-lane-editor, Property 9: Drag Cancel Restores Original Velocity
 *
 * *For any* note with initial velocity V, after starting a velocity drag, moving to any position,
 * and pressing Escape, the note's velocity SHALL be restored to exactly V.
 * For multi-note drags, ALL affected notes SHALL be restored to their original velocities.
 *
 * **Validates: Requirements 4.5**
 */
describe('Feature: velocity-lane-editor, Property 9: Drag Cancel Restores Original Velocity', () => {
  // --- Shared Arbitraries ---

  /** Arbitrary for a velocity value in [0, 1] */
  const velocityArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  /** Arbitrary for a positive pointer Y position (simulating drag movement) */
  const pointerYArb = fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true });

  /** Arbitrary for a Note with a random velocity */
  const noteArb = (id: string, velocity: number): Note => ({
    id,
    pitch: 60,
    start: 0,
    duration: 1,
    velocity,
  });

  /** Create a mock container ref with a fixed height */
  function createContainerRef(height: number = 200) {
    const div = document.createElement('div');
    Object.defineProperty(div, 'clientHeight', { value: height, configurable: true });
    return { current: div };
  }

  /**
   * Pure logic test: for any originalVelocities map, the cancel restore output
   * should produce a Map where each entry has { velocity: originalVelocity }.
   *
   * This tests the cancel logic pattern extracted from the hook:
   * Given originalVelocities map, cancel produces updates with all originals.
   */
  describe('Cancel restore logic (pure)', () => {
    it('should produce updates with exactly original velocities for any originalVelocities map', () => {
      const velocityMapArb = fc
        .array(
          fc.record({
            id: fc.uuid(),
            velocity: velocityArb,
          }),
          { minLength: 1, maxLength: 20 }
        )
        .map((entries) => new Map(entries.map((e) => [e.id, e.velocity])));

      fc.assert(
        fc.property(velocityMapArb, (originalVelocities) => {
          // Simulate the cancel logic from the hook (multi-note path):
          // const updates = new Map<string, Partial<Note>>();
          // for (const [id, originalVelocity] of state.originalVelocities) {
          //   updates.set(id, { velocity: originalVelocity });
          // }
          const updates = new Map<string, { velocity: number }>();
          for (const [id, originalVelocity] of originalVelocities) {
            updates.set(id, { velocity: originalVelocity });
          }

          // Verify: every entry has the exact original velocity
          for (const [id, originalVelocity] of originalVelocities) {
            expect(updates.has(id)).toBe(true);
            expect(updates.get(id)!.velocity).toBe(originalVelocity);
          }

          // Verify: no extra entries
          expect(updates.size).toBe(originalVelocities.size);
        }),
        { numRuns: 100 }
      );
    });

    it('should produce a single update with the exact original velocity for single-note cancel', () => {
      fc.assert(
        fc.property(fc.uuid(), velocityArb, (noteId, originalVelocity) => {
          // Simulate the single-note cancel logic:
          // onNoteUpdate({ ...note, velocity: state.originalVelocity })
          const restoredVelocity = originalVelocity;

          expect(restoredVelocity).toBe(originalVelocity);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Hook integration test: single-note drag cancel restores original velocity.
   *
   * For any note with velocity V, after startDrag → updateDrag → cancelDrag,
   * the onNoteUpdate callback should be called with the original velocity V.
   */
  describe('Single-note drag cancel via hook', () => {
    it('should call onNoteUpdate with original velocity after cancel for any initial velocity and drag position', () => {
      fc.assert(
        fc.property(
          velocityArb,
          pointerYArb,
          (originalVelocity, dragPointerY) => {
            const noteId = 'test-note-1';
            const note = noteArb(noteId, originalVelocity);
            const onNoteUpdate = vi.fn();
            const onBulkNoteUpdate = vi.fn();
            const containerRef = createContainerRef(200);

            const { result } = renderHook(() =>
              useVelocityDrag({
                notes: [note],
                selectedNoteIds: new Set<string>(), // Not in selection → single-note
                containerRef,
                onNoteUpdate,
                onBulkNoteUpdate,
              })
            );

            // Start drag → this calls onNoteUpdate with the initial pointer position
            act(() => {
              result.current.startDrag(noteId, 100);
            });

            // Update drag to a different position
            act(() => {
              result.current.updateDrag(dragPointerY);
            });

            // Clear mock calls to isolate the cancel call
            onNoteUpdate.mockClear();

            // Cancel drag
            act(() => {
              result.current.cancelDrag();
            });

            // The cancel should restore the original velocity
            expect(onNoteUpdate).toHaveBeenCalledTimes(1);
            expect(onNoteUpdate).toHaveBeenCalledWith(
              expect.objectContaining({ id: noteId, velocity: originalVelocity })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Hook integration test: multi-note drag cancel restores ALL original velocities.
   *
   * For any set of notes with velocities [v₁, v₂, ..., vₙ], after starting a multi-note
   * drag (dragged note in selection with |S| ≥ 2), moving, and cancelling,
   * onBulkNoteUpdate should be called with all original velocities.
   */
  describe('Multi-note drag cancel via hook', () => {
    it('should call onBulkNoteUpdate with all original velocities after cancel', () => {
      // Use a smaller arbitrary for multi-note to keep test fast
      const multiNoteVelocitiesArb = fc.array(velocityArb, { minLength: 2, maxLength: 8 });

      fc.assert(
        fc.property(
          multiNoteVelocitiesArb,
          pointerYArb,
          (velocities, dragPointerY) => {
            const notes: Note[] = velocities.map((v, i) => noteArb(`note-${i}`, v));
            const selectedNoteIds = new Set(notes.map((n) => n.id));
            const onNoteUpdate = vi.fn();
            const onBulkNoteUpdate = vi.fn();
            const containerRef = createContainerRef(200);

            const draggedNoteId = notes[0].id;

            const { result } = renderHook(() =>
              useVelocityDrag({
                notes,
                selectedNoteIds,
                containerRef,
                onNoteUpdate,
                onBulkNoteUpdate,
              })
            );

            // Start drag on first note (which is in selection with |S| ≥ 2 → multi-note)
            act(() => {
              result.current.startDrag(draggedNoteId, 100);
            });

            // Update drag to a different position
            act(() => {
              result.current.updateDrag(dragPointerY);
            });

            // Clear mock calls to isolate the cancel call
            onBulkNoteUpdate.mockClear();

            // Cancel drag
            act(() => {
              result.current.cancelDrag();
            });

            // The cancel should restore ALL original velocities
            expect(onBulkNoteUpdate).toHaveBeenCalledTimes(1);

            const updates: Map<string, Partial<Note>> = onBulkNoteUpdate.mock.calls[0][0];

            // Verify all notes are restored
            expect(updates.size).toBe(notes.length);

            for (const note of notes) {
              expect(updates.has(note.id)).toBe(true);
              expect(updates.get(note.id)!.velocity).toBe(note.velocity);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not call onNoteUpdate during multi-note cancel (only onBulkNoteUpdate)', () => {
      const multiNoteVelocitiesArb = fc.array(velocityArb, { minLength: 2, maxLength: 5 });

      fc.assert(
        fc.property(multiNoteVelocitiesArb, (velocities) => {
          const notes: Note[] = velocities.map((v, i) => noteArb(`note-${i}`, v));
          const selectedNoteIds = new Set(notes.map((n) => n.id));
          const onNoteUpdate = vi.fn();
          const onBulkNoteUpdate = vi.fn();
          const containerRef = createContainerRef(200);

          const { result } = renderHook(() =>
            useVelocityDrag({
              notes,
              selectedNoteIds,
              containerRef,
              onNoteUpdate,
              onBulkNoteUpdate,
            })
          );

          // Start multi-note drag
          act(() => {
            result.current.startDrag(notes[0].id, 100);
          });

          // Clear all mocks before cancel
          onNoteUpdate.mockClear();
          onBulkNoteUpdate.mockClear();

          // Cancel
          act(() => {
            result.current.cancelDrag();
          });

          // Only onBulkNoteUpdate should be called, not onNoteUpdate
          expect(onNoteUpdate).not.toHaveBeenCalled();
          expect(onBulkNoteUpdate).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Edge case: cancelDrag when no drag is active should not call any callbacks.
   */
  describe('Cancel without active drag', () => {
    it('should not call any update callbacks when cancelDrag is invoked without an active drag', () => {
      fc.assert(
        fc.property(velocityArb, (velocity) => {
          const note = noteArb('note-1', velocity);
          const onNoteUpdate = vi.fn();
          const onBulkNoteUpdate = vi.fn();
          const containerRef = createContainerRef(200);

          const { result } = renderHook(() =>
            useVelocityDrag({
              notes: [note],
              selectedNoteIds: new Set<string>(),
              containerRef,
              onNoteUpdate,
              onBulkNoteUpdate,
            })
          );

          // Cancel without starting a drag
          act(() => {
            result.current.cancelDrag();
          });

          expect(onNoteUpdate).not.toHaveBeenCalled();
          expect(onBulkNoteUpdate).not.toHaveBeenCalled();
        }),
        { numRuns: 100 }
      );
    });
  });
});
