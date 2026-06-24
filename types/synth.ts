/**
 * Available oscillator waveform types for sound generation.
 */
export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

/**
 * ADSR (Attack, Decay, Sustain, Release) envelope parameters.
 * Controls how a sound evolves over time.
 */
export interface ADSREnvelope {
  /** Attack time in seconds (0-2) */
  attack: number;
  /** Decay time in seconds (0-2) */
  decay: number;
  /** Sustain level (0-1) */
  sustain: number;
  /** Release time in seconds (0-5) */
  release: number;
}

/**
 * Available filter types for frequency shaping.
 */
export type FilterType = 'lowpass' | 'highpass';

/**
 * Filter configuration for frequency shaping.
 */
export interface FilterConfig {
  /** Whether the filter is active */
  enabled: boolean;
  /** Filter type: lowpass or highpass */
  type: FilterType;
  /** Cutoff frequency in Hz (20-20000) */
  frequency: number;
}

/**
 * Reverb effect configuration.
 */
export interface ReverbConfig {
  /** Whether the reverb effect is active */
  enabled: boolean;
  /** Room size (0-1), default 0.5 */
  roomSize: number;
  /** Wet/dry mix (0-1), default 0.3 */
  wetDry: number;
}

/**
 * Delay effect configuration.
 */
export interface DelayConfig {
  /** Whether the delay effect is active */
  enabled: boolean;
  /** Delay time in seconds (0-1), default 0.25 */
  time: number;
  /** Feedback amount (0-0.9), default 0.3 */
  feedback: number;
  /** Wet/dry mix (0-1), default 0.3 */
  wetDry: number;
}

/**
 * Chorus effect configuration.
 */
export interface ChorusConfig {
  /** Whether the chorus effect is active */
  enabled: boolean;
  /** Rate in Hz (0.1-10), default 1.5 */
  rate: number;
  /** Depth (0-1), default 0.5 */
  depth: number;
  /** Wet/dry mix (0-1), default 0.3 */
  wetDry: number;
}

/**
 * Flanger effect configuration.
 */
export interface FlangerConfig {
  /** Whether the flanger effect is active */
  enabled: boolean;
  /** Rate in Hz (0.1-10), default 0.5 */
  rate: number;
  /** Depth (0-1), default 0.5 */
  depth: number;
  /** Feedback amount (0-0.9), default 0.5 */
  feedback: number;
  /** Wet/dry mix (0-1), default 0.3 */
  wetDry: number;
}

/**
 * Complete effects configuration.
 */
export interface EffectsConfig {
  reverb: ReverbConfig;
  delay: DelayConfig;
  chorus: ChorusConfig;
  flanger: FlangerConfig;
}

// =============================================================================
// Effects Parameter Ranges and Defaults
// =============================================================================

/**
 * Parameter range definition with min, max, and default values.
 */
export interface ParameterRange {
  min: number;
  max: number;
  default: number;
}

/**
 * Reverb effect parameter ranges.
 * Validates: Requirements 36.1
 */
export const REVERB_RANGES = {
  roomSize: { min: 0, max: 1, default: 0.5 } as ParameterRange,
  wetDry: { min: 0, max: 1, default: 0.3 } as ParameterRange,
} as const;

/**
 * Delay effect parameter ranges.
 * Validates: Requirements 36.2
 */
export const DELAY_RANGES = {
  time: { min: 0, max: 1, default: 0.25 } as ParameterRange,
  feedback: { min: 0, max: 0.9, default: 0.3 } as ParameterRange,
  wetDry: { min: 0, max: 1, default: 0.3 } as ParameterRange,
} as const;

/**
 * Chorus effect parameter ranges.
 * Validates: Requirements 36.3
 */
export const CHORUS_RANGES = {
  rate: { min: 0.1, max: 10, default: 1.5 } as ParameterRange,
  depth: { min: 0, max: 1, default: 0.5 } as ParameterRange,
  wetDry: { min: 0, max: 1, default: 0.3 } as ParameterRange,
} as const;

/**
 * Flanger effect parameter ranges.
 * Validates: Requirements 36.4
 */
