/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { renderHook, act } from '@testing-library/react';
import { useCopyPaste } from '../../hooks/useCopyPaste';
import type { Note } from '../../types/note';
import type { GridSnapConfig, GridDivision } from '../../types/grid';

// --- Custom Arbitraries ---

const gridDivisionArb: fc.Arbitrary<GridDivision> = fc.constantFrom(
  1,
  0.5,
  0.25,
  0.125,
  0.0625
);

const gridSnapArb: fc.Arbitrary<GridSnapConfig> = fc.record({
  enabled: fc.boolean(),
  division: gridDivisionArb,
});

const noteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  pitch: fc.integer({ min: 0, max: 127 }),
  start: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
  duration: fc.double({ min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true }),
  velocity: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
});

const notesArb = fc.array(noteArb, { minLength: 1, maxLength: 20 });

// --- Helper to render the hook with given props ---

function renderCopyPasteHook(overrides: {
  notes?: Note[];
  selectedNoteIds?: Set<string>;
  playheadPosition?: number;
  gridSnap?: GridSnapConfig;
}) {
  const onNotesCreated = vi.fn();
  const onNotesDeleted = vi.fn();
  const onSelectionChanged = vi.fn();

  const props = {
    notes: overrides.notes ?? [],
    selectedNoteIds: overrides.selectedNoteIds ?? new Set<string>(),
    playheadPosition: overrides.playheadPosition ?? 0,
    gridSnap: overrides.gridSnap ?? { enabled: false, division: 0.25 as GridDivision },
    onNotesCreated,
    onNotesDeleted,
    onSelectionChanged,
  };

  const { result } = renderHook(() => useCopyPaste(props));

  return { result, onNotesCreated, onNotesDeleted, onSelectionChanged };
}

// =============================================================================
// Property 2: No-op when selection is empty
// =============================================================================

/**
 * Feature: copy-paste-notes, Property 2: No-op when selection is empty
 *
 * *For any* clipboard state and note state, triggering copy, cut, or duplicate
 * with an empty selection SHALL leave the clipboard contents, notes array, and
 * selection unchanged. Similarly, triggering paste with an empty clipboard SHALL
 * leave notes and selection unchanged.
 *
 * **Validates: Requirements 1.2, 2.2, 3.6, 4.6**
 */
