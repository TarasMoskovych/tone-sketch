/**
 * Synthesizer Presets
 *
 * Defines all 35 presets across 7 categories for the Tone Sketch synthesizer.
 * Each preset provides a complete synthesizer configuration including oscillator,
 * ADSR envelope, filter, and effects settings.
 *
 * Categories (5 presets each):
 * - Piano: longer attack, smooth sustain, moderate release
 * - Lead: quick attack, high sustain, medium release, brighter filter
 * - Pluck: quick attack, short decay, low sustain, quick release
 * - Guitar: moderate attack, medium sustain, medium release
 * - Bass: quick attack, full sustain, short release, lower filter frequency
 * - Strings: slow attack, high sustain, slow release, warm tone
 * - Pads: very slow attack, full sustain, long release, atmospheric
 */

import type {
  SynthPreset,
  PresetName,
  PresetCategory,
  EffectsConfig,
} from '@/types/synth';

/**
 * Default effects configuration with all effects disabled.
 */
const defaultEffectsOff: EffectsConfig = {
  reverb: { enabled: false, roomSize: 0.5, wetDry: 0.3 },
  delay: { enabled: false, time: 0.25, feedback: 0.3, wetDry: 0.3 },
  chorus: { enabled: false, rate: 1.5, depth: 0.5, wetDry: 0.3 },
  flanger: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.5, wetDry: 0.3 },
};

// ============================================================================
// Piano Presets (5)
// Characteristics: longer attack, smooth sustain, moderate release
// ============================================================================

const acousticPiano: SynthPreset = {
  name: 'Acoustic Piano',
  category: 'Piano',
  config: {
    oscillatorType: 'triangle',
    volume: 0.8,
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
    filter: { enabled: true, type: 'lowpass', frequency: 5000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.6, wetDry: 0.25 },
    },
  },
};

const electricPiano: SynthPreset = {
  name: 'Electric Piano',
  category: 'Piano',
  config: {
    oscillatorType: 'sine',
    volume: 0.75,
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.35, release: 0.6 },
    filter: { enabled: true, type: 'lowpass', frequency: 4000 },
    effects: {
      ...defaultEffectsOff,
      chorus: { enabled: true, rate: 1.2, depth: 0.4, wetDry: 0.25 },
      reverb: { enabled: true, roomSize: 0.4, wetDry: 0.2 },
    },
  },
};

const softPiano: SynthPreset = {
  name: 'Soft Piano',
  category: 'Piano',
  config: {
    oscillatorType: 'sine',
    volume: 0.7,
    envelope: { attack: 0.05, decay: 0.5, sustain: 0.3, release: 1.0 },
    filter: { enabled: true, type: 'lowpass', frequency: 2500 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.7, wetDry: 0.35 },
    },
  },
};

const brightPiano: SynthPreset = {
  name: 'Bright Piano',
  category: 'Piano',
  config: {
    oscillatorType: 'triangle',
    volume: 0.8,
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.7 },
    filter: { enabled: true, type: 'lowpass', frequency: 8000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.5, wetDry: 0.2 },
    },
  },
};

const warmPiano: SynthPreset = {
  name: 'Warm Piano',
  category: 'Piano',
  config: {
    oscillatorType: 'sine',
    volume: 0.75,
    envelope: { attack: 0.03, decay: 0.4, sustain: 0.45, release: 0.9 },
    filter: { enabled: true, type: 'lowpass', frequency: 3000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.65, wetDry: 0.3 },
      chorus: { enabled: true, rate: 0.8, depth: 0.2, wetDry: 0.15 },
    },
  },
};

// ============================================================================
// Lead Presets (5)
// Characteristics: quick attack, high sustain, medium release, brighter filter
// ============================================================================

const classicLead: SynthPreset = {
  name: 'Classic Lead',
  category: 'Lead',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.75,
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.4 },
    filter: { enabled: true, type: 'lowpass', frequency: 8000 },
    effects: {
      ...defaultEffectsOff,
      delay: { enabled: true, time: 0.3, feedback: 0.25, wetDry: 0.2 },
    },
  },
};

