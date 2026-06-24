'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Note } from '@/types/note';

/**
 * Minimal interface for synthesizer engine playback functionality.
 * This allows the hook to work with the synthesizer without requiring
 * the full ISynthesizerEngine interface.
 */
interface PlaybackSynthEngine {
  play(notes: Note[], startPosition: number, loop: boolean): void;
  pause(): void;
  stop(): void;
  setPlayheadPosition(position: number): void;
  onPlayheadUpdate(callback: (position: number) => void): void;
  /** Optional: Remove playhead callback if supported */
  offPlayheadUpdate?(callback: (position: number) => void): void;
  /** Optional: Set loop mode if supported */
  setLoopEnabled?(enabled: boolean): void;
}

/**
 * Return type for the usePlayback hook.
 *
 * Provides playback state and transport control handlers for the synthesizer.
 *
 * Requirements:
 * - 38.2: Playback state managed through custom hook
 * - 38.4: Hook returns typed state values and handler functions
 */
export interface UsePlaybackReturn {
  /** Whether playback is currently active (playing audio) */
  isPlaying: boolean;
  /** Whether playback is paused (maintains position for resume) */
  isPaused: boolean;
  /** Whether loop mode is enabled */
  isLooping: boolean;
  /** Current playhead position in beats */
  playheadPosition: number;
  /**
   * Start or resume playback from current position.
   * Requirement 13.1: Play button starts playback from current position
   * Requirement 13.3: Resume playback from paused position
   */
  play: () => void;
  /**
   * Pause playback, maintaining current position.
   * Requirement 13.2: Pause stops notes and maintains position
   */
  pause: () => void;
  /**
   * Stop playback and reset to position zero.
   * Requirement 14.1: Stop silences all notes within 50ms
   * Requirement 14.2: Stop resets playhead to position zero
   */
  stop: () => void;
  /**
   * Toggle loop mode on/off.
   * Requirement 15.1: Loop toggle control
   */
  toggleLoop: () => void;
  /**
   * Set the playhead to a specific position.
   * Requirement 8.5: Timeline click positions playhead
   */
  setPlayheadPosition: (position: number) => void;
}

/**
 * Props for the usePlayback hook.
 */
export interface UsePlaybackProps {
  /** Reference to the synthesizer engine instance */
  synthEngineRef: React.RefObject<PlaybackSynthEngine | null>;
  /** Array of notes to play */
  notes: Note[];
  /**
   * Signal that the synth engine is ready. When this changes to true,
   * the hook will register the playhead update callback.
   * This solves the timing issue where the hook mounts before the engine is created.
   */
  engineReady?: boolean;
}

/**
 * Default values for playback state.
 * Matches the design document specifications.
 */
const DEFAULT_PLAYBACK_STATE = {
  isPlaying: false,
  isPaused: false,
  isLooping: false,
  playheadPosition: 0,
};

/**
 * Custom hook for managing playback state and transport controls.
 *
 * Encapsulates all playback-related state including isPlaying, isPaused,
 * isLooping, and playheadPosition. Provides handlers for play, pause,
 * stop, toggleLoop, and setPlayheadPosition operations.
 *
 * This hook integrates with the SynthesizerEngine to control audio playback
 * and synchronize visual playhead position with audio timing.
 *
 * Requirements:
 * - 38.2: Extract playback state into custom hook
 * - 38.4: Implement transport control handlers
 * - 13.1-13.6: Playback start and pause functionality
 * - 14.1-14.3: Stop functionality
 * - 15.1-15.4: Loop playback
 * - 8.5: Timeline click positions playhead
 *
 * @param props - Hook configuration including synth engine ref and notes
 * @returns Playback state and control handlers
 *
 * @example
 * ```tsx
 * const synthEngineRef = useRef<ISynthesizerEngine | null>(null);
 * const { isPlaying, play, pause, stop, toggleLoop, playheadPosition } = usePlayback({
 *   synthEngineRef,
 *   notes,
 * });
 * ```
 */
