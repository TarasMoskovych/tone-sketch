# Implementation Plan: Multi-Note Selection

## Overview

This implementation plan transforms the Tone Sketch piano roll from single-note selection to comprehensive multi-note selection. The approach builds incrementally: first migrating the state model, then adding selection methods (click modifiers, marquee), followed by group operations (move, delete), and finally keyboard shortcuts.

## Tasks

- [x] 1. Migrate selection state from single to multi-selection
  - [x] 1.1 Update `usePianoRoll` hook to use `Set<string>` for selection state
    - Replace `selectedNoteId: string | null` with `selectedNoteIds: Set<string>`
    - Add new functions: `selectNotes`, `addToSelection`, `deselectNote`, `toggleNoteSelection`, `deselectAll`, `selectAll`
    - Update existing `selectNote` to clear selection and select single note (backward compatible)
    - Update `deleteNote` to remove deleted note ID from selection (Property 19)
    - Update `loadNotes` and `clearNotes` to clear selection (Property 20)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 1.2 Write property tests for selection state management
    - **Property 1: Simple Click Clears and Selects Single Note** - `selectNote(id)` results in `selection.size === 1 && selection.has(id)`
    - **Property 2: Click on Empty Clears Selection** - `selectNote(null)` results in `selection.size === 0`
    - **Property 3: Ctrl/Cmd Click Toggles Selection** - `toggleNoteSelection(id)` toggles membership correctly
    - **Property 18: Select All Selects Entire Melody** - `selectAll()` results in `selection.size === notes.length`
    - **Property 19: Note Deletion Cleans Selection** - deleted note ID removed from selection
    - **Property 20: Bulk Operations Clear Selection** - `loadNotes/clearNotes` clears selection
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 6.1, 7.2, 7.3**

  - [x] 1.3 Update `PianoRollCanvas` props to accept `selectedNoteIds: Set<string>`
    - Add `SelectionModifiers` interface for modifier key tracking
    - Update rendering logic to check `selectedNoteIds.has(note.id)` instead of `selectedNoteId === note.id`
    - Maintain visual styles using existing `NOTE_SELECTED_COLOR` and `NOTE_SELECTED_BORDER_COLOR`
    - _Requirements: 3.1, 3.2_

  - [x] 1.4 Update `create/page.tsx` to use new multi-selection API
    - Replace `selectedNoteId` prop with `selectedNoteIds`
    - Update any selection-related callbacks
    - _Requirements: 7.4_

- [x] 2. Checkpoint - Verify selection state migration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Implement click selection with modifier keys
  - [x] 3.1 Add platform modifier key detection utility
    - Create `isPlatformModifierKey(event)` function that returns true for Cmd on macOS, Ctrl on Windows/Linux
    - Add to a new `lib/selection-utils.ts` file
    - _Requirements: 1.3, 1.4_

  - [x] 3.2 Add selection anchor tracking for Shift-click range selection
    - Add `selectionAnchor: string | null` state to track last non-Shift clicked note
    - Create `getNoteRange(notes, anchorId, targetId)` utility to get notes between two notes by start time
    - _Requirements: 1.5, 1.6_

  - [x] 3.3 Update `PianoRollCanvas` click handling for modifier keys
    - On simple click: call `selectNote(noteId)` to clear and select single note (Property 1)
    - On click on empty area: call `deselectAll()` (Property 2)
    - On Ctrl/Cmd + click: call `toggleNoteSelection(noteId)` (Property 3)
    - On Shift + click: select range from anchor to clicked note (Property 4)
    - Update selection anchor on non-Shift clicks
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 3.4 Write property test for Shift-click range selection
    - **Property 4: Shift-Click Range Selection** - selection contains all notes between anchor and target by start time
    - **Validates: Requirements 1.5**

- [x] 4. Implement marquee (rectangle) selection
  - [x] 4.1 Add `MarqueeState` interface and state tracking
    - Create interface with `startX`, `startY`, `currentX`, `currentY`, `previousSelection`, `isAdditive`
    - Add `marqueeState: MarqueeState | null` state to `PianoRollCanvas`
    - _Requirements: 2.1_

  - [x] 4.2 Implement marquee intersection calculation
    - Create `getNotesInRect(notes, rect, visibleRegion)` utility function
    - Convert pixel coordinates to beat/pitch coordinates
    - Check intersection: `note.start < endBeat && note.start + note.duration > startBeat && note.pitch >= startPitch && note.pitch < endPitch`
    - _Requirements: 2.2_

  - [ ]* 4.3 Write property test for marquee note intersection
    - **Property 5: Marquee Note Intersection** - intersection matches geometric formula
    - **Validates: Requirements 2.2**

  - [x] 4.4 Implement marquee mouse event handling
    - On mousedown on empty area: start marquee, store previous selection, detect if Ctrl/Cmd held (additive mode)
    - On mousemove during marquee: update `currentX`, `currentY`, calculate intersecting notes, highlight them
    - On mouseup: finalize selection - replace (Property 6) or add to (Property 7) based on modifier
    - On Escape during marquee: cancel and restore previous selection (Property 8)
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [ ]* 4.5 Write property tests for marquee selection modes
    - **Property 6: Marquee Selection Replace Mode** - without modifier, selection equals intersecting notes
    - **Property 7: Marquee Selection Additive Mode** - with Ctrl/Cmd, selection equals union of previous and intersecting
    - **Property 8: Marquee Cancel Restores State** - Escape restores previous selection
    - **Validates: Requirements 2.3, 2.4, 2.5**

  - [x] 4.6 Render marquee selection rectangle
    - Draw semi-transparent rectangle during marquee drag
    - Use visible border to distinguish from notes
    - Highlight notes that intersect with the rectangle
    - _Requirements: 2.6_

