'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MelodyEditor,
  MidiControls,
  ErrorBoundary,
} from '@/components';
import {
  useMelodyPersistence,
  useOwnership,
} from '@/hooks';
import type { Note, SynthesizerConfig } from '@/types';
import type { EditorState, LoadNotesFn } from '@/components/MelodyEditor';

interface EditMelodyClientProps {
  melody: {
    id: string;
    title: string;
    notes: Note[];
    tempo: number;
    synth: SynthesizerConfig;
    ownerId: string;
  };
}

/**
 * EditMelodyClient - Edit page client wrapper.
 *
 * Uses the shared MelodyEditor component for all editor functionality.
 * Keeps save (PUT), delete confirmation dialog, ownership check, and
 * redirect logic at the route level.
 *
 * Requirements:
 * - 4.1-4.9: Edit page integration
 * - 7.1, 7.2: MIDI import/export support
 * - 8.4: Dirty state tracking for "Saved!" indicator
 */
export default function EditMelodyClient({ melody }: EditMelodyClientProps) {
  const router = useRouter();

  // ===== Persistence & Ownership =====
  const { isSaving, error: persistenceError, updateMelody, deleteMelody } = useMelodyPersistence();
  const { ownerId, isOwner: checkIsOwner } = useOwnership();

  // ===== Ownership Check =====
  const isOwner = checkIsOwner(melody.ownerId);

  // ===== Editor State (tracked via onStateChange) =====
  const editorStateRef = useRef<EditorState>({
    notes: melody.notes,
    synthConfig: melody.synth,
    tempo: melody.tempo,
  });

  // State mirrors for values used in render (MidiControls props)
  const [currentNotes, setCurrentNotes] = useState<Note[]>(melody.notes);
  const [currentTempo, setCurrentTempo] = useState(melody.tempo);

  // ===== MIDI Import - loadNotes function from MelodyEditor =====
  const loadNotesRef = useRef<LoadNotesFn | null>(null);

  // ===== Local State =====
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ===== Callbacks =====

  /** Track editor state changes for save operations */
  const handleStateChange = useCallback((state: EditorState) => {
    editorStateRef.current = state;
    setCurrentNotes(state.notes);
    setCurrentTempo(state.tempo);
  }, []);

  /** Clear "Saved!" indicator when further edits are made */
  const handleDirtyStateChange = useCallback((isDirty: boolean) => {
    if (isDirty) {
      setSaveSuccess(false);
    }
  }, []);

  /** Store the loadNotes function reference from MelodyEditor */
  const handleMidiImportRef = useCallback((loadNotes: LoadNotesFn) => {
    loadNotesRef.current = loadNotes;
  }, []);

  /** Handle MIDI import from MidiControls */
  const handleMidiImport = useCallback((importedNotes: Note[], importedTempo?: number) => {
    loadNotesRef.current?.(importedNotes, importedTempo);
  }, []);

  /** Save melody (PUT) */
  const handleSave = useCallback(async () => {
    if (!isOwner) return;

    setSaveSuccess(false);
    try {
      const { notes, tempo, synthConfig } = editorStateRef.current;
      await updateMelody(melody.id, {
        title: melody.title,
        notes,
        tempo,
        synth: synthConfig,
        ownerId,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by useMelodyPersistence
    }
  }, [isOwner, melody.id, melody.title, ownerId, updateMelody]);

  /** Open delete confirmation dialog */
  const handleDeleteClick = useCallback(() => {
    setShowDeleteDialog(true);
    setDeleteError(null);
  }, []);

  /** Confirm deletion */
  const handleDeleteConfirm = useCallback(async () => {
    if (!isOwner) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteMelody(melody.id, ownerId);
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete melody');
      setIsDeleting(false);
    }
  }, [melody.id, isOwner, ownerId, deleteMelody, router]);

  /** Cancel deletion dialog */
  const handleDeleteCancel = useCallback(() => {
    setShowDeleteDialog(false);
    setDeleteError(null);
  }, []);

  // ===== Header Slot =====
  const headerSlot = (
    <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Back to home"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold truncate max-w-md">{melody.title}</h1>
        {!isOwner && (
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">Preview Mode</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {saveSuccess && <span className="text-green-400 text-sm">Saved!</span>}
        {persistenceError && (
          <span className="text-red-400 text-sm truncate max-w-xs">{persistenceError}</span>
        )}
        <MidiControls
          notes={currentNotes}
          title={melody.title}
          tempo={currentTempo}
          onImport={handleMidiImport}
          allowImport={isOwner}
        />
        {isOwner && (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </header>
  );

  return (
    <ErrorBoundary
      errorTitle="Editor Error"
      errorMessage="Something went wrong while displaying the melody. Please try again."
    >
      <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
        <MelodyEditor
          initialNotes={melody.notes}
          initialSynthConfig={melody.synth}
          initialTempo={melody.tempo}
          headerSlot={headerSlot}
          allowMidiImport={isOwner}
          onStateChange={handleStateChange}
          onDirtyStateChange={handleDirtyStateChange}
          onMidiImport={handleMidiImportRef}
        />

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-semibold mb-4">Delete Melody</h2>
              <p className="text-gray-300 mb-4">
                Are you sure you want to delete &quot;{melody.title}&quot;? This action cannot be undone.
              </p>
              {deleteError && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
                  {deleteError}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
