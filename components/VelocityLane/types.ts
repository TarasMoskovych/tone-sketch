import type { Note } from '@/types/note';
import type { VisibleRegion } from '@/types/grid';

/**
 * Props for the VelocityLaneCanvas component.
 * Requirements: 7.1, 7.2 - Dedicated component with clean interface
 */
export interface VelocityLaneCanvasProps {
  /** Notes to render velocity bars for */
  notes: Note[];
  /** IDs of currently selected notes */
  selectedNoteIds: Set<string>;
  /** Current visible region (shared with PianoRoll) */
  visibleRegion: VisibleRegion;
  /** Current playhead position in beats */
  playheadPosition?: number;
  /** Callback when a note's velocity is updated */
  onNoteUpdate?: (note: Note) => void;
  /** Callback for batch velocity updates (multi-note) */
  onBulkNoteUpdate?: (updates: Map<string, Partial<Note>>) => void;
  /** Callback when visible region changes (horizontal scroll) */
  onVisibleRegionChange?: (region: VisibleRegion) => void;
  /** Callback to select a single note (replaces selection) */
  onNoteSelect?: (noteId: string) => void;
  /** Callback to toggle a note in the selection */
  onToggleNoteSelection?: (noteId: string) => void;
  /** Callback to deselect all */
  onDeselectAll?: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * State for tracking velocity bar drag operations.
 * Requirements: 4.1, 5.1 - Single and multi-note velocity editing
 */
export interface VelocityDragState {
  /** The note whose bar is being dragged */
  noteId: string;
  /** Original velocity of the dragged note at drag start */
  originalVelocity: number;
  /** Original velocities of all affected notes (for multi-note) */
  originalVelocities: Map<string, number>;
  /** Whether this is a multi-note drag */
  isMultiNote: boolean;
}

/**
 * Dimensions for rendering within the velocity lane canvas.
 * Requirements: 9.1, 9.5 - Canvas layout with scale indicator
 */
export interface VelocityRenderDimensions {
  /** Total display width in CSS pixels */
  displayWidth: number;
  /** Total display height in CSS pixels */
  displayHeight: number;
  /** X position where the grid area starts (after scale indicator) */
  gridX: number;
  /** Y position where the grid area starts (top of lane) */
  gridY: number;
  /** Width of the grid area */
  gridWidth: number;
  /** Height of the grid area (full lane height) */
  gridHeight: number;
}
