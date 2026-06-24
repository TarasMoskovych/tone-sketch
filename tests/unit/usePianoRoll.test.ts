/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePianoRoll,
  snapToGrid,
  quantizeToFreeResolution,
  snapPosition,
  getMinimumDuration,
  enforceMinimumDuration,
} from '../../hooks/usePianoRoll';

// Mock uuid to return predictable values for testing
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123'),
}));

describe('Grid Snap Utility Functions', () => {
  describe('snapToGrid', () => {
    it('should snap to 1 beat division', () => {
      expect(snapToGrid(0.3, 1)).toBe(0);
      expect(snapToGrid(0.6, 1)).toBe(1);
      expect(snapToGrid(1.5, 1)).toBe(2);
    });

    it('should snap to 1/2 beat division', () => {
      expect(snapToGrid(0.2, 0.5)).toBe(0);
      expect(snapToGrid(0.3, 0.5)).toBe(0.5);
      expect(snapToGrid(0.7, 0.5)).toBe(0.5);
      expect(snapToGrid(0.8, 0.5)).toBe(1);
    });

    it('should snap to 1/4 beat division', () => {
      expect(snapToGrid(0.1, 0.25)).toBe(0);
      expect(snapToGrid(0.13, 0.25)).toBe(0.25);
      expect(snapToGrid(0.37, 0.25)).toBe(0.25); // 0.37/0.25 = 1.48 rounds to 1 -> 0.25
      expect(snapToGrid(0.38, 0.25)).toBe(0.5);  // 0.38/0.25 = 1.52 rounds to 2 -> 0.5
    });

    it('should snap to 1/8 beat division', () => {
      expect(snapToGrid(0.05, 0.125)).toBe(0);
      expect(snapToGrid(0.07, 0.125)).toBe(0.125);
      expect(snapToGrid(0.18, 0.125)).toBe(0.125);
      expect(snapToGrid(0.19, 0.125)).toBe(0.25);
    });

    it('should snap to 1/16 beat division', () => {
      expect(snapToGrid(0.02, 0.0625)).toBe(0);
      expect(snapToGrid(0.04, 0.0625)).toBe(0.0625);
      expect(snapToGrid(0.09, 0.0625)).toBe(0.0625);
      expect(snapToGrid(0.1, 0.0625)).toBe(0.125);
    });
  });

  describe('quantizeToFreeResolution', () => {
    it('should quantize to 1/32 beat resolution', () => {
      expect(quantizeToFreeResolution(0)).toBe(0);
      expect(quantizeToFreeResolution(0.03125)).toBe(0.03125);
      expect(quantizeToFreeResolution(0.0625)).toBe(0.0625);
    });

    it('should round to nearest 1/32 beat', () => {
      // 0.01 / 0.03125 = 0.32 -> rounds to 0
      expect(quantizeToFreeResolution(0.01)).toBe(0);
      // 0.02 / 0.03125 = 0.64 -> rounds to 1 -> 0.03125
      expect(quantizeToFreeResolution(0.02)).toBe(0.03125);
      // 0.05 / 0.03125 = 1.6 -> rounds to 2 -> 0.0625
      expect(quantizeToFreeResolution(0.05)).toBe(0.0625);
    });
  });

  describe('snapPosition', () => {
    it('should use grid snap when enabled', () => {
      const gridSnap = { enabled: true, division: 0.25 as const };
      expect(snapPosition(0.13, gridSnap)).toBe(0.25);
      expect(snapPosition(0.1, gridSnap)).toBe(0);
    });

    it('should use free resolution when grid snap disabled', () => {
      const gridSnap = { enabled: false, division: 0.25 as const };
      expect(snapPosition(0.13, gridSnap)).toBe(0.125); // rounds to nearest 1/32
      expect(snapPosition(0.02, gridSnap)).toBe(0.03125);
    });
  });

  describe('getMinimumDuration', () => {
    it('should return grid division when snap enabled', () => {
      expect(getMinimumDuration({ enabled: true, division: 1 })).toBe(1);
      expect(getMinimumDuration({ enabled: true, division: 0.5 })).toBe(0.5);
      expect(getMinimumDuration({ enabled: true, division: 0.25 })).toBe(0.25);
      expect(getMinimumDuration({ enabled: true, division: 0.125 })).toBe(0.125);
      expect(getMinimumDuration({ enabled: true, division: 0.0625 })).toBe(0.0625);
    });

    it('should return 0.1 when snap disabled', () => {
      expect(getMinimumDuration({ enabled: false, division: 1 })).toBe(0.1);
      expect(getMinimumDuration({ enabled: false, division: 0.25 })).toBe(0.1);
    });
  });

  describe('enforceMinimumDuration', () => {
    it('should enforce minimum based on grid snap config', () => {
      const gridSnapEnabled = { enabled: true, division: 0.25 as const };
      expect(enforceMinimumDuration(0.1, gridSnapEnabled)).toBe(0.25);
      expect(enforceMinimumDuration(0.5, gridSnapEnabled)).toBe(0.5);

      const gridSnapDisabled = { enabled: false, division: 0.25 as const };
      expect(enforceMinimumDuration(0.05, gridSnapDisabled)).toBe(0.1);
      expect(enforceMinimumDuration(0.5, gridSnapDisabled)).toBe(0.5);
    });
  });
});

