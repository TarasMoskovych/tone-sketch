'use client';

import { useState, useCallback, useMemo } from 'react';
import type {
  SynthesizerConfig,
  EffectsConfig,
  PresetName,
  ReverbConfig,
  DelayConfig,
  ChorusConfig,
  FlangerConfig,
} from '@/types/synth';
import { ALL_PRESETS } from '@/lib/presets';

/**
 * Default effects configuration with all effects disabled.
 */
export const DEFAULT_EFFECTS_CONFIG: EffectsConfig = {
  reverb: {
    enabled: false,
    roomSize: 0.5,
    wetDry: 0.3,
  },
  delay: {
    enabled: false,
    time: 0.25,
    feedback: 0.3,
    wetDry: 0.3,
  },
  chorus: {
    enabled: false,
    rate: 1.5,
    depth: 0.5,
    wetDry: 0.3,
  },
  flanger: {
    enabled: false,
    rate: 0.5,
    depth: 0.5,
    feedback: 0.5,
    wetDry: 0.3,
  },
};

/**
 * Default synthesizer configuration.
 * Requirements: 9.1, 10.1, 11.1-11.4, 12.1-12.2
 */
export const DEFAULT_SYNTH_CONFIG: SynthesizerConfig = {
  oscillatorType: 'sine',
  volume: 0.8,
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.5,
    release: 0.5,
  },
  filter: {
    enabled: false,
    type: 'lowpass',
    frequency: 1000,
  },
  effects: DEFAULT_EFFECTS_CONFIG,
  presetName: null,
};

/**
 * Clamp a value to a specified range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp reverb configuration values to valid ranges.
 * Property 25: Effect Parameter Validation
 */
function clampReverbConfig(config: Partial<ReverbConfig>): Partial<ReverbConfig> {
  const result: Partial<ReverbConfig> = { ...config };
  if (config.roomSize !== undefined) {
    result.roomSize = clamp(config.roomSize, 0, 1);
  }
  if (config.wetDry !== undefined) {
    result.wetDry = clamp(config.wetDry, 0, 1);
  }
  return result;
}

/**
 * Clamp delay configuration values to valid ranges.
 * Property 25: Effect Parameter Validation
 */
function clampDelayConfig(config: Partial<DelayConfig>): Partial<DelayConfig> {
  const result: Partial<DelayConfig> = { ...config };
  if (config.time !== undefined) {
    result.time = clamp(config.time, 0, 1);
  }
  if (config.feedback !== undefined) {
    result.feedback = clamp(config.feedback, 0, 0.9);
  }
  if (config.wetDry !== undefined) {
    result.wetDry = clamp(config.wetDry, 0, 1);
  }
  return result;
}

/**
 * Clamp chorus configuration values to valid ranges.
 * Property 25: Effect Parameter Validation
 */
function clampChorusConfig(config: Partial<ChorusConfig>): Partial<ChorusConfig> {
  const result: Partial<ChorusConfig> = { ...config };
  if (config.rate !== undefined) {
    result.rate = clamp(config.rate, 0.1, 10);
  }
  if (config.depth !== undefined) {
    result.depth = clamp(config.depth, 0, 1);
  }
  if (config.wetDry !== undefined) {
    result.wetDry = clamp(config.wetDry, 0, 1);
  }
  return result;
}

/**
 * Clamp flanger configuration values to valid ranges.
 * Property 25: Effect Parameter Validation
 */
function clampFlangerConfig(config: Partial<FlangerConfig>): Partial<FlangerConfig> {
  const result: Partial<FlangerConfig> = { ...config };
  if (config.rate !== undefined) {
    result.rate = clamp(config.rate, 0.1, 10);
  }
  if (config.depth !== undefined) {
    result.depth = clamp(config.depth, 0, 1);
  }
  if (config.feedback !== undefined) {
    result.feedback = clamp(config.feedback, 0, 0.9);
  }
  if (config.wetDry !== undefined) {
    result.wetDry = clamp(config.wetDry, 0, 1);
  }
  return result;
}

/**
 * Return type for the useSynthesizer hook.
 */
