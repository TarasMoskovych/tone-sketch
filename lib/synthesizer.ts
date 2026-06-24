import * as Tone from 'tone';
import type { Note } from '@/types/note';
import type {
  SynthesizerConfig,
  OscillatorType,
  ADSREnvelope,
  FilterConfig,
  EffectsConfig,
  ReverbConfig,
  DelayConfig,
  ChorusConfig,
  FlangerConfig,
  PresetName,
} from '@/types/synth';
import {
  REVERB_RANGES,
  DELAY_RANGES,
  CHORUS_RANGES,
  FLANGER_RANGES,
} from '@/types/synth';
import {
  type AudioContextError,
  type AudioContextState,
  type AudioErrorCallback,
  type AudioStateChangeCallback,
  createAudioContextError,
  detectAudioErrorType,
  isWebAudioSupported,
} from './audio-context-error';
import { getPresetByName } from './presets';

/**
 * Deep partial type for SynthesizerConfig to allow partial updates
 * of nested properties like envelope and filter.
 */
export type DeepPartialSynthConfig = {
  oscillatorType?: OscillatorType;
  volume?: number;
  envelope?: Partial<ADSREnvelope>;
  filter?: Partial<FilterConfig>;
  effects?: DeepPartialEffectsConfig;
};

/**
 * Deep partial type for EffectsConfig to allow partial updates
 * of individual effect configurations.
 */
export type DeepPartialEffectsConfig = {
  reverb?: Partial<ReverbConfig>;
  delay?: Partial<DelayConfig>;
  chorus?: Partial<ChorusConfig>;
  flanger?: Partial<FlangerConfig>;
};

// Re-export error types for convenience
export type { AudioContextError, AudioContextState };

/**
 * Audio headroom constants to prevent clipping during polyphonic playback.
 * VOICE_HEADROOM_DB: Applied to individual synth voices to prevent summing distortion
 * MASTER_HEADROOM_DB: Applied to master volume for additional safety margin
 */
const VOICE_HEADROOM_DB = -6;
const MASTER_HEADROOM_DB = -6;

/**
 * Default synthesizer configuration values.
 * These match the requirements specification.
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
  effects: {
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
  },
  presetName: null,
};

/**
 * Playback state enum for tracking synthesizer state.
 */
export type PlaybackState = 'stopped' | 'playing' | 'paused';

/**
 * Interface for the SynthesizerEngine.
 * Provides methods for configuring and controlling audio playback.
 */
export interface ISynthesizerEngine {
  configure(config: DeepPartialSynthConfig): void;
  applyPreset(presetName: PresetName): SynthesizerConfig;
  play(notes: Note[], startPosition: number, loop: boolean): void;
  pause(): void;
  stop(): void;
  setPlayheadPosition(position: number): void;
  setTempo(bpm: number): void;
  getTempo(): number;
  onPlayheadUpdate(callback: (position: number) => void): void;
  triggerNote(note: Note): void;
  dispose(): void;
  getPlaybackState(): PlaybackState;
  getPlayheadPosition(): number;
  getRealTimePlayheadPosition(): number;
  isLooping(): boolean;

  // Error handling methods
  getLastError(): AudioContextError | null;
  getAudioContextState(): AudioContextState;
  isAudioAvailable(): boolean;
  onAudioError(callback: AudioErrorCallback): void;
  offAudioError(callback: AudioErrorCallback): void;
  onAudioStateChange(callback: AudioStateChangeCallback): void;
  offAudioStateChange(callback: AudioStateChangeCallback): void;
  resumeAudioContext(): Promise<boolean>;
  clearError(): void;
}

/**
 * Convert MIDI note number to frequency name for Tone.js.
 * MIDI note 60 = C4 (middle C)
 */
function midiToNoteName(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const noteName = noteNames[midi % 12];
  return `${noteName}${octave}`;
}

/**
 * Convert volume level (0-1) to decibels for Tone.js.
 * 0 = -Infinity dB (silent), 1 = 0 dB (full volume)
 */
function volumeToDb(volume: number): number {
  if (volume <= 0) return -Infinity;
  if (volume >= 1) return 0;
  // Use logarithmic conversion: dB = 20 * log10(volume)
  return 20 * Math.log10(volume);
}

/**
 * Clamp a value to the specified range.
 * Property 25: Effect Parameter Validation - clamp values to valid ranges.
 */
function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * SynthesizerEngine class wraps Tone.js to provide melody playback
 * with configurable sound parameters.
 *
 * Requirements covered:
 * - 9.1, 9.2, 9.3: Oscillator type selection
 * - 10.1, 10.2: Volume control
 * - 11.1-11.5: ADSR envelope
 * - 12.1-12.4: Filter configuration
 * - 13.1-13.6: Play/pause controls
 * - 14.1-14.3: Stop functionality
 * - 15.1-15.4: Loop mode
 */
export class SynthesizerEngine implements ISynthesizerEngine {
  private synth: Tone.PolySynth | null = null;
  private filter: Tone.Filter | null = null;
  private volume: Tone.Volume | null = null;
  private config: SynthesizerConfig;
  private playheadCallbacks: Array<(position: number) => void> = [];
  private isDisposed = false;

  // Effects nodes
  private reverbEffect: Tone.Reverb | null = null;
  private delayEffect: Tone.FeedbackDelay | null = null;
  private chorusEffect: Tone.Chorus | null = null;
  private flangerEffect: Tone.Phaser | null = null;

  // Master limiter prevents clipping for clean output
  private limiter: Tone.Limiter | null = null;

  // Playback state management
  private playbackState: PlaybackState = 'stopped';
  private playheadPosition = 0;
  private loopEnabled = false;
  private currentNotes: Note[] = [];
  private scheduledEvents: number[] = [];
  private playheadUpdateId: number | null = null;
  private melodyEndTime = 0;

  // Playhead synchronization state for audio-visual sync
  // Tracks the start position and time when playback began
  private playbackStartPosition = 0;
  private playbackStartTime = 0;

