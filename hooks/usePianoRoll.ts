'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Note } from '../types/note';
import type { GridSnapConfig, VisibleRegion, GridDivision } from '../types/grid';

/**
 * Return type for the usePianoRoll hook.
 * Provides piano roll state and handlers for note management.
 */
export interface UsePianoRollReturn {
  /** Array of notes in the piano roll */
  notes: Note[];
  /** ID of the currently selected note, or null if none selected (backward compatibility) */
  selectedNoteId: string | null;
  /** Set of currently selected note IDs */
  selectedNoteIds: Set<string>;
  /** The last note that was clicked (not Shift-clicked), used as anchor for range selection */
  selectionAnchor: string | null;
  /** Current visible region of the piano roll */
  visibleRegion: VisibleRegion;
  /** Grid snap configuration */
  gridSnap: GridSnapConfig;
  /** Create a new note at the specified pitch and start time */
  createNote: (pitch: number, start: number) => void;
  /** Update an existing note with partial updates */
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  /** Delete a note by ID */
  deleteNote: (noteId: string) => void;
  /** Set the visible region of the piano roll */
  setVisibleRegion: (region: VisibleRegion) => void;
  /** Set the grid snap configuration */
  setGridSnap: (config: GridSnapConfig) => void;
  /** Select a single note (clears previous selection) - backward compatible */
  selectNote: (noteId: string | null) => void;
  /** Select multiple notes at once (replaces selection) */
  selectNotes: (noteIds: string[]) => void;
  /** Add notes to current selection */
  addToSelection: (noteIds: string[]) => void;
  /** Remove a note from selection */
  deselectNote: (noteId: string) => void;
  /** Toggle a note's selection state */
  toggleNoteSelection: (noteId: string) => void;
  /** Clear all selections */
  deselectAll: () => void;
  /** Select all notes in the melody */
  selectAll: () => void;
  /** Clear all notes from the piano roll */
  clearNotes: () => void;
  /** Load an array of notes (replaces existing notes) */
  loadNotes: (notes: Note[]) => void;
  /** Set the selection anchor for Shift-click range selection */
  setSelectionAnchor: (noteId: string | null) => void;
  /** Bulk update multiple notes at once (for group movement) */
  bulkUpdateNotes: (updates: Map<string, Partial<Note>>) => void;
}

// Default values as specified in the design document
const DEFAULT_NOTE_DURATION = 1; // 1 beat
const DEFAULT_NOTE_VELOCITY = 0.8;
const DEFAULT_GRID_DIVISION: GridDivision = 0.25; // 1/4 beat
const DEFAULT_VISIBLE_BEATS = 16; // horizontal
const DEFAULT_VISIBLE_SEMITONES = 24; // vertical (2 octaves)
const DEFAULT_START_PITCH = 48; // C3 - a reasonable starting pitch for visibility

/**
 * Default grid snap configuration.
 * Grid snap is enabled by default with 1/4 beat division.
 */
const DEFAULT_GRID_SNAP: GridSnapConfig = {
  enabled: true,
  division: DEFAULT_GRID_DIVISION,
};

/**
 * Default visible region.
 * Shows 16 beats horizontally and 24 semitones (2 octaves) vertically.
 */
const DEFAULT_VISIBLE_REGION: VisibleRegion = {
  startBeat: 0,
  endBeat: DEFAULT_VISIBLE_BEATS,
  startPitch: DEFAULT_START_PITCH,
  endPitch: DEFAULT_START_PITCH + DEFAULT_VISIBLE_SEMITONES,
};

// Free positioning resolution when grid snap is disabled (1/32 beat)
const FREE_POSITIONING_RESOLUTION = 0.03125;

// Minimum duration when grid snap is disabled (Requirement 5.4)
const MIN_DURATION_FREE = 0.1;

/**
 * Snaps a value to the nearest grid division.
 * Implements Property 3: Grid Snap Quantization formula: round(P / D) * D
 *
 * @param value - The value to snap
 * @param division - The grid division to snap to
 * @returns The snapped value
 */
export function snapToGrid(value: number, division: GridDivision): number {
  return Math.round(value / division) * division;
}

/**
 * Quantizes a position to 1/32 beat resolution for free positioning mode.
 * Per Requirement 7.5: When grid snap is disabled, positions are quantized to 1/32 beat.
 *
 * @param value - The value to quantize
 * @returns The quantized value
 */
export function quantizeToFreeResolution(value: number): number {
  return Math.round(value / FREE_POSITIONING_RESOLUTION) * FREE_POSITIONING_RESOLUTION;
}

/**
 * Applies position snapping based on the current grid snap configuration.
 * When enabled, snaps to grid division. When disabled, quantizes to 1/32 beat.
 *
 * @param value - The value to snap
 * @param gridSnap - The current grid snap configuration
 * @returns The snapped/quantized value
 */
export function snapPosition(value: number, gridSnap: GridSnapConfig): number {
  return gridSnap.enabled
    ? snapToGrid(value, gridSnap.division)
    : quantizeToFreeResolution(value);
}

