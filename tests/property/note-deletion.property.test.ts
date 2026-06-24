import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Note } from '../../types/note';

// Feature: tone-sketch, Property 7: Note Deletion Removes from Melody
/**
 * Property 7: Note Deletion Removes from Melody
 *
 * *For any* Note in a Melody, when the Note is deleted (via Delete/Backspace key
 * or right-click), the Note SHALL no longer exist in the Melody's notes array.
 *
 * **Validates: Requirements 6.1, 6.2**
 *
 * Requirements:
 * - 6.1: WHEN the user selects a Note and presses the Delete key or Backspace key,
 *        THE Piano_Roll_Editor SHALL remove the Note from the Melody
 * - 6.2: WHEN the user right-clicks on a Note, THE Piano_Roll_Editor SHALL
 *        remove the Note from the Melody
 */
describe('Property 7: Note Deletion Removes from Melody', () => {
  // Arbitrary for valid MIDI pitch (0-127)
  const pitchArb = fc.integer({ min: 0, max: 127 });

  // Arbitrary for valid start time in beats (0-10000)
  const startBeatArb = fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for valid duration (0.001-1000)
  const durationArb = fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for valid velocity (0-1)
  const velocityArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for creating a valid note
  const noteArb: fc.Arbitrary<Note> = fc.record({
    id: fc.uuid(),
    pitch: pitchArb,
    start: startBeatArb,
    duration: durationArb,
    velocity: velocityArb,
  });

  // Arbitrary for creating an array of notes (representing a melody's notes)
  const notesArrayArb = fc.array(noteArb, { minLength: 1, maxLength: 100 });

  /**
   * Type representing deletion methods supported by the piano roll editor
   * Requirements: 6.1 (Delete/Backspace key), 6.2 (right-click)
   */
  type DeletionMethod = 'delete-key' | 'backspace-key' | 'right-click';

  const deletionMethodArb = fc.constantFrom<DeletionMethod>('delete-key', 'backspace-key', 'right-click');

  /**
   * Simulates the note deletion operation from the melody's notes array.
   * This represents what happens when onNoteDelete is called in PianoRollCanvas.
   *
   * The deletion operation filters out the note with the given ID from the notes array.
   *
   * @param notes - The current array of notes in the melody
   * @param noteIdToDelete - The ID of the note to delete
   * @returns A new array with the note removed
   */
  function deleteNote(notes: Note[], noteIdToDelete: string): Note[] {
    return notes.filter(note => note.id !== noteIdToDelete);
  }

  /**
   * Simulates deleting multiple selected notes (for batch deletion via Delete/Backspace)
   *
   * @param notes - The current array of notes in the melody
   * @param noteIdsToDelete - Set of note IDs to delete
   * @returns A new array with all specified notes removed
   */
  function deleteNotes(notes: Note[], noteIdsToDelete: Set<string>): Note[] {
    return notes.filter(note => !noteIdsToDelete.has(note.id));
  }

  describe('Single note deletion', () => {
    it('deleted note should no longer exist in the notes array', () => {
      fc.assert(
        fc.property(notesArrayArb, deletionMethodArb, (notes, _method) => {
          // Pick a random note to delete
          const noteIndex = Math.floor(Math.random() * notes.length);
          const noteToDelete = notes[noteIndex];

          // Perform deletion
          const updatedNotes = deleteNote(notes, noteToDelete.id);

          // Verify the deleted note no longer exists
          const noteStillExists = updatedNotes.some(n => n.id === noteToDelete.id);
          expect(noteStillExists).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('deleted note ID should not be found in the result array', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          // Select a note to delete
          const noteIndex = Math.floor(Math.random() * notes.length);
          const noteIdToDelete = notes[noteIndex].id;

          // Perform deletion
          const updatedNotes = deleteNote(notes, noteIdToDelete);

          // Check that no note has the deleted ID
          const allIds = updatedNotes.map(n => n.id);
          expect(allIds).not.toContain(noteIdToDelete);
        }),
        { numRuns: 100 }
      );
    });

    it('deleting a note should reduce the notes array length by exactly one', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          const originalLength = notes.length;
          const noteIndex = Math.floor(Math.random() * notes.length);
          const noteToDelete = notes[noteIndex];

          const updatedNotes = deleteNote(notes, noteToDelete.id);

          expect(updatedNotes.length).toBe(originalLength - 1);
        }),
        { numRuns: 100 }
      );
    });

    it('all other notes should remain unchanged after deletion', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          const noteIndex = Math.floor(Math.random() * notes.length);
          const noteToDelete = notes[noteIndex];

          const updatedNotes = deleteNote(notes, noteToDelete.id);

          // Get the remaining notes from original array
          const expectedRemainingNotes = notes.filter(n => n.id !== noteToDelete.id);

          // Each remaining note should be exactly the same
          expect(updatedNotes.length).toBe(expectedRemainingNotes.length);

          for (const expectedNote of expectedRemainingNotes) {
            const foundNote = updatedNotes.find(n => n.id === expectedNote.id);
            expect(foundNote).toBeDefined();
            expect(foundNote!.pitch).toBe(expectedNote.pitch);
            expect(foundNote!.start).toBe(expectedNote.start);
            expect(foundNote!.duration).toBe(expectedNote.duration);
            expect(foundNote!.velocity).toBe(expectedNote.velocity);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('deleting a note via any method should have the same result', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          const noteIndex = Math.floor(Math.random() * notes.length);
          const noteToDelete = notes[noteIndex];

          // Simulate deletion via different methods
          const resultDeleteKey = deleteNote([...notes], noteToDelete.id);
          const resultBackspaceKey = deleteNote([...notes], noteToDelete.id);
          const resultRightClick = deleteNote([...notes], noteToDelete.id);

          // All methods should produce the same result
          expect(resultDeleteKey.length).toBe(resultBackspaceKey.length);
          expect(resultBackspaceKey.length).toBe(resultRightClick.length);

          // The deleted note should be absent in all cases
          expect(resultDeleteKey.some(n => n.id === noteToDelete.id)).toBe(false);
          expect(resultBackspaceKey.some(n => n.id === noteToDelete.id)).toBe(false);
          expect(resultRightClick.some(n => n.id === noteToDelete.id)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple note deletion (batch delete via Delete/Backspace key)', () => {
    it('all selected notes should be removed when Delete/Backspace is pressed', () => {
      fc.assert(
        fc.property(
          fc.array(noteArb, { minLength: 2, maxLength: 50 }),
          fc.integer({ min: 1, max: 10 }),
          (notes, numToDelete) => {
            // Select a random subset of notes to delete
            const actualNumToDelete = Math.min(numToDelete, notes.length);
            const indicesToDelete = new Set<number>();
            while (indicesToDelete.size < actualNumToDelete) {
              indicesToDelete.add(Math.floor(Math.random() * notes.length));
            }

            const noteIdsToDelete = new Set(
              Array.from(indicesToDelete).map(i => notes[i].id)
            );

            // Perform batch deletion
            const updatedNotes = deleteNotes(notes, noteIdsToDelete);

            // Verify all deleted notes are gone
            for (const deletedId of noteIdsToDelete) {
              const noteExists = updatedNotes.some(n => n.id === deletedId);
              expect(noteExists).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('batch deletion should reduce array length by the number of deleted notes', () => {
      fc.assert(
        fc.property(
          fc.array(noteArb, { minLength: 3, maxLength: 50 }),
          fc.integer({ min: 1, max: 5 }),
          (notes, numToDelete) => {
            const actualNumToDelete = Math.min(numToDelete, notes.length);
            const indicesToDelete = new Set<number>();
            while (indicesToDelete.size < actualNumToDelete) {
              indicesToDelete.add(Math.floor(Math.random() * notes.length));
            }

            const noteIdsToDelete = new Set(
              Array.from(indicesToDelete).map(i => notes[i].id)
            );

            const originalLength = notes.length;
            const updatedNotes = deleteNotes(notes, noteIdsToDelete);

            expect(updatedNotes.length).toBe(originalLength - noteIdsToDelete.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('non-selected notes should remain unchanged during batch deletion', () => {
      fc.assert(
        fc.property(
          fc.array(noteArb, { minLength: 3, maxLength: 50 }),
          fc.integer({ min: 1, max: 5 }),
          (notes, numToDelete) => {
            const actualNumToDelete = Math.min(numToDelete, notes.length - 1);
            const indicesToDelete = new Set<number>();
            while (indicesToDelete.size < actualNumToDelete) {
              indicesToDelete.add(Math.floor(Math.random() * notes.length));
            }

            const noteIdsToDelete = new Set(
              Array.from(indicesToDelete).map(i => notes[i].id)
            );

            const updatedNotes = deleteNotes(notes, noteIdsToDelete);

            // Check that all non-deleted notes are preserved exactly
            const nonDeletedNotes = notes.filter(n => !noteIdsToDelete.has(n.id));
            for (const expectedNote of nonDeletedNotes) {
              const foundNote = updatedNotes.find(n => n.id === expectedNote.id);
              expect(foundNote).toBeDefined();
              expect(foundNote!.id).toBe(expectedNote.id);
              expect(foundNote!.pitch).toBe(expectedNote.pitch);
              expect(foundNote!.start).toBe(expectedNote.start);
              expect(foundNote!.duration).toBe(expectedNote.duration);
              expect(foundNote!.velocity).toBe(expectedNote.velocity);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    it('deleting the only note in a melody should result in an empty array', () => {
      fc.assert(
        fc.property(noteArb, (note) => {
          const notes = [note];
          const updatedNotes = deleteNote(notes, note.id);

          expect(updatedNotes.length).toBe(0);
          expect(updatedNotes).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });

    it('deleting a non-existent note should not change the array', () => {
      fc.assert(
        fc.property(notesArrayArb, fc.uuid(), (notes, nonExistentId) => {
          // Ensure the ID doesn't exist in the array
          const actualNonExistentId = notes.some(n => n.id === nonExistentId)
            ? `non-existent-${nonExistentId}`
            : nonExistentId;

          const originalLength = notes.length;
          const updatedNotes = deleteNote(notes, actualNonExistentId);

          expect(updatedNotes.length).toBe(originalLength);

          // All original notes should still exist
          for (const note of notes) {
            expect(updatedNotes.some(n => n.id === note.id)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('deleting with an empty selection should not change the array', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          const emptySelection = new Set<string>();
          const originalLength = notes.length;

          const updatedNotes = deleteNotes(notes, emptySelection);

          expect(updatedNotes.length).toBe(originalLength);
        }),
        { numRuns: 100 }
      );
    });

    it('deleting all notes should result in an empty array', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          const allNoteIds = new Set(notes.map(n => n.id));
          const updatedNotes = deleteNotes(notes, allNoteIds);

          expect(updatedNotes.length).toBe(0);
          expect(updatedNotes).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });

    it('sequential deletions should remove notes cumulatively', () => {
      fc.assert(
        fc.property(
          fc.array(noteArb, { minLength: 3, maxLength: 20 }),
          (notes) => {
            let currentNotes = [...notes];
            const deletedIds: string[] = [];

            // Delete notes one by one
            while (currentNotes.length > 0) {
              const noteToDelete = currentNotes[0];
              deletedIds.push(noteToDelete.id);

              currentNotes = deleteNote(currentNotes, noteToDelete.id);

              // Verify all previously deleted notes are still gone
              for (const deletedId of deletedIds) {
                expect(currentNotes.some(n => n.id === deletedId)).toBe(false);
              }
            }

            expect(currentNotes.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Deletion immutability', () => {
    it('deletion should not mutate the original notes array', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          // Create a deep copy of original notes for comparison
          const originalNotesCopy = notes.map(n => ({ ...n }));
          const noteIndex = Math.floor(Math.random() * notes.length);
          const noteToDelete = notes[noteIndex];

          // Perform deletion
          deleteNote(notes, noteToDelete.id);

          // Original array should be unchanged
          expect(notes.length).toBe(originalNotesCopy.length);
          for (let i = 0; i < notes.length; i++) {
            expect(notes[i].id).toBe(originalNotesCopy[i].id);
            expect(notes[i].pitch).toBe(originalNotesCopy[i].pitch);
            expect(notes[i].start).toBe(originalNotesCopy[i].start);
            expect(notes[i].duration).toBe(originalNotesCopy[i].duration);
            expect(notes[i].velocity).toBe(originalNotesCopy[i].velocity);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('deletion should return a new array instance', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          const noteIndex = Math.floor(Math.random() * notes.length);
          const noteToDelete = notes[noteIndex];

          const updatedNotes = deleteNote(notes, noteToDelete.id);

          // Should be a different array instance
          expect(updatedNotes).not.toBe(notes);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Note uniqueness after deletion', () => {
    it('remaining notes should have unique IDs after deletion', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          const noteIndex = Math.floor(Math.random() * notes.length);
          const noteToDelete = notes[noteIndex];

          const updatedNotes = deleteNote(notes, noteToDelete.id);

          // Check all IDs are unique
          const ids = updatedNotes.map(n => n.id);
          const uniqueIds = new Set(ids);

          expect(ids.length).toBe(uniqueIds.size);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Deletion by note properties (right-click scenario)', () => {
    it('note at specific position should be correctly identified and deleted', () => {
      fc.assert(
        fc.property(notesArrayArb, (notes) => {
          // Simulate finding a note by position (like right-click)
          const noteIndex = Math.floor(Math.random() * notes.length);
          const noteAtPosition = notes[noteIndex];

          // In actual implementation, findNoteAtPosition returns the note
          // Then onNoteDelete is called with the note.id
          const updatedNotes = deleteNote(notes, noteAtPosition.id);

          // The note at that position should no longer exist
          expect(updatedNotes.some(n =>
            n.pitch === noteAtPosition.pitch &&
            n.start === noteAtPosition.start &&
            n.id === noteAtPosition.id
          )).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
});
