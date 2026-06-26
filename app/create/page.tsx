'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MelodyEditor,
  MidiControls,
  ErrorBoundary,
} from '@/components';
import {
  useMelodyPersistence,
  useOwnership,
} from '@/hooks';
import type { Note } from '@/types';
import type { EditorState, LoadNotesFn } from '@/components/MelodyEditor';

/**
 * CreatePage component
 *
 * Uses the shared MelodyEditor component for all editor functionality.
 * Keeps save dialog, persistence, and ownership logic at the route level.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2
 */
export default function CreatePage() {
  const router = useRouter();

  // ===== Persistence & Ownership =====
  const { isSaving, saveMelody, error: persistenceError, clearError } = useMelodyPersistence();
  const { getOwnerId } = useOwnership();

  // ===== Editor State (tracked via onStateChange) =====
  const editorStateRef = useRef<EditorState>({
    notes: [],
    synthConfig: {} as EditorState['synthConfig'],
    tempo: 120,
  });

  // State mirrors for values used in render (MidiControls props)
  const [currentNotes, setCurrentNotes] = useState<Note[]>([]);
  const [currentTempo, setCurrentTempo] = useState(120);

  // ===== MIDI Import - loadNotes function from MelodyEditor =====
  const loadNotesRef = useRef<LoadNotesFn | null>(null);

  // ===== Save Dialog State =====
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [melodyTitle, setMelodyTitle] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // ===== Callbacks =====

  /** Track editor state changes for save dialog */
  const handleStateChange = useCallback((state: EditorState) => {
    editorStateRef.current = state;
    setCurrentNotes(state.notes);
    setCurrentTempo(state.tempo);
  }, []);

  /** Store the loadNotes function reference from MelodyEditor */
  const handleMidiImportRef = useCallback((loadNotes: LoadNotesFn) => {
    loadNotesRef.current = loadNotes;
  }, []);

  /** Handle MIDI import from MidiControls */
  const handleMidiImport = useCallback((importedNotes: Note[], importedTempo?: number) => {
    loadNotesRef.current?.(importedNotes, importedTempo);
  }, []);

  /** Open save dialog */
  const handleSaveClick = useCallback(() => {
    setSaveError(null);
    clearError();
    setShowTitleDialog(true);
  }, [clearError]);

  /** Confirm save - validate title and persist */
  const handleSaveConfirm = useCallback(async () => {
    if (!melodyTitle.trim()) {
      setSaveError('Please enter a title for your melody');
      return;
    }

    if (melodyTitle.length > 200) {
      setSaveError('Title must be 200 characters or less');
      return;
    }

    setSaveError(null);

    try {
      const ownerId = getOwnerId();
      const { notes, tempo, synthConfig } = editorStateRef.current;
      const id = await saveMelody({
        title: melodyTitle.trim(),
        notes,
        tempo,
        synth: synthConfig,
        ownerId,
      });
      router.push(`/m/${id}`);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save melody. Please try again.'
      );
    }
  }, [melodyTitle, getOwnerId, saveMelody, router]);

  /** Cancel save dialog */
  const handleSaveCancel = useCallback(() => {
    setShowTitleDialog(false);
    setMelodyTitle('');
    setSaveError(null);
    clearError();
  }, [clearError]);

  const displayError = saveError || persistenceError;

  // ===== Header Slot =====
  const headerSlot = (
    <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <svg
            className="w-8 h-8 text-indigo-500"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <h1 className="text-xl font-semibold">Create Melody</h1>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {/* MIDI Import/Export */}
        <MidiControls
          notes={currentNotes}
          title={melodyTitle || 'Untitled'}
          tempo={currentTempo}
          onImport={handleMidiImport}
        />
        {/* Save button */}
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </header>
  );

  return (
    <ErrorBoundary
      errorTitle="Editor Error"
      errorMessage="Something went wrong while loading the melody editor. Please try again."
    >
      <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
        <MelodyEditor
          headerSlot={headerSlot}
          onStateChange={handleStateChange}
          onMidiImport={handleMidiImportRef}
        />

        {/* Save Dialog Modal */}
        {showTitleDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-semibold mb-4">Save Melody</h2>

              <div className="mb-4">
                <label htmlFor="melody-title" className="block text-sm font-medium text-gray-300 mb-2">
                  Melody Title
                </label>
                <input
                  type="text"
                  id="melody-title"
                  value={melodyTitle}
                  onChange={(e) => setMelodyTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Enter a title for your melody"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-400">
                  {melodyTitle.length}/200 characters
                </p>
              </div>

              {displayError && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
                  {displayError}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSaveCancel}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfirm}
                  disabled={isSaving || !melodyTitle.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Melody'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
