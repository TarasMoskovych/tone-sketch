# Implementation Plan: Piano Roll Undo/Redo

## Overview

Implement undo/redo functionality for the piano roll editor using a hook-based Command Pattern architecture. The `useUndoRedo` hook manages a bounded history stack (max 100 entries) and provides wrapped mutation functions that automatically record actions. Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z) trigger undo/redo when the piano roll canvas has focus.

## Tasks

- [x] 1. Define action types and history stack interfaces
  - [x] 1.1 Create the UndoAction type system and HistoryStack interface
    - Create `hooks/useUndoRedo/types.ts` with `CreateAction`, `DeleteAction`, `ModifyAction`, `BatchAction` interfaces and `UndoAction` discriminated union type
    - Define `HistoryStack` interface with `actions: UndoAction[]`, `pointer: number`, and `maxSize: number`
    - Export `UseUndoRedoOptions` and `UseUndoRedoReturn` interfaces as defined in design
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Implement the useUndoRedo hook core logic
  - [x] 2.1 Implement history stack management (push, truncate redo, enforce max size)
    - Create `hooks/useUndoRedo/useUndoRedo.ts`
    - Implement `useState` for `history` (UndoAction[]) and `pointer` (number)
    - Implement `pushAction` internal function that: truncates redo entries when pointer is not at end, appends new action, enforces 100-entry max by removing oldest when full
    - Implement `canUndo` (pointer > 0) and `canRedo` (pointer < history.length) derived booleans
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Implement undo execution logic
    - Implement `undo()` function that decrements pointer and applies inverse of the action at the current pointer position
    - Handle `create` action undo: filter out the note by ID from notes array
    - Handle `delete` action undo: re-insert the stored note into notes array
    - Handle `modify` action undo: replace note with `before` state
    - Handle `batch` action undo: apply inverse of all sub-operations atomically
    - Early return (no-op) when `canUndo` is false
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.3 Implement redo execution logic
    - Implement `redo()` function that applies the action at current pointer and increments pointer
    - Handle `create` action redo: re-add the note to notes array
    - Handle `delete` action redo: remove the note by ID
    - Handle `modify` action redo: replace note with `after` state
    - Handle `batch` action redo: apply all sub-operations forward
    - Early return (no-op) when `canRedo` is false
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 2.4 Implement selection management after undo/redo
    - After undo/redo of `create` (undo removes note) or `delete` (redo removes note): call `deselectAll()`
    - After undo/redo that restores or modifies notes: call `selectNotes()` with IDs of all affected notes
    - After batch undo/redo: select all notes that were restored or modified
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 2.5 Implement recording functions and clearHistory
    - Implement `recordCreate(note)`, `recordDelete(note)`, `recordModify(noteId, before, after)`, `recordBatch(operations)`
    - Implement `clearHistory()` that resets history to empty array and pointer to 0
    - Implement `setDragInProgress(inProgress)` flag that suppresses recording during drags
    - Create barrel export `hooks/useUndoRedo/index.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 8.1, 8.3, 8.4_

  - [x] 2.6 Write property tests for history stack management
    - **Property 7: History branching discards redo**
    - **Property 8: History size limit**
    - **Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2, 5.3**

  - [x] 2.7 Write property tests for undo/redo correctness
    - **Property 4: Undo restores pre-action state**
    - **Property 5: Redo re-applies post-action state**
    - **Property 6: Undo-redo round trip**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Integrate useUndoRedo with MelodyEditor
  - [x] 4.1 Wire useUndoRedo hook into MelodyEditor component
    - Import and instantiate `useUndoRedo` in `MelodyEditor.tsx` with `notes`, `loadNotes`, `selectNotes`, `deselectAll` from `usePianoRoll`
    - Wrap `handleNoteCreate` to call `recordCreate` after `createNote` executes (capture the created note)
    - Wrap `handleNoteDelete` to capture the note data before deletion, then call `recordDelete`
    - Wrap `handleNoteUpdate` to call `recordModify` with before/after states when a move/resize/velocity commit occurs
    - Wrap `handleBulkNoteUpdate` to call `recordBatch` with before/after states for all affected notes
    - Pass `undo` and `redo` callbacks down to `PianoRollCanvas`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 4.2 Handle drag-in-progress suppression in MelodyEditor
    - Call `setDragInProgress(true)` when drag/resize begins (integrate with existing drag state lifecycle)
    - Call `setDragInProgress(false)` when drag/resize commits (mouse-up)
    - Ensure intermediate updates during drag do NOT record actions
    - Only record the final before/after snapshot on commit
    - _Requirements: 1.3, 1.4, 1.5, 1.8_

  - [x] 4.3 Handle Clear All and MIDI import history integration
    - Modify `handleClearNotes` to record a batch delete action (all notes) before clearing, so Clear All is undoable
    - Modify `loadNotesFn` (MIDI import path) to call `clearHistory()` after loading new notes
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [-] 4.4 Write property tests for action recording
    - **Property 1: Single-note mutation recording**
    - **Property 2: Batch mutation recording**
    - **Property 3: No intermediate recording during drag**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9**

  - [-] 4.5 Write property tests for selection after undo/redo
    - **Property 9: Selection updated to affected notes after undo/redo**
    - **Property 10: Selection cleared on note removal via undo/redo**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

  - [-] 4.6 Write property tests for history reset
    - **Property 11: LoadNotes clears all history**
    - **Property 12: Clear All records batch action**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add keyboard shortcut support for undo/redo
  - [x] 6.1 Extend useKeyboardShortcuts to handle undo/redo key combinations
    - Add `onUndo?: () => void` and `onRedo?: () => void` to `UseKeyboardShortcutsProps` interface
    - Handle `KeyZ` with Ctrl/Cmd (no Shift) → call `onUndo`, block during drag
    - Handle `KeyZ` with Ctrl/Cmd+Shift → call `onRedo`, block during drag
    - Handle `KeyY` with Ctrl/Cmd → call `onRedo` (alternative shortcut), block during drag
    - Call `event.preventDefault()` for handled undo/redo shortcuts
    - Respect existing `isTextInputElement` check and `containerHasFocus` check
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 6.2 Wire undo/redo props through PianoRollCanvas to useKeyboardShortcuts
    - Add `onUndo?: () => void` and `onRedo?: () => void` to `PianoRollCanvasProps` interface in `components/PianoRoll/types.ts`
    - Pass `onUndo` and `onRedo` from `PianoRollCanvas` to the `useKeyboardShortcuts` call
    - _Requirements: 6.1, 6.2_

  - [-] 6.3 Write unit tests for undo/redo keyboard shortcuts
    - Test Ctrl+Z triggers undo when canvas has focus
    - Test Ctrl+Shift+Z and Ctrl+Y trigger redo when canvas has focus
    - Test shortcuts are blocked during drag operations
    - Test shortcuts are blocked when canvas doesn't have focus
    - Test shortcuts are blocked when typing in text input fields
    - Test preventDefault is called on handled shortcuts
    - Test no-op when undo/redo history is empty
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [ ] 7. Handle velocity lane operations for undo/redo recording
  - [-] 7.1 Ensure velocity changes from VelocityLaneCanvas are recorded
    - Verify that velocity updates flow through `handleNoteUpdate` and `handleBulkNoteUpdate` in MelodyEditor (which already have undo recording from task 4.1)
    - If VelocityLaneCanvas calls `onNoteUpdate` directly without a drag commit pattern, ensure `recordModify` is called with the before state (captured from the notes array before the update)
    - Handle bulk velocity updates via `onBulkNoteUpdate` → `recordBatch` with before/after velocity states
    - _Requirements: 1.6, 1.9_

- [x] 8. Final integration and wiring
  - [x] 8.1 Wire undo/redo from MelodyEditor to PianoRollCanvas
    - Pass `undo` and `redo` callbacks from `useUndoRedo` as `onUndo` / `onRedo` props to `PianoRollCanvas`
    - Ensure `canUndo` and `canRedo` state is accessible if UI indicators are needed in the future
    - Verify the complete flow: keyboard shortcut → PianoRollCanvas → MelodyEditor → useUndoRedo → usePianoRoll note state update
    - _Requirements: 2.1, 3.1, 6.1, 6.2_

  - [x] 8.2 Add copy/paste (cut) operation recording to undo history
    - Wrap the `cut` operation in MelodyEditor to record a batch delete action before the notes are removed
    - Ensure cut records the deleted notes so they can be restored on undo
    - _Requirements: 1.7_

  - [x] 8.3 Write integration tests for end-to-end undo/redo flows
    - Test: create note → undo → note removed → redo → note restored
    - Test: delete note → undo → note restored with original properties → redo → note removed
    - Test: move note → undo → note at original position → redo → note at moved position
    - Test: bulk move → undo → all notes at original positions
    - Test: MIDI import clears history (loadNotes integration)
    - Test: Clear All is undoable (records batch action)
    - Test: velocity change → undo → original velocity restored
    - Test: history branching (undo, new action, redo unavailable)
    - _Requirements: 1.1-1.9, 2.1-2.6, 3.1-3.6, 4.1-4.4, 8.1-8.4_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `useUndoRedo` hook is a pure logic layer — it manages history state and delegates note mutations to `usePianoRoll` via `loadNotes`/`selectNotes`
- `fast-check` (already in devDependencies) is used for property-based tests
- `vitest` is the test runner (`npm run test` / `vitest run`)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.5"] },
    { "id": 3, "tasks": ["2.4", "2.6", "2.7"] },
    { "id": 4, "tasks": ["4.1", "6.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "6.2"] },
    { "id": 6, "tasks": ["4.4", "4.5", "4.6", "6.3", "7.1"] },
    { "id": 7, "tasks": ["8.1", "8.2"] },
    { "id": 8, "tasks": ["8.3"] }
  ]
}
```
