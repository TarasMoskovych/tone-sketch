import { useState, useCallback, useEffect, useRef } from 'react';
import type { VisibleRegion } from '@/types/grid';
import type { Note } from '@/types/note';
import type { MarqueeState } from '../types';
import { CANVAS_CONFIG } from '../constants';
import { getNotesInRect } from '@/lib/selection-utils';

/**
 * Options for the useMarqueeSelection hook.
 * Requirement 9.1: Create useMarqueeSelection hook
 */
export interface UseMarqueeSelectionOptions {
  /** All notes in the piano roll */
  notes: Note[];
  /** Currently selected note IDs */
  selectedNoteIds: Set<string>;
  /** Current visible region */
  visibleRegion: VisibleRegion;
  /** Reference to the container element for coordinate calculations */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Callback to add notes to the current selection */
  onAddToSelection?: (noteIds: string[]) => void;
  /** Callback to deselect all notes */
  onDeselectAll?: () => void;
}

/**
 * Return type for the useMarqueeSelection hook.
 * Requirement 9.1: Export marquee state and handlers
 */
export interface UseMarqueeSelectionReturn {
  /** Current marquee state, or null if no marquee is active */
  marqueeState: MarqueeState | null;
  /** Start a new marquee selection at the given position */
  startMarquee: (startX: number, startY: number, isAdditive: boolean, previousSelection: Set<string>) => void;
  /** Update the marquee rectangle to the current mouse position */
  updateMarquee: (currentX: number, currentY: number) => void;
  /** End the marquee selection and finalize the selection */
  endMarquee: () => void;
  /** Cancel the marquee selection and restore the previous selection state */
  cancelMarquee: () => void;
  /** Whether a marquee selection is currently active */
  isSelecting: boolean;
}

/**
 * Custom hook for managing marquee (rectangle) selection in the piano roll.
 *
 * This hook encapsulates the marquee selection logic from the original PianoRollCanvas,
 * including:
 * - Marquee rectangle state during drag (Requirement 9.2)
 * - Intersecting notes calculation during marquee drag (Requirement 9.3)
 * - Additive selection mode with Ctrl/Cmd modifier (Requirement 9.4)
 * - Selection cancellation with Escape key and state restoration (Requirement 9.5)
 *
 * Property 6: Replace mode - selection equals intersecting notes
 * Property 7: Additive mode - selection equals union of previous and intersecting
 * Property 8: Marquee Cancel Restores State
 *
 * @param options - Configuration options for the hook
 * @returns Object with marquee state and handler functions
 *
 * @example
 * const {
 *   marqueeState,
 *   startMarquee,
 *   updateMarquee,
 *   endMarquee,
 *   cancelMarquee,
 *   isSelecting
 * } = useMarqueeSelection({
 *   notes,
 *   selectedNoteIds,
 *   visibleRegion,
 *   containerRef,
 *   onAddToSelection,
 *   onDeselectAll
 * });
 */