export function usePlayback({
  synthEngineRef,
  notes,
  engineReady = false,
}: UsePlaybackProps): UsePlaybackReturn {
  // Playback state with explicit boolean/number types
  const [isPlaying, setIsPlaying] = useState<boolean>(DEFAULT_PLAYBACK_STATE.isPlaying);
  const [isPaused, setIsPaused] = useState<boolean>(DEFAULT_PLAYBACK_STATE.isPaused);
  const [isLooping, setIsLooping] = useState<boolean>(DEFAULT_PLAYBACK_STATE.isLooping);
  const [playheadPosition, setPlayheadPositionState] = useState<number>(
    DEFAULT_PLAYBACK_STATE.playheadPosition
  );

  // Track the current looping state for use in callbacks
  const isLoopingRef = useRef(isLooping);
  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  // Track the current playhead position for use in play callback
  const playheadPositionRef = useRef(playheadPosition);
  useEffect(() => {
    playheadPositionRef.current = playheadPosition;
  }, [playheadPosition]);

  // Register playhead update callback when synth engine is ready
  // The engineReady prop triggers this effect when the engine is created
  useEffect(() => {
    const engine = synthEngineRef.current;
    if (!engine || !engineReady) return;

    const handlePlayheadUpdate = (position: number) => {
      setPlayheadPositionState(position);
    };

    engine.onPlayheadUpdate(handlePlayheadUpdate);

    return () => {
      engine.offPlayheadUpdate?.(handlePlayheadUpdate);
    };
  }, [synthEngineRef, engineReady]);

  /**
   * Start or resume playback from current position.
   *
   * Requirement 13.1: Play button starts playback from current position
   * Requirement 13.3: Resume playback from paused position
   * Requirement 13.4: If playhead past last note, reset to zero
   * Requirement 13.5: Empty melody stays stopped
   */
  const play = useCallback(() => {
    const engine = synthEngineRef.current;
    if (!engine) return;

    engine.play(notes, playheadPositionRef.current, isLoopingRef.current);
    setIsPlaying(true);
    setIsPaused(false);
  }, [synthEngineRef, notes]);

  /**
   * Pause playback, maintaining current position.
   *
   * Requirement 13.2: Pause stops notes and maintains position
   */
  const pause = useCallback(() => {
    const engine = synthEngineRef.current;
    if (!engine) return;

    engine.pause();
    setIsPlaying(false);
    setIsPaused(true);
  }, [synthEngineRef]);

  /**
   * Stop playback and reset to position zero.
   *
   * Requirement 14.1: Stop silences all notes within 50ms
   * Requirement 14.2: Stop resets playhead to position zero
   * Requirement 14.3: Stop while not playing resets without error
   */
  const stop = useCallback(() => {
    const engine = synthEngineRef.current;
    if (!engine) return;

    engine.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setPlayheadPositionState(0);
  }, [synthEngineRef]);

  /**
   * Toggle loop mode on/off.
   *
   * Requirement 15.1: Loop toggle control
   * Requirement 15.2: When enabled, restart from zero at end
   * Requirement 15.3: When disabled, stop at end
   */
  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const newValue = !prev;
      // Update synth engine if it supports setLoopEnabled
      synthEngineRef.current?.setLoopEnabled?.(newValue);
      return newValue;
    });
  }, [synthEngineRef]);

  /**
   * Set the playhead to a specific position.
   *
   * Requirement 8.5: Timeline click positions playhead
   *
   * @param position - Position in beats to set the playhead to
   */
  const setPlayheadPosition = useCallback(
    (position: number) => {
      setPlayheadPositionState(position);
      synthEngineRef.current?.setPlayheadPosition(position);
    },
    [synthEngineRef]
  );

  return {
    isPlaying,
    isPaused,
    isLooping,
    playheadPosition,
    play,
    pause,
    stop,
    toggleLoop,
    setPlayheadPosition,
  };
}

export default usePlayback;