const sawLead: SynthPreset = {
  name: 'Saw Lead',
  category: 'Lead',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.7,
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.85, release: 0.35 },
    filter: { enabled: true, type: 'lowpass', frequency: 10000 },
    effects: {
      ...defaultEffectsOff,
      chorus: { enabled: true, rate: 2.0, depth: 0.3, wetDry: 0.2 },
    },
  },
};

const squareLead: SynthPreset = {
  name: 'Square Lead',
  category: 'Lead',
  config: {
    oscillatorType: 'square',
    volume: 0.65,
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 },
    filter: { enabled: true, type: 'lowpass', frequency: 6000 },
    effects: {
      ...defaultEffectsOff,
      delay: { enabled: true, time: 0.25, feedback: 0.3, wetDry: 0.25 },
      reverb: { enabled: true, roomSize: 0.3, wetDry: 0.15 },
    },
  },
};

const sineLead: SynthPreset = {
  name: 'Sine Lead',
  category: 'Lead',
  config: {
    oscillatorType: 'sine',
    volume: 0.8,
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.4 },
    filter: { enabled: true, type: 'lowpass', frequency: 12000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.4, wetDry: 0.2 },
      delay: { enabled: true, time: 0.2, feedback: 0.2, wetDry: 0.15 },
    },
  },
};

const detunedLead: SynthPreset = {
  name: 'Detuned Lead',
  category: 'Lead',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.7,
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.85, release: 0.4 },
    filter: { enabled: true, type: 'lowpass', frequency: 7000 },
    effects: {
      ...defaultEffectsOff,
      chorus: { enabled: true, rate: 3.0, depth: 0.6, wetDry: 0.35 },
      reverb: { enabled: true, roomSize: 0.35, wetDry: 0.2 },
    },
  },
};

// ============================================================================
// Pluck Presets (5)
// Characteristics: quick attack, short decay, low sustain, quick release
// ============================================================================

const shortPluck: SynthPreset = {
  name: 'Short Pluck',
  category: 'Pluck',
  config: {
    oscillatorType: 'triangle',
    volume: 0.8,
    envelope: { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.15 },
    filter: { enabled: true, type: 'lowpass', frequency: 7000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.4, wetDry: 0.2 },
    },
  },
};

const softPluck: SynthPreset = {
  name: 'Soft Pluck',
  category: 'Pluck',
  config: {
    oscillatorType: 'sine',
    volume: 0.75,
    envelope: { attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.25 },
    filter: { enabled: true, type: 'lowpass', frequency: 4000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.5, wetDry: 0.3 },
      delay: { enabled: true, time: 0.2, feedback: 0.2, wetDry: 0.15 },
    },
  },
};

const brightPluck: SynthPreset = {
  name: 'Bright Pluck',
  category: 'Pluck',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.7,
    envelope: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.1 },
    filter: { enabled: true, type: 'lowpass', frequency: 12000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.35, wetDry: 0.25 },
    },
  },
};

const bellPluck: SynthPreset = {
  name: 'Bell Pluck',
  category: 'Pluck',
  config: {
    oscillatorType: 'sine',
    volume: 0.75,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.2, release: 0.5 },
    filter: { enabled: true, type: 'lowpass', frequency: 6000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.6, wetDry: 0.35 },
      delay: { enabled: true, time: 0.3, feedback: 0.25, wetDry: 0.2 },
    },
  },
};

const mutedPluck: SynthPreset = {
  name: 'Muted Pluck',
  category: 'Pluck',
  config: {
    oscillatorType: 'triangle',
    volume: 0.7,
    envelope: { attack: 0.001, decay: 0.08, sustain: 0.05, release: 0.08 },
    filter: { enabled: true, type: 'lowpass', frequency: 2500 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.3, wetDry: 0.15 },
    },
  },
};

// ============================================================================
// Guitar Presets (5)
// Characteristics: moderate attack, medium sustain, medium release
// ============================================================================

const cleanGuitar: SynthPreset = {
  name: 'Clean Guitar',
  category: 'Guitar',
  config: {
    oscillatorType: 'triangle',
    volume: 0.75,
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.4 },
    filter: { enabled: true, type: 'lowpass', frequency: 5000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.4, wetDry: 0.2 },
      chorus: { enabled: true, rate: 1.0, depth: 0.3, wetDry: 0.15 },
    },
  },
};

