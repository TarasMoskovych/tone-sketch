import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

import { Note } from '@/types/note';

import {
  UndoAction,
  UseUndoRedoOptions,
  UseUndoRedoReturn,
  CreateAction,
  DeleteAction,
  ModifyAction,
} from './types';

export const DEFAULT_MAX_SIZE = 100;

interface HistoryState {
  actions: UndoAction[];
  pointer: number;
}

const INITIAL_HISTORY_STATE: HistoryState = {
  actions: [],
  pointer: 0,
};

/**
 * Internal pure function that computes the next history state after pushing an action.
 * Exported for unit testing purposes.
 *
 * Handles:
 * 1. Truncating redo entries if pointer is not at the end
 * 2. Appending the new action
 * 3. Enforcing max size by removing the oldest entry when full
 * 4. Updating pointer to point to the end
 */
export function pushActionReducer(
  state: HistoryState,
  action: UndoAction,
  maxSize: number
): HistoryState {
  // 1. Truncate redo entries: keep only actions up to the current pointer
  let newActions = state.actions.slice(0, state.pointer);

  // 2. Append the new action
  newActions = [...newActions, action];

  // 3. Enforce max size: remove oldest entries when exceeding limit
  if (newActions.length > maxSize) {
    newActions = newActions.slice(newActions.length - maxSize);
  }

  // 4. Pointer points to the end (after the newly appended action)
  return {
    actions: newActions,
    pointer: newActions.length,
  };
}

/**
 * Applies the inverse of an action to the notes array (used for undo).
 * - create → remove the note
 * - delete → re-add the note
 * - modify → replace with the before state
 * - batch → apply inverses of all sub-operations (in reverse order)
 */
export function applyUndo(notes: Note[], action: UndoAction): Note[] {
  switch (action.type) {
    case 'create':
      return notes.filter((n) => n.id !== action.note.id);
    case 'delete':
      return [...notes, action.note];
    case 'modify':
      return notes.map((n) => (n.id === action.noteId ? action.before : n));
    case 'batch': {
      let result = notes;
      // Apply sub-operations in reverse order for correct undo semantics
      for (let i = action.operations.length - 1; i >= 0; i--) {
        result = applyUndo(result, action.operations[i]);
      }
      return result;
    }
  }
}

/**
 * Applies an action forward to the notes array (used for redo).
 * - create → re-add the note
 * - delete → remove the note by ID
 * - modify → replace with the after state
 * - batch → apply all sub-operations forward (in original order)
 */
export function applyRedo(notes: Note[], action: UndoAction): Note[] {
  switch (action.type) {
    case 'create':
      return [...notes, action.note];
    case 'delete':
      return notes.filter((n) => n.id !== action.note.id);
    case 'modify':
      return notes.map((n) => (n.id === action.noteId ? action.after : n));
    case 'batch': {
      let result = notes;
      for (let i = 0; i < action.operations.length; i++) {
        result = applyRedo(result, action.operations[i]);
      }
      return result;
    }
  }
}

/**
 * Determines which note IDs should be selected after an undo or redo operation.
 * Returns IDs of notes that were restored or modified, and whether any notes were removed.
 *
 * Selection rules:
 * - Notes that are restored (delete undo, create redo) → select
 * - Notes that are modified (modify undo/redo) → select
 * - Notes that are removed (create undo, delete redo) → not selected, triggers deselectAll
 * - Batch: collect all restored/modified IDs; if only removals, deselectAll
 */
export function getAffectedNoteIds(
  action: UndoAction,
  direction: 'undo' | 'redo'
): { toSelect: string[]; hasRemovals: boolean } {
  switch (action.type) {
    case 'create':
      if (direction === 'undo') {
        // Undo create = note removed
        return { toSelect: [], hasRemovals: true };
      } else {
        // Redo create = note re-added
        return { toSelect: [action.note.id], hasRemovals: false };
      }
    case 'delete':
      if (direction === 'undo') {
        // Undo delete = note restored
        return { toSelect: [action.note.id], hasRemovals: false };
      } else {
        // Redo delete = note removed
        return { toSelect: [], hasRemovals: true };
      }
    case 'modify':
      // Both undo and redo modify = note modified in place
      return { toSelect: [action.noteId], hasRemovals: false };
    case 'batch': {
      const toSelect: string[] = [];
      let hasRemovals = false;

      for (const op of action.operations) {
        const sub = getAffectedNoteIds(op, direction);
        toSelect.push(...sub.toSelect);
        if (sub.hasRemovals) {
          hasRemovals = true;
        }
      }

      return { toSelect, hasRemovals };
    }
  }
}

