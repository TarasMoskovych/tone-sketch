/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useUndoRedo,
  getAffectedNoteIds,
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

describe('useUndoRedo - Selection Management (Task 2.4)', () => {
  describe('getAffectedNoteIds - pure function', () => {
    describe('create action', () => {
      it('undo of create → hasRemovals true, no IDs to select', () => {
        const note = createMockNote({ id: 'note-1' });
        const action: UndoAction = { type: 'create', note };

        const result = getAffectedNoteIds(action, 'undo');

        expect(result.toSelect).toEqual([]);
        expect(result.hasRemovals).toBe(true);
      });

      it('redo of create → note ID to select, no removals', () => {
        const note = createMockNote({ id: 'note-1' });
        const action: UndoAction = { type: 'create', note };

        const result = getAffectedNoteIds(action, 'redo');

        expect(result.toSelect).toEqual(['note-1']);
        expect(result.hasRemovals).toBe(false);
      });
    });

    describe('delete action', () => {
      it('undo of delete → note ID to select (restored), no removals', () => {
        const note = createMockNote({ id: 'note-2' });
        const action: UndoAction = { type: 'delete', note };

        const result = getAffectedNoteIds(action, 'undo');

        expect(result.toSelect).toEqual(['note-2']);
        expect(result.hasRemovals).toBe(false);
      });

      it('redo of delete → hasRemovals true, no IDs to select', () => {
        const note = createMockNote({ id: 'note-2' });
        const action: UndoAction = { type: 'delete', note };

        const result = getAffectedNoteIds(action, 'redo');

        expect(result.toSelect).toEqual([]);
        expect(result.hasRemovals).toBe(true);
      });
    });

    describe('modify action', () => {
      it('undo of modify → note ID to select', () => {
        const action: UndoAction = {
          type: 'modify',
          noteId: 'note-3',
          before: createMockNote({ id: 'note-3', start: 0 }),
          after: createMockNote({ id: 'note-3', start: 5 }),
        };

        const result = getAffectedNoteIds(action, 'undo');

        expect(result.toSelect).toEqual(['note-3']);
        expect(result.hasRemovals).toBe(false);
      });

      it('redo of modify → note ID to select', () => {
        const action: UndoAction = {
          type: 'modify',
          noteId: 'note-3',
          before: createMockNote({ id: 'note-3', start: 0 }),
          after: createMockNote({ id: 'note-3', start: 5 }),
        };

        const result = getAffectedNoteIds(action, 'redo');

        expect(result.toSelect).toEqual(['note-3']);
        expect(result.hasRemovals).toBe(false);
      });
    });

    describe('batch action', () => {
      it('undo of batch with delete ops → all restored note IDs to select', () => {
        const note1 = createMockNote({ id: 'batch-1' });
        const note2 = createMockNote({ id: 'batch-2' });
        const action: UndoAction = {
          type: 'batch',
          operations: [
            { type: 'delete', note: note1 },
            { type: 'delete', note: note2 },
          ],
        };

        const result = getAffectedNoteIds(action, 'undo');

        expect(result.toSelect).toEqual(['batch-1', 'batch-2']);
        expect(result.hasRemovals).toBe(false);
      });

      it('redo of batch with create ops → all re-added note IDs to select', () => {
        const note1 = createMockNote({ id: 'batch-1' });
        const note2 = createMockNote({ id: 'batch-2' });
        const action: UndoAction = {
          type: 'batch',
          operations: [
            { type: 'create', note: note1 },
            { type: 'create', note: note2 },
          ],
        };

        const result = getAffectedNoteIds(action, 'redo');

        expect(result.toSelect).toEqual(['batch-1', 'batch-2']);
        expect(result.hasRemovals).toBe(false);
      });

      it('undo of batch with mixed create and delete ops → select restored, flag removals', () => {
        const createdNote = createMockNote({ id: 'created-1' });
        const deletedNote = createMockNote({ id: 'deleted-1' });
        const action: UndoAction = {
          type: 'batch',
          operations: [
            { type: 'create', note: createdNote },
            { type: 'delete', note: deletedNote },
          ],
        };

        // Undo: create → removes note (hasRemovals), delete → restores note (toSelect)
        const result = getAffectedNoteIds(action, 'undo');

        expect(result.toSelect).toEqual(['deleted-1']);
        expect(result.hasRemovals).toBe(true);
      });

      it('undo of batch with only create ops → no IDs to select, hasRemovals', () => {
        const note1 = createMockNote({ id: 'c-1' });
        const note2 = createMockNote({ id: 'c-2' });
        const action: UndoAction = {
          type: 'batch',
          operations: [
            { type: 'create', note: note1 },
            { type: 'create', note: note2 },
          ],
        };

        const result = getAffectedNoteIds(action, 'undo');

        expect(result.toSelect).toEqual([]);
        expect(result.hasRemovals).toBe(true);
      });

      it('batch with modify ops → all modified note IDs to select', () => {
        const action: UndoAction = {
          type: 'batch',
          operations: [
            {
              type: 'modify',
              noteId: 'm-1',
              before: createMockNote({ id: 'm-1', start: 0 }),
              after: createMockNote({ id: 'm-1', start: 5 }),
            },
            {
              type: 'modify',
              noteId: 'm-2',
              before: createMockNote({ id: 'm-2', pitch: 60 }),
              after: createMockNote({ id: 'm-2', pitch: 72 }),
            },
          ],
        };

        const result = getAffectedNoteIds(action, 'undo');

        expect(result.toSelect).toEqual(['m-1', 'm-2']);
        expect(result.hasRemovals).toBe(false);
      });

      it('redo of batch with delete ops → no IDs to select, hasRemovals', () => {
        const note1 = createMockNote({ id: 'del-1' });
        const note2 = createMockNote({ id: 'del-2' });
        const action: UndoAction = {
          type: 'batch',
          operations: [
            { type: 'delete', note: note1 },
            { type: 'delete', note: note2 },
          ],
        };

        const result = getAffectedNoteIds(action, 'redo');

        expect(result.toSelect).toEqual([]);
        expect(result.hasRemovals).toBe(true);
      });
    });
  });

  describe('undo() - selection integration', () => {
    it('should not call selectNotes or deselectAll when undo is a no-op (empty history)', () => {
      const selectNotes = vi.fn();
      const deselectAll = vi.fn();

      const { result } = renderHook(() =>
        useUndoRedo(createDefaultOptions({ selectNotes, deselectAll }))
      );

      act(() => {
        result.current.undo();
      });

      expect(selectNotes).not.toHaveBeenCalled();
      expect(deselectAll).not.toHaveBeenCalled();
    });
  });

  describe('redo() - selection integration', () => {
    it('should not call selectNotes or deselectAll when redo is a no-op (empty history)', () => {
      const selectNotes = vi.fn();
      const deselectAll = vi.fn();

      const { result } = renderHook(() =>
        useUndoRedo(createDefaultOptions({ selectNotes, deselectAll }))
      );

      act(() => {
        result.current.redo();
      });

      expect(selectNotes).not.toHaveBeenCalled();
      expect(deselectAll).not.toHaveBeenCalled();
    });
  });
});
