/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSynthesizer,
  DEFAULT_SYNTH_CONFIG,
  DEFAULT_EFFECTS_CONFIG,
} from '../../hooks/useSynthesizer';
import { ALL_PRESETS } from '../../lib/presets';
import type { SynthesizerConfig, PresetName } from '../../types/synth';

/**
 * Unit tests for the useSynthesizer hook.
 *
 * Validates: Requirements 38.2, 38.4, 36.1, 36.2, 36.3, 36.4, 37.1, 37.7
 */

describe('useSynthesizer', () => {
  describe('initial state', () => {
    it('should return default config when no initial config provided', () => {
      const { result } = renderHook(() => useSynthesizer());

      expect(result.current.config).toEqual(DEFAULT_SYNTH_CONFIG);
    });

    it('should merge initial config with defaults', () => {
      const initialConfig: Partial<SynthesizerConfig> = {
        oscillatorType: 'square',
        volume: 0.5,
      };

      const { result } = renderHook(() =>
        useSynthesizer({ initialConfig })
      );

      expect(result.current.config.oscillatorType).toBe('square');
      expect(result.current.config.volume).toBe(0.5);
      expect(result.current.config.envelope).toEqual(DEFAULT_SYNTH_CONFIG.envelope);
      expect(result.current.config.filter).toEqual(DEFAULT_SYNTH_CONFIG.filter);
      expect(result.current.config.effects).toEqual(DEFAULT_SYNTH_CONFIG.effects);
    });
  });

  describe('updateConfig', () => {
    it('should update oscillator type', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateConfig({ oscillatorType: 'sawtooth' });
      });

      expect(result.current.config.oscillatorType).toBe('sawtooth');
    });

    it('should update volume and clamp to valid range', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateConfig({ volume: 1.5 });
      });
      expect(result.current.config.volume).toBe(1);

      act(() => {
        result.current.updateConfig({ volume: -0.5 });
      });
      expect(result.current.config.volume).toBe(0);
    });

    it('should update envelope parameters', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateConfig({
          envelope: {
            attack: 0.5,
            decay: 0.3,
            sustain: 0.7,
            release: 1.0,
          },
        });
      });

      expect(result.current.config.envelope.attack).toBe(0.5);
      expect(result.current.config.envelope.decay).toBe(0.3);
      expect(result.current.config.envelope.sustain).toBe(0.7);
      expect(result.current.config.envelope.release).toBe(1.0);
    });

    it('should clamp envelope parameters to valid ranges', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateConfig({
          envelope: {
            attack: 5, // max is 2
            decay: -1, // min is 0
            sustain: 2, // max is 1
            release: 10, // max is 5
          },
        });
      });

      expect(result.current.config.envelope.attack).toBe(2);
      expect(result.current.config.envelope.decay).toBe(0);
      expect(result.current.config.envelope.sustain).toBe(1);
      expect(result.current.config.envelope.release).toBe(5);
    });

    it('should update filter configuration', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateConfig({
          filter: {
            enabled: true,
            type: 'highpass',
            frequency: 5000,
          },
        });
      });

      expect(result.current.config.filter.enabled).toBe(true);
      expect(result.current.config.filter.type).toBe('highpass');
      expect(result.current.config.filter.frequency).toBe(5000);
    });

    it('should clamp filter frequency to valid range', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateConfig({
          filter: { enabled: true, type: 'lowpass', frequency: 50000 },
        });
      });
      expect(result.current.config.filter.frequency).toBe(20000);

      act(() => {
        result.current.updateConfig({
          filter: { enabled: true, type: 'lowpass', frequency: 5 },
        });
      });
      expect(result.current.config.filter.frequency).toBe(20);
    });

    it('should clear presetName when config is manually updated', () => {
      const { result } = renderHook(() => useSynthesizer());

      // First apply a preset
      act(() => {
        result.current.applyPreset('Acoustic Piano');
      });
      expect(result.current.config.presetName).toBe('Acoustic Piano');

      // Then manually update config
      act(() => {
        result.current.updateConfig({ volume: 0.6 });
      });
      expect(result.current.config.presetName).toBeNull();
    });

    it('should call onChange callback when config is updated', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useSynthesizer({ onChange }));

      act(() => {
        result.current.updateConfig({ volume: 0.7 });
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ volume: 0.7 })
      );
    });
  });

  describe('updateEffects', () => {
    it('should update reverb configuration', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateEffects({
          reverb: { enabled: true, roomSize: 0.8, wetDry: 0.5 },
        });
      });

      expect(result.current.config.effects.reverb.enabled).toBe(true);
      expect(result.current.config.effects.reverb.roomSize).toBe(0.8);
      expect(result.current.config.effects.reverb.wetDry).toBe(0.5);
    });

    it('should update delay configuration', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateEffects({
          delay: { enabled: true, time: 0.5, feedback: 0.4, wetDry: 0.35 },
        });
      });

      expect(result.current.config.effects.delay.enabled).toBe(true);
      expect(result.current.config.effects.delay.time).toBe(0.5);
      expect(result.current.config.effects.delay.feedback).toBe(0.4);
      expect(result.current.config.effects.delay.wetDry).toBe(0.35);
    });

    it('should update chorus configuration', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateEffects({
          chorus: { enabled: true, rate: 2.0, depth: 0.7, wetDry: 0.4 },
        });
      });

      expect(result.current.config.effects.chorus.enabled).toBe(true);
      expect(result.current.config.effects.chorus.rate).toBe(2.0);
      expect(result.current.config.effects.chorus.depth).toBe(0.7);
      expect(result.current.config.effects.chorus.wetDry).toBe(0.4);
    });

    it('should update flanger configuration', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateEffects({
          flanger: { enabled: true, rate: 1.0, depth: 0.6, feedback: 0.7, wetDry: 0.45 },
        });
      });

      expect(result.current.config.effects.flanger.enabled).toBe(true);
      expect(result.current.config.effects.flanger.rate).toBe(1.0);
      expect(result.current.config.effects.flanger.depth).toBe(0.6);
      expect(result.current.config.effects.flanger.feedback).toBe(0.7);
      expect(result.current.config.effects.flanger.wetDry).toBe(0.45);
    });

    it('should clamp effect parameters to valid ranges (Property 25)', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.updateEffects({
          reverb: { enabled: true, roomSize: 1.5, wetDry: -0.5 }, // roomSize max 1, wetDry min 0
          delay: { enabled: true, time: 2, feedback: 1.0, wetDry: 1.5 }, // time max 1, feedback max 0.9, wetDry max 1
          chorus: { enabled: true, rate: 20, depth: 2, wetDry: 1.5 }, // rate max 10, depth max 1
          flanger: { enabled: true, rate: 0.05, depth: -1, feedback: 1.5, wetDry: 2 }, // rate min 0.1, depth min 0, feedback max 0.9
        });
      });

      // Reverb clamping
      expect(result.current.config.effects.reverb.roomSize).toBe(1);
      expect(result.current.config.effects.reverb.wetDry).toBe(0);

      // Delay clamping
      expect(result.current.config.effects.delay.time).toBe(1);
      expect(result.current.config.effects.delay.feedback).toBe(0.9);
      expect(result.current.config.effects.delay.wetDry).toBe(1);

      // Chorus clamping
      expect(result.current.config.effects.chorus.rate).toBe(10);
      expect(result.current.config.effects.chorus.depth).toBe(1);
      expect(result.current.config.effects.chorus.wetDry).toBe(1);

      // Flanger clamping
      expect(result.current.config.effects.flanger.rate).toBe(0.1);
      expect(result.current.config.effects.flanger.depth).toBe(0);
      expect(result.current.config.effects.flanger.feedback).toBe(0.9);
      expect(result.current.config.effects.flanger.wetDry).toBe(1);
    });

    it('should maintain effect independence (Property 26)', () => {
      const { result } = renderHook(() => useSynthesizer());

      // Enable reverb
      act(() => {
        result.current.updateEffects({
          reverb: { enabled: true, roomSize: 0.7, wetDry: 0.4 },
        });
      });

      // Update delay - should not affect reverb
      act(() => {
        result.current.updateEffects({
          delay: { enabled: true, time: 0.3, feedback: 0.5, wetDry: 0.25 },
        });
      });

      // Reverb should remain unchanged
      expect(result.current.config.effects.reverb.enabled).toBe(true);
      expect(result.current.config.effects.reverb.roomSize).toBe(0.7);
      expect(result.current.config.effects.reverb.wetDry).toBe(0.4);

      // Delay should be updated
      expect(result.current.config.effects.delay.enabled).toBe(true);
      expect(result.current.config.effects.delay.time).toBe(0.3);

      // Disable chorus - should not affect other effects
      act(() => {
        result.current.updateEffects({
          chorus: { enabled: false, rate: 1, depth: 0.2, wetDry: 0.1 },
        });
      });

      // Other effects should remain unchanged
      expect(result.current.config.effects.reverb.enabled).toBe(true);
      expect(result.current.config.effects.delay.enabled).toBe(true);
      expect(result.current.config.effects.chorus.enabled).toBe(false);
    });

    it('should clear presetName when effects are manually updated', () => {
      const { result } = renderHook(() => useSynthesizer());

      // Apply a preset
      act(() => {
        result.current.applyPreset('Classic Lead');
      });
      expect(result.current.config.presetName).toBe('Classic Lead');

      // Update effects
      act(() => {
        result.current.updateEffects({
          reverb: { enabled: false, roomSize: 0.5, wetDry: 0.3 },
        });
      });
      expect(result.current.config.presetName).toBeNull();
    });
  });

  describe('applyPreset', () => {
    it('should apply preset configuration (Property 27)', () => {
      const { result } = renderHook(() => useSynthesizer());

      act(() => {
        result.current.applyPreset('Acoustic Piano');
      });

      const preset = ALL_PRESETS.find(p => p.name === 'Acoustic Piano')!;

      expect(result.current.config.oscillatorType).toBe(preset.config.oscillatorType);
      expect(result.current.config.volume).toBe(preset.config.volume);
      expect(result.current.config.envelope).toEqual(preset.config.envelope);
      expect(result.current.config.filter).toEqual(preset.config.filter);
      expect(result.current.config.effects).toEqual(preset.config.effects);
      expect(result.current.config.presetName).toBe('Acoustic Piano');
    });

    it('should apply all 35 presets correctly', () => {
      const { result } = renderHook(() => useSynthesizer());

      // Test all 35 presets (7 categories × 5 presets each)
      for (const preset of ALL_PRESETS) {
        act(() => {
          result.current.applyPreset(preset.name);
        });

        expect(result.current.config.presetName).toBe(preset.name);
        expect(result.current.config.oscillatorType).toBe(preset.config.oscillatorType);
        expect(result.current.config.volume).toBe(preset.config.volume);
      }
    });

    it('should handle unknown preset gracefully', () => {
      const { result } = renderHook(() => useSynthesizer());
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const originalConfig = { ...result.current.config };

      act(() => {
        result.current.applyPreset('Unknown Preset' as PresetName);
      });

      // Config should remain unchanged
      expect(result.current.config).toEqual(originalConfig);
      expect(consoleSpy).toHaveBeenCalledWith('Preset "Unknown Preset" not found');

      consoleSpy.mockRestore();
    });

    it('should call onChange callback when preset is applied', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useSynthesizer({ onChange }));

      act(() => {
        result.current.applyPreset('Sub Bass');
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ presetName: 'Sub Bass' })
      );
    });
  });

  describe('resetToDefaults', () => {
    it('should reset config to defaults', () => {
      const { result } = renderHook(() => useSynthesizer());

      // Modify the config
      act(() => {
        result.current.updateConfig({
          oscillatorType: 'square',
          volume: 0.5,
          envelope: { attack: 1, decay: 1, sustain: 0.3, release: 2 },
        });
        result.current.updateEffects({
          reverb: { enabled: true, roomSize: 0.9, wetDry: 0.8 },
        });
      });

      // Reset
      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.config).toEqual(DEFAULT_SYNTH_CONFIG);
    });

    it('should call onChange callback when reset', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useSynthesizer({ onChange }));

      act(() => {
        result.current.resetToDefaults();
      });

      expect(onChange).toHaveBeenCalledWith(DEFAULT_SYNTH_CONFIG);
    });
  });

  describe('loadConfig', () => {
    it('should load a complete configuration', () => {
      const { result } = renderHook(() => useSynthesizer());

      const newConfig: SynthesizerConfig = {
        oscillatorType: 'triangle',
        volume: 0.65,
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.8 },
        filter: { enabled: true, type: 'highpass', frequency: 2000 },
        effects: {
          reverb: { enabled: true, roomSize: 0.6, wetDry: 0.4 },
          delay: { enabled: false, time: 0.25, feedback: 0.3, wetDry: 0.3 },
          chorus: { enabled: true, rate: 2, depth: 0.4, wetDry: 0.25 },
          flanger: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.5, wetDry: 0.3 },
        },
        presetName: 'Electric Piano',
      };

      act(() => {
        result.current.loadConfig(newConfig);
      });

      expect(result.current.config).toEqual(newConfig);
    });

    it('should merge partial config with defaults when loading', () => {
      const { result } = renderHook(() => useSynthesizer());

      // Load a config missing some fields
      const partialConfig = {
        oscillatorType: 'sawtooth',
        volume: 0.7,
        envelope: DEFAULT_SYNTH_CONFIG.envelope,
        filter: DEFAULT_SYNTH_CONFIG.filter,
        effects: {
          reverb: { enabled: true, roomSize: 0.5, wetDry: 0.3 },
          // Missing delay, chorus, flanger
        },
        presetName: null,
      } as SynthesizerConfig;

      act(() => {
        result.current.loadConfig(partialConfig);
      });

      // Should have defaults for missing effects
      expect(result.current.config.effects.delay).toEqual(DEFAULT_EFFECTS_CONFIG.delay);
      expect(result.current.config.effects.chorus).toEqual(DEFAULT_EFFECTS_CONFIG.chorus);
      expect(result.current.config.effects.flanger).toEqual(DEFAULT_EFFECTS_CONFIG.flanger);
    });
  });

  describe('ALL_PRESETS', () => {
    it('should have 35 presets (7 categories × 5 each)', () => {
      expect(ALL_PRESETS).toHaveLength(35);
    });

    it('should have presets for all 7 categories', () => {
      const categories = new Set(ALL_PRESETS.map(p => p.category));
      expect(categories).toEqual(new Set(['Piano', 'Lead', 'Pluck', 'Guitar', 'Bass', 'Strings', 'Pads']));
    });

    it('should have 5 presets per category', () => {
      const categoryCounts: Record<string, number> = {};
      for (const preset of ALL_PRESETS) {
        categoryCounts[preset.category] = (categoryCounts[preset.category] || 0) + 1;
      }

      expect(categoryCounts['Piano']).toBe(5);
      expect(categoryCounts['Lead']).toBe(5);
      expect(categoryCounts['Pluck']).toBe(5);
      expect(categoryCounts['Guitar']).toBe(5);
      expect(categoryCounts['Bass']).toBe(5);
      expect(categoryCounts['Strings']).toBe(5);
      expect(categoryCounts['Pads']).toBe(5);
    });

    it('should have valid effect configurations in all presets', () => {
      for (const preset of ALL_PRESETS) {
        const { effects } = preset.config;

        // Validate reverb
        expect(effects.reverb.roomSize).toBeGreaterThanOrEqual(0);
        expect(effects.reverb.roomSize).toBeLessThanOrEqual(1);
        expect(effects.reverb.wetDry).toBeGreaterThanOrEqual(0);
        expect(effects.reverb.wetDry).toBeLessThanOrEqual(1);

        // Validate delay
        expect(effects.delay.time).toBeGreaterThanOrEqual(0);
        expect(effects.delay.time).toBeLessThanOrEqual(1);
        expect(effects.delay.feedback).toBeGreaterThanOrEqual(0);
        expect(effects.delay.feedback).toBeLessThanOrEqual(0.9);

        // Validate chorus
        expect(effects.chorus.rate).toBeGreaterThanOrEqual(0.1);
        expect(effects.chorus.rate).toBeLessThanOrEqual(10);
        expect(effects.chorus.depth).toBeGreaterThanOrEqual(0);
        expect(effects.chorus.depth).toBeLessThanOrEqual(1);

        // Validate flanger
        expect(effects.flanger.rate).toBeGreaterThanOrEqual(0.1);
        expect(effects.flanger.rate).toBeLessThanOrEqual(10);
        expect(effects.flanger.depth).toBeGreaterThanOrEqual(0);
        expect(effects.flanger.depth).toBeLessThanOrEqual(1);
        expect(effects.flanger.feedback).toBeGreaterThanOrEqual(0);
        expect(effects.flanger.feedback).toBeLessThanOrEqual(0.9);
      }
    });
  });
});
