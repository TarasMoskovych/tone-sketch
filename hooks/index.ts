// hooks/index.ts - barrel export for custom hooks

// Piano roll state management
export { usePianoRoll, snapToGrid, quantizeToFreeResolution, snapPosition, getMinimumDuration, enforceMinimumDuration } from './usePianoRoll';
export type { UsePianoRollReturn } from './usePianoRoll';

// Synthesizer configuration and presets
export { useSynthesizer, DEFAULT_SYNTH_CONFIG, DEFAULT_EFFECTS_CONFIG } from './useSynthesizer';
export type { UseSynthesizerReturn, UseSynthesizerProps } from './useSynthesizer';

// Playback state and transport controls
export { usePlayback } from './usePlayback';
export type { UsePlaybackReturn, UsePlaybackProps } from './usePlayback';

// Melody persistence (save/load/delete via API)
export { useMelodyPersistence } from './useMelodyPersistence';
export type { UseMelodyPersistenceReturn, MelodyData } from './useMelodyPersistence';

// MIDI file import and export
export { useMidiImportExport } from './useMidiImportExport';
export type { UseMidiImportExportReturn } from './useMidiImportExport';

// Ownership management (localStorage owner_id)
export { useOwnership } from './useOwnership';
export type { UseOwnershipReturn } from './useOwnership';

// Feed melody preview playback
export { useFeedPreview } from './useFeedPreview';
export type { UseFeedPreviewReturn } from './useFeedPreview';

// Keyboard shortcuts handling
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export type { UseKeyboardShortcutsProps } from './useKeyboardShortcuts';

// Keyboard piano playing
export { useKeyboardPiano, KEYBOARD_PIANO_MAPPING } from './useKeyboardPiano';
export type { UseKeyboardPianoProps, UseKeyboardPianoReturn } from './useKeyboardPiano';
