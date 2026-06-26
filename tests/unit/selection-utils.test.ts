import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isPlatformModifierKey, getNotesInRect, SelectionRect, calculateGroupMoveConstraints } from '../../lib/selection-utils';
import type { Note } from '../../types/note';

describe('Selection Utils', () => {
  describe('isPlatformModifierKey', () => {
    // Store original navigator
    const originalNavigator = global.navigator;

    // Helper to create mock events
    const createMockMouseEvent = (ctrlKey = false, metaKey = false): MouseEvent => {
      return {
        ctrlKey,
        metaKey,
        shiftKey: false,
        altKey: false,
      } as MouseEvent;
    };

    const createMockKeyboardEvent = (ctrlKey = false, metaKey = false): KeyboardEvent => {
      return {
        ctrlKey,
        metaKey,
        shiftKey: false,
        altKey: false,
        key: 'a',
      } as KeyboardEvent;
    };

    afterEach(() => {
      // Restore original navigator after each test
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    describe('on macOS', () => {
      beforeEach(() => {
        // Mock macOS navigator
        Object.defineProperty(global, 'navigator', {
          value: { platform: 'MacIntel' },
          writable: true,
          configurable: true,
        });
      });

      it('should return true when metaKey (Cmd) is pressed on MouseEvent', () => {
        const event = createMockMouseEvent(false, true);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should return true when metaKey (Cmd) is pressed on KeyboardEvent', () => {
        const event = createMockKeyboardEvent(false, true);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should return false when ctrlKey is pressed but not metaKey', () => {
        const event = createMockMouseEvent(true, false);
        expect(isPlatformModifierKey(event)).toBe(false);
      });

      it('should return false when no modifier keys are pressed', () => {
        const event = createMockMouseEvent(false, false);
        expect(isPlatformModifierKey(event)).toBe(false);
      });

      it('should return true when both ctrlKey and metaKey are pressed (metaKey takes precedence)', () => {
        const event = createMockMouseEvent(true, true);
        expect(isPlatformModifierKey(event)).toBe(true);
      });
    });

    describe('on Windows', () => {
      beforeEach(() => {
        // Mock Windows navigator
        Object.defineProperty(global, 'navigator', {
          value: { platform: 'Win32' },
          writable: true,
          configurable: true,
        });
      });

      it('should return true when ctrlKey is pressed on MouseEvent', () => {
        const event = createMockMouseEvent(true, false);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should return true when ctrlKey is pressed on KeyboardEvent', () => {
        const event = createMockKeyboardEvent(true, false);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should return false when metaKey (Win key) is pressed but not ctrlKey', () => {
        const event = createMockMouseEvent(false, true);
        expect(isPlatformModifierKey(event)).toBe(false);
      });

      it('should return false when no modifier keys are pressed', () => {
        const event = createMockMouseEvent(false, false);
        expect(isPlatformModifierKey(event)).toBe(false);
      });

      it('should return true when both ctrlKey and metaKey are pressed (ctrlKey takes precedence)', () => {
        const event = createMockMouseEvent(true, true);
        expect(isPlatformModifierKey(event)).toBe(true);
      });
    });

    describe('on Linux', () => {
      beforeEach(() => {
        // Mock Linux navigator
        Object.defineProperty(global, 'navigator', {
          value: { platform: 'Linux x86_64' },
          writable: true,
          configurable: true,
        });
      });

      it('should return true when ctrlKey is pressed on MouseEvent', () => {
        const event = createMockMouseEvent(true, false);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should return true when ctrlKey is pressed on KeyboardEvent', () => {
        const event = createMockKeyboardEvent(true, false);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should return false when metaKey is pressed but not ctrlKey', () => {
        const event = createMockMouseEvent(false, true);
        expect(isPlatformModifierKey(event)).toBe(false);
      });

      it('should return false when no modifier keys are pressed', () => {
        const event = createMockMouseEvent(false, false);
        expect(isPlatformModifierKey(event)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should detect MacM1 as macOS', () => {
        Object.defineProperty(global, 'navigator', {
          value: { platform: 'MacM1' },
          writable: true,
          configurable: true,
        });
        const event = createMockMouseEvent(false, true);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should detect MacPPC as macOS', () => {
        Object.defineProperty(global, 'navigator', {
          value: { platform: 'MacPPC' },
          writable: true,
          configurable: true,
        });
        const event = createMockMouseEvent(false, true);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should handle case-insensitive platform detection', () => {
        Object.defineProperty(global, 'navigator', {
          value: { platform: 'MACINTEL' },
          writable: true,
          configurable: true,
        });
        const event = createMockMouseEvent(false, true);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should handle undefined navigator gracefully', () => {
        Object.defineProperty(global, 'navigator', {
          value: undefined,
          writable: true,
          configurable: true,
        });
        // When navigator is undefined, should default to non-Mac behavior (use ctrlKey)
        const event = createMockMouseEvent(true, false);
        expect(isPlatformModifierKey(event)).toBe(true);
      });

      it('should handle missing platform property gracefully', () => {
        Object.defineProperty(global, 'navigator', {
          value: {},
          writable: true,
          configurable: true,
        });
        // When platform is undefined, should default to non-Mac behavior (use ctrlKey)
        const event = createMockMouseEvent(true, false);
        expect(isPlatformModifierKey(event)).toBe(true);
      });
    });
  });

  describe('getNotesInRect', () => {
    // Helper to create a note with specific properties
    const createNote = (
      id: string,
      start: number,
      duration: number,
      pitch: number
    ): Note => ({
      id,
      start,
      duration,
      pitch,
      velocity: 0.8,
    });

    describe('basic intersection', () => {
      it('should return note that is fully inside the rectangle', () => {
        const notes: Note[] = [createNote('note1', 2, 1, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual(['note1']);
      });

      it('should return note that partially overlaps the rectangle horizontally', () => {
        // Note starts before rect and extends into it
        const notes: Note[] = [createNote('note1', -1, 2, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual(['note1']);
      });

      it('should return note that extends beyond the rectangle horizontally', () => {
        // Note starts inside rect and extends past it
        const notes: Note[] = [createNote('note1', 3, 5, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual(['note1']);
      });

      it('should return note that spans the entire rectangle', () => {
        // Note starts before rect and extends past it
        const notes: Note[] = [createNote('note1', -2, 10, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual(['note1']);
      });

      it('should not return note that is completely before the rectangle', () => {
        const notes: Note[] = [createNote('note1', 0, 1, 65)];
        const rect: SelectionRect = { startBeat: 2, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });

      it('should not return note that is completely after the rectangle', () => {
        const notes: Note[] = [createNote('note1', 5, 1, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });
    });

    describe('pitch intersection', () => {
      it('should return note at the start pitch boundary (inclusive)', () => {
        const notes: Note[] = [createNote('note1', 2, 1, 60)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual(['note1']);
      });

      it('should not return note at the end pitch boundary (exclusive)', () => {
        const notes: Note[] = [createNote('note1', 2, 1, 72)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });

      it('should not return note with pitch below the rectangle', () => {
        const notes: Note[] = [createNote('note1', 2, 1, 50)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });

      it('should not return note with pitch above the rectangle', () => {
        const notes: Note[] = [createNote('note1', 2, 1, 80)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });
    });

    describe('boundary conditions', () => {
      it('should not return note that ends exactly at startBeat (no overlap)', () => {
        // Note ends at beat 2, rect starts at beat 2
        const notes: Note[] = [createNote('note1', 0, 2, 65)];
        const rect: SelectionRect = { startBeat: 2, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });

      it('should not return note that starts exactly at endBeat (no overlap)', () => {
        // Note starts at beat 4, rect ends at beat 4
        const notes: Note[] = [createNote('note1', 4, 1, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });

      it('should return note that ends just after startBeat (minimal overlap)', () => {
        // Note ends at beat 2.1, rect starts at beat 2
        const notes: Note[] = [createNote('note1', 0, 2.1, 65)];
        const rect: SelectionRect = { startBeat: 2, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual(['note1']);
      });

      it('should return note that starts just before endBeat (minimal overlap)', () => {
        // Note starts at beat 3.9, rect ends at beat 4
        const notes: Note[] = [createNote('note1', 3.9, 1, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual(['note1']);
      });
    });

    describe('multiple notes', () => {
      it('should return multiple notes that intersect', () => {
        const notes: Note[] = [
          createNote('note1', 1, 1, 65),
          createNote('note2', 2, 1, 66),
          createNote('note3', 3, 1, 67),
        ];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toHaveLength(3);
        expect(result).toContain('note1');
        expect(result).toContain('note2');
        expect(result).toContain('note3');
      });

      it('should return only notes that intersect, excluding those outside', () => {
        const notes: Note[] = [
          createNote('note1', 1, 1, 65), // inside
          createNote('note2', 10, 1, 66), // outside (time)
          createNote('note3', 2, 1, 50), // outside (pitch)
          createNote('note4', 2, 1, 67), // inside
        ];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toHaveLength(2);
        expect(result).toContain('note1');
        expect(result).toContain('note4');
        expect(result).not.toContain('note2');
        expect(result).not.toContain('note3');
      });
    });

    describe('edge cases', () => {
      it('should return empty array for empty notes array', () => {
        const notes: Note[] = [];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });

      it('should return empty array for zero-width rectangle', () => {
        const notes: Note[] = [createNote('note1', 2, 1, 65)];
        const rect: SelectionRect = { startBeat: 2, endBeat: 2, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });

      it('should return empty array for zero-height rectangle', () => {
        const notes: Note[] = [createNote('note1', 2, 1, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 65, endPitch: 65 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual([]);
      });

      it('should handle rectangle with inverted beat range (no notes selected)', () => {
        const notes: Note[] = [createNote('note1', 2, 1, 65)];
        const rect: SelectionRect = { startBeat: 4, endBeat: 0, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        // With inverted beats (start > end), no note can satisfy start < endBeat && start + duration > startBeat
        expect(result).toEqual([]);
      });

      it('should handle very small duration notes', () => {
        const notes: Note[] = [createNote('note1', 2, 0.001, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };

        const result = getNotesInRect(notes, rect);
        expect(result).toEqual(['note1']);
      });

      it('should handle visibleRegion parameter (reserved for future use)', () => {
        const notes: Note[] = [createNote('note1', 2, 1, 65)];
        const rect: SelectionRect = { startBeat: 0, endBeat: 4, startPitch: 60, endPitch: 72 };
        const visibleRegion = { startBeat: 0, endBeat: 16, startPitch: 48, endPitch: 84 };

        const result = getNotesInRect(notes, rect, visibleRegion);
        expect(result).toEqual(['note1']);
      });
    });
  });

  describe('calculateGroupMoveConstraints', () => {
    // Helper to create a note with specific properties
    const createNote = (
      id: string,
      start: number,
      pitch: number,
      duration = 1,
      velocity = 0.8
    ): Note => ({
      id,
      start,
      pitch,
      duration,
      velocity,
    });

    describe('no constraints needed', () => {
      it('should return original deltas when movement is within bounds', () => {
        const notes: Note[] = [
          createNote('note1', 4, 60),
          createNote('note2', 6, 65),
        ];

        const result = calculateGroupMoveConstraints(notes, 2, 5);
        expect(result.constrainedDeltaBeat).toBe(2);
        expect(result.constrainedDeltaPitch).toBe(5);
      });

      it('should return original deltas when moving notes in valid range', () => {
        const notes: Note[] = [createNote('note1', 10, 64)];

        const result = calculateGroupMoveConstraints(notes, -5, -10);
        expect(result.constrainedDeltaBeat).toBe(-5);
        expect(result.constrainedDeltaPitch).toBe(-10);
      });

      it('should return original deltas for empty notes array', () => {
        const result = calculateGroupMoveConstraints([], -10, 200);
        expect(result.constrainedDeltaBeat).toBe(-10);
        expect(result.constrainedDeltaPitch).toBe(200);
      });
    });

    describe('beat constraints (start >= 0)', () => {
      it('should constrain deltaBeat when a note would have negative start time', () => {
        const notes: Note[] = [
          createNote('note1', 2, 60),
          createNote('note2', 5, 65),
        ];

        // Try to move left by 5 beats (note1 would go to -3)
        const result = calculateGroupMoveConstraints(notes, -5, 0);
        expect(result.constrainedDeltaBeat).toBe(-2); // Constrained to -2 so note1 stays at 0
        expect(result.constrainedDeltaPitch).toBe(0);
      });

      it('should constrain to zero delta when note is already at start=0', () => {
        const notes: Note[] = [
          createNote('note1', 0, 60),
          createNote('note2', 5, 65),
        ];

        const result = calculateGroupMoveConstraints(notes, -3, 0);
        expect(result.constrainedDeltaBeat).toBe(0); // Cannot move left at all
      });

      it('should allow exact movement to boundary', () => {
        const notes: Note[] = [createNote('note1', 3, 60)];

        const result = calculateGroupMoveConstraints(notes, -3, 0);
        expect(result.constrainedDeltaBeat).toBe(-3); // Can move exactly to 0
      });

      it('should handle fractional start times', () => {
        const notes: Note[] = [createNote('note1', 0.5, 60)];

        const result = calculateGroupMoveConstraints(notes, -1, 0);
        expect(result.constrainedDeltaBeat).toBe(-0.5); // Constrained to keep at 0
      });
    });

    describe('pitch lower bound constraints (pitch >= 0)', () => {
      it('should constrain deltaPitch when a note would have negative pitch', () => {
        const notes: Note[] = [
          createNote('note1', 4, 5), // Low pitch
          createNote('note2', 6, 60),
        ];

        // Try to move down by 10 pitches (note1 would go to -5)
        const result = calculateGroupMoveConstraints(notes, 0, -10);
        expect(result.constrainedDeltaBeat).toBe(0);
        expect(result.constrainedDeltaPitch).toBe(-5); // Constrained to -5 so note1 stays at 0
      });

      it('should constrain to zero delta when note is already at pitch=0', () => {
        const notes: Note[] = [createNote('note1', 4, 0)];

        const result = calculateGroupMoveConstraints(notes, 0, -5);
        expect(result.constrainedDeltaPitch).toBe(0); // Cannot move down at all
      });
    });

    describe('pitch upper bound constraints (pitch <= 127)', () => {
      it('should constrain deltaPitch when a note would exceed pitch 127', () => {
        const notes: Note[] = [
          createNote('note1', 4, 60),
          createNote('note2', 6, 120), // High pitch
        ];

        // Try to move up by 10 pitches (note2 would go to 130)
        const result = calculateGroupMoveConstraints(notes, 0, 10);
        expect(result.constrainedDeltaBeat).toBe(0);
        expect(result.constrainedDeltaPitch).toBe(7); // Constrained to 7 so note2 stays at 127
      });

      it('should constrain to zero delta when note is already at pitch=127', () => {
        const notes: Note[] = [createNote('note1', 4, 127)];

        const result = calculateGroupMoveConstraints(notes, 0, 5);
        expect(result.constrainedDeltaPitch).toBe(0); // Cannot move up at all
      });

      it('should allow exact movement to upper boundary', () => {
        const notes: Note[] = [createNote('note1', 4, 120)];

        const result = calculateGroupMoveConstraints(notes, 0, 7);
        expect(result.constrainedDeltaPitch).toBe(7); // Can move exactly to 127
      });
    });

    describe('combined constraints', () => {
      it('should constrain both beat and pitch simultaneously', () => {
        const notes: Note[] = [
          createNote('note1', 1, 5), // Near start and low pitch
          createNote('note2', 10, 120), // High pitch
        ];

        // Try to move left by 3 beats and up by 10 pitches
        const result = calculateGroupMoveConstraints(notes, -3, 10);
        expect(result.constrainedDeltaBeat).toBe(-1); // Constrained by note1.start
        expect(result.constrainedDeltaPitch).toBe(7); // Constrained by note2.pitch
      });

      it('should handle notes at both pitch boundaries', () => {
        const notes: Note[] = [
          createNote('note1', 4, 0), // At lower pitch bound
          createNote('note2', 6, 127), // At upper pitch bound
        ];

        // Cannot move up or down
        const resultUp = calculateGroupMoveConstraints(notes, 0, 5);
        expect(resultUp.constrainedDeltaPitch).toBe(0);

        const resultDown = calculateGroupMoveConstraints(notes, 0, -5);
        expect(resultDown.constrainedDeltaPitch).toBe(0);
      });
    });

    describe('edge cases', () => {
      it('should handle single note at all boundaries', () => {
        const notes: Note[] = [createNote('note1', 0, 0)];

        // Cannot move left or down
        const result = calculateGroupMoveConstraints(notes, -5, -5);
        expect(result.constrainedDeltaBeat).toBe(0);
        expect(result.constrainedDeltaPitch).toBe(0);
      });

      it('should handle single note at upper pitch boundary', () => {
        const notes: Note[] = [createNote('note1', 5, 127)];

        // Cannot move up
        const result = calculateGroupMoveConstraints(notes, 0, 10);
        expect(result.constrainedDeltaPitch).toBe(0);
      });

      it('should preserve positive deltas when all notes are within bounds', () => {
        const notes: Note[] = [
          createNote('note1', 10, 50),
          createNote('note2', 15, 60),
          createNote('note3', 20, 70),
        ];

        const result = calculateGroupMoveConstraints(notes, 5, 20);
        expect(result.constrainedDeltaBeat).toBe(5);
        expect(result.constrainedDeltaPitch).toBe(20);
      });

      it('should handle many notes correctly', () => {
        // Create notes spread across the valid range
        const notes: Note[] = [
          createNote('note1', 0, 10),
          createNote('note2', 5, 50),
          createNote('note3', 10, 100),
          createNote('note4', 15, 127),
        ];

        // Try to move down by 20 pitches
        const result = calculateGroupMoveConstraints(notes, 0, -20);
        expect(result.constrainedDeltaPitch).toBe(-10); // Constrained by note1 at pitch 10
      });

      it('should handle zero deltas', () => {
        const notes: Note[] = [createNote('note1', 5, 60)];

        const result = calculateGroupMoveConstraints(notes, 0, 0);
        expect(result.constrainedDeltaBeat).toBe(0);
        expect(result.constrainedDeltaPitch).toBe(0);
      });
    });
  });
});
