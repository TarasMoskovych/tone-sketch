/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';

import type { Note, SynthesizerConfig } from '@/types';
import type { EditorState } from '@/components/MelodyEditor/types';

// --- Mock Setup ---

// Track whether mutations go through by spying on the underlying hook functions.

const mockCreateNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockDeleteNote = vi.fn();
const mockClearNotes = vi.fn();
const mockLoadNotes = vi.fn();
const mockBulkUpdateNotes = vi.fn();
const mockSelectNote = vi.fn();
const mockSelectNotes = vi.fn();
const mockDeselectAll = vi.fn();
const mockSelectAll = vi.fn();
const mockToggleNoteSelection = vi.fn();
const mockAddToSelection = vi.fn();
const mockSetSelectionAnchor = vi.fn();
const mockSetGridSnap = vi.fn();
const mockUpdateSynthConfig = vi.fn();

let currentMockNotes: Note[] = [];
let currentMockSynthConfig: SynthesizerConfig;

const DEFAULT_SYNTH_CONFIG_MOCK: SynthesizerConfig = {
  oscillatorType: 'sine',
  volume: 0.8,
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 },
  filter: { enabled: false, type: 'lowpass', frequency: 1000 },
  effects: {
    reverb: { enabled: false, roomSize: 0.5, wetDry: 0.3 },
    delay: { enabled: false, time: 0.25, feedback: 0.3, wetDry: 0.3 },
    chorus: { enabled: false, rate: 1.5, depth: 0.5, wetDry: 0.3 },
    flanger: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.5, wetDry: 0.3 },
  },
  presetName: null,
};

vi.mock('@/hooks', () => ({
  DEFAULT_SYNTH_CONFIG: {
    oscillatorType: 'sine',
    volume: 0.8,
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 },
    filter: { enabled: false, type: 'lowpass', frequency: 1000 },
    effects: {
      reverb: { enabled: false, roomSize: 0.5, wetDry: 0.3 },
      delay: { enabled: false, time: 0.25, feedback: 0.3, wetDry: 0.3 },
      chorus: { enabled: false, rate: 1.5, depth: 0.5, wetDry: 0.3 },
      flanger: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.5, wetDry: 0.3 },
    },
    presetName: null,
  },
  DEFAULT_EFFECTS_CONFIG: {
    reverb: { enabled: false, roomSize: 0.5, wetDry: 0.3 },
    delay: { enabled: false, time: 0.25, feedback: 0.3, wetDry: 0.3 },
    chorus: { enabled: false, rate: 1.5, depth: 0.5, wetDry: 0.3 },
    flanger: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.5, wetDry: 0.3 },
  },
  usePianoRoll: () => ({
    notes: currentMockNotes,
    selectedNoteId: null,
    selectedNoteIds: new Set<string>(),
    selectionAnchor: null,
    visibleRegion: { startBeat: 0, endBeat: 16, startPitch: 48, endPitch: 84 },
    gridSnap: { enabled: true, division: 0.25 as const },
    createNote: mockCreateNote,
    updateNote: mockUpdateNote,
    deleteNote: mockDeleteNote,
    selectNote: mockSelectNote,
    selectNotes: mockSelectNotes,
    addToSelection: mockAddToSelection,
    deselectNote: vi.fn(),
    toggleNoteSelection: mockToggleNoteSelection,
    deselectAll: mockDeselectAll,
    selectAll: mockSelectAll,
    clearNotes: mockClearNotes,
    loadNotes: mockLoadNotes,
    setSelectionAnchor: mockSetSelectionAnchor,
    bulkUpdateNotes: mockBulkUpdateNotes,
    setGridSnap: mockSetGridSnap,
    setVisibleRegion: vi.fn(),
  }),
  useSynthesizer: () => ({
    config: currentMockSynthConfig,
    updateConfig: mockUpdateSynthConfig,
    applyPreset: vi.fn(),
    loadConfig: vi.fn(),
  }),
  usePlayback: () => ({
    isPlaying: false,
    isPaused: false,
    isLooping: false,
    playheadPosition: 0,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    toggleLoop: vi.fn(),
    setPlayheadPosition: vi.fn(),
  }),
  useKeyboardPiano: () => ({
    highlightedPitch: null,
    activePitches: new Set<number>(),
  }),
  useCopyPaste: () => ({
    copy: vi.fn(),
    cut: vi.fn(),
    paste: vi.fn(),
    duplicate: vi.fn(),
  }),
}));