describe('usePianoRoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with empty notes array', () => {
      const { result } = renderHook(() => usePianoRoll());
      expect(result.current.notes).toEqual([]);
    });

    it('should initialize with no selected note', () => {
      const { result } = renderHook(() => usePianoRoll());
      expect(result.current.selectedNoteId).toBeNull();
    });

    it('should initialize with default visible region', () => {
      const { result } = renderHook(() => usePianoRoll());
      expect(result.current.visibleRegion).toEqual({
        startBeat: 0,
        endBeat: 16,
        startPitch: 48,
        endPitch: 72,
      });
    });

    it('should initialize with grid snap enabled and 1/4 beat division', () => {
      const { result } = renderHook(() => usePianoRoll());
      expect(result.current.gridSnap).toEqual({
        enabled: true,
        division: 0.25,
      });
    });
  });

  describe('createNote', () => {
    it('should create a note with default duration and velocity', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      expect(result.current.notes).toHaveLength(1);
      expect(result.current.notes[0]).toMatchObject({
        pitch: 60,
        start: 0,
        duration: 1,
        velocity: 0.8,
      });
    });

    it('should select the newly created note', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      expect(result.current.selectedNoteId).toBe('test-uuid-123');
    });

    it('should apply grid snap when enabled', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0.13); // Should snap to 0.25
      });

      expect(result.current.notes[0].start).toBe(0.25);
    });

    it('should apply free positioning resolution (1/32 beat) when grid snap is disabled', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.setGridSnap({ enabled: false, division: 0.25 });
      });

      act(() => {
        result.current.createNote(60, 0.13);
      });

      // 0.13 should snap to nearest 1/32 beat (0.03125)
      // 0.13 / 0.03125 = 4.16 -> rounds to 4 -> 4 * 0.03125 = 0.125
      expect(result.current.notes[0].start).toBe(0.125);
    });

    it('should clamp pitch to valid MIDI range', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(-10, 0);
      });
      expect(result.current.notes[0].pitch).toBe(0);

      act(() => {
        result.current.createNote(200, 1);
      });
      expect(result.current.notes[1].pitch).toBe(127);
    });

    it('should clamp start time to non-negative', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, -5);
      });

      expect(result.current.notes[0].start).toBe(0);
    });
  });

  describe('updateNote', () => {
    it('should update note properties', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      const noteId = result.current.notes[0].id;

      act(() => {
        result.current.updateNote(noteId, { pitch: 72, duration: 2 });
      });

      expect(result.current.notes[0].pitch).toBe(72);
      expect(result.current.notes[0].duration).toBe(2);
    });

    it('should clamp pitch to valid range on update', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      const noteId = result.current.notes[0].id;

      act(() => {
        result.current.updateNote(noteId, { pitch: 200 });
      });

      expect(result.current.notes[0].pitch).toBe(127);
    });

    it('should clamp start time to valid range on update', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      const noteId = result.current.notes[0].id;

      act(() => {
        result.current.updateNote(noteId, { start: -5 });
      });
      expect(result.current.notes[0].start).toBe(0);

      act(() => {
        result.current.updateNote(noteId, { start: 15000 });
      });
      expect(result.current.notes[0].start).toBe(10000);
    });

    it('should clamp duration to valid range on update', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      const noteId = result.current.notes[0].id;

      act(() => {
        result.current.updateNote(noteId, { duration: 0 });
      });
      expect(result.current.notes[0].duration).toBe(0.001);

      act(() => {
        result.current.updateNote(noteId, { duration: 5000 });
      });
      expect(result.current.notes[0].duration).toBe(1000);
    });

    it('should clamp velocity to valid range on update', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      const noteId = result.current.notes[0].id;

      act(() => {
        result.current.updateNote(noteId, { velocity: -0.5 });
      });
      expect(result.current.notes[0].velocity).toBe(0);

      act(() => {
        result.current.updateNote(noteId, { velocity: 1.5 });
      });
      expect(result.current.notes[0].velocity).toBe(1);
    });
  });

  describe('deleteNote', () => {
    it('should remove note from array', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      const noteId = result.current.notes[0].id;
      expect(result.current.notes).toHaveLength(1);

      act(() => {
        result.current.deleteNote(noteId);
      });

      expect(result.current.notes).toHaveLength(0);
    });

    it('should clear selection when deleting selected note', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      const noteId = result.current.notes[0].id;
      expect(result.current.selectedNoteId).toBe(noteId);

      act(() => {
        result.current.deleteNote(noteId);
      });

      expect(result.current.selectedNoteId).toBeNull();
    });
  });

  describe('selectNote', () => {
    it('should set selected note ID', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.selectNote('some-note-id');
      });

      expect(result.current.selectedNoteId).toBe('some-note-id');
    });

    it('should clear selection when null is passed', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.selectNote('some-note-id');
      });

      act(() => {
        result.current.selectNote(null);
      });

      expect(result.current.selectedNoteId).toBeNull();
    });
  });

  describe('setVisibleRegion', () => {
    it('should update visible region', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.setVisibleRegion({
          startBeat: 4,
          endBeat: 20,
          startPitch: 36,
          endPitch: 84,
        });
      });

      expect(result.current.visibleRegion).toEqual({
        startBeat: 4,
        endBeat: 20,
        startPitch: 36,
        endPitch: 84,
      });
    });

    it('should clamp pitch values to valid MIDI range', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.setVisibleRegion({
          startBeat: 0,
          endBeat: 16,
          startPitch: -10,
          endPitch: 200,
        });
      });

      expect(result.current.visibleRegion.startPitch).toBe(0);
      expect(result.current.visibleRegion.endPitch).toBe(127);
    });
  });

  describe('setGridSnap', () => {
    it('should update grid snap configuration', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.setGridSnap({ enabled: false, division: 0.5 });
      });

      expect(result.current.gridSnap).toEqual({
        enabled: false,
        division: 0.5,
      });
    });
  });

  describe('clearNotes', () => {
    it('should remove all notes', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
        result.current.createNote(62, 1);
        result.current.createNote(64, 2);
      });

      expect(result.current.notes).toHaveLength(3);

      act(() => {
        result.current.clearNotes();
      });

      expect(result.current.notes).toHaveLength(0);
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      expect(result.current.selectedNoteId).not.toBeNull();

      act(() => {
        result.current.clearNotes();
      });

      expect(result.current.selectedNoteId).toBeNull();
    });
  });

  describe('loadNotes', () => {
    it('should replace existing notes', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      const newNotes = [
        { id: 'note-1', pitch: 72, start: 0, duration: 1, velocity: 0.8 },
        { id: 'note-2', pitch: 74, start: 1, duration: 0.5, velocity: 0.6 },
      ];

      act(() => {
        result.current.loadNotes(newNotes);
      });

      expect(result.current.notes).toEqual(newNotes);
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => usePianoRoll());

      act(() => {
        result.current.createNote(60, 0);
      });

      expect(result.current.selectedNoteId).not.toBeNull();

      act(() => {
        result.current.loadNotes([]);
      });

      expect(result.current.selectedNoteId).toBeNull();
    });
  });
});
