'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  PianoRollCanvas,
  TransportControls,
  SynthControls,
  GridSnapControls,
  ErrorBoundary,
  MidiControls,
  FullscreenToggle,
} from '@/components';
import {
  SynthesizerEngine,
  type DeepPartialSynthConfig,
} from '@/lib/synthesizer';
import {
  usePianoRoll,
  useSynthesizer,
  usePlayback,
  useMelodyPersistence,
  useOwnership,
  useKeyboardPiano,
} from '@/hooks';
import type { SynthesizerConfig, GridSnapConfig, Note } from '@/types';

interface MelodyEditorProps {
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
 * MelodyEditor client component - handles all interactive editor logic.
 *
 * Receives pre-fetched melody data from the server component.
 *
 * Requirements:
 * - 19.1-19.6: Melody retrieval with loading/error states
 * - 20.1-20.7: Melody update for owners
 * - 21.1-21.7: Melody deletion for owners
 * - 38.1, 38.6, 38.7: Custom hooks architecture
 */
export default function MelodyEditor({ melody }: MelodyEditorProps) {
  const router = useRouter();
  const melodyId = melody.id;

  // ===== Custom Hooks =====
  const pianoRoll = usePianoRoll();
  const {
    notes,
    selectedNoteIds,
    selectionAnchor,
    gridSnap,
    setGridSnap,
    updateNote,
    deleteNote,
    selectNote,
    toggleNoteSelection,
    addToSelection,
    deselectAll,
    selectAll,
    setSelectionAnchor,
    bulkUpdateNotes,
    loadNotes,
    clearNotes,
  } = pianoRoll;

  const synthEngineRef = useRef<SynthesizerEngine | null>(null);
  const synthesizer = useSynthesizer({
    onChange: (config: SynthesizerConfig) => {
      synthEngineRef.current?.configure(config as DeepPartialSynthConfig);
    },
  });
  const { config: synthConfig, loadConfig: loadSynthConfig, updateConfig, applyPreset } = synthesizer;

  const [engineReady, setEngineReady] = useState(false);

  const playback = usePlayback({
    synthEngineRef,
    notes,
    engineReady,
  });
  const { isPlaying, isPaused, isLooping, playheadPosition, play, pause, stop, toggleLoop, setPlayheadPosition } = playback;

  const persistence = useMelodyPersistence();
  const { isSaving, error: persistenceError, updateMelody, deleteMelody } = persistence;

  const ownership = useOwnership();
  const { ownerId, isOwner: checkIsOwner } = ownership;

  const { highlightedPitch, activePitches } = useKeyboardPiano({
    enabled: true,
    synthesizerReady: engineReady,
    onNoteOn: useCallback((pitch: number, velocity: number) => {
      const tempNote = {
        id: `keyboard-${Date.now()}`,
        pitch,
        start: 0,
        duration: 1,
        velocity,
      };
      synthEngineRef.current?.triggerNote(tempNote);
    }, []),
    onNoteOff: useCallback(() => {}, []),
  });

  // ===== Local State =====
  const [melodyData, setMelodyData] = useState<{ id: string; title: string; tempo: number; ownerId: string }>({
    id: melody.id,
    title: melody.title,
    tempo: melody.tempo,
    ownerId: melody.ownerId,
  });
  const [isOwner, setIsOwner] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPianoRollFullscreen, setIsPianoRollFullscreen] = useState(false);

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPianoRollFullscreen) {
        setIsPianoRollFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPianoRollFullscreen]);

  // Initialize with server-fetched data
  useEffect(() => {
    loadNotes(melody.notes);
    loadSynthConfig(melody.synth);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional one-time initialization from server data
    setIsOwner(checkIsOwner(melody.ownerId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run once on mount
  }, []);

  // Initialize synthesizer engine
  useEffect(() => {
    synthEngineRef.current = new SynthesizerEngine(synthConfig);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional initialization signal
    setEngineReady(true);

    return () => {
      synthEngineRef.current?.dispose();
      synthEngineRef.current = null;
      setEngineReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only initialize once on mount
  }, []);

  // Apply synth config and tempo after engine is ready
  useEffect(() => {
    if (engineReady && synthEngineRef.current) {
      synthEngineRef.current.configure(synthConfig as DeepPartialSynthConfig);
      if (melodyData.tempo) {
        synthEngineRef.current.setTempo(melodyData.tempo);
      }
    }
  }, [engineReady, synthConfig, melodyData.tempo]);

  // ===== Event Handlers =====

  const handleSynthConfigChange = useCallback((config: Partial<SynthesizerConfig>) => {
    updateConfig(config);
    setSaveSuccess(false);
  }, [updateConfig]);

  const handleTempoChange = useCallback((newTempo: number) => {
    setMelodyData(prev => ({ ...prev, tempo: newTempo }));
    synthEngineRef.current?.setTempo(newTempo);
    setSaveSuccess(false);
  }, []);

  const handleNoteCreate = useCallback((note: { id: string; pitch: number; start: number; duration: number; velocity: number }) => {
    loadNotes([...notes, note]);
    synthEngineRef.current?.triggerNote(note);
    setSaveSuccess(false);
  }, [notes, loadNotes]);

  const handleNoteUpdate = useCallback((note: { id: string; pitch: number; start: number; duration: number; velocity: number }) => {
    updateNote(note.id, { pitch: note.pitch, start: note.start, duration: note.duration, velocity: note.velocity });
    setSaveSuccess(false);
  }, [updateNote]);

  const handleNoteDelete = useCallback((noteId: string) => {
    deleteNote(noteId);
    setSaveSuccess(false);
  }, [deleteNote]);

  const handleNoteSelect = useCallback((noteId: string | null) => {
    selectNote(noteId);
  }, [selectNote]);

  const handleToggleNoteSelection = useCallback((noteId: string) => {
    toggleNoteSelection(noteId);
  }, [toggleNoteSelection]);

  const handleAddToSelection = useCallback((noteIds: string[]) => {
    addToSelection(noteIds);
  }, [addToSelection]);

  const handleDeselectAll = useCallback(() => {
    deselectAll();
  }, [deselectAll]);

  const handleSetSelectionAnchor = useCallback((noteId: string | null) => {
    setSelectionAnchor(noteId);
  }, [setSelectionAnchor]);

  const handleBulkNoteUpdate = useCallback((updates: Map<string, Partial<Note>>) => {
    bulkUpdateNotes(updates);
    setSaveSuccess(false);
  }, [bulkUpdateNotes]);

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying && !isPaused) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, isPaused, play, pause]);

  const handlePlayheadChange = useCallback((position: number) => {
    setPlayheadPosition(position);
  }, [setPlayheadPosition]);

  const handleGridSnapChange = useCallback((config: GridSnapConfig) => {
    setGridSnap(config);
  }, [setGridSnap]);

  const handleClearNotes = useCallback(() => {
    clearNotes();
    setSaveSuccess(false);
  }, [clearNotes]);

  const handleMidiImport = useCallback((importedNotes: { id: string; pitch: number; start: number; duration: number; velocity: number }[], importedTempo?: number) => {
    loadNotes(importedNotes);
    if (importedTempo) {
      setMelodyData(prev => ({ ...prev, tempo: importedTempo }));
      synthEngineRef.current?.setTempo(importedTempo);
    }
    setSaveSuccess(false);
  }, [loadNotes]);

  const handleSave = useCallback(async () => {
    if (!isOwner) return;

    setSaveSuccess(false);
    try {
      await updateMelody(melodyId, {
        title: melodyData.title,
        notes,
        tempo: melodyData.tempo,
        synth: synthConfig,
        ownerId,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Error handled by useMelodyPersistence
    }
  }, [melodyData, melodyId, notes, synthConfig, isOwner, ownerId, updateMelody]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteDialog(true);
    setDeleteError(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!isOwner) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteMelody(melodyId, ownerId);
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete melody');
      setIsDeleting(false);
    }
  }, [melodyId, isOwner, ownerId, deleteMelody, router]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteDialog(false);
    setDeleteError(null);
  }, []);

  // ===== Render =====
  return (
    <ErrorBoundary
      errorTitle="Editor Error"
      errorMessage="Something went wrong while displaying the melody. Please try again."
    >
      <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
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
            <h1 className="text-xl font-semibold truncate max-w-md">{melodyData.title}</h1>
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
              notes={notes}
              title={melodyData.title}
              tempo={melodyData.tempo}
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

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          <main className={`flex flex-col overflow-hidden transition-all duration-300 ${
            isPianoRollFullscreen ? 'fixed inset-0 z-40 bg-gray-900' : 'flex-1'
          }`}>
            {/* Transport and Grid controls bar */}
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 border-b border-gray-700">
              <TransportControls
                isPlaying={isPlaying}
                isPaused={isPaused}
                isLooping={isLooping}
                playheadPosition={playheadPosition}
                tempo={melodyData.tempo}
                onPlay={play}
                onPause={pause}
                onStop={stop}
                onLoopToggle={toggleLoop}
              />
              <div className="w-px h-8 bg-gray-600" />
              <GridSnapControls config={gridSnap} onChange={handleGridSnapChange} />
              {isOwner && (
                <>
                  <div className="w-px h-8 bg-gray-600" />
                  <button
                    type="button"
                    onClick={handleClearNotes}
                    disabled={notes.length === 0}
                    className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                    title="Clear all notes"
                  >
                    Clear All
                  </button>
                </>
              )}
              <div className="flex-1" />
              <FullscreenToggle
                isFullscreen={isPianoRollFullscreen}
                onToggle={() => setIsPianoRollFullscreen(!isPianoRollFullscreen)}
              />
            </div>

            {/* Piano Roll Canvas */}
            <div className="flex-1 overflow-hidden">
              <ErrorBoundary
                errorTitle="Canvas Error"
                errorMessage="The piano roll canvas encountered an error."
                showHomeButton={false}
              >
                <PianoRollCanvas
                  notes={notes}
                  selectedNoteIds={selectedNoteIds}
                  selectionAnchor={selectionAnchor}
                  playheadPosition={playheadPosition}
                  gridSnap={gridSnap}
                  isPlaying={isPlaying && !isPaused}
                  highlightedPitch={highlightedPitch}
                  activePitches={activePitches}
                  onNoteCreate={handleNoteCreate}
                  onNoteUpdate={handleNoteUpdate}
                  onNoteDelete={handleNoteDelete}
                  onNoteSelect={handleNoteSelect}
                  onToggleNoteSelection={handleToggleNoteSelection}
                  onAddToSelection={handleAddToSelection}
                  onDeselectAll={handleDeselectAll}
                  onSetSelectionAnchor={handleSetSelectionAnchor}
                  onBulkNoteUpdate={handleBulkNoteUpdate}
                  onPlayheadChange={handlePlayheadChange}
                  onTogglePlayback={handleTogglePlayback}
                  onSelectAll={selectAll}
                  className="w-full h-full"
                />
              </ErrorBoundary>
            </div>
          </main>

          {/* Sidebar - Synth Controls */}
          {!isPianoRollFullscreen && (
            <aside className="w-72 flex-shrink-0 border-l border-gray-700 bg-gray-850 flex flex-col max-h-full">
              <ErrorBoundary
                errorTitle="Controls Error"
                errorMessage="The synthesizer controls encountered an error."
                showHomeButton={false}
              >
                <div className="flex-1 overflow-y-auto overscroll-contain">
                  <SynthControls
                    config={synthConfig}
                    onChange={handleSynthConfigChange}
                    onPresetChange={applyPreset}
                    tempo={melodyData.tempo}
                    onTempoChange={handleTempoChange}
                    className="h-full"
                  />
                </div>
              </ErrorBoundary>
            </aside>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-semibold mb-4">Delete Melody</h2>
              <p className="text-gray-300 mb-4">
                Are you sure you want to delete &quot;{melodyData.title}&quot;? This action cannot be undone.
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
