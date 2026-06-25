'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { VisibleRegion, GridSnapConfig, ScrollbarState } from '@/types/grid';
import type { Note } from '@/types/note';
import { snapPosition, getMinimumDuration } from '@/utils/grid-snap';
import { midiToNoteName, isBlackKey } from '@/lib/note-utils';
import { useKeyboardShortcuts } from '@/hooks';
import { isPlatformModifierKey, getNoteRange, getNotesInRect, calculateGroupMoveConstraints } from '@/lib/selection-utils';

/**
 * Configuration constants for the piano roll canvas
 */
export const CANVAS_CONFIG = {
  /** Width of the pitch label area on the left */
  PITCH_LABEL_WIDTH: 50,
  /** Height of the time marker area on top */
  TIME_MARKER_HEIGHT: 24,
  /** Width of the vertical scrollbar on the right */
  SCROLLBAR_WIDTH: 14,
  /** Height of the horizontal scrollbar at the bottom */
  SCROLLBAR_HEIGHT: 14,
  /** Minimum thumb size in pixels to ensure clickability */
  MIN_THUMB_SIZE: 30,
  /** Scrollbar track background color */
  SCROLLBAR_TRACK_COLOR: '#252540',
  /** Scrollbar thumb color */
  SCROLLBAR_THUMB_COLOR: '#6366f1',
  /** Scrollbar thumb hover color */
  SCROLLBAR_THUMB_HOVER_COLOR: '#818cf8',
  /** Total horizontal range in beats (max timeline length) */
  TOTAL_BEATS: 64,
  /** Total vertical range (MIDI 0-127) */
  TOTAL_PITCH_RANGE: 128,
  /** Default visible region: 16 beats horizontally */
  DEFAULT_VISIBLE_BEATS: 16,
  /** Default visible region: 24 semitones (2 octaves) vertically */
  DEFAULT_VISIBLE_SEMITONES: 24,
  /** Minimum visible beats (max zoom in) */
  MIN_VISIBLE_BEATS: 4,
  /** Maximum visible beats (max zoom out) */
  MAX_VISIBLE_BEATS: 128,
  /** Minimum visible semitones (max zoom in) */
  MIN_VISIBLE_SEMITONES: 12,
  /** Maximum visible semitones (max zoom out) */
  MAX_VISIBLE_SEMITONES: 128,
  /** Scroll speed multiplier for horizontal scrolling (beats per pixel) */
  SCROLL_SPEED_HORIZONTAL: 0.02,
  /** Scroll speed multiplier for vertical scrolling (semitones per pixel) */
  SCROLL_SPEED_VERTICAL: 0.1,
  /** Zoom factor per wheel notch */
  ZOOM_FACTOR: 0.1,
  /** Background color for the grid */
  GRID_BACKGROUND: '#1a1a2e',
  /** Color for beat lines */
  BEAT_LINE_COLOR: '#2d2d44',
  /** Color for measure lines (every 4 beats) */
  MEASURE_LINE_COLOR: '#3d3d5c',
  /** Color for pitch rows */
  PITCH_ROW_COLOR: '#252540',
  /** Color for black keys (sharps/flats) */
  BLACK_KEY_COLOR: '#1e1e32',
  /** Color for pitch labels */
  PITCH_LABEL_COLOR: '#8888aa',
  /** Color for time markers */
  TIME_MARKER_COLOR: '#8888aa',
  /** Color for octave boundary lines (C notes) */
  OCTAVE_LINE_COLOR: '#4a4a6a',
  /** Color for notes */
  NOTE_COLOR: '#6366f1',
  /** Color for selected notes */
  NOTE_SELECTED_COLOR: '#818cf8',
  /** Color for note border */
  NOTE_BORDER_COLOR: '#4f46e5',
  /** Color for selected note border */
  NOTE_SELECTED_BORDER_COLOR: '#a5b4fc',
  /** Color for the playhead line - bright red for high contrast visibility */
  PLAYHEAD_COLOR: '#FF0000',
  /** Width of the playhead line in pixels */
  PLAYHEAD_WIDTH: 2,
  /** Color for notes currently being played */
  NOTE_PLAYING_COLOR: '#818cf8',
  /** Color for playing note border */
  NOTE_PLAYING_BORDER_COLOR: '#6366f1',
  /** Color for highlighted pitch rows (keyboard piano and playing notes) */
  HIGHLIGHTED_PITCH_COLOR: 'rgba(99, 102, 241, 0.3)',
};

/**
 * Default grid snap configuration
 */
const DEFAULT_GRID_SNAP_CONFIG: GridSnapConfig = {
  enabled: true,
  division: 0.25, // 1/4 beat default
};

/**
 * Modifier key state for selection operations
 * Used to track Ctrl/Cmd and Shift key states during note selection
 * Requirements: 1.3, 1.4, 1.5 - Modifier keys for selection behavior
 */
export interface SelectionModifiers {
  /** True if Ctrl (Windows/Linux) or Cmd (macOS) is pressed */
  ctrlOrCmd: boolean;
  /** True if Shift key is pressed */
  shift: boolean;
}

/**
 * Props for the PianoRollCanvas component
 */
export interface PianoRollCanvasProps {
  /** Notes to render on the canvas */
  notes?: Note[];
  /** IDs of currently selected notes */
  selectedNoteIds?: Set<string>;
  /** Current visible region of the canvas */
  visibleRegion?: VisibleRegion;
  /** Current playhead position in beats (undefined = no playhead displayed) */
  playheadPosition?: number;
  /** Grid snap configuration for note placement */
  gridSnap?: GridSnapConfig;
  /**
   * Total timeline length in beats. If not provided, automatically extends
   * to fit all notes with padding (minimum 64 beats, or notes + 16 beats padding).
   */
  totalBeats?: number;
  /** Callback when a new note is created via click */
  onNoteCreate?: (note: Note) => void;
  /** Callback when a note is updated (e.g., via drag)
   * Requirements: 3.1, 3.2, 3.3 - Horizontal drag updates note start time
   */
  onNoteUpdate?: (note: Note) => void;
  /**
   * Callback when a note is deleted (via Delete/Backspace key or right-click)
   * Requirements: 6.1, 6.2, 6.3 - Note deletion
   */
  onNoteDelete?: (noteId: string) => void;
  /**
   * Callback when note selection changes (e.g., clicking on a note)
   * Requirements: 1.1, 1.3, 1.4, 1.5 - Click selection with modifier keys
   *
   * @param noteId - The ID of the clicked note, or null if clicking empty space
   * @param modifiers - The modifier key state when the click occurred
   */
  onNoteSelect?: (noteId: string | null, modifiers?: SelectionModifiers) => void;
  /**
   * Callback to toggle a note's selection state (Ctrl/Cmd + click)
   * Requirements: 1.3, 1.4 - Toggle selection with modifier key
   */
  onToggleNoteSelection?: (noteId: string) => void;
  /**
   * Callback to add notes to the current selection (for range selection)
   * Requirements: 1.5 - Shift-click range selection
   */
  onAddToSelection?: (noteIds: string[]) => void;
  /**
   * Callback to clear all note selections
   * Requirements: 1.2 - Click on empty clears selection
   */
  onDeselectAll?: () => void;
  /**
   * Callback to set the selection anchor for Shift-click range selection
   * Requirements: 1.5, 1.6 - Anchor tracking for range selection
   */
  onSetSelectionAnchor?: (noteId: string | null) => void;
  /**
   * The current selection anchor note ID (for Shift-click range selection)
   * Requirements: 1.5, 1.6 - Anchor for range selection
   */
  selectionAnchor?: string | null;
  /**
   * Callback for batch updating multiple notes at once (for group movement)
   * Requirements: 4.1, 4.2, 4.3 - Group movement updates multiple notes
   */
  onBulkNoteUpdate?: (updates: Map<string, Partial<Note>>) => void;
  /** Callback when the visible region changes */
  onVisibleRegionChange?: (region: VisibleRegion) => void;
  /**
   * Callback when the playhead position is changed by user interaction (e.g., clicking timeline)
   * Requirement 8.5: Clicking on the timeline area repositions the playhead
   *
   * Property 9: Timeline Click Positions Playhead
   * - For any click on the timeline area at time T, the playhead position SHALL be set to T
   */
  onPlayheadChange?: (position: number) => void;
  /**
   * Callback to toggle playback state (play/pause)
   * Requirements: 33.1, 33.2, 33.3 - Space bar toggles playback when canvas has focus
   *
   * Property 21: Space Bar Toggles Playback
   * - For any playback state when the Piano Roll Editor has focus and the user is not
   *   in a text input field, pressing the Space bar SHALL toggle the playback state
   */
  onTogglePlayback?: () => void;
  /**
   * Whether keyboard shortcuts are enabled
   * When true, keyboard shortcuts (Space for playback, Delete/Backspace for deletion) are active
   * Defaults to true
   */
  keyboardShortcutsEnabled?: boolean;
  /**
   * Callback to select all notes (Ctrl+A/Cmd+A)
   * Requirements: 6.1 - Select All selects all notes in the melody
   *
   * Property 18: Select All Selects Entire Melody
   * - For any non-empty set of notes in the melody, when Select All is triggered,
   *   the resulting selection SHALL contain exactly all note IDs in the melody
   */
  onSelectAll?: () => void;
  /**
   * Currently highlighted pitch from keyboard piano (most recently pressed key)
   * Requirement 40.5: Highlight piano row background when keyboard piano key is held
   * Used for visual feedback when playing notes via computer keyboard
   */
  highlightedPitch?: number | null;
  /**
   * All currently active pitches from keyboard piano (for polyphonic support)
   * Requirement 40.5, 40.7: Support multiple simultaneous highlights for polyphony
   * When multiple keyboard piano keys are held, all corresponding rows are highlighted
   */
  activePitches?: Set<number>;
  /**
   * Whether to automatically scroll the view to follow the playhead during playback.
   * When true and playback is active, the canvas will scroll to keep the playhead visible.
   * Defaults to true.
   */
  autoScrollDuringPlayback?: boolean;
  /**
   * Whether playback is currently active. Used with autoScrollDuringPlayback
   * to determine when to auto-scroll.
   */
  isPlaying?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Width of the resize handle zone at the right edge of a note (in pixels)
 */
const RESIZE_HANDLE_WIDTH = 8;

/**
 * State for tracking note dragging (horizontal and vertical) and resize
 * Requirements: 3.1, 3.3, 3.5 (horizontal), 4.1, 4.2, 4.3, 4.4 (vertical), 5.1, 5.2, 5.3, 5.4, 5.5 (resize)
 */
interface DragState {
  /** The note currently being dragged/resized */
  note: Note;
  /** Original note state before drag started (for cancel/restore) */
  originalNote: Note;
  /** Original states of ALL selected notes before drag started (for group move) - Requirements: 4.1 */
  originalSelectedNotes: Map<string, Note>;
  /** Starting X position of the drag in pixels */
  startX: number;
  /** Starting Y position of the drag in pixels */
  startY: number;
  /** Mode of the drag operation: 'move' for position changes, 'resize' for duration changes */
  mode: 'move' | 'resize';
  /** Whether this is a group operation (multiple notes selected) - Requirements: 4.1 */
  isGroupDrag: boolean;
}

/**
 * State for tracking scrollbar drag operations
 * Requirements: 34.3, 34.4, 34.5 - Scrollbar drag interactions
 */
interface ScrollbarDragState {
  /** Which scrollbar is being dragged */
  scrollbar: 'horizontal' | 'vertical';
  /** Starting mouse position when drag began (X for horizontal, Y for vertical) */
  startPosition: number;
  /** Initial scroll position (0-1 normalized) when drag began */
  initialScrollPosition: number;
  /** Initial visible region when drag began */
  initialVisibleRegion: VisibleRegion;
}

/**
 * State for tracking marquee (rectangle) selection operations
 * Requirements: 2.1 - Click and drag on empty area displays selection rectangle
 */
interface MarqueeState {
  /** Starting X position of the marquee in pixels */
  startX: number;
  /** Starting Y position of the marquee in pixels */
  startY: number;
  /** Current X position of the marquee in pixels */
  currentX: number;
  /** Current Y position of the marquee in pixels */
  currentY: number;
  /** Note IDs that were selected before the marquee started (for additive mode) */
  previousSelection: Set<string>;
  /** Whether modifier key was held (for additive selection) */
  isAdditive: boolean;
}

/**
 * Checks if a MIDI note is a C (octave boundary)
 * @param midiNote MIDI note number (0-127)
 * @returns true if the note is C
 */
function isOctaveBoundary(midiNote: number): boolean {
  return midiNote % 12 === 0;
}

/**
 * Calculates the scrollbar state from the visible region
 * Property 23: Scrollbar-Visible Region Synchronization
 * - Scrollbar position = (visibleRegion.start - minRange) / (maxRange - minRange)
 * - Thumb size = (visibleRegion.end - visibleRegion.start) / (maxRange - minRange)
 *
 * @param visibleRegion Current visible region
 * @param totalBeats Total horizontal range (timeline length)
 * @param totalPitchRange Total vertical range (128 for MIDI 0-127)
 * @returns ScrollbarState with normalized positions and thumb sizes
 */
export function calculateScrollbarState(
  visibleRegion: VisibleRegion,
  totalBeats: number,
  totalPitchRange: number
): ScrollbarState {
  // Calculate horizontal scrollbar state
  const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
  const horizontalThumbSize = Math.min(1, visibleBeats / totalBeats);
  // Position is normalized: 0 = start, 1 = end (accounting for thumb size)
  const horizontalRange = totalBeats - visibleBeats;
  const horizontalPosition = horizontalRange > 0
    ? visibleRegion.startBeat / horizontalRange
    : 0;

  // Calculate vertical scrollbar state
  const visiblePitches = visibleRegion.endPitch - visibleRegion.startPitch;
  const verticalThumbSize = Math.min(1, visiblePitches / totalPitchRange);
  // For vertical: higher pitch = higher position (inverted from screen coordinates)
  const verticalRange = totalPitchRange - visiblePitches;
  // Invert: when startPitch is 0 (bottom), position should be 1 (scrollbar at bottom)
  const verticalPosition = verticalRange > 0
    ? 1 - (visibleRegion.startPitch / verticalRange)
    : 0;

  return {
    horizontalPosition: Math.max(0, Math.min(1, horizontalPosition)),
    verticalPosition: Math.max(0, Math.min(1, verticalPosition)),
    horizontalThumbSize,
    verticalThumbSize,
  };
}

/**
 * Default visible region: 16 beats × 24 semitones centered around middle C
 */
const DEFAULT_VISIBLE_REGION: VisibleRegion = {
  startBeat: 0,
  endBeat: CANVAS_CONFIG.DEFAULT_VISIBLE_BEATS,
  startPitch: 48, // C3
  endPitch: 48 + CANVAS_CONFIG.DEFAULT_VISIBLE_SEMITONES, // C5
};

/**
 * PianoRollCanvas component
 *
 * Renders a piano roll grid using HTML5 Canvas with:
 * - Device pixel ratio handling for crisp rendering
 * - Grid with beat lines and pitch rows
 * - Pitch labels (C0-C10) on vertical axis
 * - Time markers on horizontal axis
 * - Note rendering as rectangular blocks
 * - Visible region management
 *
 * Satisfies Requirements: 1.1, 1.2, 1.3, 1.4, 1.7
 */
export function PianoRollCanvas({
  notes = [],
  selectedNoteIds = new Set(),
  visibleRegion: controlledVisibleRegion,
  playheadPosition,
  gridSnap = DEFAULT_GRID_SNAP_CONFIG,
  totalBeats: totalBeatsProp,
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete,
  onNoteSelect,
  onToggleNoteSelection,
  onAddToSelection,
  onDeselectAll,
  onSetSelectionAnchor,
  selectionAnchor,
  onBulkNoteUpdate,
  onVisibleRegionChange,
  onPlayheadChange,
  onTogglePlayback,
  keyboardShortcutsEnabled = true,
  onSelectAll,
  // highlightedPitch is kept for API compatibility but activePitches is preferred
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  highlightedPitch,
  activePitches = new Set(),
  autoScrollDuringPlayback = true,
  isPlaying = false,
  className = '',
}: PianoRollCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Calculate effective total beats: use prop if provided, otherwise calculate from notes
  // This ensures the canvas extends to fit all notes with padding
  const effectiveTotalBeats = useMemo(() => {
    if (totalBeatsProp !== undefined) {
      return totalBeatsProp;
    }
    // Find the end of the last note
    if (notes.length === 0) {
      return CANVAS_CONFIG.TOTAL_BEATS; // Default 64 beats for empty canvas
    }
    const maxNoteEnd = Math.max(...notes.map(note => note.start + note.duration));
    // Add 16 beats padding after the last note, minimum 64 beats total
    return Math.max(CANVAS_CONFIG.TOTAL_BEATS, Math.ceil(maxNoteEnd / 16) * 16 + 16);
  }, [totalBeatsProp, notes]);

  // Calculate which pitches are currently playing (for FL Studio style row highlighting)
  const playingPitches = useMemo(() => {
    const pitches = new Set<number>();
    if (!isPlaying || playheadPosition === undefined) {
      return pitches;
    }
    for (const note of notes) {
      if (playheadPosition >= note.start && playheadPosition < note.start + note.duration) {
        pitches.add(note.pitch);
      }
    }
    return pitches;
  }, [notes, isPlaying, playheadPosition]);

  // Internal visible region state (used when not controlled)
  const [internalVisibleRegion, setInternalVisibleRegion] = useState<VisibleRegion>(DEFAULT_VISIBLE_REGION);

  // State for tracking horizontal drag operations
  // Requirements: 3.1, 3.5 - Track drag state for position updates and cancel/restore
  // Requirements: 5.1, 5.5 - Track resize operations
  const [dragState, setDragState] = useState<DragState | null>(null);

  // State for tracking scrollbar drag operations
  // Requirements: 34.3, 34.4, 34.5 - Track scrollbar drag for scroll position updates
  const [scrollbarDragState, setScrollbarDragState] = useState<ScrollbarDragState | null>(null);

  // State for tracking marquee (rectangle) selection operations
  // Requirements: 2.1 - Track marquee selection for multi-note selection
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);

