import { useState, useCallback } from 'react';
import {
  parseMidiFile,
  MidiImportError,
  MAX_MIDI_FILE_SIZE,
  type MidiImportResult,
} from '../utils/midi-importer';
import {
  createMidiFile,
  exportMelodyToMidi,
  generateMidiFilename,
  MidiExportError,
  type ExportableMelody,
} from '../utils/midi-exporter';

/**
 * Return type for the useMidiImportExport hook.
 */
export interface UseMidiImportExportReturn {
  /** Whether an import operation is in progress */
  isImporting: boolean;
  /** Whether an export operation is in progress */
  isExporting: boolean;
  /** Error message from the last import/export operation, or null if successful */
  error: string | null;
  /** Parse a MIDI file and return notes and tempo */
  importMidi: (file: File) => Promise<MidiImportResult | null>;
  /** Export notes to a MIDI file blob */
  exportMidi: (melody: ExportableMelody) => Blob | null;
  /** Export notes and trigger a file download */
  downloadMidi: (melody: ExportableMelody) => void;
  /** Generate a sanitized filename for the MIDI export */
  getFilename: (title: string) => string;
  /** Validate file size before import (5MB max) */
  validateFileSize: (file: File) => boolean;
  /** Clear any current error state */
  clearError: () => void;
  /** Maximum allowed file size in bytes (5MB) */
  maxFileSize: number;
}

/**
 * Custom hook for handling MIDI file import and export operations.
 *
 * Provides a React-friendly interface for:
 * - Importing MIDI files (SMF Type 0 and Type 1) up to 5MB
 * - Exporting melodies to MIDI files (SMF Type 0)
 * - File size validation
 * - Error handling and loading states
 *
 * @returns Hook return object with import/export functions and state
 *
 * @example
 * ```tsx
 * const { importMidi, downloadMidi, isImporting, error } = useMidiImportExport();
 *
 * // Import a MIDI file
 * const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
 *   const file = e.target.files?.[0];
 *   if (file) {
 *     const result = await importMidi(file);
 *     if (result) {
 *       setNotes(result.notes);
 *       setTempo(result.tempo);
 *     }
 *   }
 * };
 *
 * // Export to MIDI
 * const handleExport = () => {
 *   downloadMidi({ title: 'My Melody', notes, tempo });
 * };
 * ```
 */
export function useMidiImportExport(): UseMidiImportExportReturn {
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates that a file is within the allowed size limit.
   * @param file - The file to validate
   * @returns true if file size is valid, false otherwise
   */
  const validateFileSize = useCallback((file: File): boolean => {
    return file.size <= MAX_MIDI_FILE_SIZE;
  }, []);

  /**
   * Parses a MIDI file and returns the notes and tempo.
   * Handles file size validation and error states.
   *
   * @param file - The MIDI file to import
   * @returns Promise resolving to MidiImportResult or null on error
   */
  const importMidi = useCallback(async (file: File): Promise<MidiImportResult | null> => {
    setError(null);
    setIsImporting(true);

    try {
      // Validate file size (5MB max)
      if (!validateFileSize(file)) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        throw new MidiImportError(
          `File exceeds maximum allowed size of 5MB. File size: ${fileSizeMB}MB`
        );
      }

      // Parse the MIDI file
      const result = await parseMidiFile(file);
      return result;
    } catch (err) {
      const message = err instanceof MidiImportError
        ? err.message
        : err instanceof Error
          ? `Failed to import MIDI file: ${err.message}`
          : 'Failed to import MIDI file: Unknown error';

      setError(message);
      return null;
    } finally {
      setIsImporting(false);
    }
  }, [validateFileSize]);

  /**
   * Exports melody data to a MIDI file blob.
   * Does not trigger download - use downloadMidi for that.
   *
   * @param melody - The melody data to export
   * @returns Blob containing the MIDI file, or null on error
   */
  const exportMidi = useCallback((melody: ExportableMelody): Blob | null => {
    setError(null);
    setIsExporting(true);

    try {
      const blob = createMidiFile(melody);
      return blob;
    } catch (err) {
      const message = err instanceof MidiExportError
        ? err.message
        : err instanceof Error
          ? `Failed to export MIDI file: ${err.message}`
          : 'Failed to export MIDI file: Unknown error';

      setError(message);
      return null;
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Exports melody data and triggers a file download.
   *
   * @param melody - The melody data to export
   */
  const downloadMidi = useCallback((melody: ExportableMelody): void => {
    setError(null);
    setIsExporting(true);

    try {
      exportMelodyToMidi(melody);
    } catch (err) {
      const message = err instanceof MidiExportError
        ? err.message
        : err instanceof Error
          ? `Failed to download MIDI file: ${err.message}`
          : 'Failed to download MIDI file: Unknown error';

      setError(message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Generates a sanitized filename for MIDI export.
   *
   * @param title - The melody title
   * @returns Filename with .mid extension
   */
  const getFilename = useCallback((title: string): string => {
    return generateMidiFilename(title);
  }, []);

  /**
   * Clears any current error state.
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    isImporting,
    isExporting,
    error,
    importMidi,
    exportMidi,
    downloadMidi,
    getFilename,
    validateFileSize,
    clearError,
    maxFileSize: MAX_MIDI_FILE_SIZE,
  };
}

export default useMidiImportExport;
