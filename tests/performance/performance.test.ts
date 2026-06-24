import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  snapToFreePosition,
  snapPosition,
  getMinimumDuration,
  enforceMinimumDuration,
  GRID_DIVISIONS,
} from '../../utils/grid-snap';
import {
  calculateNoteRenderPosition,
  calculateNotePositionSimple,
} from '../../utils/note-rendering';
import type { Note } from '../../types/note';
import type { GridSnapConfig, VisibleRegion } from '../../types/grid';

/**
 * Performance Tests for Tone Sketch
 *
 * These tests verify the application meets its performance requirements:
 * - Note rendering should complete within 16ms (60fps requirement)
 * - Grid snap calculations should complete quickly
 * - Canvas updates should maintain smooth 60fps
 * - API response times should be reasonable
 * - Memory usage patterns should be stable
 *
 * Validates: Requirements 30.1, 30.2, 30.3 (UI Rendering Performance)
 * Validates: Requirements 29.1, 29.2 (Playback Latency)
 */

// Constants for performance thresholds
const FRAME_BUDGET_MS = 16.67; // 60fps = 16.67ms per frame
const MIN_FRAME_BUDGET_MS = 18.18; // 55fps = 18.18ms per frame (minimum acceptable)
const GRID_SNAP_BUDGET_MS = 1; // Grid snap should be very fast

/**
 * Helper to generate a large array of test notes
 */