/**
 * Gets the minimum duration based on grid snap configuration.
 * Per Requirement 5.3: When grid snap is enabled, minimum duration is the grid division.
 * Per Requirement 5.4: When grid snap is disabled, minimum duration is 0.1 beats.
 *
 * @param gridSnap - The current grid snap configuration
 * @returns The minimum allowed duration
 */
export function getMinimumDuration(gridSnap: GridSnapConfig): number {
  return gridSnap.enabled ? gridSnap.division : MIN_DURATION_FREE;
}

/**
 * Enforces minimum duration constraint on a duration value.
 *
 * @param duration - The duration to validate
 * @param gridSnap - The current grid snap configuration
 * @returns The duration clamped to the minimum
 */
export function enforceMinimumDuration(duration: number, gridSnap: GridSnapConfig): number {
  const minDuration = getMinimumDuration(gridSnap);
  return Math.max(minDuration, duration);
}

/**
 * Custom hook for managing piano roll state.
 * Handles notes, selection, visible region, and grid snap configuration.
 *
 * @returns Piano roll state and handler functions
 */
export function usePianoRoll(): UsePianoRollReturn {
  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);

  // Selection state - using Set<string> for multi-note selection (Requirement 7.1)
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

  // Selection anchor state - tracks last non-Shift clicked note for range selection (Requirements 1.5, 1.6)
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);

  // Visible region state
  const [visibleRegion, setVisibleRegionState] = useState<VisibleRegion>(DEFAULT_VISIBLE_REGION);

  // Grid snap configuration state
  const [gridSnap, setGridSnapState] = useState<GridSnapConfig>(DEFAULT_GRID_SNAP);

  // Backward compatibility: derive selectedNoteId from selectedNoteIds
  // Returns the first selected note ID or null if none selected
  const selectedNoteId = selectedNoteIds.size > 0 ? Array.from(selectedNoteIds)[0] : null;

  /**
   * Creates a new note at the specified pitch and start time.
   * Applies grid snapping if enabled, otherwise applies 1/32 beat resolution.
   * Uses default duration (1 beat) and velocity (0.8).
   *
   * Validates: Requirements 2.1, 2.2, 2.3, 7.5
   */
  const createNote = useCallback(
    (pitch: number, start: number) => {
      // Apply grid snapping to start time if enabled, otherwise apply free positioning resolution
      const snappedStart = gridSnap.enabled
        ? snapToGrid(start, gridSnap.division)
        : quantizeToFreeResolution(start);

      const newNote: Note = {
        id: uuidv4(),
        pitch: Math.max(0, Math.min(127, Math.round(pitch))), // Clamp to valid MIDI range
        start: Math.max(0, snappedStart), // Ensure non-negative start time
        duration: DEFAULT_NOTE_DURATION,
        velocity: DEFAULT_NOTE_VELOCITY,
      };

      setNotes((prevNotes) => [...prevNotes, newNote]);
      // Select the newly created note (clears previous selection)
      setSelectedNoteIds(new Set([newNote.id]));
    },
    [gridSnap]
  );

  /**
   * Updates an existing note with partial updates.
   * Validates and clamps values to valid ranges.
   */
  const updateNote = useCallback((noteId: string, updates: Partial<Note>) => {
    setNotes((prevNotes) =>
      prevNotes.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        // Apply updates with validation
        const updatedNote = { ...note };

        if (updates.pitch !== undefined) {
          // Clamp pitch to valid MIDI range (0-127)
          updatedNote.pitch = Math.max(0, Math.min(127, Math.round(updates.pitch)));
        }

        if (updates.start !== undefined) {
          // Ensure non-negative start time, clamp to max 10000
          updatedNote.start = Math.max(0, Math.min(10000, updates.start));
        }

        if (updates.duration !== undefined) {
          // Ensure duration is within valid range (0.001-1000)
          updatedNote.duration = Math.max(0.001, Math.min(1000, updates.duration));
        }

        if (updates.velocity !== undefined) {
          // Clamp velocity to valid range (0-1)
          updatedNote.velocity = Math.max(0, Math.min(1, updates.velocity));
        }

        return updatedNote;
      })
    );
  }, []);

  /**
   * Deletes a note by ID.
   * Removes the deleted note's ID from the selection if present.
   * Validates: Property 19 - Note Deletion Cleans Selection (Requirement 7.2)
   */
  const deleteNote = useCallback((noteId: string) => {
    setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteId));

    // Remove deleted note from selection if present (Property 19)
    setSelectedNoteIds((prevSelected) => {
      if (prevSelected.has(noteId)) {
        const newSelected = new Set(prevSelected);
        newSelected.delete(noteId);
        return newSelected;
      }
      return prevSelected;
    });
  }, []);

  /**
   * Sets the visible region of the piano roll.
   */
  const setVisibleRegion = useCallback((region: VisibleRegion) => {
    setVisibleRegionState({
      startBeat: Math.max(0, region.startBeat),
      endBeat: Math.max(region.startBeat + 1, region.endBeat), // Ensure at least 1 beat visible
      startPitch: Math.max(0, Math.min(127, region.startPitch)),
      endPitch: Math.max(0, Math.min(127, region.endPitch)),
    });
  }, []);

  /**
   * Sets the grid snap configuration.
   */
  const setGridSnap = useCallback((config: GridSnapConfig) => {
    setGridSnapState(config);
  }, []);

  /**
   * Selects a single note (clears previous selection) - backward compatible.
   * If null is passed, clears the selection entirely.
   * Validates: Requirement 1.1 - Click clears and selects single note
   */
  const selectNote = useCallback((noteId: string | null) => {
    if (noteId === null) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set([noteId]));
    }
  }, []);

  /**
   * Select multiple notes at once (replaces current selection).
   * Validates: Requirement 7.4
   */
  const selectNotes = useCallback((noteIds: string[]) => {
    setSelectedNoteIds(new Set(noteIds));
  }, []);

  /**
   * Add notes to current selection.
   * Validates: Requirement 7.4
   */
  const addToSelection = useCallback((noteIds: string[]) => {
    setSelectedNoteIds((prevSelected) => {
      const newSelected = new Set(prevSelected);
      noteIds.forEach((id) => newSelected.add(id));
      return newSelected;
    });
  }, []);

  /**
   * Remove a note from selection.
   * Validates: Requirement 7.4
   */
  const deselectNote = useCallback((noteId: string) => {
    setSelectedNoteIds((prevSelected) => {
      if (prevSelected.has(noteId)) {
        const newSelected = new Set(prevSelected);
        newSelected.delete(noteId);
        return newSelected;
      }
      return prevSelected;
    });
  }, []);

  /**
   * Toggle a note's selection state.
   * If the note is selected, it will be deselected. If unselected, it will be added to selection.
   * Validates: Requirement 1.3, 1.4 - Ctrl/Cmd click toggles selection
   */
  const toggleNoteSelection = useCallback((noteId: string) => {
    setSelectedNoteIds((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(noteId)) {
        newSelected.delete(noteId);
      } else {
        newSelected.add(noteId);
      }
      return newSelected;
    });
  }, []);

  /**
   * Clear all selections.
   * Validates: Requirement 1.2 - Click on empty clears selection
   */
  const deselectAll = useCallback(() => {
    setSelectedNoteIds(new Set());
  }, []);

  /**
   * Select all notes in the melody.
   * Validates: Requirement 6.1, 6.2 - Select All (Ctrl+A/Cmd+A)
   */
  const selectAll = useCallback(() => {
    setSelectedNoteIds((prevSelected) => {
      // Use notes from the current state via setNotes to avoid stale closure
      // This is a workaround - we need to access current notes
      return prevSelected;
    });
    // We need to access notes directly, so we'll use a different approach
    setNotes((currentNotes) => {
      setSelectedNoteIds(new Set(currentNotes.map((note) => note.id)));
      return currentNotes;
    });
  }, []);

  /**
   * Clears all notes from the piano roll.
   * Also clears any selection.
   * Validates: Property 20 - Bulk Operations Clear Selection (Requirement 7.3)
   */
  const clearNotes = useCallback(() => {
    setNotes([]);
    setSelectedNoteIds(new Set());
  }, []);

  /**
   * Loads an array of notes, replacing any existing notes.
   * Also clears any selection.
   * Validates: Property 20 - Bulk Operations Clear Selection (Requirement 7.3)
   */
  const loadNotes = useCallback((newNotes: Note[]) => {
    setNotes(newNotes);
    setSelectedNoteIds(new Set());
  }, []);

  /**
   * Bulk update multiple notes at once (for group movement).
   * More efficient than calling updateNote multiple times.
   * Validates: Requirements 4.1, 4.2, 4.3 - Group movement
   */
  const bulkUpdateNotes = useCallback((updates: Map<string, Partial<Note>>) => {
    setNotes((prevNotes) =>
      prevNotes.map((note) => {
        const update = updates.get(note.id);
        if (!update) {
          return note;
        }

        // Apply updates with validation
        const updatedNote = { ...note };

        if (update.pitch !== undefined) {
          // Clamp pitch to valid MIDI range (0-127)
          updatedNote.pitch = Math.max(0, Math.min(127, Math.round(update.pitch)));
        }

        if (update.start !== undefined) {
          // Ensure non-negative start time, clamp to max 10000
          updatedNote.start = Math.max(0, Math.min(10000, update.start));
        }

        if (update.duration !== undefined) {
          // Ensure duration is within valid range (0.001-1000)
          updatedNote.duration = Math.max(0.001, Math.min(1000, update.duration));
        }

        if (update.velocity !== undefined) {
          // Clamp velocity to valid range (0-1)
          updatedNote.velocity = Math.max(0, Math.min(1, update.velocity));
        }

        return updatedNote;
      })
    );
  }, []);

  return {
    notes,
    selectedNoteId,
    selectedNoteIds,
    selectionAnchor,
    visibleRegion,
    gridSnap,
    createNote,
    updateNote,
    deleteNote,
    setVisibleRegion,
    setGridSnap,
    selectNote,
    selectNotes,
    addToSelection,
    deselectNote,
    toggleNoteSelection,
    deselectAll,
    selectAll,
    clearNotes,
    loadNotes,
    setSelectionAnchor,
    bulkUpdateNotes,
  };
}
