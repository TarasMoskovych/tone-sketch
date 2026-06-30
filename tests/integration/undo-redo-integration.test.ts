/**
 * @vitest-environment jsdom
 *
 * Integration tests for end-to-end undo/redo flows.
 * Tests the useUndoRedo hook in concert with note state management,
 * verifying complete flows: record → undo → verify → redo → verify.
 *
 * Requirements: 1.1-1.9, 2.1-2.6, 3.1-3.6, 4.1-4.4, 8.1-8.4
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../../hooks/useUndoRedo/useUndoRedo';
import { Note } from '../../types/note';

// --- Helpers ---

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: `note-${Math.random().toString(36).slice(2, 8)}`,
    pitch: 60,
    start: 0,
    duration: 1,
    velocity: 0.8,
    ...overrides,
  };
}

/**
 * Creates a test harness that simulates the integration between
 * useUndoRedo and a notes state array. The `loadNotes` callback
 * updates the external notes state, and the hook's `notes` option
 * reflects whatever was last loaded.
 */
function setupHook(initialNotes: Note[] = []) {
  let currentNotes = [...initialNotes];
  const selectNotes = vi.fn();
  const deselectAll = vi.fn();

  const loadNotes = vi.fn((notes: Note[]) => {
    currentNotes = notes;
  });

  const { result, rerender } = renderHook(
    (props: { notes: Note[] }) =>
      useUndoRedo({
        notes: props.notes,
        loadNotes,
        selectNotes,
        deselectAll,
      }),
    { initialProps: { notes: currentNotes } }
  );

  /**
   * Re-render the hook with the current notes state.
   * Call this after undo/redo to sync the hook's `notes` prop
   * with what `loadNotes` received.
   */
  const sync = () => rerender({ notes: currentNotes });

  return {
    result,
    get notes() { return currentNotes; },
    set notes(n: Note[]) { currentNotes = n; },
    loadNotes,
    selectNotes,
    deselectAll,
    sync,
    rerender,
  };
}

// --- Tests ---

