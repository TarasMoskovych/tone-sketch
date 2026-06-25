/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMarqueeSelection } from '@/components/PianoRoll/hooks/useMarqueeSelection';
import type { Note } from '@/types/note';
import type { VisibleRegion } from '@/types/grid';

/**
 * Unit tests for useMarqueeSelection hook
 *
 * This test suite covers:
 * 1. Marquee lifecycle (start, update, end)
 * 2. isSelecting flag state
 * 3. Additive selection (when isAdditive is true)
 * 4. Replace selection (when isAdditive is false)
 * 5. Cancellation restores previous selection
 * 6. Escape key triggers cancellation
 *
 * **Validates: Requirements 9.4, 9.5**
 */

// Mock container element with getBoundingClientRect
function createMockContainer(width = 800, height = 600): HTMLDivElement {
  const container = document.createElement('div');
  container.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width,
    height,
    top: 0,
    right: width,
    bottom: height,
    left: 0,
    toJSON: () => ({}),
  });
  return container;
}

// Test fixtures
const defaultVisibleRegion: VisibleRegion = {
  startBeat: 0,
  endBeat: 16,
  startPitch: 48,
  endPitch: 72,
};

const testNotes: Note[] = [
  { id: 'note-1', pitch: 60, start: 2, duration: 1, velocity: 0.8 },
  { id: 'note-2', pitch: 62, start: 4, duration: 2, velocity: 0.8 },
  { id: 'note-3', pitch: 64, start: 6, duration: 1, velocity: 0.8 },
  { id: 'note-4', pitch: 58, start: 8, duration: 0.5, velocity: 0.8 },
];

