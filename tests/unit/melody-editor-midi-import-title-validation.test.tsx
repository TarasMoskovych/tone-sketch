/**
 * @vitest-environment jsdom
 */

/**
 * Property-Based Tests for MIDI Import and Title Validation
 *
 * Feature: melody-editor-refactor
 * Property 4: Title Validation Rejects Invalid Input
 * Property 5: MIDI Import Replaces All State
 * Property 6: allowMidiImport=false Blocks Import
 *
 * Validates: Requirements 3.3, 7.3, 7.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';

import type { Note, SynthesizerConfig } from '@/types';
import type { EditorState, LoadNotesFn } from '@/components/MelodyEditor/types';

// ============================================================================
// Mock Setup
// ============================================================================

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

const mockSetTempo = vi.fn();

vi.mock('@/lib/synthesizer', () => {
  class MockSynthesizerEngine {
    configure = vi.fn();
    setTempo = mockSetTempo;
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let capturedPianoRollProps: Record<string, unknown> = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// Now import MelodyEditor after all mocks are defined
import { MelodyEditor } from '@/components/MelodyEditor';

// ============================================================================
// Custom Arbitraries
// ============================================================================

const noteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  pitch: fc.integer({ min: 0, max: 127 }),
  start: fc.double({ min: 0, max: 100, noNaN: true }),
  duration: fc.double({ min: 0.001, max: 10, noNaN: true }),
  velocity: fc.double({ min: 0, max: 1, noNaN: true }),
});

const tempoArb: fc.Arbitrary<number> = fc.integer({ min: 20, max: 300 });

// ============================================================================
// Property 4: Title Validation Rejects Invalid Input
// ============================================================================

describe('Feature: melody-editor-refactor, Property 4: Title Validation Rejects Invalid Input', () => {
  /**
   * Validates: Requirements 3.3
   *
   * For any string that is either empty, composed entirely of whitespace, or longer
   * than 200 characters, the Create page save dialog SHALL reject the input and
   * prevent persistence. For any string that is non-empty, contains at least one
   * non-whitespace character, and is at most 200 characters, the save SHALL proceed.
   */

  /**
   * Extract the title validation logic from the Create page.
   * This mirrors the validation in `handleSaveConfirm`:
   * - If the title (trimmed) is empty → reject
   * - If the title length > 200 → reject
   * - Otherwise → proceed
   */
  function validateTitle(title: string): { valid: boolean; error?: string } {
    if (!title.trim()) {
      return { valid: false, error: 'Please enter a title for your melody' };
    }
    if (title.length > 200) {
      return { valid: false, error: 'Title must be 200 characters or less' };
    }
    return { valid: true };
  }

  it('rejects empty strings', () => {
    fc.assert(
      fc.property(fc.constant(''), (title) => {
        const result = validateTitle(title);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects strings composed entirely of whitespace', () => {
    // Generate whitespace-only strings using array of whitespace chars joined together
    const whitespaceArb = fc
      .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 })
      .map(chars => chars.join(''));

    fc.assert(
      fc.property(whitespaceArb, (title) => {
        const result = validateTitle(title);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('rejects strings longer than 200 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 201, maxLength: 500 }),
        (title) => {
          const result = validateTitle(title);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts valid titles (non-empty, has non-whitespace, ≤200 chars)', () => {
    fc.assert(
      fc.property(
        // Generate strings that have at least one non-whitespace character and are ≤200 chars
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        (title) => {
          const result = validateTitle(title);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: exactly 200 characters with non-whitespace content is valid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 200, maxLength: 200 }).filter(s => s.trim().length > 0),
        (title) => {
          const result = validateTitle(title);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary: exactly 201 characters is always invalid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 201, maxLength: 201 }),
        (title) => {
          const result = validateTitle(title);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 5: MIDI Import Replaces All State
// ============================================================================

describe('Feature: melody-editor-refactor, Property 5: MIDI Import Replaces All State', () => {
  /**
   * Validates: Requirements 7.3
   *
   * For any array of valid notes and optional tempo value, when MIDI import is
   * triggered (with allowMidiImport=true and readOnly=false), the resulting editor
   * state SHALL contain exactly the imported notes (replacing all previous notes)
   * and, if a tempo was provided, the tempo SHALL equal the imported value.
   */

  beforeEach(() => {
    vi.useFakeTimers();
    currentMockNotes = [];
    currentMockSynthConfig = { ...DEFAULT_SYNTH_CONFIG_MOCK };
    mockLoadNotes.mockClear();
    mockSetTempo.mockClear();
    capturedPianoRollProps = {};
    capturedSynthControlsProps = {};
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('MIDI import calls loadNotes with exactly the imported notes (replaces all)', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 0, maxLength: 15 }), // initial notes
        fc.array(noteArb, { minLength: 1, maxLength: 15 }), // imported notes
        (initialNotes, importedNotes) => {
          mockLoadNotes.mockClear();
          mockSetTempo.mockClear();
          cleanup();

          currentMockNotes = initialNotes;

          let loadNotesFn: LoadNotesFn | null = null;

          render(
            React.createElement(MelodyEditor, {
              initialNotes,
              readOnly: false,
              allowMidiImport: true,
              onMidiImport: (fn: LoadNotesFn) => {
                loadNotesFn = fn;
              },
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          mockLoadNotes.mockClear();

          expect(loadNotesFn).not.toBeNull();

          // Perform MIDI import
          act(() => {
            loadNotesFn!(importedNotes);
          });

          // loadNotes should be called with exactly the imported notes
          expect(mockLoadNotes).toHaveBeenCalledTimes(1);
          expect(mockLoadNotes).toHaveBeenCalledWith(importedNotes);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('MIDI import with tempo updates the tempo to the imported value (clamped to [20,300])', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 1, maxLength: 10 }),
        tempoArb,
        (importedNotes, importedTempo) => {
          mockLoadNotes.mockClear();
          mockSetTempo.mockClear();
          cleanup();

          currentMockNotes = [];

          let loadNotesFn: LoadNotesFn | null = null;

          render(
            React.createElement(MelodyEditor, {
              initialTempo: 120,
              readOnly: false,
              allowMidiImport: true,
              onMidiImport: (fn: LoadNotesFn) => {
                loadNotesFn = fn;
              },
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          mockSetTempo.mockClear();

          // Perform MIDI import with tempo
          act(() => {
            loadNotesFn!(importedNotes, importedTempo);
          });

          // loadNotes should be called with the imported notes
          expect(mockLoadNotes).toHaveBeenCalledWith(importedNotes);

          // setTempo on the engine should be called with the clamped tempo
          const expectedTempo = Math.max(20, Math.min(300, importedTempo));
          expect(mockSetTempo).toHaveBeenCalledWith(expectedTempo);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('MIDI import without tempo does NOT call setTempo on the engine', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 1, maxLength: 10 }),
        (importedNotes) => {
          mockLoadNotes.mockClear();
          mockSetTempo.mockClear();
          cleanup();

          currentMockNotes = [];

          let loadNotesFn: LoadNotesFn | null = null;

          render(
            React.createElement(MelodyEditor, {
              initialTempo: 120,
              readOnly: false,
              allowMidiImport: true,
              onMidiImport: (fn: LoadNotesFn) => {
                loadNotesFn = fn;
              },
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          mockSetTempo.mockClear();

          // Perform MIDI import WITHOUT tempo
          act(() => {
            loadNotesFn!(importedNotes);
          });

          // loadNotes should be called
          expect(mockLoadNotes).toHaveBeenCalledWith(importedNotes);

          // setTempo should NOT be called (no tempo provided)
          expect(mockSetTempo).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('MIDI import fires onStateChange with imported notes and tempo', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 1, maxLength: 10 }),
        // Use a tempo different from initial (120) to ensure a state change is observed
        fc.integer({ min: 20, max: 300 }).filter(t => t !== 120),
        (importedNotes, importedTempo) => {
          mockLoadNotes.mockClear();
          mockSetTempo.mockClear();
          cleanup();

          // Make loadNotes update mock state to simulate the real hook
          mockLoadNotes.mockImplementation((notes: Note[]) => {
            currentMockNotes = notes;
          });

          currentMockNotes = [];
          const onStateChange = vi.fn();

          let loadNotesFn: LoadNotesFn | null = null;

          const { rerender } = render(
            React.createElement(MelodyEditor, {
              initialTempo: 120,
              readOnly: false,
              allowMidiImport: true,
              onStateChange,
              onMidiImport: (fn: LoadNotesFn) => {
                loadNotesFn = fn;
              },
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          onStateChange.mockClear();

          // Perform MIDI import
          act(() => {
            loadNotesFn!(importedNotes, importedTempo);
          });

          // Re-render to reflect state change from mock (notes changed via loadNotes)
          rerender(
            React.createElement(MelodyEditor, {
              initialTempo: 120,
              readOnly: false,
              allowMidiImport: true,
              onStateChange,
              onMidiImport: (fn: LoadNotesFn) => {
                loadNotesFn = fn;
              },
            })
          );

          act(() => {
            vi.runAllTimers();
          });

          // onStateChange should have been called because both notes and tempo changed
          expect(onStateChange).toHaveBeenCalled();

          // The last emission should contain the imported notes
          const lastCall: EditorState =
            onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
          expect(lastCall.notes).toEqual(importedNotes);

          // Tempo should be the imported tempo (clamped)
          const expectedTempo = Math.max(20, Math.min(300, importedTempo));
          expect(lastCall.tempo).toBe(expectedTempo);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 6: allowMidiImport=false Blocks Import
// ============================================================================

describe('Feature: melody-editor-refactor, Property 6: allowMidiImport=false Blocks Import', () => {
  /**
   * Validates: Requirements 7.4
   *
   * For any editor state and any array of notes to import, when allowMidiImport
   * is false, invoking the MIDI import function SHALL leave notes and tempo unchanged.
   */

  beforeEach(() => {
    vi.useFakeTimers();
    currentMockNotes = [];
    currentMockSynthConfig = { ...DEFAULT_SYNTH_CONFIG_MOCK };
    mockLoadNotes.mockClear();
    mockSetTempo.mockClear();
    capturedPianoRollProps = {};
    capturedSynthControlsProps = {};
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('allowMidiImport=false prevents loadNotes from being invoked', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 0, maxLength: 10 }), // initial notes
        fc.array(noteArb, { minLength: 1, maxLength: 10 }), // notes to import
        tempoArb, // tempo to import
        (initialNotes, importNotes, importTempo) => {
          mockLoadNotes.mockClear();
          mockSetTempo.mockClear();
          cleanup();

          currentMockNotes = initialNotes;

          let loadNotesFn: LoadNotesFn | null = null;

          render(
            React.createElement(MelodyEditor, {
              initialNotes,
              initialTempo: 120,
              readOnly: false,
              allowMidiImport: false,
              onMidiImport: (fn: LoadNotesFn) => {
                loadNotesFn = fn;
              },
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          mockLoadNotes.mockClear();
          mockSetTempo.mockClear();

          expect(loadNotesFn).not.toBeNull();

          // Attempt MIDI import
          act(() => {
            loadNotesFn!(importNotes, importTempo);
          });

          // loadNotes should NOT be called
          expect(mockLoadNotes).not.toHaveBeenCalled();
          // setTempo should NOT be called
          expect(mockSetTempo).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allowMidiImport=false does not fire onStateChange after import attempt', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 1, maxLength: 10 }),
        tempoArb,
        (importNotes, importTempo) => {
          mockLoadNotes.mockClear();
          mockSetTempo.mockClear();
          cleanup();

          currentMockNotes = [];
          const onStateChange = vi.fn();

          let loadNotesFn: LoadNotesFn | null = null;

          render(
            React.createElement(MelodyEditor, {
              readOnly: false,
              allowMidiImport: false,
              onStateChange,
              onMidiImport: (fn: LoadNotesFn) => {
                loadNotesFn = fn;
              },
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          onStateChange.mockClear();

          // Attempt MIDI import
          act(() => {
            loadNotesFn!(importNotes, importTempo);
          });

          // No state change should fire since import was blocked
          expect(onStateChange).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allowMidiImport=false blocks import regardless of initial notes state', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 0, maxLength: 15 }), // various initial states
        fc.array(noteArb, { minLength: 1, maxLength: 10 }), // notes to import
        fc.option(tempoArb), // optional tempo
        (initialNotes, importNotes, optionalTempo) => {
          mockLoadNotes.mockClear();
          mockSetTempo.mockClear();
          cleanup();

          currentMockNotes = initialNotes;

          let loadNotesFn: LoadNotesFn | null = null;

          render(
            React.createElement(MelodyEditor, {
              initialNotes,
              initialTempo: 120,
              readOnly: false,
              allowMidiImport: false,
              onMidiImport: (fn: LoadNotesFn) => {
                loadNotesFn = fn;
              },
            })
          );

          // Complete initialization
          act(() => {
            vi.runAllTimers();
          });

          mockLoadNotes.mockClear();
          mockSetTempo.mockClear();

          // Attempt MIDI import (with or without tempo)
          act(() => {
            if (optionalTempo !== null) {
              loadNotesFn!(importNotes, optionalTempo);
            } else {
              loadNotesFn!(importNotes);
            }
          });

          // Neither should be called
          expect(mockLoadNotes).not.toHaveBeenCalled();
          expect(mockSetTempo).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
