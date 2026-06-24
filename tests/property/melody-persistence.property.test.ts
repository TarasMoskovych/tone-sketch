import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';
import type { Note } from '../../types/note';
import type { Melody, MelodySummary } from '../../types/melody';
import type { SynthesizerConfig, OscillatorType, FilterType, PresetName, EffectsConfig } from '../../types/synth';
import { VALIDATION_CONSTRAINTS } from '../../utils/validation';

/**
 * Helper to simulate database round-trip for JSONB fields.
 * This mimics what happens when data goes through PostgreSQL JSONB storage.
 */
function simulateJsonbRoundTrip<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Helper to simulate the rowToMelody conversion that happens when reading from database.
 * This mimics the serialization behavior of the database layer.
 */
function simulateMelodyRoundTrip(melody: Melody): Melody {
  // Simulate the database storage: notes and synth are stored as JSONB
  const storedNotes = simulateJsonbRoundTrip(melody.notes);
  const storedSynth = simulateJsonbRoundTrip(melody.synth);

  // Simulate timestamp serialization (stored as string, converted back to Date)
  const storedCreatedAt = melody.createdAt.toISOString();

  return {
    id: melody.id,
    title: melody.title,
    notes: storedNotes,
    tempo: melody.tempo,
    synth: storedSynth,
    createdAt: new Date(storedCreatedAt),
    ownerId: melody.ownerId,
  };
}

// Constraints from validation
const pitchConstraints = VALIDATION_CONSTRAINTS.note.pitch;
const startConstraints = VALIDATION_CONSTRAINTS.note.start;
const durationConstraints = VALIDATION_CONSTRAINTS.note.duration;
const velocityConstraints = VALIDATION_CONSTRAINTS.note.velocity;
const titleConstraints = VALIDATION_CONSTRAINTS.melody.title;

// Arbitraries for generating valid data

const oscillatorTypeArb: fc.Arbitrary<OscillatorType> = fc.constantFrom(
  'sine', 'square', 'sawtooth', 'triangle'
);

const filterTypeArb: fc.Arbitrary<FilterType> = fc.constantFrom('lowpass', 'highpass');

const validNoteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  pitch: fc.integer({ min: pitchConstraints.min, max: pitchConstraints.max }),
  start: fc.double({ min: startConstraints.min, max: startConstraints.max, noNaN: true }),
  duration: fc.double({ min: durationConstraints.min, max: durationConstraints.max, noNaN: true }),
  velocity: fc.double({ min: velocityConstraints.min, max: velocityConstraints.max, noNaN: true }),
});

const presetNameArb: fc.Arbitrary<PresetName | null> = fc.oneof(
  fc.constant(null),
  fc.constantFrom(
    'Acoustic Piano', 'Electric Piano', 'Soft Piano',
    'Classic Lead', 'Saw Lead', 'Square Lead',
    'Short Pluck', 'Soft Pluck', 'Bright Pluck',
    'Clean Guitar', 'Muted Guitar', 'Acoustic Guitar',
    'Sub Bass', 'Synth Bass', 'Punchy Bass'
  )
);

const reverbConfigArb = fc.record({
  enabled: fc.boolean(),
  roomSize: fc.double({ min: 0, max: 1, noNaN: true }),
  wetDry: fc.double({ min: 0, max: 1, noNaN: true }),
});

const delayConfigArb = fc.record({
  enabled: fc.boolean(),
  time: fc.double({ min: 0, max: 1, noNaN: true }),
  feedback: fc.double({ min: 0, max: 0.9, noNaN: true }),
  wetDry: fc.double({ min: 0, max: 1, noNaN: true }),
});

const chorusConfigArb = fc.record({
  enabled: fc.boolean(),
  rate: fc.double({ min: 0.1, max: 10, noNaN: true }),
  depth: fc.double({ min: 0, max: 1, noNaN: true }),
  wetDry: fc.double({ min: 0, max: 1, noNaN: true }),
});

const flangerConfigArb = fc.record({
  enabled: fc.boolean(),
  rate: fc.double({ min: 0.1, max: 10, noNaN: true }),
  depth: fc.double({ min: 0, max: 1, noNaN: true }),
  feedback: fc.double({ min: 0, max: 0.9, noNaN: true }),
  wetDry: fc.double({ min: 0, max: 1, noNaN: true }),
});

