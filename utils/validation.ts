/**
 * Valid preset names for synthesizer configuration
 * Requirement 37.1-37.6: Define preset names across categories
 */
export const VALID_PRESET_NAMES = [
  'Acoustic Piano',
  'Electric Piano',
  'Soft Piano',
  'Classic Lead',
  'Saw Lead',
  'Square Lead',
  'Short Pluck',
  'Soft Pluck',
  'Bright Pluck',
  'Clean Guitar',
  'Muted Guitar',
  'Acoustic Guitar',
  'Sub Bass',
  'Synth Bass',
  'Punchy Bass',
] as const;

/**
 * Validation constraints matching the design document specifications
 */
export const VALIDATION_CONSTRAINTS = {
  note: {
    pitch: { min: 0, max: 127 },
    start: { min: 0, max: 10000 },
    duration: { min: 0.001, max: 1000 },
    velocity: { min: 0, max: 1 },
  },
  melody: {
    title: { minLength: 1, maxLength: 200 },
    notes: { maxCount: 10000 },
    tempo: { min: 40, max: 240 },
  },
  synth: {
    volume: { min: 0, max: 1 },
    envelope: {
      attack: { min: 0, max: 2 },
      decay: { min: 0, max: 2 },
      sustain: { min: 0, max: 1 },
      release: { min: 0, max: 5 },
    },
    filter: {
      frequency: { min: 20, max: 20000 },
    },
  },
  effects: {
    reverb: {
      roomSize: { min: 0, max: 1 },
      wetDry: { min: 0, max: 1 },
    },
    delay: {
      time: { min: 0, max: 1 },
      feedback: { min: 0, max: 0.9 },
      wetDry: { min: 0, max: 1 },
    },
    chorus: {
      rate: { min: 0.1, max: 10 },
      depth: { min: 0, max: 1 },
      wetDry: { min: 0, max: 1 },
    },
    flanger: {
      rate: { min: 0.1, max: 10 },
      depth: { min: 0, max: 1 },
      feedback: { min: 0, max: 0.9 },
      wetDry: { min: 0, max: 1 },
    },
  },
} as const;

/**
 * Represents a single validation error for a specific field
 */
export interface FieldValidationError {
  field: string;
  reason: string;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  valid: boolean;
  errors: FieldValidationError[];
}

/**
 * Creates a successful validation result
 */
function validResult(): ValidationResult {
  return { valid: true, errors: [] };
}

/**
 * Creates a failed validation result with errors
 */
function invalidResult(errors: FieldValidationError[]): ValidationResult {
  return { valid: false, errors };
}

/**
 * Validates that a value is an integer
 */
function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/**
 * Validates that a value is a finite number
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validates a Note.pitch value
 * Requirement 31.1: pitch values are integers between 0 and 127 inclusive
 */
export function validateNotePitch(pitch: unknown): ValidationResult {
  const { min, max } = VALIDATION_CONSTRAINTS.note.pitch;

  if (!isInteger(pitch)) {
    return invalidResult([{
      field: 'pitch',
      reason: 'pitch must be an integer',
    }]);
  }

  if (pitch < min || pitch > max) {
    return invalidResult([{
      field: 'pitch',
      reason: `pitch must be between ${min} and ${max} inclusive`,
    }]);
  }

  return validResult();
}

/**
 * Validates a Note.start value
 * Requirement 31.2: start values are non-negative numbers with a maximum of 10000 beats
 */
export function validateNoteStart(start: unknown): ValidationResult {
  const { min, max } = VALIDATION_CONSTRAINTS.note.start;

  if (!isNumber(start)) {
    return invalidResult([{
      field: 'start',
      reason: 'start must be a number',
    }]);
  }

  if (start < min || start > max) {
    return invalidResult([{
      field: 'start',
      reason: `start must be between ${min} and ${max} inclusive`,
    }]);
  }

  return validResult();
}

/**
 * Validates a Note.duration value
 * Requirement 31.3: duration values are numbers greater than 0 with min 0.001 and max 1000 beats
 */
