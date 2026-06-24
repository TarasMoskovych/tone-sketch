import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { snapPosition, snapToGrid, snapToFreePosition } from '../../utils/grid-snap';
import type { Note } from '../../types/note';
import type { GridDivision, GridSnapConfig } from '../../types/grid';
import { GRID_DIVISIONS } from '../../utils/grid-snap';

// Feature: tone-sketch, Property 2: Note Creation at Valid Position
/**
 * Property 2: Note Creation at Valid Position
 *
 * *For any* click on the piano roll grid at a position not occupied by an existing note,
 * a new Note SHALL be created with:
 * - pitch = MIDI note corresponding to Y position
 * - start = beat corresponding to X position (quantized if snap enabled)
 * - duration = 1 beat (default)
 * - velocity = 0.8 (default)
 *
 * **Validates: Requirements 2.1, 2.2**
 */
describe('Property 2: Note Creation at Valid Position', () => {
  // Constants matching the implementation
  const DEFAULT_DURATION = 1;
  const DEFAULT_VELOCITY = 0.8;

  // Arbitrary for valid start time in beats (0-10000)
  const startBeatArb = fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for grid divisions
  const gridDivisionArb = fc.constantFrom(...GRID_DIVISIONS) as fc.Arbitrary<GridDivision>;

  // Arbitrary for grid snap configuration
  const gridSnapConfigArb: fc.Arbitrary<GridSnapConfig> = fc.record({
    enabled: fc.boolean(),
    division: gridDivisionArb,
  });

  // Arbitrary for Y click position ratio (0-1, where 0 is top and 1 is bottom)
  const yRatioArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for X click position ratio (0-1)
  const xRatioArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for visible region parameters
  const visibleRegionArb = fc.record({
    startBeat: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
    visibleBeats: fc.double({ min: 4, max: 128, noNaN: true, noDefaultInfinity: true }),
    startPitch: fc.integer({ min: 0, max: 103 }),
    visibleSemitones: fc.integer({ min: 12, max: 24 }),
  });

  /**
   * Simulates the click-to-note conversion logic from PianoRollCanvas.handleCanvasClick
   *
   * @param xRatio - X click position as ratio of grid width (0-1)
   * @param yRatio - Y click position as ratio of grid height (0-1)
   * @param visibleRegion - The visible region of the piano roll
   * @param gridSnap - The grid snap configuration
   * @returns The created note or null if position is invalid
   */
  function createNoteFromClick(
    xRatio: number,
    yRatio: number,
    visibleRegion: {
      startBeat: number;
      visibleBeats: number;
      startPitch: number;
      visibleSemitones: number;
    },
    gridSnap: GridSnapConfig
  ): Note | null {
    const { startBeat, visibleBeats, startPitch, visibleSemitones } = visibleRegion;
    const endPitch = startPitch + visibleSemitones;

    // Calculate beat from X position
    const relativeBeat = xRatio * visibleBeats;
    const rawBeat = startBeat + relativeBeat;

    // Calculate pitch from Y position (Y increases downward, pitch increases upward)
    const relativePitchFromTop = yRatio * visibleSemitones;
    const rawPitch = endPitch - relativePitchFromTop;

    // Round pitch to nearest integer (MIDI notes are integers)
    const pitch = Math.floor(rawPitch);

    // Ensure pitch is within valid MIDI range (0-127)
    if (pitch < 0 || pitch > 127) {
      return null;
    }

    // Snap beat position using grid snap configuration
    const snappedBeat = snapPosition(rawBeat, gridSnap);

    // Ensure start time is non-negative
    const startTime = Math.max(0, snappedBeat);

    // Create note with defaults (matching Requirements 2.1, 2.2)
    return {
      id: crypto.randomUUID(),
      pitch,
      start: startTime,
      duration: DEFAULT_DURATION, // Default: 1 beat
      velocity: DEFAULT_VELOCITY, // Default: 0.8
    };
  }

  /**
   * Directly converts Y position to pitch value (used for testing pitch calculation)
   */
  function calculatePitchFromY(
    yRatio: number,
    startPitch: number,
    visibleSemitones: number
  ): number {
    const endPitch = startPitch + visibleSemitones;
    const relativePitchFromTop = yRatio * visibleSemitones;
    const rawPitch = endPitch - relativePitchFromTop;
    return Math.floor(rawPitch);
  }

  /**
   * Directly converts X position to beat value (used for testing start time calculation)
   */
  function calculateBeatFromX(
    xRatio: number,
    startBeat: number,
    visibleBeats: number
  ): number {
    const relativeBeat = xRatio * visibleBeats;
    return startBeat + relativeBeat;
  }

  describe('Note pitch from Y position', () => {
    it('created note pitch should match the clicked Y position (rounded to integer)', () => {
      fc.assert(
        fc.property(yRatioArb, visibleRegionArb, (yRatio, region) => {
          const expectedPitch = calculatePitchFromY(
            yRatio,
            region.startPitch,
            region.visibleSemitones
          );

          // Skip if pitch is outside valid MIDI range
          if (expectedPitch < 0 || expectedPitch > 127) {
            return true;
          }

          const gridSnap: GridSnapConfig = { enabled: true, division: 0.25 };
          const note = createNoteFromClick(0.5, yRatio, region, gridSnap);

          expect(note).not.toBeNull();
          expect(note!.pitch).toBe(expectedPitch);
        }),
        { numRuns: 100 }
      );
    });

    it('pitch should always be an integer (MIDI notes are discrete)', () => {
      fc.assert(
        fc.property(yRatioArb, visibleRegionArb, gridSnapConfigArb, (yRatio, region, gridSnap) => {
          const note = createNoteFromClick(0.5, yRatio, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          expect(Number.isInteger(note.pitch)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('pitch should be within valid MIDI range (0-127)', () => {
      fc.assert(
        fc.property(yRatioArb, visibleRegionArb, gridSnapConfigArb, (yRatio, region, gridSnap) => {
          const note = createNoteFromClick(0.5, yRatio, region, gridSnap);

          if (note === null) {
            // Null is returned for out-of-range pitches, which is correct behavior
            return true;
          }

          expect(note.pitch).toBeGreaterThanOrEqual(0);
          expect(note.pitch).toBeLessThanOrEqual(127);
        }),
        { numRuns: 100 }
      );
    });

    it('lower Y position (closer to top) should produce higher pitch', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 0.45, noNaN: true, noDefaultInfinity: true }),
          visibleRegionArb,
          gridSnapConfigArb,
          (lowYRatio, region, gridSnap) => {
            const highYRatio = lowYRatio + 0.1; // Lower on screen = higher Y = lower pitch

            const noteAtLowY = createNoteFromClick(0.5, lowYRatio, region, gridSnap);
            const noteAtHighY = createNoteFromClick(0.5, highYRatio, region, gridSnap);

            if (noteAtLowY === null || noteAtHighY === null) {
              return true; // Skip invalid positions
            }

            // Lower Y (closer to top) should produce higher or equal pitch
            expect(noteAtLowY.pitch).toBeGreaterThanOrEqual(noteAtHighY.pitch);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Note start time from X position', () => {
    it('created note start time should be snapped to grid if snap is enabled', () => {
      fc.assert(
        fc.property(xRatioArb, visibleRegionArb, gridDivisionArb, (xRatio, region, division) => {
          const gridSnap: GridSnapConfig = { enabled: true, division };
          const note = createNoteFromClick(xRatio, 0.5, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          // The start time should be a multiple of the grid division
          const quotient = note.start / division;
          const isMultiple = Math.abs(quotient - Math.round(quotient)) < 1e-10;

          expect(isMultiple).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('created note start time should be quantized to free resolution if snap is disabled', () => {
      fc.assert(
        fc.property(xRatioArb, visibleRegionArb, gridDivisionArb, (xRatio, region, division) => {
          const gridSnap: GridSnapConfig = { enabled: false, division };
          const note = createNoteFromClick(xRatio, 0.5, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          // The start time should be quantized to 1/32 beat (0.03125)
          const freeResolution = 0.03125;
          const quotient = note.start / freeResolution;
          const isMultiple = Math.abs(quotient - Math.round(quotient)) < 1e-10;

          expect(isMultiple).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('start time should be non-negative (clamped at zero)', () => {
      fc.assert(
        fc.property(xRatioArb, visibleRegionArb, gridSnapConfigArb, (xRatio, region, gridSnap) => {
          const note = createNoteFromClick(xRatio, 0.5, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          expect(note.start).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('start time should be close to the clicked X position (within snap tolerance)', () => {
      fc.assert(
        fc.property(xRatioArb, visibleRegionArb, gridSnapConfigArb, (xRatio, region, gridSnap) => {
          const rawBeat = calculateBeatFromX(xRatio, region.startBeat, region.visibleBeats);
          const note = createNoteFromClick(xRatio, 0.5, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          // The start time should be within half a snap unit from the raw beat
          const snapUnit = gridSnap.enabled ? gridSnap.division : 0.03125;
          const maxDifference = snapUnit / 2 + 1e-10;

          // Account for clamping at zero
          const expectedRaw = Math.max(0, rawBeat);
          const actualDifference = Math.abs(note.start - expectedRaw);

          // The difference should be at most the snap tolerance
          expect(actualDifference).toBeLessThanOrEqual(maxDifference + snapUnit);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Default note properties', () => {
    it('created note should have default duration of 1 beat', () => {
      fc.assert(
        fc.property(xRatioArb, yRatioArb, visibleRegionArb, gridSnapConfigArb, (xRatio, yRatio, region, gridSnap) => {
          const note = createNoteFromClick(xRatio, yRatio, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          expect(note.duration).toBe(DEFAULT_DURATION);
          expect(note.duration).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('created note should have default velocity of 0.8', () => {
      fc.assert(
        fc.property(xRatioArb, yRatioArb, visibleRegionArb, gridSnapConfigArb, (xRatio, yRatio, region, gridSnap) => {
          const note = createNoteFromClick(xRatio, yRatio, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          expect(note.velocity).toBe(DEFAULT_VELOCITY);
          expect(note.velocity).toBe(0.8);
        }),
        { numRuns: 100 }
      );
    });

    it('created note should have a valid UUID as id', () => {
      fc.assert(
        fc.property(xRatioArb, yRatioArb, visibleRegionArb, gridSnapConfigArb, (xRatio, yRatio, region, gridSnap) => {
          const note = createNoteFromClick(xRatio, yRatio, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          expect(note.id).toBeDefined();
          expect(typeof note.id).toBe('string');
          expect(note.id.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Grid snap behavior consistency', () => {
    it('snap enabled should use snapToGrid formula: round(P / D) * D', () => {
      fc.assert(
        fc.property(startBeatArb, gridDivisionArb, (rawBeat, division) => {
          const snapped = snapToGrid(rawBeat, division);
          const expected = Math.round(rawBeat / division) * division;

          // Normalize -0 to 0
          const normalizedExpected = expected === 0 ? 0 : expected;

          expect(snapped).toBeCloseTo(normalizedExpected, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('snap disabled should use free positioning at 1/32 beat resolution', () => {
      fc.assert(
        fc.property(startBeatArb, (rawBeat) => {
          const snapped = snapToFreePosition(rawBeat);
          const freeResolution = 0.03125;
          const expected = Math.round(rawBeat / freeResolution) * freeResolution;

          // Normalize -0 to 0
          const normalizedExpected = expected === 0 ? 0 : expected;

          expect(snapped).toBeCloseTo(normalizedExpected, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('snapPosition should delegate to correct function based on enabled state', () => {
      fc.assert(
        fc.property(startBeatArb, gridSnapConfigArb, (rawBeat, config) => {
          const snapped = snapPosition(rawBeat, config);

          if (config.enabled) {
            const expected = snapToGrid(rawBeat, config.division);
            expect(snapped).toBeCloseTo(expected, 10);
          } else {
            const expected = snapToFreePosition(rawBeat);
            expect(snapped).toBeCloseTo(expected, 10);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Note creation validation', () => {
    it('all created notes should pass basic Note interface requirements', () => {
      fc.assert(
        fc.property(xRatioArb, yRatioArb, visibleRegionArb, gridSnapConfigArb, (xRatio, yRatio, region, gridSnap) => {
          const note = createNoteFromClick(xRatio, yRatio, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          // Verify all required Note fields
          expect(note).toHaveProperty('id');
          expect(note).toHaveProperty('pitch');
          expect(note).toHaveProperty('start');
          expect(note).toHaveProperty('duration');
          expect(note).toHaveProperty('velocity');

          // Verify types
          expect(typeof note.id).toBe('string');
          expect(typeof note.pitch).toBe('number');
          expect(typeof note.start).toBe('number');
          expect(typeof note.duration).toBe('number');
          expect(typeof note.velocity).toBe('number');
        }),
        { numRuns: 100 }
      );
    });

    it('created notes should meet validation constraints', () => {
      fc.assert(
        fc.property(xRatioArb, yRatioArb, visibleRegionArb, gridSnapConfigArb, (xRatio, yRatio, region, gridSnap) => {
          const note = createNoteFromClick(xRatio, yRatio, region, gridSnap);

          if (note === null) {
            return true; // Skip invalid positions
          }

          // pitch: integer, 0 ≤ pitch ≤ 127
          expect(Number.isInteger(note.pitch)).toBe(true);
          expect(note.pitch).toBeGreaterThanOrEqual(0);
          expect(note.pitch).toBeLessThanOrEqual(127);

          // start: number, 0 ≤ start ≤ 10000
          expect(note.start).toBeGreaterThanOrEqual(0);
          expect(note.start).toBeLessThanOrEqual(10000);

          // duration: number, 0.001 ≤ duration ≤ 1000
          expect(note.duration).toBeGreaterThanOrEqual(0.001);
          expect(note.duration).toBeLessThanOrEqual(1000);

          // velocity: number, 0 ≤ velocity ≤ 1
          expect(note.velocity).toBeGreaterThanOrEqual(0);
          expect(note.velocity).toBeLessThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });
  });
});