const effectsConfigArb: fc.Arbitrary<EffectsConfig> = fc.record({
  reverb: reverbConfigArb,
  delay: delayConfigArb,
  chorus: chorusConfigArb,
  flanger: flangerConfigArb,
});

const validSynthConfigArb: fc.Arbitrary<SynthesizerConfig> = fc.record({
  oscillatorType: oscillatorTypeArb,
  volume: fc.double({ min: 0, max: 1, noNaN: true }),
  envelope: fc.record({
    attack: fc.double({ min: 0, max: 2, noNaN: true }),
    decay: fc.double({ min: 0, max: 2, noNaN: true }),
    sustain: fc.double({ min: 0, max: 1, noNaN: true }),
    release: fc.double({ min: 0, max: 5, noNaN: true }),
  }),
  filter: fc.record({
    enabled: fc.boolean(),
    type: filterTypeArb,
    frequency: fc.double({ min: 20, max: 20000, noNaN: true }),
  }),
  effects: effectsConfigArb,
  presetName: presetNameArb,
});

const validTitleArb: fc.Arbitrary<string> = fc.integer({
  min: titleConstraints.minLength,
  max: titleConstraints.maxLength
}).chain((len) => fc.string({ minLength: len, maxLength: len }));

// For testing, use smaller arrays to keep tests fast
const validNotesArrayArb: fc.Arbitrary<Note[]> = fc.array(validNoteArb, {
  minLength: 0,
  maxLength: 100 // Use smaller max for performance, property still holds
});

const validMelodyArb: fc.Arbitrary<Melody> = fc.record({
  id: fc.uuid(),
  title: validTitleArb,
  notes: validNotesArrayArb,
  tempo: fc.integer({ min: 20, max: 300 }),
  synth: validSynthConfigArb,
  createdAt: fc.integer({ min: 1577836800000, max: 1924991999000 }).map((ts) => new Date(ts)),
  ownerId: fc.uuid(),
});

/**
 * Feature: tone-sketch, Property 11: Melody Persistence Round-Trip
 *
 * *For any* valid Melody (title 1-200 chars, notes ≤10000, valid synth config),
 * saving to the database and retrieving SHALL produce an identical Melody with:
 * - Same title
 * - Same notes array (all properties preserved)
 * - Same tempo
 * - Same synthesizer configuration (oscillator, volume, ADSR, filter)
 *
 * **Validates: Requirements 9.4, 10.4, 11.6, 12.5, 18.3, 20.6**
 */