- [x] 5. Checkpoint - Verify selection methods work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement group movement
  - [x] 6.1 Extend `DragState` interface for group operations
    - Add `originalSelectedNotes: Map<string, Note>` to store original positions of all selected notes
    - Add `isGroupDrag: boolean` flag
    - _Requirements: 4.1_

  - [x] 6.2 Implement group movement constraints calculation
    - Create `calculateGroupMoveConstraints(selectedNotes, deltaBeat, deltaPitch)` utility
    - Check all selected notes against boundaries: `start >= 0`, `pitch >= 0`, `pitch <= 127`
    - Return constrained deltas that keep ALL notes within valid bounds (Property 13)
    - _Requirements: 4.4, 4.5, 4.6_

  - [ ]* 6.3 Write property test for group movement boundary constraints
    - **Property 13: Group Movement Boundary Constraint** - no note exceeds bounds after constrained move
    - **Validates: Requirements 4.4, 4.5, 4.6**

  - [x] 6.4 Update drag handling for group movement
    - On mousedown on selected note: start group drag, capture original positions of ALL selected notes
    - On mousemove during group drag: calculate delta, apply constraints, move all notes maintaining relative positions (Property 10)
    - Apply grid snap to primary note, use same delta for others (Property 11, 12)
    - On mouseup: finalize positions
    - On Escape: restore all notes to original positions (Property 14)
    - _Requirements: 4.1, 4.2, 4.3, 4.7_

  - [ ]* 6.5 Write property tests for group movement
    - **Property 10: Group Movement Preserves Relative Positions** - relative differences identical before/after
    - **Property 11: Group Movement Grid Snap Consistency** - primary note snapped, others moved by same delta
    - **Property 12: Group Movement Pitch Delta Uniformity** - all notes pitch changed by same integer delta
    - **Property 14: Group Drag Cancel Restores All Notes** - Escape restores exact original positions
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.7**

- [x] 7. Checkpoint - Verify group movement works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement group deletion
  - [x] 8.1 Implement group deletion via Delete/Backspace key
    - Update `handleDeleteNoteShortcut` to delete ALL selected notes
    - Clear selection after deletion (Property 17)
    - _Requirements: 5.1, 5.4_

  - [x] 8.2 Update right-click deletion logic
    - If clicked note is selected: delete ALL selected notes (Property 15)
    - If clicked note is NOT selected: delete only clicked note (Property 16, existing behavior)
    - Clear selection after group deletion
    - _Requirements: 5.2, 5.3_

  - [ ]* 8.3 Write property tests for group deletion
    - **Property 15: Group Deletion Removes All Selected Notes** - all selected notes removed, unselected remain
    - **Property 16: Right-Click on Unselected Deletes Only Clicked Note** - only clicked note removed
    - **Property 17: Selection Cleared After Deletion** - selection empty after deletion
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [x] 9. Implement Select All keyboard shortcut
  - [x] 9.1 Update `useKeyboardShortcuts` hook to support Ctrl+A/Cmd+A
    - Add `onSelectAll` callback prop to the hook
    - Handle Ctrl+A (Windows/Linux) and Cmd+A (macOS)
    - Prevent default browser behavior (text selection)
    - Do NOT intercept when user is in text input field
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 9.2 Wire up Select All in `PianoRollCanvas`
    - Pass `selectAll` handler to keyboard shortcuts hook
    - _Requirements: 6.1_

- [x] 10. Verify visual feedback and selection persistence
  - [x] 10.1 Ensure selection visual style persists during scroll/zoom
    - Verify selected notes maintain `NOTE_SELECTED_COLOR` and `NOTE_SELECTED_BORDER_COLOR` during pan/zoom
    - Selection state should not change when visible region changes (Property 9)
    - _Requirements: 3.3_

  - [ ]* 10.2 Write property test for selection persistence
    - **Property 9: Selection Persists Across View Changes** - selection unchanged after scroll/zoom
    - **Validates: Requirements 3.3**

  - [x] 10.3 Verify visual update timing
    - Selection changes should update within one animation frame (16.67ms at 60fps)
    - _Requirements: 3.4_

- [x] 11. Final checkpoint - Complete integration testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- The implementation builds incrementally: state migration → click selection → marquee → group move → group delete → shortcuts
- Existing single-note behavior should remain backward compatible via the `selectNote()` function

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.1"] },
    { "id": 2, "tasks": ["1.4", "3.2"] },
    { "id": 3, "tasks": ["3.3", "4.1"] },
    { "id": 4, "tasks": ["3.4", "4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4"] },
    { "id": 6, "tasks": ["4.5", "4.6", "6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["6.3", "6.4"] },
    { "id": 9, "tasks": ["6.5", "8.1"] },
    { "id": 10, "tasks": ["8.2", "9.1"] },
    { "id": 11, "tasks": ["8.3", "9.2"] },
    { "id": 12, "tasks": ["10.1"] },
    { "id": 13, "tasks": ["10.2", "10.3"] }
  ]
}
```