vi.mock('@/lib/synthesizer', () => {
  class MockSynthesizerEngine {
    configure = vi.fn();
    setTempo = vi.fn();
    dispose = vi.fn();
    triggerNote = vi.fn();
    constructor() {
      // no-op
    }
  }
  return {
    SynthesizerEngine: MockSynthesizerEngine,
  };
});

// Store refs to props passed to mocked child components
let capturedPianoRollProps: Record<string, unknown> = {};
let capturedSynthControlsProps: Record<string, unknown> = {};

vi.mock('@/components', () => ({
  PianoRollCanvas: (props: Record<string, unknown>) => {
    capturedPianoRollProps = props;
    return React.createElement('div', { 'data-testid': 'piano-roll-canvas' });
  },
  TransportControls: () => React.createElement('div', { 'data-testid': 'transport-controls' }),
  SynthControls: (props: Record<string, unknown>) => {
    capturedSynthControlsProps = props;
    return React.createElement('div', { 'data-testid': 'synth-controls' });
  },
  GridSnapControls: () => React.createElement('div', { 'data-testid': 'grid-snap-controls' }),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  FullscreenToggle: () => React.createElement('div', { 'data-testid': 'fullscreen-toggle' }),
}));

// Now import the MelodyEditor component (after all mocks are defined)
import { MelodyEditor } from '@/components/MelodyEditor';

// --- Custom Arbitraries ---

const noteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  pitch: fc.integer({ min: 0, max: 127 }),
  start: fc.double({ min: 0, max: 100, noNaN: true }),
  duration: fc.double({ min: 0.001, max: 10, noNaN: true }),
  velocity: fc.double({ min: 0, max: 1, noNaN: true }),
});

const tempoArb: fc.Arbitrary<number> = fc.integer({ min: 20, max: 300 });

// --- Tests ---

