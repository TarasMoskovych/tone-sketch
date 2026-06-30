import { describe, it, expect } from 'vitest';
import { computeMelodyDuration } from '@/lib/duration';
import type { Note } from '@/types/note';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'test-note-id',
    pitch: 60,
    start: 0,
    duration: 1,
    velocity: 0.8,
    ...overrides,
  };
}

describe('computeMelodyDuration', () => {
  describe('edge cases returning 0', () => {
    it('returns 0 for empty notes array', () => {
      expect(computeMelodyDuration([], 120)).toBe(0);
    });

    it('returns 0 for zero tempo', () => {
      const notes = [createNote({ start: 0, duration: 4 })];
      expect(computeMelodyDuration(notes, 0)).toBe(0);
    });

    it('returns 0 for negative tempo', () => {
      const notes = [createNote({ start: 0, duration: 4 })];
      expect(computeMelodyDuration(notes, -60)).toBe(0);
    });
  });

  describe('correct formula application', () => {
    it('computes duration for a single note', () => {
      // note ends at beat 4, tempo 120 BPM → (4 / 120) * 60 = 2 seconds
      const notes = [createNote({ start: 0, duration: 4 })];
      expect(computeMelodyDuration(notes, 120)).toBe(2);
    });

    it('uses the note with the latest end time', () => {
      // First note ends at beat 2, second note ends at beat 6
      // maxEndBeat = 6, tempo 120 → (6 / 120) * 60 = 3 seconds
      const notes = [
        createNote({ id: '1', start: 0, duration: 2 }),
        createNote({ id: '2', start: 2, duration: 4 }),
      ];
      expect(computeMelodyDuration(notes, 120)).toBe(3);
    });

    it('rounds to 2 decimal places', () => {
      // note ends at beat 1, tempo 90 BPM → (1 / 90) * 60 = 0.6666... → rounds to 0.67
      const notes = [createNote({ start: 0, duration: 1 })];
      expect(computeMelodyDuration(notes, 90)).toBe(0.67);
    });

    it('handles fractional start and duration', () => {
      // note: start=0.5, duration=1.5 → end=2.0, tempo=60 → (2 / 60) * 60 = 2
      const notes = [createNote({ start: 0.5, duration: 1.5 })];
      expect(computeMelodyDuration(notes, 60)).toBe(2);
    });

    it('computes correctly at tempo 60 (1 beat = 1 second)', () => {
      // end at beat 8, tempo 60 → (8 / 60) * 60 = 8 seconds
      const notes = [createNote({ start: 4, duration: 4 })];
      expect(computeMelodyDuration(notes, 60)).toBe(8);
    });
  });
});