describe('Undo/Redo Integration - End-to-End Flows', () => {
  describe('Create note → undo → redo', () => {
    it('should remove note on undo and restore it on redo', () => {
      const note = createNote({ id: 'note-1', pitch: 64, start: 2, duration: 0.5, velocity: 0.9 });
      const harness = setupHook([note]);

      // Record the create action
      act(() => {
        harness.result.current.recordCreate(note);
      });

      expect(harness.result.current.canUndo).toBe(true);
      expect(harness.result.current.canRedo).toBe(false);

      // Undo → note should be removed
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      expect(harness.loadNotes).toHaveBeenCalledWith(
        expect.not.arrayContaining([expect.objectContaining({ id: 'note-1' })])
      );
      expect(harness.notes).not.toContainEqual(expect.objectContaining({ id: 'note-1' }));
      expect(harness.result.current.canUndo).toBe(false);
      expect(harness.result.current.canRedo).toBe(true);
      // Undo of create should call deselectAll (note removed)
      expect(harness.deselectAll).toHaveBeenCalled();

      // Redo → note should be restored
      act(() => {
        harness.result.current.redo();
      });
      harness.sync();

      expect(harness.notes).toContainEqual(note);
      expect(harness.result.current.canUndo).toBe(true);
      expect(harness.result.current.canRedo).toBe(false);
      // Redo of create should select the restored note
      expect(harness.selectNotes).toHaveBeenCalledWith(['note-1']);
    });
  });

  describe('Delete note → undo → redo', () => {
    it('should restore note with original properties on undo and remove it on redo', () => {
      const note = createNote({ id: 'note-del', pitch: 72, start: 4, duration: 2, velocity: 0.6 });
      // After deletion, notes array is empty
      const harness = setupHook([]);

      // Record the delete action
      act(() => {
        harness.result.current.recordDelete(note);
      });

      expect(harness.result.current.canUndo).toBe(true);

      // Undo → note should be restored with original properties
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      expect(harness.notes).toContainEqual(note);
      expect(harness.notes[0]).toEqual(note);
      // Undo of delete should select the restored note
      expect(harness.selectNotes).toHaveBeenCalledWith(['note-del']);

      // Redo → note should be removed again
      act(() => {
        harness.result.current.redo();
      });
      harness.sync();

      expect(harness.notes).not.toContainEqual(expect.objectContaining({ id: 'note-del' }));
      expect(harness.result.current.canUndo).toBe(true);
      expect(harness.result.current.canRedo).toBe(false);
      // Redo of delete should call deselectAll
      expect(harness.deselectAll).toHaveBeenCalled();
    });
  });

  describe('Move note → undo → redo', () => {
    it('should restore note at original position on undo and move it back on redo', () => {
      const originalNote = createNote({ id: 'note-move', pitch: 60, start: 0, duration: 1, velocity: 0.8 });
      const movedNote = { ...originalNote, pitch: 65, start: 4 };

      // Start with the moved note (operation already committed)
      const harness = setupHook([movedNote]);

      // Record the modify action (move)
      act(() => {
        harness.result.current.recordModify('note-move', originalNote, movedNote);
      });

      expect(harness.result.current.canUndo).toBe(true);

      // Undo → note should be at original position
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      const undoneNote = harness.notes.find(n => n.id === 'note-move');
      expect(undoneNote).toEqual(originalNote);
      expect(undoneNote!.pitch).toBe(60);
      expect(undoneNote!.start).toBe(0);
      // Undo of modify should select the note
      expect(harness.selectNotes).toHaveBeenCalledWith(['note-move']);

      // Redo → note should be at moved position
      act(() => {
        harness.result.current.redo();
      });
      harness.sync();

      const redoneNote = harness.notes.find(n => n.id === 'note-move');
      expect(redoneNote).toEqual(movedNote);
      expect(redoneNote!.pitch).toBe(65);
      expect(redoneNote!.start).toBe(4);
    });
  });

  describe('Bulk move → undo', () => {
    it('should restore all notes to original positions on undo', () => {
      const note1Original = createNote({ id: 'bulk-1', pitch: 60, start: 0 });
      const note2Original = createNote({ id: 'bulk-2', pitch: 64, start: 2 });
      const note3Original = createNote({ id: 'bulk-3', pitch: 67, start: 4 });

      const note1Moved = { ...note1Original, start: 2, pitch: 62 };
      const note2Moved = { ...note2Original, start: 4, pitch: 66 };
      const note3Moved = { ...note3Original, start: 6, pitch: 69 };

      // State after bulk move
      const harness = setupHook([note1Moved, note2Moved, note3Moved]);

      // Record the batch modify action
      act(() => {
        harness.result.current.recordBatch([
          { type: 'modify', noteId: 'bulk-1', before: note1Original, after: note1Moved },
          { type: 'modify', noteId: 'bulk-2', before: note2Original, after: note2Moved },
          { type: 'modify', noteId: 'bulk-3', before: note3Original, after: note3Moved },
        ]);
      });

      expect(harness.result.current.canUndo).toBe(true);

      // Undo → all notes at original positions
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      expect(harness.notes.find(n => n.id === 'bulk-1')).toEqual(note1Original);
      expect(harness.notes.find(n => n.id === 'bulk-2')).toEqual(note2Original);
      expect(harness.notes.find(n => n.id === 'bulk-3')).toEqual(note3Original);
      // All modified notes should be selected
      expect(harness.selectNotes).toHaveBeenCalledWith(['bulk-1', 'bulk-2', 'bulk-3']);
    });
  });

  describe('MIDI import clears history', () => {
    it('should make undo and redo unavailable after clearHistory', () => {
      const note = createNote({ id: 'import-note' });
      const harness = setupHook([note]);

      // Record some actions to build history
      act(() => {
        harness.result.current.recordCreate(note);
      });
      expect(harness.result.current.canUndo).toBe(true);

      // Simulate MIDI import by calling clearHistory (as MelodyEditor does)
      act(() => {
        harness.result.current.clearHistory();
      });

      expect(harness.result.current.canUndo).toBe(false);
      expect(harness.result.current.canRedo).toBe(false);

      // Undo should be no-op
      act(() => {
        harness.result.current.undo();
      });

      expect(harness.loadNotes).not.toHaveBeenCalled();
    });

    it('should clear history even when there are redo entries', () => {
      const note1 = createNote({ id: 'n1' });
      const note2 = createNote({ id: 'n2' });
      const harness = setupHook([note1, note2]);

      // Build history: record two creates, undo one (creates redo entry)
      act(() => {
        harness.result.current.recordCreate(note1);
      });
      act(() => {
        harness.result.current.recordCreate(note2);
      });
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      expect(harness.result.current.canUndo).toBe(true);
      expect(harness.result.current.canRedo).toBe(true);

      // Clear history (MIDI import)
      act(() => {
        harness.result.current.clearHistory();
      });

      expect(harness.result.current.canUndo).toBe(false);
      expect(harness.result.current.canRedo).toBe(false);
    });
  });

  describe('Clear All is undoable', () => {
    it('should record batch delete for all notes and restore them on undo', () => {
      const note1 = createNote({ id: 'clear-1', pitch: 60, start: 0, velocity: 0.7 });
      const note2 = createNote({ id: 'clear-2', pitch: 64, start: 2, velocity: 0.9 });
      const note3 = createNote({ id: 'clear-3', pitch: 67, start: 4, velocity: 0.5 });

      // State after clear all (empty)
      const harness = setupHook([]);

      // Record the batch delete action (as MelodyEditor's handleClearNotes does)
      act(() => {
        harness.result.current.recordBatch([
          { type: 'delete', note: note1 },
          { type: 'delete', note: note2 },
          { type: 'delete', note: note3 },
        ]);
      });

      expect(harness.result.current.canUndo).toBe(true);

      // Undo → all notes should be restored
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      expect(harness.notes).toHaveLength(3);
      expect(harness.notes).toContainEqual(note1);
      expect(harness.notes).toContainEqual(note2);
      expect(harness.notes).toContainEqual(note3);
      // All restored notes should be selected
      expect(harness.selectNotes).toHaveBeenCalledWith(['clear-1', 'clear-2', 'clear-3']);
    });
  });

  describe('Velocity change → undo → redo', () => {
    it('should restore original velocity on undo', () => {
      const originalNote = createNote({ id: 'vel-note', pitch: 60, start: 0, duration: 1, velocity: 0.3 });
      const updatedNote = { ...originalNote, velocity: 0.9 };

      // State after velocity change
      const harness = setupHook([updatedNote]);

      // Record the modify action (velocity change)
      act(() => {
        harness.result.current.recordModify('vel-note', originalNote, updatedNote);
      });

      expect(harness.result.current.canUndo).toBe(true);

      // Undo → original velocity restored
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      const undoneNote = harness.notes.find(n => n.id === 'vel-note');
      expect(undoneNote!.velocity).toBe(0.3);
      expect(undoneNote).toEqual(originalNote);

      // Redo → updated velocity restored
      act(() => {
        harness.result.current.redo();
      });
      harness.sync();

      const redoneNote = harness.notes.find(n => n.id === 'vel-note');
      expect(redoneNote!.velocity).toBe(0.9);
      expect(redoneNote).toEqual(updatedNote);
    });
  });

  describe('History branching', () => {
    it('should discard redo entries when a new action is recorded after undo', () => {
      const note1 = createNote({ id: 'branch-1', pitch: 60, start: 0 });
      const note2 = createNote({ id: 'branch-2', pitch: 64, start: 2 });
      const note3 = createNote({ id: 'branch-3', pitch: 67, start: 4 });

      const harness = setupHook([note1, note2, note3]);

      // Record 3 create actions
      act(() => {
        harness.result.current.recordCreate(note1);
      });
      act(() => {
        harness.result.current.recordCreate(note2);
      });
      act(() => {
        harness.result.current.recordCreate(note3);
      });

      expect(harness.result.current.canUndo).toBe(true);
      expect(harness.result.current.canRedo).toBe(false);

      // Undo the last action
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      expect(harness.result.current.canUndo).toBe(true);
      expect(harness.result.current.canRedo).toBe(true);

      // Record a new action (branches history)
      const newNote = createNote({ id: 'branch-new', pitch: 72, start: 6 });
      harness.notes = [...harness.notes, newNote];
      harness.rerender({ notes: harness.notes });

      act(() => {
        harness.result.current.recordCreate(newNote);
      });

      // Redo should no longer be available (history branched)
      expect(harness.result.current.canRedo).toBe(false);
      // Undo is still available (we have the first 2 creates + the new action)
      expect(harness.result.current.canUndo).toBe(true);
    });

    it('should correctly undo the new branch action after branching', () => {
      const note1 = createNote({ id: 'b-1', pitch: 60, start: 0 });
      const note2 = createNote({ id: 'b-2', pitch: 64, start: 2 });

      const harness = setupHook([note1, note2]);

      // Record 2 creates
      act(() => {
        harness.result.current.recordCreate(note1);
      });
      act(() => {
        harness.result.current.recordCreate(note2);
      });

      // Undo last create
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      // Record a new action (branch)
      const movedNote1 = { ...note1, start: 5 };
      harness.notes = [movedNote1];
      harness.rerender({ notes: harness.notes });

      act(() => {
        harness.result.current.recordModify('b-1', note1, movedNote1);
      });

      // Undo the branched modify → should restore note1 to original
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      expect(harness.notes.find(n => n.id === 'b-1')).toEqual(note1);
    });
  });

  describe('Cut operation (batch delete) → undo → redo', () => {
    it('should restore all cut notes on undo and remove them on redo', () => {
      const note1 = createNote({ id: 'cut-1', pitch: 60, start: 0, velocity: 0.8 });
      const note2 = createNote({ id: 'cut-2', pitch: 64, start: 2, velocity: 0.6 });

      // After cut, notes are removed
      const harness = setupHook([]);

      // Record batch delete (simulating cut recording in MelodyEditor)
      act(() => {
        harness.result.current.recordBatch([
          { type: 'delete', note: note1 },
          { type: 'delete', note: note2 },
        ]);
      });

      expect(harness.result.current.canUndo).toBe(true);

      // Undo → all cut notes restored
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();

      expect(harness.notes).toHaveLength(2);
      expect(harness.notes).toContainEqual(note1);
      expect(harness.notes).toContainEqual(note2);
      expect(harness.selectNotes).toHaveBeenCalledWith(['cut-1', 'cut-2']);

      // Redo → notes removed again
      act(() => {
        harness.result.current.redo();
      });
      harness.sync();

      expect(harness.notes).toHaveLength(0);
      expect(harness.deselectAll).toHaveBeenCalled();
    });
  });

  describe('Multiple sequential operations', () => {
    it('should undo and redo multiple operations in correct order', () => {
      const note1 = createNote({ id: 'seq-1', pitch: 60, start: 0 });
      const note2 = createNote({ id: 'seq-2', pitch: 64, start: 2 });
      const note1Moved = { ...note1, start: 5 };

      // Start with note1 already created (before any recording)
      const harness = setupHook([note1]);

      // Step 1: Record create of note1
      act(() => {
        harness.result.current.recordCreate(note1);
      });

      // Step 2: Add note2 to state and record
      harness.notes = [note1, note2];
      harness.rerender({ notes: harness.notes });
      act(() => {
        harness.result.current.recordCreate(note2);
      });

      // Step 3: Move note1 and record
      harness.notes = [note1Moved, note2];
      harness.rerender({ notes: harness.notes });
      act(() => {
        harness.result.current.recordModify('seq-1', note1, note1Moved);
      });

      // Undo move → note1 back to original position
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();
      expect(harness.notes.find(n => n.id === 'seq-1')).toEqual(note1);

      // Undo create note2 → note2 removed
      act(() => {
        harness.result.current.undo();
      });
      harness.sync();
      expect(harness.notes.find(n => n.id === 'seq-2')).toBeUndefined();

      // Redo create note2 → note2 restored
      act(() => {
        harness.result.current.redo();
      });
      harness.sync();
      expect(harness.notes).toContainEqual(note2);

      // Redo move → note1 moved again
      act(() => {
        harness.result.current.redo();
      });
      harness.sync();
      expect(harness.notes.find(n => n.id === 'seq-1')).toEqual(note1Moved);
    });
  });

  describe('Undo/Redo no-op at boundaries', () => {
    it('undo should be no-op when history is empty', () => {
      const harness = setupHook([createNote()]);

      act(() => {
        harness.result.current.undo();
      });

      expect(harness.loadNotes).not.toHaveBeenCalled();
      expect(harness.selectNotes).not.toHaveBeenCalled();
      expect(harness.deselectAll).not.toHaveBeenCalled();
    });

    it('redo should be no-op when at the end of history', () => {
      const note = createNote({ id: 'boundary-note' });
      const harness = setupHook([note]);

      act(() => {
        harness.result.current.recordCreate(note);
      });

      // Already at end, redo should be no-op
      act(() => {
        harness.result.current.redo();
      });

      // loadNotes should not have been called (only recording doesn't trigger loadNotes)
      expect(harness.loadNotes).not.toHaveBeenCalled();
    });
  });

  describe('Drag suppression', () => {
    it('should not record actions while drag is in progress', () => {
      const note = createNote({ id: 'drag-note' });
      const harness = setupHook([note]);

      // Start drag
      act(() => {
        harness.result.current.setDragInProgress(true);
      });

      // Try to record during drag — should be suppressed
      act(() => {
        harness.result.current.recordModify('drag-note', note, { ...note, start: 5 });
      });

      expect(harness.result.current.canUndo).toBe(false);

      // End drag
      act(() => {
        harness.result.current.setDragInProgress(false);
      });

      // Now recording should work
      act(() => {
        harness.result.current.recordModify('drag-note', note, { ...note, start: 5 });
      });

      expect(harness.result.current.canUndo).toBe(true);
    });
  });
});
