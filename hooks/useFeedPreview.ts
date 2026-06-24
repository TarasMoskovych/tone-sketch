'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SynthesizerEngine } from '@/lib/synthesizer';
import type { Note } from '@/types/note';
import type { SynthesizerConfig } from '@/types/synth';

/**
 * Full melody data response from GET /api/melodies/[id]
 */
interface GetMelodyResponse {
  id: string;
  title: string;
  notes: Note[];
  tempo: number;
  synth: SynthesizerConfig;
  createdAt: string;
  ownerId: string;
}

/**
 * Return type for the useFeedPreview hook
 *
 * Design document interface:
 * - previewingMelodyId: The ID of the melody currently being previewed
 * - isPreviewLoading: Whether melody data is being fetched
 * - previewError: Error message if fetch or playback fails
 * - playPreview: Start preview playback for a melody
 * - stopPreview: Stop current preview playback
 */
export interface UseFeedPreviewReturn {
  /** ID of the melody currently being previewed, or null if none */
  previewingMelodyId: string | null;
  /** Whether melody data is being fetched for preview */
  isPreviewLoading: boolean;
  /** Error message if fetch or playback fails, or null if no error */
  previewError: string | null;
  /** Start preview playback for a melody by ID */
  playPreview: (melodyId: string) => void;
  /** Stop current preview playback */
  stopPreview: () => void;
}

/**
 * useFeedPreview hook
 *
 * Manages preview playback for melodies in the feed.
 * When a preview is requested, it fetches the melody data and plays it.
 * When a different preview is requested, it stops the current one.
 *
 * Requirements:
 * - 23.1: Begin audio playback when play clicked with visual indicator
 * - 23.2: Stop current playback when different melody clicked
 * - 23.3: Fetch full melody data before playback
 * - 23.4: Display loading indicator while fetching
 * - 23.5: Display error if fetch fails
 * - 23.6: Display error if playback fails
 *
 * @returns UseFeedPreviewReturn - Preview state and control handlers
 */
export function useFeedPreview(): UseFeedPreviewReturn {
  // Preview playback state
  const [previewingMelodyId, setPreviewingMelodyId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // ID of melody currently being loaded (may differ from previewingMelodyId during load)
  const [loadingMelodyId, setLoadingMelodyId] = useState<string | null>(null);

  // Synthesizer engine reference for preview playback
  const synthRef = useRef<SynthesizerEngine | null>(null);

  // Track the current melody end time for playback completion detection
  const melodyEndTimeRef = useRef<number>(0);

  /**
   * Cleanup synthesizer on unmount
   */
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
    };
  }, []);

  /**
   * Handle playhead updates to detect when playback completes
   */
  const handlePlayheadUpdate = useCallback((position: number) => {
    // If playhead reaches or exceeds the melody end, stop the visual indicator
    if (position >= melodyEndTimeRef.current) {
      setPreviewingMelodyId(null);
    }
  }, []);

  /**
   * Stop current preview playback
   * Requirement 23.2: Stop current playback when starting another
   */
  const stopPreview = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.stop();
      // Remove playhead callback
      synthRef.current.offPlayheadUpdate(handlePlayheadUpdate);
    }
    setPreviewingMelodyId(null);
    setPreviewError(null);
    setLoadingMelodyId(null);
    setIsPreviewLoading(false);
  }, [handlePlayheadUpdate]);

  /**
   * Start preview playback for a melody
   *
   * Requirements:
   * - 23.1: Begin audio playback when play clicked
   * - 23.2: Stop current playback when different melody clicked
   * - 23.3: Fetch full melody data before playback
   * - 23.4: Display loading indicator while fetching
   * - 23.5: Display error if fetch fails
   * - 23.6: Display error if playback fails
   *
   * @param melodyId - ID of the melody to preview
   */
  const playPreview = useCallback(async (melodyId: string) => {
    // Clear any previous preview errors
    setPreviewError(null);

    // Requirement 23.2: Stop current playback if different melody
    if (previewingMelodyId && previewingMelodyId !== melodyId) {
      stopPreview();
    }

    // If same melody is already playing, treat as stop action
    if (previewingMelodyId === melodyId) {
      stopPreview();
      return;
    }

    // Requirement 23.4: Set loading state
    setIsPreviewLoading(true);
    setLoadingMelodyId(melodyId);

    try {
      // Requirement 23.3: Fetch full melody data before playback
      const response = await fetch(`/api/melodies/${melodyId}`);

      if (!response.ok) {
        // Requirement 23.5: Handle fetch failure
        throw new Error('Failed to load melody preview');
      }

      const melodyData: GetMelodyResponse = await response.json();

      // Check if the melody has notes to play
      if (!melodyData.notes || melodyData.notes.length === 0) {
        setIsPreviewLoading(false);
        setLoadingMelodyId(null);
        setPreviewError('This melody has no notes to play');
        return;
      }

      // Initialize or get synthesizer
      if (!synthRef.current) {
        synthRef.current = new SynthesizerEngine();
      }

      // Configure synth with melody's saved settings
      synthRef.current.configure({
        oscillatorType: melodyData.synth.oscillatorType,
        volume: melodyData.synth.volume,
        envelope: melodyData.synth.envelope,
        filter: melodyData.synth.filter,
        effects: melodyData.synth.effects,
      });

      // Set the melody's tempo
      synthRef.current.setTempo(melodyData.tempo);

      // Calculate melody end time for handling playback completion
      melodyEndTimeRef.current = Math.max(
        ...melodyData.notes.map((n) => n.start + n.duration)
      );

      // Register callback to handle playback completion
      synthRef.current.onPlayheadUpdate(handlePlayheadUpdate);

      // Requirement 23.1: Begin audio playback with visual indicator
      try {
        // Play from the beginning, no loop for preview
        synthRef.current.play(melodyData.notes, 0, false);

        // Clear loading and set playing state
        setIsPreviewLoading(false);
        setLoadingMelodyId(null);
        setPreviewingMelodyId(melodyId);
      } catch (playbackErr) {
        // Requirement 23.6: Handle playback failure
        console.error('Playback error:', playbackErr);
        setIsPreviewLoading(false);
        setLoadingMelodyId(null);
        setPreviewError('Failed to start playback. Please check your audio settings.');
      }
    } catch (err) {
      // Requirement 23.5: Handle fetch failure
      console.error('Error fetching melody for preview:', err);
      setIsPreviewLoading(false);
      setLoadingMelodyId(null);
      setPreviewError('Preview unavailable');
    }
  }, [previewingMelodyId, stopPreview, handlePlayheadUpdate]);

  return {
    previewingMelodyId,
    isPreviewLoading: isPreviewLoading || loadingMelodyId !== null,
    previewError,
    playPreview,
    stopPreview,
  };
}

export default useFeedPreview;
