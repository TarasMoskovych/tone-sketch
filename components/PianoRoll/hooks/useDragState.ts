import { useState, useCallback, useEffect, useRef } from 'react';
import type { Note } from '@/types/note';
import type { VisibleRegion, GridSnapConfig } from '@/types/grid';
import type { DragState, ScrollbarDragState } from '../types';
import { CANVAS_CONFIG } from '../constants';
import { calculateScrollbarState, constrainVisibleRegion } from '../coordinate-utils';

/**
 * Options for the useDragState hook
 */
export interface UseDragStateOptions {
  /** Current notes in the piano roll */
  notes: Note[];
  /** IDs of currently selected notes */
  selectedNoteIds: Set<string>;
  /** Current visible region */
  visibleRegion: VisibleRegion;
  /** Grid snap configuration */
  gridSnap: GridSnapConfig;
  /** Reference to the container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Total beats in the timeline */
  effectiveTotalBeats: number;
  /** Callback when a single note is updated */
  onNoteUpdate?: (note: Note) => void;
  /** Callback when multiple notes are updated */
  onBulkNoteUpdate?: (updates: Map<string, Partial<Note>>) => void;
  /** Callback when the visible region changes */
  onVisibleRegionChange?: (region: VisibleRegion) => void;
}

/**
 * Return type for the useDragState hook
 */
export interface UseDragStateReturn {
  // Note drag state
  /** Current note drag state, or null if not dragging */
  dragState: DragState | null;
  /** Start dragging a note (move or resize) */
  startNoteDrag: (
    note: Note,
    startX: number,
    startY: number,
    isResize: boolean,
    isGroupDrag: boolean,
    originalSelectedNotes: Map<string, Note>
  ) => void;
  /** Update the note position during drag */
  updateNoteDrag: (currentX: number, currentY: number) => void;
  /** End the note drag operation */
  endNoteDrag: () => void;
  /** Cancel the note drag and restore original positions */
  cancelNoteDrag: () => void;
  /** Whether a note drag is in progress */
  isNoteDragging: boolean;

  // Scrollbar drag state
  /** Current scrollbar drag state, or null if not dragging */
  scrollbarDragState: ScrollbarDragState | null;
  /** Start dragging a scrollbar */
  startScrollbarDrag: (scrollbar: 'horizontal' | 'vertical', startPosition: number) => void;
  /** Update the scrollbar position during drag */
  updateScrollbarDrag: (currentPosition: number) => void;
  /** End the scrollbar drag operation */
  endScrollbarDrag: () => void;
  /** Whether a scrollbar drag is in progress */
  isScrollbarDragging: boolean;

  // Combined flag
  /** Whether any drag operation is in progress */
  isDragging: boolean;

  // Ref for tracking just finished drag
  /** Ref to track if a drag operation just finished (to prevent click after drag) */
  justFinishedDragRef: React.MutableRefObject<boolean>;
}

/**
 * Custom hook for managing drag state in the piano roll.
 *
 * This hook encapsulates:
 * - Note drag operations (move and resize)
 * - Scrollbar drag operations
 * - Drag cancellation via Escape key with state restoration
 * - Group drag support (moving multiple selected notes)
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5 - Drag state management
 *
 * @param options - Configuration options for the hook
 * @returns Drag state and handlers
 */