export function useMarqueeSelection(options: UseMarqueeSelectionOptions): UseMarqueeSelectionReturn {
  const {
    notes,
    visibleRegion,
    containerRef,
    onAddToSelection,
    onDeselectAll,
  } = options;

  // State for tracking marquee selection
  // Requirement 9.2: Manage the marquee rectangle state during drag
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);

  // Track the last calculated intersecting IDs for use in endMarquee
  const lastIntersectingIdsRef = useRef<string[]>([]);

  /**
   * Start a new marquee selection at the given position.
   * Requirement 9.2: Initialize marquee state
   * Requirement 9.4: Support additive selection mode
   */
  const startMarquee = useCallback((
    startX: number,
    startY: number,
    isAdditive: boolean,
    previousSelection: Set<string>
  ) => {
    setMarqueeState({
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      previousSelection,
      isAdditive,
    });
    lastIntersectingIdsRef.current = [];
  }, []);

  /**
   * Calculate intersecting notes based on marquee bounds.
   * Requirement 9.3: Calculate intersecting notes during marquee drag
   */
  const calculateIntersectingNotes = useCallback((state: MarqueeState, currentX: number, currentY: number): string[] => {
    const container = containerRef.current;
    if (!container) return [];

    const rect = container.getBoundingClientRect();
    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;
    const gridWidth = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gridHeight = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;

    // Convert marquee pixel coordinates to beat/pitch coordinates
    // Clamp coordinates to grid boundaries
    const clampedStartX = Math.max(PITCH_LABEL_WIDTH, Math.min(state.startX, rect.width - SCROLLBAR_WIDTH));
    const clampedStartY = Math.max(TIME_MARKER_HEIGHT, Math.min(state.startY, rect.height - SCROLLBAR_HEIGHT));
    const clampedCurrentX = Math.max(PITCH_LABEL_WIDTH, Math.min(currentX, rect.width - SCROLLBAR_WIDTH));
    const clampedCurrentY = Math.max(TIME_MARKER_HEIGHT, Math.min(currentY, rect.height - SCROLLBAR_HEIGHT));

    const gridStartX = clampedStartX - PITCH_LABEL_WIDTH;
    const gridCurrentX = clampedCurrentX - PITCH_LABEL_WIDTH;
    const gridStartY = clampedStartY - TIME_MARKER_HEIGHT;
    const gridCurrentY = clampedCurrentY - TIME_MARKER_HEIGHT;

    // Convert to beats
    const startBeat = visibleRegion.startBeat + (Math.min(gridStartX, gridCurrentX) / gridWidth) * visibleBeats;
    const endBeat = visibleRegion.startBeat + (Math.max(gridStartX, gridCurrentX) / gridWidth) * visibleBeats;

    // Convert to pitch (Y is inverted - higher Y = lower pitch)
    const topY = Math.min(gridStartY, gridCurrentY);
    const bottomY = Math.max(gridStartY, gridCurrentY);
    const startPitch = visibleRegion.endPitch - (bottomY / gridHeight) * visibleSemitones;
    const endPitch = visibleRegion.endPitch - (topY / gridHeight) * visibleSemitones;

    // Get intersecting notes
    return getNotesInRect(notes, {
      startBeat,
      endBeat,
      startPitch,
      endPitch,
    }, visibleRegion);
  }, [containerRef, visibleRegion, notes]);

  /**
   * Update the marquee rectangle to the current mouse position.
   * Requirement 9.2: Update marquee state during drag
   * Requirement 9.3: Calculate intersecting notes during drag
   * Requirement 9.4: Handle additive selection mode
   */
  const updateMarquee = useCallback((currentX: number, currentY: number) => {
    if (!marqueeState) return;

    // Update marquee state with current position
    setMarqueeState(prev => prev ? { ...prev, currentX, currentY } : null);

    // Calculate intersecting notes
    const intersectingIds = calculateIntersectingNotes(marqueeState, currentX, currentY);
    lastIntersectingIdsRef.current = intersectingIds;

    // Update selection preview based on additive mode
    // Property 6: Replace mode - selection equals intersecting notes
    // Property 7: Additive mode - selection equals union of previous and intersecting
    if (marqueeState.isAdditive) {
      // Additive mode: union of previous selection and intersecting notes
      if (onAddToSelection) {
        // Call with note IDs that should be added (not already in previous selection)
        const idsToAdd = intersectingIds.filter(id => !marqueeState.previousSelection.has(id));
        if (idsToAdd.length > 0) {
          onAddToSelection(idsToAdd);
        }
      }
    } else {
      // Replace mode: selection equals intersecting notes only
      if (intersectingIds.length > 0 && onAddToSelection && onDeselectAll) {
        // First deselect all, then add intersecting notes
        onDeselectAll();
        onAddToSelection(intersectingIds);
      } else if (intersectingIds.length === 0 && onDeselectAll) {
        onDeselectAll();
      }
    }
  }, [marqueeState, calculateIntersectingNotes, onAddToSelection, onDeselectAll]);

  /**
   * End the marquee selection and finalize the selection.
   * Uses the last calculated intersecting notes to finalize selection.
   */
  const endMarquee = useCallback(() => {
    if (!marqueeState) return;

    const container = containerRef.current;
    if (!container) {
      setMarqueeState(null);
      return;
    }

    // Check if user actually dragged (not just a click)
    // A simple click should create a note, not be treated as a zero-size marquee
    const MIN_MARQUEE_DISTANCE = 5; // pixels
    const dragDistance = Math.sqrt(
      Math.pow(marqueeState.currentX - marqueeState.startX, 2) +
      Math.pow(marqueeState.currentY - marqueeState.startY, 2)
    );
    const wasActualDrag = dragDistance >= MIN_MARQUEE_DISTANCE;

    if (wasActualDrag) {
      // Finalize selection using the last calculated intersecting notes
      const intersectingIds = calculateIntersectingNotes(marqueeState, marqueeState.currentX, marqueeState.currentY);

      // Property 6: Replace mode - selection equals intersecting notes
      // Property 7: Additive mode - selection equals union of previous and intersecting
      if (marqueeState.isAdditive) {
        // Additive mode: union of previous selection and intersecting notes
        if (onAddToSelection) {
          const idsToAdd = intersectingIds.filter(id => !marqueeState.previousSelection.has(id));
          if (idsToAdd.length > 0) {
            onAddToSelection(idsToAdd);
          }
        }
      } else {
        // Replace mode: selection equals intersecting notes only
        if (intersectingIds.length > 0 && onAddToSelection && onDeselectAll) {
          onDeselectAll();
          onAddToSelection(intersectingIds);
        } else if (intersectingIds.length === 0 && onDeselectAll) {
          onDeselectAll();
        }
      }
    }

    // Clear marquee state
    setMarqueeState(null);
    lastIntersectingIdsRef.current = [];
  }, [marqueeState, containerRef, calculateIntersectingNotes, onAddToSelection, onDeselectAll]);

  /**
   * Cancel the marquee selection and restore the previous selection state.
   * Requirement 9.5: Support selection cancellation with state restoration
   * Property 8: Marquee Cancel Restores State
   */
  const cancelMarquee = useCallback(() => {
    if (!marqueeState) return;

    // Restore the previous selection state
    if (onDeselectAll) {
      onDeselectAll();
    }
    // Re-add the previously selected notes
    if (onAddToSelection && marqueeState.previousSelection.size > 0) {
      onAddToSelection(Array.from(marqueeState.previousSelection));
    }

    // Clear marquee state
    setMarqueeState(null);
    lastIntersectingIdsRef.current = [];
  }, [marqueeState, onDeselectAll, onAddToSelection]);

  /**
   * Handle Escape key to cancel marquee selection.
   * Requirement 9.5: Implement cancellation with Escape key
   */
  useEffect(() => {
    if (!marqueeState) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelMarquee();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [marqueeState, cancelMarquee]);

  return {
    marqueeState,
    startMarquee,
    updateMarquee,
    endMarquee,
    cancelMarquee,
    isSelecting: marqueeState !== null,
  };
}
