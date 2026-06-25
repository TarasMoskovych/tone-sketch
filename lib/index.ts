export { getDb, query } from './db';

// Synthesizer engine
export {
  SynthesizerEngine,
  DEFAULT_SYNTH_CONFIG,
  type ISynthesizerEngine,
  type DeepPartialSynthConfig,
  type AudioContextError,
  type AudioContextState,
} from './synthesizer';

// Audio context error handling utilities
export {
  createAudioContextError,
  detectAudioErrorType,
  isWebAudioSupported,
  getAudioContextState,
  AUDIO_ERROR_CODES,
  type AudioContextErrorType,
  type AudioErrorCallback,
  type AudioStateChangeCallback,
} from './audio-context-error';

// Melody data access functions
export {
  createMelody,
  getMelodyById,
  updateMelody,
  deleteMelody,
  getMelodiesPaginated,
  type CreateMelodyInput,
  type UpdateMelodyInput,
  type PaginatedMelodies,
} from './melodies';

// Synthesizer presets
export {
  PRESETS,
  ALL_PRESETS,
  PRESET_BY_NAME,
  PRESET_CATEGORIES,
  getPresetByName,
  getPresetsByCategory,
  isValidPresetName,
} from './presets';

// Note utility functions
export {
  midiToNoteName,
  isBlackKey,
  isWhiteKey,
  getNoteLetter,
  getOctave,
  generateNoteId,
  validateNote,
  NOTE_NAMES,
  BLACK_KEY_INDICES,
  NOTE_CONSTRAINTS,
} from './note-utils';

// Selection utility functions
export { isPlatformModifierKey } from './selection-utils';