  // State for tracking if mouse is over a resize handle
  // Requirements: 5.1 - Show resize cursor when hovering over right edge
  const [isOverResizeHandle, setIsOverResizeHandle] = useState(false);

  // State for tracking if mouse is over the timeline area
  // Requirement 8.5 - Show pointer cursor when hovering over timeline
  const [isOverTimeline, setIsOverTimeline] = useState(false);

  // State for tracking if mouse is over a scrollbar thumb
  // Requirements: 34.3 - Show grab cursor when hovering over scrollbar thumb
  const [isOverScrollbar, setIsOverScrollbar] = useState<'horizontal' | 'vertical' | null>(null);

  // Use controlled or internal visible region
  const visibleRegion = controlledVisibleRegion ?? internalVisibleRegion;

  /**
   * Handler for deleting selected notes via keyboard shortcut
   * Requirements: 5.1, 5.4 - Delete/Backspace key removes all selected notes
   *
   * Property 7: Note Deletion Removes from Melody
   * - For any Note in a Melody, when the Note is deleted (via Delete/Backspace key),
   *   the Note SHALL no longer exist in the Melody's notes array
   *
   * Property 15: Group Deletion Removes All Selected Notes
   * - All selected notes SHALL be removed, unselected notes SHALL remain
   *
   * Property 17: Selection Cleared After Deletion
   * - Selection SHALL be empty after deletion (handled by deleteNote removing
   *   each deleted note's ID from selectedNoteIds)
   */
  const handleDeleteNoteShortcut = useCallback(() => {
    if (!onNoteDelete) return;

    // Delete all selected notes (Property 15)
    // Selection is automatically cleared as each note is deleted (Property 17)
    for (const noteId of selectedNoteIds) {
      onNoteDelete(noteId);
    }
  }, [onNoteDelete, selectedNoteIds]);

  /**
   * Handler for toggling playback via keyboard shortcut
   * Requirements: 33.1, 33.2, 33.3 - Space bar toggles playback
   *
   * Property 21: Space Bar Toggles Playback
   * - For any playback state when the Piano Roll Editor has focus and the user is not
   *   in a text input field, pressing the Space bar SHALL toggle the playback state
   */
  const handleTogglePlaybackShortcut = useCallback(() => {
    if (onTogglePlayback) {
      onTogglePlayback();
    }
  }, [onTogglePlayback]);

  /**
   * Integrate keyboard shortcuts hook for Space bar (playback toggle) and Delete/Backspace
   * Requirements: 33.1, 33.2, 33.3, 33.4, 33.5 - Keyboard shortcuts for piano roll
   *
   * The hook:
   * - Handles Space bar to toggle playback when canvas has focus
   * - Handles Delete/Backspace to delete selected notes
   * - Handles Ctrl+A/Cmd+A to select all notes
   * - Prevents default browser behavior (scroll on Space, back navigation on Backspace)
   * - Ignores shortcuts when user is typing in text input fields
   * - Only responds when the container element has focus
   */
  useKeyboardShortcuts({
    enabled: keyboardShortcutsEnabled,
    onTogglePlayback: handleTogglePlaybackShortcut,
    onDeleteNote: handleDeleteNoteShortcut,
    onSelectAll,
    containerRef,
  });

  /**
   * Updates the visible region, calling the callback if provided.
   * Used by scroll and zoom controls.
   */
  const updateVisibleRegion = useCallback((newRegion: VisibleRegion) => {
    if (onVisibleRegionChange) {
      onVisibleRegionChange(newRegion);
    } else {
      setInternalVisibleRegion(newRegion);
    }
  }, [onVisibleRegionChange]);

  /**
   * Track if we just completed a drag operation to prevent click from creating a note
   * This is needed because mouseup clears dragState before click fires
   */
  const justFinishedDragRef = useRef(false);

  /**
   * Track previous playhead position to detect loops (when playhead jumps backward)
   */
  const prevPlayheadPositionRef = useRef<number | undefined>(undefined);

  /**
   * Auto-scroll effect: When playback is active and playhead moves near the right edge
   * of the visible region, scroll to keep the playhead in view.
   *
   * Also handles loop detection: when the playhead jumps backward significantly
   * (indicating a loop), scroll back to show the playhead at the beginning.
   *
   * The scroll triggers when playhead reaches 80% of the visible width, and scrolls
   * to place the playhead at 20% from the left edge.
   */
  useEffect(() => {
    if (!autoScrollDuringPlayback || !isPlaying || playheadPosition === undefined) {
      prevPlayheadPositionRef.current = playheadPosition;
      return;
    }

    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const prevPosition = prevPlayheadPositionRef.current;

    // Detect loop: playhead jumped backward by more than 1 beat (not just normal jitter)
    // This indicates the melody looped back to the beginning
    const didLoop = prevPosition !== undefined &&
                    prevPosition > playheadPosition &&
                    (prevPosition - playheadPosition) > 1;

    if (didLoop) {
      // Scroll back to show the playhead near the beginning
      const newStartBeat = Math.max(0, playheadPosition - visibleBeats * 0.1);
      const newEndBeat = newStartBeat + visibleBeats;

      const newRegion: VisibleRegion = {
        startBeat: newStartBeat,
        endBeat: newEndBeat,
        startPitch: visibleRegion.startPitch,
        endPitch: visibleRegion.endPitch,
      };

      if (onVisibleRegionChange) {
        onVisibleRegionChange(newRegion);
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional scroll sync during playback
        setInternalVisibleRegion(newRegion);
      }
    } else {
      // Normal forward scroll when playhead reaches 80% threshold
      const scrollThreshold = visibleRegion.startBeat + visibleBeats * 0.8;

      if (playheadPosition >= scrollThreshold) {
        // Position the playhead at 20% from the left edge
        const newStartBeat = Math.max(0, playheadPosition - visibleBeats * 0.2);
        const newEndBeat = newStartBeat + visibleBeats;

        // Only update if we actually need to scroll
        if (Math.abs(newStartBeat - visibleRegion.startBeat) > 0.1) {
          const newRegion: VisibleRegion = {
            startBeat: newStartBeat,
            endBeat: newEndBeat,
            startPitch: visibleRegion.startPitch,
            endPitch: visibleRegion.endPitch,
          };

          if (onVisibleRegionChange) {
            onVisibleRegionChange(newRegion);
          } else {
            setInternalVisibleRegion(newRegion);
          }
        }
      }
    }

    // Update previous position for next comparison
    prevPlayheadPositionRef.current = playheadPosition;
  }, [autoScrollDuringPlayback, isPlaying, playheadPosition, visibleRegion, onVisibleRegionChange]);

  /**
   * Constrains a visible region to valid bounds.
   * - Beats must start at 0 or higher (no negative time)
   * - Pitches must be between 0 and 127 (valid MIDI range)
   * - Maintains the current zoom level (span) as much as possible
   *
   * Requirements: 1.6 - Navigate visible region across full pitch range (0-127) and time range
   */
  const constrainVisibleRegion = useCallback((region: VisibleRegion): VisibleRegion => {
    const beatSpan = region.endBeat - region.startBeat;
    const pitchSpan = region.endPitch - region.startPitch;

    let startBeat = region.startBeat;
    let endBeat = region.endBeat;
    let startPitch = region.startPitch;
    let endPitch = region.endPitch;

    // Constrain horizontal bounds (beats >= 0)
    if (startBeat < 0) {
      startBeat = 0;
      endBeat = beatSpan;
    }

    // Constrain vertical bounds (pitches 0-127)
    if (startPitch < 0) {
      startPitch = 0;
      endPitch = Math.min(pitchSpan, 128);
    }
    if (endPitch > 128) {
      endPitch = 128;
      startPitch = Math.max(0, 128 - pitchSpan);
    }

    return { startBeat, endBeat, startPitch, endPitch };
  }, []);

