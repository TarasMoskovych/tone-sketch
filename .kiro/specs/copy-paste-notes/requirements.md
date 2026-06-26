# Requirements Document

## Introduction

This document specifies the requirements for adding copy/paste functionality to the piano roll editor. Users can copy selected notes to an internal clipboard, then paste them at the current playhead position or at a specified offset. This enables rapid composition workflows such as duplicating musical phrases, building patterns from existing material, and rearranging note sequences.

## Glossary

- **Piano_Roll**: The canvas-based note editor component where users create, select, move, and delete notes
- **Clipboard**: An internal application-level data store that holds copied note data (pitch, start, duration, velocity) for later pasting
- **Selected_Notes**: The set of notes currently highlighted via click, Ctrl/Cmd+click, Shift+click, or marquee selection
- **Playhead**: The vertical line indicating the current playback position in beats
- **Paste_Offset**: The temporal shift applied to pasted notes, calculated as the difference between the playhead position and the earliest start time among the copied notes
- **Note**: A musical event with properties: id (UUID), pitch (0-127), start (beats), duration (beats), velocity (0-1)
- **Grid_Snap**: The quantization system that constrains note positions to defined beat subdivisions

## Requirements

### Requirement 1: Copy Selected Notes

**User Story:** As a musician, I want to copy my selected notes to a clipboard, so that I can reuse musical phrases without recreating them manually.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+C (Windows/Linux) or Cmd+C (macOS) while one or more notes are selected, THE Piano_Roll SHALL copy the Selected_Notes data (pitch, start, duration, velocity) to the Clipboard
2. WHEN the copy operation is triggered with no notes selected, THE Piano_Roll SHALL not modify the Clipboard contents
3. THE Clipboard SHALL retain the copied note data for the duration of the browser session until a subsequent copy or cut operation replaces it
4. WHEN notes are copied, THE Piano_Roll SHALL store each note's start time as an offset relative to the earliest start time in the selection (earliest note offset = 0), preserving the relative timing relationships between all copied notes
5. WHEN a copy operation completes successfully, THE Piano_Roll SHALL provide visual feedback indicating the copy occurred within 200 milliseconds of the key press

### Requirement 2: Cut Selected Notes

**User Story:** As a musician, I want to cut selected notes so that I can move musical phrases to a different position without manually deleting the originals.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+X (Windows/Linux) or Cmd+X (macOS) while one or more notes are selected, THE Piano_Roll SHALL copy the Selected_Notes data (pitch, start, duration, velocity) to the Clipboard, preserve the relative timing relationships between the copied notes (each note's start time relative to the earliest note in the selection), and delete the selected notes from the piano roll
2. WHEN the cut operation is triggered with no notes selected, THE Piano_Roll SHALL not modify the Clipboard contents or the note data
3. WHEN a cut operation completes successfully, THE Piano_Roll SHALL set the Selected_Notes to an empty set
4. WHEN a cut operation completes, THE Clipboard SHALL retain the cut note data until a subsequent copy or cut operation replaces it

### Requirement 3: Paste Notes from Clipboard

**User Story:** As a musician, I want to paste previously copied notes at the playhead position, so that I can quickly duplicate and rearrange musical patterns.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+V (Windows/Linux) or Cmd+V (macOS) while the Clipboard contains note data, THE Piano_Roll SHALL create new notes from the Clipboard data at the current Playhead position, preserving each note's original pitch, duration, and velocity values
2. WHEN notes are pasted, THE Piano_Roll SHALL position the earliest pasted note at the Playhead position and offset all other pasted notes by their original relative timing (preserving the Paste_Offset)
3. WHEN notes are pasted, THE Piano_Roll SHALL assign new unique IDs (UUID v4) to each pasted note
4. WHEN notes are pasted while Grid_Snap is enabled, THE Piano_Roll SHALL snap the paste position (Playhead position) to the nearest grid division before placing notes
5. WHEN notes are pasted while Grid_Snap is disabled, THE Piano_Roll SHALL place notes at the exact Playhead position without additional quantization
6. WHEN the paste operation is triggered with an empty Clipboard, THE Piano_Roll SHALL take no action and leave the current selection unchanged
7. WHEN notes are pasted, THE Piano_Roll SHALL select only the newly pasted notes (clearing previous selection)
8. THE Piano_Roll SHALL allow multiple consecutive paste operations from the same Clipboard data without requiring a new copy

### Requirement 4: Duplicate Selected Notes

**User Story:** As a musician, I want a quick shortcut to duplicate selected notes in place, so that I can rapidly build repeating patterns without separate copy and paste steps.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+D (Windows/Linux) or Cmd+D (macOS) while one or more notes are selected, THE Piano_Roll SHALL create duplicates of the Selected_Notes placed immediately after the last note in the selection
2. WHEN notes are duplicated, THE Piano_Roll SHALL position the duplicated group so that the earliest duplicated note starts at the end time (start + duration) of the latest note in the original selection, applying Grid_Snap to that start position if grid snap is enabled
3. WHEN notes are duplicated, THE Piano_Roll SHALL preserve the relative timing, pitch, duration, and velocity of each duplicated note with respect to the earliest note in the original selection
4. WHEN notes are duplicated, THE Piano_Roll SHALL assign new unique IDs (UUID v4) to each duplicated note
5. WHEN notes are duplicated, THE Piano_Roll SHALL select only the newly duplicated notes (clearing previous selection)
6. IF the duplicate operation is triggered with no notes selected, THEN THE Piano_Roll SHALL take no action

### Requirement 5: Clipboard Data Integrity

**User Story:** As a musician, I want the clipboard to reliably store my copied notes, so that paste operations always produce correct results regardless of subsequent edits.

#### Acceptance Criteria

1. WHEN notes are copied to the Clipboard, THE Clipboard SHALL store independent deep copies of all note properties (pitch, start, duration, velocity) that are not affected by subsequent edits, deletions, or movements of the original notes
2. WHEN notes are pasted, THE Piano_Roll SHALL validate that pasted note pitches remain within the valid MIDI range (0-127) and clamp any out-of-range values to the nearest valid boundary
3. WHEN notes are pasted, THE Piano_Roll SHALL validate that pasted note start times remain non-negative and clamp any negative start times to 0
4. WHEN notes are pasted, THE Piano_Roll SHALL validate that pasted note durations remain positive (> 0) and clamp any zero or negative durations to the minimum grid subdivision

### Requirement 6: Keyboard Shortcut Integration

**User Story:** As a musician, I want copy/paste shortcuts to work consistently with the existing piano roll keyboard shortcuts, so that the interaction feels natural and predictable.

#### Acceptance Criteria

1. WHILE the user is typing in a text input field (including text inputs, textareas, and contenteditable elements), THE Piano_Roll SHALL NOT trigger copy, cut, paste, or duplicate operations on piano roll notes and SHALL allow the default browser behavior for those key combinations
2. IF the piano roll container or its children do not have focus, THEN THE Piano_Roll SHALL NOT process copy, cut, paste, or duplicate shortcuts and SHALL allow the default browser behavior for those key combinations
3. WHEN a copy, cut, paste, or duplicate shortcut is triggered and the Piano_Roll processes the operation, THE Piano_Roll SHALL prevent the default browser behavior for that key combination
4. WHILE a note drag, note resize, or marquee selection operation is in progress, THE Piano_Roll SHALL NOT trigger copy, cut, paste, or duplicate operations
