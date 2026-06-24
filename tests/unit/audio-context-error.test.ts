import { describe, it, expect, afterEach } from 'vitest';
import {
  createAudioContextError,
  detectAudioErrorType,
  isWebAudioSupported,
  getAudioContextState,
  AUDIO_ERROR_CODES,
} from '../../lib/audio-context-error';

describe('Audio Context Error Module', () => {
  describe('createAudioContextError()', () => {
    it('should create initialization_failed error with correct properties', () => {
      const error = createAudioContextError('initialization_failed');

      expect(error.type).toBe('initialization_failed');
      expect(error.message).toContain('Could not initialize audio');
      expect(error.recoverable).toBe(false);
      expect(error.suggestedAction).toBeDefined();
    });

    it('should create autoplay_blocked error with correct properties', () => {
      const error = createAudioContextError('autoplay_blocked');

      expect(error.type).toBe('autoplay_blocked');
      expect(error.message).toContain('requires interaction');
      expect(error.recoverable).toBe(true);
      expect(error.suggestedAction).toContain('Click');
    });

    it('should create context_suspended error with correct properties', () => {
      const error = createAudioContextError('context_suspended');

      expect(error.type).toBe('context_suspended');
      expect(error.message).toContain('paused');
      expect(error.recoverable).toBe(true);
    });

    it('should create context_closed error with correct properties', () => {
      const error = createAudioContextError('context_closed');

      expect(error.type).toBe('context_closed');
      expect(error.message).toContain('closed');
      expect(error.recoverable).toBe(false);
    });

    it('should create not_supported error with correct properties', () => {
      const error = createAudioContextError('not_supported');

      expect(error.type).toBe('not_supported');
      expect(error.message).toContain('not supported');
      expect(error.recoverable).toBe(false);
    });

    it('should create playback_failed error with correct properties', () => {
      const error = createAudioContextError('playback_failed');

      expect(error.type).toBe('playback_failed');
      expect(error.message).toContain('Failed to play');
      expect(error.recoverable).toBe(true);
    });

    it('should create unknown error with correct properties', () => {
      const error = createAudioContextError('unknown');

      expect(error.type).toBe('unknown');
      expect(error.message).toContain('unexpected');
      expect(error.recoverable).toBe(false);
    });

    it('should include original error when provided', () => {
      const originalError = new Error('Original error');
      const error = createAudioContextError('initialization_failed', originalError);

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('detectAudioErrorType()', () => {
    it('should detect autoplay_blocked from error message containing "autoplay"', () => {
      const result = detectAudioErrorType(new Error('The AudioContext was not allowed to start due to autoplay restrictions'));
      expect(result).toBe('autoplay_blocked');
    });

    it('should detect autoplay_blocked from message containing "user gesture"', () => {
      const result = detectAudioErrorType('Requires user gesture to start');
      expect(result).toBe('autoplay_blocked');
    });

    it('should detect autoplay_blocked from "play() failed"', () => {
      const result = detectAudioErrorType(new Error('play() failed because the user did not interact'));
      expect(result).toBe('autoplay_blocked');
    });

    it('should detect context_suspended from message', () => {
      const result = detectAudioErrorType('AudioContext is suspended');
      expect(result).toBe('context_suspended');
    });

    it('should detect context_closed from message', () => {
      const result = detectAudioErrorType(new Error('AudioContext has been closed'));
      expect(result).toBe('context_closed');
    });

    it('should detect not_supported from "not supported"', () => {
      const result = detectAudioErrorType('AudioContext is not supported');
      expect(result).toBe('not_supported');
    });

    it('should detect initialization_failed from "failed to construct"', () => {
      const result = detectAudioErrorType(new Error('Failed to construct AudioContext'));
      expect(result).toBe('initialization_failed');
    });

    it('should return unknown for unrecognized errors', () => {
      const result = detectAudioErrorType('Something went wrong');
      expect(result).toBe('unknown');
    });
  });

  describe('isWebAudioSupported()', () => {
    const originalWindow = (global as Record<string, unknown>).window;

    afterEach(() => {
      // Restore window
      (global as Record<string, unknown>).window = originalWindow;
    });

    it('should return false when window is undefined', () => {
      delete (global as Record<string, unknown>).window;
      expect(isWebAudioSupported()).toBe(false);
      (global as Record<string, unknown>).window = originalWindow;
    });

    it('should return true when AudioContext is available', () => {
      (global as Record<string, unknown>).window = { AudioContext: class MockAudioContext {} };
      expect(isWebAudioSupported()).toBe(true);
    });

    it('should return true when webkitAudioContext is available', () => {
      (global as Record<string, unknown>).window = { webkitAudioContext: class MockWebkitAudioContext {} };
      expect(isWebAudioSupported()).toBe(true);
    });

    it('should return false when neither AudioContext nor webkitAudioContext is available', () => {
      (global as Record<string, unknown>).window = {};
      expect(isWebAudioSupported()).toBe(false);
    });
  });

  describe('getAudioContextState()', () => {
    it('should return "unavailable" when context is null', () => {
      expect(getAudioContextState(null)).toBe('unavailable');
    });

    it('should return "running" when context state is running', () => {
      const mockContext = { state: 'running' } as AudioContext;
      expect(getAudioContextState(mockContext)).toBe('running');
    });

    it('should return "suspended" when context state is suspended', () => {
      const mockContext = { state: 'suspended' } as AudioContext;
      expect(getAudioContextState(mockContext)).toBe('suspended');
    });

    it('should return "closed" when context state is closed', () => {
      const mockContext = { state: 'closed' } as AudioContext;
      expect(getAudioContextState(mockContext)).toBe('closed');
    });
  });

  describe('AUDIO_ERROR_CODES', () => {
    it('should have all expected error codes', () => {
      expect(AUDIO_ERROR_CODES.INITIALIZATION_FAILED).toBe('AUDIO_INIT_FAILED');
      expect(AUDIO_ERROR_CODES.AUTOPLAY_BLOCKED).toBe('AUDIO_AUTOPLAY_BLOCKED');
      expect(AUDIO_ERROR_CODES.CONTEXT_SUSPENDED).toBe('AUDIO_CONTEXT_SUSPENDED');
      expect(AUDIO_ERROR_CODES.CONTEXT_CLOSED).toBe('AUDIO_CONTEXT_CLOSED');
      expect(AUDIO_ERROR_CODES.NOT_SUPPORTED).toBe('AUDIO_NOT_SUPPORTED');
      expect(AUDIO_ERROR_CODES.PLAYBACK_FAILED).toBe('AUDIO_PLAYBACK_FAILED');
      expect(AUDIO_ERROR_CODES.UNKNOWN).toBe('AUDIO_UNKNOWN_ERROR');
    });
  });
});