/**
 * Hook that manages undo/redo history for piano roll note operations.
 *
 * This hook implements the Command Pattern with a bounded history stack.
 * It tracks all note mutations and allows linear traversal (undo/redo)
 * with history branching when new actions are recorded after undo.
 */
export function useUndoRedo(options: UseUndoRedoOptions): UseUndoRedoReturn {
  const { maxSize = DEFAULT_MAX_SIZE, loadNotes, selectNotes, deselectAll, notes } = options;

  const [historyState, setHistoryState] = useState<HistoryState>(INITIAL_HISTORY_STATE);

  // Use a ref to access the current notes without stale closure issues
  const notesRef = useRef<Note[]>(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Derived state: whether undo/redo are available
  const canUndo = historyState.pointer > 0;
  const canRedo = historyState.pointer < historyState.actions.length;

  /**
   * Internal helper: push a new action onto the history stack.
   * Uses functional state update to avoid stale closure issues.
   */
  const pushAction = useCallback(
    (action: UndoAction) => {
      setHistoryState((prev) => pushActionReducer(prev, action, maxSize));
    },
    [maxSize]
  );

  // Use refs to access selection functions without stale closure issues
  const selectNotesRef = useRef(selectNotes);
  useEffect(() => {
    selectNotesRef.current = selectNotes;
  }, [selectNotes]);
  const deselectAllRef = useRef(deselectAll);
  useEffect(() => {
    deselectAllRef.current = deselectAll;
  }, [deselectAll]);

  // --- Undo/Redo execution ---

  const undo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.pointer <= 0) {
        return prev; // No-op: nothing to undo
      }

      const action = prev.actions[prev.pointer - 1];
      const updatedNotes = applyUndo(notesRef.current, action);
      loadNotes(updatedNotes);

      // Selection management after undo
      const { toSelect, hasRemovals } = getAffectedNoteIds(action, 'undo');
      if (toSelect.length > 0) {
        selectNotesRef.current(toSelect);
      } else if (hasRemovals) {
        deselectAllRef.current();
      }

      return {
        ...prev,
        pointer: prev.pointer - 1,
      };
    });
  }, [loadNotes]);

  const redo = useCallback(() => {
    setHistoryState((prev) => {
      if (prev.pointer >= prev.actions.length) {
        return prev; // No-op: nothing to redo
      }

      const action = prev.actions[prev.pointer];
      const updatedNotes = applyRedo(notesRef.current, action);
      loadNotes(updatedNotes);

      // Selection management after redo
      const { toSelect, hasRemovals } = getAffectedNoteIds(action, 'redo');
      if (toSelect.length > 0) {
        selectNotesRef.current(toSelect);
      } else if (hasRemovals) {
        deselectAllRef.current();
      }

      return {
        ...prev,
        pointer: prev.pointer + 1,
      };
    });
  }, [loadNotes]);

  // --- Drag suppression flag ---
  const dragInProgressRef = useRef(false);

  // --- Recording functions ---

  const recordCreate = useCallback(
    (note: Note) => {
      if (dragInProgressRef.current) return;
      pushAction({ type: 'create', note });
    },
    [pushAction]
  );

  const recordDelete = useCallback(
    (note: Note) => {
      if (dragInProgressRef.current) return;
      pushAction({ type: 'delete', note });
    },
    [pushAction]
  );

  const recordModify = useCallback(
    (noteId: string, before: Note, after: Note) => {
      if (dragInProgressRef.current) return;
      pushAction({ type: 'modify', noteId, before, after });
    },
    [pushAction]
  );

  const recordBatch = useCallback(
    (operations: Array<CreateAction | DeleteAction | ModifyAction>) => {
      if (dragInProgressRef.current) return;
      pushAction({ type: 'batch', operations });
    },
    [pushAction]
  );

  const clearHistory = useCallback(() => {
    setHistoryState(INITIAL_HISTORY_STATE);
  }, []);

  const setDragInProgress = useCallback((inProgress: boolean) => {
    dragInProgressRef.current = inProgress;
  }, []);

  return useMemo(
    () => ({
      canUndo,
      canRedo,
      undo,
      redo,
      recordCreate,
      recordDelete,
      recordModify,
      recordBatch,
      clearHistory,
      setDragInProgress,
    }),
    [
      canUndo,
      canRedo,
      undo,
      redo,
      recordCreate,
      recordDelete,
      recordModify,
      recordBatch,
      clearHistory,
      setDragInProgress,
    ]
  );
}