const mutedGuitar: SynthPreset = {
  name: 'Muted Guitar',
  category: 'Guitar',
  config: {
    oscillatorType: 'square',
    volume: 0.7,
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.2, release: 0.15 },
    filter: { enabled: true, type: 'lowpass', frequency: 2000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.25, wetDry: 0.1 },
    },
  },
};

const acousticGuitar: SynthPreset = {
  name: 'Acoustic Guitar',
  category: 'Guitar',
  config: {
    oscillatorType: 'triangle',
    volume: 0.8,
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.4, release: 0.5 },
    filter: { enabled: true, type: 'lowpass', frequency: 6000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.5, wetDry: 0.25 },
    },
  },
};

const nylonGuitar: SynthPreset = {
  name: 'Nylon Guitar',
  category: 'Guitar',
  config: {
    oscillatorType: 'sine',
    volume: 0.75,
    envelope: { attack: 0.008, decay: 0.35, sustain: 0.35, release: 0.45 },
    filter: { enabled: true, type: 'lowpass', frequency: 4000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.55, wetDry: 0.3 },
    },
  },
};

const steelGuitar: SynthPreset = {
  name: 'Steel Guitar',
  category: 'Guitar',
  config: {
    oscillatorType: 'triangle',
    volume: 0.8,
    envelope: { attack: 0.003, decay: 0.3, sustain: 0.45, release: 0.5 },
    filter: { enabled: true, type: 'lowpass', frequency: 7000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.45, wetDry: 0.2 },
      chorus: { enabled: true, rate: 0.8, depth: 0.2, wetDry: 0.1 },
    },
  },
};

// ============================================================================
// Bass Presets (5)
// Characteristics: quick attack, full sustain, short release, lower filter
// ============================================================================

const subBass: SynthPreset = {
  name: 'Sub Bass',
  category: 'Bass',
  config: {
    oscillatorType: 'sine',
    volume: 0.85,
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.95, release: 0.2 },
    filter: { enabled: true, type: 'lowpass', frequency: 500 },
    effects: defaultEffectsOff,
  },
};

const synthBass: SynthPreset = {
  name: 'Synth Bass',
  category: 'Bass',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.75,
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.85, release: 0.15 },
    filter: { enabled: true, type: 'lowpass', frequency: 1200 },
    effects: {
      ...defaultEffectsOff,
      chorus: { enabled: true, rate: 0.8, depth: 0.2, wetDry: 0.1 },
    },
  },
};

const punchyBass: SynthPreset = {
  name: 'Punchy Bass',
  category: 'Bass',
  config: {
    oscillatorType: 'square',
    volume: 0.8,
    envelope: { attack: 0.001, decay: 0.2, sustain: 0.7, release: 0.1 },
    filter: { enabled: true, type: 'lowpass', frequency: 800 },
    effects: {
      ...defaultEffectsOff,
      delay: { enabled: true, time: 0.1, feedback: 0.15, wetDry: 0.1 },
    },
  },
};

const warmBass: SynthPreset = {
  name: 'Warm Bass',
  category: 'Bass',
  config: {
    oscillatorType: 'sine',
    volume: 0.8,
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.9, release: 0.25 },
    filter: { enabled: true, type: 'lowpass', frequency: 600 },
    effects: {
      ...defaultEffectsOff,
      chorus: { enabled: true, rate: 0.5, depth: 0.15, wetDry: 0.1 },
    },
  },
};

const growlBass: SynthPreset = {
  name: 'Growl Bass',
  category: 'Bass',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.75,
    envelope: { attack: 0.005, decay: 0.25, sustain: 0.75, release: 0.15 },
    filter: { enabled: true, type: 'lowpass', frequency: 1500 },
    effects: {
      ...defaultEffectsOff,
      flanger: { enabled: true, rate: 0.3, depth: 0.4, feedback: 0.3, wetDry: 0.15 },
    },
  },
};

// ============================================================================
// Strings Presets (5)
// Characteristics: slow attack, high sustain, slow release, warm tone
// ============================================================================

const violin: SynthPreset = {
  name: 'Violin',
  category: 'Strings',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.7,
    envelope: { attack: 0.15, decay: 0.2, sustain: 0.85, release: 0.4 },
    filter: { enabled: true, type: 'lowpass', frequency: 5000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.5, wetDry: 0.25 },
      chorus: { enabled: true, rate: 5.0, depth: 0.15, wetDry: 0.1 },
    },
  },
};

