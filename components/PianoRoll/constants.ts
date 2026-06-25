import type { VisibleRegion, GridSnapConfig } from '@/types/grid';

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
  SCROLLBAR_THUMB_COLOR: '#64748b',
  /** Scrollbar thumb hover color */
  SCROLLBAR_THUMB_HOVER_COLOR: '#94a3b8',
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
  NOTE_BORDER_COLOR: '#818cf8',
  /** Color for selected note border */
  NOTE_SELECTED_BORDER_COLOR: '#a5b4fc',
  /** Color for the playhead line - bright red for high contrast visibility */
  PLAYHEAD_COLOR: '#FF0000',
  /** Width of the playhead line in pixels */
  PLAYHEAD_WIDTH: 2,
  /** Color for notes currently being played */
  NOTE_PLAYING_COLOR: '#818cf8',
  /** Color for playing note border */
  NOTE_PLAYING_BORDER_COLOR: '#a5b4fc',
  /** Color for highlighted pitch rows (keyboard piano and playing notes) */
  HIGHLIGHTED_PITCH_COLOR: 'rgba(99, 102, 241, 0.3)',
};

/**
 * Default grid snap configuration
 */
export const DEFAULT_GRID_SNAP_CONFIG: GridSnapConfig = {
  enabled: true,
  division: 0.25, // 1/4 beat default
};

/**
 * Default visible region: 16 beats × 24 semitones centered around middle C
 */
export const DEFAULT_VISIBLE_REGION: VisibleRegion = {
  startBeat: 0,
  endBeat: CANVAS_CONFIG.DEFAULT_VISIBLE_BEATS,
  startPitch: 48, // C3
  endPitch: 48 + CANVAS_CONFIG.DEFAULT_VISIBLE_SEMITONES, // C5
};

/**
 * Width of the resize handle zone at the right edge of a note (in pixels)
 */
export const RESIZE_HANDLE_WIDTH = 8;
