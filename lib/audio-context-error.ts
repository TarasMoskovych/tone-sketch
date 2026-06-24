/**
 * Audio Context Error Handling Module
 *
 * Provides error types and utilities for handling Web Audio API / Tone.js
 * audio context errors including:
 * - Audio context initialization failures
 * - Browser autoplay policies (requiring user gesture to start audio)
 * - Audio context suspension/resumption
 * - Graceful degradation when audio is unavailable
 *
 * Requirements: 29.4 - Display error message within 500ms when audio subsystem is unavailable
 * Design: Error Handling - Audio Error Handling section
 */

/**
 * Types of audio context errors that can occur
 */
export type AudioContextErrorType =
  | 'initialization_failed'
  | 'autoplay_blocked'
  | 'context_suspended'
  | 'context_closed'
  | 'not_supported'
  | 'playback_failed'
  | 'unknown';

/**
 * Structured audio context error with user-friendly messaging
 */
export interface AudioContextError {
  /** The type of error that occurred */
  type: AudioContextErrorType;
  /** User-friendly error message for display */
  message: string;
  /** Whether the error can be recovered by user action (e.g., clicking to resume) */
  recoverable: boolean;
  /** Suggested action for the user to resolve the error */
  suggestedAction?: string;
  /** Original error object if available */
  originalError?: Error;
}

/**
 * Audio context state information
 */
export type AudioContextState = 'running' | 'suspended' | 'closed' | 'unavailable';

/**
 * Callback type for audio error events
 */
export type AudioErrorCallback = (error: AudioContextError) => void;

/**
 * Callback type for audio state change events
 */
export type AudioStateChangeCallback = (state: AudioContextState) => void;

/**
 * Creates a user-friendly AudioContextError from various error conditions
 *
 * @param type - The type of audio error
 * @param originalError - The original error object if available
 * @returns A structured AudioContextError with user-friendly messaging
 */
export function createAudioContextError(
  type: AudioContextErrorType,
  originalError?: Error
): AudioContextError {
  switch (type) {
    case 'initialization_failed':
      return {
        type,
        message: 'Could not initialize audio. Please check your audio device settings.',
        recoverable: false,
        suggestedAction: 'Try refreshing the page or checking your system audio settings.',
        originalError,
      };

    case 'autoplay_blocked':
      return {
        type,
        message: 'Audio playback requires interaction. Click to enable sound.',
        recoverable: true,
        suggestedAction: 'Click anywhere on the page or press the play button to enable audio.',
        originalError,
      };

    case 'context_suspended':
      return {
        type,
        message: 'Audio has been paused by the browser.',
        recoverable: true,
        suggestedAction: 'Click to resume audio playback.',
        originalError,
      };

    case 'context_closed':
      return {
        type,
        message: 'Audio context has been closed.',
        recoverable: false,
        suggestedAction: 'Please refresh the page to restart audio.',
        originalError,
      };

    case 'not_supported':
      return {
        type,
        message: 'Audio playback is not supported in this browser.',
        recoverable: false,
        suggestedAction: 'Please try using a modern browser like Chrome, Firefox, or Safari.',
        originalError,
      };

    case 'playback_failed':
      return {
        type,
        message: 'Failed to play audio. Please try again.',
        recoverable: true,
        suggestedAction: 'Click the play button to try again.',
        originalError,
      };

    case 'unknown':
    default:
      return {
        type: 'unknown',
        message: 'An unexpected audio error occurred.',
        recoverable: false,
        suggestedAction: 'Please refresh the page and try again.',
        originalError,
      };
  }
}

/**
 * Detects the type of audio error from an Error object or error message
 *
 * @param error - The error to analyze
 * @returns The detected AudioContextErrorType
 */
export function detectAudioErrorType(error: Error | string): AudioContextErrorType {
  const message = typeof error === 'string' ? error : error.message;
  const lowerMessage = message.toLowerCase();

  // Check for autoplay policy errors
  if (
    lowerMessage.includes('autoplay') ||
    lowerMessage.includes('user gesture') ||
    lowerMessage.includes('user interaction') ||
    lowerMessage.includes('play() failed') ||
    lowerMessage.includes('notallowederror')
  ) {
    return 'autoplay_blocked';
  }

  // Check for suspended context
  if (
    lowerMessage.includes('suspended') ||
    lowerMessage.includes('suspend')
  ) {
    return 'context_suspended';
  }

  // Check for closed context
  if (lowerMessage.includes('closed')) {
    return 'context_closed';
  }

  // Check for not supported
  if (
    lowerMessage.includes('not supported') ||
    lowerMessage.includes('audiocontext is not defined') ||
    lowerMessage.includes('webkitaudiocontext is not defined')
  ) {
    return 'not_supported';
  }

  // Check for initialization failures
  if (
    lowerMessage.includes('failed to construct') ||
    lowerMessage.includes('cannot create') ||
    lowerMessage.includes('initialization')
  ) {
    return 'initialization_failed';
  }

  return 'unknown';
}

/**
 * Checks if the Web Audio API is available in the current environment
 *
 * @returns true if Web Audio API is available, false otherwise
 */
export function isWebAudioSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!(
    window.AudioContext ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).webkitAudioContext
  );
}

/**
 * Gets the current audio context state, handling cases where audio is not available
 *
 * @param context - The AudioContext to check, or null if unavailable
 * @returns The current state of the audio context
 */
export function getAudioContextState(context: AudioContext | null): AudioContextState {
  if (!context) {
    return 'unavailable';
  }

  switch (context.state) {
    case 'running':
      return 'running';
    case 'suspended':
      return 'suspended';
    case 'closed':
      return 'closed';
    default:
      return 'unavailable';
  }
}

/**
 * Error codes that can be used for programmatic handling
 */
export const AUDIO_ERROR_CODES = {
  INITIALIZATION_FAILED: 'AUDIO_INIT_FAILED',
  AUTOPLAY_BLOCKED: 'AUDIO_AUTOPLAY_BLOCKED',
  CONTEXT_SUSPENDED: 'AUDIO_CONTEXT_SUSPENDED',
  CONTEXT_CLOSED: 'AUDIO_CONTEXT_CLOSED',
  NOT_SUPPORTED: 'AUDIO_NOT_SUPPORTED',
  PLAYBACK_FAILED: 'AUDIO_PLAYBACK_FAILED',
  UNKNOWN: 'AUDIO_UNKNOWN_ERROR',
} as const;