export interface UseSynthesizerReturn {
  /** Current synthesizer configuration */
  config: SynthesizerConfig;
  /** Update synthesizer configuration with partial updates */
  updateConfig: (updates: Partial<SynthesizerConfig>) => void;
  /** Apply a preset configuration */
  applyPreset: (presetName: PresetName) => void;
  /** Update effects configuration with partial updates */
  updateEffects: (effects: Partial<EffectsConfig>) => void;
  /** Reset to default configuration */
  resetToDefaults: () => void;
  /** Load a complete configuration (e.g., from saved melody) */
  loadConfig: (config: SynthesizerConfig) => void;
}

/**
 * Props for the useSynthesizer hook.
 */
export interface UseSynthesizerProps {
  /** Initial configuration to use */
  initialConfig?: Partial<SynthesizerConfig>;
  /** Callback when configuration changes */
  onChange?: (config: SynthesizerConfig) => void;
}

/**
 * Custom hook for managing synthesizer configuration, presets, and effects.
 *
 * Extracts synthesizer config state including oscillator, volume, ADSR, filter.
 * Adds effects configuration management (reverb, delay, chorus, flanger).
 * Adds preset selection and application logic.
 *
 * Requirements: 38.2, 38.4, 36.1, 36.2, 36.3, 36.4, 37.1, 37.7
 *
 * @param props - Optional initial configuration and change callback
 * @returns Synthesizer state and handler functions
 */
