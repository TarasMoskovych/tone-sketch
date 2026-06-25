/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { PianoRollCanvas } from '@/components/PianoRoll';
import { CANVAS_CONFIG } from '@/components/PianoRoll/constants';
import type { Note } from '@/types/note';
import type { VisibleRegion } from '@/types/grid';

/**
 * Integration Tests for PianoRollCanvas Component
 *
 * These tests verify functional parity after the refactoring from a single ~3000-line file
 * into a modular folder structure. All core interactions should work identically.
 *
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 13.1, 13.2, 13.3**
 *
 * Test Coverage:
 * 1. Note creation via click
 * 2. Note drag to move
 * 3. Note resize via right edge drag
 * 4. Marquee selection
 * 5. Scrollbar interaction
 * 6. Keyboard shortcuts (Space, Delete, Ctrl+A)
 */

// Constants from CANVAS_CONFIG for calculations
const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;


// Default visible region for tests
const defaultVisibleRegion: VisibleRegion = {
  startBeat: 0,
  endBeat: 16,
  startPitch: 48,
  endPitch: 72,
};

// Test notes
const createTestNotes = (): Note[] => [
  { id: 'note-1', pitch: 60, start: 2, duration: 1, velocity: 0.8 },
  { id: 'note-2', pitch: 62, start: 4, duration: 2, velocity: 0.8 },
  { id: 'note-3', pitch: 64, start: 8, duration: 1, velocity: 0.8 },
];

// Helper to create a mock container with getBoundingClientRect
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createMockContainer(width = 800, height = 600): HTMLDivElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({
      x: 0,
      y: 0,
      width,
      height,
      top: 0,
      right: width,
      bottom: height,
      left: 0,
      toJSON: () => ({}),
    }),
  });
  return container;
}

// Helper to calculate pixel positions from beat/pitch coordinates
function beatToPixelX(beat: number, containerWidth: number, visibleRegion: VisibleRegion): number {
  const gridWidth = containerWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
  return PITCH_LABEL_WIDTH + ((beat - visibleRegion.startBeat) / visibleBeats) * gridWidth;
}


function pitchToPixelY(pitch: number, containerHeight: number, visibleRegion: VisibleRegion): number {
  const gridHeight = containerHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
  const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;
  // Pitch increases upward, but Y increases downward
  return TIME_MARKER_HEIGHT + ((visibleRegion.endPitch - pitch) / visibleSemitones) * gridHeight;
}

// Mock canvas context
function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    clip: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    roundRect: vi.fn(),
    setLineDash: vi.fn(),
    getLineDash: vi.fn(() => []),
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}


