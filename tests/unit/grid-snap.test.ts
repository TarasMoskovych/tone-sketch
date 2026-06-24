import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  snapToFreePosition,
  snapPosition,
  getMinimumDuration,
  enforceMinimumDuration,
  calculateSnappedEndTime,
  isValidGridDivision,
  GRID_DIVISIONS,
  FREE_POSITION_RESOLUTION,
  MIN_DURATION_SNAP_DISABLED,
} from '../../utils/grid-snap';
import type { GridSnapConfig } from '../../types/grid';

describe('Grid Snap Utility Functions', () => {
  describe('snapToGrid', () => {
    it('should snap position to nearest whole beat (division 1)', () => {
      expect(snapToGrid(0.3, 1)).toBe(0);
      expect(snapToGrid(0.5, 1)).toBe(1);
      expect(snapToGrid(0.7, 1)).toBe(1);
      expect(snapToGrid(1.4, 1)).toBe(1);
      expect(snapToGrid(1.6, 1)).toBe(2);
    });

    it('should snap position to nearest half beat (division 0.5)', () => {
      expect(snapToGrid(0.2, 0.5)).toBe(0);
      expect(snapToGrid(0.3, 0.5)).toBe(0.5);
      expect(snapToGrid(0.7, 0.5)).toBe(0.5);
      expect(snapToGrid(0.8, 0.5)).toBe(1);
    });

    it('should snap position to nearest quarter beat (division 0.25)', () => {
      expect(snapToGrid(0.1, 0.25)).toBe(0);
      expect(snapToGrid(0.2, 0.25)).toBe(0.25);
      expect(snapToGrid(0.3, 0.25)).toBe(0.25);
      expect(snapToGrid(0.4, 0.25)).toBe(0.5);
    });

    it('should snap position to nearest eighth beat (division 0.125)', () => {
      expect(snapToGrid(0.05, 0.125)).toBe(0);
      expect(snapToGrid(0.1, 0.125)).toBe(0.125);
      expect(snapToGrid(0.15, 0.125)).toBe(0.125);
      expect(snapToGrid(0.2, 0.125)).toBe(0.25);
    });

    it('should snap position to nearest sixteenth beat (division 0.0625)', () => {
      expect(snapToGrid(0.025, 0.0625)).toBe(0);
      expect(snapToGrid(0.05, 0.0625)).toBe(0.0625);
      expect(snapToGrid(0.08, 0.0625)).toBe(0.0625);
      expect(snapToGrid(0.1, 0.0625)).toBe(0.125);
    });

    it('should handle negative positions by snapping to nearest value', () => {
      expect(snapToGrid(-0.3, 1)).toBe(0);
      expect(snapToGrid(-0.6, 1)).toBe(-1);
    });

    it('should handle edge cases', () => {
      expect(snapToGrid(0, 1)).toBe(0);
      expect(snapToGrid(NaN, 1)).toBe(0);
      expect(snapToGrid(Infinity, 1)).toBe(0);
      expect(snapToGrid(-Infinity, 1)).toBe(0);
    });
  });

  describe('snapToFreePosition', () => {
    it('should snap to 1/32 beat resolution (0.03125)', () => {
      expect(snapToFreePosition(0.01)).toBe(0);
      expect(snapToFreePosition(0.02)).toBe(0.03125);
      expect(snapToFreePosition(0.03125)).toBe(0.03125);
      expect(snapToFreePosition(0.05)).toBe(0.0625);
    });

    it('should handle edge cases', () => {
      expect(snapToFreePosition(0)).toBe(0);
      expect(snapToFreePosition(NaN)).toBe(0);
      expect(snapToFreePosition(Infinity)).toBe(0);
    });
  });

  describe('snapPosition', () => {
    it('should use snapToGrid when snap is enabled', () => {
      const config: GridSnapConfig = { enabled: true, division: 0.25 };
      expect(snapPosition(0.3, config)).toBe(0.25);
      expect(snapPosition(0.4, config)).toBe(0.5);
    });

    it('should use snapToFreePosition when snap is disabled', () => {
      const config: GridSnapConfig = { enabled: false, division: 0.25 };
      // Free position uses 1/32 beat resolution (0.03125)
      expect(snapPosition(0.02, config)).toBe(0.03125);
      expect(snapPosition(0.05, config)).toBe(0.0625);
    });
  });

  describe('getMinimumDuration', () => {
    it('should return grid division when snap is enabled', () => {
      expect(getMinimumDuration({ enabled: true, division: 1 })).toBe(1);
      expect(getMinimumDuration({ enabled: true, division: 0.5 })).toBe(0.5);
      expect(getMinimumDuration({ enabled: true, division: 0.25 })).toBe(0.25);
      expect(getMinimumDuration({ enabled: true, division: 0.125 })).toBe(0.125);
      expect(getMinimumDuration({ enabled: true, division: 0.0625 })).toBe(0.0625);
    });

    it('should return 0.1 when snap is disabled', () => {
      expect(getMinimumDuration({ enabled: false, division: 1 })).toBe(0.1);
      expect(getMinimumDuration({ enabled: false, division: 0.25 })).toBe(0.1);
    });
  });

  describe('enforceMinimumDuration', () => {
    it('should enforce minimum duration when snap enabled', () => {
      const config: GridSnapConfig = { enabled: true, division: 0.25 };
      expect(enforceMinimumDuration(0.1, config)).toBe(0.25);
      expect(enforceMinimumDuration(0.5, config)).toBe(0.5);
    });

    it('should enforce minimum duration when snap disabled', () => {
      const config: GridSnapConfig = { enabled: false, division: 0.25 };
      expect(enforceMinimumDuration(0.05, config)).toBe(0.1);
      expect(enforceMinimumDuration(0.5, config)).toBe(0.5);
    });
  });

  describe('calculateSnappedEndTime', () => {
    it('should snap end time and ensure minimum duration', () => {
      const config: GridSnapConfig = { enabled: true, division: 0.25 };

      // End time snaps to 1, duration would be 1 beat, which is >= 0.25 min
      expect(calculateSnappedEndTime(0, 0.9, config)).toBe(1);

      // End time snaps to 0.25, but start is 0.2, so duration is 0.05 < 0.25
      // Should return start + minDuration = 0.2 + 0.25 = 0.45
      expect(calculateSnappedEndTime(0.2, 0.25, config)).toBe(0.45);
    });

    it('should use free positioning when snap disabled', () => {
      const config: GridSnapConfig = { enabled: false, division: 0.25 };

      // End snaps to 1/32 resolution, min duration is 0.1
      expect(calculateSnappedEndTime(0, 0.5, config)).toBe(0.5);
    });
  });

  describe('isValidGridDivision', () => {
    it('should return true for valid grid divisions', () => {
      expect(isValidGridDivision(1)).toBe(true);
      expect(isValidGridDivision(0.5)).toBe(true);
      expect(isValidGridDivision(0.25)).toBe(true);
      expect(isValidGridDivision(0.125)).toBe(true);
      expect(isValidGridDivision(0.0625)).toBe(true);
    });

    it('should return false for invalid grid divisions', () => {
      expect(isValidGridDivision(0.3)).toBe(false);
      expect(isValidGridDivision(2)).toBe(false);
      expect(isValidGridDivision(0)).toBe(false);
    });
  });

  describe('constants', () => {
    it('should export correct GRID_DIVISIONS', () => {
      expect(GRID_DIVISIONS).toEqual([1, 0.5, 0.25, 0.125, 0.0625]);
    });

    it('should export correct FREE_POSITION_RESOLUTION', () => {
      expect(FREE_POSITION_RESOLUTION).toBe(0.03125);
    });

    it('should export correct MIN_DURATION_SNAP_DISABLED', () => {
      expect(MIN_DURATION_SNAP_DISABLED).toBe(0.1);
    });
  });
});