describe('Feature: melody-editor-refactor, Property 3: ReadOnly Blocks All Mutations', () => {
  /**
   * Validates: Requirements 2.5, 5.7, 7.5
   *
   * For any editor state and any mutation operation (note create, note update,
   * note delete, clear all, synth config change, MIDI import) attempted while
   * `readOnly` is true, the editor state SHALL remain unchanged and
   * `onStateChange` SHALL NOT be invoked.
   */

  let onStateChange: ReturnType<typeof vi.fn<(state: EditorState) => void>>;

  beforeEach(() => {
    currentMockNotes = [];
    currentMockSynthConfig = { ...DEFAULT_SYNTH_CONFIG_MOCK };
    onStateChange = vi.fn<(state: EditorState) => void>();
    capturedPianoRollProps = {};
    capturedSynthControlsProps = {};
    mockCreateNote.mockClear();
    mockUpdateNote.mockClear();
    mockDeleteNote.mockClear();
    mockClearNotes.mockClear();
    mockLoadNotes.mockClear();
    mockBulkUpdateNotes.mockClear();
    mockUpdateSynthConfig.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('readOnly=true blocks note creation — onNoteCreate does not invoke createNote', () => {
    fc.assert(
      fc.property(noteArb, (note) => {
        mockCreateNote.mockClear();
        cleanup();

        render(
          React.createElement(MelodyEditor, {
            readOnly: true,
            onStateChange,
          })
        );

        act(() => {
          const onNoteCreate = capturedPianoRollProps.onNoteCreate as (n: Note) => void;
          onNoteCreate?.(note);
        });

        expect(mockCreateNote).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  it('readOnly=true blocks note update — onNoteUpdate does not invoke updateNote', () => {
    fc.assert(
      fc.property(noteArb, (note) => {
        mockUpdateNote.mockClear();
        cleanup();

        render(
          React.createElement(MelodyEditor, {
            readOnly: true,
            onStateChange,
          })
        );

        act(() => {
          const onNoteUpdate = capturedPianoRollProps.onNoteUpdate as (n: Note) => void;
          onNoteUpdate?.(note);
        });

        expect(mockUpdateNote).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  it('readOnly=true blocks note deletion — onNoteDelete does not invoke deleteNote', () => {
    fc.assert(
      fc.property(noteArb, (note) => {
        mockDeleteNote.mockClear();
        cleanup();

        render(
          React.createElement(MelodyEditor, {
            readOnly: true,
            onStateChange,
          })
        );

        act(() => {
          const onNoteDelete = capturedPianoRollProps.onNoteDelete as (id: string) => void;
          onNoteDelete?.(note.id);
        });

        expect(mockDeleteNote).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  it('readOnly=true hides clear-all button so clearNotes cannot be triggered via UI', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        mockClearNotes.mockClear();
        cleanup();

        const { container } = render(
          React.createElement(MelodyEditor, {
            readOnly: true,
            onStateChange,
          })
        );

        // The clear-all button should not exist in the DOM when readOnly=true
        const clearButton = container.querySelector('button[title="Clear all notes"]');
        expect(clearButton).toBeNull();
        expect(mockClearNotes).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  it('readOnly=true blocks synth config change — onChange does not invoke updateConfig', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('sine', 'square', 'sawtooth', 'triangle') as fc.Arbitrary<string>,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (oscillatorType, volume) => {
          mockUpdateSynthConfig.mockClear();
          cleanup();

          render(
            React.createElement(MelodyEditor, {
              readOnly: true,
              onStateChange,
            })
          );

          act(() => {
            const onChange = capturedSynthControlsProps.onChange as (config: Partial<SynthesizerConfig>) => void;
            onChange?.({ oscillatorType: oscillatorType as SynthesizerConfig['oscillatorType'], volume });
          });

          expect(mockUpdateSynthConfig).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('readOnly=true blocks MIDI import — loadNotes function is a no-op', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 1, maxLength: 10 }),
        tempoArb,
        (importNotes, importTempo) => {
          mockLoadNotes.mockClear();
          cleanup();

          let loadNotesFn: ((notes: Note[], tempo?: number) => void) | null = null;

          render(
            React.createElement(MelodyEditor, {
              readOnly: true,
              onStateChange,
              onMidiImport: (fn: (notes: Note[], tempo?: number) => void) => {
                loadNotesFn = fn;
              },
            })
          );

          expect(loadNotesFn).not.toBeNull();

          act(() => {
            loadNotesFn?.(importNotes, importTempo);
          });

          expect(mockLoadNotes).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('readOnly=true blocks bulk note updates — onBulkNoteUpdate does not invoke bulkUpdateNotes', () => {
    fc.assert(
      fc.property(noteArb, (note) => {
        mockBulkUpdateNotes.mockClear();
        cleanup();

        render(
          React.createElement(MelodyEditor, {
            readOnly: true,
            onStateChange,
          })
        );

        act(() => {
          const onBulkNoteUpdate = capturedPianoRollProps.onBulkNoteUpdate as (updates: Map<string, Partial<Note>>) => void;
          const updates = new Map([[note.id, { pitch: note.pitch }]]);
          onBulkNoteUpdate?.(updates);
        });

        expect(mockBulkUpdateNotes).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  it('readOnly=true blocks tempo change — onTempoChange is a no-op', () => {
    fc.assert(
      fc.property(tempoArb, (newTempo) => {
        onStateChange.mockClear();
        cleanup();

        render(
          React.createElement(MelodyEditor, {
            readOnly: true,
            initialTempo: 120,
            onStateChange,
          })
        );

        onStateChange.mockClear();

        act(() => {
          const onTempoChange = capturedSynthControlsProps.onTempoChange as (tempo: number) => void;
          onTempoChange?.(newTempo);
        });

        // When readOnly is true, the handleTempoChange returns early
        // so onStateChange should NOT be called for the tempo change
        expect(onStateChange).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: melody-editor-refactor, Property 7: Dirty State Fires on Any Mutation', () => {
  /**
   * Validates: Requirements 8.1, 8.2, 8.3
   *
   * For any mutation operation (note create, note update, note delete, clear all,
   * MIDI import, synth config change, tempo change), `onDirtyStateChange` SHALL
   * be invoked with `true` after the operation completes.
   */

  let onDirtyStateChange: ReturnType<typeof vi.fn<(isDirty: boolean) => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    currentMockNotes = [];
    currentMockSynthConfig = { ...DEFAULT_SYNTH_CONFIG_MOCK };
    onDirtyStateChange = vi.fn<(isDirty: boolean) => void>();
    capturedPianoRollProps = {};
    capturedSynthControlsProps = {};
    mockCreateNote.mockClear();
    mockUpdateNote.mockClear();
    mockDeleteNote.mockClear();
    mockClearNotes.mockClear();
    mockLoadNotes.mockClear();
    mockBulkUpdateNotes.mockClear();
    mockUpdateSynthConfig.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('onDirtyStateChange(true) fires after tempo change via onTempoChange', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 300 }).filter(t => t !== 120),  // Exclude initial tempo
        (newTempo) => {
          onDirtyStateChange.mockClear();
          cleanup();

          render(
            React.createElement(MelodyEditor, {
              readOnly: false,
              initialTempo: 120,
              onDirtyStateChange,
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          onDirtyStateChange.mockClear();

          // Perform tempo change
          act(() => {
            const onTempoChange = capturedSynthControlsProps.onTempoChange as (tempo: number) => void;
            onTempoChange?.(newTempo);
          });

          // The MelodyEditor tracks tempo changes and should fire dirty state
          expect(onDirtyStateChange).toHaveBeenCalledWith(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('onDirtyStateChange(true) fires after MIDI import replaces notes', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 1, maxLength: 5 }),
        (importNotes) => {
          onDirtyStateChange.mockClear();
          cleanup();
          currentMockNotes = [];

          // Track notes state changes through mock
          mockLoadNotes.mockImplementation((notes: Note[]) => {
            currentMockNotes = notes;
          });

          let loadNotesFn: ((notes: Note[], tempo?: number) => void) | null = null;

          const { rerender } = render(
            React.createElement(MelodyEditor, {
              readOnly: false,
              onDirtyStateChange,
              onMidiImport: (fn: (notes: Note[], tempo?: number) => void) => {
                loadNotesFn = fn;
              },
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          onDirtyStateChange.mockClear();

          // Perform MIDI import
          act(() => {
            loadNotesFn?.(importNotes);
          });

          // The usePianoRoll mock's loadNotes updates currentMockNotes.
          // Re-render to simulate the notes state change that would
          // normally happen in the real hook.
          rerender(
            React.createElement(MelodyEditor, {
              readOnly: false,
              onDirtyStateChange,
              onMidiImport: (fn: (notes: Note[], tempo?: number) => void) => {
                loadNotesFn = fn;
              },
            })
          );

          act(() => {
            vi.runAllTimers();
          });

          expect(onDirtyStateChange).toHaveBeenCalledWith(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('onDirtyStateChange(true) fires after synth config change', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        (newVolume) => {
          onDirtyStateChange.mockClear();
          cleanup();
          currentMockNotes = [];
          currentMockSynthConfig = { ...DEFAULT_SYNTH_CONFIG_MOCK };

          // Make updateConfig mutate the currentMockSynthConfig so re-render picks it up
          mockUpdateSynthConfig.mockImplementation((partial: Partial<SynthesizerConfig>) => {
            currentMockSynthConfig = { ...currentMockSynthConfig, ...partial };
          });

          const { rerender } = render(
            React.createElement(MelodyEditor, {
              readOnly: false,
              onDirtyStateChange,
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          onDirtyStateChange.mockClear();

          // Perform synth config change
          act(() => {
            const onChange = capturedSynthControlsProps.onChange as (config: Partial<SynthesizerConfig>) => void;
            onChange?.({ volume: newVolume });
          });

          // Re-render with updated config to simulate state propagation
          rerender(
            React.createElement(MelodyEditor, {
              readOnly: false,
              onDirtyStateChange,
            })
          );

          act(() => {
            vi.runAllTimers();
          });

          // If volume actually changed from default (0.8), dirty should fire
          if (newVolume !== 0.8) {
            expect(onDirtyStateChange).toHaveBeenCalledWith(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('onDirtyStateChange(true) fires after note operations (create/update/delete/clear)', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 1, maxLength: 5 }),
        (newNotes) => {
          onDirtyStateChange.mockClear();
          cleanup();
          currentMockNotes = [];

          const { rerender } = render(
            React.createElement(MelodyEditor, {
              readOnly: false,
              onDirtyStateChange,
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          onDirtyStateChange.mockClear();

          // Simulate notes changing (as would happen after any note mutation)
          currentMockNotes = newNotes;

          // Re-render to reflect updated notes state from the mock hook
          rerender(
            React.createElement(MelodyEditor, {
              readOnly: false,
              onDirtyStateChange,
            })
          );

          act(() => {
            vi.runAllTimers();
          });

          // The notes reference changed, so dirty state should fire
          expect(onDirtyStateChange).toHaveBeenCalledWith(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
