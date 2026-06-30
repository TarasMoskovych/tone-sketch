import { Note } from '@/types/note';

/**
 * Action types for the undo/redo system.
 */
export type ActionType = 'create' | 'delete' | 'modify' | 'batch';

/**
 * Records a note creation. Undo removes the note; redo re-adds it.
 */
export interface CreateAction {
  type: 'create';
  note: Note;
}

/**
 * Records a note deletion. Undo restores the note; redo removes it.
 */
export interface DeleteAction {
  type: 'delete';
  note: Note;
}

/**
 * Records a note modification (move, resize, velocity change).
 * Stores full before/after snapshots to avoid accumulated errors.
 */
export interface ModifyAction {
  type: 'modify';
  noteId: string;
  before: Note;
  after: Note;
}

/**
 * Groups multiple operations into a single undoable action.
 * Used for group move, bulk velocity, cut, and clear-all operations.
 */
export interface BatchAction {
  type: 'batch';
  operations: Array<CreateAction | DeleteAction | ModifyAction>;
}

/**
 * Discriminated union of all undoable action types.
 */
export type UndoAction = CreateAction | DeleteAction | ModifyAction | BatchAction;

/**
 * The history stack data structure that stores undo/redo state.
 */
export interface HistoryStack {
  /** Array of recorded actions */
  actions: UndoAction[];
  /** Current position in the stack (0 = beginning, length = end) */
  pointer: number;
  /** Maximum number of undo entries */
  maxSize: number;
}

/**
 * Options for the useUndoRedo hook.
 */
export interface UseUndoRedoOptions {
  /** Maximum history size (default: 100) */
  maxSize?: number;
  /** The current notes array from usePianoRoll */
  notes: Note[];
  /** The setNotes/loadNotes function from usePianoRoll */
  loadNotes: (notes: Note[]) => void;
  /** Selection management: select specific notes by ID */
  selectNotes: (noteIds: string[]) => void;
  /** Selection management: clear the current selection */
  deselectAll: () => void;
}

/**
 * Return value of the useUndoRedo hook.
 */
export interface UseUndoRedoReturn {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Perform undo operation */
  undo: () => void;
  /** Perform redo operation */
  redo: () => void;
  /** Record a create action */
  recordCreate: (note: Note) => void;
  /** Record a delete action (single note) */
  recordDelete: (note: Note) => void;
  /** Record a modify action (move, resize, velocity) */
  recordModify: (noteId: string, before: Note, after: Note) => void;
  /** Record a batch action (group move, bulk velocity, cut) */
  recordBatch: (operations: Array<CreateAction | DeleteAction | ModifyAction>) => void;
  /** Clear all history (for loadNotes/MIDI import) */
  clearHistory: () => void;
  /** Signal whether a drag is in progress (suppresses recording) */
  setDragInProgress: (inProgress: boolean) => void;
}