describe('useMarqueeSelection', () => {
  let mockContainer: HTMLDivElement;
  let containerRef: React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    containerRef = { current: mockContainer };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Marquee Lifecycle', () => {
    /**
     * Test marquee start/update/end lifecycle
     * **Validates: Requirement 9.2** - Manage marquee rectangle state during drag
     */
    it('should initialize with no marquee state', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      expect(result.current.marqueeState).toBeNull();
      expect(result.current.isSelecting).toBe(false);
    });

    it('should start marquee with correct initial state', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      expect(result.current.marqueeState).not.toBeNull();
      expect(result.current.marqueeState?.startX).toBe(100);
      expect(result.current.marqueeState?.startY).toBe(50);
      expect(result.current.marqueeState?.currentX).toBe(100);
      expect(result.current.marqueeState?.currentY).toBe(50);
      expect(result.current.marqueeState?.isAdditive).toBe(false);
      expect(result.current.isSelecting).toBe(true);
    });

    it('should update marquee current position on update', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      act(() => {
        result.current.updateMarquee(200, 150);
      });

      expect(result.current.marqueeState?.currentX).toBe(200);
      expect(result.current.marqueeState?.currentY).toBe(150);
      expect(result.current.isSelecting).toBe(true);
    });

    it('should clear marquee state on endMarquee', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      expect(result.current.isSelecting).toBe(true);

      act(() => {
        // Move to make it a valid drag (not just a click)
        result.current.updateMarquee(150, 100);
      });

      act(() => {
        result.current.endMarquee();
      });

      expect(result.current.marqueeState).toBeNull();
      expect(result.current.isSelecting).toBe(false);
    });

    it('should do nothing when updating without an active marquee', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.updateMarquee(200, 150);
      });

      expect(result.current.marqueeState).toBeNull();
      expect(result.current.isSelecting).toBe(false);
    });

    it('should do nothing when ending without an active marquee', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.endMarquee();
      });

      expect(result.current.marqueeState).toBeNull();
      expect(result.current.isSelecting).toBe(false);
    });
  });

  describe('isSelecting Flag', () => {
    /**
     * Test isSelecting flag state during marquee operations
     */
    it('should return false when no marquee is active', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      expect(result.current.isSelecting).toBe(false);
    });

    it('should return true when marquee is active', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      expect(result.current.isSelecting).toBe(true);
    });

    it('should return false after marquee is ended', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      expect(result.current.isSelecting).toBe(true);

      act(() => {
        result.current.updateMarquee(150, 100);
      });

      act(() => {
        result.current.endMarquee();
      });

      expect(result.current.isSelecting).toBe(false);
    });

    it('should return false after marquee is cancelled', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      expect(result.current.isSelecting).toBe(true);

      act(() => {
        result.current.cancelMarquee();
      });

      expect(result.current.isSelecting).toBe(false);
    });
  });

  describe('Additive Selection (isAdditive: true)', () => {
    /**
     * Test additive selection mode when isAdditive is true
     * **Validates: Requirement 9.4** - Support additive selection mode
     */
    it('should preserve previous selection in additive mode', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();
      const previousSelection = new Set(['note-1']);

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: previousSelection,
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, true, previousSelection);
      });

      expect(result.current.marqueeState?.isAdditive).toBe(true);
      expect(result.current.marqueeState?.previousSelection).toEqual(previousSelection);
    });

    it('should store previous selection for additive union', () => {
      const previousSelection = new Set(['note-1', 'note-2']);

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: previousSelection,
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, true, previousSelection);
      });

      expect(result.current.marqueeState?.previousSelection.size).toBe(2);
      expect(result.current.marqueeState?.previousSelection.has('note-1')).toBe(true);
      expect(result.current.marqueeState?.previousSelection.has('note-2')).toBe(true);
    });
  });

  describe('Replace Selection (isAdditive: false)', () => {
    /**
     * Test replace selection mode when isAdditive is false
     * Property 6: Replace mode - selection equals intersecting notes
     */
    it('should set isAdditive to false in replace mode', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(['note-1']),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set(['note-1']));
      });

      expect(result.current.marqueeState?.isAdditive).toBe(false);
    });

    it('should call onDeselectAll in replace mode during update', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(['note-1']),
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set(['note-1']));
      });

      act(() => {
        result.current.updateMarquee(200, 150);
      });

      // In replace mode, should call onDeselectAll
      expect(onDeselectAll).toHaveBeenCalled();
    });
  });

  describe('Cancellation Restores Previous Selection', () => {
    /**
     * Test that cancellation restores the previous selection state
     * **Validates: Requirement 9.5** - Support selection cancellation with state restoration
     * Property 8: Marquee Cancel Restores State
     */
    it('should restore previous selection when cancelled', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();
      const previousSelection = new Set(['note-1', 'note-2']);

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: previousSelection,
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, previousSelection);
      });

      // Update to simulate drag
      act(() => {
        result.current.updateMarquee(200, 150);
      });

      // Clear mocks to check cancel behavior
      onAddToSelection.mockClear();
      onDeselectAll.mockClear();

      // Cancel should restore previous selection
      act(() => {
        result.current.cancelMarquee();
      });

      expect(onDeselectAll).toHaveBeenCalled();
      expect(onAddToSelection).toHaveBeenCalledWith(['note-1', 'note-2']);
    });

    it('should call onDeselectAll when cancelled with no previous selection', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      act(() => {
        result.current.cancelMarquee();
      });

      expect(onDeselectAll).toHaveBeenCalled();
      // Should not call onAddToSelection with empty array
      expect(onAddToSelection).not.toHaveBeenCalled();
    });

    it('should clear marquee state on cancel', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      expect(result.current.marqueeState).not.toBeNull();

      act(() => {
        result.current.cancelMarquee();
      });

      expect(result.current.marqueeState).toBeNull();
      expect(result.current.isSelecting).toBe(false);
    });

    it('should do nothing when cancelling without an active marquee', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.cancelMarquee();
      });

      expect(onDeselectAll).not.toHaveBeenCalled();
      expect(onAddToSelection).not.toHaveBeenCalled();
    });
  });

  describe('Escape Key Cancellation', () => {
    /**
     * Test that Escape key triggers marquee cancellation
     * **Validates: Requirement 9.5** - Implement cancellation with Escape key
     */
    it('should cancel marquee when Escape key is pressed', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();
      const previousSelection = new Set(['note-1']);

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: previousSelection,
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, previousSelection);
      });

      expect(result.current.isSelecting).toBe(true);

      // Simulate Escape key press
      act(() => {
        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(escapeEvent);
      });

      expect(result.current.isSelecting).toBe(false);
      expect(result.current.marqueeState).toBeNull();
      expect(onDeselectAll).toHaveBeenCalled();
      expect(onAddToSelection).toHaveBeenCalledWith(['note-1']);
    });

    it('should not respond to Escape key when no marquee is active', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();

      renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      // Simulate Escape key press without active marquee
      act(() => {
        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(escapeEvent);
      });

      expect(onDeselectAll).not.toHaveBeenCalled();
      expect(onAddToSelection).not.toHaveBeenCalled();
    });

    it('should not respond to other keys during marquee', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      // Simulate other key presses
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
      });

      // Marquee should still be active
      expect(result.current.isSelecting).toBe(true);
      expect(result.current.marqueeState).not.toBeNull();
    });

    it('should clean up event listener when marquee ends', () => {
      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      act(() => {
        result.current.updateMarquee(150, 100);
      });

      act(() => {
        result.current.endMarquee();
      });

      // After ending, Escape should not trigger any action
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();

      // Re-render with callbacks
      const { result: result2 } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(['note-1']),
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      // Escape without active marquee should not call callbacks
      act(() => {
        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        window.dispatchEvent(escapeEvent);
      });

      expect(result2.current.isSelecting).toBe(false);
      expect(onDeselectAll).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null container ref gracefully during update', () => {
      const nullContainerRef = { current: null };

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef: nullContainerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      // Should not throw when containerRef is null
      act(() => {
        result.current.updateMarquee(200, 150);
      });

      expect(result.current.isSelecting).toBe(true);
    });

    it('should handle null container ref gracefully during endMarquee', () => {
      const nullContainerRef = { current: null };

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef: nullContainerRef,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      // Should not throw and should clear marquee state
      act(() => {
        result.current.endMarquee();
      });

      expect(result.current.marqueeState).toBeNull();
      expect(result.current.isSelecting).toBe(false);
    });

    it('should handle empty notes array', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: [],
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      act(() => {
        result.current.updateMarquee(200, 150);
      });

      // Should work without errors even with empty notes
      expect(result.current.isSelecting).toBe(true);
    });

    it('should treat small drags as clicks (not selecting)', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();

      const { result } = renderHook(() =>
        useMarqueeSelection({
          notes: testNotes,
          selectedNoteIds: new Set(),
          visibleRegion: defaultVisibleRegion,
          containerRef,
          onAddToSelection,
          onDeselectAll,
        })
      );

      act(() => {
        result.current.startMarquee(100, 50, false, new Set());
      });

      // Move less than MIN_MARQUEE_DISTANCE (5 pixels)
      act(() => {
        result.current.updateMarquee(102, 52);
      });

      // Clear mocks to test endMarquee behavior
      onAddToSelection.mockClear();
      onDeselectAll.mockClear();

      act(() => {
        result.current.endMarquee();
      });

      // With drag < 5 pixels, endMarquee should not finalize selection
      // (this allows clicking through to create notes)
      expect(result.current.marqueeState).toBeNull();
    });
  });
});
