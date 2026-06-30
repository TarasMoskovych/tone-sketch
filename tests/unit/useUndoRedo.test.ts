/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useUndoRedo,
  pushActionReducer,
  DEFAULT_MAX_SIZE,
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
    loadNotes: () => {},
    selectNotes: () => {},
    deselectAll: () => {},
    ...overrides,
  };
}

// Helper to create a simple create action
function makeCreateAction(note?: Note): UndoAction {
  return { type: 'create', note: note ?? createMockNote() };
}

// Helper to create a modify action
function makeModifyAction(): UndoAction {
  const note = createMockNote();
  return {
    type: 'modify',
    noteId: note.id,
    before: note,
    after: { ...note, start: note.start + 1 },
  };
}

describe('useUndoRedo - History Stack Management (Task 2.1)', () => {
  describe('initial state', () => {
    it('should start with canUndo = false and canRedo = false', () => {
      const { result } = renderHook(() => useUndoRedo(createDefaultOptions()));

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should default maxSize to 100', () => {
      expect(DEFAULT_MAX_SIZE).toBe(100);
    });
  });

  describe('pushActionReducer - basic appending', () => {
    it('should append action to empty history', () => {
      const action = makeCreateAction();
      const result = pushActionReducer(
        { actions: [], pointer: 0 },
        action,
        DEFAULT_MAX_SIZE
      );

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toBe(action);
      expect(result.pointer).toBe(1);
    });

    it('should append action to existing history at the end', () => {
      const action1 = makeCreateAction();
      const action2 = makeModifyAction();

      const state1 = pushActionReducer(
        { actions: [], pointer: 0 },
        action1,
        DEFAULT_MAX_SIZE
      );
      const state2 = pushActionReducer(state1, action2, DEFAULT_MAX_SIZE);

      expect(state2.actions).toHaveLength(2);
      expect(state2.actions[0]).toBe(action1);
      expect(state2.actions[1]).toBe(action2);
      expect(state2.pointer).toBe(2);
    });

    it('should set pointer to the end after push', () => {
      const action = makeCreateAction();
      const result = pushActionReducer(
        { actions: [], pointer: 0 },
        action,
        DEFAULT_MAX_SIZE
      );

      expect(result.pointer).toBe(result.actions.length);
    });
  });

  describe('pushActionReducer - truncate redo entries', () => {
    it('should discard redo entries when pointer is not at end', () => {
      // Start with 3 actions, pointer at position 1 (2 redo entries)
      const action1 = makeCreateAction();
      const action2 = makeCreateAction();
      const action3 = makeCreateAction();
      const newAction = makeModifyAction();

      const state = {
        actions: [action1, action2, action3],
        pointer: 1, // Only action1 is "applied", action2 and action3 are redo entries
      };

      const result = pushActionReducer(state, newAction, DEFAULT_MAX_SIZE);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toBe(action1);
      expect(result.actions[1]).toBe(newAction);
      expect(result.pointer).toBe(2);
    });

    it('should discard all actions when pointer is at beginning (all undone)', () => {
      const action1 = makeCreateAction();
      const action2 = makeCreateAction();
      const newAction = makeModifyAction();

      const state = {
        actions: [action1, action2],
        pointer: 0, // All actions undone
      };

      const result = pushActionReducer(state, newAction, DEFAULT_MAX_SIZE);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0]).toBe(newAction);
      expect(result.pointer).toBe(1);
    });

    it('should keep actions before pointer and discard the rest', () => {
      const actions = Array.from({ length: 5 }, () => makeCreateAction());
      const newAction = makeModifyAction();

      const state = {
        actions,
        pointer: 3, // actions[0..2] are applied, actions[3..4] are redo entries
      };

      const result = pushActionReducer(state, newAction, DEFAULT_MAX_SIZE);

      expect(result.actions).toHaveLength(4);
      expect(result.actions[0]).toBe(actions[0]);
      expect(result.actions[1]).toBe(actions[1]);
      expect(result.actions[2]).toBe(actions[2]);
      expect(result.actions[3]).toBe(newAction);
      expect(result.pointer).toBe(4);
    });
  });

  describe('pushActionReducer - enforce max size', () => {
    it('should enforce the max size limit by removing oldest entries', () => {
      // Fill to max size
      const actions = Array.from({ length: 100 }, () => makeCreateAction());
      const state = { actions, pointer: 100 };

      const newAction = makeModifyAction();
      const result = pushActionReducer(state, newAction, 100);

      expect(result.actions).toHaveLength(100);
      // The oldest action (actions[0]) should be gone
      expect(result.actions[0]).toBe(actions[1]);
      // The newest action should be the newly pushed one
      expect(result.actions[99]).toBe(newAction);
      expect(result.pointer).toBe(100);
    });

    it('should work with custom max size', () => {
      const actions = Array.from({ length: 5 }, () => makeCreateAction());
      const state = { actions, pointer: 5 };

      const newAction = makeModifyAction();
      const result = pushActionReducer(state, newAction, 5);

      expect(result.actions).toHaveLength(5);
      expect(result.actions[0]).toBe(actions[1]);
      expect(result.actions[4]).toBe(newAction);
      expect(result.pointer).toBe(5);
    });

    it('should remove multiple oldest entries if somehow exceeding max by more than 1', () => {
      // This shouldn't normally happen, but test the robustness
      const actions = Array.from({ length: 3 }, () => makeCreateAction());
      const state = { actions, pointer: 3 };

      const newAction = makeModifyAction();
      // Max size of 2 means we need to remove 2 oldest entries
      const result = pushActionReducer(state, newAction, 2);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0]).toBe(actions[2]);
      expect(result.actions[1]).toBe(newAction);
      expect(result.pointer).toBe(2);
    });

    it('should not exceed max size after truncation and push', () => {
      // 100 actions, pointer at 50, push new action
      // After truncation: 50 actions + 1 new = 51 (under max)
      const actions = Array.from({ length: 100 }, () => makeCreateAction());
      const state = { actions, pointer: 50 };

      const newAction = makeModifyAction();
      const result = pushActionReducer(state, newAction, 100);

      expect(result.actions).toHaveLength(51);
      expect(result.pointer).toBe(51);
    });
  });

  describe('pushActionReducer - combined truncate and max size', () => {
    it('should first truncate redo, then enforce max size', () => {
      // 5 actions, pointer at 3 (so actions[3..4] are redo)
      // Max size = 3
      // After truncate: [a0, a1, a2] + new = [a0, a1, a2, new] (length 4, exceeds max 3)
      // After max enforcement: [a1, a2, new]
      const actions = Array.from({ length: 5 }, () => makeCreateAction());
      const state = { actions, pointer: 3 };

      const newAction = makeModifyAction();
      const result = pushActionReducer(state, newAction, 3);

      expect(result.actions).toHaveLength(3);
      expect(result.actions[0]).toBe(actions[1]);
      expect(result.actions[1]).toBe(actions[2]);
      expect(result.actions[2]).toBe(newAction);
      expect(result.pointer).toBe(3);
    });
  });

  describe('canUndo and canRedo derivation', () => {
    it('canUndo is false when pointer is 0', () => {
      // Test through pushActionReducer
      const state = { actions: [makeCreateAction()], pointer: 0 };
      // pointer === 0 means canUndo = false
      expect(state.pointer > 0).toBe(false);
    });

    it('canUndo is true when pointer > 0', () => {
      const state = pushActionReducer(
        { actions: [], pointer: 0 },
        makeCreateAction(),
        DEFAULT_MAX_SIZE
      );
      expect(state.pointer > 0).toBe(true);
    });

    it('canRedo is false when pointer equals actions length', () => {
      const state = pushActionReducer(
        { actions: [], pointer: 0 },
        makeCreateAction(),
        DEFAULT_MAX_SIZE
      );
      expect(state.pointer < state.actions.length).toBe(false);
    });

    it('canRedo is true when pointer < actions length', () => {
      const state = {
        actions: [makeCreateAction(), makeCreateAction()],
        pointer: 1,
      };
      expect(state.pointer < state.actions.length).toBe(true);
    });
  });

  describe('useUndoRedo hook integration', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useUndoRedo(createDefaultOptions()));

      expect(result.current).toHaveProperty('canUndo');
      expect(result.current).toHaveProperty('canRedo');
      expect(result.current).toHaveProperty('undo');
      expect(result.current).toHaveProperty('redo');
      expect(result.current).toHaveProperty('recordCreate');
      expect(result.current).toHaveProperty('recordDelete');
      expect(result.current).toHaveProperty('recordModify');
      expect(result.current).toHaveProperty('recordBatch');
      expect(result.current).toHaveProperty('clearHistory');
      expect(result.current).toHaveProperty('setDragInProgress');
    });

    it('should accept custom maxSize option', () => {
      const { result } = renderHook(() =>
        useUndoRedo(createDefaultOptions({ maxSize: 50 }))
      );

      // Hook should initialize without errors with custom max size
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });
});
