# Requirements Document

## Introduction

This feature adds undo/redo functionality to the piano roll editor in tone-sketch. Users can reverse and re-apply note operations (create, delete, move, resize, bulk move, velocity change) using keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z on Windows/Linux, Cmd+Z / Cmd+Shift+Z on macOS). The history is scoped exclusively to note mutations within the piano roll and does not track view changes, synth configuration, or other editor state.

## Glossary

- **History_Stack**: A data structure that stores an ordered sequence of undoable actions performed on piano roll notes, supporting push, undo, and redo operations.
- **Action**: A recorded mutation to the notes array representing a single user operation such as creating, deleting, moving, or resizing one or more notes.
- **Undo_Pointer**: An index into the History_Stack that tracks the current position, separating applied actions from redoable actions.
- **Piano_Roll_Editor**: The canvas-based piano roll component where users create, select, and manipulate musical notes.
- **Note**: A musical event with properties id, pitch, start, duration, and velocity.
- **Batch_Action**: A single undoable action that groups multiple individual note mutations from a single user gesture (e.g., group move of selected notes).

## Requirements

### Requirement 1: Record Note Operations as Undoable Actions

**User Story:** As a melody creator, I want all my note changes to be automatically recorded, so that I can undo mistakes without losing work.

#### Acceptance Criteria

1. WHEN a note is created in the Piano_Roll_Editor, THE History_Stack SHALL record a create Action containing the created Note data.
2. WHEN a note is deleted in the Piano_Roll_Editor, THE History_Stack SHALL record a delete Action containing the deleted Note data.
3. WHEN a note move operation is committed (drag released) in the Piano_Roll_Editor, THE History_Stack SHALL record a move Action containing the Note state before the drag started and the final Note state after the drag ended.
4. WHEN a note resize operation is committed (drag released) in the Piano_Roll_Editor, THE History_Stack SHALL record a resize Action containing the Note state before the drag started and the final Note state after the drag ended.
5. WHEN a bulk note update is committed (group move of multiple selected notes, drag released) in the Piano_Roll_Editor, THE History_Stack SHALL record a single Batch_Action containing the state of all affected notes before the drag started and their final states after the drag ended.
6. WHEN a note velocity is changed in the Piano_Roll_Editor, THE History_Stack SHALL record a velocity Action containing the Note state before and after the change.
7. WHEN a cut operation removes notes from the Piano_Roll_Editor, THE History_Stack SHALL record a delete Batch_Action containing all removed Note data.
8. WHILE a note drag or resize operation is in progress (between mouse-down and mouse-up), THE History_Stack SHALL NOT record any intermediate Actions for that operation.
9. WHEN a bulk velocity update changes multiple selected notes in the Piano_Roll_Editor, THE History_Stack SHALL record a single Batch_Action containing the velocity state of all affected notes before and after the change.

### Requirement 2: Undo Operation

**User Story:** As a melody creator, I want to undo my last action with Ctrl+Z, so that I can quickly revert mistakes.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+Z (or Cmd+Z on macOS) and the Undo_Pointer indicates undoable actions exist, THE Piano_Roll_Editor SHALL revert the notes array to the state before the most recent action and decrement the Undo_Pointer by one position.
2. WHEN the user triggers undo for a create Action, THE Piano_Roll_Editor SHALL remove the created note from the notes array.
3. WHEN the user triggers undo for a delete Action, THE Piano_Roll_Editor SHALL restore the deleted note to the notes array with its original properties (id, pitch, start, duration, and velocity).
4. WHEN the user triggers undo for a move, resize, or velocity Action, THE Piano_Roll_Editor SHALL restore the affected note to its state before the operation.
5. WHEN the user triggers undo for a Batch_Action, THE Piano_Roll_Editor SHALL restore all affected notes to their states before the batch operation as a single atomic update to the notes array.
6. WHEN the user presses Ctrl+Z and no undoable actions exist (Undo_Pointer is at the beginning), THE Piano_Roll_Editor SHALL perform no changes to the notes array and shall not modify the Undo_Pointer.

### Requirement 3: Redo Operation

**User Story:** As a melody creator, I want to redo an undone action with Ctrl+Shift+Z, so that I can re-apply changes I accidentally undid.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+Shift+Z (or Cmd+Shift+Z on macOS) and the Undo_Pointer indicates redoable actions exist, THE Piano_Roll_Editor SHALL re-apply the next undone action to the notes array and increment the Undo_Pointer by one position only if the action is successfully re-applied to the notes.
2. WHEN the user triggers redo for a previously undone create Action, THE Piano_Roll_Editor SHALL re-add the note to the notes array with its original properties preserved.
3. WHEN the user triggers redo for a previously undone delete Action, THE Piano_Roll_Editor SHALL remove the note from the notes array.
4. WHEN the user triggers redo for a previously undone move or resize Action, THE Piano_Roll_Editor SHALL apply the post-action state to the affected note.
5. WHEN the user triggers redo for a previously undone Batch_Action, THE Piano_Roll_Editor SHALL apply the post-action states to all affected notes.
6. WHEN the user presses Ctrl+Shift+Z and no redoable actions exist (Undo_Pointer is at the end), THE Piano_Roll_Editor SHALL perform no changes to the notes array and shall not modify the Undo_Pointer.

### Requirement 4: History Branching on New Action After Undo

**User Story:** As a melody creator, I want the redo history to be cleared when I make a new edit after undoing, so that the history remains linear and predictable.

#### Acceptance Criteria

