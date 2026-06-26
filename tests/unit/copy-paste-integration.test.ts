/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useCopyPaste } from '../../hooks/useCopyPaste';
import type { Note } from '../../types/note';
import type { GridSnapConfig } from '../../types/grid';

describe('Copy/Paste Integration', () => {
  let mockContainer: HTMLDivElement;
  let containerRef: { current: HTMLElement | null };

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.setAttribute('tabindex', '0');
    document.body.appendChild(mockContainer);
    containerRef = { current: mockContainer };
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  /**
   * Helper to dispatch a keyboard event on the document
   */
  function dispatchKeyEvent(code: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    document.dispatchEvent(event);
    return event;
  }

  describe('Keyboard events dispatch correct operations (Requirement 6.3)', () => {
    it('should call copy when Ctrl+C is pressed with container focused', () => {
      mockContainer.focus();
      const mockCopy = vi.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onCopy: mockCopy,
          containerRef,
        })
      );

      dispatchKeyEvent('KeyC', { ctrlKey: true });

      expect(mockCopy).toHaveBeenCalledTimes(1);
    });

    it('should call cut when Ctrl+X is pressed with container focused', () => {
      mockContainer.focus();
      const mockCut = vi.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onCut: mockCut,
          containerRef,
        })
      );

      dispatchKeyEvent('KeyX', { ctrlKey: true });

      expect(mockCut).toHaveBeenCalledTimes(1);
    });

    it('should call paste when Ctrl+V is pressed with container focused', () => {
      mockContainer.focus();
      const mockPaste = vi.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onPaste: mockPaste,
          containerRef,
        })
      );

      dispatchKeyEvent('KeyV', { ctrlKey: true });

      expect(mockPaste).toHaveBeenCalledTimes(1);
    });

    it('should call duplicate when Ctrl+D is pressed with container focused', () => {
      mockContainer.focus();
      const mockDuplicate = vi.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onDuplicate: mockDuplicate,
          containerRef,
        })
      );

      dispatchKeyEvent('KeyD', { ctrlKey: true });

      expect(mockDuplicate).toHaveBeenCalledTimes(1);
    });

    it('should call event.preventDefault() when Ctrl+C is triggered', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onCopy: vi.fn(),
          containerRef,
        })
      );

      const event = dispatchKeyEvent('KeyC', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
    });

    it('should call event.preventDefault() when Ctrl+X is triggered', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onCut: vi.fn(),
          containerRef,
        })
      );

      const event = dispatchKeyEvent('KeyX', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
    });

    it('should call event.preventDefault() when Ctrl+V is triggered', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onPaste: vi.fn(),
          containerRef,
        })
      );

      const event = dispatchKeyEvent('KeyV', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
    });

    it('should call event.preventDefault() when Ctrl+D is triggered', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onDuplicate: vi.fn(),
          containerRef,
        })
      );

      const event = dispatchKeyEvent('KeyD', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('Drag state suppresses shortcuts (Requirement 6.4)', () => {
    it('should NOT call copy when isDragging=true and Ctrl+C is pressed', () => {
      mockContainer.focus();
      const mockCopy = vi.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onCopy: mockCopy,
          isDragging: true,
          containerRef,
        })
      );

      dispatchKeyEvent('KeyC', { ctrlKey: true });

      expect(mockCopy).not.toHaveBeenCalled();
    });

    it('should NOT call paste when isDragging=true and Ctrl+V is pressed', () => {
      mockContainer.focus();
      const mockPaste = vi.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onPaste: mockPaste,
          isDragging: true,
          containerRef,
        })
      );

      dispatchKeyEvent('KeyV', { ctrlKey: true });

      expect(mockPaste).not.toHaveBeenCalled();
    });

    it('should NOT call cut when isDragging=true and Ctrl+X is pressed', () => {
      mockContainer.focus();
      const mockCut = vi.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onCut: mockCut,
          isDragging: true,
          containerRef,
        })
      );

      dispatchKeyEvent('KeyX', { ctrlKey: true });

      expect(mockCut).not.toHaveBeenCalled();
    });

    it('should NOT call duplicate when isDragging=true and Ctrl+D is pressed', () => {
      mockContainer.focus();
      const mockDuplicate = vi.fn();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onDuplicate: mockDuplicate,
          isDragging: true,
          containerRef,
        })
      );

      dispatchKeyEvent('KeyD', { ctrlKey: true });

      expect(mockDuplicate).not.toHaveBeenCalled();
    });

    it('should NOT call event.preventDefault() when drag suppresses shortcuts', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: vi.fn(),
          onDeleteNote: vi.fn(),
          onCopy: vi.fn(),
          isDragging: true,
          containerRef,
        })
      );

      const event = dispatchKeyEvent('KeyC', { ctrlKey: true });

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('Visual feedback flag behavior (Requirement 1.5)', () => {
    const sampleNotes: Note[] = [
      { id: 'note-1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
      { id: 'note-2', pitch: 64, start: 1, duration: 1, velocity: 0.7 },
    ];
    const gridSnap: GridSnapConfig = { enabled: true, division: 0.25 };

    it('should set showCopyFeedback to true after copy() is called', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useCopyPaste({
          notes: sampleNotes,
          selectedNoteIds: new Set(['note-1', 'note-2']),
          playheadPosition: 4,
          gridSnap,
          onNotesCreated: vi.fn(),
          onNotesDeleted: vi.fn(),
          onSelectionChanged: vi.fn(),
        })
      );

      act(() => {
        result.current.copy();
      });

      expect(result.current.showCopyFeedback).toBe(true);
    });

    it('should reset showCopyFeedback to false after 200ms', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useCopyPaste({
          notes: sampleNotes,
          selectedNoteIds: new Set(['note-1', 'note-2']),
          playheadPosition: 4,
          gridSnap,
          onNotesCreated: vi.fn(),
          onNotesDeleted: vi.fn(),
          onSelectionChanged: vi.fn(),
        })
      );

      act(() => {
        result.current.copy();
      });

      expect(result.current.showCopyFeedback).toBe(true);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.showCopyFeedback).toBe(false);
    });

    it('should set showCopyFeedback to true after cut() is called', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useCopyPaste({
          notes: sampleNotes,
          selectedNoteIds: new Set(['note-1']),
          playheadPosition: 4,
          gridSnap,
          onNotesCreated: vi.fn(),
          onNotesDeleted: vi.fn(),
          onSelectionChanged: vi.fn(),
        })
      );

      act(() => {
        result.current.cut();
      });

      expect(result.current.showCopyFeedback).toBe(true);
    });

    it('should reset the timer if copy is called again before 200ms', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() =>
        useCopyPaste({
          notes: sampleNotes,
          selectedNoteIds: new Set(['note-1', 'note-2']),
          playheadPosition: 4,
          gridSnap,
          onNotesCreated: vi.fn(),
          onNotesDeleted: vi.fn(),
          onSelectionChanged: vi.fn(),
        })
      );

      // First copy
      act(() => {
        result.current.copy();
      });

      expect(result.current.showCopyFeedback).toBe(true);

      // Advance 100ms (not yet 200ms)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Second copy before 200ms - should reset the timer
      act(() => {
        result.current.copy();
      });

      expect(result.current.showCopyFeedback).toBe(true);

      // Advance 100ms more (200ms total since first copy, but only 100ms since second)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Should still be true because timer was reset
      expect(result.current.showCopyFeedback).toBe(true);

      // Advance remaining 100ms (now 200ms since second copy)
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Now it should be false
      expect(result.current.showCopyFeedback).toBe(false);
    });
  });
});