const cello: SynthPreset = {
  name: 'Cello',
  category: 'Strings',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.75,
    envelope: { attack: 0.2, decay: 0.25, sustain: 0.8, release: 0.5 },
    filter: { enabled: true, type: 'lowpass', frequency: 3000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.55, wetDry: 0.3 },
      chorus: { enabled: true, rate: 4.0, depth: 0.12, wetDry: 0.08 },
    },
  },
};

const stringEnsemble: SynthPreset = {
  name: 'String Ensemble',
  category: 'Strings',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.7,
    envelope: { attack: 0.3, decay: 0.3, sustain: 0.75, release: 0.6 },
    filter: { enabled: true, type: 'lowpass', frequency: 4000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.7, wetDry: 0.35 },
      chorus: { enabled: true, rate: 2.5, depth: 0.4, wetDry: 0.25 },
    },
  },
};

const soloStrings: SynthPreset = {
  name: 'Solo Strings',
  category: 'Strings',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.75,
    envelope: { attack: 0.12, decay: 0.2, sustain: 0.85, release: 0.45 },
    filter: { enabled: true, type: 'lowpass', frequency: 5500 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.45, wetDry: 0.2 },
      chorus: { enabled: true, rate: 5.5, depth: 0.18, wetDry: 0.12 },
    },
  },
};

const pizzicato: SynthPreset = {
  name: 'Pizzicato',
  category: 'Strings',
  config: {
    oscillatorType: 'triangle',
    volume: 0.8,
    envelope: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.2 },
    filter: { enabled: true, type: 'lowpass', frequency: 4500 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.5, wetDry: 0.25 },
    },
  },
};

// ============================================================================
// Pads Presets (5)
// Characteristics: very slow attack, full sustain, long release, atmospheric
// ============================================================================

const warmPad: SynthPreset = {
  name: 'Warm Pad',
  category: 'Pads',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.65,
    envelope: { attack: 0.5, decay: 0.4, sustain: 0.8, release: 1.5 },
    filter: { enabled: true, type: 'lowpass', frequency: 3000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.8, wetDry: 0.4 },
      chorus: { enabled: true, rate: 0.8, depth: 0.5, wetDry: 0.3 },
    },
  },
};

const ambientPad: SynthPreset = {
  name: 'Ambient Pad',
  category: 'Pads',
  config: {
    oscillatorType: 'sine',
    volume: 0.6,
    envelope: { attack: 0.8, decay: 0.5, sustain: 0.7, release: 2.0 },
    filter: { enabled: true, type: 'lowpass', frequency: 2500 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.9, wetDry: 0.5 },
      delay: { enabled: true, time: 0.4, feedback: 0.4, wetDry: 0.25 },
    },
  },
};

const choirPad: SynthPreset = {
  name: 'Choir Pad',
  category: 'Pads',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.6,
    envelope: { attack: 0.6, decay: 0.4, sustain: 0.75, release: 1.2 },
    filter: { enabled: true, type: 'lowpass', frequency: 3500 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.75, wetDry: 0.4 },
      chorus: { enabled: true, rate: 1.2, depth: 0.6, wetDry: 0.35 },
    },
  },
};

const sweepPad: SynthPreset = {
  name: 'Sweep Pad',
  category: 'Pads',
  config: {
    oscillatorType: 'sawtooth',
    volume: 0.65,
    envelope: { attack: 0.7, decay: 0.5, sustain: 0.7, release: 1.8 },
    filter: { enabled: true, type: 'lowpass', frequency: 4000 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.7, wetDry: 0.35 },
      flanger: { enabled: true, rate: 0.2, depth: 0.6, feedback: 0.4, wetDry: 0.3 },
    },
  },
};

const darkPad: SynthPreset = {
  name: 'Dark Pad',
  category: 'Pads',
  config: {
    oscillatorType: 'square',
    volume: 0.55,
    envelope: { attack: 0.9, decay: 0.6, sustain: 0.65, release: 2.5 },
    filter: { enabled: true, type: 'lowpass', frequency: 1500 },
    effects: {
      ...defaultEffectsOff,
      reverb: { enabled: true, roomSize: 0.85, wetDry: 0.45 },
      delay: { enabled: true, time: 0.5, feedback: 0.35, wetDry: 0.2 },
    },
  },
};