export const FLANGER_RANGES = {
  rate: { min: 0.1, max: 10, default: 0.5 } as ParameterRange,
  depth: { min: 0, max: 1, default: 0.5 } as ParameterRange,
  feedback: { min: 0, max: 0.9, default: 0.5 } as ParameterRange,
  wetDry: { min: 0, max: 1, default: 0.3 } as ParameterRange,
} as const;

/**
 * Default reverb configuration with effect disabled.
 */
export const DEFAULT_REVERB_CONFIG: ReverbConfig = {
  enabled: false,
  roomSize: REVERB_RANGES.roomSize.default,
  wetDry: REVERB_RANGES.wetDry.default,
};

/**
 * Default delay configuration with effect disabled.
 */
export const DEFAULT_DELAY_CONFIG: DelayConfig = {
  enabled: false,
  time: DELAY_RANGES.time.default,
  feedback: DELAY_RANGES.feedback.default,
  wetDry: DELAY_RANGES.wetDry.default,
};

/**
 * Default chorus configuration with effect disabled.
 */
export const DEFAULT_CHORUS_CONFIG: ChorusConfig = {
  enabled: false,
  rate: CHORUS_RANGES.rate.default,
  depth: CHORUS_RANGES.depth.default,
  wetDry: CHORUS_RANGES.wetDry.default,
};

/**
 * Default flanger configuration with effect disabled.
 */
export const DEFAULT_FLANGER_CONFIG: FlangerConfig = {
  enabled: false,
  rate: FLANGER_RANGES.rate.default,
  depth: FLANGER_RANGES.depth.default,
  feedback: FLANGER_RANGES.feedback.default,
  wetDry: FLANGER_RANGES.wetDry.default,
};

/**
 * Default effects configuration with all effects disabled.
 * Per Requirement 36.5: all effects disabled by default.
 */
export const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  reverb: DEFAULT_REVERB_CONFIG,
  delay: DEFAULT_DELAY_CONFIG,
  chorus: DEFAULT_CHORUS_CONFIG,
  flanger: DEFAULT_FLANGER_CONFIG,
};

// =============================================================================
// Preset Types
// =============================================================================
export type PresetCategory = 'Piano' | 'Lead' | 'Pluck' | 'Guitar' | 'Bass' | 'Strings' | 'Pads';

/**
 * Available preset names across all categories.
 */
export type PresetName =
  // Piano (5)
  | 'Acoustic Piano'
  | 'Electric Piano'
  | 'Soft Piano'
  | 'Bright Piano'
  | 'Warm Piano'
  // Lead (5)
  | 'Classic Lead'
  | 'Saw Lead'
  | 'Square Lead'
  | 'Sine Lead'
  | 'Detuned Lead'
  // Pluck (5)
  | 'Short Pluck'
  | 'Soft Pluck'
  | 'Bright Pluck'
  | 'Bell Pluck'
  | 'Muted Pluck'
  // Guitar (5)
  | 'Clean Guitar'
  | 'Muted Guitar'
  | 'Acoustic Guitar'
  | 'Nylon Guitar'
  | 'Steel Guitar'
  // Bass (5)
  | 'Sub Bass'
  | 'Synth Bass'
  | 'Punchy Bass'
  | 'Warm Bass'
  | 'Growl Bass'
  // Strings (5)
  | 'Violin'
  | 'Cello'
  | 'String Ensemble'
  | 'Solo Strings'
  | 'Pizzicato'
  // Pads (5)
  | 'Warm Pad'
  | 'Ambient Pad'
  | 'Choir Pad'
  | 'Sweep Pad'
  | 'Dark Pad';

/**
 * Synthesizer preset definition.
 */
export interface SynthPreset {
  name: PresetName;
  category: PresetCategory;
  config: Omit<SynthesizerConfig, 'presetName'>;
}

/**
 * Complete synthesizer configuration.
 * Defines all audio parameters for melody playback.
 */
export interface SynthesizerConfig {
  /** Waveform type for the oscillator */
  oscillatorType: OscillatorType;
  /** Master volume level (0-1) */
  volume: number;
  /** ADSR envelope settings */
  envelope: ADSREnvelope;
  /** Filter settings */
  filter: FilterConfig;
  /** Effects configuration */
  effects: EffectsConfig;
  /** Currently applied preset name, null if custom settings */
  presetName: PresetName | null;
}
