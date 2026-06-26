/**
 * @vitest-environment jsdom
 */

/**
 * Property-Based Tests for MelodyEditor Initialization and State Callbacks
 *
 * Feature: melody-editor-refactor
 * Property 1: Initialization Preserves Provided State
 * Property 2: State Change Callback Fires on Any Mutation
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 9.4
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import * as fc from 'fast-check';
import type { Note, SynthesizerConfig } from '../../types';
import type { EditorState } from '../../components/MelodyEditor/types';

// ============================================================================
// Mocks
// ============================================================================

// Mock the SynthesizerEngine to avoid Tone.js dependency
class MockSynthesizerEngine {
  configure = vi.fn();
  setTempo = vi.fn();
  dispose = vi.fn();
  triggerNote = vi.fn();
  scheduleNotes = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  pause = vi.fn();
  play = vi.fn();
  onPlayheadUpdate = vi.fn();
  offPlayheadUpdate = vi.fn();
}

vi.mock('../../lib/synthesizer', () => ({
  SynthesizerEngine: MockSynthesizerEngine,
}));

// Mock tone module
vi.mock('tone', () => ({
  getContext: vi.fn(() => ({ state: 'running' })),
  start: vi.fn(),
  getTransport: vi.fn(() => ({
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
  })),
  Transport: {
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    position: 0,
    seconds: 0,
  },
  Synth: vi.fn(),
  PolySynth: vi.fn(),
}));

// Mock the components used by MelodyEditor to avoid complex rendering
vi.mock('../../components', () => ({
  PianoRollCanvas: () => null,
  TransportControls: () => null,
  SynthControls: () => null,
  GridSnapControls: () => null,
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  FullscreenToggle: () => null,
}));

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid Note with constrained fields.
 */
const noteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  pitch: fc.integer({ min: 0, max: 127 }),
  start: fc.double({ min: 0, max: 100, noNaN: true }),
  duration: fc.double({ min: 0.001, max: 10, noNaN: true }),
  velocity: fc.double({ min: 0, max: 1, noNaN: true }),
});

/**
 * Generate a valid array of notes (0-20 notes for practical test runs).
 */
const notesArrayArb: fc.Arbitrary<Note[]> = fc.array(noteArb, { minLength: 0, maxLength: 20 });

/**
 * Generate a valid SynthesizerConfig.
 */
const synthConfigArb: fc.Arbitrary<SynthesizerConfig> = fc.record({
  oscillatorType: fc.constantFrom('sine' as const, 'square' as const, 'sawtooth' as const, 'triangle' as const),
  volume: fc.double({ min: 0, max: 1, noNaN: true }),
  envelope: fc.record({
    attack: fc.double({ min: 0, max: 2, noNaN: true }),
    decay: fc.double({ min: 0, max: 2, noNaN: true }),
    sustain: fc.double({ min: 0, max: 1, noNaN: true }),
    release: fc.double({ min: 0, max: 5, noNaN: true }),
  }),
  filter: fc.record({
    enabled: fc.boolean(),
    type: fc.constantFrom('lowpass' as const, 'highpass' as const),
    frequency: fc.double({ min: 20, max: 20000, noNaN: true }),
  }),
  effects: fc.record({
    reverb: fc.record({
      enabled: fc.boolean(),
      roomSize: fc.double({ min: 0, max: 1, noNaN: true }),
      wetDry: fc.double({ min: 0, max: 1, noNaN: true }),
    }),
    delay: fc.record({
      enabled: fc.boolean(),
      time: fc.double({ min: 0, max: 1, noNaN: true }),
      feedback: fc.double({ min: 0, max: 0.9, noNaN: true }),
      wetDry: fc.double({ min: 0, max: 1, noNaN: true }),
    }),
    chorus: fc.record({
      enabled: fc.boolean(),
      rate: fc.double({ min: 0.1, max: 10, noNaN: true }),
      depth: fc.double({ min: 0, max: 1, noNaN: true }),
      wetDry: fc.double({ min: 0, max: 1, noNaN: true }),
    }),
    flanger: fc.record({
      enabled: fc.boolean(),
      rate: fc.double({ min: 0.1, max: 10, noNaN: true }),
      depth: fc.double({ min: 0, max: 1, noNaN: true }),
      feedback: fc.double({ min: 0, max: 0.9, noNaN: true }),
      wetDry: fc.double({ min: 0, max: 1, noNaN: true }),
    }),
  }),
  presetName: fc.constant(null),
});

/**
 * Generate a valid tempo in the range [20, 300].
 */
const tempoArb: fc.Arbitrary<number> = fc.integer({ min: 20, max: 300 });

// ============================================================================
// Test helpers
// ============================================================================

/**
 * Import the MelodyEditor component dynamically to allow mock setup.
 */
