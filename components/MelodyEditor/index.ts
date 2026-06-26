/**
 * MelodyEditor Module - Barrel Export
 *
 * Provides the public API for the MelodyEditor module.
 * Requirements: 1.1 - Module organization and export structure
 *
 * Usage:
 * - import { MelodyEditor } from '@/components/MelodyEditor'
 * - import type { MelodyEditorProps, EditorState, LoadNotesFn } from '@/components/MelodyEditor'
 */

// Main component
export { MelodyEditor } from './MelodyEditor';

// Types (public API)
export type { MelodyEditorProps, EditorState, LoadNotesFn } from './types';
