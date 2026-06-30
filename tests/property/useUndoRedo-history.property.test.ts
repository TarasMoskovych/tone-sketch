// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { pushActionReducer, DEFAULT_MAX_SIZE } from '@/hooks/useUndoRedo/useUndoRedo';
import { UndoAction, CreateAction, DeleteAction, ModifyAction } from '@/hooks/useUndoRedo/types';
import { Note } from '@/types/note';

// --- Arbitraries ---

const arbNote: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  pitch: fc.integer({ min: 0, max: 127 }),
  start: fc.double({ min: 0, max: 10000, noNaN: true }),
  duration: fc.double({ min: 0.001, max: 1000, noNaN: true }),
  velocity: fc.double({ min: 0, max: 1, noNaN: true }),
});

const arbCreateAction: fc.Arbitrary<CreateAction> = arbNote.map((note) => ({
  type: 'create' as const,
  note,
}));

const arbDeleteAction: fc.Arbitrary<DeleteAction> = arbNote.map((note) => ({
  type: 'delete' as const,
  note,
}));

const arbModifyAction: fc.Arbitrary<ModifyAction> = fc.record({
  type: fc.constant('modify' as const),
  noteId: fc.uuid(),
  before: arbNote,
  after: arbNote,
});

const arbUndoAction: fc.Arbitrary<UndoAction> = fc.oneof(
  arbCreateAction,
  arbDeleteAction,
  arbModifyAction
);

/**
 * Feature: piano-roll-undo-redo, Property 7: History branching discards redo
 *
 * *For any* history state where K actions have been undone (K ≥ 1),
 * recording a new action SHALL result in a history of length equal to
 * (original_length - K + 1) with the pointer at the end, and all
 * previously-undone actions SHALL be permanently discarded.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Feature: piano-roll-undo-redo, Property 7: History branching discards redo', () => {
  it('pushing a new action after K undos discards all redo entries and results in length (N - K + 1)', () => {
    fc.assert(
      fc.property(
        // Generate N actions (N >= 2) to build initial history
        fc.integer({ min: 2, max: 50 }).chain((n) =>
          fc.tuple(
            fc.array(arbUndoAction, { minLength: n, maxLength: n }),
            // K is how many actions to "undo" (1 <= K <= N)
            fc.integer({ min: 1, max: n }),
            // The new action to push after undos
            arbUndoAction
          )
        ),
        ([actions, k, newAction]) => {
          const n = actions.length;

          // Build initial state by pushing all N actions
          let state = { actions: [] as UndoAction[], pointer: 0 };
          for (const action of actions) {
            state = pushActionReducer(state, action, DEFAULT_MAX_SIZE);
          }

          // Simulate K undos by setting pointer to (N - K)
          // This means K actions are in the "redo" region
          state = { ...state, pointer: state.actions.length - k };

          // Push a new action
          const result = pushActionReducer(state, newAction, DEFAULT_MAX_SIZE);

          // Expected length: the pointer position before push + 1 (the new action)
          const expectedLength = state.pointer + 1;
          expect(result.actions.length).toBe(expectedLength);

          // Pointer should be at the end
          expect(result.pointer).toBe(result.actions.length);

          // The previously-undone actions should not be present
          // The last action in result should be the new action
          expect(result.actions[result.actions.length - 1]).toBe(newAction);

          // Verify that none of the K undone actions appear after the pointer position
          const undoneActions = actions.slice(n - k);
          for (const undone of undoneActions) {
            expect(result.actions).not.toContain(undone);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pushing after all actions undone (pointer at 0) results in history containing only the new action', () => {
    fc.assert(
      fc.property(
        fc.array(arbUndoAction, { minLength: 1, maxLength: 20 }),
        arbUndoAction,
        (actions, newAction) => {
          // Build initial state
          let state = { actions: [] as UndoAction[], pointer: 0 };
          for (const action of actions) {
            state = pushActionReducer(state, action, DEFAULT_MAX_SIZE);
          }

          // Undo all: set pointer to 0
          state = { ...state, pointer: 0 };

          // Push a new action
          const result = pushActionReducer(state, newAction, DEFAULT_MAX_SIZE);

          // Should only contain the new action
          expect(result.actions.length).toBe(1);
          expect(result.pointer).toBe(1);
          expect(result.actions[0]).toBe(newAction);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pointer always equals actions.length after pushing (positioned at end)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }).chain((n) =>
          fc.tuple(
            fc.array(arbUndoAction, { minLength: n, maxLength: n }),
            fc.integer({ min: 0, max: n }), // arbitrary pointer position
            arbUndoAction
          )
        ),
        ([actions, pointer, newAction]) => {
          // Build state with given actions and arbitrary pointer
          let state = { actions: [] as UndoAction[], pointer: 0 };
          for (const action of actions) {
            state = pushActionReducer(state, action, DEFAULT_MAX_SIZE);
          }
          state = { ...state, pointer };

          const result = pushActionReducer(state, newAction, DEFAULT_MAX_SIZE);

          // Pointer must always be at the end after a push
          expect(result.pointer).toBe(result.actions.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: piano-roll-undo-redo, Property 8: History size limit
 *
 * *For any* sequence of N recorded actions (N > 100), the History_Stack
 * SHALL contain at most 100 undo entries, and the oldest actions beyond
 * the limit SHALL not be recoverable via undo.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */
describe('Feature: piano-roll-undo-redo, Property 8: History size limit', () => {
  it('history never exceeds 100 entries after pushing N > 100 actions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 101, max: 200 }).chain((n) =>
          fc.array(arbUndoAction, { minLength: n, maxLength: n })
        ),
        (actions) => {
          // Build state by pushing all N actions sequentially
          let state = { actions: [] as UndoAction[], pointer: 0 };
          for (const action of actions) {
            state = pushActionReducer(state, action, DEFAULT_MAX_SIZE);
          }

          // History length must not exceed the max size
          expect(state.actions.length).toBeLessThanOrEqual(DEFAULT_MAX_SIZE);

          // Pointer must also be within bounds
          expect(state.pointer).toBeLessThanOrEqual(DEFAULT_MAX_SIZE);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('oldest actions beyond the limit are discarded and not in the final array', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 101, max: 200 }).chain((n) =>
          fc.array(arbUndoAction, { minLength: n, maxLength: n })
        ),
        (actions) => {
          const n = actions.length;

          // Build state by pushing all N actions sequentially
          let state = { actions: [] as UndoAction[], pointer: 0 };
          for (const action of actions) {
            state = pushActionReducer(state, action, DEFAULT_MAX_SIZE);
          }

          // The oldest (N - 100) actions should NOT be in the final array
          const discardedActions = actions.slice(0, n - DEFAULT_MAX_SIZE);
          for (const discarded of discardedActions) {
            expect(state.actions).not.toContain(discarded);
          }

          // The most recent 100 actions should be preserved
          const preservedActions = actions.slice(n - DEFAULT_MAX_SIZE);
          expect(state.actions).toEqual(preservedActions);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('history is exactly 100 when exactly 100 actions remain after enforcing the limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 101, max: 150 }).chain((n) =>
          fc.array(arbUndoAction, { minLength: n, maxLength: n })
        ),
        (actions) => {
          let state = { actions: [] as UndoAction[], pointer: 0 };
          for (const action of actions) {
            state = pushActionReducer(state, action, DEFAULT_MAX_SIZE);
          }

          // With N > 100 pushes, we should have exactly 100
          expect(state.actions.length).toBe(DEFAULT_MAX_SIZE);
          expect(state.pointer).toBe(DEFAULT_MAX_SIZE);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('history does not exceed limit even with intermediate undo-then-push cycles', () => {
    fc.assert(
      fc.property(
        // Generate enough actions to fill beyond the limit
        fc.array(arbUndoAction, { minLength: 110, maxLength: 150 }),
        fc.array(arbUndoAction, { minLength: 5, maxLength: 20 }),
        (initialActions, additionalActions) => {
          // Fill history to capacity
          let state = { actions: [] as UndoAction[], pointer: 0 };
          for (const action of initialActions) {
            state = pushActionReducer(state, action, DEFAULT_MAX_SIZE);
          }

          // Undo a few (simulate pointer moving back)
          const undoCount = Math.min(10, state.actions.length);
          state = { ...state, pointer: state.pointer - undoCount };

          // Push more actions (this should truncate redo and enforce limit)
          for (const action of additionalActions) {
            state = pushActionReducer(state, action, DEFAULT_MAX_SIZE);
          }

          // Must never exceed limit
          expect(state.actions.length).toBeLessThanOrEqual(DEFAULT_MAX_SIZE);
          expect(state.pointer).toBeLessThanOrEqual(DEFAULT_MAX_SIZE);
          expect(state.pointer).toBe(state.actions.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