1. WHEN a new Action is recorded and the Undo_Pointer is not at the end of the History_Stack, THE History_Stack SHALL discard all actions after the current Undo_Pointer position and append the new Action, resulting in a total count equal to the previous Undo_Pointer position plus one.
2. WHEN the redo history is discarded, THE Undo_Pointer SHALL point to the newly recorded action as the most recent, positioned at the end of the History_Stack.
3. WHEN a new Action is recorded and the Undo_Pointer is at the beginning of the History_Stack (all actions have been undone), THE History_Stack SHALL discard all existing actions and store only the new Action with the Undo_Pointer at position one.
4. WHEN a new Action is recorded after undo operations, THE History_Stack SHALL complete both the discard of redo actions and the recording of the new Action before any subsequent undo or redo operation can be processed.

### Requirement 5: History Size Limit

**User Story:** As a melody creator, I want the undo history to have a reasonable limit, so that the application does not consume excessive memory during long editing sessions.

#### Acceptance Criteria

1. THE History_Stack SHALL store a maximum of 100 undo actions.
2. WHEN a new Action is recorded and the History_Stack contains 100 undo actions, THE History_Stack SHALL remove the oldest undo action and append the new action at the most recent position, preserving the relative order of all remaining actions.
3. WHEN the History_Stack reaches maximum capacity and the oldest action is removed, THE History_Stack SHALL discard the removed action permanently so that it is no longer available for undo.
4. THE History_Stack SHALL count only undo entries toward the 100-action limit; redo entries SHALL NOT be counted against this limit.

### Requirement 6: Keyboard Shortcut Integration

**User Story:** As a melody creator, I want undo/redo shortcuts to work when the piano roll has focus, so that the interaction feels natural and consistent with other applications.

#### Acceptance Criteria

1. WHILE the Piano_Roll_Editor canvas has focus, WHEN the user presses Ctrl+Z (Cmd+Z on macOS), THE Piano_Roll_Editor SHALL trigger the undo operation, reverting the most recent undoable action from the history stack.
2. WHILE the Piano_Roll_Editor canvas has focus, WHEN the user presses Ctrl+Shift+Z (Cmd+Shift+Z on macOS) or Ctrl+Y (Cmd+Y on macOS), THE Piano_Roll_Editor SHALL trigger the redo operation, re-applying the most recently undone action from the history stack.
3. WHILE a note drag, note resize, or marquee selection operation is in progress, THE Piano_Roll_Editor SHALL not execute undo or redo keyboard shortcuts and SHALL not call preventDefault on those key combinations.
4. WHILE the Piano_Roll_Editor canvas does not have focus, THE Piano_Roll_Editor SHALL not intercept undo and redo keyboard shortcuts, but SHALL allow undo/redo operations triggered through other means (such as menu commands or other UI elements) to execute normally.
5. WHEN the user triggers undo or redo via keyboard shortcut and the Piano_Roll_Editor canvas has focus, THE Piano_Roll_Editor SHALL prevent the browser default behavior for that key combination.
6. IF the undo history stack is empty when the user triggers an undo shortcut, THEN THE Piano_Roll_Editor SHALL perform no action and leave the current state unchanged.
7. IF the redo history stack is empty when the user triggers a redo shortcut, THEN THE Piano_Roll_Editor SHALL perform no action and leave the current state unchanged.
8. WHILE the user is typing in a text input field within the application, THE Piano_Roll_Editor SHALL not intercept undo and redo keyboard shortcuts, allowing normal browser or field-level undo behavior.

### Requirement 7: Selection State After Undo/Redo

**User Story:** As a melody creator, I want the note selection to update appropriately after undo or redo, so that I can see which notes were affected.

#### Acceptance Criteria

1. WHEN an undo or redo operation completes and notes were restored or modified, THE Piano_Roll_Editor SHALL clear the existing selection and then select all notes that were restored or modified by the operation. IF no notes were restored or modified, THE Piano_Roll_Editor SHALL skip selecting affected notes.
2. WHEN an undo or redo operation restores multiple notes (Batch_Action), THE Piano_Roll_Editor SHALL select all restored or modified notes from the batch.
3. WHEN an undo operation removes a note (undoing a create), THE Piano_Roll_Editor SHALL clear the selection without selecting any notes.
4. WHEN a redo operation removes a note (redoing a delete Action), THE Piano_Roll_Editor SHALL clear the selection without selecting any notes.
5. WHEN an undo or redo operation modifies a note in place (reverting or re-applying a move, resize, or velocity change), THE Piano_Roll_Editor SHALL select the modified note.

### Requirement 8: History Reset on Full Note Replacement

**User Story:** As a melody creator, I want the undo history to reset when notes are bulk-replaced (e.g., MIDI import or load), so that undo does not attempt to restore an unrelated previous state.

#### Acceptance Criteria

1. WHEN notes are loaded via MIDI import (loadNotes operation), THE History_Stack SHALL discard all actions (both undoable and redoable) so that the stack contains zero entries.
2. WHEN notes are cleared via the Clear All operation, THE History_Stack SHALL record the clear as a single Batch_Action containing the state of all deleted notes before the clear and an empty notes array as the after-state, and the Undo_Pointer SHALL remain available for undo operations on the recorded action.
3. WHEN the History_Stack is cleared due to a loadNotes operation, THE Undo_Pointer SHALL be reset to the beginning so that no undo or redo actions are available.
4. WHEN notes are loaded via MIDI import (loadNotes operation) with an empty notes array, THE History_Stack SHALL be cleared in the same manner as a non-empty loadNotes operation.
