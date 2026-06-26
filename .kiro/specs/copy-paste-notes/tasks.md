# Implementation Plan: Copy/Paste Notes

## Overview

Implement copy, cut, paste, and duplicate operations for the piano roll editor. The implementation adds a pure utility module (`clipboard-operations.ts`) for stateless note transformations, a React hook (`useCopyPaste`) to manage clipboard state and orchestrate operations, and extends the existing `useKeyboardShortcuts` hook to handle Ctrl+C/X/V/D with drag-operation guards.

## Tasks

- [x] 1. Create clipboard operations utility module
  - [x] 1.1 Create `hooks/clipboard-operations.ts` with pure functions
    - Implement `ClipboardNote` interface (startOffset, pitch, duration, velocity)
    - Implement `normalizeNotesToClipboard(notes: Note[]): ClipboardNote[]` — computes relative offsets from the earliest note
    - Implement `pasteNotesAtPosition(clipboardNotes, anchorPosition, gridSnap): Note[]` — creates new notes with UUIDs, clamped boundaries, grid-snapped anchor
    - Implement `calculateDuplicateAnchor(selectedNotes, gridSnap): number` — returns end time of latest note, snapped if enabled
    - Implement `validateNoteProperties(note, gridSnap): Note` — clamps pitch [0,127], start >= 0, duration >= minimum
    - Use `crypto.randomUUID()` for ID generation (consistent with existing `PianoRollCanvas` pattern)
    - Import `snapPosition`, `getMinimumDuration` from `usePianoRoll` or inline equivalent logic
    - _Requirements: 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4_

  - [x] 1.2 Write property tests for `normalizeNotesToClipboard`
    - **Property 1: Clipboard stores relative timing offsets**
    - **Validates: Requirements 1.4, 2.1**

  - [x] 1.3 Write property tests for `pasteNotesAtPosition`
    - **Property 4: Paste preserves note data and positions relative to playhead**
    - **Property 5: Paste respects grid snap configuration**
    - **Property 6: All note-creation operations produce unique IDs**
    - **Property 11: Paste validates note boundaries**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.3, 5.4**

  - [x] 1.4 Write property tests for `calculateDuplicateAnchor`
    - **Property 9: Duplicate positions after selection end and preserves structure**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create `useCopyPaste` hook
  - [x] 3.1 Create `hooks/useCopyPaste.ts` implementing clipboard state management
    - Define `UseCopyPasteProps` interface accepting notes, selectedNoteIds, playheadPosition, gridSnap, and callbacks (onNotesCreated, onNotesDeleted, onSelectionChanged)
    - Define `UseCopyPasteReturn` interface exposing copy, cut, paste, duplicate, hasClipboardContent, showCopyFeedback
    - Implement `copy()` — early-return if selection empty, normalize selected notes, store in clipboard state, trigger copy feedback timer (200ms)
    - Implement `cut()` — copy logic + call onNotesDeleted with selected IDs + call onSelectionChanged with empty array
    - Implement `paste()` — early-return if clipboard empty, call pasteNotesAtPosition with playhead and gridSnap, call onNotesCreated, call onSelectionChanged with new IDs
    - Implement `duplicate()` — early-return if selection empty, normalize selected notes, calculate duplicate anchor, paste at anchor, call onNotesCreated, call onSelectionChanged with new IDs
    - Implement `showCopyFeedback` state with auto-reset via setTimeout
    - Clipboard stored as `useState<ClipboardNote[] | null>(null)`
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.6, 3.7, 3.8, 4.1, 4.5, 4.6, 5.1_

  - [x] 3.2 Write property tests for `useCopyPaste` operations
    - **Property 2: No-op when selection is empty**
    - **Property 3: Cut removes selected notes and clears selection**
    - **Property 7: Paste and duplicate select only new notes**
    - **Property 8: Multiple pastes from same clipboard**
    - **Property 10: Clipboard independence (deep copy)**
    - **Validates: Requirements 1.2, 2.2, 2.3, 3.6, 3.7, 3.8, 4.5, 4.6, 5.1**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend keyboard shortcuts integration
  - [x] 5.1 Extend `useKeyboardShortcuts` to support copy/paste/cut/duplicate callbacks
    - Add `onCopy`, `onCut`, `onPaste`, `onDuplicate` optional callback props to `UseKeyboardShortcutsProps`
    - Add `isDragging` optional prop to suppress shortcuts during drag/resize/marquee operations
    - Add cases for `KeyC`, `KeyX`, `KeyV`, `KeyD` when `event.ctrlKey || event.metaKey` is true
    - Check `isDragging` guard before processing clipboard shortcuts
    - Reuse existing `isTextInputElement` and `containerHasFocus` guards
    - Call `event.preventDefault()` when a clipboard operation is triggered
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.2 Write property tests for keyboard shortcut guards
    - **Property 12: Text input suppresses clipboard shortcuts**
    - **Property 13: Active drag suppresses clipboard shortcuts**
    - **Validates: Requirements 6.1, 6.4**

- [x] 6. Wire components together in the melody editor
  - [x] 6.1 Integrate `useCopyPaste` hook into the melody editor page
    - Import and call `useCopyPaste` in the melody editor component (e.g., `MelodyEditor.tsx`)
    - Pass notes, selectedNoteIds, playheadPosition, gridSnap from existing `usePianoRoll` and playback state
    - Wire `onNotesCreated` to add notes via existing state management (use `loadNotes` with concatenated array or add a batch-create method)
    - Wire `onNotesDeleted` to remove notes (call `deleteNote` for each or add batch-delete)
    - Wire `onSelectionChanged` to call `selectNotes`
    - Pass `copy`, `cut`, `paste`, `duplicate` callbacks to `useKeyboardShortcuts`
    - Pass `isDragging` state from existing drag/marquee hooks to `useKeyboardShortcuts`
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 6.1, 6.2, 6.3, 6.4_

  - [x] 6.2 Write unit tests for the integration wiring
    - Test that keyboard events dispatch correct operations
    - Test that drag state suppresses shortcuts
    - Test visual feedback flag behavior
    - _Requirements: 1.5, 6.3, 6.4_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Vitest with fast-check already installed — no additional test setup needed
- `crypto.randomUUID()` is used for note ID generation (consistent with existing codebase)
- The existing `usePianoRoll` hook exports utility functions (`snapToGrid`, `snapPosition`, `getMinimumDuration`) that should be reused in clipboard operations

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["3.1", "5.1"] },
    { "id": 3, "tasks": ["3.2", "5.2"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["6.2"] }
  ]
}
```