  /**
   * Handles scroll events (wheel) to pan the visible region.
   * - Default scroll: horizontal pan (time axis)
   * - Shift + scroll: vertical pan (pitch axis)
   * - Ctrl/Cmd + scroll: zoom in/out
   *
   * Uses requestAnimationFrame for smooth 60fps scrolling.
   * Requirements: 1.5, 1.6, 30.1, 30.2
   */
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();

    const {
      SCROLL_SPEED_HORIZONTAL,
      SCROLL_SPEED_VERTICAL,
      ZOOM_FACTOR,
      MIN_VISIBLE_BEATS,
      MAX_VISIBLE_BEATS,
      MIN_VISIBLE_SEMITONES,
      MAX_VISIBLE_SEMITONES,
    } = CANVAS_CONFIG;

    // Normalize wheel delta for different input devices and browsers
    const deltaY = event.deltaY;
    const deltaX = event.deltaX;

    // Ctrl/Meta + wheel = zoom
    if (event.ctrlKey || event.metaKey) {
      const zoomDelta = deltaY * ZOOM_FACTOR;

      const currentBeatSpan = visibleRegion.endBeat - visibleRegion.startBeat;
      const currentPitchSpan = visibleRegion.endPitch - visibleRegion.startPitch;

      // Calculate new spans (zoom affects both axes proportionally)
      // Positive delta = scroll down = zoom out (increase span)
      // Negative delta = scroll up = zoom in (decrease span)
      const beatZoomFactor = 1 + (zoomDelta * 0.01);
      const pitchZoomFactor = 1 + (zoomDelta * 0.01);

      const newBeatSpan = Math.max(MIN_VISIBLE_BEATS, Math.min(MAX_VISIBLE_BEATS, currentBeatSpan * beatZoomFactor));
      // Round pitch span to whole semitones
      const newPitchSpan = Math.round(Math.max(MIN_VISIBLE_SEMITONES, Math.min(MAX_VISIBLE_SEMITONES, currentPitchSpan * pitchZoomFactor)));

      // Calculate zoom center (use mouse position relative to grid)
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left - CANVAS_CONFIG.PITCH_LABEL_WIDTH;
      const mouseY = event.clientY - rect.top - CANVAS_CONFIG.TIME_MARKER_HEIGHT;

      const gridWidth = rect.width - CANVAS_CONFIG.PITCH_LABEL_WIDTH - CANVAS_CONFIG.SCROLLBAR_WIDTH;
      const gridHeight = rect.height - CANVAS_CONFIG.TIME_MARKER_HEIGHT - CANVAS_CONFIG.SCROLLBAR_HEIGHT;

      // Calculate the position ratio (0-1) where the mouse is
      const xRatio = Math.max(0, Math.min(1, mouseX / gridWidth));
      const yRatio = Math.max(0, Math.min(1, mouseY / gridHeight));

      // Calculate the beat/pitch at mouse position before zoom
      const beatAtMouse = visibleRegion.startBeat + xRatio * currentBeatSpan;
      // Y increases downward but pitch increases upward, so invert
      const pitchAtMouse = visibleRegion.endPitch - yRatio * currentPitchSpan;

      // Calculate new start positions to keep the same beat/pitch under the mouse
      const newStartBeat = beatAtMouse - xRatio * newBeatSpan;
      const newEndBeat = newStartBeat + newBeatSpan;
      const newEndPitch = pitchAtMouse + yRatio * newPitchSpan;
      const newStartPitch = newEndPitch - newPitchSpan;

      const newRegion = constrainVisibleRegion({
        startBeat: newStartBeat,
        endBeat: newEndBeat,
        startPitch: newStartPitch,
        endPitch: newEndPitch,
      });

      updateVisibleRegion(newRegion);
      return;
    }

    // Shift + wheel = vertical scroll (pitch axis)
    if (event.shiftKey) {
      const pitchDelta = deltaY * SCROLL_SPEED_VERTICAL;

      const newRegion = constrainVisibleRegion({
        startBeat: visibleRegion.startBeat,
        endBeat: visibleRegion.endBeat,
        // Positive delta = scroll down = decrease pitch (move view down)
        startPitch: visibleRegion.startPitch - pitchDelta,
        endPitch: visibleRegion.endPitch - pitchDelta,
      });

      updateVisibleRegion(newRegion);
      return;
    }

    // Default: horizontal scroll (time axis)
    // Use deltaX for horizontal trackpad gestures, deltaY for vertical wheel
    const scrollDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    const beatDelta = scrollDelta * SCROLL_SPEED_HORIZONTAL;

    const newRegion = constrainVisibleRegion({
      startBeat: visibleRegion.startBeat + beatDelta,
      endBeat: visibleRegion.endBeat + beatDelta,
      startPitch: visibleRegion.startPitch,
      endPitch: visibleRegion.endPitch,
    });

