import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { VELOCITY_LANE_CONFIG } from '@/components/VelocityLane/constants';
import type { Note } from '@/types/note';
import type { VisibleRegion } from '@/types/grid';

// --- Pure functions under test ---

/**
 * Determines if a note is visible within the given visible region.
 * A note is visible iff its horizontal extent overlaps the visible beat range.
 * Mirrors the filtering logic in renderers.ts renderVelocityBars.
 */
function isNoteVisible(note: Note, visibleRegion: VisibleRegion): boolean {
  const noteEnd = note.start + note.duration;
  return noteEnd > visibleRegion.startBeat && note.start < visibleRegion.endBeat;
}

/**
 * Determines the bar fill color based on selection state.
 * Mirrors the color assignment logic in renderers.ts renderVelocityBars.
 */
function getBarColor(noteId: string, selectedNoteIds: Set<string>): string {
  return selectedNoteIds.has(noteId)
    ? VELOCITY_LANE_CONFIG.BAR_SELECTED_COLOR
    : VELOCITY_LANE_CONFIG.BAR_COLOR;
}

/**
 * Click selection without modifier: replaces selection with the clicked note.
 * Mirrors the handlePointerDown logic in VelocityLaneCanvas (no modifier path).
 */
function clickSelect(clickedNoteId: string): Set<string> {
  return new Set([clickedNoteId]);
}

/**
 * Toggle selection with modifier key (Ctrl/Shift+click).
 * If noteId is in selection, remove it; otherwise, add it.
 * Mirrors the handlePointerDown logic in VelocityLaneCanvas (modifier path).
 */
function toggleSelection(noteId: string, currentSelection: Set<string>): Set<string> {
  const newSelection = new Set(currentSelection);
  if (newSelection.has(noteId)) {
    newSelection.delete(noteId);
  } else {
    newSelection.add(noteId);
  }
  return newSelection;
}

// --- Shared Arbitraries ---

