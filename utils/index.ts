// Validation utilities
export {
  // Constants
  VALIDATION_CONSTRAINTS,
  // Types
  type FieldValidationError,
  type ValidationResult,
  // Note validation
  validateNotePitch,
  validateNoteStart,
  validateNoteDuration,
  validateNoteVelocity,
  validateNote,
  // Melody validation
  validateMelodyTitle,
  validateMelodyTempo,
  validateMelodyNotes,
  validateMelody,
  // Synth validation
  validateSynthVolume,
  validateADSREnvelope,
  validateFilterFrequency,
  validateFilterConfig,
  validateOscillatorType,
  validateSynthConfig,
} from './validation';

// Grid snap utilities
export {
  // Constants
  GRID_DIVISIONS,
  FREE_POSITION_RESOLUTION,
  MIN_DURATION_SNAP_DISABLED,
  // Functions
  snapToGrid,
  snapToFreePosition,
  snapPosition,
  getMinimumDuration,
  enforceMinimumDuration,
  calculateSnappedEndTime,
  isValidGridDivision,
} from './grid-snap';

// Note rendering utilities
export {
  // Types
  type NoteRenderPosition,
  type NoteRenderParams,
  // Functions
  calculateNoteRenderPosition,
  calculateNotePositionSimple,
} from './note-rendering';

// MIDI import utilities
export {
  // Types
  type MidiImportResult,
  // Classes
  MidiImporter,
  MidiImportError,
  // Constants
  MAX_MIDI_FILE_SIZE,
  DEFAULT_TEMPO,
  // Functions
  parseMidiFile,
  validateFileSize,
  convertMidiVelocity,
  extractTempo,
} from './midi-importer';

// MIDI export utilities
export {
  // Types
  type ExportableMelody,
  // Classes
  MidiExporter,
  MidiExportError,
  // Constants
  DEFAULT_EXPORT_TEMPO,
  TICKS_PER_QUARTER_NOTE,
  // Functions
  createMidiFile,
  exportMelodyToMidi,
  convertToMidiVelocity,
  beatsToSeconds,
  sanitizeFilename,
  generateMidiFilename,
} from './midi-exporter';

// Owner ID utilities
export {
  // Constants
  OWNER_ID_STORAGE_KEY,
  // Functions
  hasOwnerId,
  getOwnerId,
  clearOwnerId,
} from './owner-id';

// Text utilities
export {
  // Constants
  DEFAULT_MAX_TITLE_LENGTH,
  ELLIPSIS,
  // Functions
  truncateTitle,
} from './text';

// Duration formatting utilities
export { formatDuration } from './duration';