// ============================================================================
// Preset Collections
// ============================================================================

/**
 * All synthesizer presets organized by category.
 */
export const PRESETS: Record<PresetCategory, SynthPreset[]> = {
  Piano: [acousticPiano, electricPiano, softPiano, brightPiano, warmPiano],
  Lead: [classicLead, sawLead, squareLead, sineLead, detunedLead],
  Pluck: [shortPluck, softPluck, brightPluck, bellPluck, mutedPluck],
  Guitar: [cleanGuitar, mutedGuitar, acousticGuitar, nylonGuitar, steelGuitar],
  Bass: [subBass, synthBass, punchyBass, warmBass, growlBass],
  Strings: [violin, cello, stringEnsemble, soloStrings, pizzicato],
  Pads: [warmPad, ambientPad, choirPad, sweepPad, darkPad],
};

/**
 * Flat array of all presets for iteration.
 */
export const ALL_PRESETS: SynthPreset[] = [
  // Piano
  acousticPiano, electricPiano, softPiano, brightPiano, warmPiano,
  // Lead
  classicLead, sawLead, squareLead, sineLead, detunedLead,
  // Pluck
  shortPluck, softPluck, brightPluck, bellPluck, mutedPluck,
  // Guitar
  cleanGuitar, mutedGuitar, acousticGuitar, nylonGuitar, steelGuitar,
  // Bass
  subBass, synthBass, punchyBass, warmBass, growlBass,
  // Strings
  violin, cello, stringEnsemble, soloStrings, pizzicato,
  // Pads
  warmPad, ambientPad, choirPad, sweepPad, darkPad,
];

/**
 * Map of preset names to preset objects for quick lookup.
 */
export const PRESET_BY_NAME: Record<PresetName, SynthPreset> = {
  // Piano
  'Acoustic Piano': acousticPiano,
  'Electric Piano': electricPiano,
  'Soft Piano': softPiano,
  'Bright Piano': brightPiano,
  'Warm Piano': warmPiano,
  // Lead
  'Classic Lead': classicLead,
  'Saw Lead': sawLead,
  'Square Lead': squareLead,
  'Sine Lead': sineLead,
  'Detuned Lead': detunedLead,
  // Pluck
  'Short Pluck': shortPluck,
  'Soft Pluck': softPluck,
  'Bright Pluck': brightPluck,
  'Bell Pluck': bellPluck,
  'Muted Pluck': mutedPluck,
  // Guitar
  'Clean Guitar': cleanGuitar,
  'Muted Guitar': mutedGuitar,
  'Acoustic Guitar': acousticGuitar,
  'Nylon Guitar': nylonGuitar,
  'Steel Guitar': steelGuitar,
  // Bass
  'Sub Bass': subBass,
  'Synth Bass': synthBass,
  'Punchy Bass': punchyBass,
  'Warm Bass': warmBass,
  'Growl Bass': growlBass,
  // Strings
  'Violin': violin,
  'Cello': cello,
  'String Ensemble': stringEnsemble,
  'Solo Strings': soloStrings,
  'Pizzicato': pizzicato,
  // Pads
  'Warm Pad': warmPad,
  'Ambient Pad': ambientPad,
  'Choir Pad': choirPad,
  'Sweep Pad': sweepPad,
  'Dark Pad': darkPad,
};

/**
 * List of all preset categories in display order.
 */
export const PRESET_CATEGORIES: PresetCategory[] = [
  'Piano',
  'Lead',
  'Pluck',
  'Guitar',
  'Bass',
  'Strings',
  'Pads',
];

/**
 * Get a preset by its name.
 */
export function getPresetByName(name: PresetName): SynthPreset | undefined {
  return PRESET_BY_NAME[name];
}

/**
 * Get all presets in a specific category.
 */
export function getPresetsByCategory(category: PresetCategory): SynthPreset[] {
  return PRESETS[category] || [];
}

/**
 * Check if a string is a valid preset name.
 */
export function isValidPresetName(name: string): name is PresetName {
  return name in PRESET_BY_NAME;
}
