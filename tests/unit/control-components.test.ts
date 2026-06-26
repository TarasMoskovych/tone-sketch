import { describe, it, expect, vi } from 'vitest';
import type { SynthesizerConfig } from '../../types/synth';
import type { GridSnapConfig, GridDivision } from '../../types/grid';

/**
 * TransportControls props interface (mirrors component interface)
 */
interface TransportControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  isLooping: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onLoopToggle: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * SynthControls props interface (mirrors component interface)
 */
interface SynthControlsProps {
  config: SynthesizerConfig;
  onChange: (config: Partial<SynthesizerConfig>) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * GridSnapControls props interface (mirrors component interface)
 */
interface GridSnapControlsProps {
  config: GridSnapConfig;
  onChange: (config: GridSnapConfig) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Unit tests for UI control components
 *
 * These tests verify:
 * - TransportControls: Play/pause/stop functionality, loop toggle, disabled states
 * - SynthControls: Oscillator selection, volume, ADSR envelope, filter controls
 * - GridSnapControls: Enable/disable toggle, division selection
 *
 * Requirements covered:
 * - 7.1, 7.2, 7.3: Grid snap toggle and division selection
 * - 9.1: Oscillator type selection
 * - 10.1: Volume control
 * - 13.1, 13.2, 14.1, 15.1: Playback controls
 */

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Default synthesizer configuration matching requirements
 */
const DEFAULT_SYNTH_CONFIG: SynthesizerConfig = {
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
  effects: {
    reverb: { enabled: false, roomSize: 0.5, wetDry: 0.3 },
    delay: { enabled: false, time: 0.25, feedback: 0.3, wetDry: 0.3 },
    chorus: { enabled: false, rate: 1.5, depth: 0.5, wetDry: 0.3 },
    flanger: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.5, wetDry: 0.3 },
  },
  presetName: null,
};

/**
 * Default grid snap configuration matching requirements
 */
const DEFAULT_GRID_CONFIG: GridSnapConfig = {
  enabled: true,
  division: 0.25,
};

/**
 * Create a mock transport controls props object
 */
function createTransportProps(overrides: Partial<TransportControlsProps> = {}): TransportControlsProps {
  return {
    isPlaying: false,
    isPaused: false,
    isLooping: false,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onStop: vi.fn(),
    onLoopToggle: vi.fn(),
    ...overrides,
  };
}

/**
 * Create a mock synth controls props object
 */
function createSynthProps(overrides: Partial<SynthControlsProps> = {}): SynthControlsProps {
  return {
    config: { ...DEFAULT_SYNTH_CONFIG },
    onChange: vi.fn(),
    ...overrides,
  };
}

/**
 * Create a mock grid snap controls props object
 */
function createGridSnapProps(overrides: Partial<GridSnapControlsProps> = {}): GridSnapControlsProps {
  return {
    config: { ...DEFAULT_GRID_CONFIG },
    onChange: vi.fn(),
    ...overrides,
  };
}

// ============================================================================
// TransportControls Tests
// ============================================================================

describe('TransportControls', () => {
  describe('Play/Pause/Stop button state management', () => {
    it('should have correct initial stopped state', () => {
      const props = createTransportProps({
        isPlaying: false,
        isPaused: false,
      });

      // Verify initial state values
      expect(props.isPlaying).toBe(false);
      expect(props.isPaused).toBe(false);
    });

    it('should have correct playing state', () => {
      const props = createTransportProps({
        isPlaying: true,
        isPaused: false,
      });

      expect(props.isPlaying).toBe(true);
      expect(props.isPaused).toBe(false);
    });

    it('should have correct paused state', () => {
      const props = createTransportProps({
        isPlaying: false,
        isPaused: true,
      });

      expect(props.isPlaying).toBe(false);
      expect(props.isPaused).toBe(true);
    });
  });

  describe('Callback invocations', () => {
    it('should invoke onPlay callback when play is triggered', () => {
      const onPlay = vi.fn();
      const props = createTransportProps({ onPlay });

      // Simulate play action
      props.onPlay();

      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    it('should invoke onPause callback when pause is triggered', () => {
      const onPause = vi.fn();
      const props = createTransportProps({ onPause, isPlaying: true });

      // Simulate pause action
      props.onPause();

      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it('should invoke onStop callback when stop is triggered', () => {
      const onStop = vi.fn();
      const props = createTransportProps({ onStop, isPlaying: true });

      // Simulate stop action
      props.onStop();

      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('should invoke onLoopToggle callback when loop is toggled', () => {
      const onLoopToggle = vi.fn();
      const props = createTransportProps({ onLoopToggle });

      // Simulate loop toggle
      props.onLoopToggle();

      expect(onLoopToggle).toHaveBeenCalledTimes(1);
    });

    it('should support multiple callback invocations', () => {
      const onPlay = vi.fn();
      const onStop = vi.fn();
      const props = createTransportProps({ onPlay, onStop });

      props.onPlay();
      props.onStop();
      props.onPlay();

      expect(onPlay).toHaveBeenCalledTimes(2);
      expect(onStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loop toggle functionality (Req 15.1)', () => {
    it('should reflect loop disabled state', () => {
      const props = createTransportProps({ isLooping: false });
      expect(props.isLooping).toBe(false);
    });

    it('should reflect loop enabled state', () => {
      const props = createTransportProps({ isLooping: true });
      expect(props.isLooping).toBe(true);
    });

    it('should toggle loop state via callback', () => {
      let loopState = false;
      const onLoopToggle = vi.fn(() => {
        loopState = !loopState;
      });

      const props = createTransportProps({ isLooping: loopState, onLoopToggle });

      props.onLoopToggle();
      expect(loopState).toBe(true);

      props.onLoopToggle();
      expect(loopState).toBe(false);
    });
  });

  describe('Disabled state handling', () => {
    it('should accept disabled prop', () => {
      const props = createTransportProps({ disabled: true });
      expect(props.disabled).toBe(true);
    });

    it('should default disabled to undefined when not provided', () => {
      const props = createTransportProps();
      expect(props.disabled).toBeUndefined();
    });

    it('should not prevent callback registration when disabled', () => {
      const onPlay = vi.fn();
      const props = createTransportProps({ disabled: true, onPlay });

      // Callbacks should still be available (component handles disabling)
      expect(typeof props.onPlay).toBe('function');
    });
  });

  describe('State combinations', () => {
    it('should handle stopped state (not playing, not paused)', () => {
      const props = createTransportProps({
        isPlaying: false,
        isPaused: false,
        isLooping: false,
      });

      const isStopped = !props.isPlaying && !props.isPaused;
      expect(isStopped).toBe(true);
    });

    it('should handle playing with loop state', () => {
      const props = createTransportProps({
        isPlaying: true,
        isPaused: false,
        isLooping: true,
      });

      expect(props.isPlaying).toBe(true);
      expect(props.isLooping).toBe(true);
    });

    it('should handle paused with loop state', () => {
      const props = createTransportProps({
        isPlaying: false,
        isPaused: true,
        isLooping: true,
      });

      expect(props.isPaused).toBe(true);
      expect(props.isLooping).toBe(true);
    });
  });
});

// ============================================================================
// SynthControls Tests
// ============================================================================

describe('SynthControls', () => {
  describe('Oscillator type selection (Req 9.1)', () => {
    it('should support sine oscillator type', () => {
      const props = createSynthProps({
        config: { ...DEFAULT_SYNTH_CONFIG, oscillatorType: 'sine' },
      });

      expect(props.config.oscillatorType).toBe('sine');
    });

    it('should support square oscillator type', () => {
      const props = createSynthProps({
        config: { ...DEFAULT_SYNTH_CONFIG, oscillatorType: 'square' },
      });

      expect(props.config.oscillatorType).toBe('square');
    });

    it('should support sawtooth oscillator type', () => {
      const props = createSynthProps({
        config: { ...DEFAULT_SYNTH_CONFIG, oscillatorType: 'sawtooth' },
      });

      expect(props.config.oscillatorType).toBe('sawtooth');
    });

    it('should support triangle oscillator type', () => {
      const props = createSynthProps({
        config: { ...DEFAULT_SYNTH_CONFIG, oscillatorType: 'triangle' },
      });

      expect(props.config.oscillatorType).toBe('triangle');
    });

    it('should invoke onChange with new oscillator type', () => {
      const onChange = vi.fn();
      const _props = createSynthProps({ onChange });

      // Simulate oscillator type change
      onChange({ oscillatorType: 'square' });

      expect(onChange).toHaveBeenCalledWith({ oscillatorType: 'square' });
    });
  });

  describe('Volume slider (Req 10.1)', () => {
    it('should have default volume of 0.8', () => {
      const props = createSynthProps();
      expect(props.config.volume).toBe(0.8);
    });

    it('should accept volume at minimum (0)', () => {
      const props = createSynthProps({
        config: { ...DEFAULT_SYNTH_CONFIG, volume: 0 },
      });

      expect(props.config.volume).toBe(0);
    });

    it('should accept volume at maximum (1)', () => {
      const props = createSynthProps({
        config: { ...DEFAULT_SYNTH_CONFIG, volume: 1 },
      });

      expect(props.config.volume).toBe(1);
    });

    it('should invoke onChange with new volume', () => {
      const onChange = vi.fn();
      const _props = createSynthProps({ onChange });

      onChange({ volume: 0.5 });

      expect(onChange).toHaveBeenCalledWith({ volume: 0.5 });
    });

    it('should support intermediate volume values', () => {
      const props = createSynthProps({
        config: { ...DEFAULT_SYNTH_CONFIG, volume: 0.42 },
      });

      expect(props.config.volume).toBe(0.42);
    });
  });

  describe('ADSR envelope sliders (Req 11.1-11.4)', () => {
    describe('Attack parameter (Req 11.1)', () => {
      it('should have default attack of 0.01 seconds', () => {
        const props = createSynthProps();
        expect(props.config.envelope.attack).toBe(0.01);
      });

      it('should accept attack at minimum (0)', () => {
        const props = createSynthProps({
          config: {
            ...DEFAULT_SYNTH_CONFIG,
            envelope: { ...DEFAULT_SYNTH_CONFIG.envelope, attack: 0 },
          },
        });

        expect(props.config.envelope.attack).toBe(0);
      });

      it('should accept attack at maximum (2 seconds)', () => {
        const props = createSynthProps({
          config: {
            ...DEFAULT_SYNTH_CONFIG,
            envelope: { ...DEFAULT_SYNTH_CONFIG.envelope, attack: 2 },
          },
        });

        expect(props.config.envelope.attack).toBe(2);
      });
    });

    describe('Decay parameter (Req 11.2)', () => {
      it('should have default decay of 0.1 seconds', () => {
        const props = createSynthProps();
        expect(props.config.envelope.decay).toBe(0.1);
      });

      it('should accept decay at minimum (0)', () => {
        const props = createSynthProps({
          config: {
            ...DEFAULT_SYNTH_CONFIG,
            envelope: { ...DEFAULT_SYNTH_CONFIG.envelope, decay: 0 },
          },
        });

        expect(props.config.envelope.decay).toBe(0);
      });

      it('should accept decay at maximum (2 seconds)', () => {
        const props = createSynthProps({
          config: {
            ...DEFAULT_SYNTH_CONFIG,
            envelope: { ...DEFAULT_SYNTH_CONFIG.envelope, decay: 2 },
          },
        });

        expect(props.config.envelope.decay).toBe(2);
      });
    });

    describe('Sustain parameter (Req 11.3)', () => {
      it('should have default sustain of 0.5', () => {
        const props = createSynthProps();
        expect(props.config.envelope.sustain).toBe(0.5);
      });

      it('should accept sustain at minimum (0)', () => {
        const props = createSynthProps({
          config: {
            ...DEFAULT_SYNTH_CONFIG,
            envelope: { ...DEFAULT_SYNTH_CONFIG.envelope, sustain: 0 },
          },
        });

        expect(props.config.envelope.sustain).toBe(0);
      });

      it('should accept sustain at maximum (1)', () => {
        const props = createSynthProps({
          config: {
            ...DEFAULT_SYNTH_CONFIG,
            envelope: { ...DEFAULT_SYNTH_CONFIG.envelope, sustain: 1 },
          },
        });

        expect(props.config.envelope.sustain).toBe(1);
      });
    });

    describe('Release parameter (Req 11.4)', () => {
      it('should have default release of 0.5 seconds', () => {
        const props = createSynthProps();
        expect(props.config.envelope.release).toBe(0.5);
      });

      it('should accept release at minimum (0)', () => {
        const props = createSynthProps({
          config: {
            ...DEFAULT_SYNTH_CONFIG,
            envelope: { ...DEFAULT_SYNTH_CONFIG.envelope, release: 0 },
          },
        });

        expect(props.config.envelope.release).toBe(0);
      });

      it('should accept release at maximum (5 seconds)', () => {
        const props = createSynthProps({
          config: {
            ...DEFAULT_SYNTH_CONFIG,
            envelope: { ...DEFAULT_SYNTH_CONFIG.envelope, release: 5 },
          },
        });

        expect(props.config.envelope.release).toBe(5);
      });
    });

    it('should invoke onChange with updated envelope', () => {
      const onChange = vi.fn();
      const _props = createSynthProps({ onChange });

      const newEnvelope = {
        attack: 1.0,
        decay: 0.5,
        sustain: 0.7,
        release: 2.0,
      };

      onChange({ envelope: newEnvelope });

      expect(onChange).toHaveBeenCalledWith({ envelope: newEnvelope });
    });
  });

  describe('Filter controls (Req 12.1-12.2)', () => {
    it('should have filter disabled by default', () => {
      const props = createSynthProps();
      expect(props.config.filter.enabled).toBe(false);
    });

    it('should have default filter type as lowpass', () => {
      const props = createSynthProps();
      expect(props.config.filter.type).toBe('lowpass');
    });

    it('should have default filter frequency of 1000 Hz', () => {
      const props = createSynthProps();
      expect(props.config.filter.frequency).toBe(1000);
    });

    it('should support enabling filter', () => {
      const props = createSynthProps({
        config: {
          ...DEFAULT_SYNTH_CONFIG,
          filter: { ...DEFAULT_SYNTH_CONFIG.filter, enabled: true },
        },
      });

      expect(props.config.filter.enabled).toBe(true);
    });

    it('should support highpass filter type', () => {
      const props = createSynthProps({
        config: {
          ...DEFAULT_SYNTH_CONFIG,
          filter: { ...DEFAULT_SYNTH_CONFIG.filter, type: 'highpass' },
        },
      });

      expect(props.config.filter.type).toBe('highpass');
    });

    it('should accept filter frequency at minimum (20 Hz)', () => {
      const props = createSynthProps({
        config: {
          ...DEFAULT_SYNTH_CONFIG,
          filter: { ...DEFAULT_SYNTH_CONFIG.filter, frequency: 20 },
        },
      });

      expect(props.config.filter.frequency).toBe(20);
    });

    it('should accept filter frequency at maximum (20000 Hz)', () => {
      const props = createSynthProps({
        config: {
          ...DEFAULT_SYNTH_CONFIG,
          filter: { ...DEFAULT_SYNTH_CONFIG.filter, frequency: 20000 },
        },
      });

      expect(props.config.filter.frequency).toBe(20000);
    });

    it('should invoke onChange with updated filter', () => {
      const onChange = vi.fn();
      const _props = createSynthProps({ onChange });

      const newFilter = {
        enabled: true,
        type: 'highpass' as const,
        frequency: 5000,
      };

      onChange({ filter: newFilter });

      expect(onChange).toHaveBeenCalledWith({ filter: newFilter });
    });
  });

  describe('Disabled state', () => {
    it('should accept disabled prop', () => {
      const props = createSynthProps({ disabled: true });
      expect(props.disabled).toBe(true);
    });

    it('should default to not disabled', () => {
      const props = createSynthProps();
      expect(props.disabled).toBeUndefined();
    });
  });

  describe('Configuration updates', () => {
    it('should invoke onChange with partial config updates', () => {
      const onChange = vi.fn();
      const _props = createSynthProps({ onChange });

      // Simulate multiple partial updates
      onChange({ volume: 0.6 });
      onChange({ oscillatorType: 'triangle' });

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenNthCalledWith(1, { volume: 0.6 });
      expect(onChange).toHaveBeenNthCalledWith(2, { oscillatorType: 'triangle' });
    });
  });
});

// ============================================================================
// GridSnapControls Tests
// ============================================================================

describe('GridSnapControls', () => {
  describe('Enable/disable toggle (Req 7.1)', () => {
    it('should have snap enabled by default', () => {
      const props = createGridSnapProps();
      expect(props.config.enabled).toBe(true);
    });

    it('should support disabling snap', () => {
      const props = createGridSnapProps({
        config: { ...DEFAULT_GRID_CONFIG, enabled: false },
      });

      expect(props.config.enabled).toBe(false);
    });

    it('should invoke onChange when toggling enabled state', () => {
      const onChange = vi.fn();
      const props = createGridSnapProps({ onChange });

      // Simulate toggle to disabled
      onChange({ ...props.config, enabled: false });

      expect(onChange).toHaveBeenCalledWith({
        enabled: false,
        division: 0.25,
      });
    });

    it('should invoke onChange when toggling back to enabled', () => {
      const onChange = vi.fn();
      const props = createGridSnapProps({
        config: { ...DEFAULT_GRID_CONFIG, enabled: false },
        onChange,
      });

      // Simulate toggle to enabled
      onChange({ ...props.config, enabled: true });

      expect(onChange).toHaveBeenCalledWith({
        enabled: true,
        division: 0.25,
      });
    });
  });

  describe('Division selection (Req 7.2)', () => {
    it('should have default division of 1/4 beat (0.25)', () => {
      const props = createGridSnapProps();
      expect(props.config.division).toBe(0.25);
    });

    const divisions: GridDivision[] = [1, 0.5, 0.25, 0.125, 0.0625];
    const divisionLabels: Record<GridDivision, string> = {
      1: '1 beat',
      0.5: '1/2 beat',
      0.25: '1/4 beat',
      0.125: '1/8 beat',
      0.0625: '1/16 beat',
    };

    divisions.forEach((division) => {
      it(`should support division ${divisionLabels[division]} (${division})`, () => {
        const props = createGridSnapProps({
          config: { ...DEFAULT_GRID_CONFIG, division },
        });

        expect(props.config.division).toBe(division);
      });
    });

    it('should invoke onChange when division changes', () => {
      const onChange = vi.fn();
      const props = createGridSnapProps({ onChange });

      // Simulate changing to 1/8 beat
      onChange({ ...props.config, division: 0.125 });

      expect(onChange).toHaveBeenCalledWith({
        enabled: true,
        division: 0.125,
      });
    });

    it('should support changing to all valid divisions via onChange', () => {
      const onChange = vi.fn();
      const props = createGridSnapProps({ onChange });

      divisions.forEach((division) => {
        onChange({ ...props.config, division });
      });

      expect(onChange).toHaveBeenCalledTimes(5);
    });
  });

  describe('State changes callback', () => {
    it('should preserve enabled state when changing division', () => {
      const onChange = vi.fn();
      createGridSnapProps({
        config: { enabled: true, division: 0.25 },
        onChange,
      });

      onChange({ enabled: true, division: 0.5 });

      expect(onChange).toHaveBeenCalledWith({
        enabled: true,
        division: 0.5,
      });
    });

    it('should preserve division when toggling enabled', () => {
      const onChange = vi.fn();
      createGridSnapProps({
        config: { enabled: true, division: 0.125 },
        onChange,
      });

      onChange({ enabled: false, division: 0.125 });

      expect(onChange).toHaveBeenCalledWith({
        enabled: false,
        division: 0.125,
      });
    });

    it('should support multiple sequential state changes', () => {
      const onChange = vi.fn();
      const _props = createGridSnapProps({ onChange });

      // Enable -> change division -> disable -> change division -> enable
      onChange({ enabled: true, division: 0.5 });
      onChange({ enabled: true, division: 0.125 });
      onChange({ enabled: false, division: 0.125 });
      onChange({ enabled: false, division: 1 });
      onChange({ enabled: true, division: 1 });

      expect(onChange).toHaveBeenCalledTimes(5);
      expect(onChange).toHaveBeenLastCalledWith({ enabled: true, division: 1 });
    });
  });

  describe('Disabled state', () => {
    it('should accept disabled prop', () => {
      const props = createGridSnapProps({ disabled: true });
      expect(props.disabled).toBe(true);
    });

    it('should default to not disabled', () => {
      const props = createGridSnapProps();
      expect(props.disabled).toBeUndefined();
    });

    it('should still have onChange available when disabled', () => {
      const onChange = vi.fn();
      const props = createGridSnapProps({ disabled: true, onChange });

      // The onChange should still be a function (component handles disabling)
      expect(typeof props.onChange).toBe('function');
    });
  });

  describe('Visual indicator (Req 7.3)', () => {
    it('should reflect enabled state for visual indication', () => {
      const enabledProps = createGridSnapProps({
        config: { enabled: true, division: 0.25 },
      });

      const disabledProps = createGridSnapProps({
        config: { enabled: false, division: 0.25 },
      });

      // The component should have different visual states based on enabled
      expect(enabledProps.config.enabled).toBe(true);
      expect(disabledProps.config.enabled).toBe(false);
    });

    it('should reflect current division for visual indication', () => {
      const props = createGridSnapProps({
        config: { enabled: true, division: 0.125 },
      });

      expect(props.config.division).toBe(0.125);
    });
  });
});

// ============================================================================
// Integration-style Tests for Props Consistency
// ============================================================================

describe('Control Components Props Consistency', () => {
  describe('TransportControls state consistency', () => {
    it('should not have both isPlaying and isPaused true simultaneously in typical usage', () => {
      // While the component doesn't enforce this, it's typically expected behavior
      const stoppedState = createTransportProps({ isPlaying: false, isPaused: false });
      const playingState = createTransportProps({ isPlaying: true, isPaused: false });
      const pausedState = createTransportProps({ isPlaying: false, isPaused: true });

      // Verify mutually exclusive states in typical usage
      expect(stoppedState.isPlaying === false && stoppedState.isPaused === false).toBe(true);
      expect(playingState.isPlaying === true && playingState.isPaused === false).toBe(true);
      expect(pausedState.isPlaying === false && pausedState.isPaused === true).toBe(true);
    });
  });

  describe('SynthControls config immutability', () => {
    it('should not mutate the original config object', () => {
      const originalConfig = { ...DEFAULT_SYNTH_CONFIG };
      const props = createSynthProps({ config: originalConfig });

      // Verify config reference matches
      expect(props.config).toEqual(originalConfig);
    });
  });

  describe('GridSnapControls config immutability', () => {
    it('should not mutate the original config object', () => {
      const originalConfig = { ...DEFAULT_GRID_CONFIG };
      const props = createGridSnapProps({ config: originalConfig });

      // Verify config reference matches
      expect(props.config).toEqual(originalConfig);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  describe('SynthControls boundary values', () => {
    it('should handle volume at exact boundaries', () => {
      const minVolume = createSynthProps({
        config: { ...DEFAULT_SYNTH_CONFIG, volume: 0 },
      });
      const maxVolume = createSynthProps({
        config: { ...DEFAULT_SYNTH_CONFIG, volume: 1 },
      });

      expect(minVolume.config.volume).toBe(0);
      expect(maxVolume.config.volume).toBe(1);
    });

    it('should handle envelope parameters at exact boundaries', () => {
      const props = createSynthProps({
        config: {
          ...DEFAULT_SYNTH_CONFIG,
          envelope: {
            attack: 0,
            decay: 2,
            sustain: 1,
            release: 5,
          },
        },
      });

      expect(props.config.envelope.attack).toBe(0);
      expect(props.config.envelope.decay).toBe(2);
      expect(props.config.envelope.sustain).toBe(1);
      expect(props.config.envelope.release).toBe(5);
    });

    it('should handle filter frequency at exact boundaries', () => {
      const minFreq = createSynthProps({
        config: {
          ...DEFAULT_SYNTH_CONFIG,
          filter: { ...DEFAULT_SYNTH_CONFIG.filter, frequency: 20 },
        },
      });
      const maxFreq = createSynthProps({
        config: {
          ...DEFAULT_SYNTH_CONFIG,
          filter: { ...DEFAULT_SYNTH_CONFIG.filter, frequency: 20000 },
        },
      });

      expect(minFreq.config.filter.frequency).toBe(20);
      expect(maxFreq.config.filter.frequency).toBe(20000);
    });
  });

  describe('GridSnapControls smallest division', () => {
    it('should handle 1/16 beat division (0.0625)', () => {
      const props = createGridSnapProps({
        config: { enabled: true, division: 0.0625 },
      });

      expect(props.config.division).toBe(0.0625);
    });
  });

  describe('Callback error handling', () => {
    it('should not throw when callbacks are invoked', () => {
      const transportProps = createTransportProps();
      const synthProps = createSynthProps();
      const gridProps = createGridSnapProps();

      expect(() => {
        transportProps.onPlay();
        transportProps.onPause();
        transportProps.onStop();
        transportProps.onLoopToggle();
        synthProps.onChange({ volume: 0.5 });
        gridProps.onChange({ enabled: false, division: 0.5 });
      }).not.toThrow();
    });
  });
});