    updateVisibleRegion(newRegion);
  }, [visibleRegion, updateVisibleRegion, constrainVisibleRegion]);

  /**
   * State for tracking pinch gesture
   */
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Calculate distance between two touch points
   */
  const getTouchDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  /**
   * Calculate center point between two touches
   */
  const getTouchCenter = useCallback((touches: TouchList): { x: number; y: number } => {
    if (touches.length < 2) {
      return { x: touches[0]?.clientX ?? 0, y: touches[0]?.clientY ?? 0 };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }, []);

  /**
   * Handle touch start for pinch gesture detection
   */
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (event.touches.length === 2) {
      lastTouchDistanceRef.current = getTouchDistance(event.touches);
      lastTouchCenterRef.current = getTouchCenter(event.touches);
    }
  }, [getTouchDistance, getTouchCenter]);

  /**
   * Handle touch move for pinch-to-zoom gesture
   * Requirements: 1.5, 1.6 - Zoom controls including pinch gesture
   */
  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length !== 2 || lastTouchDistanceRef.current === null) return;

    event.preventDefault();

    const currentDistance = getTouchDistance(event.touches);
    const currentCenter = getTouchCenter(event.touches);

    const {
      MIN_VISIBLE_BEATS,
      MAX_VISIBLE_BEATS,
      MIN_VISIBLE_SEMITONES,
      MAX_VISIBLE_SEMITONES,
    } = CANVAS_CONFIG;

    // Calculate zoom factor from pinch (distance change)
    const zoomFactor = lastTouchDistanceRef.current / currentDistance;

    const currentBeatSpan = visibleRegion.endBeat - visibleRegion.startBeat;
    const currentPitchSpan = visibleRegion.endPitch - visibleRegion.startPitch;

    // Calculate new spans
    const newBeatSpan = Math.max(MIN_VISIBLE_BEATS, Math.min(MAX_VISIBLE_BEATS, currentBeatSpan * zoomFactor));
    // Round pitch span to whole semitones
    const newPitchSpan = Math.round(Math.max(MIN_VISIBLE_SEMITONES, Math.min(MAX_VISIBLE_SEMITONES, currentPitchSpan * zoomFactor)));

    // Calculate zoom center from touch center
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = currentCenter.x - rect.left - CANVAS_CONFIG.PITCH_LABEL_WIDTH;
    const centerY = currentCenter.y - rect.top - CANVAS_CONFIG.TIME_MARKER_HEIGHT;

    const gridWidth = rect.width - CANVAS_CONFIG.PITCH_LABEL_WIDTH - CANVAS_CONFIG.SCROLLBAR_WIDTH;
    const gridHeight = rect.height - CANVAS_CONFIG.TIME_MARKER_HEIGHT - CANVAS_CONFIG.SCROLLBAR_HEIGHT;

    const xRatio = Math.max(0, Math.min(1, centerX / gridWidth));
    const yRatio = Math.max(0, Math.min(1, centerY / gridHeight));

    const beatAtCenter = visibleRegion.startBeat + xRatio * currentBeatSpan;
    const pitchAtCenter = visibleRegion.endPitch - yRatio * currentPitchSpan;

    const newStartBeat = beatAtCenter - xRatio * newBeatSpan;
    const newEndBeat = newStartBeat + newBeatSpan;
    const newEndPitch = pitchAtCenter + yRatio * newPitchSpan;
    const newStartPitch = newEndPitch - newPitchSpan;

    const newRegion = constrainVisibleRegion({
      startBeat: newStartBeat,
      endBeat: newEndBeat,
      startPitch: newStartPitch,
      endPitch: newEndPitch,
    });

    updateVisibleRegion(newRegion);

    // Update tracking refs
    lastTouchDistanceRef.current = currentDistance;
    lastTouchCenterRef.current = currentCenter;
  }, [visibleRegion, updateVisibleRegion, constrainVisibleRegion, getTouchDistance, getTouchCenter]);

  /**
   * Handle touch end to reset pinch tracking
   */
  const handleTouchEnd = useCallback(() => {
    lastTouchDistanceRef.current = null;
    lastTouchCenterRef.current = null;
  }, []);

  /**
   * Checks if a click position overlaps with an existing note
   * @param clickBeat The beat position of the click
   * @param clickPitch The pitch of the click
   * @returns true if there is an existing note at this position
   */
  const isClickOnExistingNote = useCallback((clickBeat: number, clickPitch: number): boolean => {
    return notes.some(note => {
      const noteEndBeat = note.start + note.duration;
      return (
        note.pitch === clickPitch &&
        clickBeat >= note.start &&
        clickBeat < noteEndBeat
      );
    });
  }, [notes]);

  /**
   * Finds the note at a given beat and pitch position
   * @param clickBeat The beat position to check
   * @param clickPitch The pitch to check
   * @returns The note at that position, or null if none
   */
  const findNoteAtPosition = useCallback((clickBeat: number, clickPitch: number): Note | null => {
    return notes.find(note => {
      const noteEndBeat = note.start + note.duration;
      return (
        note.pitch === clickPitch &&
        clickBeat >= note.start &&
        clickBeat < noteEndBeat
      );
    }) ?? null;
  }, [notes]);

  /**
   * Converts a pixel X position to a beat position
   * @param pixelX The X position in pixels relative to container
   * @returns The beat position
   */
  const pixelXToBeat = useCallback((pixelX: number): number => {
    const container = containerRef.current;
    if (!container) return 0;

    const rect = container.getBoundingClientRect();
    const { PITCH_LABEL_WIDTH, SCROLLBAR_WIDTH } = CANVAS_CONFIG;
    const gridWidth = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gridX = pixelX - PITCH_LABEL_WIDTH;
    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;

    return visibleRegion.startBeat + (gridX / gridWidth) * visibleBeats;
  }, [visibleRegion]);

  /**
   * Converts a pixel Y position to a pitch value
   * @param pixelY The Y position in pixels relative to container
   * @returns The pitch value (MIDI note number)
   */
  const pixelYToPitch = useCallback((pixelY: number): number => {
    const container = containerRef.current;
    if (!container) return 60;

    const rect = container.getBoundingClientRect();
    const { TIME_MARKER_HEIGHT, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;
    const gridHeight = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
    const gridY = pixelY - TIME_MARKER_HEIGHT;
    const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;

    // Y increases downward, pitch increases upward
    const relativePitchFromTop = (gridY / gridHeight) * visibleSemitones;
    return Math.floor(visibleRegion.endPitch - relativePitchFromTop);
  }, [visibleRegion]);

  /**
   * Converts a beat position to pixel X position
   * @param beat The beat position
   * @returns The X position in pixels relative to container
   */
  const beatToPixelX = useCallback((beat: number): number => {
    const container = containerRef.current;
    if (!container) return 0;

    const rect = container.getBoundingClientRect();
    const { PITCH_LABEL_WIDTH, SCROLLBAR_WIDTH } = CANVAS_CONFIG;
    const gridWidth = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;

    return PITCH_LABEL_WIDTH + ((beat - visibleRegion.startBeat) / visibleBeats) * gridWidth;
  }, [visibleRegion]);

  /**
   * Checks if a pixel X position is on the right edge (resize handle) of a note
   * Requirements: 5.1 - Detect when mouse is on right edge of a note
   * @param pixelX The X position in pixels relative to container
   * @param note The note to check against
   * @returns true if the position is within the resize handle zone
   */
  const isOnResizeHandle = useCallback((pixelX: number, note: Note): boolean => {
    const noteEndBeat = note.start + note.duration;
    const noteEndPixelX = beatToPixelX(noteEndBeat);

    // Check if pixelX is within RESIZE_HANDLE_WIDTH pixels of the right edge
    return pixelX >= noteEndPixelX - RESIZE_HANDLE_WIDTH && pixelX <= noteEndPixelX;
  }, [beatToPixelX]);

  /**
   * Checks if a pixel position is within a scrollbar thumb
   * Requirements: 34.3 - Detect scrollbar thumb for drag interactions
   * @param pixelX The X position in pixels relative to container
   * @param pixelY The Y position in pixels relative to container
   * @returns 'horizontal', 'vertical', or null if not over a scrollbar thumb
   */
  const getScrollbarAtPosition = useCallback((pixelX: number, pixelY: number): 'horizontal' | 'vertical' | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const {
      PITCH_LABEL_WIDTH,
      TIME_MARKER_HEIGHT,
      SCROLLBAR_WIDTH,
      SCROLLBAR_HEIGHT,
      MIN_THUMB_SIZE,
      TOTAL_PITCH_RANGE,
    } = CANVAS_CONFIG;

    // Calculate scrollbar state from current visible region
    const scrollbarState = calculateScrollbarState(visibleRegion, effectiveTotalBeats, TOTAL_PITCH_RANGE);

    // Check horizontal scrollbar (bottom)
    const hTrackX = PITCH_LABEL_WIDTH;
    const hTrackY = rect.height - SCROLLBAR_HEIGHT;
    const hTrackWidth = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const hTrackHeight = SCROLLBAR_HEIGHT;

    if (pixelY >= hTrackY && pixelY <= hTrackY + hTrackHeight && pixelX >= hTrackX && pixelX <= hTrackX + hTrackWidth) {
      // Check if over the thumb
      const hThumbWidth = Math.max(MIN_THUMB_SIZE, hTrackWidth * scrollbarState.horizontalThumbSize);
      const hThumbX = hTrackX + (scrollbarState.horizontalPosition * (hTrackWidth - hThumbWidth));

      if (pixelX >= hThumbX && pixelX <= hThumbX + hThumbWidth) {
        return 'horizontal';
      }
    }

    // Check vertical scrollbar (right)
    const vTrackX = rect.width - SCROLLBAR_WIDTH;
    const vTrackY = TIME_MARKER_HEIGHT;
    const vTrackWidth = SCROLLBAR_WIDTH;
    const vTrackHeight = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

    if (pixelX >= vTrackX && pixelX <= vTrackX + vTrackWidth && pixelY >= vTrackY && pixelY <= vTrackY + vTrackHeight) {
      // Check if over the thumb
      const vThumbHeight = Math.max(MIN_THUMB_SIZE, vTrackHeight * scrollbarState.verticalThumbSize);
      const vThumbY = vTrackY + (scrollbarState.verticalPosition * (vTrackHeight - vThumbHeight));

      if (pixelY >= vThumbY && pixelY <= vThumbY + vThumbHeight) {
        return 'vertical';
      }
    }

    return null;
  }, [visibleRegion, effectiveTotalBeats]);

  /**
   * Handles scrollbar drag movement
   * Requirements: 34.3, 34.4, 34.5 - Update visible region based on scrollbar drag
   *
   * Property 23: Scrollbar-Visible Region Synchronization
   * - Dragging a scrollbar to position P SHALL update the visible region proportionally
   *
   * @param event Mouse event with current position
   */
  const handleScrollbarDrag = useCallback((event: MouseEvent) => {
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

      // Calculate current mouse position relative to track
      const currentX = event.clientX - rect.left;
      const deltaX = currentX - scrollbarDragState.startPosition;

      // Calculate thumb size to determine effective track width
      const scrollbarState = calculateScrollbarState(scrollbarDragState.initialVisibleRegion, effectiveTotalBeats, TOTAL_PITCH_RANGE);
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

      updateVisibleRegion(newRegion);
    } else {
      // Vertical scrollbar drag
      const vTrackHeight = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

      // Calculate current mouse position relative to track
      const currentY = event.clientY - rect.top;
      const deltaY = currentY - scrollbarDragState.startPosition;

      // Calculate thumb size to determine effective track height
      const scrollbarState = calculateScrollbarState(scrollbarDragState.initialVisibleRegion, effectiveTotalBeats, TOTAL_PITCH_RANGE);
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

      updateVisibleRegion(newRegion);
    }
  }, [scrollbarDragState, visibleRegion, constrainVisibleRegion, updateVisibleRegion, effectiveTotalBeats]);

  /**
   * Handles mouse up to complete scrollbar drag operation
   * Requirements: 34.3 - Finalizes the scrollbar drag
   */
  const handleScrollbarDragEnd = useCallback(() => {
    if (scrollbarDragState) {
      setScrollbarDragState(null);
    }
  }, [scrollbarDragState]);

  /**
   * Finds a note at a given pixel position and determines if it's on the resize handle
   * Requirements: 5.1 - Detect resize handle zone
   * @param pixelX The X position in pixels relative to container
   * @param pixelY The Y position in pixels relative to container
   * @returns Object with note and isResize flag, or null if no note at position
   */
  const findNoteAtPixelPosition = useCallback((pixelX: number, pixelY: number): { note: Note; isResize: boolean } | null => {
    const clickBeat = pixelXToBeat(pixelX);
    const clickPitch = pixelYToPitch(pixelY);
    const note = findNoteAtPosition(clickBeat, clickPitch);

    if (!note) return null;

    const isResize = isOnResizeHandle(pixelX, note);
    return { note, isResize };
  }, [pixelXToBeat, pixelYToPitch, findNoteAtPosition, isOnResizeHandle]);

  /**
   * Handles mouse down on the canvas for initiating note drag or resize, scrollbar drag, or marquee selection
   * Requirements: 3.1, 3.5 - Track drag start position and original note state
   * Requirements: 4.1, 4.2, 4.3 - Track vertical drag for pitch changes
   * Requirements: 5.1 - Detect right edge for resize operations
   * Requirements: 34.3 - Initiate scrollbar drag operations
   * Requirements: 2.1 - Click and drag on empty area starts marquee selection
   */
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    // Only handle left mouse button (button 0)
    // Right-click is handled by handleContextMenu
    if (event.button !== 0) return;

    const container = containerRef.current;
    if (!container) return;

    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT, TOTAL_PITCH_RANGE } = CANVAS_CONFIG;
    const rect = container.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Check if click is on a scrollbar thumb first
    const scrollbarHit = getScrollbarAtPosition(clickX, clickY);
    if (scrollbarHit) {
      // Calculate initial scroll position from current visible region
      const scrollbarState = calculateScrollbarState(visibleRegion, effectiveTotalBeats, TOTAL_PITCH_RANGE);

      setScrollbarDragState({
        scrollbar: scrollbarHit,
        startPosition: scrollbarHit === 'horizontal' ? clickX : clickY,
        initialScrollPosition: scrollbarHit === 'horizontal'
          ? scrollbarState.horizontalPosition
          : scrollbarState.verticalPosition,
        initialVisibleRegion: { ...visibleRegion },
      });
      event.preventDefault();
      return;
    }

    // Check if click is within the grid area (exclude scrollbars)
    if (clickX < PITCH_LABEL_WIDTH || clickY < TIME_MARKER_HEIGHT ||
        clickX > rect.width - SCROLLBAR_WIDTH || clickY > rect.height - SCROLLBAR_HEIGHT) {
      return;
    }

    // Find the note at the clicked position and check if it's a resize operation
    const result = findNoteAtPixelPosition(clickX, clickY);

    if (result && onNoteUpdate) {
      const { note: clickedNote, isResize } = result;

      // Check if clicked note is part of the current selection (for group drag)
      // Requirements: 4.1 - Clicking on a selected note starts group movement
      const isClickedNoteSelected = selectedNoteIds.has(clickedNote.id);
      const hasMultipleSelected = selectedNoteIds.size > 1;
      const shouldGroupDrag = isClickedNoteSelected && hasMultipleSelected && !isResize;

      // Capture original positions of ALL selected notes for group drag
      // Requirements: 4.1, 4.7 - Store original positions for group movement and cancel/restore
      const originalSelectedNotes = new Map<string, Note>();
      if (shouldGroupDrag) {
        for (const noteId of selectedNoteIds) {
          const note = notes.find(n => n.id === noteId);
          if (note) {
            originalSelectedNotes.set(noteId, { ...note });
          }
        }
      }

      // Start dragging/resizing this note
      setDragState({
        note: { ...clickedNote },
        originalNote: { ...clickedNote },
        originalSelectedNotes,
        startX: clickX,
        startY: clickY,
        mode: isResize ? 'resize' : 'move',
        isGroupDrag: shouldGroupDrag,
      });
      // Prevent default to avoid text selection during drag
      event.preventDefault();
    } else {
      // Click on empty area: start marquee selection
      // Requirements: 2.1 - Click and drag on empty area displays selection rectangle
      // Store previous selection for potential cancel (Property 8)
      // Detect if Ctrl/Cmd held for additive mode (Property 7)
      const isAdditive = isPlatformModifierKey(event.nativeEvent);

      setMarqueeState({
        startX: clickX,
        startY: clickY,
        currentX: clickX,
        currentY: clickY,
        previousSelection: new Set(selectedNoteIds),
        isAdditive,
      });
      event.preventDefault();
    }
  }, [findNoteAtPixelPosition, onNoteUpdate, getScrollbarAtPosition, visibleRegion, effectiveTotalBeats, selectedNoteIds, notes]);

  /**
   * Handles mouse move for dragging notes (horizontal and vertical) or resizing
   * Requirements: 3.1, 3.2, 3.3, 3.4 (horizontal move)
   * - Updates note start time during drag
   * - Applies grid snap when enabled
   * - Clamps start time to non-negative values
   * - Maintains 60fps via requestAnimationFrame (render effect)
   *
   * Requirements: 4.1, 4.2, 4.3, 4.4 (vertical move)
   * - Updates note pitch during vertical drag
   * - Rounds pitch to nearest MIDI note value (discrete integers)
   * - Clamps pitch to valid MIDI range (0-127)
   * - Pitch changes are independent of grid snap settings
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5 (resize)
   * - Updates note duration proportionally to horizontal drag distance
   * - Applies grid snap to end time when enabled
   * - Enforces minimum duration based on grid snap state
   * - Updates at 60fps
   *
   * Requirements: 4.1, 4.2, 4.3 (group movement)
   * - Moves ALL selected notes together maintaining relative positions (Property 10)
   * - Applies grid snap to primary note, uses same delta for others (Property 11, 12)
   * - Constrains movement to keep all notes within valid bounds (Property 13)
   *
   * Property 4: Note Boundary Clamping
   * - The start time SHALL be clamped to the range [0, ∞)
   * - The pitch SHALL be clamped to the range [0, 127]
   *
   * Property 5: Minimum Duration Enforcement
   * - When grid snap is enabled, minimum duration is the current grid division
   * - When grid snap is disabled, minimum duration is 0.1 beats
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState || !onNoteUpdate) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    // Calculate the delta in pixels (horizontal)
    const deltaX = currentX - dragState.startX;

    // Convert pixel delta to beat delta (horizontal time adjustment)
    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;
    const gridWidth = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gridHeight = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;
    const deltaBeat = (deltaX / gridWidth) * visibleBeats;

    let updatedNote: Note;

    if (dragState.mode === 'resize') {
      // Resize mode: update duration based on horizontal drag
      // Requirements: 5.1, 5.2, 5.3, 5.4

      // Calculate new end time from the drag delta
      const originalEndTime = dragState.originalNote.start + dragState.originalNote.duration;
      const rawNewEndTime = originalEndTime + deltaBeat;

      // Apply grid snap to end time if enabled (Requirement 5.2)
      const snappedEndTime = snapPosition(rawNewEndTime, gridSnap);

      // Calculate new duration
      const rawNewDuration = snappedEndTime - dragState.originalNote.start;

      // Get minimum duration based on grid snap state (Property 5)
      const minDuration = getMinimumDuration(gridSnap);

      // Clamp duration to minimum valid value
      // Also ensure it's at least 0.001 per validation constraints
      const clampedDuration = Math.max(minDuration, Math.max(0.001, rawNewDuration));

      updatedNote = {
        ...dragState.note,
        duration: clampedDuration,
      };

      // Update drag state with current note position
      setDragState(prev => prev ? { ...prev, note: updatedNote } : null);

      // Call the update callback for single note resize
      onNoteUpdate(updatedNote);
    } else if (dragState.isGroupDrag && dragState.originalSelectedNotes.size > 0) {
      // Group move mode: move ALL selected notes together
      // Requirements: 4.1, 4.2, 4.3 - Group movement

      // Calculate new start time for primary note (horizontal)
      const rawNewStart = dragState.originalNote.start + deltaBeat;

      // Apply grid snap to primary note if enabled (Property 11)
      const snappedStart = snapPosition(rawNewStart, gridSnap);

      // Calculate actual beat delta after snapping (for applying to all notes)
      const snappedDeltaBeat = snappedStart - dragState.originalNote.start;

      // Calculate the delta in pixels (vertical)
      const deltaY = currentY - dragState.startY;

      // Convert pixel delta to pitch delta (vertical pitch adjustment)
      // Y increases downward, pitch increases upward, so we negate
      const rawDeltaPitch = -(deltaY / gridHeight) * visibleSemitones;

      // Round to nearest integer - all notes move by same pitch delta (Property 12)
      const deltaPitch = Math.round(rawDeltaPitch);

      // Get all selected notes for constraint calculation
      const selectedNotes = Array.from(dragState.originalSelectedNotes.values());

      // Apply constraints to keep ALL notes within valid bounds (Property 13)
      const { constrainedDeltaBeat, constrainedDeltaPitch } = calculateGroupMoveConstraints(
        selectedNotes,
        snappedDeltaBeat,
        deltaPitch
      );

      // Update primary note for drag state tracking
      updatedNote = {
        ...dragState.note,
        start: dragState.originalNote.start + constrainedDeltaBeat,
        pitch: dragState.originalNote.pitch + constrainedDeltaPitch,
      };

      // Update drag state with current primary note position
      setDragState(prev => prev ? { ...prev, note: updatedNote } : null);

      // Update ALL selected notes with constrained deltas (Property 10)
      if (onBulkNoteUpdate) {
        // Use bulk update if available (more efficient)
        const updates = new Map<string, Partial<Note>>();
        for (const [noteId, originalNote] of dragState.originalSelectedNotes) {
          updates.set(noteId, {
            start: originalNote.start + constrainedDeltaBeat,
            pitch: originalNote.pitch + constrainedDeltaPitch,
          });
        }
        onBulkNoteUpdate(updates);
      } else {
        // Fall back to individual updates
        for (const [noteId, originalNote] of dragState.originalSelectedNotes) {
          onNoteUpdate({
            ...originalNote,
            start: originalNote.start + constrainedDeltaBeat,
            pitch: originalNote.pitch + constrainedDeltaPitch,
          });
        }
      }
    } else {
      // Single note move mode: update start time and pitch
      // Calculate new start time (horizontal)
      const rawNewStart = dragState.originalNote.start + deltaBeat;

      // Apply grid snap if enabled (Requirement 3.2)
      const snappedStart = snapPosition(rawNewStart, gridSnap);

      // Clamp to non-negative values (Requirement 3.3, Property 4)
      const clampedStart = Math.max(0, snappedStart);

      // Calculate the delta in pixels (vertical)
      const deltaY = currentY - dragState.startY;

      // Convert pixel delta to pitch delta (vertical pitch adjustment)
      // Y increases downward, pitch increases upward, so we negate
      const deltaPitch = -(deltaY / gridHeight) * visibleSemitones;

      // Calculate new pitch (Requirement 4.1)
      const rawNewPitch = dragState.originalNote.pitch + deltaPitch;

      // Round to nearest integer - MIDI notes are discrete (Requirement 4.4)
      const roundedPitch = Math.round(rawNewPitch);

      // Clamp to valid MIDI range 0-127 (Requirement 4.2, Property 4)
      const clampedPitch = Math.max(0, Math.min(127, roundedPitch));

      // Update the note with new start time and pitch (combined horizontal + vertical)
      updatedNote = {
        ...dragState.note,
        start: clampedStart,
        pitch: clampedPitch,
      };

      // Update drag state with current note position
      setDragState(prev => prev ? { ...prev, note: updatedNote } : null);

      // Call the update callback
      onNoteUpdate(updatedNote);
    }
  }, [dragState, onNoteUpdate, onBulkNoteUpdate, visibleRegion, gridSnap]);

  /**
   * Handles mouse move during marquee selection
   * Requirements: 2.1 - Update marquee rectangle as user drags
   * Requirements: 2.2 - Calculate intersecting notes during drag
   *
   * Updates the marquee state with current mouse position and calculates
   * which notes intersect with the selection rectangle.
   *
   * @param event Mouse event with current position
   */
  const handleMarqueeMove = useCallback((event: MouseEvent) => {
    if (!marqueeState) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    // Update marquee state with current position
    setMarqueeState(prev => prev ? { ...prev, currentX, currentY } : null);

    // Calculate intersecting notes for preview highlighting
    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;
    const gridWidth = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gridHeight = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;

    // Convert marquee pixel coordinates to beat/pitch coordinates
    // Clamp coordinates to grid boundaries
    const clampedStartX = Math.max(PITCH_LABEL_WIDTH, Math.min(marqueeState.startX, rect.width - SCROLLBAR_WIDTH));
    const clampedStartY = Math.max(TIME_MARKER_HEIGHT, Math.min(marqueeState.startY, rect.height - SCROLLBAR_HEIGHT));
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
    const intersectingIds = getNotesInRect(notes, {
      startBeat,
      endBeat,
      startPitch,
      endPitch,
    }, visibleRegion);

    // Update selection preview based on additive mode
    // Property 6: Replace mode - selection equals intersecting notes
    // Property 7: Additive mode - selection equals union of previous and intersecting
    if (marqueeState.isAdditive) {
      // Additive mode: union of previous selection and intersecting notes
      const newSelection = new Set(marqueeState.previousSelection);
      for (const id of intersectingIds) {
        newSelection.add(id);
      }
      // Update selection with onAddToSelection or by selecting all notes
      if (onAddToSelection) {
        // Call with all note IDs that should be in selection
        const idsToAdd = intersectingIds.filter(id => !marqueeState.previousSelection.has(id));
        if (idsToAdd.length > 0) {
          onAddToSelection(idsToAdd);
        }
      }
    } else {
      // Replace mode: selection equals intersecting notes only
      // Use onNoteSelect with the first intersecting note or deselect all if none
      if (intersectingIds.length > 0 && onAddToSelection && onDeselectAll) {
        // First deselect all, then add intersecting notes
        onDeselectAll();
        onAddToSelection(intersectingIds);
      } else if (intersectingIds.length === 0 && onDeselectAll) {
        onDeselectAll();
      }
    }
  }, [marqueeState, visibleRegion, notes, onAddToSelection, onDeselectAll]);

  /**
   * Handles mouse move on the canvas to update hover state for resize cursor, timeline, and scrollbars
   * Also handles marquee selection drag
   * Requirements: 5.1 - Show resize cursor (ew-resize) when hovering over right edge
   * Requirement 8.5 - Show pointer cursor when hovering over timeline for playhead positioning
   * Requirements: 34.3 - Show grab cursor when hovering over scrollbar thumbs
   * Requirements: 2.1 - Update marquee rectangle during drag
   */
  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    // Don't update hover state while dragging - the drag cursor takes precedence
    if (dragState || scrollbarDragState || marqueeState) return;

    const container = containerRef.current;
    if (!container) return;

    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Check if mouse is over a scrollbar thumb first
    const scrollbarHover = getScrollbarAtPosition(mouseX, mouseY);
    if (scrollbarHover) {
      setIsOverScrollbar(scrollbarHover);
      setIsOverTimeline(false);
      setIsOverResizeHandle(false);
      return;
    } else {
      setIsOverScrollbar(null);
    }

    // Check if mouse is over the timeline area (time markers)
    // Requirement 8.5: Allow clicking on timeline to reposition playhead
    const overTimeline = mouseY < TIME_MARKER_HEIGHT && mouseX >= PITCH_LABEL_WIDTH && mouseX <= rect.width - SCROLLBAR_WIDTH;
    setIsOverTimeline(overTimeline);

    // If over timeline, we're not over a resize handle
    if (overTimeline) {
      setIsOverResizeHandle(false);
      return;
    }

    // Check if mouse is within the grid area (exclude scrollbars)
    if (mouseX < PITCH_LABEL_WIDTH || mouseY < TIME_MARKER_HEIGHT ||
        mouseX > rect.width - SCROLLBAR_WIDTH || mouseY > rect.height - SCROLLBAR_HEIGHT) {
      setIsOverResizeHandle(false);
      return;
    }

    // Check if mouse is over a note's resize handle
    const result = findNoteAtPixelPosition(mouseX, mouseY);
    setIsOverResizeHandle(result?.isResize ?? false);
  }, [dragState, scrollbarDragState, marqueeState, findNoteAtPixelPosition, getScrollbarAtPosition]);

  /**
   * Handles mouse leave on the canvas to reset hover state
   */
  const handleCanvasMouseLeave = useCallback(() => {
    if (!dragState && !scrollbarDragState) {
      setIsOverResizeHandle(false);
      setIsOverTimeline(false);
      setIsOverScrollbar(null);
    }
  }, [dragState, scrollbarDragState]);

  /**
   * Handles right-click (context menu) for note deletion
   * Requirements: 5.2, 5.3 - Right-click deletion with multi-selection support
   *
   * Property 15: Group Deletion Removes All Selected Notes
   * - When right-clicking on a selected note, all selected notes are deleted
   *
   * Property 16: Right-Click on Unselected Deletes Only Clicked Note
   * - When right-clicking on an unselected note, only that note is deleted
   *
   * Property 17: Selection Cleared After Deletion
   * - Selection is cleared after group deletion
   */
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const container = containerRef.current;
    if (!container) return;

    // Prevent default browser context menu
    event.preventDefault();

    // Only handle right-click deletion if callback is provided
    if (!onNoteDelete) return;

    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;
    const rect = container.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Check if click is within the grid area (exclude scrollbars)
    if (clickX < PITCH_LABEL_WIDTH || clickY < TIME_MARKER_HEIGHT ||
        clickX > rect.width - SCROLLBAR_WIDTH || clickY > rect.height - SCROLLBAR_HEIGHT) {
      return;
    }

    // Find the note at the clicked position
    const result = findNoteAtPixelPosition(clickX, clickY);

    if (result) {
      const clickedNoteId = result.note.id;

      // Check if the clicked note is in the current selection
      if (selectedNoteIds.has(clickedNoteId)) {
        // Property 15: Delete ALL selected notes when right-clicking on a selected note
        for (const noteId of selectedNoteIds) {
          onNoteDelete(noteId);
        }
        // Property 17: Clear selection after group deletion
        if (onDeselectAll) {
          onDeselectAll();
        }
      } else {
        // Property 16: Delete only the clicked note if it's not in the selection
        onNoteDelete(clickedNoteId);
      }
    }
  }, [onNoteDelete, findNoteAtPixelPosition, selectedNoteIds, onDeselectAll]);

  /**
   * Handles mouse up to complete the drag operation or finalize marquee selection
   * Requirements: 3.1 - Finalizes the note position update
   * Requirements: 2.3, 2.4 - Finalize marquee selection with replace or additive mode
   *
   * Property 6: Marquee Selection Replace Mode - without modifier, selection equals intersecting notes
   * Property 7: Marquee Selection Additive Mode - with Ctrl/Cmd, selection equals union of previous and intersecting
   */
  const handleMouseUp = useCallback(() => {
    if (dragState) {
      // Set flag to prevent the subsequent click event from creating a new note
      justFinishedDragRef.current = true;
      // Clear the flag after a short delay (click event fires synchronously after mouseup)
      setTimeout(() => {
        justFinishedDragRef.current = false;
      }, 0);
      // Clear drag state - the note update was already called via onNoteUpdate
      setDragState(null);
    }

    if (marqueeState) {
      // Check if user actually dragged (not just a click)
      // A simple click should create a note, not be treated as a zero-size marquee
      const MIN_MARQUEE_DISTANCE = 5; // pixels
      const dragDistance = Math.sqrt(
        Math.pow(marqueeState.currentX - marqueeState.startX, 2) +
        Math.pow(marqueeState.currentY - marqueeState.startY, 2)
      );
      const wasActualDrag = dragDistance >= MIN_MARQUEE_DISTANCE;

      if (wasActualDrag) {
        const container = containerRef.current;
        if (container) {
          // Finalize selection based on the marquee rectangle
          const rect = container.getBoundingClientRect();
          const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;
          const gridWidth = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
          const gridHeight = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
          const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
          const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;

          // Convert marquee pixel coordinates to beat/pitch coordinates
          // Clamp coordinates to grid boundaries
          const clampedStartX = Math.max(PITCH_LABEL_WIDTH, Math.min(marqueeState.startX, rect.width - SCROLLBAR_WIDTH));
          const clampedStartY = Math.max(TIME_MARKER_HEIGHT, Math.min(marqueeState.startY, rect.height - SCROLLBAR_HEIGHT));
          const clampedCurrentX = Math.max(PITCH_LABEL_WIDTH, Math.min(marqueeState.currentX, rect.width - SCROLLBAR_WIDTH));
          const clampedCurrentY = Math.max(TIME_MARKER_HEIGHT, Math.min(marqueeState.currentY, rect.height - SCROLLBAR_HEIGHT));

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
          const intersectingIds = getNotesInRect(notes, {
            startBeat,
            endBeat,
            startPitch,
            endPitch,
          }, visibleRegion);

          // Finalize selection based on additive mode
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
            if (onDeselectAll) {
              onDeselectAll();
            }
            if (intersectingIds.length > 0 && onAddToSelection) {
              onAddToSelection(intersectingIds);
            }
          }
        }

        // Set flag to prevent the subsequent click event from triggering
        // Only for actual drags, not simple clicks
        justFinishedDragRef.current = true;
        setTimeout(() => {
          justFinishedDragRef.current = false;
        }, 0);
      }
      // Clear marquee state regardless of drag distance
      setMarqueeState(null);
    }
  }, [dragState, marqueeState, visibleRegion, notes, onAddToSelection, onDeselectAll]);

  /**
   * Handles key down for canceling drag/marquee operations and deleting notes
   * Requirements: 3.5 - Support drag cancel with state restoration
   * Requirements: 2.5 - Support marquee cancel with selection restoration
   * Requirements: 6.1 - Handle Delete/Backspace key on selected notes
   *
   * Property 6: Drag Cancel Restores Original State
   * - For any drag operation that is cancelled, the Note SHALL be restored
   *   to its exact original position values
   *
   * Property 7: Note Deletion Removes from Melody
   * - For any Note in a Melody, when the Note is deleted (via Delete/Backspace key),
   *   the Note SHALL no longer exist in the Melody's notes array
   *
   * Property 8: Marquee Cancel Restores State
   * - For any marquee selection that is cancelled, the selection SHALL be restored
   *   to its exact state before the marquee began
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Handle Escape key for canceling drag
    if (event.key === 'Escape' && dragState && onNoteUpdate) {
      // Property 14: Group Drag Cancel Restores All Notes
      // For group drag, restore ALL selected notes to their original positions
      if (dragState.isGroupDrag && dragState.originalSelectedNotes.size > 0) {
        if (onBulkNoteUpdate) {
          // Use bulk update if available (more efficient)
          const updates = new Map<string, Partial<Note>>();
          for (const [noteId, originalNote] of dragState.originalSelectedNotes) {
            updates.set(noteId, {
              start: originalNote.start,
              pitch: originalNote.pitch,
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
      return;
    }

    // Handle Escape key for canceling marquee selection
    // Property 8: Marquee Cancel Restores State
    if (event.key === 'Escape' && marqueeState) {
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
      return;
    }

    // Handle Delete/Backspace key for deleting selected notes
    // Requirements: 6.1 - Delete key or Backspace key removes selected notes
    if ((event.key === 'Delete' || event.key === 'Backspace') && onNoteDelete) {
      // Prevent default browser behavior (e.g., navigating back on Backspace)
      event.preventDefault();

      // Delete all selected notes
      for (const noteId of selectedNoteIds) {
        onNoteDelete(noteId);
      }
    }
  }, [dragState, marqueeState, onNoteUpdate, onBulkNoteUpdate, onNoteDelete, selectedNoteIds, onDeselectAll, onAddToSelection]);

  /**
   * Handles click events on the canvas for note selection, note creation, and playhead repositioning
   *
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6 (Click selection with modifier keys)
   * - Simple click on note: clear selection and select only clicked note
   * - Simple click on empty: clear selection
   * - Ctrl/Cmd + click on note: toggle note selection
   * - Shift + click on note: select range from anchor to clicked note
   *
   * Requirements: 2.1, 2.2, 2.3 (Note creation)
   * - Creates a new Note at the clicked pitch and time position
   * - Assigns default duration of 1 beat and default velocity of 0.8
   * - Aligns note start time to nearest grid division when grid snap is enabled
   *
   * Requirement 8.5 (Timeline click)
   * - Clicking on the timeline area repositions the playhead to the clicked time position
   *
   * Property 1: Simple Click Clears and Selects Single Note
   * Property 2: Click on Empty Clears Selection
   * Property 3: Ctrl/Cmd Click Toggles Selection
   * Property 4: Shift-Click Range Selection
   *
   * Property 9: Timeline Click Positions Playhead
   * - For any click on the timeline area at time T, the playhead position SHALL be set to T
   */
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    // Only handle left mouse button (button 0)
    if (event.button !== 0) return;

    // Don't handle click if currently dragging (drag end fires click)
    if (dragState) return;

    // Don't handle click if we just finished a drag/resize operation
    // This prevents creating a new note when releasing the mouse after editing
    if (justFinishedDragRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;

    // Get click position relative to canvas
    const rect = container.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Calculate grid dimensions (used for both timeline clicks and note creation)
    const gridWidth = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;

    // Check if click is in the time marker area (timeline)
    // Requirements: 8.5 - Clicking on timeline repositions playhead
    // Property 9: Timeline Click Positions Playhead
    if (clickY < TIME_MARKER_HEIGHT && clickX >= PITCH_LABEL_WIDTH && clickX <= rect.width - SCROLLBAR_WIDTH) {
      if (onPlayheadChange) {
        // Convert click X position to beat position
        const gridX = clickX - PITCH_LABEL_WIDTH;
        const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
        const relativeBeat = (gridX / gridWidth) * visibleBeats;
        const clickedBeat = visibleRegion.startBeat + relativeBeat;

        // Ensure the position is non-negative
        const clampedBeat = Math.max(0, clickedBeat);

        // Call the playhead change callback with the new position
        onPlayheadChange(clampedBeat);
      }
      return;
    }

    // Check if click is within the grid area (not on pitch labels, time markers, or scrollbars)
    if (clickX < PITCH_LABEL_WIDTH || clickY < TIME_MARKER_HEIGHT ||
        clickX > rect.width - SCROLLBAR_WIDTH || clickY > rect.height - SCROLLBAR_HEIGHT) {
      return;
    }

    // Calculate grid dimensions
    const gridHeight = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

    // Convert click position to grid-relative coordinates
    const gridX = clickX - PITCH_LABEL_WIDTH;
    const gridY = clickY - TIME_MARKER_HEIGHT;

    // Calculate beat and pitch from grid position
    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;

    // X position maps to beats
    const relativeBeat = (gridX / gridWidth) * visibleBeats;
    const rawBeat = visibleRegion.startBeat + relativeBeat;

    // Y position maps to pitch (Y increases downward, pitch increases upward)
    const relativePitchFromTop = (gridY / gridHeight) * visibleSemitones;
    const rawPitch = visibleRegion.endPitch - relativePitchFromTop;

    // Round pitch to nearest integer (MIDI notes are integers)
    const pitch = Math.floor(rawPitch);

    // Ensure pitch is within valid MIDI range (0-127)
    if (pitch < 0 || pitch > 127) {
      return;
    }

    // Find if there's a note at the clicked position
    const clickedNote = findNoteAtPosition(rawBeat, pitch);

    // Detect modifier keys for selection behavior
    // Requirements: 1.3, 1.4, 1.5 - Modifier keys for selection
    const isCtrlOrCmd = isPlatformModifierKey(event.nativeEvent);
    const isShift = event.shiftKey;

    // Handle click on a note (selection logic)
    // Requirements: 1.1, 1.3, 1.4, 1.5, 1.6 - Click selection with modifier keys
    if (clickedNote) {
      if (isShift && selectionAnchor && onAddToSelection) {
        // Shift + click: select range from anchor to clicked note (Property 4)
        // Requirements: 1.5 - Shift-click range selection
        const rangeNoteIds = getNoteRange(notes, selectionAnchor, clickedNote.id);
        onAddToSelection(rangeNoteIds);
        // Don't update anchor on Shift-click
      } else if (isCtrlOrCmd && onToggleNoteSelection) {
        // Ctrl/Cmd + click: toggle note selection (Property 3)
        // Requirements: 1.3, 1.4 - Toggle selection with modifier key
        onToggleNoteSelection(clickedNote.id);
        // Update anchor on non-Shift clicks
        if (onSetSelectionAnchor) {
          onSetSelectionAnchor(clickedNote.id);
        }
      } else if (onNoteSelect) {
        // Simple click: clear selection and select only clicked note (Property 1)
        // Requirements: 1.1 - Click clears and selects single note
        onNoteSelect(clickedNote.id);
        // Update anchor on non-Shift clicks
        if (onSetSelectionAnchor) {
          onSetSelectionAnchor(clickedNote.id);
        }
      }
      return;
    }

    // Click on empty area - clear selection (Property 2)
    // Requirements: 1.2 - Click on empty clears selection
    if (onDeselectAll) {
      onDeselectAll();
    }

    // Clear anchor when clicking on empty area
    if (onSetSelectionAnchor) {
      onSetSelectionAnchor(null);
    }

    // Don't create notes if no callback provided
    if (!onNoteCreate) return;

    // Snap beat position using grid snap configuration
    const snappedBeat = snapPosition(rawBeat, gridSnap);

    // Ensure start time is non-negative
    const startBeat = Math.max(0, snappedBeat);

    // Check if there's already a note at this position (Requirement 2.5)
    // This check uses snapped beat, different from the raw beat used for findNoteAtPosition
    if (isClickOnExistingNote(startBeat, pitch)) {
      // Don't create a new note, there's already one here
      return;
    }

    // Create new note with defaults (Requirements 2.1, 2.2)
    // Property 2: Note Creation at Valid Position
    const newNote: Note = {
      id: crypto.randomUUID(),
      pitch,
      start: startBeat,
      duration: 1, // Default duration: 1 beat
      velocity: 0.8, // Default velocity: 0.8
    };

    // Call the callback to create the note
    onNoteCreate(newNote);
  }, [
    onNoteCreate,
    onPlayheadChange,
    onNoteSelect,
    onToggleNoteSelection,
    onAddToSelection,
    onDeselectAll,
    onSetSelectionAnchor,
    selectionAnchor,
    notes,
    visibleRegion,
    gridSnap,
    isClickOnExistingNote,
    findNoteAtPosition,
    dragState,
  ]);

  /**
   * Sets up the canvas with proper device pixel ratio handling
   * This ensures crisp rendering on high-DPI displays
   */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Get device pixel ratio for high-DPI display support
    const dpr = window.devicePixelRatio || 1;

    // Get the display size from the container
    const rect = container.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    // Set the canvas buffer size accounting for device pixel ratio
    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);

    // Set the CSS display size
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Scale the context to account for device pixel ratio
    ctx.scale(dpr, dpr);

    return { ctx, displayWidth, displayHeight, dpr };
  }, []);

  /**
   * Renders pitch labels on the vertical axis
   * Shows full note names for all visible pitch rows (e.g., "C4", "C#4", "D4", "F#5")
   *
   * Requirements:
   * - 1.3: Display pitch labels showing note names in scientific pitch notation
   * - 35.1, 35.2: Display note names for all keys using scientific pitch notation
   * - 35.4, 35.5: Keep labels visible during horizontal scrolling, visually distinguish natural from sharps
   *
   * Property 24: MIDI Note to Scientific Pitch Notation
   * - Note letter = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][N % 12]
   * - Octave = floor(N / 12) - 1
   * - Middle C (MIDI 60) = C4
   */
  const renderPitchLabels = useCallback((
    ctx: CanvasRenderingContext2D,
    displayHeight: number
  ) => {
    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_HEIGHT, PITCH_LABEL_COLOR, GRID_BACKGROUND, BLACK_KEY_COLOR } = CANVAS_CONFIG;

    // Draw pitch label background
    ctx.fillStyle = GRID_BACKGROUND;
    ctx.fillRect(0, TIME_MARKER_HEIGHT, PITCH_LABEL_WIDTH, displayHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT);

    const gridHeight = displayHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

    // Defensive check: ensure visibleRegion has valid pitch values
    const startPitch = visibleRegion?.startPitch ?? 48;
    const endPitch = visibleRegion?.endPitch ?? 72;
    const visibleSemitones = endPitch - startPitch;

    // Prevent division by zero
    if (visibleSemitones <= 0 || gridHeight <= 0) return;

    const pixelsPerSemitone = gridHeight / visibleSemitones;

    // Draw all pitch labels for visible range
    for (let pitch = Math.floor(startPitch); pitch < Math.ceil(endPitch); pitch++) {
      // Skip invalid MIDI note values
      if (pitch < 0 || pitch > 127) continue;

      const relativePitch = pitch - startPitch;
      // Y increases downward, pitch increases upward
      const y = TIME_MARKER_HEIGHT + gridHeight - ((relativePitch + 1) * pixelsPerSemitone);
      const rowHeight = pixelsPerSemitone;

      // Draw background for black keys (sharps) with darker color to visually distinguish
      if (isBlackKey(pitch)) {
        ctx.fillStyle = BLACK_KEY_COLOR;
        ctx.fillRect(0, y, PITCH_LABEL_WIDTH, rowHeight);
      }

      // Draw note name label
      // Only show text if row is tall enough (at least 8px)
      if (rowHeight >= 8) {
        ctx.fillStyle = PITCH_LABEL_COLOR;
        ctx.font = rowHeight >= 14 ? '11px monospace' : '9px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const noteName = midiToNoteName(pitch);
        // Center vertically in the row
        const textY = y + (rowHeight / 2);
        ctx.fillText(noteName, PITCH_LABEL_WIDTH - 4, textY);
      }
    }

    // Draw a subtle border on the right edge of the pitch label area
    ctx.strokeStyle = '#3d3d5c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT);
    ctx.lineTo(PITCH_LABEL_WIDTH, displayHeight - SCROLLBAR_HEIGHT);
    ctx.stroke();
  }, [visibleRegion]);

  /**
   * Renders time markers on the horizontal axis
   * Shows beat numbers at intervals of 1 beat
   * Requirement 1.4: Display time markers showing beat numbers at intervals of 1 beat
   */
  const renderTimeMarkers = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number
  ) => {
    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, TIME_MARKER_COLOR, GRID_BACKGROUND } = CANVAS_CONFIG;

    // Draw time marker background
    ctx.fillStyle = GRID_BACKGROUND;
    ctx.fillRect(PITCH_LABEL_WIDTH, 0, displayWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH, TIME_MARKER_HEIGHT);

    // Draw time markers
    ctx.fillStyle = TIME_MARKER_COLOR;
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const gridWidth = displayWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const pixelsPerBeat = gridWidth / visibleBeats;

    for (let beat = Math.ceil(visibleRegion.startBeat); beat <= visibleRegion.endBeat; beat++) {
      const relativeBeat = beat - visibleRegion.startBeat;
      const x = PITCH_LABEL_WIDTH + (relativeBeat * pixelsPerBeat);

      // Show beat number
      ctx.fillText(beat.toString(), x, TIME_MARKER_HEIGHT / 2);
    }
  }, [visibleRegion]);

  /**
   * Renders the main grid with beat lines and pitch rows
   * Requirement 1.1: Display grid with horizontal axis representing time in beats
   *                  and vertical axis representing pitch from MIDI note 0 to 127
   * Requirement 40.5: Highlight piano row background when keyboard piano key is held
   */
  const renderGrid = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => {
    const {
      PITCH_LABEL_WIDTH,
      TIME_MARKER_HEIGHT,
      SCROLLBAR_WIDTH,
      SCROLLBAR_HEIGHT,
      GRID_BACKGROUND,
      BEAT_LINE_COLOR,
      MEASURE_LINE_COLOR,
      PITCH_ROW_COLOR,
      BLACK_KEY_COLOR,
      OCTAVE_LINE_COLOR,
      HIGHLIGHTED_PITCH_COLOR,
    } = CANVAS_CONFIG;

    const gridX = PITCH_LABEL_WIDTH;
    const gridY = TIME_MARKER_HEIGHT;
    const gridWidth = displayWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gridHeight = displayHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

    // Fill grid background
    ctx.fillStyle = GRID_BACKGROUND;
    ctx.fillRect(gridX, gridY, gridWidth, gridHeight);

    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;
    const pixelsPerBeat = gridWidth / visibleBeats;
    const pixelsPerSemitone = gridHeight / visibleSemitones;

    // Draw pitch rows (horizontal bands)
    for (let pitch = visibleRegion.startPitch; pitch < visibleRegion.endPitch; pitch++) {
      const relativePitch = pitch - visibleRegion.startPitch;
      // Y increases downward, pitch increases upward
      const y = gridY + gridHeight - ((relativePitch + 1) * pixelsPerSemitone);
      const rowHeight = pixelsPerSemitone;

      // Fill black key rows with darker color
      if (isBlackKey(pitch)) {
        ctx.fillStyle = BLACK_KEY_COLOR;
        ctx.fillRect(gridX, y, gridWidth, rowHeight);
      }

      // Highlight pitch rows where notes are currently playing (FL Studio style)
      if (playingPitches.has(pitch)) {
        ctx.fillStyle = HIGHLIGHTED_PITCH_COLOR;
        ctx.fillRect(gridX, y, gridWidth, rowHeight);
      }

      // Highlight keyboard piano active pitches (Requirement 40.5)
      // Support multiple simultaneous highlights for polyphony (Requirement 40.7)
      if (activePitches.has(pitch)) {
        ctx.fillStyle = HIGHLIGHTED_PITCH_COLOR;
        ctx.fillRect(gridX, y, gridWidth, rowHeight);
      }

      // Draw octave boundary lines (C notes)
      if (isOctaveBoundary(pitch)) {
        ctx.strokeStyle = OCTAVE_LINE_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gridX, y + rowHeight);
        ctx.lineTo(gridX + gridWidth, y + rowHeight);
        ctx.stroke();
      }
    }

    // Draw pitch row lines (horizontal)
    ctx.strokeStyle = PITCH_ROW_COLOR;
    ctx.lineWidth = 0.5;
    for (let pitch = visibleRegion.startPitch; pitch <= visibleRegion.endPitch; pitch++) {
      const relativePitch = pitch - visibleRegion.startPitch;
      const y = gridY + gridHeight - (relativePitch * pixelsPerSemitone);

      ctx.beginPath();
      ctx.moveTo(gridX, y);
      ctx.lineTo(gridX + gridWidth, y);
      ctx.stroke();
    }

    // Draw beat lines (vertical)
    for (let beat = Math.ceil(visibleRegion.startBeat); beat <= visibleRegion.endBeat; beat++) {
      const relativeBeat = beat - visibleRegion.startBeat;
      const x = gridX + (relativeBeat * pixelsPerBeat);

      // Use different color for measure lines (every 4 beats)
      if (beat % 4 === 0) {
        ctx.strokeStyle = MEASURE_LINE_COLOR;
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = BEAT_LINE_COLOR;
        ctx.lineWidth = 0.5;
      }

      ctx.beginPath();
      ctx.moveTo(x, gridY);
      ctx.lineTo(x, gridY + gridHeight);
      ctx.stroke();
    }
  }, [visibleRegion, activePitches, playingPitches]);

  /**
   * Calculates the rendering position and dimensions for a note
   *
   * Property 1: Note Rendering Position Calculation
   * - X position = start time × pixels per beat
   * - Y position = (127 - pitch) × pixels per semitone (adjusted for visible region)
   * - Width = duration × pixels per beat
   *
   * @param note The note to calculate position for
   * @param pixelsPerBeat Pixels per beat in the current view
   * @param pixelsPerSemitone Pixels per semitone in the current view
   * @param gridX X offset of the grid area
   * @param gridY Y offset of the grid area
   * @param gridHeight Height of the grid area
   * @returns Object with x, y, width, height or null if note is not visible
   */
  const calculateNotePosition = useCallback((
    note: Note,
    pixelsPerBeat: number,
    pixelsPerSemitone: number,
    gridX: number,
    gridY: number,
    gridHeight: number
  ): { x: number; y: number; width: number; height: number } | null => {
    // Check if note is within visible region
    const noteEndBeat = note.start + note.duration;

    // Skip notes outside visible beat range
    if (noteEndBeat < visibleRegion.startBeat || note.start > visibleRegion.endBeat) {
      return null;
    }

    // Skip notes outside visible pitch range
    if (note.pitch < visibleRegion.startPitch || note.pitch >= visibleRegion.endPitch) {
      return null;
    }

    // Calculate X position relative to visible region
    // X = (start - startBeat) × pixelsPerBeat + gridX
    const relativeStart = note.start - visibleRegion.startBeat;
    const x = gridX + relativeStart * pixelsPerBeat;

    // Calculate width based on duration
    // Width = duration × pixelsPerBeat
    const width = note.duration * pixelsPerBeat;

    // Calculate Y position
    // Y position uses (visibleRegion.endPitch - 1 - pitch) because:
    // - Higher pitches should appear higher on screen (lower Y value)
    // - We need to account for the visible region offset
    const relativePitch = note.pitch - visibleRegion.startPitch;
    // Y increases downward, pitch increases upward, so we invert
    // The note occupies the row from (relativePitch) to (relativePitch + 1)
    const y = gridY + gridHeight - ((relativePitch + 1) * pixelsPerSemitone);

    // Height is one semitone
    const height = pixelsPerSemitone;

    return { x, y, width, height };
  }, [visibleRegion]);

  /**
   * Renders notes as rectangular blocks on the canvas
   * Requirement 1.2: Render existing notes as rectangular blocks positioned
   *                  according to their pitch, start time, and duration
   *
   * Notes are rendered with:
   * - Fill color based on selection state
   * - Border for visual distinction
   * - Rounded corners for aesthetics
   */
  const renderNotes = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => {
    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT, NOTE_COLOR, NOTE_SELECTED_COLOR, NOTE_BORDER_COLOR, NOTE_SELECTED_BORDER_COLOR, NOTE_PLAYING_COLOR, NOTE_PLAYING_BORDER_COLOR } = CANVAS_CONFIG;

    const gridX = PITCH_LABEL_WIDTH;
    const gridY = TIME_MARKER_HEIGHT;
    const gridWidth = displayWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gridHeight = displayHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const visibleSemitones = visibleRegion.endPitch - visibleRegion.startPitch;
    const pixelsPerBeat = gridWidth / visibleBeats;
    const pixelsPerSemitone = gridHeight / visibleSemitones;

    // Render each note
    for (const note of notes) {
      const position = calculateNotePosition(
        note,
        pixelsPerBeat,
        pixelsPerSemitone,
        gridX,
        gridY,
        gridHeight
      );

      if (!position) continue;

      const { x, y, width, height } = position;
      const isSelected = selectedNoteIds.has(note.id);

      // Check if note is currently being played
      const isCurrentlyPlaying = isPlaying &&
        playheadPosition !== undefined &&
        playheadPosition >= note.start &&
        playheadPosition < note.start + note.duration;

      // Add small padding for visual clarity
      const padding = 1;
      const cornerRadius = 2;

      // Clip the note to the grid boundaries
      const clippedX = Math.max(x, gridX);
      const clippedWidth = Math.min(x + width, gridX + gridWidth) - clippedX;

      // Skip if note is completely outside the grid
      if (clippedWidth <= 0) continue;

      // Draw note fill with rounded corners (playing > selected > default)
      ctx.fillStyle = isCurrentlyPlaying
        ? NOTE_PLAYING_COLOR
        : isSelected
          ? NOTE_SELECTED_COLOR
          : NOTE_COLOR;
      ctx.beginPath();

      // Use roundRect if available, otherwise draw regular rect
      if (ctx.roundRect) {
        ctx.roundRect(
          clippedX + padding,
          y + padding,
          clippedWidth - padding * 2,
          height - padding * 2,
          cornerRadius
        );
      } else {
        ctx.rect(
          clippedX + padding,
          y + padding,
          clippedWidth - padding * 2,
          height - padding * 2
        );
      }
      ctx.fill();

      // Draw note border (playing > selected > default)
      ctx.strokeStyle = isCurrentlyPlaying
        ? NOTE_PLAYING_BORDER_COLOR
        : isSelected
          ? NOTE_SELECTED_BORDER_COLOR
          : NOTE_BORDER_COLOR;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [notes, selectedNoteIds, visibleRegion, calculateNotePosition, isPlaying, playheadPosition]);

  /**
   * Renders the playhead as a vertical line at the current playback position
   * Requirements 8.1, 8.2, 8.3: Display playhead at all times, move synchronized at 60fps,
   *                            retain position when playback stops
   *
   * The playhead is rendered on top of notes (after renderNotes in render order)
   * and spans the full height of the grid area.
   *
   * @param ctx Canvas 2D rendering context
   * @param displayWidth Width of the canvas in CSS pixels
   * @param displayHeight Height of the canvas in CSS pixels
   */
  const renderPlayhead = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => {
    // Don't render playhead if position is undefined
    if (playheadPosition === undefined) return;

    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, PLAYHEAD_COLOR, PLAYHEAD_WIDTH, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;

    const gridX = PITCH_LABEL_WIDTH;
    const gridY = TIME_MARKER_HEIGHT;
    const gridWidth = displayWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gridHeight = displayHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

    const visibleBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const pixelsPerBeat = gridWidth / visibleBeats;

    // Calculate playhead X position relative to visible region
    const relativeBeat = playheadPosition - visibleRegion.startBeat;
    const playheadX = gridX + (relativeBeat * pixelsPerBeat);

    // Only render if playhead is within visible region
    if (playheadX < gridX || playheadX > gridX + gridWidth) return;

    // Draw playhead line spanning full grid height
    ctx.strokeStyle = PLAYHEAD_COLOR;
    ctx.lineWidth = PLAYHEAD_WIDTH;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(playheadX, gridY);
    ctx.lineTo(playheadX, gridY + gridHeight);
    ctx.stroke();
  }, [playheadPosition, visibleRegion]);

  /**
   * Renders the scrollbars (horizontal and vertical) on the canvas
   * Requirements 34.1, 34.2, 34.6:
   * - Horizontal scrollbar at bottom for time navigation
   * - Vertical scrollbar on right for pitch navigation
   * - Thumb size proportional to visible region / total range
   *
   * Property 23: Scrollbar-Visible Region Synchronization
   * - Scrollbar position and thumb size are synchronized with visible region
   *
   * @param ctx Canvas 2D rendering context
   * @param displayWidth Width of the canvas in CSS pixels
   * @param displayHeight Height of the canvas in CSS pixels
   */
  const renderScrollbars = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => {
    const {
      PITCH_LABEL_WIDTH,
      TIME_MARKER_HEIGHT,
      SCROLLBAR_WIDTH,
      SCROLLBAR_HEIGHT,
      MIN_THUMB_SIZE,
      SCROLLBAR_TRACK_COLOR,
      SCROLLBAR_THUMB_COLOR,
      TOTAL_PITCH_RANGE,
    } = CANVAS_CONFIG;

    // Calculate scrollbar state from current visible region
    const scrollbarState = calculateScrollbarState(visibleRegion, effectiveTotalBeats, TOTAL_PITCH_RANGE);

    // === Horizontal Scrollbar (bottom) ===
    const hTrackX = PITCH_LABEL_WIDTH;
    const hTrackY = displayHeight - SCROLLBAR_HEIGHT;
    const hTrackWidth = displayWidth - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const hTrackHeight = SCROLLBAR_HEIGHT;

    // Draw horizontal scrollbar track
    ctx.fillStyle = SCROLLBAR_TRACK_COLOR;
    ctx.fillRect(hTrackX, hTrackY, hTrackWidth, hTrackHeight);

    // Calculate horizontal thumb dimensions
    const hThumbWidth = Math.max(MIN_THUMB_SIZE, hTrackWidth * scrollbarState.horizontalThumbSize);
    const hThumbMaxX = hTrackX + hTrackWidth - hThumbWidth;
    const hThumbX = hTrackX + (scrollbarState.horizontalPosition * (hTrackWidth - hThumbWidth));
    const hThumbY = hTrackY + 2;
    const hThumbHeight = hTrackHeight - 4;

    // Draw horizontal thumb with rounded corners
    ctx.fillStyle = SCROLLBAR_THUMB_COLOR;
    ctx.beginPath();
    const hCornerRadius = Math.min(3, hThumbHeight / 2);
    if (ctx.roundRect) {
      ctx.roundRect(
        Math.max(hTrackX, Math.min(hThumbMaxX, hThumbX)),
        hThumbY,
        hThumbWidth,
        hThumbHeight,
        hCornerRadius
      );
    } else {
      ctx.rect(
        Math.max(hTrackX, Math.min(hThumbMaxX, hThumbX)),
        hThumbY,
        hThumbWidth,
        hThumbHeight
      );
    }
    ctx.fill();

    // === Vertical Scrollbar (right) ===
    const vTrackX = displayWidth - SCROLLBAR_WIDTH;
    const vTrackY = TIME_MARKER_HEIGHT;
    const vTrackWidth = SCROLLBAR_WIDTH;
    const vTrackHeight = displayHeight - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;

    // Draw vertical scrollbar track
    ctx.fillStyle = SCROLLBAR_TRACK_COLOR;
    ctx.fillRect(vTrackX, vTrackY, vTrackWidth, vTrackHeight);

    // Calculate vertical thumb dimensions
    const vThumbHeight = Math.max(MIN_THUMB_SIZE, vTrackHeight * scrollbarState.verticalThumbSize);
    const vThumbMaxY = vTrackY + vTrackHeight - vThumbHeight;
    const vThumbX = vTrackX + 2;
    const vThumbY = vTrackY + (scrollbarState.verticalPosition * (vTrackHeight - vThumbHeight));
    const vThumbWidth = vTrackWidth - 4;

    // Draw vertical thumb with rounded corners
    ctx.fillStyle = SCROLLBAR_THUMB_COLOR;
    ctx.beginPath();
    const vCornerRadius = Math.min(3, vThumbWidth / 2);
    if (ctx.roundRect) {
      ctx.roundRect(
        vThumbX,
        Math.max(vTrackY, Math.min(vThumbMaxY, vThumbY)),
        vThumbWidth,
        vThumbHeight,
        vCornerRadius
      );
    } else {
      ctx.rect(
        vThumbX,
        Math.max(vTrackY, Math.min(vThumbMaxY, vThumbY)),
        vThumbWidth,
        vThumbHeight
      );
    }
    ctx.fill();

    // === Corner box (where scrollbars meet) ===
    ctx.fillStyle = SCROLLBAR_TRACK_COLOR;
    ctx.fillRect(displayWidth - SCROLLBAR_WIDTH, displayHeight - SCROLLBAR_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT);
  }, [visibleRegion, effectiveTotalBeats]);

  /**
   * Renders the marquee selection rectangle during drag
   * Requirements: 2.1, 2.6 - Display selection rectangle with semi-transparent fill and visible border
   *
   * @param ctx Canvas 2D rendering context
   * @param displayWidth Width of the canvas in CSS pixels
   * @param displayHeight Height of the canvas in CSS pixels
   */
  const renderMarquee = useCallback((
    ctx: CanvasRenderingContext2D,
    displayWidth: number,
    displayHeight: number
  ) => {
    if (!marqueeState) return;

    const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, SCROLLBAR_WIDTH, SCROLLBAR_HEIGHT } = CANVAS_CONFIG;

    // Calculate the rectangle coordinates
    // Clamp coordinates to grid boundaries
    const minX = Math.max(PITCH_LABEL_WIDTH, Math.min(marqueeState.startX, marqueeState.currentX));
    const maxX = Math.min(displayWidth - SCROLLBAR_WIDTH, Math.max(marqueeState.startX, marqueeState.currentX));
    const minY = Math.max(TIME_MARKER_HEIGHT, Math.min(marqueeState.startY, marqueeState.currentY));
    const maxY = Math.min(displayHeight - SCROLLBAR_HEIGHT, Math.max(marqueeState.startY, marqueeState.currentY));

    const width = maxX - minX;
    const height = maxY - minY;

    // Don't render if the rectangle is too small
    if (width < 1 || height < 1) return;

    // Draw semi-transparent fill
    // Requirements: 2.6 - Semi-transparent fill to distinguish from notes
    ctx.fillStyle = 'rgba(99, 102, 241, 0.2)'; // Light indigo with transparency
    ctx.fillRect(minX, minY, width, height);

    // Draw visible border
    // Requirements: 2.6 - Visible border to distinguish from notes
    ctx.strokeStyle = '#6366f1'; // Indigo border color
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]); // Dashed line for visual distinction
    ctx.strokeRect(minX + 0.5, minY + 0.5, width - 1, height - 1);
    ctx.setLineDash([]); // Reset line dash
  }, [marqueeState]);

  /**
   * Main render function that draws all canvas elements
   * Uses requestAnimationFrame for smooth 60fps updates
   */
  const render = useCallback(() => {
    const setup = setupCanvas();
    if (!setup) return;

    const { ctx, displayWidth, displayHeight } = setup;

    // Clear the entire canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Render layers in order (back to front)
    renderGrid(ctx, displayWidth, displayHeight);
    renderNotes(ctx, displayWidth, displayHeight);
    renderMarquee(ctx, displayWidth, displayHeight);
    renderPlayhead(ctx, displayWidth, displayHeight);
    renderPitchLabels(ctx, displayHeight);
    renderTimeMarkers(ctx, displayWidth);
    renderScrollbars(ctx, displayWidth, displayHeight);

    // Draw corner box where pitch labels and time markers meet
    ctx.fillStyle = CANVAS_CONFIG.GRID_BACKGROUND;
    ctx.fillRect(0, 0, CANVAS_CONFIG.PITCH_LABEL_WIDTH, CANVAS_CONFIG.TIME_MARKER_HEIGHT);
  }, [setupCanvas, renderGrid, renderNotes, renderMarquee, renderPlayhead, renderPitchLabels, renderTimeMarkers, renderScrollbars]);

  /**
   * Effect to handle canvas rendering and resize
   * Uses ResizeObserver for container size changes (e.g., layout changes, fullscreen toggle)
   *
   * Requirements 42.1-42.4: Dynamic Resize Handling
   * - 42.1: Uses ResizeObserver to detect container size changes
   * - 42.2: Re-renders the canvas to fit new container dimensions when size changes
   * - 42.3: Debounces resize events using requestAnimationFrame to prevent excessive redraws
   * - 42.4: Maintains visible region proportions by keeping the same visible region (same beats
   *         and pitches) while scaling the rendering to the new container size
   */
  useEffect(() => {
    const container = containerRef.current;

    // Initial render
    render();

    /**
     * Handle resize events with requestAnimationFrame debouncing
     * Requirement 42.3: Debounce resize events using requestAnimationFrame
     *
     * This handler:
     * 1. Cancels any pending animation frame to prevent stacking renders
     * 2. Schedules a new render on the next animation frame
     * 3. The render function uses setupCanvas() which gets new container dimensions
     * 4. The visible region is preserved, maintaining proportions (Requirement 42.4)
     */
    const handleResize = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(render);
    };

    window.addEventListener('resize', handleResize);

    /**
     * Use ResizeObserver for container size changes
     * Requirement 42.1: Use ResizeObserver to detect container size changes
     *
     * This is essential for detecting:
     * - Fullscreen toggle
     * - Sidebar collapse/expand
     * - Parent layout changes
     * - CSS-driven size changes that don't trigger window resize
     */
    let resizeObserver: ResizeObserver | null = null;
    if (container) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
    }

    // Cleanup function to remove event listeners and cancel pending frames
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  /**
   * Effect to handle scroll and zoom events
   * Attaches wheel and touch event listeners for smooth scrolling at 60fps
   * Requirements: 1.5, 1.6, 30.1, 30.2
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use passive: false to allow preventDefault() on wheel events
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  /**
   * Re-render when visible region, notes, playhead position, active pitches, or marquee change
   * Requirement 40.5: Update visual feedback when keyboard piano keys are pressed/released
   * Requirement 2.1: Update marquee rectangle display during drag
   */
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(render);
  }, [visibleRegion, notes, selectedNoteIds, playheadPosition, activePitches, playingPitches, marqueeState, render]);

  /**
   * Effect to handle drag events for horizontal note movement
   * Attaches global mouse move/up listeners while dragging
   * Requirements: 3.1, 3.4, 3.5
   * - Updates note position during drag
   * - Maintains 60fps via requestAnimationFrame (triggered by render effect)
   * - Supports cancel via Escape key
   */
  useEffect(() => {
    if (!dragState) return;

    // Add global listeners for mouse move/up to handle drag outside canvas
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragState, handleMouseMove, handleMouseUp, handleKeyDown]);

  /**
   * Effect to handle scrollbar drag events
   * Attaches global mouse move/up listeners while dragging scrollbar
   * Requirements: 34.3, 34.4, 34.5
   * - Updates visible region during scrollbar drag
   * - Handles mouse release to complete drag
   */
  useEffect(() => {
    if (!scrollbarDragState) return;

    // Add global listeners for mouse move/up to handle drag outside canvas
    window.addEventListener('mousemove', handleScrollbarDrag);
    window.addEventListener('mouseup', handleScrollbarDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleScrollbarDrag);
      window.removeEventListener('mouseup', handleScrollbarDragEnd);
    };
  }, [scrollbarDragState, handleScrollbarDrag, handleScrollbarDragEnd]);

  /**
   * Effect to handle marquee selection events
   * Attaches global mouse move/up/keydown listeners while marquee is active
   * Requirements: 2.1, 2.3, 2.4, 2.5
   * - Updates marquee rectangle during drag
   * - Calculates intersecting notes for preview
   * - Finalizes selection on mouse up
   * - Cancels and restores selection on Escape key
   */
  useEffect(() => {
    if (!marqueeState) return;

    // Add global listeners for mouse move/up/keydown to handle marquee operations
    window.addEventListener('mousemove', handleMarqueeMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMarqueeMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [marqueeState, handleMarqueeMove, handleMouseUp, handleKeyDown]);

  /**
   * Effect to handle Delete/Backspace key for note deletion when canvas is focused
   * Requirements: 6.1 - Handle Delete/Backspace key on selected notes
   *
   * This effect runs when there are selected notes and a deletion callback,
   * allowing users to delete notes by pressing Delete or Backspace keys
   */
  useEffect(() => {
    // Only add keyboard listener when there are selected notes and delete callback
    if (selectedNoteIds.size === 0 || !onNoteDelete) return;
    // Don't add duplicate listener when dragging (drag already has keydown listener)
    if (dragState) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNoteIds, onNoteDelete, handleKeyDown, dragState]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[400px] ${className}`}
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        aria-label="Piano roll editor grid"
        role="img"
        tabIndex={0}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onContextMenu={handleContextMenu}
        style={{
          cursor: dragState
            ? (dragState.mode === 'resize' ? 'ew-resize' : 'move')
            : marqueeState
              ? 'crosshair'
              : scrollbarDragState
                ? 'grabbing'
                : isOverScrollbar
                  ? 'grab'
                  : isOverTimeline
                    ? 'pointer'
                    : isOverResizeHandle
                      ? 'ew-resize'
                      : 'default'
        }}
      />
    </div>
  );
}

export default PianoRollCanvas;
