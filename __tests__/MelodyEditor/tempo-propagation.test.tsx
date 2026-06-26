/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';

import type { SynthesizerConfig } from '@/types';

// --- Mock Setup ---

const mockSetTempo = vi.fn();
const mockConfigure = vi.fn();
const mockDispose = vi.fn();
const mockTriggerNote = vi.fn();

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
    notes: [],
    selectedNoteId: null,
    selectedNoteIds: new Set<string>(),
    selectionAnchor: null,
    visibleRegion: { startBeat: 0, endBeat: 16, startPitch: 48, endPitch: 84 },
    gridSnap: { enabled: true, division: 0.25 as const },
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    selectNote: vi.fn(),
    selectNotes: vi.fn(),
    addToSelection: vi.fn(),
    deselectNote: vi.fn(),
    toggleNoteSelection: vi.fn(),
    deselectAll: vi.fn(),
    selectAll: vi.fn(),
    clearNotes: vi.fn(),
    loadNotes: vi.fn(),
    setSelectionAnchor: vi.fn(),
    bulkUpdateNotes: vi.fn(),
    setGridSnap: vi.fn(),
    setVisibleRegion: vi.fn(),
  }),
  useSynthesizer: () => ({
    config: {
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
    } as SynthesizerConfig,
    updateConfig: vi.fn(),
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
    configure = mockConfigure;
    setTempo = mockSetTempo;
    dispose = mockDispose;
    triggerNote = mockTriggerNote;
    constructor() {
      // no-op
    }
  }
  return {
    SynthesizerEngine: MockSynthesizerEngine,
  };
});

// Store refs to props passed to mocked child components
let capturedSynthControlsProps: Record<string, unknown> = {};

vi.mock('@/components', () => ({
  PianoRollCanvas: () => React.createElement('div', { 'data-testid': 'piano-roll-canvas' }),
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

// Import MelodyEditor after mocks are set up
import { MelodyEditor } from '@/components/MelodyEditor';

// --- Tests ---

describe('Feature: melody-editor-refactor, Property 8: Tempo Change Propagates to Engine', () => {
  /**
   * **Validates: Requirements 9.2**
   *
   * For any valid tempo value in [20, 300], when the user changes the tempo
   * via SynthControls, the SynthesizerEngine's `setTempo` method SHALL be
   * called with exactly that tempo value.
   */

  beforeEach(() => {
    mockSetTempo.mockClear();
    mockConfigure.mockClear();
    mockDispose.mockClear();
    mockTriggerNote.mockClear();
    capturedSynthControlsProps = {};
  });

  afterEach(() => {
    cleanup();
  });

  it('for any valid tempo in [20, 300], onTempoChange propagates to engine.setTempo with that exact value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 300 }),
        (newTempo) => {
          mockSetTempo.mockClear();
          cleanup();

          render(
            React.createElement(MelodyEditor, {
              readOnly: false,
              initialTempo: 120,
            })
          );

          // Clear setTempo calls from engine initialization (constructor sets tempo once)
          mockSetTempo.mockClear();

          // Invoke the onTempoChange prop that SynthControls received
          act(() => {
            const onTempoChange = capturedSynthControlsProps.onTempoChange as (tempo: number) => void;
            onTempoChange(newTempo);
          });

          // The engine's setTempo should have been called with exactly the provided tempo
          expect(mockSetTempo).toHaveBeenCalledTimes(1);
          expect(mockSetTempo).toHaveBeenCalledWith(newTempo);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tempo values at boundary [20] and [300] propagate correctly to engine', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(20, 300),
        (boundaryTempo) => {
          mockSetTempo.mockClear();
          cleanup();

          render(
            React.createElement(MelodyEditor, {
              readOnly: false,
              initialTempo: 120,
            })
          );

          mockSetTempo.mockClear();

          act(() => {
            const onTempoChange = capturedSynthControlsProps.onTempoChange as (tempo: number) => void;
            onTempoChange(boundaryTempo);
          });

          expect(mockSetTempo).toHaveBeenCalledTimes(1);
          expect(mockSetTempo).toHaveBeenCalledWith(boundaryTempo);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('tempo values outside [20, 300] are clamped before propagating to engine', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 19 }),  // Below range
          fc.integer({ min: 301, max: 10000 })  // Above range
        ),
        (outOfRangeTempo) => {
          mockSetTempo.mockClear();
          cleanup();

          render(
            React.createElement(MelodyEditor, {
              readOnly: false,
              initialTempo: 120,
            })
          );

          mockSetTempo.mockClear();

          act(() => {
            const onTempoChange = capturedSynthControlsProps.onTempoChange as (tempo: number) => void;
            onTempoChange(outOfRangeTempo);
          });

          // The clamped value should be passed to setTempo
          const expectedClamped = Math.max(20, Math.min(300, outOfRangeTempo));
          expect(mockSetTempo).toHaveBeenCalledTimes(1);
          expect(mockSetTempo).toHaveBeenCalledWith(expectedClamped);
        }
      ),
      { numRuns: 100 }
    );
  });
});