export function validateNoteDuration(duration: unknown): ValidationResult {
  const { min, max } = VALIDATION_CONSTRAINTS.note.duration;

  if (!isNumber(duration)) {
    return invalidResult([{
      field: 'duration',
      reason: 'duration must be a number',
    }]);
  }

  if (duration < min || duration > max) {
    return invalidResult([{
      field: 'duration',
      reason: `duration must be between ${min} and ${max} inclusive`,
    }]);
  }

  return validResult();
}

/**
 * Validates a Note.velocity value
 * Requirement 31.4: velocity values are numbers between 0 and 1 inclusive
 */
export function validateNoteVelocity(velocity: unknown): ValidationResult {
  const { min, max } = VALIDATION_CONSTRAINTS.note.velocity;

  if (!isNumber(velocity)) {
    return invalidResult([{
      field: 'velocity',
      reason: 'velocity must be a number',
    }]);
  }

  if (velocity < min || velocity > max) {
    return invalidResult([{
      field: 'velocity',
      reason: `velocity must be between ${min} and ${max} inclusive`,
    }]);
  }

  return validResult();
}

/**
 * Validates all fields of a Note object
 * Requirement 31.5: reject save requests with error for invalid fields
 * Requirements: 31.1, 31.2, 31.3, 31.4
 */