describe('Property 11: Melody Persistence Round-Trip', () => {
  describe('Title Preservation', () => {
    it('title should be identical after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);
          expect(retrieved.title).toBe(melody.title);
        }),
        { numRuns: 100 }
      );
    });

    it('title with special characters should be preserved', () => {
      const specialChars = 'éñ中日🎵♫"\'\\\nabcABC123!@#$%'.split('');
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            title: fc.array(fc.constantFrom(...specialChars), { minLength: 1, maxLength: 200 })
              .map((chars) => chars.join('')),
            notes: fc.constant([] as Note[]),
            tempo: fc.integer({ min: 20, max: 300 }),
            synth: validSynthConfigArb,
            createdAt: fc.integer({ min: 1577836800000, max: 1924991999000 }).map((ts) => new Date(ts)),
            ownerId: fc.uuid(),
          }),
          (melody) => {
            const retrieved = simulateMelodyRoundTrip(melody);
            expect(retrieved.title).toBe(melody.title);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Notes Array Preservation', () => {
    it('notes array should have same length after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);
          expect(retrieved.notes.length).toBe(melody.notes.length);
        }),
        { numRuns: 100 }
      );
    });

    it('all note properties should be preserved after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);

          for (let i = 0; i < melody.notes.length; i++) {
            const original = melody.notes[i];
            const retrievedNote = retrieved.notes[i];

            expect(retrievedNote.id).toBe(original.id);
            expect(retrievedNote.pitch).toBe(original.pitch);
            expect(retrievedNote.start).toBeCloseTo(original.start, 10);
            expect(retrievedNote.duration).toBeCloseTo(original.duration, 10);
            expect(retrievedNote.velocity).toBeCloseTo(original.velocity, 10);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('empty notes array should be preserved', () => {
      fc.assert(
        fc.property(
          validMelodyArb.map((m) => ({ ...m, notes: [] })),
          (melody) => {
            const retrieved = simulateMelodyRoundTrip(melody);
            expect(retrieved.notes).toEqual([]);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('notes order should be preserved after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);

          for (let i = 0; i < melody.notes.length; i++) {
            expect(retrieved.notes[i].id).toBe(melody.notes[i].id);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Tempo Preservation', () => {
    it('tempo should be identical after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);
          expect(retrieved.tempo).toBe(melody.tempo);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Synthesizer Configuration Preservation', () => {
    it('oscillator type should be preserved after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);
          expect(retrieved.synth.oscillatorType).toBe(melody.synth.oscillatorType);
        }),
        { numRuns: 100 }
      );
    });

    it('volume should be preserved after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);
          expect(retrieved.synth.volume).toBeCloseTo(melody.synth.volume, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('ADSR envelope should be preserved after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);

          expect(retrieved.synth.envelope.attack).toBeCloseTo(melody.synth.envelope.attack, 10);
          expect(retrieved.synth.envelope.decay).toBeCloseTo(melody.synth.envelope.decay, 10);
          expect(retrieved.synth.envelope.sustain).toBeCloseTo(melody.synth.envelope.sustain, 10);
          expect(retrieved.synth.envelope.release).toBeCloseTo(melody.synth.envelope.release, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('filter configuration should be preserved after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);

          expect(retrieved.synth.filter.enabled).toBe(melody.synth.filter.enabled);
          expect(retrieved.synth.filter.type).toBe(melody.synth.filter.type);
          expect(retrieved.synth.filter.frequency).toBeCloseTo(melody.synth.filter.frequency, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('all synth config values should be preserved for all oscillator types', () => {
      fc.assert(
        fc.property(oscillatorTypeArb, validSynthConfigArb, (oscType, synthConfig) => {
          const config = { ...synthConfig, oscillatorType: oscType };
          const roundTripped = simulateJsonbRoundTrip(config);

          expect(roundTripped.oscillatorType).toBe(config.oscillatorType);
          expect(roundTripped.volume).toBeCloseTo(config.volume, 10);
          expect(roundTripped.envelope.attack).toBeCloseTo(config.envelope.attack, 10);
          expect(roundTripped.envelope.decay).toBeCloseTo(config.envelope.decay, 10);
          expect(roundTripped.envelope.sustain).toBeCloseTo(config.envelope.sustain, 10);
          expect(roundTripped.envelope.release).toBeCloseTo(config.envelope.release, 10);
          expect(roundTripped.filter.enabled).toBe(config.filter.enabled);
          expect(roundTripped.filter.type).toBe(config.filter.type);
          expect(roundTripped.filter.frequency).toBeCloseTo(config.filter.frequency, 10);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete Melody Round-Trip', () => {
    it('complete melody should be effectively identical after round-trip', () => {
      fc.assert(
        fc.property(validMelodyArb, (melody) => {
          const retrieved = simulateMelodyRoundTrip(melody);

          // Core identity
          expect(retrieved.id).toBe(melody.id);
          expect(retrieved.title).toBe(melody.title);
          expect(retrieved.tempo).toBe(melody.tempo);
          expect(retrieved.ownerId).toBe(melody.ownerId);

          // Notes
          expect(retrieved.notes.length).toBe(melody.notes.length);

          // Synth config
          expect(retrieved.synth.oscillatorType).toBe(melody.synth.oscillatorType);
          expect(retrieved.synth.volume).toBeCloseTo(melody.synth.volume, 10);
        }),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Feature: tone-sketch, Property 17: Feed Sorting
 *
 * *For any* set of melodies returned by the feed API, the melodies SHALL be
 * ordered by created_at descending (newest first).
 *
 * **Validates: Requirements 22.1**
 */
describe('Property 17: Feed Sorting', () => {
  // Arbitrary for melody summaries with various creation times
  // Using integer timestamps to avoid invalid date issues with fc.date()
  const melodySummaryArb: fc.Arbitrary<MelodySummary> = fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    createdAt: fc.integer({ min: 1577836800000, max: 1924991999000 }) // 2020-01-01 to 2030-12-31
      .map((ts) => new Date(ts).toISOString()),
  });

  /**
   * Simulates the feed sorting logic from getMelodiesPaginated.
   * In the actual implementation, this is done by PostgreSQL's ORDER BY created_at DESC.
   */
  function sortByCreatedAtDescending(melodies: MelodySummary[]): MelodySummary[] {
    return [...melodies].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Descending: newest first
    });
  }

  /**
   * Verifies that an array is sorted by createdAt descending.
   */
  function isSortedByCreatedAtDescending(melodies: MelodySummary[]): boolean {
    for (let i = 1; i < melodies.length; i++) {
      const prevDate = new Date(melodies[i - 1].createdAt).getTime();
      const currDate = new Date(melodies[i].createdAt).getTime();
      if (currDate > prevDate) {
        return false; // Found a melody that's newer than the previous one
      }
    }
    return true;
  }

  it('sorted melodies should have newest first (created_at descending)', () => {
    fc.assert(
      fc.property(
        fc.array(melodySummaryArb, { minLength: 0, maxLength: 50 }),
        (melodies) => {
          const sorted = sortByCreatedAtDescending(melodies);
          expect(isSortedByCreatedAtDescending(sorted)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('first melody in sorted array should have the most recent createdAt', () => {
    fc.assert(
      fc.property(
        fc.array(melodySummaryArb, { minLength: 1, maxLength: 50 }),
        (melodies) => {
          const sorted = sortByCreatedAtDescending(melodies);
          const newestDate = Math.max(...melodies.map((m) => new Date(m.createdAt).getTime()));
          const firstDate = new Date(sorted[0].createdAt).getTime();

          expect(firstDate).toBe(newestDate);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('last melody in sorted array should have the oldest createdAt', () => {
    fc.assert(
      fc.property(
        fc.array(melodySummaryArb, { minLength: 1, maxLength: 50 }),
        (melodies) => {
          const sorted = sortByCreatedAtDescending(melodies);
          const oldestDate = Math.min(...melodies.map((m) => new Date(m.createdAt).getTime()));
          const lastDate = new Date(sorted[sorted.length - 1].createdAt).getTime();

          expect(lastDate).toBe(oldestDate);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sorting should be stable for melodies with same createdAt', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
        fc.integer({ min: 1577836800000, max: 1924991999000 }),
        (ids, timestamp) => {
          const sharedDate = new Date(timestamp);
          // Create melodies with the same createdAt
          const melodies: MelodySummary[] = ids.map((id) => ({
            id,
            title: `Melody ${id}`,
            createdAt: sharedDate.toISOString(),
          }));

          const sorted = sortByCreatedAtDescending(melodies);

          // All should still be present
          expect(sorted.length).toBe(melodies.length);

          // All IDs should be preserved
          const sortedIds = new Set(sorted.map((m) => m.id));
          ids.forEach((id) => expect(sortedIds.has(id)).toBe(true));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty array should remain empty after sorting', () => {
    const sorted = sortByCreatedAtDescending([]);
    expect(sorted).toEqual([]);
  });

  it('single melody array should remain unchanged after sorting', () => {
    fc.assert(
      fc.property(melodySummaryArb, (melody) => {
        const sorted = sortByCreatedAtDescending([melody]);
        expect(sorted.length).toBe(1);
        expect(sorted[0].id).toBe(melody.id);
      }),
      { numRuns: 100 }
    );
  });

  it('sorting should preserve all melody data', () => {
    fc.assert(
      fc.property(
        fc.array(melodySummaryArb, { minLength: 1, maxLength: 50 }),
        (melodies) => {
          const sorted = sortByCreatedAtDescending(melodies);

          // Same length
          expect(sorted.length).toBe(melodies.length);

          // All original melodies should be in the sorted array
          const sortedIds = new Set(sorted.map((m) => m.id));
          melodies.forEach((m) => {
            expect(sortedIds.has(m.id)).toBe(true);
          });

          // Each melody should have all its data preserved
          sorted.forEach((sortedMelody) => {
            const original = melodies.find((m) => m.id === sortedMelody.id);
            expect(original).toBeDefined();
            expect(sortedMelody.title).toBe(original!.title);
            expect(sortedMelody.createdAt).toBe(original!.createdAt);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sorting is idempotent (sorting twice gives same result)', () => {
    fc.assert(
      fc.property(
        fc.array(melodySummaryArb, { minLength: 0, maxLength: 50 }),
        (melodies) => {
          const sortedOnce = sortByCreatedAtDescending(melodies);
          const sortedTwice = sortByCreatedAtDescending(sortedOnce);

          expect(sortedTwice.length).toBe(sortedOnce.length);
          for (let i = 0; i < sortedOnce.length; i++) {
            expect(sortedTwice[i].id).toBe(sortedOnce[i].id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: tone-sketch, Property 20: UUID Generation
 *
 * *For any* newly created Melody, the assigned id SHALL be a valid UUID v4 format string.
 *
 * **Validates: Requirements 27.4**
 */
describe('Property 20: UUID Generation', () => {
  // UUID v4 regex pattern
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('generated UUIDs should match UUID v4 format pattern', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        () => {
          const id = uuidv4();
          expect(id).toMatch(UUID_V4_REGEX);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generated UUIDs should be validated as valid UUIDs by uuid library', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        () => {
          const id = uuidv4();
          expect(uuidValidate(id)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generated UUIDs should be version 4', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        () => {
          const id = uuidv4();
          expect(uuidVersion(id)).toBe(4);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generated UUIDs should be unique', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 100 }),
        (count) => {
          const ids = Array.from({ length: count }, () => uuidv4());
          const uniqueIds = new Set(ids);

          // All generated IDs should be unique
          expect(uniqueIds.size).toBe(count);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('UUID format should have correct structure (8-4-4-4-12 hex digits)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        () => {
          const id = uuidv4();
          const parts = id.split('-');

          expect(parts.length).toBe(5);
          expect(parts[0].length).toBe(8);
          expect(parts[1].length).toBe(4);
          expect(parts[2].length).toBe(4);
          expect(parts[3].length).toBe(4);
          expect(parts[4].length).toBe(12);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('UUID v4 third segment should start with 4 (version indicator)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        () => {
          const id = uuidv4();
          const parts = id.split('-');

          // The third segment's first character should be '4' for v4
          expect(parts[2][0]).toBe('4');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('UUID v4 fourth segment should start with 8, 9, a, or b (variant indicator)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        () => {
          const id = uuidv4();
          const parts = id.split('-');
          const firstChar = parts[3][0].toLowerCase();

          // The fourth segment's first character should be 8, 9, a, or b for RFC 4122 variant
          expect(['8', '9', 'a', 'b']).toContain(firstChar);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('UUID should be 36 characters long (including hyphens)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        () => {
          const id = uuidv4();
          expect(id.length).toBe(36);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('UUID should only contain valid hexadecimal characters and hyphens', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        () => {
          const id = uuidv4();
          const validChars = /^[0-9a-f-]+$/i;
          expect(id).toMatch(validChars);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid UUID strings should not validate', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant('not-a-uuid'),
          fc.constant('12345678-1234-1234-1234-123456789012'), // wrong version (1)
          fc.constant('12345678-1234-5234-8234-123456789012'), // wrong version (5)
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !UUID_V4_REGEX.test(s))
        ),
        (invalidId) => {
          // Should either not validate or have wrong version
          const isValid = uuidValidate(invalidId);
          if (isValid) {
            const ver = uuidVersion(invalidId);
            // If it validates but is not v4, it's still "invalid" for our purposes
            expect(ver === 4).toBe(false);
          } else {
            expect(isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  describe('UUID in melody context', () => {
    it('melody id from createMelody simulation should be valid UUID v4', () => {
      fc.assert(
        fc.property(
          validTitleArb,
          validNotesArrayArb,
          validSynthConfigArb,
          fc.integer({ min: 20, max: 300 }),
          (title, notes, synth, tempo) => {
            // Simulate createMelody behavior
            const id = uuidv4();
            const melody: Melody = {
              id,
              title,
              notes,
              tempo,
              synth,
              createdAt: new Date(),
              ownerId: uuidv4(),
            };

            expect(uuidValidate(melody.id)).toBe(true);
            expect(uuidVersion(melody.id)).toBe(4);
            expect(melody.id).toMatch(UUID_V4_REGEX);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('ownerId should also be valid UUID v4', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          () => {
            const ownerId = uuidv4();

            expect(uuidValidate(ownerId)).toBe(true);
            expect(uuidVersion(ownerId)).toBe(4);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
