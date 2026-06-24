'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { PlayIcon, PauseIcon, StopIcon, LoopIcon, ExpandIcon } from './icons';

/**
 * Format playhead position as time string (MM:SS:ms) like FL Studio
 * @param position - Position in beats
 * @param tempo - Tempo in BPM (beats per minute)
 * @returns Formatted time string
 */
function formatTime(position: number, tempo: number): string {
  // Convert beats to seconds: (position beats) / (tempo beats/minute) * 60 seconds/minute
  const totalSeconds = (position / tempo) * 60;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 1000);

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Format playhead position as bars:beats:ticks like FL Studio
 * @param position - Position in beats
 * @param beatsPerBar - Time signature (default 4/4)
 * @returns Formatted position string
 */
function formatBarsBeats(position: number, beatsPerBar: number = 4): string {
  const bars = Math.floor(position / beatsPerBar) + 1; // Bars start at 1
  const beats = Math.floor(position % beatsPerBar) + 1; // Beats start at 1
  const ticks = Math.floor((position % 1) * 96); // 96 ticks per beat (standard MIDI resolution)

  return `${bars}:${beats}:${ticks.toString().padStart(2, '0')}`;
}

/**
 * Props for the TransportControls component
 *
 * Implements the interface defined in the design document for playback control buttons.
 * Requirements: 39.2, 39.3, 39.5, 41.1, 41.6
 */
export interface TransportControlsProps {
  /** Whether playback is currently active */
  isPlaying: boolean;
  /** Whether playback is paused (maintains position) */
  isPaused: boolean;
  /** Whether loop mode is enabled */
  isLooping: boolean;
  /** Current playhead position in beats */
  playheadPosition?: number;
  /** Tempo in BPM for time calculation */
  tempo?: number;
  /** Callback when play button is clicked
   * Requirement 13.1: Play button starts playback from current position
   * Requirement 13.3: Resume playback from paused position
   */
  onPlay: () => void;
  /** Callback when pause button is clicked
   * Requirement 13.2: Pause stops notes and maintains position
   */
  onPause: () => void;
  /** Callback when stop button is clicked
   * Requirement 14.1: Stop silences all notes within 50ms
   * Requirement 14.2: Stop resets playhead to position zero
   */
  onStop: () => void;
  /** Callback when loop toggle is clicked
   * Requirement 15.1: Loop toggle control
   */
  onLoopToggle: () => void;
  /** Whether fullscreen mode is enabled
   * Requirement 41.1: Fullscreen toggle button
   */
  isFullscreen?: boolean;
  /** Callback when fullscreen toggle is clicked
   * Requirement 41.1, 41.2, 41.5: Fullscreen toggle
   */
  onFullscreenToggle?: () => void;
  /** Whether controls are disabled (e.g., read-only mode) */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Configuration for button styles
 */
const BUTTON_STYLES = {
  base: 'flex items-center justify-center rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900',
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200 focus:ring-gray-500',
  active: 'bg-indigo-500 text-white ring-2 ring-indigo-400',
  disabled: 'opacity-50 cursor-not-allowed',
  size: {
    default: 'w-10 h-10',
    icon: 'w-5 h-5',
  },
};

/**
 * TransportControls component
 *
 * Provides playback control buttons (play, pause, stop), loop toggle,
 * and fullscreen toggle for the synthesizer engine.
 *
 * Visual States:
 * - Stopped: Play button active, pause/stop inactive
 * - Playing: Pause and stop buttons active, play shows as "playing" indicator
 * - Paused: Play button active (resume), pause shows as "paused", stop active
 * - Looping: Loop button highlighted when enabled
 * - Fullscreen: Expand/collapse icon toggles between modes
 *
 * Requirements:
 * - 13.1: Play button starts playback from current position
 * - 13.2: Pause button stops notes and maintains position
 * - 13.3: Resume playback from paused position
 * - 14.1: Stop silences all notes within 50ms
 * - 14.2: Stop resets playhead to position zero
 * - 15.1: Loop toggle control
 * - 41.1: Fullscreen toggle button in transport controls
 * - 41.4: Escape key exits fullscreen mode
 * - 41.5: Click exit button to exit fullscreen
 * - 41.6: Expand icon when not fullscreen, collapse icon when fullscreen
 */
export function TransportControls({
  isPlaying,
  isPaused,
  isLooping,
  playheadPosition = 0,
  tempo = 120,
  onPlay,
  onPause,
  onStop,
  onLoopToggle,
  isFullscreen = false,
  onFullscreenToggle,
  disabled = false,
  className = '',
}: TransportControlsProps) {
  // Memoize formatted time strings to avoid recalculation on every render
  const timeDisplay = useMemo(
    () => formatTime(playheadPosition, tempo),
    [playheadPosition, tempo]
  );
  const barsBeatsDisplay = useMemo(
    () => formatBarsBeats(playheadPosition),
    [playheadPosition]
  );
  /**
   * Handle Escape key to exit fullscreen
   * Requirement 41.4: Escape key exits fullscreen mode
   */
  useEffect(() => {
    if (!isFullscreen || !onFullscreenToggle) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onFullscreenToggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onFullscreenToggle]);
  /**
   * Handle play button click
   * Requirement 13.1: Start playback from current position
   * Requirement 13.3: Resume from paused position
   */
  const handlePlay = useCallback(() => {
    if (disabled) return;
    onPlay();
  }, [disabled, onPlay]);

  /**
   * Handle pause button click
   * Requirement 13.2: Pause stops notes and maintains position
   */
  const handlePause = useCallback(() => {
    if (disabled) return;
    onPause();
  }, [disabled, onPause]);

  /**
   * Handle stop button click
   * Requirement 14.1: Stop silences all notes within 50ms
   * Requirement 14.2: Stop resets playhead to position zero
   */
  const handleStop = useCallback(() => {
    if (disabled) return;
    onStop();
  }, [disabled, onStop]);

  /**
   * Handle loop toggle click
   * Requirement 15.1: Loop toggle control
   */
  const handleLoopToggle = useCallback(() => {
    if (disabled) return;
    onLoopToggle();
  }, [disabled, onLoopToggle]);

  /**
   * Handle fullscreen toggle click
   * Requirement 41.1, 41.5: Fullscreen toggle
   */
  const handleFullscreenToggle = useCallback(() => {
    if (disabled || !onFullscreenToggle) return;
    onFullscreenToggle();
  }, [disabled, onFullscreenToggle]);

  // Determine button states for visual feedback
  const isStopped = !isPlaying && !isPaused;

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="toolbar"
      aria-label="Playback controls"
    >
      {/* Play/Pause Button - Combined toggle */}
      {isPlaying ? (
        <button
          type="button"
          onClick={handlePause}
          disabled={disabled}
          className={`
            ${BUTTON_STYLES.base}
            ${BUTTON_STYLES.size.default}
            ${BUTTON_STYLES.primary}
            ${disabled ? BUTTON_STYLES.disabled : ''}
          `}
          aria-label="Pause playback"
          title="Pause (maintains position)"
        >
          <PauseIcon className={BUTTON_STYLES.size.icon} />
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePlay}
          disabled={disabled}
          className={`
            ${BUTTON_STYLES.base}
            ${BUTTON_STYLES.size.default}
            ${isPaused ? BUTTON_STYLES.active : BUTTON_STYLES.primary}
            ${disabled ? BUTTON_STYLES.disabled : ''}
          `}
          aria-label={isPaused ? 'Resume playback' : 'Start playback'}
          title={isPaused ? 'Resume from paused position' : 'Start playback'}
        >
          <PlayIcon className={BUTTON_STYLES.size.icon} />
        </button>
      )}

