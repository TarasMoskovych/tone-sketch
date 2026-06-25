/**
 * PianoRoll Module - Barrel Export
 *
 * Provides the public API for the PianoRoll module.
 * Requirements: 1.2, 2.5, 3.6 - Module organization and export structure
 *
 * Usage:
 * - import { PianoRollCanvas, CANVAS_CONFIG } from '@/components/PianoRoll'
 * - import type { PianoRollCanvasProps, SelectionModifiers } from '@/components/PianoRoll'
 */

// Main component
export { PianoRollCanvas, default } from './PianoRollCanvas';

// Constants (public API)
export { CANVAS_CONFIG } from './constants';

// Types (public API)
export type { PianoRollCanvasProps, SelectionModifiers } from './types';

// Utility functions (public API for testing)
export { calculateScrollbarState } from './coordinate-utils';
