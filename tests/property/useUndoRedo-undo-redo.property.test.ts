// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyUndo, applyRedo } from '../../hooks/useUndoRedo/useUndoRedo';
import type { Note } from '../../types/note';
import type {
  UndoAction,
  CreateAction,
  DeleteAction,
  ModifyAction,
  BatchAction,
} from '../../hooks/useUndoRedo/types';

// --- Arbitraries ---

/** Generate a valid Note with a specific ID */
function arbNoteWithId(id: string): fc.Arbitrary<Note> {
  return fc.record({
    id: fc.constant(id),
    pitch: fc.integer({ min: 0, max: 127 }),
    start: fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
    duration: fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true }),
    velocity: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  });
}

/** Generate a valid Note with a random UUID */
const arbNote: fc.Arbitrary<Note> = fc.uuid().chain((id) => arbNoteWithId(id));

/** Generate an array of 0-20 notes with unique IDs */
const arbNotes: fc.Arbitrary<Note[]> = fc
  .array(arbNote, { minLength: 0, maxLength: 20 })
  .map((notes) => {
    // Ensure unique IDs by deduplicating
    const seen = new Set<string>();
    return notes.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  });

/** Generate a create action with a note ID not in existingNotes */
function arbCreateAction(existingNotes: Note[]): fc.Arbitrary<CreateAction> {
  const existingIds = new Set(existingNotes.map((n) => n.id));
  return fc
    .uuid()
    .filter((id) => !existingIds.has(id))
    .chain((id) =>
      arbNoteWithId(id).map((note) => ({
        type: 'create' as const,
        note,
      }))
    );
}

/** Generate a delete action that targets an existing note (requires non-empty array) */
function arbDeleteAction(existingNotes: Note[]): fc.Arbitrary<DeleteAction> {
  return fc
    .integer({ min: 0, max: existingNotes.length - 1 })
    .map((idx) => ({
      type: 'delete' as const,
      note: existingNotes[idx],
    }));
}

/** Generate a modify action that targets an existing note */
function arbModifyAction(existingNotes: Note[]): fc.Arbitrary<ModifyAction> {
  return fc
    .integer({ min: 0, max: existingNotes.length - 1 })
    .chain((idx) => {
      const beforeNote = existingNotes[idx];
      return arbNoteWithId(beforeNote.id).map((afterNote) => ({
        type: 'modify' as const,
        noteId: beforeNote.id,
        before: beforeNote,
        after: afterNote,
      }));
    });
}

