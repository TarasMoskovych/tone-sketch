'use client';

import { useState, useCallback } from 'react';
import type { Note, SynthesizerConfig, Melody } from '@/types';

/**
 * Data structure for creating or updating a melody.
 * Contains all the editable melody properties.
 */
export interface MelodyData {
  /** Melody title (1-200 characters) */
  title: string;
  /** Array of notes in the melody */
  notes: Note[];
  /** Tempo in BPM */
  tempo: number;
  /**
   * Synthesizer configuration including:
   * - oscillatorType, volume, envelope, filter
   * - effects (reverb, delay, chorus, flanger) - Requirement 36.7
   * - presetName (if a preset is selected) - Requirements 37.8, 37.9
   */
  synth: SynthesizerConfig;
  /** Owner ID (required for create, update, and delete operations) */
  ownerId: string;
}

/**
 * Return type for the useMelodyPersistence hook.
 * Provides API interaction methods and state.
 */
export interface UseMelodyPersistenceReturn {
  /** True while a save operation is in progress */
  isSaving: boolean;
  /** True while a load operation is in progress */
  isLoading: boolean;
  /** Error message from the last failed operation, or null if no error */
  error: string | null;
  /** Clear the current error state */
  clearError: () => void;
  /**
   * Create a new melody.
   * @param melody - The melody data to save
   * @returns The ID of the created melody
   * @throws Error if the save operation fails
   */
  saveMelody: (melody: MelodyData) => Promise<string>;
  /**
   * Update an existing melody.
   * @param id - The melody ID to update
   * @param melody - The updated melody data
   * @throws Error if the update operation fails
   */
  updateMelody: (id: string, melody: MelodyData) => Promise<void>;
  /**
   * Delete a melody.
   * @param id - The melody ID to delete
   * @param ownerId - The owner ID for authorization
   * @throws Error if the delete operation fails
   */
  deleteMelody: (id: string, ownerId: string) => Promise<void>;
  /**
   * Load a melody by ID.
   * @param id - The melody ID to load
   * @returns The loaded melody data
   * @throws Error if the load operation fails or melody not found
   */
  loadMelody: (id: string) => Promise<Melody>;
}

/**
 * API response structure for melody creation.
 */
interface CreateMelodyResponse {
  id: string;
}

/**
 * API response structure for melody retrieval/update.
 */
interface MelodyApiResponse {
  id: string;
  title: string;
  notes: Note[];
  tempo: number;
  synth: SynthesizerConfig;
  createdAt: string;
  ownerId: string;
}

/**
 * API error response structure.
 */
interface ApiErrorResponse {
  error: string;
  details?: Array<{ field: string; reason: string }>;
}

/**
 * Custom hook for melody persistence operations.
 *
 * Handles save/load/delete melody API logic with loading states
 * and error handling. The synth configuration includes effects and
 * preset name for full audio state persistence.
 *
 * @returns Object containing API methods and state
 *
 * @example
 * ```tsx
 * const { saveMelody, loadMelody, isSaving, error } = useMelodyPersistence();
 *
 * // Create a new melody with effects and preset
 * const id = await saveMelody({
 *   title: 'My Melody',
 *   notes: [],
 *   tempo: 120,
 *   synth: {
 *     oscillatorType: 'sine',
 *     volume: 0.8,
 *     envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 },
 *     filter: { enabled: false, type: 'lowpass', frequency: 1000 },
 *     effects: defaultEffects, // reverb, delay, chorus, flanger
 *     presetName: 'Electric Piano' // or null for custom
 *   },
 *   ownerId: 'owner-uuid'
 * });
 *
 * // Load a melody - effects and preset are automatically restored
 * const melody = await loadMelody(id);
 * console.log(melody.synth.effects); // Effects configuration
 * console.log(melody.synth.presetName); // Preset name or null
 * ```
 *
 * Requirements validated:
 * - 38.2: Custom hook for reusable stateful logic
 * - 38.4: Handles loading states and error messages
 * - 36.7: Effects are persisted as part of synth configuration
 * - 37.8, 37.9: Preset name is persisted as part of synth configuration
 */
export function useMelodyPersistence(): UseMelodyPersistenceReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clear the current error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Parse error response from API.
   */
  const parseErrorResponse = async (response: Response): Promise<string> => {
    try {
      const errorData: ApiErrorResponse = await response.json();
      if (errorData.details && errorData.details.length > 0) {
        // Format validation errors into a readable message
        return errorData.details.map((d) => `${d.field}: ${d.reason}`).join('; ');
      }
      return errorData.error || 'An unexpected error occurred';
    } catch {
      return 'An unexpected error occurred';
    }
  };

  /**
   * Create a new melody via POST /api/melodies.
   *
   * Validates: Requirements 18.1, 18.3, 18.5
   */
  const saveMelody = useCallback(async (melody: MelodyData): Promise<string> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/melodies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(melody),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data: CreateMelodyResponse = await response.json();
      return data.id;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save melody. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Update an existing melody via PUT /api/melodies/[id].
   *
   * Validates: Requirements 20.3, 20.6
   */
  const updateMelody = useCallback(async (id: string, melody: MelodyData): Promise<void> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/melodies/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(melody),
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update melody. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Delete a melody via DELETE /api/melodies/[id].
   *
   * Validates: Requirements 21.4, 21.7
   */
  const deleteMelody = useCallback(async (id: string, ownerId: string): Promise<void> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/melodies/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ownerId }),
      });

      // 204 No Content is success for DELETE
      if (!response.ok && response.status !== 204) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete melody. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Load a melody via GET /api/melodies/[id].
   *
   * Validates: Requirements 19.1, 19.5, 19.6
   */
  const loadMelody = useCallback(async (id: string): Promise<Melody> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/melodies/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        throw new Error('Melody not found');
      }

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }

      const data: MelodyApiResponse = await response.json();

      // Convert API response to Melody type (with Date instead of string)
      const melody: Melody = {
        id: data.id,
        title: data.title,
        notes: data.notes,
        tempo: data.tempo,
        synth: data.synth,
        createdAt: new Date(data.createdAt),
        ownerId: data.ownerId,
      };

      return melody;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load melody. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSaving,
    isLoading,
    error,
    clearError,
    saveMelody,
    updateMelody,
    deleteMelody,
    loadMelody,
  };
}
