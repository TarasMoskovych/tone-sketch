import { describe, it, expect } from 'vitest';
import { formatDuration } from '@/utils/duration';

describe('formatDuration', () => {
  describe('invalid inputs return "0:00"', () => {
    it('returns "0:00" for undefined', () => {
      expect(formatDuration(undefined)).toBe('0:00');
    });

    it('returns "0:00" for null', () => {
      expect(formatDuration(null)).toBe('0:00');
    });

    it('returns "0:00" for zero', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('returns "0:00" for negative values', () => {
      expect(formatDuration(-1)).toBe('0:00');
      expect(formatDuration(-100)).toBe('0:00');
    });
  });

  describe('seconds-only range (< 60s)', () => {
    it('formats 5 seconds as "0:05"', () => {
      expect(formatDuration(5)).toBe('0:05');
    });

    it('formats 42 seconds as "0:42"', () => {
      expect(formatDuration(42)).toBe('0:42');
    });

    it('formats 59 seconds as "0:59"', () => {
      expect(formatDuration(59)).toBe('0:59');
    });

    it('formats fractional seconds by flooring', () => {
      expect(formatDuration(5.9)).toBe('0:05');
      expect(formatDuration(59.99)).toBe('0:59');
    });
  });

  describe('minutes range (60s to < 3600s)', () => {
    it('formats 60 seconds as "1:00"', () => {
      expect(formatDuration(60)).toBe('1:00');
    });

    it('formats 65 seconds as "1:05"', () => {
      expect(formatDuration(65)).toBe('1:05');
    });

    it('formats 750 seconds as "12:30"', () => {
      expect(formatDuration(750)).toBe('12:30');
    });

    it('formats 3599 seconds as "59:59"', () => {
      expect(formatDuration(3599)).toBe('59:59');
    });
  });

  describe('hours range (>= 3600s)', () => {
    it('formats 3600 seconds as "1:00:00"', () => {
      expect(formatDuration(3600)).toBe('1:00:00');
    });

    it('formats 3750 seconds as "1:02:30"', () => {
      expect(formatDuration(3750)).toBe('1:02:30');
    });

    it('formats large values correctly', () => {
      expect(formatDuration(36000)).toBe('10:00:00');
    });

    it('zero-pads minutes in H:MM:SS format', () => {
      expect(formatDuration(3665)).toBe('1:01:05');
    });
  });
});