/** Generate a batch action with 1-5 sub-operations */
function arbBatchAction(existingNotes: Note[]): fc.Arbitrary<BatchAction> {
  // For batch actions, we generate a mix of operations that are valid
  // given the initial notes state. We'll keep it simple: just modify or create ops
  // to avoid complications with deleting notes that later operations reference.
  const ops: fc.Arbitrary<(CreateAction | DeleteAction | ModifyAction)[]> = fc
    .integer({ min: 1, max: 5 })
    .chain((count): fc.Arbitrary<(CreateAction | DeleteAction | ModifyAction)[]> => {
      if (existingNotes.length === 0) {
        // Can only create when no notes exist
        return fc.array(arbCreateAction(existingNotes), {
          minLength: 1,
          maxLength: count,
        });
      }
      // Generate only modify actions for batch to keep things consistent
      return fc.array(arbModifyAction(existingNotes), {
        minLength: 1,
        maxLength: Math.min(count, existingNotes.length),
      });
    })
    .map((operations: (CreateAction | DeleteAction | ModifyAction)[]) => {
      // Ensure we don't have duplicate noteIds in modify operations
      const seen = new Set<string>();
      return operations.filter((op) => {
        const id = op.type === 'modify' ? op.noteId : (op as CreateAction | DeleteAction).note.id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    })
    .filter((operations) => operations.length > 0);

  return ops.map((operations) => ({
    type: 'batch' as const,
    operations,
  }));
}

/** Generate a valid action for the given notes state */
function arbValidAction(existingNotes: Note[]): fc.Arbitrary<UndoAction> {
  if (existingNotes.length === 0) {
    // Can only create when no notes exist
    return arbCreateAction(existingNotes);
  }
  return fc.oneof(
    arbCreateAction(existingNotes),
    arbDeleteAction(existingNotes),
    arbModifyAction(existingNotes),
    arbBatchAction(existingNotes)
  );
}

// --- Helpers ---

/** Sort notes by ID for comparison (order-independent deep equality) */
function sortedById(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => a.id.localeCompare(b.id));
}

// --- Property 4: Undo restores pre-action state ---

describe('Feature: piano-roll-undo-redo, Property 4: Undo restores pre-action state', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
   *
   * For any sequence of recorded actions, undoing the most recent action SHALL
   * produce a notes array that is identical to the notes array that existed
   * immediately before that action was originally applied.
   */

  it('undo of create action restores initial notes', () => {
    fc.assert(
      fc.property(arbNotes, (initialNotes) => {
        return fc.assert(
          fc.property(arbCreateAction(initialNotes), (action) => {
            const afterNotes = applyRedo(initialNotes, action);
            const undoneNotes = applyUndo(afterNotes, action);
            expect(sortedById(undoneNotes)).toEqual(sortedById(initialNotes));
          }),
          { numRuns: 1 }
        );
      }),
      { numRuns: 100 }
    );
  });

  it('undo of delete action restores initial notes', () => {
    fc.assert(
      fc.property(
        arbNotes.filter((notes) => notes.length > 0),
        (initialNotes) => {
          return fc.assert(
            fc.property(arbDeleteAction(initialNotes), (action) => {
              const afterNotes = applyRedo(initialNotes, action);
              const undoneNotes = applyUndo(afterNotes, action);
              expect(sortedById(undoneNotes)).toEqual(sortedById(initialNotes));
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('undo of modify action restores initial notes', () => {
    fc.assert(
      fc.property(
        arbNotes.filter((notes) => notes.length > 0),
        (initialNotes) => {
          return fc.assert(
            fc.property(arbModifyAction(initialNotes), (action) => {
              const afterNotes = applyRedo(initialNotes, action);
              const undoneNotes = applyUndo(afterNotes, action);
              expect(sortedById(undoneNotes)).toEqual(sortedById(initialNotes));
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('undo of batch action restores initial notes', () => {
    fc.assert(
      fc.property(
        arbNotes.filter((notes) => notes.length > 0),
        (initialNotes) => {
          return fc.assert(
            fc.property(arbBatchAction(initialNotes), (action) => {
              const afterNotes = applyRedo(initialNotes, action);
              const undoneNotes = applyUndo(afterNotes, action);
              expect(sortedById(undoneNotes)).toEqual(sortedById(initialNotes));
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('undo of any valid action restores initial notes', () => {
    fc.assert(
      fc.property(arbNotes, (initialNotes) => {
        return fc.assert(
          fc.property(arbValidAction(initialNotes), (action) => {
            const afterNotes = applyRedo(initialNotes, action);
            const undoneNotes = applyUndo(afterNotes, action);
            expect(sortedById(undoneNotes)).toEqual(sortedById(initialNotes));
          }),
          { numRuns: 1 }
        );
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 5: Redo re-applies post-action state ---

describe('Feature: piano-roll-undo-redo, Property 5: Redo re-applies post-action state', () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
   *
   * For any undone action, redoing it SHALL produce a notes array that is
   * identical to the notes array that existed immediately after that action
   * was originally applied.
   */

  it('redo after undo of create action produces the post-action state', () => {
    fc.assert(
      fc.property(arbNotes, (initialNotes) => {
        return fc.assert(
          fc.property(arbCreateAction(initialNotes), (action) => {
            const afterNotes = applyRedo(initialNotes, action);
            const undoneNotes = applyUndo(afterNotes, action);
            const redoneNotes = applyRedo(undoneNotes, action);
            expect(sortedById(redoneNotes)).toEqual(sortedById(afterNotes));
          }),
          { numRuns: 1 }
        );
      }),
      { numRuns: 100 }
    );
  });

  it('redo after undo of delete action produces the post-action state', () => {
    fc.assert(
      fc.property(
        arbNotes.filter((notes) => notes.length > 0),
        (initialNotes) => {
          return fc.assert(
            fc.property(arbDeleteAction(initialNotes), (action) => {
              const afterNotes = applyRedo(initialNotes, action);
              const undoneNotes = applyUndo(afterNotes, action);
              const redoneNotes = applyRedo(undoneNotes, action);
              expect(sortedById(redoneNotes)).toEqual(sortedById(afterNotes));
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('redo after undo of modify action produces the post-action state', () => {
    fc.assert(
      fc.property(
        arbNotes.filter((notes) => notes.length > 0),
        (initialNotes) => {
          return fc.assert(
            fc.property(arbModifyAction(initialNotes), (action) => {
              const afterNotes = applyRedo(initialNotes, action);
              const undoneNotes = applyUndo(afterNotes, action);
              const redoneNotes = applyRedo(undoneNotes, action);
              expect(sortedById(redoneNotes)).toEqual(sortedById(afterNotes));
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('redo after undo of batch action produces the post-action state', () => {
    fc.assert(
      fc.property(
        arbNotes.filter((notes) => notes.length > 0),
        (initialNotes) => {
          return fc.assert(
            fc.property(arbBatchAction(initialNotes), (action) => {
              const afterNotes = applyRedo(initialNotes, action);
              const undoneNotes = applyUndo(afterNotes, action);
              const redoneNotes = applyRedo(undoneNotes, action);
              expect(sortedById(redoneNotes)).toEqual(sortedById(afterNotes));
            }),
            { numRuns: 1 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('redo after undo of any valid action produces the post-action state', () => {
    fc.assert(
      fc.property(arbNotes, (initialNotes) => {
        return fc.assert(
          fc.property(arbValidAction(initialNotes), (action) => {
            const afterNotes = applyRedo(initialNotes, action);
            const undoneNotes = applyUndo(afterNotes, action);
            const redoneNotes = applyRedo(undoneNotes, action);
            expect(sortedById(redoneNotes)).toEqual(sortedById(afterNotes));
          }),
          { numRuns: 1 }
        );
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 6: Undo-redo round trip ---

describe('Feature: piano-roll-undo-redo, Property 6: Undo-redo round trip', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5**
   *
   * For any action, performing undo followed by redo SHALL produce a notes array
   * identical to the state after the original action. Conversely, performing redo
   * followed by undo (after an initial undo) SHALL produce a notes array identical
   * to the state before the original action.
   */

  it('undo then redo produces the post-action state', () => {
    fc.assert(
      fc.property(arbNotes, (initialNotes) => {
        return fc.assert(
          fc.property(arbValidAction(initialNotes), (action) => {
            const afterNotes = applyRedo(initialNotes, action);
            const roundTripped = applyRedo(applyUndo(afterNotes, action), action);
            expect(sortedById(roundTripped)).toEqual(sortedById(afterNotes));
          }),
          { numRuns: 1 }
        );
      }),
      { numRuns: 100 }
    );
  });

  it('redo then undo (after initial undo) produces the pre-action state', () => {
    fc.assert(
      fc.property(arbNotes, (initialNotes) => {
        return fc.assert(
          fc.property(arbValidAction(initialNotes), (action) => {
            const afterNotes = applyRedo(initialNotes, action);
            const undoneNotes = applyUndo(afterNotes, action);
            const roundTripped = applyUndo(applyRedo(undoneNotes, action), action);
            expect(sortedById(roundTripped)).toEqual(sortedById(initialNotes));
          }),
          { numRuns: 1 }
        );
      }),
      { numRuns: 100 }
    );
  });

  it('multiple undo-redo cycles are idempotent (create)', () => {
    fc.assert(
      fc.property(arbNotes, (initialNotes) => {
        return fc.assert(
          fc.property(arbCreateAction(initialNotes), (action) => {
            const afterNotes = applyRedo(initialNotes, action);

            // Multiple round trips should always return to afterNotes
            let current = afterNotes;
            for (let i = 0; i < 3; i++) {
              current = applyUndo(current, action);
              expect(sortedById(current)).toEqual(sortedById(initialNotes));
              current = applyRedo(current, action);
              expect(sortedById(current)).toEqual(sortedById(afterNotes));
            }
          }),
          { numRuns: 1 }
        );
      }),
      { numRuns: 100 }
    );
  });

  it('multiple undo-redo cycles are idempotent (any valid action)', () => {
    fc.assert(
      fc.property(arbNotes, (initialNotes) => {
        return fc.assert(
          fc.property(arbValidAction(initialNotes), (action) => {
            const afterNotes = applyRedo(initialNotes, action);

            let current = afterNotes;
            for (let i = 0; i < 3; i++) {
              current = applyUndo(current, action);
              expect(sortedById(current)).toEqual(sortedById(initialNotes));
              current = applyRedo(current, action);
              expect(sortedById(current)).toEqual(sortedById(afterNotes));
            }
          }),
          { numRuns: 1 }
        );
      }),
      { numRuns: 100 }
    );
  });
});