  // Audio error handling state
  // Requirements: 29.4 - Display error message within 500ms when audio subsystem is unavailable
  private lastError: AudioContextError | null = null;
  private audioContextState: AudioContextState = 'suspended';
  private audioAvailable = true;
  private errorCallbacks: AudioErrorCallback[] = [];
  private stateChangeCallbacks: AudioStateChangeCallback[] = [];
  private audioContextStateCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(initialConfig: Partial<SynthesizerConfig> = {}) {
    this.config = { ...DEFAULT_SYNTH_CONFIG, ...initialConfig };

    // Check if Web Audio is supported before initializing
    if (!isWebAudioSupported()) {
      this.audioAvailable = false;
      this.audioContextState = 'unavailable';
      this.handleError(createAudioContextError('not_supported'));
      return;
    }

    this.initializeAudioNodes();
    this.startAudioContextStateMonitoring();
  }

  /**
   * Initialize Tone.js audio nodes with current configuration.
   * Handles initialization failures gracefully.
   *
   * Requirements: 29.4 - Display error message within 500ms when audio subsystem is unavailable
   * Design: Error Handling - Audio Error Handling section
   */
  private initializeAudioNodes(): void {
    try {
      // Create volume node with headroom to prevent clipping
      this.volume = new Tone.Volume(volumeToDb(this.config.volume) + MASTER_HEADROOM_DB);

      // Create limiter as safety net to catch any peaks
      // Threshold at -3dB gives headroom while preventing distortion
      this.limiter = new Tone.Limiter(-3);

      // Create filter node (always in chain, but can be bypassed when disabled)
      this.filter = new Tone.Filter({
        type: this.config.filter.type,
        frequency: this.config.filter.frequency,
        Q: 1, // Default Q factor
      });

      // Initialize effect nodes
      // Requirements 36.1, 36.2, 36.3, 36.4: Create effect nodes with configured parameters
      this.initializeEffectNodes();

      // Create PolySynth with configurable oscillator type
      // Use lower voice volumes to prevent summing distortion from multiple simultaneous notes
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: this.config.oscillatorType,
        },
        envelope: {
          attack: this.config.envelope.attack,
          decay: this.config.envelope.decay,
          sustain: this.config.envelope.sustain,
          release: this.config.envelope.release,
        },
        volume: VOICE_HEADROOM_DB,
      });

      // Set maximum polyphony to handle many simultaneous notes
      this.synth.maxPolyphony = 32;

      // Connect audio chain based on filter enabled state
      this.connectAudioChain();

      // Update audio context state
      this.updateAudioContextState();

      // Clear any previous initialization errors
      this.lastError = null;
    } catch (error) {
      // Handle initialization failure
      this.audioAvailable = false;
      const audioError = createAudioContextError(
        'initialization_failed',
        error instanceof Error ? error : new Error(String(error))
      );
      this.handleError(audioError);
    }
  }

  /**
   * Initialize all effect nodes with current configuration.
   * Creates Reverb, FeedbackDelay, Chorus, and Phaser (flanger) nodes.
   *
   * Requirements 36.1, 36.2, 36.3, 36.4: Create effect nodes
   */
  private initializeEffectNodes(): void {
    const effects = this.config.effects;

    // Reverb effect using Tone.Reverb
    // Note: Reverb.decay maps to roomSize conceptually (larger decay = larger room)
    this.reverbEffect = new Tone.Reverb({
      decay: this.mapRoomSizeToDecay(effects.reverb.roomSize),
      wet: effects.reverb.wetDry,
    });

    // Delay effect using Tone.FeedbackDelay
    this.delayEffect = new Tone.FeedbackDelay({
      delayTime: effects.delay.time,
      feedback: effects.delay.feedback,
      wet: effects.delay.wetDry,
    });

    // Chorus effect using Tone.Chorus
    this.chorusEffect = new Tone.Chorus({
      frequency: effects.chorus.rate,
      depth: effects.chorus.depth,
      wet: effects.chorus.wetDry,
    });
    // Start the chorus LFO
    this.chorusEffect.start();

    // Flanger effect using Tone.Phaser
    // Phaser can create flanger-like effects with appropriate settings
    this.flangerEffect = new Tone.Phaser({
      frequency: effects.flanger.rate,
      octaves: this.mapDepthToOctaves(effects.flanger.depth),
      baseFrequency: 400, // Base frequency for the phaser
      wet: effects.flanger.wetDry,
    });
  }

  /**
   * Map roomSize (0-1) to Reverb decay time (0.1-10 seconds).
   * Larger roomSize = longer decay = bigger room perception.
   */
  private mapRoomSizeToDecay(roomSize: number): number {
    // Map 0-1 to 0.1-10 seconds decay time
    const minDecay = 0.1;
    const maxDecay = 10;
    return minDecay + roomSize * (maxDecay - minDecay);
  }

  /**
   * Map depth (0-1) to Phaser octaves (0.5-5).
   * Higher depth = more octaves = more pronounced effect.
   */
  private mapDepthToOctaves(depth: number): number {
    // Map 0-1 to 0.5-5 octaves
    const minOctaves = 0.5;
    const maxOctaves = 5;
    return minOctaves + depth * (maxOctaves - minOctaves);
  }

  /**
   * Start monitoring audio context state changes.
   * This helps detect browser suspension/resumption and autoplay policies.
   */
  private startAudioContextStateMonitoring(): void {
    // Check state periodically to detect changes
    // This is needed because some browsers don't fire state change events reliably
    this.audioContextStateCheckInterval = setInterval(() => {
      if (this.isDisposed) {
        this.stopAudioContextStateMonitoring();
        return;
      }
      this.updateAudioContextState();
    }, 500); // Check every 500ms to meet the 500ms error notification requirement
  }

  /**
   * Stop monitoring audio context state.
   */
  private stopAudioContextStateMonitoring(): void {
    if (this.audioContextStateCheckInterval !== null) {
      clearInterval(this.audioContextStateCheckInterval);
      this.audioContextStateCheckInterval = null;
    }
  }

  /**
   * Update the cached audio context state and notify listeners of changes.
   */
  private updateAudioContextState(): void {
    if (!this.audioAvailable) return;

    try {
      // Access the Tone.js audio context
      const context = Tone.getContext();
      const rawContext = context.rawContext;

      let newState: AudioContextState;
      if (!rawContext) {
        newState = 'unavailable';
      } else {
        switch (rawContext.state) {
          case 'running':
            newState = 'running';
            // Clear suspended/autoplay errors when audio resumes
            if (this.lastError?.type === 'autoplay_blocked' || this.lastError?.type === 'context_suspended') {
              this.lastError = null;
            }
            break;
          case 'suspended':
            newState = 'suspended';
            break;
          case 'closed':
            newState = 'closed';
            break;
          default:
            newState = 'unavailable';
        }
      }

      // Notify listeners if state changed
      if (newState !== this.audioContextState) {
        const previousState = this.audioContextState;
        this.audioContextState = newState;
        this.notifyAudioStateChange(newState);

        // If context became suspended, create an appropriate error
        if (newState === 'suspended' && previousState === 'running') {
          this.handleError(createAudioContextError('context_suspended'));
        } else if (newState === 'closed') {
          this.audioAvailable = false;
          this.handleError(createAudioContextError('context_closed'));
        }
      }
    } catch {
      // If we can't access the context, it's unavailable
      if (this.audioContextState !== 'unavailable') {
        this.audioContextState = 'unavailable';
        this.audioAvailable = false;
        this.notifyAudioStateChange('unavailable');
      }
    }
  }

  /**
   * Handle an audio error by storing it and notifying listeners.
   * Ensures error is reported within 500ms as per Requirement 29.4.
   */
  private handleError(error: AudioContextError): void {
    this.lastError = error;
    this.notifyAudioError(error);
  }

  /**
   * Notify all registered error callbacks.
   */
  private notifyAudioError(error: AudioContextError): void {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch (e) {
        console.error('Error in audio error callback:', e);
      }
    }
  }

  /**
   * Notify all registered state change callbacks.
   */
  private notifyAudioStateChange(state: AudioContextState): void {
    for (const callback of this.stateChangeCallbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error('Error in audio state change callback:', e);
      }
    }
  }

  /**
   * Connect the audio chain with filter and effects.
   * Chain: Synth → Filter → Reverb → Delay → Chorus → Flanger → Volume → Destination
   *
   * Requirements 36.5, 36.6: Chain audio nodes and apply changes without stopping playback
   */
  private connectAudioChain(): void {
    if (!this.synth || !this.volume) return;

    // Disconnect any existing connections
    this.synth.disconnect();
    if (this.filter) this.filter.disconnect();
    if (this.reverbEffect) this.reverbEffect.disconnect();
    if (this.delayEffect) this.delayEffect.disconnect();
    if (this.chorusEffect) this.chorusEffect.disconnect();
    if (this.flangerEffect) this.flangerEffect.disconnect();

    // Build the audio chain: Synth → Filter → Effects → Volume → Destination
    // Each node in the chain is connected sequentially

    let currentNode: Tone.ToneAudioNode = this.synth;

    // Connect filter if enabled
    if (this.config.filter.enabled && this.filter) {
      currentNode.connect(this.filter);
      currentNode = this.filter;
    }

    // Connect effects in order: Reverb → Delay → Chorus → Flanger
    // Each effect is always in the chain but can be bypassed via wet=0

    // Reverb
    if (this.reverbEffect) {
      if (this.config.effects.reverb.enabled) {
        this.reverbEffect.wet.value = this.config.effects.reverb.wetDry;
      } else {
        this.reverbEffect.wet.value = 0; // Bypass by setting wet to 0
      }
      currentNode.connect(this.reverbEffect);
      currentNode = this.reverbEffect;
    }

    // Delay
    if (this.delayEffect) {
      if (this.config.effects.delay.enabled) {
        this.delayEffect.wet.value = this.config.effects.delay.wetDry;
      } else {
        this.delayEffect.wet.value = 0; // Bypass by setting wet to 0
      }
      currentNode.connect(this.delayEffect);
      currentNode = this.delayEffect;
    }

    // Chorus
    if (this.chorusEffect) {
      if (this.config.effects.chorus.enabled) {
        this.chorusEffect.wet.value = this.config.effects.chorus.wetDry;
      } else {
        this.chorusEffect.wet.value = 0; // Bypass by setting wet to 0
      }
      currentNode.connect(this.chorusEffect);
      currentNode = this.chorusEffect;
    }

    // Flanger (Phaser)
    if (this.flangerEffect) {
      if (this.config.effects.flanger.enabled) {
        this.flangerEffect.wet.value = this.config.effects.flanger.wetDry;
      } else {
        this.flangerEffect.wet.value = 0; // Bypass by setting wet to 0
      }
      currentNode.connect(this.flangerEffect);
      currentNode = this.flangerEffect;
    }

    // Connect to volume, then limiter, then to destination
    // The limiter catches any peaks that could cause distortion
    currentNode.connect(this.volume);
    if (this.limiter) {
      this.volume.connect(this.limiter);
      this.limiter.toDestination();
    } else {
      this.volume.toDestination();
    }
  }

  /**
   * Configure the synthesizer with new parameters.
   * Applies changes within 50ms without stopping playback.
   * Clears presetName when parameters are manually adjusted.
   *
   * Requirements 36.6: Apply effect changes within 50ms without stopping playback
   * Requirements 37.8: Clear presetName when parameters are manually adjusted
   *
   * @param config - Deep partial configuration to apply
   */
  configure(config: DeepPartialSynthConfig): void {
    if (this.isDisposed) return;

    // Clear presetName when manually adjusting parameters
    // Requirements: 37.8
    this.config.presetName = null;

    // Merge with existing config
    if (config.oscillatorType !== undefined) {
      this.config.oscillatorType = config.oscillatorType;
    }
    if (config.volume !== undefined) {
      this.config.volume = config.volume;
    }
    if (config.envelope !== undefined) {
      this.config.envelope = { ...this.config.envelope, ...config.envelope };
    }
    if (config.filter !== undefined) {
      this.config.filter = { ...this.config.filter, ...config.filter };
    }
    if (config.effects !== undefined) {
      this.mergeEffectsConfig(config.effects);
    }

    // Apply oscillator type change
    if (config.oscillatorType !== undefined && this.synth) {
      this.synth.set({
        oscillator: {
          type: this.config.oscillatorType,
        },
      });
    }

    // Apply volume change with real-time update
    // Apply volume change with headroom to prevent clipping
    if (config.volume !== undefined && this.volume) {
      this.volume.volume.value = volumeToDb(this.config.volume) + MASTER_HEADROOM_DB;
    }

    // Apply ADSR envelope changes
    if (config.envelope !== undefined && this.synth) {
      this.synth.set({
        envelope: {
          attack: this.config.envelope.attack,
          decay: this.config.envelope.decay,
          sustain: this.config.envelope.sustain,
          release: this.config.envelope.release,
        },
      });
    }

    // Apply filter changes
    if (config.filter !== undefined) {
      if (this.filter) {
        this.filter.type = this.config.filter.type;
        this.filter.frequency.value = this.config.filter.frequency;
      }

      // Reconnect audio chain if filter enabled state changed
      if (config.filter.enabled !== undefined) {
        this.connectAudioChain();
      }
    }

    // Apply effects changes within 50ms without stopping playback
    if (config.effects !== undefined) {
      this.applyEffectsChanges(config.effects);
    }
  }

  /**
   * Apply a preset configuration to the synthesizer.
   * Looks up the preset by name and applies all configuration values.
   * Sets presetName to track the selected preset.
   *
   * Property 27: Preset Application
   * Requirements: 37.7 - Apply all preset parameter values
   *
   * @param presetName - The name of the preset to apply
   * @returns The new complete synthesizer configuration
   */
  applyPreset(presetName: PresetName): SynthesizerConfig {
    if (this.isDisposed) {
      return { ...this.config };
    }

    const preset = getPresetByName(presetName);
    if (!preset) {
      console.warn(`Preset "${presetName}" not found`);
      return { ...this.config };
    }

    // Apply all configuration values from the preset
    // Set presetName to track the selected preset
    this.config = {
      ...preset.config,
      presetName: presetName,
    };

    // Apply oscillator type and envelope changes
    if (this.synth) {
      this.synth.set({
        oscillator: {
          type: this.config.oscillatorType,
        },
        envelope: {
          attack: this.config.envelope.attack,
          decay: this.config.envelope.decay,
          sustain: this.config.envelope.sustain,
          release: this.config.envelope.release,
        },
      });
    }

    // Apply volume change with headroom
    if (this.volume) {
      this.volume.volume.value = volumeToDb(this.config.volume) + MASTER_HEADROOM_DB;
    }

    // Apply filter changes
    if (this.filter) {
      this.filter.type = this.config.filter.type;
      this.filter.frequency.value = this.config.filter.frequency;
    }

    // Apply effects configuration from the preset
    this.applyEffectsConfig(this.config.effects);

    // Reconnect audio chain to apply filter enabled state and effects chain
    this.connectAudioChain();

    // Return the new complete configuration
    return { ...this.config };
  }

  /**
   * Merge partial effects configuration into the current config.
   */
  private mergeEffectsConfig(effects: DeepPartialEffectsConfig): void {
    if (effects.reverb !== undefined) {
      this.config.effects.reverb = { ...this.config.effects.reverb, ...effects.reverb };
    }
    if (effects.delay !== undefined) {
      this.config.effects.delay = { ...this.config.effects.delay, ...effects.delay };
    }
    if (effects.chorus !== undefined) {
      this.config.effects.chorus = { ...this.config.effects.chorus, ...effects.chorus };
    }
    if (effects.flanger !== undefined) {
      this.config.effects.flanger = { ...this.config.effects.flanger, ...effects.flanger };
    }
  }

  /**
   * Apply effects configuration changes in real-time.
   * Applies changes within 50ms without stopping playback.
   *
   * Requirements 36.6: Apply effect changes within 50ms without stopping playback
   */
  private applyEffectsChanges(effects: DeepPartialEffectsConfig): void {
    // Apply Reverb changes
    if (effects.reverb !== undefined && this.reverbEffect) {
      const reverbConfig = this.config.effects.reverb;

      // Handle enabled state - bypass by setting wet to 0
      if (effects.reverb.enabled !== undefined) {
        this.reverbEffect.wet.value = reverbConfig.enabled ? reverbConfig.wetDry : 0;
      }

      // Apply roomSize change (maps to decay)
      if (effects.reverb.roomSize !== undefined) {
        const clampedRoomSize = clampValue(reverbConfig.roomSize, REVERB_RANGES.roomSize.min, REVERB_RANGES.roomSize.max);
        this.reverbEffect.decay = this.mapRoomSizeToDecay(clampedRoomSize);
      }

      // Apply wet/dry change
      if (effects.reverb.wetDry !== undefined && reverbConfig.enabled) {
        const clampedWetDry = clampValue(reverbConfig.wetDry, REVERB_RANGES.wetDry.min, REVERB_RANGES.wetDry.max);
        this.reverbEffect.wet.value = clampedWetDry;
      }
    }

    // Apply Delay changes
    if (effects.delay !== undefined && this.delayEffect) {
      const delayConfig = this.config.effects.delay;

      // Handle enabled state
      if (effects.delay.enabled !== undefined) {
        this.delayEffect.wet.value = delayConfig.enabled ? delayConfig.wetDry : 0;
      }

      // Apply time change
      if (effects.delay.time !== undefined) {
        const clampedTime = clampValue(delayConfig.time, DELAY_RANGES.time.min, DELAY_RANGES.time.max);
        this.delayEffect.delayTime.value = clampedTime;
      }

      // Apply feedback change
      if (effects.delay.feedback !== undefined) {
        const clampedFeedback = clampValue(delayConfig.feedback, DELAY_RANGES.feedback.min, DELAY_RANGES.feedback.max);
        this.delayEffect.feedback.value = clampedFeedback;
      }

      // Apply wet/dry change
      if (effects.delay.wetDry !== undefined && delayConfig.enabled) {
        const clampedWetDry = clampValue(delayConfig.wetDry, DELAY_RANGES.wetDry.min, DELAY_RANGES.wetDry.max);
        this.delayEffect.wet.value = clampedWetDry;
      }
    }

    // Apply Chorus changes
    if (effects.chorus !== undefined && this.chorusEffect) {
      const chorusConfig = this.config.effects.chorus;

      // Handle enabled state
      if (effects.chorus.enabled !== undefined) {
        this.chorusEffect.wet.value = chorusConfig.enabled ? chorusConfig.wetDry : 0;
      }

      // Apply rate change
      if (effects.chorus.rate !== undefined) {
        const clampedRate = clampValue(chorusConfig.rate, CHORUS_RANGES.rate.min, CHORUS_RANGES.rate.max);
        this.chorusEffect.frequency.value = clampedRate;
      }

      // Apply depth change
      if (effects.chorus.depth !== undefined) {
        const clampedDepth = clampValue(chorusConfig.depth, CHORUS_RANGES.depth.min, CHORUS_RANGES.depth.max);
        this.chorusEffect.depth = clampedDepth;
      }

      // Apply wet/dry change
      if (effects.chorus.wetDry !== undefined && chorusConfig.enabled) {
        const clampedWetDry = clampValue(chorusConfig.wetDry, CHORUS_RANGES.wetDry.min, CHORUS_RANGES.wetDry.max);
        this.chorusEffect.wet.value = clampedWetDry;
      }
    }

    // Apply Flanger (Phaser) changes
    if (effects.flanger !== undefined && this.flangerEffect) {
      const flangerConfig = this.config.effects.flanger;

      // Handle enabled state
      if (effects.flanger.enabled !== undefined) {
        this.flangerEffect.wet.value = flangerConfig.enabled ? flangerConfig.wetDry : 0;
      }

      // Apply rate change
      if (effects.flanger.rate !== undefined) {
        const clampedRate = clampValue(flangerConfig.rate, FLANGER_RANGES.rate.min, FLANGER_RANGES.rate.max);
        this.flangerEffect.frequency.value = clampedRate;
      }

      // Apply depth change (maps to octaves)
      if (effects.flanger.depth !== undefined) {
        const clampedDepth = clampValue(flangerConfig.depth, FLANGER_RANGES.depth.min, FLANGER_RANGES.depth.max);
        this.flangerEffect.octaves = this.mapDepthToOctaves(clampedDepth);
      }

      // Note: Tone.Phaser doesn't have a direct feedback parameter
      // The Q parameter affects resonance which is similar but not equivalent
      // For a true flanger feedback would need a custom effect implementation

      // Apply wet/dry change
      if (effects.flanger.wetDry !== undefined && flangerConfig.enabled) {
        const clampedWetDry = clampValue(flangerConfig.wetDry, FLANGER_RANGES.wetDry.min, FLANGER_RANGES.wetDry.max);
        this.flangerEffect.wet.value = clampedWetDry;
      }
    }
  }

  /**
   * Apply a complete effects configuration.
   * Used when applying presets to set all effect parameters at once.
   *
   * Property 27: Preset Application - Apply effect configurations
   * Requirements: 37.7 - Apply all preset parameter values including effects
   */
  private applyEffectsConfig(effects: EffectsConfig): void {
    // Apply Reverb configuration
    if (this.reverbEffect) {
      const clampedRoomSize = clampValue(effects.reverb.roomSize, REVERB_RANGES.roomSize.min, REVERB_RANGES.roomSize.max);
      const clampedWetDry = clampValue(effects.reverb.wetDry, REVERB_RANGES.wetDry.min, REVERB_RANGES.wetDry.max);
      this.reverbEffect.decay = this.mapRoomSizeToDecay(clampedRoomSize);
      this.reverbEffect.wet.value = effects.reverb.enabled ? clampedWetDry : 0;
    }

    // Apply Delay configuration
    if (this.delayEffect) {
      const clampedTime = clampValue(effects.delay.time, DELAY_RANGES.time.min, DELAY_RANGES.time.max);
      const clampedFeedback = clampValue(effects.delay.feedback, DELAY_RANGES.feedback.min, DELAY_RANGES.feedback.max);
      const clampedWetDry = clampValue(effects.delay.wetDry, DELAY_RANGES.wetDry.min, DELAY_RANGES.wetDry.max);
      this.delayEffect.delayTime.value = clampedTime;
      this.delayEffect.feedback.value = clampedFeedback;
      this.delayEffect.wet.value = effects.delay.enabled ? clampedWetDry : 0;
    }

    // Apply Chorus configuration
    if (this.chorusEffect) {
      const clampedRate = clampValue(effects.chorus.rate, CHORUS_RANGES.rate.min, CHORUS_RANGES.rate.max);
      const clampedDepth = clampValue(effects.chorus.depth, CHORUS_RANGES.depth.min, CHORUS_RANGES.depth.max);
      const clampedWetDry = clampValue(effects.chorus.wetDry, CHORUS_RANGES.wetDry.min, CHORUS_RANGES.wetDry.max);
      this.chorusEffect.frequency.value = clampedRate;
      this.chorusEffect.depth = clampedDepth;
      this.chorusEffect.wet.value = effects.chorus.enabled ? clampedWetDry : 0;
    }

    // Apply Flanger (Phaser) configuration
    if (this.flangerEffect) {
      const clampedRate = clampValue(effects.flanger.rate, FLANGER_RANGES.rate.min, FLANGER_RANGES.rate.max);
      const clampedDepth = clampValue(effects.flanger.depth, FLANGER_RANGES.depth.min, FLANGER_RANGES.depth.max);
      const clampedWetDry = clampValue(effects.flanger.wetDry, FLANGER_RANGES.wetDry.min, FLANGER_RANGES.wetDry.max);
      this.flangerEffect.frequency.value = clampedRate;
      this.flangerEffect.octaves = this.mapDepthToOctaves(clampedDepth);
      this.flangerEffect.wet.value = effects.flanger.enabled ? clampedWetDry : 0;
    }
  }

  /**
   * Get the current synthesizer configuration.
   */
  getConfig(): SynthesizerConfig {
    return { ...this.config };
  }

  /**
   * Calculate the end time of the melody (last note end time).
   */
  private calculateMelodyEndTime(notes: Note[]): number {
    if (notes.length === 0) return 0;
    return Math.max(...notes.map((note) => note.start + note.duration));
  }

  /**
   * Schedule all notes for playback using Tone.js Transport.
   * Only schedules notes that start at or after the current position.
   */
  private scheduleNotes(notes: Note[], startPosition: number): void {
    if (!this.synth) return;

    // Clear any previously scheduled events
    this.clearScheduledEvents();

    // Filter notes that should be played (start time >= startPosition)
    // or notes that are currently sounding (start < position but end > position)
    const notesToSchedule = notes.filter(
      (note) => note.start + note.duration > startPosition
    );

    for (const note of notesToSchedule) {
      const noteName = midiToNoteName(note.pitch);
      const noteStartInBeats = note.start;
      const noteDurationInBeats = note.duration;

      // Calculate when to trigger the note relative to current transport position
      // If note has already started, we need to handle partial playback
      if (noteStartInBeats < startPosition) {
        // Note is already in progress - trigger immediately with remaining duration
        const remainingDuration = noteDurationInBeats - (startPosition - noteStartInBeats);
        if (remainingDuration > 0) {
          const eventId = Tone.getTransport().scheduleOnce(
            (time) => {
              this.synth?.triggerAttackRelease(
                noteName,
                remainingDuration * Tone.Time('4n').toSeconds(),
                time,
                note.velocity
              );
            },
            0
          );
          this.scheduledEvents.push(eventId);
        }
      } else {
        // Schedule the note at its designated time
        const scheduledTime = (noteStartInBeats - startPosition) * Tone.Time('4n').toSeconds();
        const eventId = Tone.getTransport().scheduleOnce(
          (time) => {
            this.synth?.triggerAttackRelease(
              noteName,
              noteDurationInBeats * Tone.Time('4n').toSeconds(),
              time,
              note.velocity
            );
          },
          scheduledTime
        );
        this.scheduledEvents.push(eventId);
      }
    }

    // Schedule loop restart or stop at end of melody
    if (this.melodyEndTime > startPosition) {
      const endScheduledTime = (this.melodyEndTime - startPosition) * Tone.Time('4n').toSeconds();
      const endEventId = Tone.getTransport().scheduleOnce(
        () => {
          this.handleMelodyEnd();
        },
        endScheduledTime
      );
      this.scheduledEvents.push(endEventId);
    }
  }

  /**
   * Handle reaching the end of the melody.
   * Either loops or stops based on loop mode.
   */
  private handleMelodyEnd(): void {
    if (this.isDisposed || this.playbackState !== 'playing') return;

    if (this.loopEnabled && this.currentNotes.length > 0) {
      // Loop mode: restart from position zero
      // Req 15.2: loop restarts from zero at end within 50ms
      Tone.getTransport().stop();
      this.playheadPosition = 0;

      // Reset playback tracking for accurate position calculation
      this.playbackStartPosition = 0;
      this.playbackStartTime = Tone.now();

      this.notifyPlayheadUpdate(0);

      // Re-schedule notes from the beginning
      Tone.getTransport().position = 0;
      this.scheduleNotes(this.currentNotes, 0);
      Tone.getTransport().start();
    } else {
      // No loop: stop playback
      // Req 15.3: disabled loop stops at end
      this.internalStop(false); // Don't reset position, keep at end
      this.playheadPosition = this.melodyEndTime;
      this.notifyPlayheadUpdate(this.melodyEndTime);
      this.playbackState = 'stopped';
    }
  }

  /**
   * Clear all scheduled events from the Transport.
   */
  private clearScheduledEvents(): void {
    for (const eventId of this.scheduledEvents) {
      Tone.getTransport().clear(eventId);
    }
    this.scheduledEvents = [];
  }

  /**
   * Start playhead position updates using Tone.Draw for synchronization.
   * Uses Tone.Draw to ensure visual updates are synchronized with audio
   * within 50ms accuracy as required by 8.4, 29.1, 29.2, 29.3.
   *
   * The synchronization approach:
   * 1. Uses requestAnimationFrame for 60fps visual updates (Req 8.2)
   * 2. Uses Tone.Draw.schedule to align visual callbacks with audio timing
   * 3. Calculates position based on audio context time for accuracy
   */
  private startPlayheadUpdates(): void {
    if (this.playheadUpdateId !== null) return;

    // Store the start time and position for accurate calculation
    this.playbackStartPosition = this.playheadPosition;
    this.playbackStartTime = Tone.now();

    const updatePlayhead = () => {
      if (this.playbackState !== 'playing' || this.isDisposed) {
        this.playheadUpdateId = null;
        return;
      }

      // Use Tone.Draw to schedule visual update synchronized with audio
      // This ensures the visual update happens at the same time as audio events
      // providing ≤50ms latency between audio and visual (Req 8.4)
      Tone.getDraw().schedule(() => {
        if (this.playbackState !== 'playing' || this.isDisposed) {
          return;
        }

        // Calculate current position based on elapsed audio context time
        // Using audio context time provides more accurate synchronization than transport.seconds
        const elapsedSeconds = Tone.now() - this.playbackStartTime;
        const quarterNoteSeconds = Tone.Time('4n').toSeconds();
        const elapsedBeats = elapsedSeconds / quarterNoteSeconds;
        const currentPositionInBeats = this.playbackStartPosition + elapsedBeats;

        // Update stored position and notify callbacks
        this.playheadPosition = currentPositionInBeats;
        this.notifyPlayheadUpdate(currentPositionInBeats);
      }, Tone.now());

      // Continue updating at 60fps using requestAnimationFrame (Req 8.2)
      this.playheadUpdateId = requestAnimationFrame(updatePlayhead);
    };

    // Start the update loop immediately
    this.playheadUpdateId = requestAnimationFrame(updatePlayhead);
  }

  /**
   * Stop playhead updates.
   */
  private stopPlayheadUpdates(): void {
    if (this.playheadUpdateId !== null) {
      cancelAnimationFrame(this.playheadUpdateId);
      this.playheadUpdateId = null;
    }
  }

  /**
   * Notify all registered callbacks of playhead position update.
   */
  private notifyPlayheadUpdate(position: number): void {
    for (const callback of this.playheadCallbacks) {
      callback(position);
    }
  }

  /**
   * Internal stop method that silences all notes.
   */
  private internalStop(resetPosition: boolean): void {
    // Stop the transport
    Tone.getTransport().stop();
    Tone.getTransport().cancel();

    // Clear scheduled events
    this.clearScheduledEvents();

    // Stop playhead updates
    this.stopPlayheadUpdates();

    // Release all currently playing notes
    // Req 14.1: stop silences within 50ms
    if (this.synth) {
      this.synth.releaseAll();
    }

    if (resetPosition) {
      // Req 14.2: stop resets to position zero
      this.playheadPosition = 0;
      Tone.getTransport().position = 0;
      this.notifyPlayheadUpdate(0);
    }
  }

  /**
   * Play notes from the specified position.
   * Implements requirements 13.1, 13.3, 13.4, 13.5, 13.6
   * Also handles audio context errors including autoplay blocking.
   *
   * @param notes - Array of notes to play
   * @param startPosition - Position in beats to start from
   * @param loop - Whether to loop playback
   */
  play(notes: Note[], startPosition: number, loop: boolean): void {
    if (this.isDisposed) return;

    // Check if audio is available
    if (!this.audioAvailable) {
      this.handleError(createAudioContextError('not_supported'));
      return;
    }

    // Req 13.5: empty melody stays stopped
    if (notes.length === 0) {
      this.playbackState = 'stopped';
      this.playheadPosition = 0;
      this.notifyPlayheadUpdate(0);
      return;
    }

    // Store current notes and loop state
    this.currentNotes = [...notes];
    this.loopEnabled = loop;
    this.melodyEndTime = this.calculateMelodyEndTime(notes);

    // Req 13.4: if playhead past last note, reset to zero
    let effectiveStartPosition = startPosition;
    if (startPosition >= this.melodyEndTime) {
      effectiveStartPosition = 0;
    }

    this.playheadPosition = effectiveStartPosition;

    // Ensure audio context is started (required for web audio)
    // This handles autoplay policy by requesting user gesture
    Tone.start()
      .then(() => {
        if (this.isDisposed) return;

        // Update audio context state after starting
        this.updateAudioContextState();

        // Clear autoplay errors since we successfully started
        if (this.lastError?.type === 'autoplay_blocked') {
          this.lastError = null;
        }

        // Stop any current playback
        this.internalStop(false);

        // Reset transport position
        Tone.getTransport().position = 0;

        // Schedule notes
        this.scheduleNotes(this.currentNotes, effectiveStartPosition);

        // Start transport
        // Req 13.6: trigger within 50ms of scheduled time
        Tone.getTransport().start();

        // Update state
        this.playbackState = 'playing';

        // Start playhead updates
        this.startPlayheadUpdates();
      })
      .catch((error: Error) => {
        // Handle autoplay policy or other start errors
        const errorType = detectAudioErrorType(error);
        const audioError = createAudioContextError(errorType, error);
        this.handleError(audioError);

        // If it's an autoplay error, the audio context is likely suspended
        if (errorType === 'autoplay_blocked') {
          this.audioContextState = 'suspended';
          this.notifyAudioStateChange('suspended');
        }
      });
  }

  /**
   * Pause playback, maintaining current position.
   * Implements requirements 13.2, 13.3
   */
  pause(): void {
    if (this.isDisposed) return;
    if (this.playbackState !== 'playing') return;

    // Get current position before stopping
    const transportSeconds = Tone.getTransport().seconds;
    const currentPositionInBeats =
      transportSeconds / Tone.Time('4n').toSeconds();

    // Req 13.2: pause stops notes and maintains position
    this.playheadPosition = this.playheadPosition + currentPositionInBeats;

    // Stop transport but don't reset
    Tone.getTransport().pause();

    // Release all currently playing notes
    if (this.synth) {
      this.synth.releaseAll();
    }

    // Clear scheduled events
    this.clearScheduledEvents();

    // Stop playhead updates
    this.stopPlayheadUpdates();

    // Update state
    this.playbackState = 'paused';

    // Notify of final position
    this.notifyPlayheadUpdate(this.playheadPosition);
  }

  /**
   * Stop playback and reset to position zero.
   * Implements requirements 14.1, 14.2, 14.3
   */
  stop(): void {
    if (this.isDisposed) return;

    // Req 14.3: stop while not playing resets without error
    // Req 14.1: stop silences within 50ms
    // Req 14.2: stop resets to position zero
    this.internalStop(true);

    // Update state
    this.playbackState = 'stopped';
    this.currentNotes = [];
  }

  /**
   * Set the playhead position.
   * Updates tracking state for accurate audio-visual synchronization.
   *
   * @param position - Position in beats
   */
  setPlayheadPosition(position: number): void {
    if (this.isDisposed) return;

    // Clamp to non-negative
    const clampedPosition = Math.max(0, position);
    this.playheadPosition = clampedPosition;

    // If currently playing, reschedule notes from new position
    if (this.playbackState === 'playing') {
      this.internalStop(false);

      // Reset playback tracking for accurate position calculation after seek
      this.playbackStartPosition = clampedPosition;
      this.playbackStartTime = Tone.now();

      Tone.getTransport().position = 0;
      this.scheduleNotes(this.currentNotes, clampedPosition);
      Tone.getTransport().start();
      this.startPlayheadUpdates();
    }

    this.notifyPlayheadUpdate(clampedPosition);
  }

  /**
   * Register a callback for playhead position updates.
   *
   * @param callback - Function to call with updated position
   */
  onPlayheadUpdate(callback: (position: number) => void): void {
    this.playheadCallbacks.push(callback);
  }

  /**
   * Remove a playhead update callback.
   *
   * @param callback - Function to remove
   */
  offPlayheadUpdate(callback: (position: number) => void): void {
    const index = this.playheadCallbacks.indexOf(callback);
    if (index !== -1) {
      this.playheadCallbacks.splice(index, 1);
    }
  }

  /**
   * Trigger a single note for preview purposes.
   * Handles audio context errors including autoplay blocking.
   *
   * @param note - The note to trigger
   */
  triggerNote(note: Note): void {
    if (this.isDisposed || !this.synth) return;

    // Check if audio is available
    if (!this.audioAvailable) {
      this.handleError(createAudioContextError('not_supported'));
      return;
    }

    // Ensure audio context is started
    Tone.start()
      .then(() => {
        if (this.isDisposed || !this.synth) return;

        // Update audio context state
        this.updateAudioContextState();

        // Clear autoplay errors since we successfully started
        if (this.lastError?.type === 'autoplay_blocked') {
          this.lastError = null;
        }

        const noteName = midiToNoteName(note.pitch);
        // Convert duration from beats to seconds
        const durationInSeconds = note.duration * Tone.Time('4n').toSeconds();

        // Trigger the note immediately
        this.synth.triggerAttackRelease(
          noteName,
          durationInSeconds,
          Tone.now(),
          note.velocity
        );
      })
      .catch((error: Error) => {
        // Handle autoplay policy or other start errors
        const errorType = detectAudioErrorType(error);
        const audioError = createAudioContextError(errorType, error);
        this.handleError(audioError);
      });
  }

  /**
   * Get the current playback state.
   */
  getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  /**
   * Get the current playhead position in beats.
   * Returns the stored position which is updated via Tone.Draw at 60fps.
   */
  getPlayheadPosition(): number {
    return this.playheadPosition;
  }

  /**
   * Get the current real-time playhead position in beats.
   * Calculates the position based on audio context time for immediate access.
   * This provides accurate position even between frame updates.
   * Useful for UI components that need instant position feedback.
   */
  getRealTimePlayheadPosition(): number {
    if (this.playbackState !== 'playing') {
      return this.playheadPosition;
    }

    // Calculate current position based on elapsed audio context time
    const elapsedSeconds = Tone.now() - this.playbackStartTime;
    const quarterNoteSeconds = Tone.Time('4n').toSeconds();
    const elapsedBeats = elapsedSeconds / quarterNoteSeconds;
    return this.playbackStartPosition + elapsedBeats;
  }

  /**
   * Check if loop mode is enabled.
   */
  isLooping(): boolean {
    return this.loopEnabled;
  }

  /**
   * Set loop mode.
   * Implements requirement 15.1
   *
   * @param enabled - Whether to enable loop mode
   */
  setLoopEnabled(enabled: boolean): void {
    this.loopEnabled = enabled;
  }

  /**
   * Set the tempo in BPM.
   * This affects the playback speed of notes.
   * Changes apply immediately during playback without restart.
   *
   * Requirements:
   * - 44.4: Apply tempo changes immediately
   * - 44.5: Support real-time tempo changes during active playback
   *
   * Design: Tempo control via Tone.getTransport().bpm.value, clamped to 40-240 BPM range
   *
   * @param bpm - Tempo in beats per minute (40-240)
   */
  setTempo(bpm: number): void {
    if (this.isDisposed) return;

    // Clamp tempo to valid range: 40-240 BPM
    // Requirements: 44.2 - Range from 40 BPM to 240 BPM
    const clampedBpm = Math.max(40, Math.min(240, bpm));

    // Set Tone.js Transport BPM - this applies immediately during playback
    // Tone.js Transport automatically adjusts playback speed when bpm.value changes
    Tone.getTransport().bpm.value = clampedBpm;
  }

  /**
   * Get the current tempo in BPM.
   *
   * Requirements:
   * - 44.4, 44.5: Support tempo control and querying
   *
   * @returns Current tempo in beats per minute (40-240)
   */
  getTempo(): number {
    return Tone.getTransport().bpm.value;
  }

  /**
   * Clean up all audio resources.
   * Must be called when the engine is no longer needed.
   */
  dispose(): void {
    if (this.isDisposed) return;

    // Stop everything first
    this.internalStop(true);

    // Stop audio context state monitoring
    this.stopAudioContextStateMonitoring();

    this.isDisposed = true;
    this.playheadCallbacks = [];
    this.errorCallbacks = [];
    this.stateChangeCallbacks = [];
    this.currentNotes = [];

    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }

    if (this.filter) {
      this.filter.dispose();
      this.filter = null;
    }

    // Dispose effect nodes
    if (this.reverbEffect) {
      this.reverbEffect.dispose();
      this.reverbEffect = null;
    }

    if (this.delayEffect) {
      this.delayEffect.dispose();
      this.delayEffect = null;
    }

    if (this.chorusEffect) {
      this.chorusEffect.dispose();
      this.chorusEffect = null;
    }

    if (this.flangerEffect) {
      this.flangerEffect.dispose();
      this.flangerEffect = null;
    }

    if (this.volume) {
      this.volume.dispose();
      this.volume = null;
    }

    if (this.limiter) {
      this.limiter.dispose();
      this.limiter = null;
    }
  }

  /**
   * Check if the engine has been disposed.
   */
  get disposed(): boolean {
    return this.isDisposed;
  }

  // ============================================================================
  // Audio Error Handling Methods
  // Requirements: 29.4 - Display error message within 500ms when audio subsystem is unavailable
  // Design: Error Handling - Audio Error Handling section
  // ============================================================================

  /**
   * Get the last audio error that occurred, if any.
   *
   * @returns The last AudioContextError or null if no error
   */
  getLastError(): AudioContextError | null {
    return this.lastError;
  }

  /**
   * Get the current audio context state.
   *
   * @returns The current AudioContextState
   */
  getAudioContextState(): AudioContextState {
    // Update state before returning to ensure accuracy
    if (this.audioAvailable && !this.isDisposed) {
      this.updateAudioContextState();
    }
    return this.audioContextState;
  }

  /**
   * Check if audio is available for playback.
   * Returns false if Web Audio is not supported or the context is closed.
   *
   * @returns true if audio can potentially be played
   */
  isAudioAvailable(): boolean {
    return this.audioAvailable && this.audioContextState !== 'closed';
  }

  /**
   * Register a callback for audio errors.
   * The callback will be called whenever an audio error occurs.
   *
   * @param callback - Function to call with the error
   */
  onAudioError(callback: AudioErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Remove an audio error callback.
   *
   * @param callback - The callback to remove
   */
  offAudioError(callback: AudioErrorCallback): void {
    const index = this.errorCallbacks.indexOf(callback);
    if (index !== -1) {
      this.errorCallbacks.splice(index, 1);
    }
  }

  /**
   * Register a callback for audio context state changes.
   * The callback will be called whenever the audio context state changes.
   *
   * @param callback - Function to call with the new state
   */
  onAudioStateChange(callback: AudioStateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Remove an audio state change callback.
   *
   * @param callback - The callback to remove
   */
  offAudioStateChange(callback: AudioStateChangeCallback): void {
    const index = this.stateChangeCallbacks.indexOf(callback);
    if (index !== -1) {
      this.stateChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Attempt to resume the audio context.
   * This is useful after autoplay blocking or browser suspension.
   * Typically called in response to a user interaction.
   *
   * @returns Promise that resolves to true if resumed successfully, false otherwise
   */
  async resumeAudioContext(): Promise<boolean> {
    if (this.isDisposed || !this.audioAvailable) {
      return false;
    }

    try {
      // Use Tone.start() to resume the audio context
      // This handles both starting and resuming
      await Tone.start();

      // Update state after resuming
      this.updateAudioContextState();

      // Clear any autoplay or suspension errors
      if (
        this.lastError?.type === 'autoplay_blocked' ||
        this.lastError?.type === 'context_suspended'
      ) {
        this.lastError = null;
      }

      return this.audioContextState === 'running';
    } catch (error) {
      // Handle resume failure
      const errorType = detectAudioErrorType(error instanceof Error ? error : new Error(String(error)));
      const audioError = createAudioContextError(
        errorType,
        error instanceof Error ? error : new Error(String(error))
      );
      this.handleError(audioError);
      return false;
    }
  }

  /**
   * Clear the current error state.
   * Useful after the user has acknowledged an error.
   */
  clearError(): void {
    this.lastError = null;
  }
}
