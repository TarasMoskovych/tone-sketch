# Requirements Document

## Introduction

This document specifies the requirements for a multi-note selection feature in the Tone Sketch piano roll editor. Currently, users can only interact with one note at a time (single selection, move, resize, delete). This feature enables users to select multiple notes simultaneously and perform batch operations on them, significantly improving workflow efficiency when editing melodies. The feature includes click-to-select with modifier keys, marquee (rectangle) selection, group movement, group deletion, and visual feedback for selected notes.

## Glossary

- **Piano_Roll_Editor**: The main canvas component that displays notes on a grid with time (beats) on the horizontal axis and pitch (MIDI notes 0-127) on the vertical axis
- **Note**: A musical event with properties: id (UUID), pitch (0-127), start (beats), duration (beats), and velocity (0-1)
- **Selection**: A set of Note IDs representing currently selected notes in the Piano_Roll_Editor
- **Marquee_Selection**: A rectangular area drawn by click-and-drag on an empty area of the grid that selects all notes intersecting with the rectangle
- **Selection_Rectangle**: The visual representation of the marquee selection area during drag
- **Grid_Snap**: A configuration that quantizes note positions to beat divisions when enabled
- **Modifier_Key**: Keyboard keys (Ctrl on Windows/Linux, Cmd on macOS) used to modify selection behavior
- **Shift_Key**: The Shift keyboard key used for additive selection and range selection
- **Group_Move**: The operation of moving all selected notes together while maintaining their relative positions
- **Group_Delete**: The operation of removing all selected notes from the melody simultaneously

## Requirements

### Requirement 1: Click Selection with Modifier Keys

**User Story:** As a composer, I want to select individual notes by clicking on them and use modifier keys to add or remove notes from my selection, so that I can build up a selection of specific notes for batch editing.

#### Acceptance Criteria

1. WHEN a user clicks on a Note without any modifier keys held, THE Piano_Roll_Editor SHALL clear any existing selection and select only the clicked Note
2. WHEN a user clicks on empty grid space without any modifier keys held, THE Piano_Roll_Editor SHALL clear the entire selection
3. WHEN a user holds Ctrl (Windows/Linux) or Cmd (macOS) and clicks on an unselected Note, THE Piano_Roll_Editor SHALL add the clicked Note to the existing selection
4. WHEN a user holds Ctrl (Windows/Linux) or Cmd (macOS) and clicks on an already selected Note, THE Piano_Roll_Editor SHALL remove the clicked Note from the selection
5. WHEN a user holds Shift and clicks on a Note, THE Piano_Roll_Editor SHALL add all notes between the last selected note and the clicked note to the selection based on their start time order
6. IF no notes are currently selected and a user Shift-clicks on a Note, THEN THE Piano_Roll_Editor SHALL select only the clicked Note

### Requirement 2: Marquee Selection

**User Story:** As a composer, I want to draw a selection rectangle by clicking and dragging on empty grid space, so that I can quickly select multiple notes in a region without clicking each one individually.

#### Acceptance Criteria

1. WHEN a user clicks and drags starting from an empty area of the grid, THE Piano_Roll_Editor SHALL display a Selection_Rectangle showing the selection area
2. WHILE the user is dragging the Selection_Rectangle, THE Piano_Roll_Editor SHALL highlight all notes that intersect with the rectangle
3. WHEN the user releases the mouse button after drawing a Selection_Rectangle without modifier keys, THE Piano_Roll_Editor SHALL replace the current selection with all notes intersecting the rectangle
4. WHEN the user releases the mouse button after drawing a Selection_Rectangle while holding Ctrl/Cmd, THE Piano_Roll_Editor SHALL add all notes intersecting the rectangle to the existing selection
5. WHEN the user presses Escape while drawing a Selection_Rectangle, THE Piano_Roll_Editor SHALL cancel the marquee selection and restore the previous selection state
6. THE Selection_Rectangle SHALL be rendered with a semi-transparent fill and a visible border to distinguish it from notes