export function useSynthesizer(props?: UseSynthesizerProps): UseSynthesizerReturn {
  const { initialConfig, onChange } = props ?? {};

  // Merge initial config with defaults
  const mergedInitialConfig = useMemo<SynthesizerConfig>(() => {
    if (!initialConfig) return DEFAULT_SYNTH_CONFIG;
    return {
      ...DEFAULT_SYNTH_CONFIG,
      ...initialConfig,
      envelope: {
        ...DEFAULT_SYNTH_CONFIG.envelope,
        ...initialConfig.envelope,
      },
      filter: {
        ...DEFAULT_SYNTH_CONFIG.filter,
        ...initialConfig.filter,
      },
      effects: {
        reverb: {
          ...DEFAULT_SYNTH_CONFIG.effects.reverb,
          ...initialConfig.effects?.reverb,
        },
        delay: {
          ...DEFAULT_SYNTH_CONFIG.effects.delay,
          ...initialConfig.effects?.delay,
        },
        chorus: {
          ...DEFAULT_SYNTH_CONFIG.effects.chorus,
          ...initialConfig.effects?.chorus,
        },
        flanger: {
          ...DEFAULT_SYNTH_CONFIG.effects.flanger,
          ...initialConfig.effects?.flanger,
        },
      },
    };
  }, [initialConfig]);

  const [config, setConfig] = useState<SynthesizerConfig>(mergedInitialConfig);

  /**
   * Update the configuration and notify listeners.
   * Clears presetName when config is manually changed.
   * Requirements: 37.8 - Clear presetName when parameters are manually adjusted
   */
  const updateConfig = useCallback(
    (updates: Partial<SynthesizerConfig>) => {
      setConfig((prev) => {
        // Build new config by merging updates
        const newConfig: SynthesizerConfig = {
          ...prev,
          // Clear preset name when manually adjusting parameters
          presetName: null,
        };

        // Apply oscillator type if provided
        if (updates.oscillatorType !== undefined) {
          newConfig.oscillatorType = updates.oscillatorType;
        }

        // Apply volume if provided (clamped to 0-1)
        if (updates.volume !== undefined) {
          newConfig.volume = clamp(updates.volume, 0, 1);
        }

        // Apply envelope updates if provided
        if (updates.envelope !== undefined) {
          newConfig.envelope = {
            ...prev.envelope,
            ...updates.envelope,
            // Clamp envelope values to valid ranges
            attack: clamp(updates.envelope.attack ?? prev.envelope.attack, 0, 2),
            decay: clamp(updates.envelope.decay ?? prev.envelope.decay, 0, 2),
            sustain: clamp(updates.envelope.sustain ?? prev.envelope.sustain, 0, 1),
            release: clamp(updates.envelope.release ?? prev.envelope.release, 0, 5),
          };
        }

        // Apply filter updates if provided
        if (updates.filter !== undefined) {
          newConfig.filter = {
            ...prev.filter,
            ...updates.filter,
            // Clamp frequency to valid range
            frequency: clamp(
              updates.filter.frequency ?? prev.filter.frequency,
              20,
              20000
            ),
          };
        }

        // Apply effects updates if provided
        if (updates.effects !== undefined) {
          newConfig.effects = {
            reverb: {
              ...prev.effects.reverb,
              ...clampReverbConfig(updates.effects.reverb ?? {}),
            },
            delay: {
              ...prev.effects.delay,
              ...clampDelayConfig(updates.effects.delay ?? {}),
            },
            chorus: {
              ...prev.effects.chorus,
              ...clampChorusConfig(updates.effects.chorus ?? {}),
            },
            flanger: {
              ...prev.effects.flanger,
              ...clampFlangerConfig(updates.effects.flanger ?? {}),
            },
          };
        }

        // Notify listener of change
        onChange?.(newConfig);

        return newConfig;
      });
    },
    [onChange]
  );

  /**
   * Apply a preset configuration.
   * Property 27: Preset Application
   * Requirements: 37.7 - Apply all preset parameter values
   */
  const applyPreset = useCallback(
    (presetName: PresetName) => {
      const preset = ALL_PRESETS.find((p) => p.name === presetName);
      if (!preset) {
        console.warn(`Preset "${presetName}" not found`);
        return;
      }

      const newConfig: SynthesizerConfig = {
        ...preset.config,
        presetName: presetName,
      };

      setConfig(newConfig);
      onChange?.(newConfig);
    },
    [onChange]
  );

  /**
   * Update effects configuration.
   * Maintains effect independence - updating one effect doesn't affect others.
   * Property 26: Effect Independence
   * Requirements: 36.5 - Each effect operates independently
   */
  const updateEffects = useCallback(
    (effectsUpdate: Partial<EffectsConfig>) => {
      setConfig((prev) => {
        const newEffects: EffectsConfig = { ...prev.effects };

        // Only update the effects that are specified
        // Property 26: Effect Independence - one effect doesn't affect others
        if (effectsUpdate.reverb !== undefined) {
          newEffects.reverb = {
            ...prev.effects.reverb,
            ...clampReverbConfig(effectsUpdate.reverb),
          };
        }
        if (effectsUpdate.delay !== undefined) {
          newEffects.delay = {
            ...prev.effects.delay,
            ...clampDelayConfig(effectsUpdate.delay),
          };
        }
        if (effectsUpdate.chorus !== undefined) {
          newEffects.chorus = {
            ...prev.effects.chorus,
            ...clampChorusConfig(effectsUpdate.chorus),
          };
        }
        if (effectsUpdate.flanger !== undefined) {
          newEffects.flanger = {
            ...prev.effects.flanger,
            ...clampFlangerConfig(effectsUpdate.flanger),
          };
        }

        const newConfig: SynthesizerConfig = {
          ...prev,
          effects: newEffects,
          // Clear preset when manually adjusting effects
          presetName: null,
        };

        onChange?.(newConfig);
        return newConfig;
      });
    },
    [onChange]
  );

  /**
   * Reset to default configuration.
   */
  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_SYNTH_CONFIG);
    onChange?.(DEFAULT_SYNTH_CONFIG);
  }, [onChange]);

  /**
   * Load a complete configuration (e.g., from a saved melody).
   * Used when loading a melody from the API.
   */
  const loadConfig = useCallback(
    (newConfig: SynthesizerConfig) => {
      // Ensure all effects have proper defaults if not present
      const completeConfig: SynthesizerConfig = {
        ...DEFAULT_SYNTH_CONFIG,
        ...newConfig,
        envelope: {
          ...DEFAULT_SYNTH_CONFIG.envelope,
          ...newConfig.envelope,
        },
        filter: {
          ...DEFAULT_SYNTH_CONFIG.filter,
          ...newConfig.filter,
        },
        effects: {
          reverb: {
            ...DEFAULT_SYNTH_CONFIG.effects.reverb,
            ...newConfig.effects?.reverb,
          },
          delay: {
            ...DEFAULT_SYNTH_CONFIG.effects.delay,
            ...newConfig.effects?.delay,
          },
          chorus: {
            ...DEFAULT_SYNTH_CONFIG.effects.chorus,
            ...newConfig.effects?.chorus,
          },
          flanger: {
            ...DEFAULT_SYNTH_CONFIG.effects.flanger,
            ...newConfig.effects?.flanger,
          },
        },
      };

      setConfig(completeConfig);
      onChange?.(completeConfig);
    },
    [onChange]
  );

  return {
    config,
    updateConfig,
    applyPreset,
    updateEffects,
    resetToDefaults,
    loadConfig,
  };
}
