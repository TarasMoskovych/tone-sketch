import type { VisibleRegion, GridSnapConfig } from '@/types/grid';
import type { Note } from '@/types/note';

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
   * Callback for copy operation (Ctrl+C/Cmd+C)
   * Requirements: 1.1, 6.1, 6.3, 6.4 - Copy selected notes to clipboard
   */
  onCopy?: () => void;
  /**
   * Callback for cut operation (Ctrl+X/Cmd+X)
   * Requirements: 2.1, 6.1, 6.3, 6.4 - Cut selected notes
   */
  onCut?: () => void;
  /**
   * Callback for paste operation (Ctrl+V/Cmd+V)
   * Requirements: 3.1, 6.1, 6.3, 6.4 - Paste notes at playhead
   */
  onPaste?: () => void;
  /**
   * Callback for duplicate operation (Ctrl+D/Cmd+D)
   * Requirements: 4.1, 6.1, 6.3, 6.4 - Duplicate selected notes
   */
  onDuplicate?: () => void;
  /**
   * Callback for undo operation (Ctrl+Z/Cmd+Z)
   * Requirements: 6.1, 6.5 - Undo last action
   */
  onUndo?: () => void;
  /**
   * Callback for redo operation (Ctrl+Shift+Z/Cmd+Shift+Z or Ctrl+Y/Cmd+Y)
   * Requirements: 6.2, 6.5 - Redo last undone action
   */
  onRedo?: () => void;
  /**
   * Callback when a note drag/resize operation begins.
   * Used to suppress undo recording during intermediate updates.
   * Requirements: 1.3, 1.4, 1.5, 1.8 - Only record final commit, not intermediate drag states
   */
  onDragStart?: () => void;
  /**
   * Callback when a note drag/resize operation commits (mouse-up).
   * Provides original and final note states for undo recording.
   * For single note operations: originalNotes has 1 entry.
   * For group drag operations: originalNotes has all affected notes.
   * Requirements: 1.3, 1.4, 1.5, 1.8 - Record final before/after snapshot on commit
   */
  onDragEnd?: (originalNotes: Map<string, Note>, updatedNotes: Map<string, Note>) => void;
  /**
   * Callback when a note drag/resize operation is cancelled (Escape key).
   * Used to clear the drag suppression flag without recording an action.
   * Requirements: 1.8 - No recording for cancelled operations
   */
  onDragCancel?: () => void;
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
 * State for tracking note dragging (horizontal and vertical) and resize
 * Requirements: 3.1, 3.3, 3.5 (horizontal), 4.1, 4.2, 4.3, 4.4 (vertical), 5.1, 5.2, 5.3, 5.4, 5.5 (resize)
 */
export interface DragState {
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
export interface ScrollbarDragState {
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
export interface MarqueeState {
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