describe('Property 2: No-op when selection is empty', () => {
  it('copy with empty selection does not change clipboard or fire callbacks', () => {
    fc.assert(
      fc.property(notesArb, gridSnapArb, (notes, gridSnap) => {
        const { result, onNotesCreated, onNotesDeleted, onSelectionChanged } =
          renderCopyPasteHook({
            notes,
            selectedNoteIds: new Set(),
            gridSnap,
          });

        act(() => {
          result.current.copy();
        });

        expect(onNotesCreated).not.toHaveBeenCalled();
        expect(onNotesDeleted).not.toHaveBeenCalled();
        expect(onSelectionChanged).not.toHaveBeenCalled();
        expect(result.current.hasClipboardContent).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('cut with empty selection does not delete notes or change selection', () => {
    fc.assert(
      fc.property(notesArb, gridSnapArb, (notes, gridSnap) => {
        const { result, onNotesCreated, onNotesDeleted, onSelectionChanged } =
          renderCopyPasteHook({
            notes,
            selectedNoteIds: new Set(),
            gridSnap,
          });

        act(() => {
          result.current.cut();
        });

        expect(onNotesCreated).not.toHaveBeenCalled();
        expect(onNotesDeleted).not.toHaveBeenCalled();
        expect(onSelectionChanged).not.toHaveBeenCalled();
        expect(result.current.hasClipboardContent).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('duplicate with empty selection does not create notes or change selection', () => {
    fc.assert(
      fc.property(notesArb, gridSnapArb, (notes, gridSnap) => {
        const { result, onNotesCreated, onNotesDeleted, onSelectionChanged } =
          renderCopyPasteHook({
            notes,
            selectedNoteIds: new Set(),
            gridSnap,
          });

        act(() => {
          result.current.duplicate();
        });

        expect(onNotesCreated).not.toHaveBeenCalled();
        expect(onNotesDeleted).not.toHaveBeenCalled();
        expect(onSelectionChanged).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  it('paste with empty clipboard does not create notes or change selection', () => {
    fc.assert(
      fc.property(
        notesArb,
        gridSnapArb,
        fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (notes, gridSnap, playheadPosition) => {
          const { result, onNotesCreated, onNotesDeleted, onSelectionChanged } =
            renderCopyPasteHook({
              notes,
              selectedNoteIds: new Set(),
              playheadPosition,
              gridSnap,
            });

          // Clipboard is empty by default, try to paste
          act(() => {
            result.current.paste();
          });

          expect(onNotesCreated).not.toHaveBeenCalled();
          expect(onNotesDeleted).not.toHaveBeenCalled();
          expect(onSelectionChanged).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// Property 3: Cut removes selected notes and clears selection
// =============================================================================

/**
 * Feature: copy-paste-notes, Property 3: Cut removes selected notes and clears selection
 *
 * *For any* set of selected notes, after a cut operation, the piano roll's note
 * array SHALL NOT contain any of the previously selected notes, AND the selection
 * SHALL be empty, AND the clipboard SHALL contain the normalized note data.
 *
 * **Validates: Requirements 2.1, 2.3**
 */
describe('Property 3: Cut removes selected notes and clears selection', () => {
  it('cut calls onNotesDeleted with selected IDs', () => {
    fc.assert(
      fc.property(notesArb, gridSnapArb, (notes, gridSnap) => {
        const selectedIds = new Set(notes.map((n) => n.id));

        const { result, onNotesDeleted } = renderCopyPasteHook({
          notes,
          selectedNoteIds: selectedIds,
          gridSnap,
        });

        act(() => {
          result.current.cut();
        });

        expect(onNotesDeleted).toHaveBeenCalledTimes(1);
        const deletedIds = onNotesDeleted.mock.calls[0][0] as string[];
        expect(new Set(deletedIds)).toEqual(selectedIds);
      }),
      { numRuns: 100 }
    );
  });

  it('cut calls onSelectionChanged with empty array', () => {
    fc.assert(
      fc.property(notesArb, gridSnapArb, (notes, gridSnap) => {
        const selectedIds = new Set(notes.map((n) => n.id));

        const { result, onSelectionChanged } = renderCopyPasteHook({
          notes,
          selectedNoteIds: selectedIds,
          gridSnap,
        });

        act(() => {
          result.current.cut();
        });

        expect(onSelectionChanged).toHaveBeenCalledTimes(1);
        expect(onSelectionChanged).toHaveBeenCalledWith([]);
      }),
      { numRuns: 100 }
    );
  });

  it('cut stores clipboard data (hasClipboardContent becomes true)', () => {
    fc.assert(
      fc.property(notesArb, gridSnapArb, (notes, gridSnap) => {
        const selectedIds = new Set(notes.map((n) => n.id));

        const { result } = renderCopyPasteHook({
          notes,
          selectedNoteIds: selectedIds,
          gridSnap,
        });

        act(() => {
          result.current.cut();
        });

        expect(result.current.hasClipboardContent).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// Property 7: Paste and duplicate select only new notes
// =============================================================================

/**
 * Feature: copy-paste-notes, Property 7: Paste and duplicate select only new notes
 *
 * *For any* paste or duplicate operation that creates N new notes, the resulting
 * selection SHALL contain exactly those N note IDs and no others.
 *
 * **Validates: Requirements 3.7, 4.5**
 */
describe('Property 7: Paste and duplicate select only new notes', () => {
  it('after paste, onSelectionChanged is called with exactly the new note IDs', () => {
    fc.assert(
      fc.property(
        notesArb,
        gridSnapArb,
        fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (notes, gridSnap, playheadPosition) => {
          const selectedIds = new Set(notes.map((n) => n.id));

          const onNotesCreated = vi.fn();
          const onSelectionChanged = vi.fn();

          const props = {
            notes,
            selectedNoteIds: selectedIds,
            playheadPosition,
            gridSnap,
            onNotesCreated,
            onNotesDeleted: vi.fn(),
            onSelectionChanged,
          };

          const { result } = renderHook(() => useCopyPaste(props));

          // First copy to fill clipboard
          act(() => {
            result.current.copy();
          });

          // Then paste
          act(() => {
            result.current.paste();
          });

          expect(onNotesCreated).toHaveBeenCalledTimes(1);
          expect(onSelectionChanged).toHaveBeenCalledTimes(1);

          const createdNotes = onNotesCreated.mock.calls[0][0] as Note[];
          const selectedNoteIds = onSelectionChanged.mock.calls[0][0] as string[];

          // Selection should contain exactly the new note IDs
          expect(selectedNoteIds.length).toBe(createdNotes.length);
          expect(new Set(selectedNoteIds)).toEqual(
            new Set(createdNotes.map((n) => n.id))
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after duplicate, onSelectionChanged is called with exactly the new note IDs', () => {
    fc.assert(
      fc.property(notesArb, gridSnapArb, (notes, gridSnap) => {
        const selectedIds = new Set(notes.map((n) => n.id));

        const onNotesCreated = vi.fn();
        const onSelectionChanged = vi.fn();

        const props = {
          notes,
          selectedNoteIds: selectedIds,
          playheadPosition: 0,
          gridSnap,
          onNotesCreated,
          onNotesDeleted: vi.fn(),
          onSelectionChanged,
        };

        const { result } = renderHook(() => useCopyPaste(props));

        act(() => {
          result.current.duplicate();
        });

        expect(onNotesCreated).toHaveBeenCalledTimes(1);
        expect(onSelectionChanged).toHaveBeenCalledTimes(1);

        const createdNotes = onNotesCreated.mock.calls[0][0] as Note[];
        const selectedNoteIds = onSelectionChanged.mock.calls[0][0] as string[];

        expect(selectedNoteIds.length).toBe(createdNotes.length);
        expect(new Set(selectedNoteIds)).toEqual(
          new Set(createdNotes.map((n) => n.id))
        );
      }),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// Property 8: Multiple pastes from same clipboard
// =============================================================================

/**
 * Feature: copy-paste-notes, Property 8: Multiple pastes from same clipboard
 *
 * *For any* clipboard state, performing N consecutive paste operations SHALL each
 * produce a valid set of new notes from the same clipboard data, and the clipboard
 * SHALL remain unchanged after each paste.
 *
 * **Validates: Requirements 3.8**
 */
describe('Property 8: Multiple pastes from same clipboard', () => {
  it('performing N consecutive pastes each produces valid notes with different IDs', () => {
    fc.assert(
      fc.property(
        notesArb,
        gridSnapArb,
        fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 2, max: 5 }),
        (notes, gridSnap, playheadPosition, pasteCount) => {
          const selectedIds = new Set(notes.map((n) => n.id));

          const onNotesCreated = vi.fn();
          const onSelectionChanged = vi.fn();

          const props = {
            notes,
            selectedNoteIds: selectedIds,
            playheadPosition,
            gridSnap,
            onNotesCreated,
            onNotesDeleted: vi.fn(),
            onSelectionChanged,
          };

          const { result } = renderHook(() => useCopyPaste(props));

          // Copy first
          act(() => {
            result.current.copy();
          });

          // Paste N times
          for (let i = 0; i < pasteCount; i++) {
            act(() => {
              result.current.paste();
            });
          }

          // Each paste should have been called
          expect(onNotesCreated).toHaveBeenCalledTimes(pasteCount);

          // Clipboard should remain available after all pastes
          expect(result.current.hasClipboardContent).toBe(true);

          // Each paste produces the same number of notes
          const allCreatedNotes: Note[][] = [];
          for (let i = 0; i < pasteCount; i++) {
            allCreatedNotes.push(onNotesCreated.mock.calls[i][0] as Note[]);
          }

          for (const batch of allCreatedNotes) {
            expect(batch.length).toBe(notes.length);
          }

          // All IDs across all pastes should be unique
          const allIds = allCreatedNotes.flatMap((batch) =>
            batch.map((n) => n.id)
          );
          expect(new Set(allIds).size).toBe(allIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clipboard remains unchanged after each paste', () => {
    fc.assert(
      fc.property(
        notesArb,
        gridSnapArb,
        fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (notes, gridSnap, playheadPosition) => {
          const selectedIds = new Set(notes.map((n) => n.id));

          const onNotesCreated = vi.fn();

          const props = {
            notes,
            selectedNoteIds: selectedIds,
            playheadPosition,
            gridSnap,
            onNotesCreated,
            onNotesDeleted: vi.fn(),
            onSelectionChanged: vi.fn(),
          };

          const { result } = renderHook(() => useCopyPaste(props));

          // Copy
          act(() => {
            result.current.copy();
          });

          // Paste twice
          act(() => {
            result.current.paste();
          });
          act(() => {
            result.current.paste();
          });

          // Both pastes should produce notes with same structure (pitch, duration, velocity)
          const firstPaste = onNotesCreated.mock.calls[0][0] as Note[];
          const secondPaste = onNotesCreated.mock.calls[1][0] as Note[];

          expect(firstPaste.length).toBe(secondPaste.length);

          for (let i = 0; i < firstPaste.length; i++) {
            expect(firstPaste[i].pitch).toBe(secondPaste[i].pitch);
            expect(firstPaste[i].duration).toBe(secondPaste[i].duration);
            expect(firstPaste[i].velocity).toBe(secondPaste[i].velocity);
            expect(firstPaste[i].start).toBe(secondPaste[i].start);
            // IDs must differ
            expect(firstPaste[i].id).not.toBe(secondPaste[i].id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// =============================================================================
// Property 10: Clipboard independence (deep copy)
// =============================================================================

/**
 * Feature: copy-paste-notes, Property 10: Clipboard independence (deep copy)
 *
 * *For any* set of notes that are copied to the clipboard, subsequent modifications
 * (move, resize, delete) to the original notes SHALL NOT affect the clipboard
 * contents. Pasting after modifications SHALL produce notes matching the values
 * at copy time.
 *
 * **Validates: Requirements 5.1**
 */
describe('Property 10: Clipboard independence (deep copy)', () => {
  it('after copy, modifying original notes does not affect pasted output', () => {
    // Use notes with duration large enough to never be clamped by grid snap
    const safeNoteArb: fc.Arbitrary<Note> = fc.record({
      id: fc.uuid(),
      pitch: fc.integer({ min: 0, max: 127 }),
      start: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
      duration: fc.double({ min: 1, max: 50, noNaN: true, noDefaultInfinity: true }),
      velocity: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
    });
    const safeNotesArb = fc.array(safeNoteArb, { minLength: 1, maxLength: 10 });

    fc.assert(
      fc.property(
        safeNotesArb,
        gridSnapArb,
        fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        (originalNotes, gridSnap, playheadPosition) => {
          // Record the values at copy time BEFORE anything happens
          const valuesAtCopyTime = originalNotes.map((n) => ({
            pitch: n.pitch,
            duration: n.duration,
            velocity: n.velocity,
          }));

          const selectedIds = new Set(originalNotes.map((n) => n.id));

          const onNotesCreated = vi.fn();

          const props = {
            notes: originalNotes,
            selectedNoteIds: selectedIds,
            playheadPosition,
            gridSnap,
            onNotesCreated,
            onNotesDeleted: vi.fn(),
            onSelectionChanged: vi.fn(),
          };

          const { result } = renderHook(() => useCopyPaste(props));

          // Copy notes (clipboard stores deep copies)
          act(() => {
            result.current.copy();
          });

          // Mutate the original note objects in place (simulating user edits)
          for (const note of originalNotes) {
            note.pitch = Math.max(0, Math.min(127, (note.pitch + 24) % 128));
            note.start = note.start + 50;
            note.duration = note.duration + 5;
            note.velocity = Math.max(0, Math.min(1, 1 - note.velocity));
          }

          // Paste from clipboard — should use values from copy-time
          act(() => {
            result.current.paste();
          });

          expect(onNotesCreated).toHaveBeenCalledTimes(1);
          const pastedNotes = onNotesCreated.mock.calls[0][0] as Note[];

          // Pasted notes should match the values captured at copy time
          // (duration >= 1 so it will never be clamped by grid snap min)
          expect(pastedNotes.length).toBe(originalNotes.length);
          for (let i = 0; i < pastedNotes.length; i++) {
            expect(pastedNotes[i].pitch).toBe(valuesAtCopyTime[i].pitch);
            expect(pastedNotes[i].duration).toBe(valuesAtCopyTime[i].duration);
            expect(pastedNotes[i].velocity).toBe(valuesAtCopyTime[i].velocity);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
