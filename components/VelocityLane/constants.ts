/**
 * Configuration constants for the velocity lane canvas.
 * Requirements: 7.2, 9.4, 9.5 - Constants for rendering and layout
 */
export const VELOCITY_LANE_CONFIG = {
  /** Width of the scale indicator on the left */
  SCALE_INDICATOR_WIDTH: 40,
  /** Background color for the lane */
  LANE_BACKGROUND: '#1a1a2e',
  /** Color for unselected velocity bars */
  BAR_COLOR: '#9333ea',
  /** Color for selected velocity bars */
  BAR_SELECTED_COLOR: '#a855f7',
  /** Color for the baseline */
  BASELINE_COLOR: '#4a4a6a',
  /** Color for beat grid lines */
  BEAT_LINE_COLOR: '#2d2d44',
  /** Color for measure lines (every 4 beats) */
  MEASURE_LINE_COLOR: '#3d3d5c',
  /** Scale indicator text color */
  SCALE_TEXT_COLOR: '#8888aa',
  /** Playhead color (matches PianoRoll) */
  PLAYHEAD_COLOR: '#FF0000',
  /** Playhead line width */
  PLAYHEAD_WIDTH: 2,
  /** Minimum bar width in pixels for clickability */
  MIN_BAR_WIDTH: 3,
};
