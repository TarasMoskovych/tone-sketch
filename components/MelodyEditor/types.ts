import type { Note, SynthesizerConfig } from '@/types';

/**
 * State snapshot emitted via onStateChange.
 */
export interface EditorState {
  notes: Note[];
  synthConfig: SynthesizerConfig;
  tempo: number;
}

/**
 * Function type for MIDI import.
 * Replaces all existing notes with the imported notes and optionally updates tempo.
 */
export type LoadNotesFn = (notes: Note[], tempo?: number) => void;

/**
 * Props for the MelodyEditor component.
 */
export interface MelodyEditorProps {
  /** Pre-existing notes to load on mount. Defaults to []. */
  initialNotes?: Note[];

  /** Pre-existing synth config to load on mount. Defaults to DEFAULT_SYNTH_CONFIG. */
  initialSynthConfig?: SynthesizerConfig;

  /** Starting tempo in BPM (20-300). Defaults to 120. */
  initialTempo?: number;

  /** When true, disables note CRUD, clear-all, synth changes, MIDI import.
   *  Playback, grid snap, and fullscreen remain functional. */
  readOnly?: boolean;

  /** React node rendered in the header area (e.g., save button, title). */
  headerSlot?: React.ReactNode;

  /** Whether MIDI import is allowed. Defaults to true.
   *  When false, loadNotes calls from onMidiImport are ignored. */
  allowMidiImport?: boolean;

  /** Fired whenever notes, synthConfig, or tempo change. */
  onStateChange?: (state: EditorState) => void;

  /** Fired with true when state is modified after initialization/last reset. */
  onDirtyStateChange?: (isDirty: boolean) => void;

  /** Provides the loadNotes function to the parent for MIDI import wiring. */
  onMidiImport?: (loadNotes: LoadNotesFn) => void;
}