async function importMelodyEditor() {
  const mod = await import('../../components/MelodyEditor/MelodyEditor');
  return mod.MelodyEditor;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Feature: melody-editor-refactor, Property 1: Initialization Preserves Provided State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('for any valid initial notes, synth config, and tempo in [20, 300], the first onStateChange emission SHALL contain those exact values', async () => {
    const MelodyEditor = await importMelodyEditor();
    const { createElement } = await import('react');
    const { render } = await import('@testing-library/react');

    await fc.assert(
      fc.asyncProperty(
        notesArrayArb,
        synthConfigArb,
        tempoArb,
        async (notes, synthConfig, tempo) => {
          const onStateChange = vi.fn();

          const { unmount } = render(
            createElement(MelodyEditor, {
              initialNotes: notes,
              initialSynthConfig: synthConfig,
              initialTempo: tempo,
              onStateChange,
            })
          );

          // The component fires initial onStateChange in a setTimeout(0)
          await act(async () => {
            vi.advanceTimersByTime(10);
          });

          // Verify onStateChange was called at least once
          expect(onStateChange).toHaveBeenCalled();

          // Get the first emission
          const firstEmission: EditorState = onStateChange.mock.calls[0][0];

          // Notes should match by deep equality
          expect(firstEmission.notes).toEqual(notes);

          // SynthConfig should match by deep equality
          expect(firstEmission.synthConfig).toEqual(synthConfig);

          // Tempo should match by value equality
          expect(firstEmission.tempo).toBe(tempo);

          unmount();
          onStateChange.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 2.1, 2.2, 2.3
   */
  it('tempo is clamped to [20, 300] and defaults to 120 when omitted', async () => {
    const MelodyEditor = await importMelodyEditor();
    const { createElement } = await import('react');
    const { render } = await import('@testing-library/react');

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.integer({ min: -1000, max: 19 }),
          fc.integer({ min: 301, max: 10000 }),
          fc.constant(undefined as number | undefined)
        ),
        async (outOfRangeTempo) => {
          const onStateChange = vi.fn();

          const { unmount } = render(
            createElement(MelodyEditor, {
              initialTempo: outOfRangeTempo,
              onStateChange,
            })
          );

          await act(async () => {
            vi.advanceTimersByTime(10);
          });

          expect(onStateChange).toHaveBeenCalled();
          const firstEmission: EditorState = onStateChange.mock.calls[0][0];

          if (outOfRangeTempo === undefined) {
            // Should default to 120
            expect(firstEmission.tempo).toBe(120);
          } else if (outOfRangeTempo < 20) {
            // Should be clamped to 20
            expect(firstEmission.tempo).toBe(20);
          } else {
            // Should be clamped to 300
            expect(firstEmission.tempo).toBe(300);
          }

          unmount();
          onStateChange.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: melody-editor-refactor, Property 2: State Change Callback Fires on Any Mutation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /**
   * Validates: Requirements 2.4, 9.4
   *
   * For any mutation operation, the onStateChange callback SHALL be invoked
   * with an EditorState object reflecting the new state.
   */
  it('onStateChange fires after MIDI import (loadNotes) with the new state', async () => {
    const MelodyEditor = await importMelodyEditor();
    const { createElement } = await import('react');
    const { render } = await import('@testing-library/react');

    await fc.assert(
      fc.asyncProperty(
        notesArrayArb,
        tempoArb,
        async (importedNotes, importedTempo) => {
          const onStateChange = vi.fn();
          let loadNotesFn: ((notes: Note[], tempo?: number) => void) | null = null;

          const onMidiImport = vi.fn((fn) => {
            loadNotesFn = fn;
          });

          const { unmount } = render(
            createElement(MelodyEditor, {
              initialNotes: [],
              initialTempo: 120,
              onStateChange,
              onMidiImport,
              allowMidiImport: true,
            })
          );

          // Wait for initialization
          await act(async () => {
            vi.advanceTimersByTime(10);
          });

          // Clear previous calls from initialization
          onStateChange.mockClear();

          // Perform MIDI import mutation
          expect(loadNotesFn).not.toBeNull();
          act(() => {
            loadNotesFn!(importedNotes, importedTempo);
          });

          // Advance timers to allow React effects to fire
          await act(async () => {
            vi.advanceTimersByTime(10);
          });

          // If notes were imported (non-empty or different from initial),
          // onStateChange should have been called
          if (importedNotes.length > 0 || importedTempo !== 120) {
            expect(onStateChange).toHaveBeenCalled();

            // Get the last emission to verify it reflects the new state
            const lastCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
            expect(lastCall).toHaveProperty('notes');
            expect(lastCall).toHaveProperty('synthConfig');
            expect(lastCall).toHaveProperty('tempo');

            // Tempo should be the imported tempo (clamped)
            if (importedTempo !== undefined) {
              const expectedTempo = Math.max(20, Math.min(300, importedTempo));
              expect(lastCall.tempo).toBe(expectedTempo);
            }
          }

          unmount();
          onStateChange.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('onStateChange fires after tempo change with updated tempo value', async () => {
    const MelodyEditor = await importMelodyEditor();
    const { createElement } = await import('react');
    const { render } = await import('@testing-library/react');

    // We need to access the internal tempo change handler.
    // The MelodyEditor exposes tempo changes via SynthControls.
    // Since we cannot directly invoke the internal handler from outside,
    // we'll test via the loadNotes function which also changes tempo.
    await fc.assert(
      fc.asyncProperty(
        tempoArb,
        fc.integer({ min: 20, max: 300 }),
        async (initialTempo, newTempo) => {
          // Skip if tempos are the same (no mutation)
          fc.pre(initialTempo !== newTempo);

          const onStateChange = vi.fn();
          let loadNotesFn: ((notes: Note[], tempo?: number) => void) | null = null;

          const onMidiImport = vi.fn((fn) => {
            loadNotesFn = fn;
          });

          const { unmount } = render(
            createElement(MelodyEditor, {
              initialTempo,
              onStateChange,
              onMidiImport,
              allowMidiImport: true,
            })
          );

          // Wait for initialization
          await act(async () => {
            vi.advanceTimersByTime(10);
          });

          // Clear initialization calls
          onStateChange.mockClear();

          // Import notes with a new tempo to trigger tempo change
          act(() => {
            loadNotesFn!([], newTempo);
          });

          await act(async () => {
            vi.advanceTimersByTime(10);
          });

          // onStateChange should fire with the new tempo
          expect(onStateChange).toHaveBeenCalled();
          const lastCall = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
          expect(lastCall.tempo).toBe(newTempo);

          unmount();
          onStateChange.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('onStateChange fires after note import replaces existing notes', async () => {
    const MelodyEditor = await importMelodyEditor();
    const { createElement } = await import('react');
    const { render } = await import('@testing-library/react');

    await fc.assert(
      fc.asyncProperty(
        // Initial notes (at least 1)
        fc.array(noteArb, { minLength: 1, maxLength: 10 }),
        // New notes to import (different set)
        fc.array(noteArb, { minLength: 1, maxLength: 10 }),
        async (initialNotes, newNotes) => {
          const onStateChange = vi.fn();
          let loadNotesFn: ((notes: Note[], tempo?: number) => void) | null = null;

          const onMidiImport = vi.fn((fn) => {
            loadNotesFn = fn;
          });

          const { unmount } = render(
            createElement(MelodyEditor, {
              initialNotes,
              initialTempo: 120,
              onStateChange,
              onMidiImport,
              allowMidiImport: true,
            })
          );

          // Wait for initialization
          await act(async () => {
            vi.advanceTimersByTime(10);
          });

          // Clear initialization calls
          onStateChange.mockClear();

          // Perform MIDI import with new notes
          act(() => {
            loadNotesFn!(newNotes);
          });

          await act(async () => {
            vi.advanceTimersByTime(10);
          });

          // onStateChange should have fired
          expect(onStateChange).toHaveBeenCalled();

          // The emitted state should contain the new notes
          const lastCall: EditorState = onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0];
          expect(lastCall.notes).toEqual(newNotes);

          unmount();
          onStateChange.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('emitted EditorState always has correct shape (notes array, synthConfig object, tempo number)', async () => {
    const MelodyEditor = await importMelodyEditor();
    const { createElement } = await import('react');
    const { render } = await import('@testing-library/react');

    await fc.assert(
      fc.asyncProperty(
        notesArrayArb,
        synthConfigArb,
        tempoArb,
        async (notes, synthConfig, tempo) => {
          const onStateChange = vi.fn();

          const { unmount } = render(
            createElement(MelodyEditor, {
              initialNotes: notes,
              initialSynthConfig: synthConfig,
              initialTempo: tempo,
              onStateChange,
            })
          );

          await act(async () => {
            vi.advanceTimersByTime(10);
          });

          // Verify shape of every emission
          for (const call of onStateChange.mock.calls) {
            const state: EditorState = call[0];
            expect(Array.isArray(state.notes)).toBe(true);
            expect(typeof state.tempo).toBe('number');
            expect(state.synthConfig).toHaveProperty('oscillatorType');
            expect(state.synthConfig).toHaveProperty('volume');
            expect(state.synthConfig).toHaveProperty('envelope');
            expect(state.synthConfig).toHaveProperty('filter');
            expect(state.synthConfig).toHaveProperty('effects');
          }

          unmount();
          onStateChange.mockClear();
        }
      ),
      { numRuns: 100 }
    );
  });
});