export function useDragState(options: UseDragStateOptions): UseDragStateReturn {
  const {
    visibleRegion,
     
    gridSnap: _gridSnap,
    containerRef,
    effectiveTotalBeats,
    onNoteUpdate,
    onBulkNoteUpdate,
    onVisibleRegionChange,
  } = options;

  // Note drag state
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Scrollbar drag state
  const [scrollbarDragState, setScrollbarDragState] = useState<ScrollbarDragState | null>(null);

  // Track if we just completed a drag operation to prevent click from creating a note
  const justFinishedDragRef = useRef(false);

  // =========================================================================
  // Note Drag Operations
  // =========================================================================

  /**
   * Start dragging a note (move or resize).
   *
   * Requirements: 3.1, 3.5 - Track drag start position and original note state
   * Requirements: 4.1, 4.2, 4.3 - Track vertical drag for pitch changes
   * Requirements: 5.1 - Detect right edge for resize operations
   */
  const startNoteDrag = useCallback((
    note: Note,
    startX: number,
    startY: number,
    isResize: boolean,
    isGroupDrag: boolean,
    originalSelectedNotes: Map<string, Note>
  ) => {
    setDragState({
      note: { ...note },
      originalNote: { ...note },
      originalSelectedNotes: new Map(originalSelectedNotes),
      startX,
      startY,
      mode: isResize ? 'resize' : 'move',
      isGroupDrag,
    });
  }, []);

  /**
   * Update the note position during drag.
   * This is called externally by the main component's mouse move handler
   * since it requires access to coordinate conversion functions that
   * depend on the current visible region and container dimensions.
   */
   
  const updateNoteDrag = useCallback((_currentX: number, _currentY: number) => {
    if (!dragState) return;

    // The actual update logic is handled in the main component
    // because it requires access to pixelXToBeat, pixelYToPitch, etc.
    // This hook just manages the state.
    setDragState(prev => prev ? {
      ...prev,
      // We don't update position here - the main component handles that
    } : null);
  }, [dragState]);

  /**
   * End the note drag operation.
   *
   * Requirements: 3.1 - Finalizes the note position update
   */
  const endNoteDrag = useCallback(() => {
    if (dragState) {
      // Set flag to prevent the subsequent click event from creating a new note
      justFinishedDragRef.current = true;
      // Clear the flag after a short delay (click event fires synchronously after mouseup)
      setTimeout(() => {
        justFinishedDragRef.current = false;
      }, 0);
      setDragState(null);
    }
  }, [dragState]);

  /**
   * Cancel the note drag and restore original positions.
   *
   * Requirements: 8.4 - Escape key cancellation with state restoration
   *
   * Property 14: Group Drag Cancel Restores All Notes
   * - For group drag, restore ALL selected notes to their original positions
   */
  const cancelNoteDrag = useCallback(() => {
    if (!dragState || !onNoteUpdate) return;

    // Property 14: Group Drag Cancel Restores All Notes
    if (dragState.isGroupDrag && dragState.originalSelectedNotes.size > 0) {
      if (onBulkNoteUpdate) {
        // Use bulk update if available (more efficient)
        const updates = new Map<string, Partial<Note>>();
        for (const [noteId, originalNote] of dragState.originalSelectedNotes) {
          updates.set(noteId, {
            start: originalNote.start,
            pitch: originalNote.pitch,
            duration: originalNote.duration,
          });
        }
        onBulkNoteUpdate(updates);
      } else {
        // Fall back to individual updates
        for (const [, originalNote] of dragState.originalSelectedNotes) {
          onNoteUpdate(originalNote);
        }
      }
    } else {
      // Single note drag: restore only the primary note to its original state
      onNoteUpdate(dragState.originalNote);
    }

    setDragState(null);
  }, [dragState, onNoteUpdate, onBulkNoteUpdate]);

  // =========================================================================
  // Scrollbar Drag Operations
  // =========================================================================

  /**
   * Start dragging a scrollbar.
   *
   * Requirements: 34.3 - Initiate scrollbar drag operations
   */
  const startScrollbarDrag = useCallback((
    scrollbar: 'horizontal' | 'vertical',
    startPosition: number
  ) => {
    const { TOTAL_PITCH_RANGE } = CANVAS_CONFIG;
    const scrollbarState = calculateScrollbarState(visibleRegion, effectiveTotalBeats, TOTAL_PITCH_RANGE);

    setScrollbarDragState({
      scrollbar,
      startPosition,
      initialScrollPosition: scrollbar === 'horizontal'
        ? scrollbarState.horizontalPosition
        : scrollbarState.verticalPosition,
      initialVisibleRegion: { ...visibleRegion },
    });
  }, [visibleRegion, effectiveTotalBeats]);

  /**
   * Update the scrollbar position during drag.
   *
   * Requirements: 34.3, 34.4, 34.5 - Scrollbar drag interactions
   *
   * Property 23: Scrollbar-Visible Region Synchronization
   * - Dragging a scrollbar to position P SHALL update the visible region proportionally
   */
  const updateScrollbarDrag = useCallback((currentPosition: number) => {
    if (!scrollbarDragState) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const {
      PITCH_LABEL_WIDTH,
      TIME_MARKER_HEIGHT,
      SCROLLBAR_WIDTH,
      SCROLLBAR_HEIGHT,
      MIN_THUMB_SIZE,
      TOTAL_PITCH_RANGE,
    } = CANVAS_CONFIG;

    // Calculate the drag delta and new scroll position
    if (scrollbarDragState.scrollbar === 'horizontal') {
      const hTrackWidth = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;

      // Calculate delta from start position
      const deltaX = currentPosition - scrollbarDragState.startPosition;

      // Calculate thumb size to determine effective track width
      const scrollbarState = calculateScrollbarState(
        scrollbarDragState.initialVisibleRegion,
        effectiveTotalBeats,
        TOTAL_PITCH_RANGE
      );
      const hThumbWidth = Math.max(MIN_THUMB_SIZE, hTrackWidth * scrollbarState.horizontalThumbSize);
      const effectiveTrackWidth = hTrackWidth - hThumbWidth;

      // Calculate new position (normalized 0-1)
      const deltaPosition = effectiveTrackWidth > 0 ? deltaX / effectiveTrackWidth : 0;
      const newPosition = Math.max(0, Math.min(1, scrollbarDragState.initialScrollPosition + deltaPosition));

      // Convert position to visible region
      const { initialVisibleRegion } = scrollbarDragState;
      const visibleBeats = initialVisibleRegion.endBeat - initialVisibleRegion.startBeat;
      const maxStartBeat = effectiveTotalBeats - visibleBeats;
      const newStartBeat = newPosition * maxStartBeat;

      const newRegion = constrainVisibleRegion({
        startBeat: newStartBeat,
        endBeat: newStartBeat + visibleBeats,
        startPitch: visibleRegion.startPitch,
        endPitch: visibleRegion.endPitch,
      });

      if (onVisibleRegionChange) {
        onVisibleRegionChange(newRegion);
      }
    } else {
      // Vertical scrollbar drag
      const vTrackHeight = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

      // Calculate delta from start position
      const deltaY = currentPosition - scrollbarDragState.startPosition;

      // Calculate thumb size to determine effective track height
      const scrollbarState = calculateScrollbarState(
        scrollbarDragState.initialVisibleRegion,
        effectiveTotalBeats,
        TOTAL_PITCH_RANGE
      );
      const vThumbHeight = Math.max(MIN_THUMB_SIZE, vTrackHeight * scrollbarState.verticalThumbSize);
      const effectiveTrackHeight = vTrackHeight - vThumbHeight;

      // Calculate new position (normalized 0-1)
      const deltaPosition = effectiveTrackHeight > 0 ? deltaY / effectiveTrackHeight : 0;
      const newPosition = Math.max(0, Math.min(1, scrollbarDragState.initialScrollPosition + deltaPosition));

      // Convert position to visible region
      // Vertical is inverted: position 0 = high pitches (top), position 1 = low pitches (bottom)
      const { initialVisibleRegion } = scrollbarDragState;
      const visiblePitches = initialVisibleRegion.endPitch - initialVisibleRegion.startPitch;
      const maxStartPitch = TOTAL_PITCH_RANGE - visiblePitches;
      // Invert: newPosition 0 → startPitch at max, newPosition 1 → startPitch at 0
      const newStartPitch = (1 - newPosition) * maxStartPitch;

      const newRegion = constrainVisibleRegion({
        startBeat: visibleRegion.startBeat,
        endBeat: visibleRegion.endBeat,
        startPitch: newStartPitch,
        endPitch: newStartPitch + visiblePitches,
      });

      if (onVisibleRegionChange) {
        onVisibleRegionChange(newRegion);
      }
    }
  }, [scrollbarDragState, visibleRegion, containerRef, effectiveTotalBeats, onVisibleRegionChange]);

  /**
   * End the scrollbar drag operation.
   *
   * Requirements: 34.3 - Finalizes the scrollbar drag
   */
  const endScrollbarDrag = useCallback(() => {
    if (scrollbarDragState) {
      setScrollbarDragState(null);
    }
  }, [scrollbarDragState]);

  // =========================================================================
  // Escape Key Handler
  // =========================================================================

  /**
   * Handle Escape key to cancel drag operations.
   *
   * Requirements: 8.4, 8.5 - Escape key cancellation with state restoration
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dragState) {
          cancelNoteDrag();
        }
        // Note: scrollbar drag doesn't need cancellation since
        // the visible region is updated in real-time
        if (scrollbarDragState) {
          setScrollbarDragState(null);
        }
      }
    };

    if (dragState || scrollbarDragState) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [dragState, scrollbarDragState, cancelNoteDrag]);

  // =========================================================================
  // Return Values
  // =========================================================================

  const isNoteDragging = dragState !== null;
  const isScrollbarDragging = scrollbarDragState !== null;
  const isDragging = isNoteDragging || isScrollbarDragging;

  return {
    // Note drag state
    dragState,
    startNoteDrag,
    updateNoteDrag,
    endNoteDrag,
    cancelNoteDrag,
    isNoteDragging,

    // Scrollbar drag state
    scrollbarDragState,
    startScrollbarDrag,
    updateScrollbarDrag,
    endScrollbarDrag,
    isScrollbarDragging,

    // Combined flags
    isDragging,
    justFinishedDragRef,
  };
}
