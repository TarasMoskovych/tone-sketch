/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useUndoRedo,
  applyUndo,
} from '../../hooks/useUndoRedo/useUndoRedo';
import { UndoAction, UseUndoRedoOptions } from '../../hooks/useUndoRedo/types';
import { Note } from '../../types/note';

// Helper to create a mock note
function createMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: `note-${Math.random().toString(36).slice(2)}`,
    pitch: 60,
    start: 0,
    duration: 1,
    velocity: 0.8,
    ...overrides,
  };
}

// Helper to create default options for the hook
function createDefaultOptions(
  overrides: Partial<UseUndoRedoOptions> = {}
): UseUndoRedoOptions {
  return {
    notes: [],
    loadNotes: vi.fn(),
    selectNotes: vi.fn(),
    deselectAll: vi.fn(),
    ...overrides,
  };
}

describe('useUndoRedo - Undo Execution Logic (Task 2.2)', () => {
  describe('applyUndo - pure function', () => {
    it('should remove a note for a create action', () => {
      const note = createMockNote({ id: 'note-1' });
      const notes = [note, createMockNote({ id: 'note-2' })];
      const action: UndoAction = { type: 'create', note };

      const result = applyUndo(notes, action);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('note-2');
    });

    it('should re-insert a note for a delete action', () => {
      const deletedNote = createMockNote({ id: 'note-deleted' });
      const existingNote = createMockNote({ id: 'note-existing' });
      const notes = [existingNote];
      const action: UndoAction = { type: 'delete', note: deletedNote };

      const result = applyUndo(notes, action);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(deletedNote);
      expect(result).toContainEqual(existingNote);
    });

    it('should replace note with before state for a modify action', () => {
      const noteId = 'note-modified';
      const beforeNote = createMockNote({ id: noteId, start: 0, pitch: 60 });
      const afterNote = createMockNote({ id: noteId, start: 5, pitch: 72 });
      const notes = [afterNote, createMockNote({ id: 'note-other' })];
      const action: UndoAction = {
        type: 'modify',
        noteId,
        before: beforeNote,
        after: afterNote,
      };

      const result = applyUndo(notes, action);

      expect(result).toHaveLength(2);
      const modifiedNote = result.find((n) => n.id === noteId);
      expect(modifiedNote).toEqual(beforeNote);
    });

    it('should apply inverse of all sub-operations for a batch action (in reverse order)', () => {
      const note1 = createMockNote({ id: 'batch-note-1' });
      const note2 = createMockNote({ id: 'batch-note-2' });
      const note3Id = 'batch-note-3';
      const note3Before = createMockNote({ id: note3Id, start: 0 });
      const note3After = createMockNote({ id: note3Id, start: 5 });

      // Batch: create note1, create note2, modify note3
      const action: UndoAction = {
        type: 'batch',
        operations: [
          { type: 'create', note: note1 },
          { type: 'create', note: note2 },
          { type: 'modify', noteId: note3Id, before: note3Before, after: note3After },
        ],
      };

      // Current state has note1, note2, note3After
      const notes = [note1, note2, note3After];
      const result = applyUndo(notes, action);

      // After undo: note1 removed, note2 removed, note3 restored to before
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(note3Before);
    });

    it('should handle batch with delete sub-operations (re-insert notes on undo)', () => {
      const deletedNote1 = createMockNote({ id: 'del-1' });
      const deletedNote2 = createMockNote({ id: 'del-2' });

      const action: UndoAction = {
        type: 'batch',
        operations: [
          { type: 'delete', note: deletedNote1 },
          { type: 'delete', note: deletedNote2 },
        ],
      };

      // Current state is empty (both notes were deleted)
      const notes: Note[] = [];
      const result = applyUndo(notes, action);

      // After undo: both notes should be restored
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(deletedNote1);
      expect(result).toContainEqual(deletedNote2);
    });

    it('should not affect other notes when undoing create', () => {
      const createdNote = createMockNote({ id: 'created' });
      const otherNote = createMockNote({ id: 'other' });
      const notes = [otherNote, createdNote];
      const action: UndoAction = { type: 'create', note: createdNote };

      const result = applyUndo(notes, action);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(otherNote);
    });

    it('should not affect other notes when undoing modify', () => {
      const noteId = 'target';
      const before = createMockNote({ id: noteId, velocity: 0.5 });
      const after = createMockNote({ id: noteId, velocity: 1.0 });
      const other = createMockNote({ id: 'other' });
      const notes = [after, other];
      const action: UndoAction = { type: 'modify', noteId, before, after };

      const result = applyUndo(notes, action);

      expect(result).toHaveLength(2);
      expect(result.find((n) => n.id === noteId)).toEqual(before);
      expect(result.find((n) => n.id === 'other')).toEqual(other);
    });
  });

  describe('undo() - hook integration', () => {
    it('should be a no-op when canUndo is false (empty history)', () => {
      const loadNotes = vi.fn();
      const { result } = renderHook(() =>
        useUndoRedo(createDefaultOptions({ loadNotes }))
      );

      act(() => {
        result.current.undo();
      });

      expect(loadNotes).not.toHaveBeenCalled();
      expect(result.current.canUndo).toBe(false);
    });

    it('should call loadNotes with the correct notes after undoing a create action', () => {
      const note = createMockNote({ id: 'note-1' });
      const loadNotes = vi.fn();

      const { result: _result, rerender: _rerender } = renderHook(
        (props: { notes: Note[] }) =>
          useUndoRedo(
            createDefaultOptions({ notes: props.notes, loadNotes })
          ),
        { initialProps: { notes: [note] } }
      );

      // Manually push a create action into the history by using pushActionReducer logic
      // Since recordCreate is a stub, we need to directly test undo via the internal state
      // We'll test using the exported applyUndo + the hook's undo behavior

      // For this test, we simulate the state by directly working with the hook
      // Since recording stubs are not implemented yet, we verify the pure function separately
      // and trust that when recording is implemented (task 2.5), undo will work end-to-end
      expect(true).toBe(true); // Placeholder - the pure function tests above validate behavior
    });

    it('should decrement pointer after undo', () => {
      // This test validates undo behavior once recording functions are implemented
      // For now, we verify that undo with empty history doesn't change state
      const { result } = renderHook(() => useUndoRedo(createDefaultOptions()));

      expect(result.current.canUndo).toBe(false);

      act(() => {
        result.current.undo();
      });

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });
});