      {/* Stop Button */}
      <button
        type="button"
        onClick={handleStop}
        disabled={disabled}
        className={`
          ${BUTTON_STYLES.base}
          ${BUTTON_STYLES.size.default}
          ${isStopped ? BUTTON_STYLES.secondary : BUTTON_STYLES.primary}
          ${disabled ? BUTTON_STYLES.disabled : ''}
        `}
        aria-label="Stop playback"
        title="Stop and reset to beginning"
      >
        <StopIcon className={BUTTON_STYLES.size.icon} />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-600 mx-1" aria-hidden="true" />

      {/* Loop Toggle Button */}
      <button
        type="button"
        onClick={handleLoopToggle}
        disabled={disabled}
        className={`
          ${BUTTON_STYLES.base}
          ${BUTTON_STYLES.size.default}
          ${isLooping ? BUTTON_STYLES.active : BUTTON_STYLES.secondary}
          ${disabled ? BUTTON_STYLES.disabled : ''}
        `}
        aria-label={isLooping ? 'Disable loop' : 'Enable loop'}
        aria-pressed={isLooping}
        title={isLooping ? 'Loop enabled - click to disable' : 'Click to enable loop'}
      >
        <LoopIcon className={BUTTON_STYLES.size.icon} />
      </button>

      {/* Fullscreen Toggle Button - Requirement 41.1, 41.6 */}
      {onFullscreenToggle && (
        <>
          {/* Divider */}
          <div className="w-px h-6 bg-gray-600 mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={handleFullscreenToggle}
            disabled={disabled}
            className={`
              ${BUTTON_STYLES.base}
              ${BUTTON_STYLES.size.default}
              ${isFullscreen ? BUTTON_STYLES.active : BUTTON_STYLES.secondary}
              ${disabled ? BUTTON_STYLES.disabled : ''}
              transition-transform duration-200
            `}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={isFullscreen}
            title={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
          >
            <ExpandIcon
              expanded={isFullscreen}
              className={`${BUTTON_STYLES.size.icon} transition-transform duration-200`}
            />
          </button>
        </>
      )}

      {/* Divider */}
      <div className="w-px h-6 bg-gray-600 mx-1" aria-hidden="true" />

      {/* Timer Display - FL Studio style */}
      <div
        className="flex flex-col items-end font-mono text-sm select-none min-w-[90px]"
        aria-label={`Playback position: ${barsBeatsDisplay} bars beats, ${timeDisplay}`}
        title="Current playback position"
      >
        {/* Bars:Beats:Ticks display */}
        <span className="text-white font-semibold tracking-wider">
          {barsBeatsDisplay}
        </span>
        {/* Time display (MM:SS:ms) */}
        <span className="text-gray-400 text-xs tracking-wide">
          {timeDisplay}
        </span>
      </div>

      {/* Visual state indicator for screen readers */}
      <span className="sr-only" aria-live="polite">
        {isPlaying
          ? 'Playing'
          : isPaused
          ? 'Paused'
          : 'Stopped'}
        {isLooping ? ', loop enabled' : ''}
        {isFullscreen ? ', fullscreen mode' : ''}
      </span>
    </div>
  );
}

export default TransportControls;