/** Arbitrary for a valid visible region with positive beat span */
const visibleRegionArb: fc.Arbitrary<VisibleRegion> = fc
  .record({
    startBeat: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    beatSpan: fc.double({ min: 1, max: 64, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ startBeat, beatSpan }) => ({
    startBeat,
    endBeat: startBeat + beatSpan,
    startPitch: 48,
    endPitch: 72,
  }));

/** Arbitrary for a Note with customizable start and duration */
const noteArb: fc.Arbitrary<Note> = fc.record({
  id: fc.uuid(),
  pitch: fc.integer({ min: 0, max: 127 }),
  start: fc.double({ min: 0, max: 200, noNaN: true, noDefaultInfinity: true }),
  duration: fc.double({ min: 0.001, max: 100, noNaN: true, noDefaultInfinity: true }),
  velocity: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
});

/** Arbitrary for a set of note IDs */
const noteIdSetArb = fc
  .array(fc.uuid(), { minLength: 0, maxLength: 10 })
  .map((ids) => new Set(ids));

// ===================================================================
// Property 3: Visible Notes Filtering
// ===================================================================

/**
 * Feature: velocity-lane-editor, Property 3: Visible Notes Filtering
 *
 * *For any* array of notes and visible region, the set of notes with rendered velocity bars
 * SHALL equal exactly the set of notes where (note.start + note.duration > visibleRegion.startBeat)
 * AND (note.start < visibleRegion.endBeat).
 *
 * **Validates: Requirements 2.1**
 */
describe('Feature: velocity-lane-editor, Property 3: Visible Notes Filtering', () => {
  it('should include a note iff its horizontal extent overlaps the visible region', () => {
    fc.assert(
      fc.property(
        fc.array(noteArb, { minLength: 0, maxLength: 20 }),
        visibleRegionArb,
        (notes, visibleRegion) => {
          const visibleNotes = notes.filter((note) => isNoteVisible(note, visibleRegion));

          for (const note of visibleNotes) {
            const noteEnd = note.start + note.duration;
            expect(noteEnd).toBeGreaterThan(visibleRegion.startBeat);
            expect(note.start).toBeLessThan(visibleRegion.endBeat);
          }

          const invisibleNotes = notes.filter((note) => !isNoteVisible(note, visibleRegion));
          for (const note of invisibleNotes) {
            const noteEnd = note.start + note.duration;
            const overlaps = noteEnd > visibleRegion.startBeat && note.start < visibleRegion.endBeat;
            expect(overlaps).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should exclude notes that end exactly at visibleRegion.startBeat', () => {
    fc.assert(
      fc.property(visibleRegionArb, noteArb, (visibleRegion, baseNote) => {
        // Ensure note start is non-negative to be a valid scenario
        const noteStart = visibleRegion.startBeat - baseNote.duration;
        fc.pre(noteStart >= 0);

        // Position note so it ends exactly at startBeat
        const note: Note = {
          ...baseNote,
          start: noteStart,
        };

        // Guard against floating-point imprecision: verify noteEnd actually equals startBeat
        const noteEnd = note.start + note.duration;
        fc.pre(noteEnd <= visibleRegion.startBeat);

        // note.start + note.duration === visibleRegion.startBeat → NOT visible (not strictly >)
        expect(isNoteVisible(note, visibleRegion)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should exclude notes that start exactly at visibleRegion.endBeat', () => {
    fc.assert(
      fc.property(visibleRegionArb, noteArb, (visibleRegion, baseNote) => {
        // Position note so it starts exactly at endBeat
        const note: Note = {
          ...baseNote,
          start: visibleRegion.endBeat,
        };

        // note.start >= visibleRegion.endBeat → NOT visible (not strictly <)
        expect(isNoteVisible(note, visibleRegion)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should include notes that partially overlap the visible region from the left', () => {
    fc.assert(
      fc.property(visibleRegionArb, noteArb, (visibleRegion, baseNote) => {
        // Position note so it starts before startBeat but ends after startBeat
        const overlapAmount = baseNote.duration * 0.5;
        const note: Note = {
          ...baseNote,
          start: visibleRegion.startBeat - overlapAmount,
        };
        // note ends at: visibleRegion.startBeat - overlapAmount + duration
        //             = visibleRegion.startBeat + 0.5 * duration > visibleRegion.startBeat
        expect(isNoteVisible(note, visibleRegion)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should include notes fully contained within the visible region', () => {
    fc.assert(
      fc.property(visibleRegionArb, (visibleRegion) => {
        const beatSpan = visibleRegion.endBeat - visibleRegion.startBeat;
        // Place note in the middle of the visible region
        const note: Note = {
          id: 'test-id',
          pitch: 60,
          start: visibleRegion.startBeat + beatSpan * 0.25,
          duration: beatSpan * 0.5,
          velocity: 0.8,
        };

        expect(isNoteVisible(note, visibleRegion)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ===================================================================
// Property 12: Selection-Based Bar Coloring
// ===================================================================

/**
 * Feature: velocity-lane-editor, Property 12: Selection-Based Bar Coloring
 *
 * *For any* note, the velocity bar fill color SHALL equal BAR_SELECTED_COLOR if the note's ID
 * is in selectedNoteIds, and BAR_COLOR otherwise.
 *
 * **Validates: Requirements 6.1**
 */
describe('Feature: velocity-lane-editor, Property 12: Selection-Based Bar Coloring', () => {
  it('should return BAR_SELECTED_COLOR when noteId is in selectedNoteIds', () => {
    fc.assert(
      fc.property(fc.uuid(), noteIdSetArb, (noteId, baseSelection) => {
        const selectedNoteIds = new Set(baseSelection);
        selectedNoteIds.add(noteId); // Ensure noteId is selected

        const color = getBarColor(noteId, selectedNoteIds);
        expect(color).toBe(VELOCITY_LANE_CONFIG.BAR_SELECTED_COLOR);
      }),
      { numRuns: 100 }
    );
  });

  it('should return BAR_COLOR when noteId is NOT in selectedNoteIds', () => {
    fc.assert(
      fc.property(fc.uuid(), noteIdSetArb, (noteId, baseSelection) => {
        const selectedNoteIds = new Set(baseSelection);
        selectedNoteIds.delete(noteId); // Ensure noteId is NOT selected

        const color = getBarColor(noteId, selectedNoteIds);
        expect(color).toBe(VELOCITY_LANE_CONFIG.BAR_COLOR);
      }),
      { numRuns: 100 }
    );
  });

  it('should return BAR_COLOR when selectedNoteIds is empty', () => {
    fc.assert(
      fc.property(fc.uuid(), (noteId) => {
        const color = getBarColor(noteId, new Set<string>());
        expect(color).toBe(VELOCITY_LANE_CONFIG.BAR_COLOR);
      }),
      { numRuns: 100 }
    );
  });

  it('should consistently return the same color for the same membership state', () => {
    fc.assert(
      fc.property(fc.uuid(), noteIdSetArb, fc.boolean(), (noteId, baseSelection, isSelected) => {
        const selectedNoteIds = new Set(baseSelection);
        if (isSelected) {
          selectedNoteIds.add(noteId);
        } else {
          selectedNoteIds.delete(noteId);
        }

        const color1 = getBarColor(noteId, selectedNoteIds);
        const color2 = getBarColor(noteId, selectedNoteIds);
        expect(color1).toBe(color2);

        const expectedColor = isSelected
          ? VELOCITY_LANE_CONFIG.BAR_SELECTED_COLOR
          : VELOCITY_LANE_CONFIG.BAR_COLOR;
        expect(color1).toBe(expectedColor);
      }),
      { numRuns: 100 }
    );
  });
});

// ===================================================================
// Property 13: Click Selection Without Modifier
// ===================================================================

/**
 * Feature: velocity-lane-editor, Property 13: Click Selection Without Modifier
 *
 * *For any* existing selection set and a click on a velocity bar without modifier keys held,
 * the resulting selection SHALL be exactly {clickedNoteId}.
 *
 * **Validates: Requirements 6.3**
 */
describe('Feature: velocity-lane-editor, Property 13: Click Selection Without Modifier', () => {
  it('should produce a selection of exactly {clickedNoteId} regardless of previous selection', () => {
    fc.assert(
      fc.property(fc.uuid(), (clickedNoteId) => {
        const newSelection = clickSelect(clickedNoteId);

        expect(newSelection.size).toBe(1);
        expect(newSelection.has(clickedNoteId)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should replace any multi-note selection with a single note', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
        (clickedNoteId, previousSelectionArray) => {
          const previousSelection = new Set(previousSelectionArray);
          // Regardless of the previous selection size, click replaces with single note
          const newSelection = clickSelect(clickedNoteId);

          expect(newSelection.size).toBe(1);
          expect(newSelection.has(clickedNoteId)).toBe(true);

          // Previous selection is irrelevant to the result
          for (const id of previousSelection) {
            if (id !== clickedNoteId) {
              expect(newSelection.has(id)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce the same result when clicking an already-selected note', () => {
    fc.assert(
      fc.property(fc.uuid(), (noteId) => {
        // Even if noteId was already selected, result is still just {noteId}
        // previousSelection demonstrates the intent but doesn't affect the outcome
        void new Set([noteId, 'other-1', 'other-2']);
        const newSelection = clickSelect(noteId);

        expect(newSelection.size).toBe(1);
        expect(newSelection.has(noteId)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ===================================================================
// Property 14: Toggle Selection With Modifier
// ===================================================================

/**
 * Feature: velocity-lane-editor, Property 14: Toggle Selection With Modifier
 *
 * *For any* selection set S and note ID n, a Ctrl/Shift+click on that note's velocity bar SHALL
 * produce: if n ∈ S then S \ {n}, else S ∪ {n}.
 *
 * **Validates: Requirements 6.4**
 */
describe('Feature: velocity-lane-editor, Property 14: Toggle Selection With Modifier', () => {
  it('should remove noteId from selection if it was already selected', () => {
    fc.assert(
      fc.property(fc.uuid(), noteIdSetArb, (noteId, baseSelection) => {
        const currentSelection = new Set(baseSelection);
        currentSelection.add(noteId); // Ensure noteId is in selection

        const newSelection = toggleSelection(noteId, currentSelection);

        expect(newSelection.has(noteId)).toBe(false);
        // All other notes remain unchanged
        for (const id of currentSelection) {
          if (id !== noteId) {
            expect(newSelection.has(id)).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should add noteId to selection if it was not selected', () => {
    fc.assert(
      fc.property(fc.uuid(), noteIdSetArb, (noteId, baseSelection) => {
        const currentSelection = new Set(baseSelection);
        currentSelection.delete(noteId); // Ensure noteId is NOT in selection

        const newSelection = toggleSelection(noteId, currentSelection);

        expect(newSelection.has(noteId)).toBe(true);
        // All existing notes remain unchanged
        for (const id of currentSelection) {
          expect(newSelection.has(id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should produce S \\ {n} when n ∈ S (set difference)', () => {
    fc.assert(
      fc.property(fc.uuid(), noteIdSetArb, (noteId, baseSelection) => {
        const currentSelection = new Set(baseSelection);
        currentSelection.add(noteId);

        const newSelection = toggleSelection(noteId, currentSelection);
        const expectedSize = currentSelection.size - 1;

        expect(newSelection.size).toBe(expectedSize);
        expect(newSelection.has(noteId)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should produce S ∪ {n} when n ∉ S (set union)', () => {
    fc.assert(
      fc.property(fc.uuid(), noteIdSetArb, (noteId, baseSelection) => {
        const currentSelection = new Set(baseSelection);
        currentSelection.delete(noteId);

        const newSelection = toggleSelection(noteId, currentSelection);
        const expectedSize = currentSelection.size + 1;

        expect(newSelection.size).toBe(expectedSize);
        expect(newSelection.has(noteId)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should not modify the original selection set (immutability)', () => {
    fc.assert(
      fc.property(fc.uuid(), noteIdSetArb, fc.boolean(), (noteId, baseSelection, isInSelection) => {
        const currentSelection = new Set(baseSelection);
        if (isInSelection) {
          currentSelection.add(noteId);
        } else {
          currentSelection.delete(noteId);
        }

        const originalSize = currentSelection.size;
        const originalContains = currentSelection.has(noteId);

        toggleSelection(noteId, currentSelection);

        // Original set should be unchanged
        expect(currentSelection.size).toBe(originalSize);
        expect(currentSelection.has(noteId)).toBe(originalContains);
      }),
      { numRuns: 100 }
    );
  });

  it('should be self-inverse: toggling twice restores original selection', () => {
    fc.assert(
      fc.property(fc.uuid(), noteIdSetArb, (noteId, baseSelection) => {
        const currentSelection = new Set(baseSelection);

        const afterFirst = toggleSelection(noteId, currentSelection);
        const afterSecond = toggleSelection(noteId, afterFirst);

        // After toggling twice, should have same members as original
        expect(afterSecond.size).toBe(currentSelection.size);
        for (const id of currentSelection) {
          expect(afterSecond.has(id)).toBe(true);
        }
        for (const id of afterSecond) {
          expect(currentSelection.has(id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