export function validateNote(note: unknown, index?: number): ValidationResult {
  const prefix = index !== undefined ? `notes[${index}].` : '';
  const errors: FieldValidationError[] = [];

  if (typeof note !== 'object' || note === null) {
    return invalidResult([{
      field: `${prefix}note`,
      reason: 'note must be an object',
    }]);
  }

  const noteObj = note as Record<string, unknown>;

  // Validate pitch
  const pitchResult = validateNotePitch(noteObj.pitch);
  if (!pitchResult.valid) {
    errors.push(...pitchResult.errors.map(e => ({
      field: `${prefix}${e.field}`,
      reason: e.reason,
    })));
  }

  // Validate start
  const startResult = validateNoteStart(noteObj.start);
  if (!startResult.valid) {
    errors.push(...startResult.errors.map(e => ({
      field: `${prefix}${e.field}`,
      reason: e.reason,
    })));
  }

  // Validate duration
  const durationResult = validateNoteDuration(noteObj.duration);
  if (!durationResult.valid) {
    errors.push(...durationResult.errors.map(e => ({
      field: `${prefix}${e.field}`,
      reason: e.reason,
    })));
  }

  // Validate velocity
  const velocityResult = validateNoteVelocity(noteObj.velocity);
  if (!velocityResult.valid) {
    errors.push(...velocityResult.errors.map(e => ({
      field: `${prefix}${e.field}`,
      reason: e.reason,
    })));
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates a melody title
 * Requirement 27.2: enforce a maximum title length of 200 characters
 * Requirement 18.6: title is empty or exceeds 200 characters
 */
export function validateMelodyTitle(title: unknown): ValidationResult {
  const { minLength, maxLength } = VALIDATION_CONSTRAINTS.melody.title;

  if (typeof title !== 'string') {
    return invalidResult([{
      field: 'title',
      reason: 'title must be a string',
    }]);
  }

  if (title.length < minLength) {
    return invalidResult([{
      field: 'title',
      reason: `title must be at least ${minLength} character(s)`,
    }]);
  }

  if (title.length > maxLength) {
    return invalidResult([{
      field: 'title',
      reason: `title must be at most ${maxLength} characters`,
    }]);
  }

  return validResult();
}

/**
 * Validates a melody tempo
 * Requirement 44.4, 44.5: tempo must be an integer between 40 and 240 BPM
 * Design document: Melody.tempo: integer, 40 ≤ value ≤ 240 (BPM)
 */
export function validateMelodyTempo(tempo: unknown): ValidationResult {
  const { min, max } = VALIDATION_CONSTRAINTS.melody.tempo;

  if (!isInteger(tempo)) {
    return invalidResult([{
      field: 'tempo',
      reason: 'tempo must be an integer',
    }]);
  }

  if (tempo < min || tempo > max) {
    return invalidResult([{
      field: 'tempo',
      reason: `tempo must be between ${min} and ${max} BPM inclusive`,
    }]);
  }

  return validResult();
}

/**
 * Validates the notes array of a melody
 * Requirement 27.3: enforce a maximum of 10000 notes per melody
 */
export function validateMelodyNotes(notes: unknown): ValidationResult {
  const { maxCount } = VALIDATION_CONSTRAINTS.melody.notes;
  const errors: FieldValidationError[] = [];

  if (!Array.isArray(notes)) {
    return invalidResult([{
      field: 'notes',
      reason: 'notes must be an array',
    }]);
  }

  if (notes.length > maxCount) {
    return invalidResult([{
      field: 'notes',
      reason: `notes array must contain at most ${maxCount} notes`,
    }]);
  }

  // Validate each note in the array
  for (let i = 0; i < notes.length; i++) {
    const noteResult = validateNote(notes[i], i);
    if (!noteResult.valid) {
      errors.push(...noteResult.errors);
    }
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates synth volume
 * Design doc: Synth.volume: 0 ≤ value ≤ 1
 */
export function validateSynthVolume(volume: unknown): ValidationResult {
  const { min, max } = VALIDATION_CONSTRAINTS.synth.volume;

  if (!isNumber(volume)) {
    return invalidResult([{
      field: 'synth.volume',
      reason: 'volume must be a number',
    }]);
  }

  if (volume < min || volume > max) {
    return invalidResult([{
      field: 'synth.volume',
      reason: `volume must be between ${min} and ${max} inclusive`,
    }]);
  }

  return validResult();
}

/**
 * Validates ADSR envelope parameters
 * Design doc:
 * - Synth.envelope.attack: 0 ≤ value ≤ 2
 * - Synth.envelope.decay: 0 ≤ value ≤ 2
 * - Synth.envelope.sustain: 0 ≤ value ≤ 1
 * - Synth.envelope.release: 0 ≤ value ≤ 5
 */
export function validateADSREnvelope(envelope: unknown): ValidationResult {
  const constraints = VALIDATION_CONSTRAINTS.synth.envelope;
  const errors: FieldValidationError[] = [];

  if (typeof envelope !== 'object' || envelope === null) {
    return invalidResult([{
      field: 'synth.envelope',
      reason: 'envelope must be an object',
    }]);
  }

  const env = envelope as Record<string, unknown>;

  // Validate attack
  if (!isNumber(env.attack)) {
    errors.push({
      field: 'synth.envelope.attack',
      reason: 'attack must be a number',
    });
  } else if (env.attack < constraints.attack.min || env.attack > constraints.attack.max) {
    errors.push({
      field: 'synth.envelope.attack',
      reason: `attack must be between ${constraints.attack.min} and ${constraints.attack.max} inclusive`,
    });
  }

  // Validate decay
  if (!isNumber(env.decay)) {
    errors.push({
      field: 'synth.envelope.decay',
      reason: 'decay must be a number',
    });
  } else if (env.decay < constraints.decay.min || env.decay > constraints.decay.max) {
    errors.push({
      field: 'synth.envelope.decay',
      reason: `decay must be between ${constraints.decay.min} and ${constraints.decay.max} inclusive`,
    });
  }

  // Validate sustain
  if (!isNumber(env.sustain)) {
    errors.push({
      field: 'synth.envelope.sustain',
      reason: 'sustain must be a number',
    });
  } else if (env.sustain < constraints.sustain.min || env.sustain > constraints.sustain.max) {
    errors.push({
      field: 'synth.envelope.sustain',
      reason: `sustain must be between ${constraints.sustain.min} and ${constraints.sustain.max} inclusive`,
    });
  }

  // Validate release
  if (!isNumber(env.release)) {
    errors.push({
      field: 'synth.envelope.release',
      reason: 'release must be a number',
    });
  } else if (env.release < constraints.release.min || env.release > constraints.release.max) {
    errors.push({
      field: 'synth.envelope.release',
      reason: `release must be between ${constraints.release.min} and ${constraints.release.max} inclusive`,
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates filter frequency
 * Design doc: Synth.filter.frequency: 20 ≤ value ≤ 20000
 */
export function validateFilterFrequency(frequency: unknown): ValidationResult {
  const { min, max } = VALIDATION_CONSTRAINTS.synth.filter.frequency;

  if (!isNumber(frequency)) {
    return invalidResult([{
      field: 'synth.filter.frequency',
      reason: 'filter frequency must be a number',
    }]);
  }

  if (frequency < min || frequency > max) {
    return invalidResult([{
      field: 'synth.filter.frequency',
      reason: `filter frequency must be between ${min} and ${max} Hz inclusive`,
    }]);
  }

  return validResult();
}

/**
 * Validates filter configuration
 */
export function validateFilterConfig(filter: unknown): ValidationResult {
  const errors: FieldValidationError[] = [];

  if (typeof filter !== 'object' || filter === null) {
    return invalidResult([{
      field: 'synth.filter',
      reason: 'filter must be an object',
    }]);
  }

  const filterObj = filter as Record<string, unknown>;

  // Validate enabled is a boolean
  if (typeof filterObj.enabled !== 'boolean') {
    errors.push({
      field: 'synth.filter.enabled',
      reason: 'filter enabled must be a boolean',
    });
  }

  // Validate type
  if (filterObj.type !== 'lowpass' && filterObj.type !== 'highpass') {
    errors.push({
      field: 'synth.filter.type',
      reason: 'filter type must be "lowpass" or "highpass"',
    });
  }

  // Validate frequency
  const freqResult = validateFilterFrequency(filterObj.frequency);
  if (!freqResult.valid) {
    errors.push(...freqResult.errors);
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates the oscillator type
 */
export function validateOscillatorType(oscillatorType: unknown): ValidationResult {
  const validTypes = ['sine', 'square', 'sawtooth', 'triangle'];

  if (typeof oscillatorType !== 'string' || !validTypes.includes(oscillatorType)) {
    return invalidResult([{
      field: 'synth.oscillatorType',
      reason: `oscillator type must be one of: ${validTypes.join(', ')}`,
    }]);
  }

  return validResult();
}

/**
 * Validates reverb effect configuration
 * Requirement 36.1: Reverb validation
 */
export function validateReverbConfig(reverb: unknown): ValidationResult {
  const errors: FieldValidationError[] = [];
  const constraints = VALIDATION_CONSTRAINTS.effects.reverb;

  if (typeof reverb !== 'object' || reverb === null) {
    return invalidResult([{
      field: 'synth.effects.reverb',
      reason: 'reverb configuration must be an object',
    }]);
  }

  const reverbObj = reverb as Record<string, unknown>;

  // Validate enabled is a boolean
  if (typeof reverbObj.enabled !== 'boolean') {
    errors.push({
      field: 'synth.effects.reverb.enabled',
      reason: 'reverb enabled must be a boolean',
    });
  }

  // Validate roomSize
  if (!isNumber(reverbObj.roomSize)) {
    errors.push({
      field: 'synth.effects.reverb.roomSize',
      reason: 'reverb roomSize must be a number',
    });
  } else if (reverbObj.roomSize < constraints.roomSize.min || reverbObj.roomSize > constraints.roomSize.max) {
    errors.push({
      field: 'synth.effects.reverb.roomSize',
      reason: `reverb roomSize must be between ${constraints.roomSize.min} and ${constraints.roomSize.max} inclusive`,
    });
  }

  // Validate wetDry
  if (!isNumber(reverbObj.wetDry)) {
    errors.push({
      field: 'synth.effects.reverb.wetDry',
      reason: 'reverb wetDry must be a number',
    });
  } else if (reverbObj.wetDry < constraints.wetDry.min || reverbObj.wetDry > constraints.wetDry.max) {
    errors.push({
      field: 'synth.effects.reverb.wetDry',
      reason: `reverb wetDry must be between ${constraints.wetDry.min} and ${constraints.wetDry.max} inclusive`,
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates delay effect configuration
 * Requirement 36.2: Delay validation
 */
export function validateDelayConfig(delay: unknown): ValidationResult {
  const errors: FieldValidationError[] = [];
  const constraints = VALIDATION_CONSTRAINTS.effects.delay;

  if (typeof delay !== 'object' || delay === null) {
    return invalidResult([{
      field: 'synth.effects.delay',
      reason: 'delay configuration must be an object',
    }]);
  }

  const delayObj = delay as Record<string, unknown>;

  // Validate enabled is a boolean
  if (typeof delayObj.enabled !== 'boolean') {
    errors.push({
      field: 'synth.effects.delay.enabled',
      reason: 'delay enabled must be a boolean',
    });
  }

  // Validate time
  if (!isNumber(delayObj.time)) {
    errors.push({
      field: 'synth.effects.delay.time',
      reason: 'delay time must be a number',
    });
  } else if (delayObj.time < constraints.time.min || delayObj.time > constraints.time.max) {
    errors.push({
      field: 'synth.effects.delay.time',
      reason: `delay time must be between ${constraints.time.min} and ${constraints.time.max} seconds inclusive`,
    });
  }

  // Validate feedback
  if (!isNumber(delayObj.feedback)) {
    errors.push({
      field: 'synth.effects.delay.feedback',
      reason: 'delay feedback must be a number',
    });
  } else if (delayObj.feedback < constraints.feedback.min || delayObj.feedback > constraints.feedback.max) {
    errors.push({
      field: 'synth.effects.delay.feedback',
      reason: `delay feedback must be between ${constraints.feedback.min} and ${constraints.feedback.max} inclusive`,
    });
  }

  // Validate wetDry
  if (!isNumber(delayObj.wetDry)) {
    errors.push({
      field: 'synth.effects.delay.wetDry',
      reason: 'delay wetDry must be a number',
    });
  } else if (delayObj.wetDry < constraints.wetDry.min || delayObj.wetDry > constraints.wetDry.max) {
    errors.push({
      field: 'synth.effects.delay.wetDry',
      reason: `delay wetDry must be between ${constraints.wetDry.min} and ${constraints.wetDry.max} inclusive`,
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates chorus effect configuration
 * Requirement 36.3: Chorus validation
 */
export function validateChorusConfig(chorus: unknown): ValidationResult {
  const errors: FieldValidationError[] = [];
  const constraints = VALIDATION_CONSTRAINTS.effects.chorus;

  if (typeof chorus !== 'object' || chorus === null) {
    return invalidResult([{
      field: 'synth.effects.chorus',
      reason: 'chorus configuration must be an object',
    }]);
  }

  const chorusObj = chorus as Record<string, unknown>;

  // Validate enabled is a boolean
  if (typeof chorusObj.enabled !== 'boolean') {
    errors.push({
      field: 'synth.effects.chorus.enabled',
      reason: 'chorus enabled must be a boolean',
    });
  }

  // Validate rate
  if (!isNumber(chorusObj.rate)) {
    errors.push({
      field: 'synth.effects.chorus.rate',
      reason: 'chorus rate must be a number',
    });
  } else if (chorusObj.rate < constraints.rate.min || chorusObj.rate > constraints.rate.max) {
    errors.push({
      field: 'synth.effects.chorus.rate',
      reason: `chorus rate must be between ${constraints.rate.min} and ${constraints.rate.max} Hz inclusive`,
    });
  }

  // Validate depth
  if (!isNumber(chorusObj.depth)) {
    errors.push({
      field: 'synth.effects.chorus.depth',
      reason: 'chorus depth must be a number',
    });
  } else if (chorusObj.depth < constraints.depth.min || chorusObj.depth > constraints.depth.max) {
    errors.push({
      field: 'synth.effects.chorus.depth',
      reason: `chorus depth must be between ${constraints.depth.min} and ${constraints.depth.max} inclusive`,
    });
  }

  // Validate wetDry
  if (!isNumber(chorusObj.wetDry)) {
    errors.push({
      field: 'synth.effects.chorus.wetDry',
      reason: 'chorus wetDry must be a number',
    });
  } else if (chorusObj.wetDry < constraints.wetDry.min || chorusObj.wetDry > constraints.wetDry.max) {
    errors.push({
      field: 'synth.effects.chorus.wetDry',
      reason: `chorus wetDry must be between ${constraints.wetDry.min} and ${constraints.wetDry.max} inclusive`,
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates flanger effect configuration
 * Requirement 36.4: Flanger validation
 */
export function validateFlangerConfig(flanger: unknown): ValidationResult {
  const errors: FieldValidationError[] = [];
  const constraints = VALIDATION_CONSTRAINTS.effects.flanger;

  if (typeof flanger !== 'object' || flanger === null) {
    return invalidResult([{
      field: 'synth.effects.flanger',
      reason: 'flanger configuration must be an object',
    }]);
  }

  const flangerObj = flanger as Record<string, unknown>;

  // Validate enabled is a boolean
  if (typeof flangerObj.enabled !== 'boolean') {
    errors.push({
      field: 'synth.effects.flanger.enabled',
      reason: 'flanger enabled must be a boolean',
    });
  }

  // Validate rate
  if (!isNumber(flangerObj.rate)) {
    errors.push({
      field: 'synth.effects.flanger.rate',
      reason: 'flanger rate must be a number',
    });
  } else if (flangerObj.rate < constraints.rate.min || flangerObj.rate > constraints.rate.max) {
    errors.push({
      field: 'synth.effects.flanger.rate',
      reason: `flanger rate must be between ${constraints.rate.min} and ${constraints.rate.max} Hz inclusive`,
    });
  }

  // Validate depth
  if (!isNumber(flangerObj.depth)) {
    errors.push({
      field: 'synth.effects.flanger.depth',
      reason: 'flanger depth must be a number',
    });
  } else if (flangerObj.depth < constraints.depth.min || flangerObj.depth > constraints.depth.max) {
    errors.push({
      field: 'synth.effects.flanger.depth',
      reason: `flanger depth must be between ${constraints.depth.min} and ${constraints.depth.max} inclusive`,
    });
  }

  // Validate feedback
  if (!isNumber(flangerObj.feedback)) {
    errors.push({
      field: 'synth.effects.flanger.feedback',
      reason: 'flanger feedback must be a number',
    });
  } else if (flangerObj.feedback < constraints.feedback.min || flangerObj.feedback > constraints.feedback.max) {
    errors.push({
      field: 'synth.effects.flanger.feedback',
      reason: `flanger feedback must be between ${constraints.feedback.min} and ${constraints.feedback.max} inclusive`,
    });
  }

  // Validate wetDry
  if (!isNumber(flangerObj.wetDry)) {
    errors.push({
      field: 'synth.effects.flanger.wetDry',
      reason: 'flanger wetDry must be a number',
    });
  } else if (flangerObj.wetDry < constraints.wetDry.min || flangerObj.wetDry > constraints.wetDry.max) {
    errors.push({
      field: 'synth.effects.flanger.wetDry',
      reason: `flanger wetDry must be between ${constraints.wetDry.min} and ${constraints.wetDry.max} inclusive`,
    });
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates complete effects configuration
 * Requirement 36.7: Effects are persisted as part of synth configuration
 */
export function validateEffectsConfig(effects: unknown): ValidationResult {
  const errors: FieldValidationError[] = [];

  if (typeof effects !== 'object' || effects === null) {
    return invalidResult([{
      field: 'synth.effects',
      reason: 'effects configuration must be an object',
    }]);
  }

  const effectsObj = effects as Record<string, unknown>;

  // Validate reverb config
  const reverbResult = validateReverbConfig(effectsObj.reverb);
  if (!reverbResult.valid) {
    errors.push(...reverbResult.errors);
  }

  // Validate delay config
  const delayResult = validateDelayConfig(effectsObj.delay);
  if (!delayResult.valid) {
    errors.push(...delayResult.errors);
  }

  // Validate chorus config
  const chorusResult = validateChorusConfig(effectsObj.chorus);
  if (!chorusResult.valid) {
    errors.push(...chorusResult.errors);
  }

  // Validate flanger config
  const flangerResult = validateFlangerConfig(effectsObj.flanger);
  if (!flangerResult.valid) {
    errors.push(...flangerResult.errors);
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates preset name
 * Requirement 37.8: presetName is persisted as part of synth configuration
 */
export function validatePresetName(presetName: unknown): ValidationResult {
  // presetName can be null (custom settings) or a valid preset name
  if (presetName === null) {
    return validResult();
  }

  if (typeof presetName !== 'string') {
    return invalidResult([{
      field: 'synth.presetName',
      reason: 'presetName must be a string or null',
    }]);
  }

  if (!VALID_PRESET_NAMES.includes(presetName as typeof VALID_PRESET_NAMES[number])) {
    return invalidResult([{
      field: 'synth.presetName',
      reason: `presetName must be one of: ${VALID_PRESET_NAMES.join(', ')}, or null`,
    }]);
  }

  return validResult();
}

/**
 * Validates complete synthesizer configuration
 * Updated to include effects and presetName validation
 * Requirements: 36.7, 37.8, 37.9
 */
export function validateSynthConfig(synth: unknown): ValidationResult {
  const errors: FieldValidationError[] = [];

  if (typeof synth !== 'object' || synth === null) {
    return invalidResult([{
      field: 'synth',
      reason: 'synth configuration must be an object',
    }]);
  }

  const synthObj = synth as Record<string, unknown>;

  // Validate oscillator type
  const oscResult = validateOscillatorType(synthObj.oscillatorType);
  if (!oscResult.valid) {
    errors.push(...oscResult.errors);
  }

  // Validate volume
  const volumeResult = validateSynthVolume(synthObj.volume);
  if (!volumeResult.valid) {
    errors.push(...volumeResult.errors);
  }

  // Validate ADSR envelope
  const envelopeResult = validateADSREnvelope(synthObj.envelope);
  if (!envelopeResult.valid) {
    errors.push(...envelopeResult.errors);
  }

  // Validate filter config
  const filterResult = validateFilterConfig(synthObj.filter);
  if (!filterResult.valid) {
    errors.push(...filterResult.errors);
  }

  // Validate effects configuration (Requirement 36.7)
  const effectsResult = validateEffectsConfig(synthObj.effects);
  if (!effectsResult.valid) {
    errors.push(...effectsResult.errors);
  }

  // Validate preset name (Requirements 37.8, 37.9)
  const presetResult = validatePresetName(synthObj.presetName);
  if (!presetResult.valid) {
    errors.push(...presetResult.errors);
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}

/**
 * Validates a complete melody object for API requests
 * Combines title, notes, tempo, and synth validation
 * Requirements: 18.6, 27.2, 27.3, 31.1-31.5, 44.4, 44.5, 28.3
 */
export function validateMelody(melody: unknown): ValidationResult {
  const errors: FieldValidationError[] = [];

  if (typeof melody !== 'object' || melody === null) {
    return invalidResult([{
      field: 'melody',
      reason: 'melody must be an object',
    }]);
  }

  const melodyObj = melody as Record<string, unknown>;

  // Validate title
  const titleResult = validateMelodyTitle(melodyObj.title);
  if (!titleResult.valid) {
    errors.push(...titleResult.errors);
  }

  // Validate notes array
  const notesResult = validateMelodyNotes(melodyObj.notes);
  if (!notesResult.valid) {
    errors.push(...notesResult.errors);
  }

  // Validate synth configuration
  const synthResult = validateSynthConfig(melodyObj.synth);
  if (!synthResult.valid) {
    errors.push(...synthResult.errors);
  }

  // Validate tempo (40-240 BPM range)
  const tempoResult = validateMelodyTempo(melodyObj.tempo);
  if (!tempoResult.valid) {
    errors.push(...tempoResult.errors);
  }

  return errors.length > 0 ? invalidResult(errors) : validResult();
}