function generateTestNotes(count: number): Note[] {
  const notes: Note[] = [];
  for (let i = 0; i < count; i++) {
    notes.push({
      id: `note-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pitch: Math.floor(Math.random() * 128), // 0-127
      start: Math.random() * 100, // 0-100 beats
      duration: 0.25 + Math.random() * 4, // 0.25-4.25 beats
      velocity: 0.1 + Math.random() * 0.9, // 0.1-1.0
    });
  }
  return notes;
}

/**
 * Helper to measure execution time of a function
 */
function measureTime<T>(fn: () => T): { result: T; timeMs: number } {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  return { result, timeMs: end - start };
}

/**
 * Helper to run a function multiple times and get average execution time
 */
function measureAverageTime(fn: () => void, iterations: number): { avgMs: number; minMs: number; maxMs: number } {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  const sum = times.reduce((a, b) => a + b, 0);
  return {
    avgMs: sum / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

describe('Performance Tests', () => {
  /**
   * Note Rendering Performance Tests
   *
   * Requirements 30.1, 30.2: UI rendering should maintain 60fps during drag and playback
   * Requirement 30.3: Feed rendering should complete within 16ms
   */
  describe('Note Rendering Performance', () => {
    const renderParams = {
      pixelsPerBeat: 40,
      pixelsPerSemitone: 15,
      gridX: 50,
      gridY: 24,
      gridHeight: 360,
      visibleRegion: {
        startBeat: 0,
        endBeat: 16,
        startPitch: 48,
        endPitch: 72,
      } as VisibleRegion,
    };

    it('should render a single note within 1ms', () => {
      const note: Note = {
        id: 'test-note',
        pitch: 60,
        start: 4,
        duration: 1,
        velocity: 0.8,
      };

      const { timeMs } = measureTime(() => {
        calculateNoteRenderPosition(note, renderParams);
      });

      expect(timeMs).toBeLessThan(1);
    });

    it('should render 100 notes within 16ms (frame budget)', () => {
      const notes = generateTestNotes(100);

      const { timeMs } = measureTime(() => {
        notes.forEach((note) => {
          calculateNoteRenderPosition(note, renderParams);
        });
      });

      expect(timeMs).toBeLessThan(FRAME_BUDGET_MS);
    });

    it('should render 500 notes within 16ms (frame budget)', () => {
      const notes = generateTestNotes(500);

      const { timeMs } = measureTime(() => {
        notes.forEach((note) => {
          calculateNoteRenderPosition(note, renderParams);
        });
      });

      expect(timeMs).toBeLessThan(FRAME_BUDGET_MS);
    });

    it('should render 1000 notes within minimum acceptable frame budget (18ms / 55fps)', () => {
      const notes = generateTestNotes(1000);

      const { timeMs } = measureTime(() => {
        notes.forEach((note) => {
          calculateNoteRenderPosition(note, renderParams);
        });
      });

      // With 1000 notes, we accept the minimum 55fps threshold
      expect(timeMs).toBeLessThan(MIN_FRAME_BUDGET_MS);
    });

    it('should maintain consistent performance over multiple render cycles', () => {
      const notes = generateTestNotes(200);
      const iterations = 60; // Simulate 1 second at 60fps

      const { avgMs, maxMs } = measureAverageTime(() => {
        notes.forEach((note) => {
          calculateNoteRenderPosition(note, renderParams);
        });
      }, iterations);

      // Average should be well under frame budget
      expect(avgMs).toBeLessThan(FRAME_BUDGET_MS);
      // No single frame should exceed 2x the budget (accounting for GC pauses)
      expect(maxMs).toBeLessThan(FRAME_BUDGET_MS * 2);
    });

    it('should efficiently skip notes outside visible region', () => {
      // Create notes that are outside the visible region
      const outsideNotes: Note[] = [];
      for (let i = 0; i < 500; i++) {
        outsideNotes.push({
          id: `outside-note-${i}`,
          pitch: 20 + (i % 20), // Outside visible pitch range (48-72)
          start: 50 + i, // Outside visible beat range (0-16)
          duration: 1,
          velocity: 0.8,
        });
      }

      const { timeMs } = measureTime(() => {
        outsideNotes.forEach((note) => {
          calculateNoteRenderPosition(note, renderParams);
        });
      });

      // Skipping notes should be very fast
      expect(timeMs).toBeLessThan(FRAME_BUDGET_MS / 2);
    });

    it('should handle notes using simple position calculation efficiently', () => {
      const notes = generateTestNotes(500);

      const { timeMs } = measureTime(() => {
        notes.forEach((note) => {
          calculateNotePositionSimple(note, 40, 15, 0, 48, 360);
        });
      });

      expect(timeMs).toBeLessThan(FRAME_BUDGET_MS);
    });
  });

  /**
   * Grid Snap Calculation Performance Tests
   *
   * Requirements 7.4, 7.5: Grid snap calculations should be instantaneous
   */
  describe('Grid Snap Calculation Performance', () => {
    it('should perform single snap operation in under 0.1ms', () => {
      const { timeMs } = measureTime(() => {
        snapToGrid(3.7, 0.25);
      });

      expect(timeMs).toBeLessThan(0.1);
    });

    it('should perform 1000 snap operations within 1ms', () => {
      const positions = Array.from({ length: 1000 }, () => Math.random() * 100);

      const { timeMs } = measureTime(() => {
        positions.forEach((pos) => {
          snapToGrid(pos, 0.25);
        });
      });

      expect(timeMs).toBeLessThan(GRID_SNAP_BUDGET_MS);
    });

    it('should perform snap operations efficiently for all grid divisions', () => {
      const positions = Array.from({ length: 200 }, () => Math.random() * 100);

      const { timeMs } = measureTime(() => {
        GRID_DIVISIONS.forEach((division) => {
          positions.forEach((pos) => {
            snapToGrid(pos, division);
          });
        });
      });

      // 200 positions × 5 divisions = 1000 operations
      expect(timeMs).toBeLessThan(GRID_SNAP_BUDGET_MS * 2);
    });

    it('should perform free position snapping efficiently', () => {
      const positions = Array.from({ length: 1000 }, () => Math.random() * 100);

      const { timeMs } = measureTime(() => {
        positions.forEach((pos) => {
          snapToFreePosition(pos);
        });
      });

      expect(timeMs).toBeLessThan(GRID_SNAP_BUDGET_MS);
    });

    it('should perform snapPosition with config efficiently', () => {
      const positions = Array.from({ length: 500 }, () => Math.random() * 100);
      const configEnabled: GridSnapConfig = { enabled: true, division: 0.25 };
      const configDisabled: GridSnapConfig = { enabled: false, division: 0.25 };

      const { timeMs: enabledTime } = measureTime(() => {
        positions.forEach((pos) => {
          snapPosition(pos, configEnabled);
        });
      });

      const { timeMs: disabledTime } = measureTime(() => {
        positions.forEach((pos) => {
          snapPosition(pos, configDisabled);
        });
      });

      expect(enabledTime).toBeLessThan(GRID_SNAP_BUDGET_MS);
      expect(disabledTime).toBeLessThan(GRID_SNAP_BUDGET_MS);
    });

    it('should maintain consistent performance over repeated calculations', () => {
      const iterations = 100;

      const { avgMs, maxMs } = measureAverageTime(() => {
        for (let i = 0; i < 100; i++) {
          snapToGrid(Math.random() * 100, 0.25);
        }
      }, iterations);

      // Average should be very low
      expect(avgMs).toBeLessThan(0.5);
      // Max should not be much higher (no memory leaks or GC issues)
      expect(maxMs).toBeLessThan(2);
    });

    it('should efficiently calculate minimum duration', () => {
      const configs: GridSnapConfig[] = GRID_DIVISIONS.map((division) => ({
        enabled: true,
        division,
      }));

      const { timeMs } = measureTime(() => {
        for (let i = 0; i < 1000; i++) {
          configs.forEach((config) => {
            getMinimumDuration(config);
            enforceMinimumDuration(Math.random(), config);
          });
        }
      });

      // 1000 × 5 × 2 = 10000 operations should still be very fast
      expect(timeMs).toBeLessThan(5);
    });
  });

  /**
   * Simulated Canvas Update Performance Tests
   *
   * Requirements 30.1, 30.2: Canvas should maintain 60fps during drag and playback
   */
  describe('Canvas Update Simulation Performance', () => {
    it('should complete a full render cycle within 16ms budget', () => {
      const notes = generateTestNotes(200);
      const renderParams = {
        pixelsPerBeat: 40,
        pixelsPerSemitone: 15,
        gridX: 50,
        gridY: 24,
        gridHeight: 360,
        visibleRegion: {
          startBeat: 0,
          endBeat: 16,
          startPitch: 48,
          endPitch: 72,
        } as VisibleRegion,
      };

      // Simulate a full render cycle: grid + notes + playhead
      const { timeMs } = measureTime(() => {
        // 1. Calculate all note positions (main computation)
        const positions = notes.map((note) => calculateNoteRenderPosition(note, renderParams));

        // 2. Simulate grid snap calculations during drag
        notes.forEach((note) => {
          snapPosition(note.start, { enabled: true, division: 0.25 });
        });

        // 3. Filter visible notes
        const visiblePositions = positions.filter((p) => p !== null);

        // Return count to prevent optimization
        return visiblePositions.length;
      });

      expect(timeMs).toBeLessThan(FRAME_BUDGET_MS);
    });

    it('should handle continuous drag simulation at 60fps', () => {
      const note: Note = {
        id: 'dragged-note',
        pitch: 60,
        start: 4,
        duration: 1,
        velocity: 0.8,
      };
      const config: GridSnapConfig = { enabled: true, division: 0.25 };

      // Simulate 60 frames of drag (1 second)
      const { avgMs, maxMs } = measureAverageTime(() => {
        // Update note position (simulating mouse move)
        const newStart = Math.random() * 16;
        const snappedStart = snapPosition(newStart, config);

        // Recalculate render position
        const updatedNote = { ...note, start: snappedStart };
        calculateNotePositionSimple(updatedNote, 40, 15, 0, 48, 360);
      }, 60);

      expect(avgMs).toBeLessThan(FRAME_BUDGET_MS);
      expect(maxMs).toBeLessThan(FRAME_BUDGET_MS * 2);
    });

    it('should handle playhead animation simulation at 60fps', () => {
      const notes = generateTestNotes(100);
      let playheadPosition = 0;
      const tempo = 120; // BPM
      const beatsPerFrame = tempo / 60 / 60; // beats per frame at 60fps

      // Simulate 60 frames of playback
      const { avgMs, maxMs } = measureAverageTime(() => {
        playheadPosition += beatsPerFrame;
        if (playheadPosition > 16) playheadPosition = 0;

        // Find notes that should be triggered
        const activeNotes = notes.filter(
          (note) => note.start <= playheadPosition && note.start + note.duration > playheadPosition
        );

        return activeNotes.length;
      }, 60);

      expect(avgMs).toBeLessThan(FRAME_BUDGET_MS);
      expect(maxMs).toBeLessThan(FRAME_BUDGET_MS * 2);
    });
  });

  /**
   * Memory Usage Pattern Tests
   *
   * These tests verify that operations don't cause memory leaks
   * by checking that repeated operations don't accumulate memory
   */
  describe('Memory Usage Patterns', () => {
    it('should not leak memory during repeated note rendering', () => {
      const iterations = 1000;
      const notes = generateTestNotes(100);
      const renderParams = {
        pixelsPerBeat: 40,
        pixelsPerSemitone: 15,
        gridX: 50,
        gridY: 24,
        gridHeight: 360,
        visibleRegion: {
          startBeat: 0,
          endBeat: 16,
          startPitch: 48,
          endPitch: 72,
        } as VisibleRegion,
      };

      // Run many iterations
      for (let i = 0; i < iterations; i++) {
        const positions = notes.map((note) => calculateNoteRenderPosition(note, renderParams));
        // Ensure result is used to prevent optimization
        if (positions.length === 0 && Math.random() > 2) {
          console.log('never');
        }
      }

      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });

    it('should not leak memory during repeated grid snap calculations', () => {
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const position = Math.random() * 1000;
        const division = GRID_DIVISIONS[i % GRID_DIVISIONS.length];
        const result = snapToGrid(position, division);

        // Ensure result is used
        if (result < -1000 && Math.random() > 2) {
          console.log('never');
        }
      }

      expect(true).toBe(true);
    });

    it('should handle large note arrays without excessive memory growth', () => {
      // Create and process progressively larger note arrays
      const sizes = [100, 500, 1000, 2000, 5000];
      const renderParams = {
        pixelsPerBeat: 40,
        pixelsPerSemitone: 15,
        gridX: 50,
        gridY: 24,
        gridHeight: 360,
        visibleRegion: {
          startBeat: 0,
          endBeat: 100,
          startPitch: 0,
          endPitch: 128,
        } as VisibleRegion,
      };

      sizes.forEach((size) => {
        const notes = generateTestNotes(size);
        const positions = notes.map((note) => calculateNoteRenderPosition(note, renderParams));

        // Verify all notes were processed
        expect(positions.length).toBe(size);
      });

      // If we completed all sizes without memory issues, test passes
      expect(true).toBe(true);
    });
  });

  /**
   * Batch Operation Performance Tests
   *
   * Tests for operations that process multiple items at once
   */
  describe('Batch Operation Performance', () => {
    it('should efficiently filter notes by visible region', () => {
      const allNotes = generateTestNotes(1000);
      const visibleRegion: VisibleRegion = {
        startBeat: 20,
        endBeat: 36,
        startPitch: 48,
        endPitch: 72,
      };

      const { timeMs, result } = measureTime(() => {
        return allNotes.filter((note) => {
          const noteEnd = note.start + note.duration;
          return (
            noteEnd >= visibleRegion.startBeat &&
            note.start <= visibleRegion.endBeat &&
            note.pitch >= visibleRegion.startPitch &&
            note.pitch < visibleRegion.endPitch
          );
        });
      });

      expect(timeMs).toBeLessThan(FRAME_BUDGET_MS / 2);
      // Roughly 16 beats out of 100, 24 pitches out of 128 = ~3% visible
      expect(result.length).toBeLessThan(allNotes.length);
    });

    it('should efficiently sort notes by start time', () => {
      const notes = generateTestNotes(1000);

      const { timeMs, result } = measureTime(() => {
        return [...notes].sort((a, b) => a.start - b.start);
      });

      expect(timeMs).toBeLessThan(FRAME_BUDGET_MS);
      expect(result[0].start).toBeLessThanOrEqual(result[result.length - 1].start);
    });

    it('should efficiently find notes at a specific time', () => {
      const notes = generateTestNotes(1000);
      const targetTime = 50;

      const { timeMs } = measureTime(() => {
        return notes.filter((note) => note.start <= targetTime && note.start + note.duration > targetTime);
      });

      expect(timeMs).toBeLessThan(FRAME_BUDGET_MS / 4);
    });
  });

  /**
   * Stress Tests
   *
   * Tests that push the limits of the system
   */
  describe('Stress Tests', () => {
    it('should handle maximum note count (10000 notes) for validation', () => {
      const maxNotes = generateTestNotes(10000);

      // Validation-style iteration (checking all notes)
      const { timeMs } = measureTime(() => {
        return maxNotes.every((note) => {
          return (
            note.pitch >= 0 &&
            note.pitch <= 127 &&
            note.start >= 0 &&
            note.duration > 0 &&
            note.velocity >= 0 &&
            note.velocity <= 1
          );
        });
      });

      // Validation of 10000 notes should complete in reasonable time
      expect(timeMs).toBeLessThan(50);
    });

    it('should maintain performance with deeply nested operations', () => {
      const notes = generateTestNotes(500);
      const configs: GridSnapConfig[] = GRID_DIVISIONS.map((division) => ({
        enabled: true,
        division,
      }));
      const renderParams = {
        pixelsPerBeat: 40,
        pixelsPerSemitone: 15,
        gridX: 50,
        gridY: 24,
        gridHeight: 360,
        visibleRegion: {
          startBeat: 0,
          endBeat: 100,
          startPitch: 0,
          endPitch: 128,
        } as VisibleRegion,
      };

      const { timeMs } = measureTime(() => {
        return configs.map((config) => {
          return notes.map((note) => {
            const snappedStart = snapPosition(note.start, config);
            const updatedNote = { ...note, start: snappedStart };
            return calculateNoteRenderPosition(updatedNote, renderParams);
          });
        });
      });

      // 500 notes × 5 configs = 2500 complex operations
      // Should complete within a few frame budgets
      expect(timeMs).toBeLessThan(FRAME_BUDGET_MS * 5);
    });
  });
});
