/**
 * Grid division values representing beat fractions.
 * 1 = whole beat, 0.5 = half beat, 0.25 = quarter beat, etc.
 */
export type GridDivision = 1 | 0.5 | 0.25 | 0.125 | 0.0625;

/**
 * Grid snap configuration for note quantization.
 */
export interface GridSnapConfig {
  /** Whether grid snapping is enabled */
  enabled: boolean;
  /** Current grid division for snapping */
  division: GridDivision;
}

/**
 * Defines the currently visible region of the piano roll.
 * Used for viewport management and rendering optimization.
 */
export interface VisibleRegion {
  /** Start beat of the visible horizontal range */
  startBeat: number;
  /** End beat of the visible horizontal range */
  endBeat: number;
  /** Start MIDI note number of the visible vertical range */
  startPitch: number;
  /** End MIDI note number of the visible vertical range */
  endPitch: number;
}

/**
 * State for piano roll scrollbars.
 * All values are normalized to 0-1 range.
 */
export interface ScrollbarState {
  /** Horizontal scrollbar position (0-1 normalized) */
  horizontalPosition: number;
  /** Vertical scrollbar position (0-1 normalized) */
  verticalPosition: number;
  /** Horizontal thumb size as proportion of visible area (0-1) */
  horizontalThumbSize: number;
  /** Vertical thumb size as proportion of visible area (0-1) */
  verticalThumbSize: number;
}

/**
 * Available keyboard shortcut actions for the piano roll.
 * Used to handle keyboard shortcuts within the editor.
 */
export type KeyboardAction = 'togglePlayback' | 'delete';
