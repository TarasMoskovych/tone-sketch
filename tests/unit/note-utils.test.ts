import { describe, it, expect } from 'vitest';
import {
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
} from '../../lib/note-utils';
import { validate as uuidValidate, version as uuidVersion } from 'uuid';
import type { Note } from '../../types/note';

describe('Note Utils', () => {
  describe('midiToNoteName', () => {
    it('should convert MIDI 0 to C-1', () => {
      expect(midiToNoteName(0)).toBe('C-1');
    });

    it('should convert MIDI 60 to C4 (Middle C)', () => {
      expect(midiToNoteName(60)).toBe('C4');
    });

    it('should convert MIDI 69 to A4 (Concert A, 440Hz)', () => {
      expect(midiToNoteName(69)).toBe('A4');
    });

    it('should convert MIDI 72 to C5', () => {
      expect(midiToNoteName(72)).toBe('C5');
    });

    it('should convert MIDI 127 to G9', () => {
      expect(midiToNoteName(127)).toBe('G9');
    });

    it('should handle sharp notes correctly', () => {
      expect(midiToNoteName(61)).toBe('C#4'); // C#4
      expect(midiToNoteName(63)).toBe('D#4'); // D#4
      expect(midiToNoteName(66)).toBe('F#4'); // F#4
      expect(midiToNoteName(68)).toBe('G#4'); // G#4
      expect(midiToNoteName(70)).toBe('A#4'); // A#4
    });

    it('should handle octave boundaries correctly', () => {
      // C notes at each octave boundary
      expect(midiToNoteName(0)).toBe('C-1');   // Octave -1
      expect(midiToNoteName(12)).toBe('C0');   // Octave 0
      expect(midiToNoteName(24)).toBe('C1');   // Octave 1
      expect(midiToNoteName(36)).toBe('C2');   // Octave 2
      expect(midiToNoteName(48)).toBe('C3');   // Octave 3
      expect(midiToNoteName(60)).toBe('C4');   // Octave 4
      expect(midiToNoteName(72)).toBe('C5');   // Octave 5
      expect(midiToNoteName(84)).toBe('C6');   // Octave 6
      expect(midiToNoteName(96)).toBe('C7');   // Octave 7
      expect(midiToNoteName(108)).toBe('C8');  // Octave 8
      expect(midiToNoteName(120)).toBe('C9');  // Octave 9
    });

    it('should handle B notes (last note before octave change)', () => {
      expect(midiToNoteName(11)).toBe('B-1');
      expect(midiToNoteName(23)).toBe('B0');
      expect(midiToNoteName(35)).toBe('B1');
      expect(midiToNoteName(59)).toBe('B3');
      expect(midiToNoteName(71)).toBe('B4');
    });
  });

  describe('isBlackKey', () => {
    it('should return true for sharp notes', () => {
      // C#
      expect(isBlackKey(1)).toBe(true);
      expect(isBlackKey(13)).toBe(true);
      expect(isBlackKey(61)).toBe(true);

      // D#
      expect(isBlackKey(3)).toBe(true);
      expect(isBlackKey(63)).toBe(true);

      // F#
      expect(isBlackKey(6)).toBe(true);
      expect(isBlackKey(66)).toBe(true);

      // G#
      expect(isBlackKey(8)).toBe(true);
      expect(isBlackKey(68)).toBe(true);

      // A#
      expect(isBlackKey(10)).toBe(true);
      expect(isBlackKey(70)).toBe(true);
    });

    it('should return false for natural notes', () => {
      // C
      expect(isBlackKey(0)).toBe(false);
      expect(isBlackKey(60)).toBe(false);

      // D
      expect(isBlackKey(2)).toBe(false);
      expect(isBlackKey(62)).toBe(false);

      // E
      expect(isBlackKey(4)).toBe(false);
      expect(isBlackKey(64)).toBe(false);

      // F
      expect(isBlackKey(5)).toBe(false);
      expect(isBlackKey(65)).toBe(false);

      // G
      expect(isBlackKey(7)).toBe(false);
      expect(isBlackKey(67)).toBe(false);

      // A
      expect(isBlackKey(9)).toBe(false);
      expect(isBlackKey(69)).toBe(false);

      // B
      expect(isBlackKey(11)).toBe(false);
      expect(isBlackKey(71)).toBe(false);
    });
  });

  describe('isWhiteKey', () => {
    it('should return true for natural notes', () => {
      expect(isWhiteKey(60)).toBe(true);  // C4
      expect(isWhiteKey(62)).toBe(true);  // D4
      expect(isWhiteKey(64)).toBe(true);  // E4
      expect(isWhiteKey(65)).toBe(true);  // F4
      expect(isWhiteKey(67)).toBe(true);  // G4
      expect(isWhiteKey(69)).toBe(true);  // A4
      expect(isWhiteKey(71)).toBe(true);  // B4
    });

    it('should return false for sharp notes', () => {
      expect(isWhiteKey(61)).toBe(false); // C#4
      expect(isWhiteKey(63)).toBe(false); // D#4
      expect(isWhiteKey(66)).toBe(false); // F#4
      expect(isWhiteKey(68)).toBe(false); // G#4
      expect(isWhiteKey(70)).toBe(false); // A#4
    });

    it('should be the inverse of isBlackKey', () => {
      for (let i = 0; i <= 127; i++) {
        expect(isWhiteKey(i)).toBe(!isBlackKey(i));
      }
    });
  });

  describe('getNoteLetter', () => {
    it('should return correct note letter for all notes in an octave', () => {
      expect(getNoteLetter(60)).toBe('C');
      expect(getNoteLetter(61)).toBe('C#');
      expect(getNoteLetter(62)).toBe('D');
      expect(getNoteLetter(63)).toBe('D#');
      expect(getNoteLetter(64)).toBe('E');
      expect(getNoteLetter(65)).toBe('F');
      expect(getNoteLetter(66)).toBe('F#');
      expect(getNoteLetter(67)).toBe('G');
      expect(getNoteLetter(68)).toBe('G#');
      expect(getNoteLetter(69)).toBe('A');
      expect(getNoteLetter(70)).toBe('A#');
      expect(getNoteLetter(71)).toBe('B');
    });

    it('should return same note letter for same note across octaves', () => {
      expect(getNoteLetter(0)).toBe('C');
      expect(getNoteLetter(12)).toBe('C');
      expect(getNoteLetter(60)).toBe('C');
      expect(getNoteLetter(120)).toBe('C');
    });
  });

  describe('getOctave', () => {
    it('should return -1 for MIDI notes 0-11', () => {
      expect(getOctave(0)).toBe(-1);
      expect(getOctave(11)).toBe(-1);
    });

    it('should return 0 for MIDI notes 12-23', () => {
      expect(getOctave(12)).toBe(0);
      expect(getOctave(23)).toBe(0);
    });

    it('should return 4 for Middle C (MIDI 60)', () => {
      expect(getOctave(60)).toBe(4);
    });

    it('should return 9 for highest MIDI note (127)', () => {
      expect(getOctave(127)).toBe(9);
    });
  });

  describe('constants', () => {
    it('should have 12 note names', () => {
      expect(NOTE_NAMES.length).toBe(12);
    });

    it('should have correct note names order', () => {
      expect(NOTE_NAMES).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
    });

    it('should have 5 black key indices', () => {
      expect(BLACK_KEY_INDICES.length).toBe(5);
    });

    it('should have correct black key indices', () => {
      expect([...BLACK_KEY_INDICES]).toEqual([1, 3, 6, 8, 10]);
    });

    it('should have correct note constraints', () => {
      expect(NOTE_CONSTRAINTS.pitch).toEqual({ min: 0, max: 127 });
      expect(NOTE_CONSTRAINTS.start).toEqual({ min: 0, max: 10000 });
      expect(NOTE_CONSTRAINTS.duration).toEqual({ min: 0.001, max: 1000 });
      expect(NOTE_CONSTRAINTS.velocity).toEqual({ min: 0, max: 1 });
    });
  });

  describe('generateNoteId', () => {
    it('should return a valid UUID v4', () => {
      const id = generateNoteId();
      expect(uuidValidate(id)).toBe(true);
      expect(uuidVersion(id)).toBe(4);
    });

    it('should generate unique IDs on each call', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateNoteId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('validateNote', () => {
    const createValidNote = (overrides: Partial<Note> = {}): Note => ({
      id: 'test-id',
      pitch: 60,
      start: 0,
      duration: 1,
      velocity: 0.8,
      ...overrides,
    });

    describe('valid notes', () => {
      it('should accept a valid note with typical values', () => {
        const note = createValidNote();
        const result = validateNote(note);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept pitch at minimum boundary (0)', () => {
        const note = createValidNote({ pitch: 0 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });

      it('should accept pitch at maximum boundary (127)', () => {
        const note = createValidNote({ pitch: 127 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });

      it('should accept start at minimum boundary (0)', () => {
        const note = createValidNote({ start: 0 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });

      it('should accept start at maximum boundary (10000)', () => {
        const note = createValidNote({ start: 10000 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });

      it('should accept duration at minimum boundary (0.001)', () => {
        const note = createValidNote({ duration: 0.001 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });

      it('should accept duration at maximum boundary (1000)', () => {
        const note = createValidNote({ duration: 1000 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });

      it('should accept velocity at minimum boundary (0)', () => {
        const note = createValidNote({ velocity: 0 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });

      it('should accept velocity at maximum boundary (1)', () => {
        const note = createValidNote({ velocity: 1 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });
    });

    describe('pitch validation', () => {
      it('should reject pitch below minimum', () => {
        const note = createValidNote({ pitch: -1 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'pitch' })
        );
      });

      it('should reject pitch above maximum', () => {
        const note = createValidNote({ pitch: 128 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'pitch' })
        );
      });

      it('should reject non-integer pitch', () => {
        const note = createValidNote({ pitch: 60.5 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'pitch', message: 'pitch must be an integer' })
        );
      });
    });

    describe('start validation', () => {
      it('should reject start below minimum', () => {
        const note = createValidNote({ start: -0.001 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'start' })
        );
      });

      it('should reject start above maximum', () => {
        const note = createValidNote({ start: 10001 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'start' })
        );
      });

      it('should accept non-integer start (fractional beats)', () => {
        const note = createValidNote({ start: 0.5 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });
    });

    describe('duration validation', () => {
      it('should reject duration below minimum', () => {
        const note = createValidNote({ duration: 0 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'duration' })
        );
      });

      it('should reject duration at zero', () => {
        const note = createValidNote({ duration: 0 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
      });

      it('should reject duration above maximum', () => {
        const note = createValidNote({ duration: 1001 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'duration' })
        );
      });

      it('should accept fractional duration', () => {
        const note = createValidNote({ duration: 0.25 });
        const result = validateNote(note);
        expect(result.valid).toBe(true);
      });
    });

    describe('velocity validation', () => {
      it('should reject velocity below minimum', () => {
        const note = createValidNote({ velocity: -0.001 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'velocity' })
        );
      });

      it('should reject velocity above maximum', () => {
        const note = createValidNote({ velocity: 1.001 });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'velocity' })
        );
      });
    });

    describe('multiple validation errors', () => {
      it('should report all validation errors', () => {
        const note = createValidNote({
          pitch: 128,
          start: -1,
          duration: 0,
          velocity: 2,
        });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(4);
        expect(result.errors.map(e => e.field)).toEqual(
          expect.arrayContaining(['pitch', 'start', 'duration', 'velocity'])
        );
      });
    });

    describe('type validation', () => {
      it('should reject non-number pitch', () => {
        const note = createValidNote({ pitch: 'C4' as unknown as number });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'pitch' })
        );
      });

      it('should reject NaN values', () => {
        const note = createValidNote({ start: NaN });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'start' })
        );
      });

      it('should reject Infinity values', () => {
        const note = createValidNote({ duration: Infinity });
        const result = validateNote(note);
        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ field: 'duration' })
        );
      });
    });
  });
});
