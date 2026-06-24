import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateMelodyTitle,
  validateMelodyTempo,
  validateMelodyNotes,
  validateNotePitch,
  validateNoteStart,
  validateNoteDuration,
  validateNoteVelocity,
  validateNote,
  VALIDATION_CONSTRAINTS,
} from '../../utils/validation';

/**
 * Feature: tone-sketch, Property 12: Title Validation
 *
 * *For any* string S:
 * - If S is empty or length > 200 characters, save SHALL be rejected with a validation error
 * - If 1 ≤ length(S) ≤ 200, the title SHALL be accepted
 *
 * **Validates: Requirements 18.6, 27.2**
 */
describe('Property 12: Title Validation', () => {
  const { minLength, maxLength } = VALIDATION_CONSTRAINTS.melody.title;

  it('should accept titles with valid length (1-200 characters)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: minLength, max: maxLength }).chain((len) =>
          fc.string({ minLength: len, maxLength: len })
        ),
        (title) => {
          const result = validateMelodyTitle(title);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject empty titles', () => {
    const result = validateMelodyTitle('');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe('title');
  });

  it('should reject titles exceeding 200 characters', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: maxLength + 1, max: maxLength + 500 }).chain((len) =>
          fc.string({ minLength: len, maxLength: len })
        ),
        (title) => {
          const result = validateMelodyTitle(title);
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0].field).toBe('title');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject non-string titles', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.constant(null),
          fc.constant(undefined),
          fc.array(fc.string()),
          fc.object()
        ),
        (title) => {
          const result = validateMelodyTitle(title);
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0].field).toBe('title');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept boundary lengths (1 and 200 characters)', () => {
    // Test minimum boundary
    const minResult = validateMelodyTitle('a');
    expect(minResult.valid).toBe(true);

    // Test maximum boundary
    const maxTitle = 'a'.repeat(maxLength);
    const maxResult = validateMelodyTitle(maxTitle);
    expect(maxResult.valid).toBe(true);
  });
});

/**
 * Feature: tone-sketch, Property 13: Note Count Limit
 *
 * *For any* Melody with notes array length N:
 * - If N > 10000, save SHALL be rejected with a validation error
 * - If N ≤ 10000, the notes array SHALL be accepted
 *
 * **Validates: Requirements 27.3**
 */