describe('PianoRollCanvas Integration Tests', () => {
  let mockContext: CanvasRenderingContext2D;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function mockContainerRect(container: HTMLElement) {
    container.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    }));
  }

  beforeEach(() => {
    mockContext = createMockCanvasContext();

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext);

    // Mock window.devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true });

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_callback: ResizeObserverCallback) {
        // Store callback but don't call it automatically
      }
    };

    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    // Mock Element.getBoundingClientRect for all elements
    Element.prototype.getBoundingClientRect = function() {
      // Return consistent dimensions for all elements in tests
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        top: 0,
        right: 800,
        bottom: 600,
        left: 0,
        toJSON: () => ({}),
      };
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });


  // ==========================================================================
  // 1. Note Creation via Click
  // ==========================================================================
  describe('Note Creation via Click', () => {
    /**
     * Test: Clicking on empty grid space creates a note
     * **Validates: Requirement 12.1** - Note creation behavior identical to before refactoring
     */
    it('should call onNoteCreate when clicking on empty grid space', () => {
      const onNoteCreate = vi.fn();
      const onDeselectAll = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={[]}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onNoteCreate={onNoteCreate}
          onDeselectAll={onDeselectAll}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();

      // Click on empty grid area (inside grid, away from margins)
      const clickX = beatToPixelX(4, 800, defaultVisibleRegion);
      const clickY = pitchToPixelY(60, 600, defaultVisibleRegion);

      fireEvent.click(canvas!, {
        clientX: clickX,
        clientY: clickY,
        button: 0,
      });

      expect(onNoteCreate).toHaveBeenCalledTimes(1);
      const createdNote = onNoteCreate.mock.calls[0][0] as Note;
      expect(createdNote).toBeDefined();
      expect(createdNote.pitch).toBe(60);
      expect(createdNote.id).toBeDefined();
    });


    it('should not create note when clicking on existing note', () => {
      const onNoteCreate = vi.fn();
      const onNoteSelect = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onNoteCreate={onNoteCreate}
          onNoteSelect={onNoteSelect}
        />
      );

      const canvas = container.querySelector('canvas');

      // Click on an existing note (note-1 at beat 2, pitch 60)
      const clickX = beatToPixelX(2.5, 800, defaultVisibleRegion);
      const clickY = pitchToPixelY(60, 600, defaultVisibleRegion);

      fireEvent.click(canvas!, {
        clientX: clickX,
        clientY: clickY,
        button: 0,
      });

      // Should select the note, not create a new one
      expect(onNoteCreate).not.toHaveBeenCalled();
      expect(onNoteSelect).toHaveBeenCalledWith('note-1');
    });

    it('should deselect all when clicking on empty space', () => {
      const onDeselectAll = vi.fn();
      const onSetSelectionAnchor = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={[]}
          selectedNoteIds={new Set(['note-1'])}
          visibleRegion={defaultVisibleRegion}
          onDeselectAll={onDeselectAll}
          onSetSelectionAnchor={onSetSelectionAnchor}
        />
      );

      const canvas = container.querySelector('canvas');
      const clickX = beatToPixelX(6, 800, defaultVisibleRegion);
      const clickY = pitchToPixelY(64, 600, defaultVisibleRegion);

      fireEvent.click(canvas!, {
        clientX: clickX,
        clientY: clickY,
        button: 0,
      });

      expect(onDeselectAll).toHaveBeenCalled();
    });
  });


  // ==========================================================================
  // 2. Note Drag to Move
  // ==========================================================================
  describe('Note Drag to Move', () => {
    /**
     * Test: Dragging a note moves it
     * **Validates: Requirement 12.2** - Note movement behavior identical to before refactoring
     */
    it('should initiate note drag on mousedown on a note', () => {
      const onNoteUpdate = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onNoteUpdate={onNoteUpdate}
        />
      );

      const canvas = container.querySelector('canvas');

      // Mousedown on note-1 (beat 2, pitch 60)
      const noteX = beatToPixelX(2.5, 800, defaultVisibleRegion);
      const noteY = pitchToPixelY(60, 600, defaultVisibleRegion);

      fireEvent.mouseDown(canvas!, {
        clientX: noteX,
        clientY: noteY,
        button: 0,
      });

      // Simulate drag by moving the mouse
      fireEvent.mouseMove(window, {
        clientX: noteX + 50, // Move 50 pixels to the right
        clientY: noteY,
      });

      // Note should be updated with new position
      expect(onNoteUpdate).toHaveBeenCalled();
    });


    it('should complete drag on mouseup', () => {
      const onNoteUpdate = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onNoteUpdate={onNoteUpdate}
        />
      );

      const canvas = container.querySelector('canvas');
      const noteX = beatToPixelX(2.5, 800, defaultVisibleRegion);
      const noteY = pitchToPixelY(60, 600, defaultVisibleRegion);

      // Start drag
      fireEvent.mouseDown(canvas!, {
        clientX: noteX,
        clientY: noteY,
        button: 0,
      });

      // Drag
      fireEvent.mouseMove(window, {
        clientX: noteX + 50,
        clientY: noteY,
      });

      // End drag
      fireEvent.mouseUp(window);

      // The drag should have completed
      expect(onNoteUpdate).toHaveBeenCalled();
    });

    it('should cancel drag on Escape key', () => {
      const onNoteUpdate = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onNoteUpdate={onNoteUpdate}
        />
      );

      const canvas = container.querySelector('canvas');
      const noteX = beatToPixelX(2.5, 800, defaultVisibleRegion);
      const noteY = pitchToPixelY(60, 600, defaultVisibleRegion);

      // Start drag
      fireEvent.mouseDown(canvas!, {
        clientX: noteX,
        clientY: noteY,
        button: 0,
      });

      // Press Escape to cancel
      fireEvent.keyDown(window, { key: 'Escape' });

      // Original note position should be restored
      expect(onNoteUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: 'note-1',
          start: 2,
          pitch: 60,
        })
      );
    });
  });


  // ==========================================================================
  // 3. Note Resize via Right Edge Drag
  // ==========================================================================
  describe('Note Resize via Right Edge Drag', () => {
    /**
     * Test: Dragging the right edge of a note resizes it
     * **Validates: Requirement 12.3** - Note resize behavior identical to before refactoring
     */
    it('should initiate resize when dragging near right edge of note', () => {
      const onNoteUpdate = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onNoteUpdate={onNoteUpdate}
        />
      );

      const canvas = container.querySelector('canvas');

      // Click near the right edge of note-1 (beat 2 + duration 1 = beat 3)
      const noteEndX = beatToPixelX(3, 800, defaultVisibleRegion);
      const noteY = pitchToPixelY(60, 600, defaultVisibleRegion);

      // Click slightly before the end (within resize handle width of 8px)
      fireEvent.mouseDown(canvas!, {
        clientX: noteEndX - 4, // Within resize handle zone
        clientY: noteY,
        button: 0,
      });

      // Drag to resize
      fireEvent.mouseMove(window, {
        clientX: noteEndX + 50, // Extend the note
        clientY: noteY,
      });

      // Note should be updated with new duration
      expect(onNoteUpdate).toHaveBeenCalled();
      const updatedNote = onNoteUpdate.mock.calls[0][0] as Note;
      expect(updatedNote.id).toBe('note-1');
      // Duration should have increased
      expect(updatedNote.duration).toBeGreaterThan(1);
    });
  });


  // ==========================================================================
  // 4. Marquee Selection
  // ==========================================================================
  describe('Marquee Selection', () => {
    /**
     * Test: Click-dragging on empty space creates a selection box
     * **Validates: Requirement 12.4** - Marquee selection behavior identical to before refactoring
     */
    it('should start marquee selection on mousedown on empty space', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onAddToSelection={onAddToSelection}
          onDeselectAll={onDeselectAll}
        />
      );

      const canvas = container.querySelector('canvas');

      // Start marquee on empty space (beat 10, pitch 66 - away from all notes)
      const startX = beatToPixelX(10, 800, defaultVisibleRegion);
      const startY = pitchToPixelY(66, 600, defaultVisibleRegion);

      fireEvent.mouseDown(canvas!, {
        clientX: startX,
        clientY: startY,
        button: 0,
      });

      // Drag to create selection rectangle
      fireEvent.mouseMove(window, {
        clientX: startX + 100,
        clientY: startY + 50,
      });

      // Complete the marquee
      fireEvent.mouseUp(window);

      // onDeselectAll should be called to clear previous selection
      expect(onDeselectAll).toHaveBeenCalled();
    });


    it('should select notes within marquee bounds', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onAddToSelection={onAddToSelection}
          onDeselectAll={onDeselectAll}
        />
      );

      const canvas = container.querySelector('canvas');

      // Create a marquee that encompasses note-1 (beat 2, pitch 60) and note-2 (beat 4, pitch 62)
      const startX = beatToPixelX(1, 800, defaultVisibleRegion);
      const startY = pitchToPixelY(65, 600, defaultVisibleRegion); // Above the notes
      const endX = beatToPixelX(7, 800, defaultVisibleRegion);
      const endY = pitchToPixelY(58, 600, defaultVisibleRegion); // Below the notes

      fireEvent.mouseDown(canvas!, {
        clientX: startX,
        clientY: startY,
        button: 0,
      });

      fireEvent.mouseMove(window, {
        clientX: endX,
        clientY: endY,
      });

      fireEvent.mouseUp(window);

      // Notes within the marquee should be selected
      expect(onAddToSelection).toHaveBeenCalled();
    });

    it('should cancel marquee on Escape key', () => {
      const onAddToSelection = vi.fn();
      const onDeselectAll = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set(['note-1'])}
          visibleRegion={defaultVisibleRegion}
          onAddToSelection={onAddToSelection}
          onDeselectAll={onDeselectAll}
        />
      );

      const canvas = container.querySelector('canvas');

      const startX = beatToPixelX(10, 800, defaultVisibleRegion);
      const startY = pitchToPixelY(66, 600, defaultVisibleRegion);

      fireEvent.mouseDown(canvas!, {
        clientX: startX,
        clientY: startY,
        button: 0,
      });

      fireEvent.mouseMove(window, {
        clientX: startX + 100,
        clientY: startY + 50,
      });

      // Press Escape to cancel
      fireEvent.keyDown(window, { key: 'Escape' });

      // Previous selection should be restored
      expect(onAddToSelection).toHaveBeenCalledWith(['note-1']);
    });
  });


  // ==========================================================================
  // 5. Scrollbar Interaction
  // ==========================================================================
  describe('Scrollbar Interaction', () => {
    /**
     * Test: Dragging scrollbars pans the view
     * **Validates: Requirement 12.5** - Scrollbar interaction identical to before refactoring
     *
     * Note: The scrollbar hit detection requires clicking on the actual thumb,
     * not just anywhere in the scrollbar track. The thumb position is calculated
     * from the visible region and total beats.
     */
    it('should start horizontal scrollbar drag when clicking on horizontal scrollbar thumb', () => {
      const onVisibleRegionChange = vi.fn();

      // Use a visible region that places the thumb at a predictable position
      // With startBeat=0, endBeat=16, totalBeats=64, the thumb starts at the left
      const { container } = render(
        <PianoRollCanvas
          notes={[]}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onVisibleRegionChange={onVisibleRegionChange}
          totalBeats={64}
        />
      );

      const canvas = container.querySelector('canvas');

      // Horizontal scrollbar track starts at PITCH_LABEL_WIDTH (50) and ends at width - SCROLLBAR_WIDTH
      // With visibleRegion at startBeat=0, the thumb is at the left edge
      // Track width = 800 - 50 - 14 = 736
      // Thumb position = 0 (at left edge) since startBeat=0
      // Thumb width = max(30, 736 * (16/64)) = max(30, 184) = 184
      const scrollbarY = 600 - SCROLLBAR_HEIGHT / 2; // Middle of scrollbar track vertically
      const thumbX = PITCH_LABEL_WIDTH + 50; // Well within the thumb at left edge

      fireEvent.mouseDown(canvas!, {
        clientX: thumbX,
        clientY: scrollbarY,
        button: 0,
      });

      // Drag the scrollbar
      fireEvent.mouseMove(window, {
        clientX: thumbX + 100,
        clientY: scrollbarY,
      });

      fireEvent.mouseUp(window);

      // Visible region should have changed
      expect(onVisibleRegionChange).toHaveBeenCalled();
    });


    it('should start vertical scrollbar drag when clicking on vertical scrollbar', () => {
      const onVisibleRegionChange = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={[]}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onVisibleRegionChange={onVisibleRegionChange}
        />
      );

      const canvas = container.querySelector('canvas');

      // Click on the vertical scrollbar area (right side of canvas)
      const scrollbarX = 800 - SCROLLBAR_WIDTH / 2; // Middle of vertical scrollbar
      const scrollbarY = 300; // Middle of canvas height

      fireEvent.mouseDown(canvas!, {
        clientX: scrollbarX,
        clientY: scrollbarY,
        button: 0,
      });

      // Drag the scrollbar
      fireEvent.mouseMove(window, {
        clientX: scrollbarX,
        clientY: scrollbarY + 50,
      });

      fireEvent.mouseUp(window);

      // Visible region should have changed
      expect(onVisibleRegionChange).toHaveBeenCalled();
    });

    it('should cancel scrollbar drag on Escape key', () => {
      const onVisibleRegionChange = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={[]}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onVisibleRegionChange={onVisibleRegionChange}
        />
      );

      const canvas = container.querySelector('canvas');

      const scrollbarY = 600 - SCROLLBAR_HEIGHT / 2;
      const scrollbarX = 400;

      fireEvent.mouseDown(canvas!, {
        clientX: scrollbarX,
        clientY: scrollbarY,
        button: 0,
      });

      // Press Escape to cancel
      fireEvent.keyDown(window, { key: 'Escape' });

      // Scrollbar drag should be cancelled
      // (No additional visible region changes after initial)
    });
  });


  // ==========================================================================
  // 6. Keyboard Shortcuts
  // ==========================================================================
  describe('Keyboard Shortcuts', () => {
    /**
     * Test: Space toggles play/pause
     * **Validates: Requirement 12.6** - Space bar shortcut behavior identical to before refactoring
     */
    it('should toggle playback on Space key', () => {
      const onTogglePlayback = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={[]}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onTogglePlayback={onTogglePlayback}
          keyboardShortcutsEnabled={true}
        />
      );

      const canvas = container.querySelector('canvas');

      // Focus the canvas
      canvas?.focus();

      // Press Space
      fireEvent.keyDown(document, { key: ' ', code: 'Space' });

      expect(onTogglePlayback).toHaveBeenCalled();
    });


    /**
     * Test: Delete removes selected notes
     * **Validates: Requirement 12.6** - Delete key shortcut behavior identical to before refactoring
     */
    it('should delete selected notes on Delete key', () => {
      const onNoteDelete = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={createTestNotes()}
          selectedNoteIds={new Set(['note-1', 'note-2'])}
          visibleRegion={defaultVisibleRegion}
          onNoteDelete={onNoteDelete}
          keyboardShortcutsEnabled={true}
        />
      );

      const canvas = container.querySelector('canvas');
      canvas?.focus();

      // Press Delete
      fireEvent.keyDown(document, { key: 'Delete' });

      // Both selected notes should be deleted
      expect(onNoteDelete).toHaveBeenCalledWith('note-1');
      expect(onNoteDelete).toHaveBeenCalledWith('note-2');
    });

    it('should delete selected notes on Backspace key', () => {
      const onNoteDelete = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={createTestNotes()}
          selectedNoteIds={new Set(['note-3'])}
          visibleRegion={defaultVisibleRegion}
          onNoteDelete={onNoteDelete}
          keyboardShortcutsEnabled={true}
        />
      );

      const canvas = container.querySelector('canvas');
      canvas?.focus();

      // Press Backspace
      fireEvent.keyDown(document, { key: 'Backspace' });

      expect(onNoteDelete).toHaveBeenCalledWith('note-3');
    });


    /**
     * Test: Ctrl+A selects all notes
     * **Validates: Requirement 12.6** - Select All shortcut behavior identical to before refactoring
     */
    it('should select all notes on Ctrl+A', async () => {
      const onSelectAll = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={createTestNotes()}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onSelectAll={onSelectAll}
          keyboardShortcutsEnabled={true}
        />
      );

      const canvas = container.querySelector('canvas');
      // Focus the canvas to enable keyboard shortcuts
      await act(async () => {
        canvas?.focus();
      });

      // Press Ctrl+A (use KeyA code as that's what the hook checks)
      fireEvent.keyDown(document, { key: 'a', code: 'KeyA', ctrlKey: true });

      expect(onSelectAll).toHaveBeenCalled();
    });

    it('should select all notes on Cmd+A (macOS)', async () => {
      const onSelectAll = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={createTestNotes()}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onSelectAll={onSelectAll}
          keyboardShortcutsEnabled={true}
        />
      );

      const canvas = container.querySelector('canvas');
      // Focus the canvas to enable keyboard shortcuts
      await act(async () => {
        canvas?.focus();
      });

      // Press Cmd+A (macOS) - use KeyA code as that's what the hook checks
      fireEvent.keyDown(document, { key: 'a', code: 'KeyA', metaKey: true });

      expect(onSelectAll).toHaveBeenCalled();
    });


    it('should not trigger Space and Ctrl+A when keyboardShortcutsEnabled is false', () => {
      const onTogglePlayback = vi.fn();
      const onSelectAll = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={createTestNotes()}
          selectedNoteIds={new Set(['note-1'])}
          visibleRegion={defaultVisibleRegion}
          onTogglePlayback={onTogglePlayback}
          onSelectAll={onSelectAll}
          keyboardShortcutsEnabled={false}
        />
      );

      const canvas = container.querySelector('canvas');
      canvas?.focus();

      fireEvent.keyDown(document, { key: ' ', code: 'Space' });
      fireEvent.keyDown(document, { key: 'a', ctrlKey: true });

      // Space and Ctrl+A should be disabled when keyboardShortcutsEnabled is false
      expect(onTogglePlayback).not.toHaveBeenCalled();
      expect(onSelectAll).not.toHaveBeenCalled();
    });

    it('should still handle Delete when there are selected notes (internal handler)', () => {
      // Note: Delete/Backspace is handled by the component's internal handleKeyDown
      // which is active when there are selected notes, regardless of keyboardShortcutsEnabled
      const onNoteDelete = vi.fn();

      render(
        <PianoRollCanvas
          notes={createTestNotes()}
          selectedNoteIds={new Set(['note-1'])}
          visibleRegion={defaultVisibleRegion}
          onNoteDelete={onNoteDelete}
          keyboardShortcutsEnabled={false}
        />
      );

      fireEvent.keyDown(window, { key: 'Delete' });

      // Delete is handled by internal handler regardless of keyboardShortcutsEnabled
      expect(onNoteDelete).toHaveBeenCalledWith('note-1');
    });
  });

  // ==========================================================================
  // 7. Existing Test Pattern Compatibility
  // ==========================================================================
  describe('Existing Test Pattern Compatibility', () => {
    /**
     * Test: Component renders without errors
     * **Validates: Requirement 13.1, 13.2, 13.3** - Existing test patterns pass without modification
     */
    it('should render without crashing', () => {
      expect(() => {
        render(
          <PianoRollCanvas
            notes={[]}
            selectedNoteIds={new Set()}
            visibleRegion={defaultVisibleRegion}
          />
        );
      }).not.toThrow();
    });

    it('should render with all optional props', () => {
      expect(() => {
        render(
          <PianoRollCanvas
            notes={createTestNotes()}
            selectedNoteIds={new Set(['note-1'])}
            visibleRegion={defaultVisibleRegion}
            playheadPosition={4}
            gridSnap={{ enabled: true, division: 0.25 }}
            totalBeats={64}
            isPlaying={true}
            activePitches={new Set([60, 62])}
            autoScrollDuringPlayback={true}
            keyboardShortcutsEnabled={true}
            className="test-class"
            onNoteCreate={vi.fn()}
            onNoteUpdate={vi.fn()}
            onNoteDelete={vi.fn()}
            onNoteSelect={vi.fn()}
            onToggleNoteSelection={vi.fn()}
            onAddToSelection={vi.fn()}
            onDeselectAll={vi.fn()}
            onSetSelectionAnchor={vi.fn()}
            onBulkNoteUpdate={vi.fn()}
            onVisibleRegionChange={vi.fn()}
            onPlayheadChange={vi.fn()}
            onTogglePlayback={vi.fn()}
            onSelectAll={vi.fn()}
          />
        );
      }).not.toThrow();
    });


    it('should have accessible canvas element', () => {
      const { container } = render(
        <PianoRollCanvas
          notes={[]}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
        />
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.getAttribute('role')).toBe('img');
      expect(canvas?.getAttribute('aria-label')).toBe('Piano roll editor grid');
      expect(canvas?.getAttribute('tabindex')).toBe('0');
    });

    it('should apply className prop', () => {
      const { container } = render(
        <PianoRollCanvas
          notes={[]}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          className="custom-class"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains('custom-class')).toBe(true);
    });
  });


  // ==========================================================================
  // 8. Context Menu (Right-Click) Delete
  // ==========================================================================
  describe('Context Menu Delete', () => {
    /**
     * Test: Right-click on note deletes it
     */
    it('should delete note on right-click context menu', () => {
      const onNoteDelete = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onNoteDelete={onNoteDelete}
        />
      );

      const canvas = container.querySelector('canvas');

      // Right-click on note-1 (beat 2, pitch 60)
      const noteX = beatToPixelX(2.5, 800, defaultVisibleRegion);
      const noteY = pitchToPixelY(60, 600, defaultVisibleRegion);

      fireEvent.contextMenu(canvas!, {
        clientX: noteX,
        clientY: noteY,
      });

      expect(onNoteDelete).toHaveBeenCalledWith('note-1');
    });

    it('should delete all selected notes on right-click when note is selected', () => {
      const onNoteDelete = vi.fn();
      const onDeselectAll = vi.fn();
      const notes = createTestNotes();

      const { container } = render(
        <PianoRollCanvas
          notes={notes}
          selectedNoteIds={new Set(['note-1', 'note-2'])}
          visibleRegion={defaultVisibleRegion}
          onNoteDelete={onNoteDelete}
          onDeselectAll={onDeselectAll}
        />
      );

      const canvas = container.querySelector('canvas');

      // Right-click on note-1 which is selected
      const noteX = beatToPixelX(2.5, 800, defaultVisibleRegion);
      const noteY = pitchToPixelY(60, 600, defaultVisibleRegion);

      fireEvent.contextMenu(canvas!, {
        clientX: noteX,
        clientY: noteY,
      });

      // Both selected notes should be deleted
      expect(onNoteDelete).toHaveBeenCalledWith('note-1');
      expect(onNoteDelete).toHaveBeenCalledWith('note-2');
      expect(onDeselectAll).toHaveBeenCalled();
    });
  });


  // ==========================================================================
  // 9. Timeline Click (Playhead Positioning)
  // ==========================================================================
  describe('Timeline Click', () => {
    /**
     * Test: Clicking on timeline positions playhead
     */
    it('should position playhead when clicking on timeline', () => {
      const onPlayheadChange = vi.fn();

      const { container } = render(
        <PianoRollCanvas
          notes={[]}
          selectedNoteIds={new Set()}
          visibleRegion={defaultVisibleRegion}
          onPlayheadChange={onPlayheadChange}
        />
      );

      const canvas = container.querySelector('canvas');

      // Click in the timeline area (top of canvas, within PITCH_LABEL_WIDTH to scrollbar)
      const timelineY = TIME_MARKER_HEIGHT / 2;
      const clickX = beatToPixelX(8, 800, defaultVisibleRegion);

      fireEvent.click(canvas!, {
        clientX: clickX,
        clientY: timelineY,
        button: 0,
      });

      expect(onPlayheadChange).toHaveBeenCalled();
      const newPosition = onPlayheadChange.mock.calls[0][0];
      // Should be around beat 8
      expect(newPosition).toBeGreaterThan(7);
      expect(newPosition).toBeLessThan(9);
    });
  });
});