### Requirement 3: Visual Feedback for Selection

**User Story:** As a composer, I want to clearly see which notes are selected, so that I can confirm my selection before performing batch operations.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL render selected notes with a distinct visual style that differs from unselected notes
2. THE Piano_Roll_Editor SHALL use the NOTE_SELECTED_COLOR (#818cf8) for selected note fill and NOTE_SELECTED_BORDER_COLOR (#a5b4fc) for selected note borders
3. WHILE notes are selected, THE Piano_Roll_Editor SHALL maintain the selected visual style during scrolling and zooming operations
4. WHEN the selection changes, THE Piano_Roll_Editor SHALL update the visual appearance within one animation frame (16.67ms at 60fps)

### Requirement 4: Group Movement

**User Story:** As a composer, I want to move all selected notes together as a group, so that I can reposition entire musical phrases or patterns without losing their relative timing and pitch relationships.

#### Acceptance Criteria

1. WHEN a user clicks and drags on any selected Note, THE Piano_Roll_Editor SHALL move all selected notes together maintaining their relative positions
2. WHILE dragging selected notes horizontally, THE Piano_Roll_Editor SHALL apply Grid_Snap to the primary (dragged) note position when grid snap is enabled, and adjust all other selected notes by the same delta
3. WHILE dragging selected notes vertically, THE Piano_Roll_Editor SHALL update all selected note pitches by the same integer delta
4. THE Piano_Roll_Editor SHALL clamp all note start times to be greater than or equal to 0 during group movement
5. THE Piano_Roll_Editor SHALL clamp all note pitches to the valid MIDI range (0-127) during group movement
6. IF any selected note would move outside valid bounds during group movement, THEN THE Piano_Roll_Editor SHALL constrain the entire group movement to keep all notes within valid bounds
7. WHEN the user presses Escape during a group drag operation, THE Piano_Roll_Editor SHALL restore all selected notes to their original positions before the drag started

### Requirement 5: Group Deletion

**User Story:** As a composer, I want to delete all selected notes at once, so that I can quickly remove unwanted sections of my melody.

#### Acceptance Criteria

1. WHEN the user presses the Delete or Backspace key while notes are selected, THE Piano_Roll_Editor SHALL remove all selected notes from the melody
2. WHEN the user right-clicks on any selected Note, THE Piano_Roll_Editor SHALL remove all selected notes from the melody
3. IF the user right-clicks on an unselected Note, THEN THE Piano_Roll_Editor SHALL remove only the clicked note (existing single-note delete behavior)
4. WHEN notes are deleted via group deletion, THE Piano_Roll_Editor SHALL clear the selection

### Requirement 6: Select All Shortcut

**User Story:** As a composer, I want to quickly select all notes in my melody using a keyboard shortcut, so that I can perform operations on the entire composition efficiently.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+A (Windows/Linux) or Cmd+A (macOS) while the Piano_Roll_Editor has focus, THE Piano_Roll_Editor SHALL select all notes in the melody
2. IF no notes exist in the melody when Select All is triggered, THEN THE Piano_Roll_Editor SHALL maintain an empty selection
3. WHILE the user is typing in a text input field, THE Piano_Roll_Editor SHALL NOT intercept the Ctrl+A/Cmd+A shortcut

### Requirement 7: Selection State Management

**User Story:** As a developer, I want the selection state to be managed consistently across all interactions, so that the feature behaves predictably and can be extended in the future.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL maintain selection state as a Set of Note IDs (Set<string>)
2. WHEN a Note is deleted from the melody, THE Piano_Roll_Editor SHALL remove its ID from the selection if present
3. WHEN notes are loaded or cleared via loadNotes or clearNotes operations, THE Piano_Roll_Editor SHALL clear the selection
4. THE usePianoRoll hook SHALL expose selectedNoteIds (Set<string>), selectNote, selectNotes, deselectNote, deselectAll, and toggleNoteSelection functions for selection management