describe('Property 13: Note Count Limit', () => {
  const { maxCount } = VALIDATION_CONSTRAINTS.melody.notes;

  // Helper to generate a valid note
  const validNote = () => ({
    id: 'test-id',
    pitch: 60,
    start: 0,
    duration: 1,
    velocity: 0.8,
  });

  it('should accept notes arrays within the limit (≤10000 notes)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // Use smaller numbers for performance
        (count) => {
          const notes = Array.from({ length: count }, () => validNote());
          const result = validateMelodyNotes(notes);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject notes arrays exceeding 10000 notes', () => {
    // Create an array slightly over the limit
    const notes = Array.from({ length: maxCount + 1 }, () => validNote());
    const result = validateMelodyNotes(notes);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].field).toBe('notes');
    expect(result.errors[0].reason).toContain('10000');
  });

  it('should accept exactly 10000 notes', () => {
    const notes = Array.from({ length: maxCount }, () => validNote());
    const result = validateMelodyNotes(notes);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept empty notes array', () => {
    const result = validateMelodyNotes([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-array notes', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.string(),
          fc.constant(null),
          fc.constant(undefined),
          fc.object()
        ),
        (notes) => {
          const result = validateMelodyNotes(notes);
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0].field).toBe('notes');
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: tone-sketch, Property 14: Note Field Validation
 *
 * *For any* Note object, the following validations SHALL apply:
 * - pitch: integer, 0 ≤ pitch ≤ 127
 * - start: number, 0 ≤ start ≤ 10000
 * - duration: number, 0.001 ≤ duration ≤ 1000
 * - velocity: number, 0 ≤ velocity ≤ 1
 *
 * If any field fails validation, the save request SHALL be rejected with an error
 * indicating the invalid field and reason.
 *
 * **Validates: Requirements 31.1, 31.2, 31.3, 31.4, 31.5**
 */
describe('Property 14: Note Field Validation', () => {
  const pitchConstraints = VALIDATION_CONSTRAINTS.note.pitch;
  const startConstraints = VALIDATION_CONSTRAINTS.note.start;
  const durationConstraints = VALIDATION_CONSTRAINTS.note.duration;
  const velocityConstraints = VALIDATION_CONSTRAINTS.note.velocity;

  // Arbitrary for valid note
  const validNoteArb = fc.record({
    id: fc.uuid(),
    pitch: fc.integer({ min: pitchConstraints.min, max: pitchConstraints.max }),
    start: fc.double({ min: startConstraints.min, max: startConstraints.max, noNaN: true }),
    duration: fc.double({ min: durationConstraints.min, max: durationConstraints.max, noNaN: true }),
    velocity: fc.double({ min: velocityConstraints.min, max: velocityConstraints.max, noNaN: true }),
  });

  describe('Pitch Validation (Requirement 31.1)', () => {
    it('should accept valid pitch values (integers 0-127)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: pitchConstraints.min, max: pitchConstraints.max }),
          (pitch) => {
            const result = validateNotePitch(pitch);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pitch values below 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: pitchConstraints.min - 1 }),
          (pitch) => {
            const result = validateNotePitch(pitch);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('pitch');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject pitch values above 127', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: pitchConstraints.max + 1, max: 1000 }),
          (pitch) => {
            const result = validateNotePitch(pitch);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('pitch');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-integer pitch values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 127, noNaN: true }).filter((n) => !Number.isInteger(n)),
          (pitch) => {
            const result = validateNotePitch(pitch);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('pitch');
            expect(result.errors[0].reason).toContain('integer');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept boundary pitch values (0 and 127)', () => {
      expect(validateNotePitch(0).valid).toBe(true);
      expect(validateNotePitch(127).valid).toBe(true);
    });
  });

  describe('Start Validation (Requirement 31.2)', () => {
    it('should accept valid start values (0-10000)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: startConstraints.min, max: startConstraints.max, noNaN: true }),
          (start) => {
            const result = validateNoteStart(start);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject negative start values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -10000, max: -0.001, noNaN: true }),
          (start) => {
            const result = validateNoteStart(start);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('start');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject start values above 10000', () => {
      fc.assert(
        fc.property(
          fc.double({ min: startConstraints.max + 0.001, max: 20000, noNaN: true }),
          (start) => {
            const result = validateNoteStart(start);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('start');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-number start values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(NaN),
            fc.constant(Infinity)
          ),
          (start) => {
            const result = validateNoteStart(start);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('start');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept boundary start values (0 and 10000)', () => {
      expect(validateNoteStart(0).valid).toBe(true);
      expect(validateNoteStart(10000).valid).toBe(true);
    });
  });

  describe('Duration Validation (Requirement 31.3)', () => {
    it('should accept valid duration values (0.001-1000)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: durationConstraints.min, max: durationConstraints.max, noNaN: true }),
          (duration) => {
            const result = validateNoteDuration(duration);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject duration values below 0.001', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: durationConstraints.min - 0.0001, noNaN: true }),
          (duration) => {
            const result = validateNoteDuration(duration);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('duration');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject duration values above 1000', () => {
      fc.assert(
        fc.property(
          fc.double({ min: durationConstraints.max + 0.001, max: 5000, noNaN: true }),
          (duration) => {
            const result = validateNoteDuration(duration);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('duration');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject zero duration', () => {
      const result = validateNoteDuration(0);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('duration');
    });

    it('should reject negative duration', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000, max: -0.001, noNaN: true }),
          (duration) => {
            const result = validateNoteDuration(duration);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('duration');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-number duration values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(NaN),
            fc.constant(Infinity)
          ),
          (duration) => {
            const result = validateNoteDuration(duration);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('duration');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept boundary duration values (0.001 and 1000)', () => {
      expect(validateNoteDuration(0.001).valid).toBe(true);
      expect(validateNoteDuration(1000).valid).toBe(true);
    });
  });

  describe('Velocity Validation (Requirement 31.4)', () => {
    it('should accept valid velocity values (0-1)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: velocityConstraints.min, max: velocityConstraints.max, noNaN: true }),
          (velocity) => {
            const result = validateNoteVelocity(velocity);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject velocity values below 0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -100, max: -0.001, noNaN: true }),
          (velocity) => {
            const result = validateNoteVelocity(velocity);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('velocity');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject velocity values above 1', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1.001, max: 100, noNaN: true }),
          (velocity) => {
            const result = validateNoteVelocity(velocity);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('velocity');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-number velocity values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(NaN),
            fc.constant(Infinity)
          ),
          (velocity) => {
            const result = validateNoteVelocity(velocity);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('velocity');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept boundary velocity values (0 and 1)', () => {
      expect(validateNoteVelocity(0).valid).toBe(true);
      expect(validateNoteVelocity(1).valid).toBe(true);
    });
  });

  describe('Complete Note Validation (Requirement 31.5)', () => {
    it('should accept valid complete notes', () => {
      fc.assert(
        fc.property(validNoteArb, (note) => {
          const result = validateNote(note);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject notes with invalid pitch and report the field', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            pitch: fc.integer({ min: 128, max: 500 }),
            start: fc.double({ min: startConstraints.min, max: startConstraints.max, noNaN: true }),
            duration: fc.double({ min: durationConstraints.min, max: durationConstraints.max, noNaN: true }),
            velocity: fc.double({ min: velocityConstraints.min, max: velocityConstraints.max, noNaN: true }),
          }),
          (note) => {
            const result = validateNote(note);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.field === 'pitch')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject notes with invalid start and report the field', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            pitch: fc.integer({ min: pitchConstraints.min, max: pitchConstraints.max }),
            start: fc.double({ min: -1000, max: -0.001, noNaN: true }),
            duration: fc.double({ min: durationConstraints.min, max: durationConstraints.max, noNaN: true }),
            velocity: fc.double({ min: velocityConstraints.min, max: velocityConstraints.max, noNaN: true }),
          }),
          (note) => {
            const result = validateNote(note);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.field === 'start')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject notes with invalid duration and report the field', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            pitch: fc.integer({ min: pitchConstraints.min, max: pitchConstraints.max }),
            start: fc.double({ min: startConstraints.min, max: startConstraints.max, noNaN: true }),
            duration: fc.double({ min: -100, max: 0, noNaN: true }),
            velocity: fc.double({ min: velocityConstraints.min, max: velocityConstraints.max, noNaN: true }),
          }),
          (note) => {
            const result = validateNote(note);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.field === 'duration')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject notes with invalid velocity and report the field', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            pitch: fc.integer({ min: pitchConstraints.min, max: pitchConstraints.max }),
            start: fc.double({ min: startConstraints.min, max: startConstraints.max, noNaN: true }),
            duration: fc.double({ min: durationConstraints.min, max: durationConstraints.max, noNaN: true }),
            velocity: fc.double({ min: 1.001, max: 100, noNaN: true }),
          }),
          (note) => {
            const result = validateNote(note);
            expect(result.valid).toBe(false);
            expect(result.errors.some((e) => e.field === 'velocity')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-object notes', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.constant(null),
            fc.constant(undefined),
            fc.array(fc.integer())
          ),
          (note) => {
            const result = validateNote(note);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should report multiple invalid fields when present', () => {
      const invalidNote = {
        id: 'test-id',
        pitch: 200, // Invalid: > 127
        start: -5, // Invalid: < 0
        duration: 0, // Invalid: < 0.001
        velocity: 2, // Invalid: > 1
      };

      const result = validateNote(invalidNote);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(4);
      expect(result.errors.some((e) => e.field === 'pitch')).toBe(true);
      expect(result.errors.some((e) => e.field === 'start')).toBe(true);
      expect(result.errors.some((e) => e.field === 'duration')).toBe(true);
      expect(result.errors.some((e) => e.field === 'velocity')).toBe(true);
    });

    it('should include index prefix when validating notes in array context', () => {
      const invalidNote = {
        id: 'test-id',
        pitch: 200,
        start: 0,
        duration: 1,
        velocity: 0.8,
      };

      const result = validateNote(invalidNote, 5);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toContain('notes[5]');
    });
  });
});


/**
 * Feature: tone-sketch, Tempo Validation
 *
 * *For any* integer T:
 * - If T is not an integer, save SHALL be rejected with a validation error
 * - If T < 40 or T > 240, save SHALL be rejected with a validation error
 * - If 40 ≤ T ≤ 240 and T is an integer, the tempo SHALL be accepted
 *
 * **Validates: Requirements 44.4, 44.5, Design Document (Melody.tempo: 40-240 BPM)**
 */
describe('Tempo Validation', () => {
  const tempoConstraints = VALIDATION_CONSTRAINTS.melody.tempo;

  it('should accept valid tempo values (integers 40-240)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: tempoConstraints.min, max: tempoConstraints.max }),
        (tempo) => {
          const result = validateMelodyTempo(tempo);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject tempo values below 40', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: tempoConstraints.min - 1 }),
        (tempo) => {
          const result = validateMelodyTempo(tempo);
          expect(result.valid).toBe(false);
          expect(result.errors[0].field).toBe('tempo');
          expect(result.errors[0].reason).toContain('40');
          expect(result.errors[0].reason).toContain('240');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject tempo values above 240', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: tempoConstraints.max + 1, max: 1000 }),
        (tempo) => {
          const result = validateMelodyTempo(tempo);
          expect(result.valid).toBe(false);
          expect(result.errors[0].field).toBe('tempo');
          expect(result.errors[0].reason).toContain('40');
          expect(result.errors[0].reason).toContain('240');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject non-integer tempo values', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 40.001, max: 239.999, noNaN: true }).filter((n) => !Number.isInteger(n)),
        (tempo) => {
          const result = validateMelodyTempo(tempo);
          expect(result.valid).toBe(false);
          expect(result.errors[0].field).toBe('tempo');
          expect(result.errors[0].reason).toContain('integer');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject non-number tempo values', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(NaN),
          fc.constant(Infinity)
        ),
        (tempo) => {
          const result = validateMelodyTempo(tempo);
          expect(result.valid).toBe(false);
          expect(result.errors[0].field).toBe('tempo');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept boundary tempo values (40 and 240)', () => {
    expect(validateMelodyTempo(40).valid).toBe(true);
    expect(validateMelodyTempo(240).valid).toBe(true);
  });

  it('should reject tempo value of 0', () => {
    const result = validateMelodyTempo(0);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('tempo');
  });

  it('should reject negative tempo values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }),
        (tempo) => {
          const result = validateMelodyTempo(tempo);
          expect(result.valid).toBe(false);
          expect(result.errors[0].field).toBe('tempo');
        }
      ),
      { numRuns: 100 }
    );
  });
});
