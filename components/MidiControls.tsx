'use client';

import { useRef, useCallback } from 'react';
import { useMidiImportExport } from '@/hooks';
import type { Note } from '@/types';

/**
 * Props for the MidiControls component.
 */
export interface MidiControlsProps {
  /** Current notes array for export */
  notes: Note[];
  /** Melody title for export filename */
  title: string;
  /** Current tempo for export */
  tempo: number;
  /** Callback when notes are imported */
  onImport: (notes: Note[], tempo?: number) => void;
  /** Whether import is allowed (e.g., owner-only on edit page) */
  allowImport?: boolean;
  /** Optional className for the container */
  className?: string;
}

/**
 * MidiControls component - shared MIDI import/export UI.
 *
 * Provides Import MIDI and Export MIDI buttons with the useMidiImportExport hook.
 * Used in both the create page and melody edit page.
 *
 * Features:
 * - Import MIDI button (opens file picker)
 * - Export MIDI button (downloads .mid file)
 * - Hidden file input for import
 * - Error display via hook state
 *
 * @example
 * ```tsx
 * <MidiControls
 *   notes={notes}
 *   title={melodyTitle}
 *   tempo={tempo}
 *   onImport={(importedNotes, importedTempo) => {
 *     loadNotes(importedNotes);
 *     if (importedTempo) setTempo(importedTempo);
 *   }}
 *   allowImport={isOwner}
 * />
 * ```
 */
export function MidiControls({
  notes,
  title,
  tempo,
  onImport,
  allowImport = true,
  className = '',
}: MidiControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isImporting,
    isExporting,
    error,
    importMidi,
    downloadMidi,
    clearError,
  } = useMidiImportExport();

  /**
   * Open file picker for MIDI import
   */
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handle MIDI file selection and import
   */
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      clearError();
      const result = await importMidi(file);

      if (result) {
        onImport(result.notes, result.tempo);
      }

      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [importMidi, onImport, clearError]
  );

  /**
   * Handle MIDI export/download
   */
  const handleExport = useCallback(() => {
    downloadMidi({
      title: title || 'Untitled',
      notes,
      tempo,
    });
  }, [downloadMidi, title, notes, tempo]);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Hidden file input for MIDI import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Error display */}
      {error && (
        <span className="text-red-400 text-sm truncate max-w-xs">{error}</span>
      )}

      {/* Export MIDI button - always available */}
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting || notes.length === 0}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 font-medium rounded-lg transition-colors"
      >
        {isExporting ? 'Exporting...' : 'Export MIDI'}
      </button>

      {/* Import MIDI button - conditionally shown */}
      {allowImport && (
        <button
          type="button"
          onClick={handleImportClick}
          disabled={isImporting}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 font-medium rounded-lg transition-colors"
        >
          {isImporting ? 'Importing...' : 'Import MIDI'}
        </button>
      )}
    </div>
  );
}

export default MidiControls;
