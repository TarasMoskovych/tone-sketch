'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  PianoRollCanvas,
  TransportControls,
  SynthControls,
  GridSnapControls,
  ErrorBoundary,
  PianoRollSkeleton,
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

/**
 * MelodyPage component - Refactored to use custom hooks
 *
 * Displays and optionally edits an existing melody using custom hooks architecture.
 *
 * Requirements:
 * - 19.1-19.6: Melody retrieval with loading/error states
 * - 20.1-20.7: Melody update for owners
 * - 21.1-21.7: Melody deletion for owners
 * - 38.1, 38.6, 38.7: Custom hooks architecture
 */
export default function MelodyPage() {
  const params = useParams();
  const router = useRouter();
  const melodyId = params.id as string;

  // ===== Custom Hooks =====
  // usePianoRoll - manages notes, selection (read-only mode uses loadNotes)
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

  // useSynthesizer - manages synth config with effects and presets
  const synthEngineRef = useRef<SynthesizerEngine | null>(null);
  const synthesizer = useSynthesizer({
    onChange: (config: SynthesizerConfig) => {
      synthEngineRef.current?.configure(config as DeepPartialSynthConfig);
    },
  });
  const { config: synthConfig, loadConfig: loadSynthConfig, updateConfig, applyPreset } = synthesizer;

  // usePlayback - manages playback state and transport controls
  // engineReady signal ensures playhead callback is registered after synth is created
  const [engineReady, setEngineReady] = useState(false);

  const playback = usePlayback({
    synthEngineRef,
    notes,
    engineReady,
  });
  const { isPlaying, isPaused, isLooping, playheadPosition, play, pause, stop, toggleLoop, setPlayheadPosition } = playback;

  // useMelodyPersistence - handles API interactions for load/save/delete
  const persistence = useMelodyPersistence();
  const { isLoading, isSaving, error: persistenceError, loadMelody, updateMelody, deleteMelody } = persistence;

  // useOwnership - handles owner ID verification
  const ownership = useOwnership();
  const { ownerId, isOwner: checkIsOwner } = ownership;

  // useKeyboardPiano - allows playing notes via QWERTY keyboard
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
    onNoteOff: useCallback(() => {
      // Note off is handled by ADSR release in the synthesizer
    }, []),
  });

  // ===== Local State (UI-specific) =====
  const [melodyData, setMelodyData] = useState<{ id: string; title: string; tempo: number; ownerId: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
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

  /**
   * Fetch melody data from API using useMelodyPersistence hook
   * Requirements: 19.1-19.6
   */
  const fetchMelody = useCallback(async () => {
    setLoadError(null);
    setNotFound(false);

    try {
      const melody = await loadMelody(melodyId);

      // Set melody metadata
      setMelodyData({
        id: melody.id,
        title: melody.title,
        tempo: melody.tempo,
        ownerId: melody.ownerId,
      });

      // Load notes into piano roll
      loadNotes(melody.notes);

      // Load synth config (with effects and preset)
      loadSynthConfig(melody.synth);

      // Check ownership
      setIsOwner(checkIsOwner(melody.ownerId));
      setInitialLoadComplete(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load melody';
      if (errorMessage === 'Melody not found') {
        setNotFound(true);
      } else {
        setLoadError(errorMessage);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Only fetch when melodyId changes
  }, [melodyId]);

  // Fetch melody data on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional data fetch on mount
    void fetchMelody();
  }, [fetchMelody]);

  // Initialize synthesizer engine
  useEffect(() => {
    synthEngineRef.current = new SynthesizerEngine(synthConfig);
    // Signal that engine is ready - usePlayback will register playhead callback
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional initialization state
    setEngineReady(true);

    return () => {
      synthEngineRef.current?.dispose();
      synthEngineRef.current = null;
      setEngineReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only initialize once on mount
  }, []);

  // Update synth engine when config is loaded from melody
  useEffect(() => {
    if (initialLoadComplete && synthEngineRef.current) {
      synthEngineRef.current.configure(synthConfig as DeepPartialSynthConfig);
      // Also set the tempo from loaded melody
      if (melodyData?.tempo) {
        synthEngineRef.current.setTempo(melodyData.tempo);
      }
    }
  }, [initialLoadComplete, synthConfig, melodyData?.tempo]);

  /**
   * Handle synth config change - wraps useSynthesizer's updateConfig
   * Clears save success indicator when user makes changes
   */
  const handleSynthConfigChange = useCallback((config: Partial<SynthesizerConfig>) => {
    updateConfig(config);
    setSaveSuccess(false);
  }, [updateConfig]);

  /**
   * Handle tempo change - update melody data and synthesizer
   */
  const handleTempoChange = useCallback((newTempo: number) => {
    if (!melodyData) return;
    setMelodyData({ ...melodyData, tempo: newTempo });
    synthEngineRef.current?.setTempo(newTempo);
    setSaveSuccess(false);
  }, [melodyData]);

  /**
   * Handle note creation - only enabled for owners
   * Canvas creates the complete Note object, so we add it to notes array
   * Triggers note preview sound
   */
  const handleNoteCreate = useCallback((note: { id: string; pitch: number; start: number; duration: number; velocity: number }) => {
    // Add the note created by PianoRollCanvas to our notes array
    loadNotes([...notes, note]);
    // Trigger note preview sound
    synthEngineRef.current?.triggerNote(note);
    setSaveSuccess(false);
  }, [notes, loadNotes]);

  /**
   * Handle note update from PianoRollCanvas
   * Only enabled for owners (Requirement 20.1)
   */
  const handleNoteUpdate = useCallback((note: { id: string; pitch: number; start: number; duration: number; velocity: number }) => {
    updateNote(note.id, { pitch: note.pitch, start: note.start, duration: note.duration, velocity: note.velocity });
    setSaveSuccess(false);
  }, [updateNote]);

  /**
   * Handle note deletion from PianoRollCanvas
   * Only enabled for owners (Requirement 20.1)
   */
  const handleNoteDelete = useCallback((noteId: string) => {
    deleteNote(noteId);
    setSaveSuccess(false);
  }, [deleteNote]);

  /**
   * Handle note selection from PianoRollCanvas
   */
  const handleNoteSelect = useCallback((noteId: string | null) => {
    selectNote(noteId);
  }, [selectNote]);

  /**
   * Handle toggle note selection (Ctrl/Cmd + click)
   */
  const handleToggleNoteSelection = useCallback((noteId: string) => {
    toggleNoteSelection(noteId);
  }, [toggleNoteSelection]);

  /**
   * Handle add notes to selection (for marquee and range selection)
   */
  const handleAddToSelection = useCallback((noteIds: string[]) => {
    addToSelection(noteIds);
  }, [addToSelection]);

  /**
   * Handle deselect all notes
   */
  const handleDeselectAll = useCallback(() => {
    deselectAll();
  }, [deselectAll]);

  /**
   * Handle set selection anchor (for Shift-click range selection)
   */
  const handleSetSelectionAnchor = useCallback((noteId: string | null) => {
    setSelectionAnchor(noteId);
  }, [setSelectionAnchor]);

  /**
   * Handle bulk note update (for group movement)
   */
  const handleBulkNoteUpdate = useCallback((updates: Map<string, Partial<Note>>) => {
    bulkUpdateNotes(updates);
    setSaveSuccess(false);
  }, [bulkUpdateNotes]);

  /**
   * Handle toggle playback (Space bar shortcut)
   */
  const handleTogglePlayback = useCallback(() => {
    if (isPlaying && !isPaused) {
      pause();
    } else if (isPaused) {
      play();
    } else {
      play();
    }
  }, [isPlaying, isPaused, play, pause]);

  /**
   * Handle playhead position change from PianoRollCanvas
   * Requirement 8.5: Click on timeline repositions playhead
   */
  const handlePlayheadChange = useCallback((position: number) => {
    setPlayheadPosition(position);
  }, [setPlayheadPosition]);

  /**
   * Handle grid snap configuration change
   */
  const handleGridSnapChange = useCallback((config: GridSnapConfig) => {
    setGridSnap(config);
  }, [setGridSnap]);

  /**
   * Handle clear all notes - only for owners
   */
  const handleClearNotes = useCallback(() => {
    clearNotes();
    setSaveSuccess(false);
  }, [clearNotes]);

  /**
   * Handle MIDI import - called by MidiControls component
   */
  const handleMidiImport = useCallback((importedNotes: { id: string; pitch: number; start: number; duration: number; velocity: number }[], importedTempo?: number) => {
    loadNotes(importedNotes);
    if (importedTempo && melodyData) {
      setMelodyData({ ...melodyData, tempo: importedTempo });
      synthEngineRef.current?.setTempo(importedTempo);
    }
    setSaveSuccess(false);
  }, [loadNotes, melodyData]);

  /**
   * Handle save button click
   * Requirement 20.3: PUT request to /api/melodies/[id]
   */
  const handleSave = useCallback(async () => {
    if (!melodyData || !isOwner) return;

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
      // Error is handled by useMelodyPersistence
    }
  }, [melodyData, melodyId, notes, synthConfig, isOwner, ownerId, updateMelody]);

  /**
   * Open delete confirmation dialog
   * Requirement 21.3: Display confirmation dialog
   */
  const handleDeleteClick = useCallback(() => {
    setShowDeleteDialog(true);
    setDeleteError(null);
  }, []);

  /**
   * Handle delete confirmation
   * Requirement 21.4, 21.5, 21.6
   */
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

  /**
   * Cancel delete dialog
   */
  const handleDeleteCancel = useCallback(() => {
    setShowDeleteDialog(false);
    setDeleteError(null);
  }, []);

  // Loading state (Requirement 19.2)
  if (isLoading || !initialLoadComplete && !notFound && !loadError) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
        <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-6 h-6 bg-gray-700 rounded animate-pulse" />
            <div className="w-48 h-6 bg-gray-700 rounded animate-pulse" />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 border-b border-gray-700">
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-10 h-10 bg-gray-700 rounded animate-pulse" />
                ))}
              </div>
              <div className="w-px h-8 bg-gray-600" />
              <div className="flex gap-2">
                <div className="w-20 h-8 bg-gray-700 rounded animate-pulse" />
                <div className="w-24 h-8 bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <PianoRollSkeleton className="w-full h-full" />
            </div>
          </main>
          <aside className="w-72 flex-shrink-0 border-l border-gray-700 bg-gray-850 p-4">
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
                  <div className="w-full h-8 bg-gray-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // Not found state (Requirement 19.5)
  if (notFound) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <h1 className="text-2xl font-semibold">Melody Not Found</h1>
          <p className="text-gray-400">
            The melody you&apos;re looking for doesn&apos;t exist or may have been deleted.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Error state with retry option (Requirement 19.6)
  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <h1 className="text-2xl font-semibold text-red-400">Error Loading Melody</h1>
          <p className="text-gray-400">{loadError}</p>
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={fetchMelody}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium rounded-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Melody loaded successfully
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
            <h1 className="text-xl font-semibold truncate max-w-md">{melodyData?.title}</h1>
            {!isOwner && (
              <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">Preview Mode</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {saveSuccess && <span className="text-green-400 text-sm">Saved!</span>}
            {persistenceError && (
              <span className="text-red-400 text-sm truncate max-w-xs">{persistenceError}</span>
            )}
            {/* MIDI Import/Export */}
            <MidiControls
              notes={notes}
              title={melodyData?.title || 'Untitled'}
              tempo={melodyData?.tempo || 120}
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
                tempo={melodyData?.tempo || 120}
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
              {/* Fullscreen Toggle */}
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

          {/* Sidebar - Synth Controls (hidden in fullscreen mode) */}
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
                    tempo={melodyData?.tempo}
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
                Are you sure you want to delete &quot;{melodyData?.title}&quot;? This action cannot be undone.
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
