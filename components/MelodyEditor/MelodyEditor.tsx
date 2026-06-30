'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  SynthesizerEngine,
  type DeepPartialSynthConfig,
} from '@/lib/synthesizer';
import {
  usePianoRoll,
  useSynthesizer,
  usePlayback,
  useKeyboardPiano,
  useCopyPaste,
  DEFAULT_SYNTH_CONFIG,
} from '@/hooks';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import {
  PianoRollCanvas,
  TransportControls,
  SynthControls,
  GridSnapControls,
  ErrorBoundary,
  FullscreenToggle,
} from '@/components';
import { VelocityLaneCanvas } from '@/components/VelocityLane';
import { DEFAULT_VISIBLE_REGION } from '@/components/PianoRoll/constants';
import type { Note, SynthesizerConfig, GridSnapConfig } from '@/types';
import type { VisibleRegion } from '@/types/grid';
import type { MelodyEditorProps, EditorState, LoadNotesFn } from './types';

/**
 * Clamps a tempo value to the valid range [20, 300].
 * Defaults to 120 when the value is undefined or not a finite number.
 */
function clampTempo(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 120;
  return Math.max(20, Math.min(300, value));
}

/**
 * MelodyEditor - Shared piano roll editor component.
 *
 * Encapsulates all editor logic:
 * - Hook initialization (usePianoRoll, useSynthesizer, usePlayback, useKeyboardPiano, useCopyPaste)
 * - SynthesizerEngine lifecycle (create on mount, configure, dispose on unmount)
 * - State change and dirty state callbacks
 * - MIDI import gating
 * - readOnly mutation blocking
 *
 * UI rendering (transport bar, canvas, sidebar, fullscreen) is handled in a subsequent task.
 *
 * Requirements: 1.1, 1.2, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 5.6, 5.8, 5.9,
 *              6.1, 6.2, 7.1, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 9.1, 9.2
 */
