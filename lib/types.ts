/**
 * Type re-exports from the central types directory.
 *
 * This file provides a convenient way to import types from within
 * the lib directory. All core type definitions are maintained in
 * the types/ directory for better organization.
 *
 * Requirements: 1.1, 1.2, 9.1, 11.1-11.4, 36.1-36.4, 37.1
 */

// Core data types
export type { Note } from '@/types/note';
export type { Melody, MelodySummary } from '@/types/melody';

// Synthesizer types
export type {
  SynthesizerConfig,
  OscillatorType,
  ADSREnvelope,
  FilterConfig,
  FilterType,
  EffectsConfig,
  ReverbConfig,
  DelayConfig,
  ChorusConfig,
  FlangerConfig,
  PresetCategory,
  PresetName,
  SynthPreset,
  ParameterRange,
} from '@/types/synth';

// Export effect ranges for validation
export {
  REVERB_RANGES,
  DELAY_RANGES,
  CHORUS_RANGES,
  FLANGER_RANGES,
  DEFAULT_REVERB_CONFIG,
  DEFAULT_DELAY_CONFIG,
  DEFAULT_CHORUS_CONFIG,
  DEFAULT_FLANGER_CONFIG,
  DEFAULT_EFFECTS_CONFIG,
} from '@/types/synth';

// Grid and editor types
export type {
  GridSnapConfig,
  GridDivision,
  VisibleRegion,
  ScrollbarState,
  KeyboardAction,
} from '@/types/grid';
