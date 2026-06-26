import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note } from '@/types/note';
import type { VelocityDragState } from '../types';
import { pointerYToVelocity, applyVelocityDelta } from '../coordinate-utils';

/**
 * Options for the useVelocityDrag hook.
 * Requirements: 7.3 - Extracted drag interaction logic into a dedicated custom hook
 */
export interface UseVelocityDragOptions {
  notes: Note[];
  selectedNoteIds: Set<string>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onNoteUpdate?: (note: Note) => void;
  onBulkNoteUpdate?: (updates: Map<string, Partial<Note>>) => void;
}

/**
 * Return type for the useVelocityDrag hook.
 */
export interface UseVelocityDragReturn {
  dragState: VelocityDragState | null;
  startDrag: (noteId: string, pointerY: number) => void;
  updateDrag: (pointerY: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
}

/**
 * Custom hook for managing velocity bar drag interactions.
 *
 * Supports single-note and multi-note velocity editing:
 * - Single-note: direct velocity assignment from pointer position
 * - Multi-note: delta-based adjustment applied to all selected notes
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.3
 */
export function useVelocityDrag(options: UseVelocityDragOptions): UseVelocityDragReturn {
  const { notes, selectedNoteIds, containerRef, onNoteUpdate, onBulkNoteUpdate } = options;

  // Use ref for drag state to avoid stale closures in event handlers
  const dragStateRef = useRef<VelocityDragState | null>(null);
  const [dragStateSnapshot, setDragStateSnapshot] = useState<VelocityDragState | null>(null);

  // Keep a ref to latest notes/selectedNoteIds to avoid stale closures
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const selectedNoteIdsRef = useRef(selectedNoteIds);
  useEffect(() => {
    selectedNoteIdsRef.current = selectedNoteIds;
  }, [selectedNoteIds]);

  const onNoteUpdateRef = useRef(onNoteUpdate);
  useEffect(() => {
    onNoteUpdateRef.current = onNoteUpdate;
  }, [onNoteUpdate]);

  const onBulkNoteUpdateRef = useRef(onBulkNoteUpdate);
  useEffect(() => {
    onBulkNoteUpdateRef.current = onBulkNoteUpdate;
  }, [onBulkNoteUpdate]);

  /**
   * Compute the lane grid height from the container element.
   * The grid height is the full container height (no separate gridY offset in the velocity lane).
   */
  const getLaneHeight = useCallback((): number => {
    const container = containerRef.current;
    if (!container) return 0;
    return container.clientHeight;
  }, [containerRef]);

  /**
   * Start a velocity drag operation.
   *
   * Requirements: 4.1 - Begins drag on a velocity bar
   * Requirements: 5.4, 5.5 - Multi-note activates iff noteId ∈ selectedNoteIds AND |selectedNoteIds| ≥ 2
   *
   * @param noteId - ID of the note whose bar is being dragged
   * @param pointerY - Y position of the pointer relative to the grid area top
   */
  const startDrag = useCallback((noteId: string, pointerY: number) => {
    const currentNotes = notesRef.current;
    const currentSelectedIds = selectedNoteIdsRef.current;

    // Find the note being dragged
    const note = currentNotes.find(n => n.id === noteId);
    if (!note) return;

    // Determine if this is a multi-note drag:
    // noteId must be in the selection AND selection size must be >= 2
    const isMultiNote = currentSelectedIds.has(noteId) && currentSelectedIds.size >= 2;

    // Build originalVelocities map
    const originalVelocities = new Map<string, number>();

    if (isMultiNote) {
      // Store original velocities for ALL selected notes
      for (const selectedId of currentSelectedIds) {
        const selectedNote = currentNotes.find(n => n.id === selectedId);
        if (selectedNote) {
          originalVelocities.set(selectedId, selectedNote.velocity);
        }
      }
    } else {
      // Single-note: only track the dragged note
      originalVelocities.set(noteId, note.velocity);
    }

    const newDragState: VelocityDragState = {
      noteId,
      originalVelocity: note.velocity,
      originalVelocities,
      isMultiNote,
    };

    dragStateRef.current = newDragState;
    setDragStateSnapshot(newDragState);

    // Provide immediate visual feedback for the initial pointer position
    const laneHeight = getLaneHeight();
    if (laneHeight > 0) {
      const newVelocity = pointerYToVelocity(pointerY, laneHeight);

      if (isMultiNote) {
        // Compute delta and apply to all selected notes
        const delta = newVelocity - note.velocity;
        const newVelocities = applyVelocityDelta(originalVelocities, delta);

        if (onBulkNoteUpdateRef.current) {
          const updates = new Map<string, Partial<Note>>();
          for (const [id, velocity] of newVelocities) {
            updates.set(id, { velocity });
          }
          onBulkNoteUpdateRef.current(updates);
        }
      } else {
        // Single-note: set velocity directly
        if (onNoteUpdateRef.current) {
          onNoteUpdateRef.current({ ...note, velocity: newVelocity });
        }
      }
    }
  }, [getLaneHeight]);

  /**
   * Update the drag with a new pointer Y position.
   *
   * Requirements: 4.1, 4.2 - Convert pointer to velocity, clamp to [0, 1]
   * Requirements: 4.4 - Update bar height on every pointer move
   * Requirements: 5.1 - Compute delta and apply to all selected notes
   * Requirements: 5.2 - Clamp each note's velocity independently
   *
   * @param pointerY - Y position of the pointer relative to the grid area top
   */
  const updateDrag = useCallback((pointerY: number) => {
    const state = dragStateRef.current;
    if (!state) return;

    const laneHeight = getLaneHeight();
    if (laneHeight <= 0) return;

    const newVelocity = pointerYToVelocity(pointerY, laneHeight);

    if (state.isMultiNote) {
      // Multi-note: compute delta from original velocity and apply to all
      const delta = newVelocity - state.originalVelocity;
      const newVelocities = applyVelocityDelta(state.originalVelocities, delta);

      if (onBulkNoteUpdateRef.current) {
        const updates = new Map<string, Partial<Note>>();
        for (const [id, velocity] of newVelocities) {
          updates.set(id, { velocity });
        }
        onBulkNoteUpdateRef.current(updates);
      }
    } else {
      // Single-note: set velocity directly (already clamped by pointerYToVelocity)
      const note = notesRef.current.find(n => n.id === state.noteId);
      if (note && onNoteUpdateRef.current) {
        onNoteUpdateRef.current({ ...note, velocity: newVelocity });
      }
    }
  }, [getLaneHeight]);

  /**
   * End the drag operation and commit final velocity values.
   *
   * Requirements: 4.3 - Commit final velocity on mouse release
   * Requirements: 5.6 - Commit all affected notes on mouse release (multi-note)
   */
  const endDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (!state) return;

    // Final values have already been applied via updateDrag calls.
    // The commit happens via the callbacks which update the parent state.
    // We just need to clear the drag state.
    dragStateRef.current = null;
    setDragStateSnapshot(null);
  }, []);

  /**
   * Cancel the drag and restore all affected notes to their original velocities.
   *
   * Requirements: 4.5 - Escape key cancels drag and restores original velocity
   * Property 9: Drag Cancel Restores Original Velocity
   */
  const cancelDrag = useCallback(() => {
    const state = dragStateRef.current;
    if (!state) return;

    if (state.isMultiNote) {
      // Restore ALL selected notes to their original velocities
      if (onBulkNoteUpdateRef.current) {
        const updates = new Map<string, Partial<Note>>();
        for (const [id, originalVelocity] of state.originalVelocities) {
          updates.set(id, { velocity: originalVelocity });
        }
        onBulkNoteUpdateRef.current(updates);
      }
    } else {
      // Single-note: restore original velocity
      const note = notesRef.current.find(n => n.id === state.noteId);
      if (note && onNoteUpdateRef.current) {
        onNoteUpdateRef.current({ ...note, velocity: state.originalVelocity });
      }
    }

    dragStateRef.current = null;
    setDragStateSnapshot(null);
  }, []);

  // =========================================================================
  // Escape Key Handler
  // Requirements: 4.5 - Escape key cancels drag and restores original velocity
  // =========================================================================

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dragStateRef.current) {
        event.preventDefault();
        cancelDrag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelDrag]);

  return {
    dragState: dragStateSnapshot,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
  };
}