export function MelodyEditor({
  initialNotes = [],
  initialSynthConfig,
  initialTempo,
  readOnly = false,
  headerSlot,
  allowMidiImport = true,
  onStateChange,
  onDirtyStateChange,
  onMidiImport,
}: MelodyEditorProps) {
  // ===== Tempo State =====
  const [tempo, setTempo] = useState(() => clampTempo(initialTempo));

  // ===== Synth Engine Ref =====
  const synthEngineRef = useRef<SynthesizerEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  // ===== Dirty State Tracking =====
  // Use a ref to track whether initial load is complete to avoid false dirty signals
  const isInitializedRef = useRef(false);
  const isDirtyRef = useRef(false);

  // ===== Refs for stable callback closures =====
  const readOnlyRef = useRef(readOnly);
  const allowMidiImportRef = useRef(allowMidiImport);
  const onStateChangeRef = useRef(onStateChange);
  const onDirtyStateChangeRef = useRef(onDirtyStateChange);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    allowMidiImportRef.current = allowMidiImport;
  }, [allowMidiImport]);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  useEffect(() => {
    onDirtyStateChangeRef.current = onDirtyStateChange;
  }, [onDirtyStateChange]);

  // ===== Piano Roll Hook =====
  const pianoRoll = usePianoRoll();
  const {
    notes,
    selectedNoteIds,
    selectionAnchor,
    gridSnap,
    setGridSnap,
    createNote: _createNote,
    updateNote,
    deleteNote,
    selectNote,
    toggleNoteSelection,
    addToSelection,
    deselectAll,
    selectAll,
    setSelectionAnchor,
    bulkUpdateNotes,
    loadNotes: pianoRollLoadNotes,
    clearNotes,
  } = pianoRoll;

  // ===== Synthesizer Hook =====
  const {
    config: synthConfig,
    updateConfig: updateSynthConfig,
    applyPreset,
    loadConfig: loadSynthConfig,
  } = useSynthesizer({
    onChange: useCallback((newConfig: SynthesizerConfig) => {
      if (readOnlyRef.current) return;
      synthEngineRef.current?.configure(newConfig as DeepPartialSynthConfig);
    }, []),
  });

  // ===== Playback Hook =====
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

  // ===== Keyboard Piano Hook =====
  const { highlightedPitch, activePitches } = useKeyboardPiano({
    enabled: true,
    synthesizerReady: engineReady,
    onNoteOn: useCallback((pitch: number, velocity: number) => {
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
    }, []),
  });

  // ===== Copy/Paste Hook =====
  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Ref for recordBatch to break circular dependency between useCopyPaste and useUndoRedo
  const recordBatchRef = useRef<(operations: Array<{ type: 'create'; note: Note } | { type: 'delete'; note: Note } | { type: 'modify'; noteId: string; before: Note; after: Note }>) => void>(() => {});

  const { copy, cut, paste, duplicate } = useCopyPaste({
    notes,
    selectedNoteIds,
    playheadPosition,
    gridSnap,
    onNotesCreated: useCallback((newNotes: Note[]) => {
      if (readOnlyRef.current) return;
      pianoRollLoadNotes([...notesRef.current, ...newNotes]);
    }, [pianoRollLoadNotes]),
    onNotesDeleted: useCallback((noteIds: string[]) => {
      if (readOnlyRef.current) return;
      // Capture note data before deletion for undo recording
      const notesToDelete = notesRef.current.filter(n => noteIds.includes(n.id));
      for (const id of noteIds) {
        deleteNote(id);
      }
      // Record a batch delete action so cut can be undone in a single step
      if (notesToDelete.length > 0) {
        const deleteOps = notesToDelete.map(note => ({
          type: 'delete' as const,
          note,
        }));
        recordBatchRef.current(deleteOps);
      }
    }, [deleteNote]),
    onSelectionChanged: useCallback((noteIds: string[]) => {
      pianoRoll.selectNotes(noteIds);
    }, [pianoRoll]),
  });

  // ===== Undo/Redo Hook =====
  const { canUndo: _canUndo, canRedo: _canRedo, undo, redo, recordCreate, recordDelete, recordModify, recordBatch, clearHistory, setDragInProgress } = useUndoRedo({
    notes,
    loadNotes: pianoRollLoadNotes,
    selectNotes: pianoRoll.selectNotes,
    deselectAll,
  });

  // Keep recordBatchRef in sync so useCopyPaste's onNotesDeleted can access it
  useEffect(() => {
    recordBatchRef.current = recordBatch;
  }, [recordBatch]);

  // ===== State Change Notification =====
  const fireStateChange = useCallback((state: EditorState) => {
    try {
      onStateChangeRef.current?.(state);
    } catch {
      // Caught internally; does not crash the editor
    }
  }, []);

  const fireDirtyStateChange = useCallback((dirty: boolean) => {
    if (isDirtyRef.current !== dirty) {
      isDirtyRef.current = dirty;
      onDirtyStateChangeRef.current?.(dirty);
    }
  }, []);

  // Track notes changes for state/dirty callbacks
  const prevNotesRef = useRef(notes);
  useEffect(() => {
    if (prevNotesRef.current !== notes) {
      prevNotesRef.current = notes;
      if (isInitializedRef.current) {
        fireStateChange({ notes, synthConfig, tempo });
        fireDirtyStateChange(true);
      }
    }
  }, [notes, synthConfig, tempo, fireStateChange, fireDirtyStateChange]);

  // Track synthConfig changes for state/dirty callbacks
  const prevSynthConfigRef = useRef(synthConfig);
  useEffect(() => {
    if (prevSynthConfigRef.current !== synthConfig) {
      prevSynthConfigRef.current = synthConfig;
      if (isInitializedRef.current) {
        fireStateChange({ notes, synthConfig, tempo });
        fireDirtyStateChange(true);
      }
    }
  }, [notes, synthConfig, tempo, fireStateChange, fireDirtyStateChange]);

  // Track tempo changes for state/dirty callbacks
  const prevTempoRef = useRef(tempo);
  useEffect(() => {
    if (prevTempoRef.current !== tempo) {
      prevTempoRef.current = tempo;
      if (isInitializedRef.current) {
        fireStateChange({ notes, synthConfig, tempo });
        fireDirtyStateChange(true);
      }
    }
  }, [notes, synthConfig, tempo, fireStateChange, fireDirtyStateChange]);

  // ===== Engine Lifecycle =====
  useEffect(() => {
    const resolvedConfig = initialSynthConfig ?? DEFAULT_SYNTH_CONFIG;
    const resolvedTempo = clampTempo(initialTempo);

    const engine = new SynthesizerEngine(resolvedConfig);
    engine.setTempo(resolvedTempo);
    synthEngineRef.current = engine;

    // Use a microtask to batch with React's scheduler
    queueMicrotask(() => setEngineReady(true));

    return () => {
      engine.dispose();
      synthEngineRef.current = null;
      setEngineReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only initialize once on mount
  }, []);

  // ===== Initial Data Loading =====
  useEffect(() => {
    if (initialNotes.length > 0) {
      pianoRollLoadNotes(initialNotes);
    }
    if (initialSynthConfig) {
      loadSynthConfig(initialSynthConfig);
    }

    // Mark initialization complete after initial load
    // Use a microtask to ensure React has flushed the state updates
    const timer = setTimeout(() => {
      isInitializedRef.current = true;
      // Fire initial state change
      fireStateChange({
        notes: initialNotes,
        synthConfig: initialSynthConfig ?? DEFAULT_SYNTH_CONFIG,
        tempo: clampTempo(initialTempo),
      });
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run once on mount
  }, []);

  // ===== MIDI Import - provide loadNotes to parent =====
  const loadNotesFn: LoadNotesFn = useCallback((importedNotes: Note[], importedTempo?: number) => {
    if (readOnlyRef.current) return;
    if (!allowMidiImportRef.current) return;

    pianoRollLoadNotes(importedNotes);
    clearHistory(); // Reset undo history after MIDI import
    if (importedTempo !== undefined) {
      const clampedTempo = clampTempo(importedTempo);
      setTempo(clampedTempo);
      synthEngineRef.current?.setTempo(clampedTempo);
    }
  }, [pianoRollLoadNotes, clearHistory]);

  // Expose loadNotes to parent via onMidiImport callback
  useEffect(() => {
    onMidiImport?.(loadNotesFn);
  }, [onMidiImport, loadNotesFn]);

  // ===== Event Handlers (readOnly-gated) =====

  /** Handle tempo change - update state and engine */
  const handleTempoChange = useCallback((newTempo: number) => {
    if (readOnlyRef.current) return;
    const clamped = clampTempo(newTempo);
    setTempo(clamped);
    synthEngineRef.current?.setTempo(clamped);
  }, []);

  /** Handle note creation with audio trigger and undo recording */
  const handleNoteCreate = useCallback((note: Note) => {
    if (readOnlyRef.current) return;
    // Add note directly to preserve the ID from PianoRollCanvas for undo tracking
    pianoRollLoadNotes([...notesRef.current, note]);
    pianoRoll.selectNotes([note.id]);
    recordCreate(note);
    synthEngineRef.current?.triggerNote(note);
  }, [pianoRollLoadNotes, pianoRoll, recordCreate]);

  /** Handle note update with undo recording */
  const handleNoteUpdate = useCallback((updatedNote: Note) => {
    if (readOnlyRef.current) return;
    const beforeNote = notesRef.current.find(n => n.id === updatedNote.id);
    updateNote(updatedNote.id, updatedNote);
    if (beforeNote) {
      recordModify(updatedNote.id, beforeNote, updatedNote);
    }
  }, [updateNote, recordModify]);

  /** Handle note deletion with undo recording */
  const handleNoteDelete = useCallback((noteId: string) => {
    if (readOnlyRef.current) return;
    const noteToDelete = notesRef.current.find(n => n.id === noteId);
    deleteNote(noteId);
    if (noteToDelete) {
      recordDelete(noteToDelete);
    }
  }, [deleteNote, recordDelete]);

  /** Handle note selection (always allowed, even in readOnly) */
  const handleNoteSelect = useCallback((noteId: string | null) => {
    selectNote(noteId);
  }, [selectNote]);

  /** Handle toggle note selection */
  const handleToggleNoteSelection = useCallback((noteId: string) => {
    toggleNoteSelection(noteId);
  }, [toggleNoteSelection]);

  /** Handle add to selection */
  const handleAddToSelection = useCallback((noteIds: string[]) => {
    addToSelection(noteIds);
  }, [addToSelection]);

  /** Handle deselect all */
  const handleDeselectAll = useCallback(() => {
    deselectAll();
  }, [deselectAll]);

  /** Handle selection anchor */
  const handleSetSelectionAnchor = useCallback((noteId: string | null) => {
    setSelectionAnchor(noteId);
  }, [setSelectionAnchor]);

  /** Handle bulk note update with undo recording */
  const handleBulkNoteUpdate = useCallback((updates: Map<string, Partial<Note>>) => {
    if (readOnlyRef.current) return;
    // Capture before states for all affected notes
    const operations: Array<{ type: 'modify'; noteId: string; before: Note; after: Note }> = [];
    for (const [noteId, partialUpdate] of updates) {
      const beforeNote = notesRef.current.find(n => n.id === noteId);
      if (beforeNote) {
        const afterNote = { ...beforeNote, ...partialUpdate };
        operations.push({ type: 'modify' as const, noteId, before: beforeNote, after: afterNote });
      }
    }
    bulkUpdateNotes(updates);
    if (operations.length > 0) {
      recordBatch(operations);
    }
  }, [bulkUpdateNotes, recordBatch]);

  /** Handle drag start - suppress undo recording during intermediate updates */
  const handleDragStart = useCallback(() => {
    setDragInProgress(true);
  }, [setDragInProgress]);

  /** Handle drag end - record the final before/after snapshot on commit */
  const handleDragEnd = useCallback((originalNotes: Map<string, Note>, updatedNotes: Map<string, Note>) => {
    // Clear the drag flag first so recording is no longer suppressed
    setDragInProgress(false);

    // Record the final undo action with the before/after states
    if (originalNotes.size === 1) {
      // Single note modification
      const [noteId, before] = originalNotes.entries().next().value!;
      const after = updatedNotes.get(noteId);
      if (after && (before.start !== after.start || before.pitch !== after.pitch || before.duration !== after.duration || before.velocity !== after.velocity)) {
        recordModify(noteId, before, after);
      }
    } else if (originalNotes.size > 1) {
      // Batch modification (group drag)
      const operations: Array<{ type: 'modify'; noteId: string; before: Note; after: Note }> = [];
      for (const [noteId, before] of originalNotes) {
        const after = updatedNotes.get(noteId);
        if (after && (before.start !== after.start || before.pitch !== after.pitch || before.duration !== after.duration || before.velocity !== after.velocity)) {
          operations.push({ type: 'modify' as const, noteId, before, after });
        }
      }
      if (operations.length > 0) {
        recordBatch(operations);
      }
    }
  }, [setDragInProgress, recordModify, recordBatch]);

  /** Handle drag cancel - clear suppression flag without recording */
  const handleDragCancel = useCallback(() => {
    setDragInProgress(false);
  }, [setDragInProgress]);

  /** Handle playhead position change */
  const handlePlayheadChange = useCallback((position: number) => {
    setPlayheadPosition(position);
  }, [setPlayheadPosition]);

  /** Toggle playback (Space bar) */
  const handleTogglePlayback = useCallback(() => {
    if (isPlaying && !isPaused) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, isPaused, play, pause]);

  /** Handle synth config change */
  const handleSynthConfigChange = useCallback((config: Partial<SynthesizerConfig>) => {
    if (readOnlyRef.current) return;
    updateSynthConfig(config);
  }, [updateSynthConfig]);

  /** Handle clear all notes */
  const handleClearNotes = useCallback(() => {
    if (readOnlyRef.current) return;
    // Record a batch delete action with all current notes before clearing
    const currentNotes = notesRef.current;
    if (currentNotes.length > 0) {
      const deleteOps = currentNotes.map(note => ({
        type: 'delete' as const,
        note,
      }));
      recordBatch(deleteOps);
    }
    clearNotes();
  }, [clearNotes, recordBatch]);

  // ===== Fullscreen State =====
  const [isPianoRollFullscreen, setIsPianoRollFullscreen] = useState(false);

  // ===== Velocity Lane Visibility State =====
  // Requirement 1.3: Default visibility is hidden (false)
  const [velocityLaneVisible, setVelocityLaneVisible] = useState(false);

  // ===== Shared Visible Region State =====
  // Requirements 3.1, 3.2, 3.3: Both PianoRollCanvas and VelocityLaneCanvas share visible region
  const [visibleRegion, setVisibleRegion] = useState<VisibleRegion>(DEFAULT_VISIBLE_REGION);

  /** Handle visible region changes from either PianoRollCanvas or VelocityLaneCanvas */
  const handleVisibleRegionChange = useCallback((region: VisibleRegion) => {
    setVisibleRegion(region);
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

  // ===== Grid Snap Change Handler =====
  const handleGridSnapChange = useCallback((config: GridSnapConfig) => {
    setGridSnap(config);
  }, [setGridSnap]);

  // ===== Render =====
  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100" data-testid="melody-editor">
      {/* Header Slot */}
      {headerSlot}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Piano Roll Section */}
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
              tempo={tempo}
              onPlay={play}
              onPause={pause}
              onStop={stop}
              onLoopToggle={toggleLoop}
            />
            <div className="w-px h-8 bg-gray-600" />
            <GridSnapControls config={gridSnap} onChange={handleGridSnapChange} />
            {!readOnly && (
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
            <button
              type="button"
              onClick={() => {
                setVelocityLaneVisible(!velocityLaneVisible);
              }}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                velocityLaneVisible
                  ? 'text-white bg-indigo-600 border-indigo-400 hover:bg-indigo-500'
                  : 'text-gray-300 border-gray-600 hover:text-white hover:bg-gray-700 hover:border-gray-500'
              }`}
              title={velocityLaneVisible ? 'Hide velocity lane' : 'Show velocity lane'}
              aria-pressed={velocityLaneVisible}
            >
              Velocity
            </button>
            <FullscreenToggle
              isFullscreen={isPianoRollFullscreen}
              onToggle={() => setIsPianoRollFullscreen(!isPianoRollFullscreen)}
            />
          </div>

          {/* Piano Roll Canvas and Velocity Lane */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Piano Roll Canvas - Requirements 1.1, 1.2, 1.4: flex-[3] when velocity lane visible, full height when hidden */}
            <div className={velocityLaneVisible ? 'flex-[3] min-h-0' : 'flex-1 min-h-0'}>
              <ErrorBoundary
                errorTitle="Canvas Error"
                errorMessage="The piano roll canvas encountered an error."
                showHomeButton={false}
              >
                <PianoRollCanvas
                  notes={notes}
                  selectedNoteIds={selectedNoteIds}
                  selectionAnchor={selectionAnchor}
                  visibleRegion={visibleRegion}
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
                  onVisibleRegionChange={handleVisibleRegionChange}
                  onPlayheadChange={handlePlayheadChange}
                  onTogglePlayback={handleTogglePlayback}
                  onSelectAll={selectAll}
                  onCopy={copy}
                  onCut={cut}
                  onPaste={paste}
                  onDuplicate={duplicate}
                  onUndo={undo}
                  onRedo={redo}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                  className="w-full h-full"
                />
              </ErrorBoundary>
            </div>

            {/* Velocity Lane - Requirements 1.1, 1.2: ~25% height when visible */}
            {velocityLaneVisible && (
              <div className="flex-1 min-h-0 border-t border-gray-700">
                <VelocityLaneCanvas
                  notes={notes}
                  selectedNoteIds={selectedNoteIds}
                  visibleRegion={visibleRegion}
                  playheadPosition={playheadPosition}
                  onNoteUpdate={handleNoteUpdate}
                  onBulkNoteUpdate={handleBulkNoteUpdate}
                  onVisibleRegionChange={handleVisibleRegionChange}
                  onNoteSelect={handleNoteSelect}
                  onToggleNoteSelection={handleToggleNoteSelection}
                  onDeselectAll={handleDeselectAll}
                  className="w-full h-full"
                />
              </div>
            )}
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
                  tempo={tempo}
                  onTempoChange={handleTempoChange}
                />
              </div>
            </ErrorBoundary>
          </aside>
        )}
      </div>
    </div>
  );
}

// Re-export internal state for testing/debugging purposes
export type {
  MelodyEditorProps,
  EditorState,
  LoadNotesFn,
} from './types';
