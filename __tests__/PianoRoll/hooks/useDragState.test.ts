/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragState, type UseDragStateOptions } from '@/components/PianoRoll/hooks/useDragState';
import type { Note } from '@/types/note';

/**
 * Tests for useDragState hook
 *
 * Validates: Requirements 8.4, 8.5 - Drag state management
 *
 * Tests cover:
 * 1. Drag lifecycle - starting, updating, and ending a note drag
 * 2. Drag cancellation - calling cancelNoteDrag restores original note positions
 * 3. Group drag - when isGroupDrag is true, all selected notes move together
 * 4. Group drag cancellation - canceling group drag restores ALL original note positions
 * 5. Scrollbar drag - starting, updating, and ending scrollbar drags
 * 6. isDragging flag - correct state during drag operations
 * 7. justFinishedDragRef - set to true after endNoteDrag, reset after timeout
 */
describe('useDragState hook', () => {
  // Mock callbacks
  const mockOnNoteUpdate = vi.fn();
  const mockOnBulkNoteUpdate = vi.fn();
  const mockOnVisibleRegionChange = vi.fn();

  // Default options for tests
  const createDefaultOptions = (): UseDragStateOptions => ({
    notes: [],
    selectedNoteIds: new Set<string>(),
    visibleRegion: { startBeat: 0, endBeat: 16, startPitch: 48, endPitch: 72 },
    gridSnap: { enabled: true, division: 0.25 },
    containerRef: { current: null },
    effectiveTotalBeats: 64,
    onNoteUpdate: mockOnNoteUpdate,
    onBulkNoteUpdate: mockOnBulkNoteUpdate,
    onVisibleRegionChange: mockOnVisibleRegionChange,
  });

  // Sample notes for testing
  const createSampleNote = (overrides: Partial<Note> = {}): Note => ({
    id: 'test-note-1',
    pitch: 60,
    start: 4,
    duration: 1,
    velocity: 100,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });


  // =========================================================================
  // 1. Drag Lifecycle Tests
  // =========================================================================
  describe('Drag Lifecycle', () => {
    it('should start a note drag in move mode', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
      });

      expect(result.current.dragState).not.toBeNull();
      expect(result.current.dragState?.mode).toBe('move');
      expect(result.current.dragState?.note).toEqual(note);
      expect(result.current.dragState?.originalNote).toEqual(note);
      expect(result.current.dragState?.startX).toBe(100);
      expect(result.current.dragState?.startY).toBe(50);
      expect(result.current.dragState?.isGroupDrag).toBe(false);
    });

    it('should start a note drag in resize mode', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 150, 50, true, false, originalNotes);
      });

      expect(result.current.dragState?.mode).toBe('resize');
    });

    it('should end note drag and clear state', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
      });

      expect(result.current.dragState).not.toBeNull();

      act(() => {
        result.current.endNoteDrag();
      });

      expect(result.current.dragState).toBeNull();
    });
  });


  // =========================================================================
  // 2. Drag Cancellation Tests
  // =========================================================================
  describe('Drag Cancellation', () => {
    it('should restore original note position when drag is cancelled', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const originalNote = createSampleNote({ start: 4, pitch: 60 });
      const originalNotes = new Map<string, Note>([[originalNote.id, originalNote]]);

      act(() => {
        result.current.startNoteDrag(originalNote, 100, 50, false, false, originalNotes);
      });

      // Cancel the drag
      act(() => {
        result.current.cancelNoteDrag();
      });

      // onNoteUpdate should be called with the original note to restore it
      expect(mockOnNoteUpdate).toHaveBeenCalledWith(originalNote);
      expect(result.current.dragState).toBeNull();
    });

    it('should not call callbacks when cancelling if no drag is in progress', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      act(() => {
        result.current.cancelNoteDrag();
      });

      expect(mockOnNoteUpdate).not.toHaveBeenCalled();
      expect(mockOnBulkNoteUpdate).not.toHaveBeenCalled();
    });

    it('should handle Escape key to cancel drag', async () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
      });

      expect(result.current.dragState).not.toBeNull();

      // Simulate Escape key press
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(event);
      });

      expect(result.current.dragState).toBeNull();
      expect(mockOnNoteUpdate).toHaveBeenCalledWith(note);
    });
  });


  // =========================================================================
  // 3. Group Drag Tests
  // =========================================================================
  describe('Group Drag Behavior', () => {
    it('should track group drag state correctly', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note1 = createSampleNote({ id: 'note-1', start: 4, pitch: 60 });
      const note2 = createSampleNote({ id: 'note-2', start: 6, pitch: 62 });
      const originalNotes = new Map<string, Note>([
        [note1.id, note1],
        [note2.id, note2],
      ]);

      act(() => {
        result.current.startNoteDrag(note1, 100, 50, false, true, originalNotes);
      });

      expect(result.current.dragState?.isGroupDrag).toBe(true);
      expect(result.current.dragState?.originalSelectedNotes.size).toBe(2);
      expect(result.current.dragState?.originalSelectedNotes.get('note-1')).toEqual(note1);
      expect(result.current.dragState?.originalSelectedNotes.get('note-2')).toEqual(note2);
    });

    it('should preserve original note positions for group drag', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note1 = createSampleNote({ id: 'note-1', start: 4, pitch: 60 });
      const note2 = createSampleNote({ id: 'note-2', start: 6, pitch: 62 });
      const note3 = createSampleNote({ id: 'note-3', start: 8, pitch: 64 });
      const originalNotes = new Map<string, Note>([
        [note1.id, note1],
        [note2.id, note2],
        [note3.id, note3],
      ]);

      act(() => {
        result.current.startNoteDrag(note1, 100, 50, false, true, originalNotes);
      });

      // Verify all original notes are stored
      const storedNotes = result.current.dragState?.originalSelectedNotes;
      expect(storedNotes?.get('note-1')?.start).toBe(4);
      expect(storedNotes?.get('note-2')?.start).toBe(6);
      expect(storedNotes?.get('note-3')?.start).toBe(8);
    });
  });


  // =========================================================================
  // 4. Group Drag Cancellation Tests
  // =========================================================================
  describe('Group Drag Cancellation', () => {
    it('should restore ALL original note positions when group drag is cancelled using bulk update', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note1 = createSampleNote({ id: 'note-1', start: 4, pitch: 60, duration: 1 });
      const note2 = createSampleNote({ id: 'note-2', start: 6, pitch: 62, duration: 1.5 });
      const note3 = createSampleNote({ id: 'note-3', start: 8, pitch: 64, duration: 2 });
      const originalNotes = new Map<string, Note>([
        [note1.id, note1],
        [note2.id, note2],
        [note3.id, note3],
      ]);

      act(() => {
        result.current.startNoteDrag(note1, 100, 50, false, true, originalNotes);
      });

      // Cancel the group drag
      act(() => {
        result.current.cancelNoteDrag();
      });

      // Should call onBulkNoteUpdate with all original positions
      expect(mockOnBulkNoteUpdate).toHaveBeenCalled();
      const bulkUpdateArg = mockOnBulkNoteUpdate.mock.calls[0][0] as Map<string, Partial<Note>>;

      expect(bulkUpdateArg.size).toBe(3);
      expect(bulkUpdateArg.get('note-1')).toEqual({ start: 4, pitch: 60, duration: 1 });
      expect(bulkUpdateArg.get('note-2')).toEqual({ start: 6, pitch: 62, duration: 1.5 });
      expect(bulkUpdateArg.get('note-3')).toEqual({ start: 8, pitch: 64, duration: 2 });
    });

    it('should fall back to individual updates if onBulkNoteUpdate is not available', () => {
      const options = createDefaultOptions();
      options.onBulkNoteUpdate = undefined;
      const { result } = renderHook(() => useDragState(options));

      const note1 = createSampleNote({ id: 'note-1', start: 4, pitch: 60 });
      const note2 = createSampleNote({ id: 'note-2', start: 6, pitch: 62 });
      const originalNotes = new Map<string, Note>([
        [note1.id, note1],
        [note2.id, note2],
      ]);

      act(() => {
        result.current.startNoteDrag(note1, 100, 50, false, true, originalNotes);
      });

      act(() => {
        result.current.cancelNoteDrag();
      });

      // Should call onNoteUpdate for each note
      expect(mockOnNoteUpdate).toHaveBeenCalledTimes(2);
    });

    it('should handle Escape key to cancel group drag', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note1 = createSampleNote({ id: 'note-1', start: 4, pitch: 60 });
      const note2 = createSampleNote({ id: 'note-2', start: 6, pitch: 62 });
      const originalNotes = new Map<string, Note>([
        [note1.id, note1],
        [note2.id, note2],
      ]);

      act(() => {
        result.current.startNoteDrag(note1, 100, 50, false, true, originalNotes);
      });

      // Simulate Escape key press
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(event);
      });

      expect(result.current.dragState).toBeNull();
      expect(mockOnBulkNoteUpdate).toHaveBeenCalled();
    });
  });


  // =========================================================================
  // 5. Scrollbar Drag Tests
  // =========================================================================
  describe('Scrollbar Drag Behavior', () => {
    it('should start horizontal scrollbar drag', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      act(() => {
        result.current.startScrollbarDrag('horizontal', 200);
      });

      expect(result.current.scrollbarDragState).not.toBeNull();
      expect(result.current.scrollbarDragState?.scrollbar).toBe('horizontal');
      expect(result.current.scrollbarDragState?.startPosition).toBe(200);
      expect(result.current.scrollbarDragState?.initialVisibleRegion).toEqual(
        options.visibleRegion
      );
    });

    it('should start vertical scrollbar drag', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      act(() => {
        result.current.startScrollbarDrag('vertical', 150);
      });

      expect(result.current.scrollbarDragState).not.toBeNull();
      expect(result.current.scrollbarDragState?.scrollbar).toBe('vertical');
      expect(result.current.scrollbarDragState?.startPosition).toBe(150);
    });

    it('should end scrollbar drag and clear state', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      act(() => {
        result.current.startScrollbarDrag('horizontal', 200);
      });

      expect(result.current.scrollbarDragState).not.toBeNull();

      act(() => {
        result.current.endScrollbarDrag();
      });

      expect(result.current.scrollbarDragState).toBeNull();
    });

    it('should clear scrollbar drag on Escape key', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      act(() => {
        result.current.startScrollbarDrag('horizontal', 200);
      });

      expect(result.current.scrollbarDragState).not.toBeNull();

      // Simulate Escape key press
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(event);
      });

      expect(result.current.scrollbarDragState).toBeNull();
    });
  });


  // =========================================================================
  // 6. isDragging Flag Tests
  // =========================================================================
  describe('isDragging Flag', () => {
    it('should return false when no drag is in progress', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      expect(result.current.isDragging).toBe(false);
      expect(result.current.isNoteDragging).toBe(false);
      expect(result.current.isScrollbarDragging).toBe(false);
    });

    it('should return true during note drag', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.isNoteDragging).toBe(true);
      expect(result.current.isScrollbarDragging).toBe(false);
    });

    it('should return true during scrollbar drag', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      act(() => {
        result.current.startScrollbarDrag('horizontal', 200);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.isNoteDragging).toBe(false);
      expect(result.current.isScrollbarDragging).toBe(true);
    });

    it('should return true when both note and scrollbar drags are active', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
        result.current.startScrollbarDrag('vertical', 150);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.isNoteDragging).toBe(true);
      expect(result.current.isScrollbarDragging).toBe(true);
    });

    it('should return false after ending all drags', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
        result.current.startScrollbarDrag('vertical', 150);
      });

      act(() => {
        result.current.endNoteDrag();
        result.current.endScrollbarDrag();
      });

      expect(result.current.isDragging).toBe(false);
    });
  });


  // =========================================================================
  // 7. justFinishedDragRef Tests
  // =========================================================================
  describe('justFinishedDragRef Behavior', () => {
    it('should set justFinishedDragRef to true after endNoteDrag', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      // Start drag
      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
      });

      // Initially false (no drag finished yet)
      expect(result.current.justFinishedDragRef.current).toBe(false);

      // End drag
      act(() => {
        result.current.endNoteDrag();
      });

      // Should be true immediately after ending drag
      expect(result.current.justFinishedDragRef.current).toBe(true);
    });

    it('should reset justFinishedDragRef to false after timeout', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
      });

      act(() => {
        result.current.endNoteDrag();
      });

      expect(result.current.justFinishedDragRef.current).toBe(true);

      // Advance timers to trigger the timeout
      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.justFinishedDragRef.current).toBe(false);
    });

    it('should not change justFinishedDragRef when drag is cancelled', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
      });

      expect(result.current.justFinishedDragRef.current).toBe(false);

      // Cancel drag instead of ending
      act(() => {
        result.current.cancelNoteDrag();
      });

      // Should remain false because we cancelled, not ended
      expect(result.current.justFinishedDragRef.current).toBe(false);
    });
  });


  // =========================================================================
  // Additional Edge Case Tests
  // =========================================================================
  describe('Edge Cases', () => {
    it('should handle starting a new drag while one is in progress', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note1 = createSampleNote({ id: 'note-1', start: 4 });
      const note2 = createSampleNote({ id: 'note-2', start: 8 });
      const originalNotes1 = new Map<string, Note>([[note1.id, note1]]);
      const originalNotes2 = new Map<string, Note>([[note2.id, note2]]);

      // Start first drag
      act(() => {
        result.current.startNoteDrag(note1, 100, 50, false, false, originalNotes1);
      });

      expect(result.current.dragState?.note.id).toBe('note-1');

      // Start second drag (replaces first)
      act(() => {
        result.current.startNoteDrag(note2, 200, 60, false, false, originalNotes2);
      });

      expect(result.current.dragState?.note.id).toBe('note-2');
      expect(result.current.dragState?.startX).toBe(200);
    });

    it('should preserve note immutability by copying note objects', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const originalNotes = new Map<string, Note>([[note.id, note]]);

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, false, originalNotes);
      });

      // Verify that stored notes are copies, not references
      expect(result.current.dragState?.note).not.toBe(note);
      expect(result.current.dragState?.note).toEqual(note);
      expect(result.current.dragState?.originalNote).not.toBe(note);
      expect(result.current.dragState?.originalNote).toEqual(note);
    });

    it('should handle empty originalSelectedNotes map', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      const note = createSampleNote();
      const emptyOriginalNotes = new Map<string, Note>();

      act(() => {
        result.current.startNoteDrag(note, 100, 50, false, true, emptyOriginalNotes);
      });

      // Cancel should not crash with empty map
      act(() => {
        result.current.cancelNoteDrag();
      });

      // With empty originalSelectedNotes and isGroupDrag true,
      // it should still try bulk update but with empty map
      expect(mockOnBulkNoteUpdate).not.toHaveBeenCalled();
    });

    it('should not trigger callbacks when ending drag with no active drag', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      act(() => {
        result.current.endNoteDrag();
      });

      // justFinishedDragRef should remain false
      expect(result.current.justFinishedDragRef.current).toBe(false);
    });

    it('should not trigger callbacks when ending scrollbar drag with no active drag', () => {
      const options = createDefaultOptions();
      const { result } = renderHook(() => useDragState(options));

      act(() => {
        result.current.endScrollbarDrag();
      });

      expect(mockOnVisibleRegionChange).not.toHaveBeenCalled();
    });
  });
});
