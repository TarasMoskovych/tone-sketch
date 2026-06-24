'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PianoRollCanvas,
  TransportControls,
  SynthControls,
  GridSnapControls,
  ErrorBoundary,
  FullscreenToggle,
  MidiControls,
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
import type { Note, SynthesizerConfig } from '@/types';

/**
 * Default tempo in BPM
 */
const DEFAULT_TEMPO = 120;

/**
 * CreatePage component
 */
export default function CreatePage() {
  const router = useRouter();

  // Synthesizer engine ref
  const synthEngineRef = useRef<SynthesizerEngine | null>(null);

  // ===== Custom Hooks =====

  const {
    notes,
    selectedNoteId,
    gridSnap,
    createNote,
    updateNote,
    deleteNote,
    selectNote,
    setGridSnap,
    loadNotes,
    clearNotes,
  } = usePianoRoll();

  const { config: synthConfig, updateConfig: updateSynthConfig, applyPreset } = useSynthesizer({
    onChange: useCallback((newConfig: SynthesizerConfig) => {
      synthEngineRef.current?.configure(newConfig as DeepPartialSynthConfig);
    }, []),
  });

  // State for synth engine ready signal - must be declared before usePlayback
  const [engineReady, setEngineReady] = useState(false);

  const {
    isPlaying,
    isPaused,
    isLooping,
    playheadPosition,
    play,
    pause,
    stop,
    toggleLoop,
    setPlayheadPosition,
  } = usePlayback({
    synthEngineRef,
    notes,
    engineReady,
  });

  const { isSaving, saveMelody, error: persistenceError, clearError } = useMelodyPersistence();
  const { getOwnerId } = useOwnership();

  // Keyboard piano hook for playing notes via QWERTY keyboard
  // Requirements: 40.1-40.8
  const {
    highlightedPitch,
    activePitches,
  } = useKeyboardPiano({
    enabled: true,
    synthesizerReady: engineReady,
    onNoteOn: useCallback((pitch: number, velocity: number) => {
      // Create a temporary note for immediate playback
      const tempNote: Note = {
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
      // No additional action needed here as triggerNote handles note-off automatically
    }, []),
  });

  // ===== Local State =====

  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [melodyTitle, setMelodyTitle] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tempo, setTempo] = useState(DEFAULT_TEMPO);

  // Piano roll fullscreen state
  const [isPianoRollFullscreen, setIsPianoRollFullscreen] = useState(false);

  const selectedNoteIds = selectedNoteId ? new Set([selectedNoteId]) : new Set<string>();

  // ===== Effects =====

  useEffect(() => {
    synthEngineRef.current = new SynthesizerEngine(synthConfig);
    // Set initial tempo
    synthEngineRef.current.setTempo(DEFAULT_TEMPO);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional initialization state
    setEngineReady(true);

    return () => {
      synthEngineRef.current?.dispose();
      synthEngineRef.current = null;
      setEngineReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ===== Event Handlers =====

  /**
   * Handle tempo change - update both state and synthesizer
   */
  const handleTempoChange = useCallback((newTempo: number) => {
    setTempo(newTempo);
    synthEngineRef.current?.setTempo(newTempo);
  }, []);

  const handleNoteCreate = useCallback((note: Note) => {
    createNote(note.pitch, note.start);
    synthEngineRef.current?.triggerNote(note);
  }, [createNote]);

  const handleNoteUpdate = useCallback((updatedNote: Note) => {
    updateNote(updatedNote.id, updatedNote);
  }, [updateNote]);

  const handleNoteDelete = useCallback((noteId: string) => {
    deleteNote(noteId);
  }, [deleteNote]);

  const handleNoteSelect = useCallback((noteId: string | null) => {
    selectNote(noteId);
  }, [selectNote]);

  const handlePlayheadChange = useCallback((position: number) => {
    setPlayheadPosition(position);
  }, [setPlayheadPosition]);

  // Toggle playback handler for keyboard shortcuts (Space bar)
  // Requirements: 33.1, 33.2, 33.3
  const handleTogglePlayback = useCallback(() => {
    if (isPlaying && !isPaused) {
      pause();
    } else if (isPaused) {
      play();
    } else {
      play();
    }
  }, [isPlaying, isPaused, play, pause]);

  const handleSynthConfigChange = useCallback((config: Partial<SynthesizerConfig>) => {
    updateSynthConfig(config);
  }, [updateSynthConfig]);

  const handleSaveClick = useCallback(() => {
    setSaveError(null);
    clearError();
    setShowTitleDialog(true);
  }, [clearError]);

  /**
   * Handle MIDI import - called by MidiControls component
   */
  const handleMidiImport = useCallback((importedNotes: Note[], importedTempo?: number) => {
    loadNotes(importedNotes);
    if (importedTempo) {
      setTempo(importedTempo);
      synthEngineRef.current?.setTempo(importedTempo);
    }
  }, [loadNotes]);

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
  }, [melodyTitle, notes, tempo, synthConfig, getOwnerId, saveMelody, router]);

  const handleSaveCancel = useCallback(() => {
    setShowTitleDialog(false);
    setMelodyTitle('');
    setSaveError(null);
    clearError();
  }, [clearError]);

  const displayError = saveError || persistenceError;

  // Piano roll component (reused in both normal and fullscreen mode)
  const pianoRollContent = (
    <ErrorBoundary
      errorTitle="Canvas Error"
      errorMessage="The piano roll canvas encountered an error."
      showHomeButton={false}
    >
      <PianoRollCanvas
        notes={notes}
        selectedNoteIds={selectedNoteIds}
        playheadPosition={playheadPosition}
        gridSnap={gridSnap}
        isPlaying={isPlaying && !isPaused}
        onNoteCreate={handleNoteCreate}
        onNoteUpdate={handleNoteUpdate}
        onNoteDelete={handleNoteDelete}
        onNoteSelect={handleNoteSelect}
        onPlayheadChange={handlePlayheadChange}
        onTogglePlayback={handleTogglePlayback}
        highlightedPitch={highlightedPitch}
        activePitches={activePitches}
        className="w-full h-full"
      />
    </ErrorBoundary>
  );

  // Transport controls bar (reused in both modes)
  const transportBar = (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 border-b border-gray-700">
      <TransportControls
        isPlaying={isPlaying}
        isPaused={isPaused}
        isLooping={isLooping}
        playheadPosition={playheadPosition}
        tempo={tempo}
        onPlay={play}
        onPause={pause}
        onStop={stop}
        onLoopToggle={toggleLoop}
      />
      <div className="w-px h-8 bg-gray-600" />
      <GridSnapControls config={gridSnap} onChange={setGridSnap} />
      <div className="w-px h-8 bg-gray-600" />
      {/* Clear All Notes button */}
      <button
        type="button"
        onClick={clearNotes}
        disabled={notes.length === 0}
        className="px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
        title="Clear all notes"
      >
        Clear All
      </button>
      <div className="flex-1" />
      {/* Fullscreen Toggle */}
      <FullscreenToggle
        isFullscreen={isPianoRollFullscreen}
        onToggle={() => setIsPianoRollFullscreen(!isPianoRollFullscreen)}
      />
    </div>
  );

  return (
    <ErrorBoundary
      errorTitle="Editor Error"
      errorMessage="Something went wrong while loading the melody editor. Please try again."
    >
      <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-4">
            {/* Home link */}
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
              notes={notes}
              title={melodyTitle || 'Untitled'}
              tempo={tempo}
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

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Piano Roll Section */}
          <main className={`flex flex-col overflow-hidden transition-all duration-300 ${
            isPianoRollFullscreen ? 'fixed inset-0 z-40 bg-gray-900' : 'flex-1'
          }`}>
            {transportBar}
            <div className="flex-1 overflow-hidden">
              {pianoRollContent}
            </div>
          </main>

          {/* Sidebar - Synth Controls (hidden in fullscreen mode) */}
          {!isPianoRollFullscreen && (
            <aside className="w-72 shrink-0 border-l border-gray-700 bg-gray-850 overflow-y-auto">
              <ErrorBoundary
                errorTitle="Controls Error"
                errorMessage="The synthesizer controls encountered an error."
                showHomeButton={false}
              >
                <SynthControls
                  config={synthConfig}
                  onChange={handleSynthConfigChange}
                  onPresetChange={applyPreset}
                  tempo={tempo}
                  onTempoChange={handleTempoChange}
                />
              </ErrorBoundary>
            </aside>
          )}
        </div>

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
