# Requirements Document

## Introduction

The Velocity Lane Editor adds an FL Studio-style collapsible panel below the piano roll canvas that visualizes and enables editing of note velocities. Each note's velocity is displayed as a vertical bar proportional to its value (0–1). The panel shares the piano roll's horizontal axis, synchronizing scroll and playhead position. Users can adjust velocities by dragging bars, with multi-note editing support for selected notes.

## Glossary

- **Velocity_Lane**: A collapsible panel rendered below the Piano_Roll_Canvas that displays vertical bars representing note velocity values.
- **Velocity_Bar**: A vertical rectangle within the Velocity_Lane corresponding to a single note, whose height represents the note's velocity (0–1).
- **Piano_Roll_Canvas**: The existing HTML5 Canvas component that renders and enables editing of musical notes.
- **Melody_Editor**: The parent component that manages shared state (notes, selection, visible region, playhead) and composes the Piano_Roll_Canvas and Velocity_Lane.
- **Visible_Region**: The portion of the timeline and pitch range currently displayed, defined by startBeat, endBeat, startPitch, and endPitch.
- **Playhead**: A vertical line indicating the current playback position in beats.
- **Selected_Notes**: The set of note IDs currently selected by the user.
- **Velocity**: A numeric value between 0 and 1 (inclusive) representing a note's volume/intensity.

## Requirements

### Requirement 1: Velocity Lane Panel Visibility Toggle

**User Story:** As a music producer, I want to show or hide the velocity lane panel, so that I can focus on note placement when velocity editing is not needed.

#### Acceptance Criteria

1. WHEN the user activates the velocity lane toggle, THE Melody_Editor SHALL display the Velocity_Lane below the Piano_Roll_Canvas and reduce the Piano_Roll_Canvas height to accommodate the Velocity_Lane, with the Velocity_Lane occupying approximately 25% of the total available editor height and the Piano_Roll_Canvas occupying the remaining approximately 75%.
2. WHEN the user deactivates the velocity lane toggle, THE Melody_Editor SHALL hide the Velocity_Lane and restore the Piano_Roll_Canvas to full available height.
3. THE Melody_Editor SHALL initialize the Velocity_Lane visibility state as hidden by default when the editor first loads.
4. WHILE the Velocity_Lane is hidden, THE Melody_Editor SHALL allocate the full available vertical space to the Piano_Roll_Canvas, minus any space required by other UI elements such as toolbars or timelines.
5. WHEN the Velocity_Lane toggle state changes, THE Melody_Editor SHALL preserve all current editor state including note data, selection, scroll position, and playhead position.

### Requirement 2: Velocity Bar Rendering

**User Story:** As a music producer, I want to see a vertical bar for each note representing its velocity, so that I can visually assess the dynamics of my composition.

#### Acceptance Criteria

1. WHILE the Velocity_Lane is visible, THE Velocity_Lane SHALL render one Velocity_Bar for each note whose horizontal extent overlaps the current Visible_Region beat range.
2. THE Velocity_Lane SHALL position each Velocity_Bar at the same horizontal pixel offset as the corresponding note in the Piano_Roll_Canvas, computed as (note.start - Visible_Region.startBeat) × pixelsPerBeat.
3. THE Velocity_Lane SHALL render each Velocity_Bar with the same pixel width as the corresponding note in the Piano_Roll_Canvas, computed as note.duration × pixelsPerBeat.
4. THE Velocity_Lane SHALL render each Velocity_Bar with a height equal to note.velocity × laneHeight using linear proportional mapping, where velocity 1.0 fills the full lane height and velocity 0 produces a bar with zero height.
5. THE Velocity_Lane SHALL render Velocity_Bars anchored to the bottom of the lane (bars grow upward from the baseline).
6. WHEN no notes exist in the current composition, THE Velocity_Lane SHALL render only the baseline and scale indicator with an empty grid area.

### Requirement 3: Horizontal Scroll and Playhead Synchronization

**User Story:** As a music producer, I want the velocity lane to stay aligned with the piano roll when I scroll or during playback, so that I can always see which bar corresponds to which note.

#### Acceptance Criteria

1. WHILE the Velocity_Lane is visible, THE Velocity_Lane SHALL use the same Visible_Region startBeat and endBeat values as the Piano_Roll_Canvas for horizontal positioning.
2. WHEN the user scrolls horizontally in the Piano_Roll_Canvas, THE Velocity_Lane SHALL update its horizontal view to match the new Visible_Region startBeat and endBeat within the same animation frame.
3. WHEN the user scrolls horizontally in the Velocity_Lane via mouse wheel, THE Piano_Roll_Canvas SHALL update its horizontal view to match the new Visible_Region startBeat and endBeat within the same animation frame.
4. WHILE playback is active, THE Velocity_Lane SHALL render the Playhead at the same horizontal pixel offset as the Piano_Roll_Canvas Playhead for the current playhead beat position, with an acceptable tolerance of up to 2 pixels deviation due to floating-point rounding or different rendering contexts.
5. WHILE the Velocity_Lane is visible, THE Velocity_Lane SHALL render beat grid lines at the same horizontal pixel offsets as the corresponding Piano_Roll_Canvas beat grid lines, with zero pixel deviation.

### Requirement 4: Single Note Velocity Editing

**User Story:** As a music producer, I want to drag a velocity bar up or down to change a note's velocity, so that I can fine-tune the dynamics of individual notes.

#### Acceptance Criteria

1. WHEN the user clicks and drags vertically on a Velocity_Bar, THE Velocity_Lane SHALL set the corresponding note's velocity to the value determined by the pointer's vertical position within the lane, where the lane bottom represents velocity 0 and the lane top represents velocity 1.
2. THE Velocity_Lane SHALL clamp the resulting velocity value to the range 0 to 1 inclusive.
3. WHEN the user releases the mouse after dragging a Velocity_Bar, THE Velocity_Lane SHALL commit the final velocity value to the note state.
4. WHILE the user drags a Velocity_Bar, THE Velocity_Lane SHALL update the bar height on every pointer move event to reflect the current velocity value before the mouse is released.
5. IF the user presses the Escape key during a Velocity_Bar drag, THEN THE Velocity_Lane SHALL cancel the drag operation and restore the note's velocity to the value it held before the drag began.

### Requirement 5: Multi-Note Velocity Editing

**User Story:** As a music producer, I want to adjust multiple selected notes' velocities together by dragging one bar, so that I can efficiently shape the dynamics of a musical passage.

#### Acceptance Criteria

1. WHEN two or more notes are in the Selected_Notes set and the user drags a Velocity_Bar belonging to a selected note, THE Velocity_Lane SHALL compute the velocity delta as the difference between the dragged bar's current drag position value and its original velocity at drag start, and apply that same delta to all notes in the Selected_Notes set relative to each note's original velocity at drag start.
2. THE Velocity_Lane SHALL clamp each affected note's velocity independently to the range 0 to 1 inclusive after applying the delta.
3. WHILE the user drags during a multi-note velocity edit, THE Velocity_Lane SHALL update all affected Velocity_Bars at a minimum of 30 frames per second.
4. WHEN the user drags a Velocity_Bar that does not belong to a selected note, THE Velocity_Lane SHALL adjust only the dragged note's velocity regardless of the current selection.
5. WHEN exactly one note is in the Selected_Notes set and the user drags that note's Velocity_Bar, THE Velocity_Lane SHALL adjust only that single note's velocity (single-note editing behavior). WHEN exactly one note is in the Selected_Notes set and the user drags a different note's Velocity_Bar, THE Velocity_Lane SHALL treat this as single-note editing of the dragged note.
6. WHEN the user releases the mouse after a multi-note velocity drag, THE Velocity_Lane SHALL commit the final velocity values of all affected notes to the note state.

### Requirement 6: Visual Selection Correspondence

**User Story:** As a music producer, I want selected notes to be visually highlighted in both the piano roll and the velocity lane, so that I can see which notes will be affected by edits.

#### Acceptance Criteria

1. WHILE a note is in the Selected_Notes set, THE Velocity_Lane SHALL render that note's Velocity_Bar with a distinct selected fill color that is visually different from the unselected bar color. WHILE a note is NOT in the Selected_Notes set, THE Velocity_Lane SHALL render that note's Velocity_Bar with the unselected fill color.
2. WHEN the user selects or deselects notes in the Piano_Roll_Canvas, THE Velocity_Lane SHALL update the visual state of the corresponding Velocity_Bars within the next animation frame.
3. WHEN the user clicks on a Velocity_Bar in the Velocity_Lane without holding a modifier key, THE Velocity_Lane SHALL replace the current selection with only the corresponding note.
4. WHEN the user clicks on any Velocity_Bar in the Velocity_Lane while holding Shift or Ctrl, THE Velocity_Lane SHALL toggle the clicked note in the Selected_Notes set (add if not selected, remove if already selected), regardless of which note was clicked.
5. THE Velocity_Lane SHALL use the same Selected_Notes state as the Piano_Roll_Canvas (shared selection source of truth).

### Requirement 7: Modular Component Architecture

**User Story:** As a developer, I want the velocity lane to be implemented as separate components and hooks following the project's existing patterns, so that the code is maintainable and testable.

#### Acceptance Criteria

1. THE Velocity_Lane SHALL be implemented as a dedicated component directory (e.g., `components/VelocityLane/`) separate from the PianoRoll component.
2. THE Velocity_Lane component directory SHALL contain separate files for the canvas component, rendering functions, constants, types, and utility functions, following the same structure as the existing PianoRoll directory.
3. THE Velocity_Lane drag interaction logic SHALL be extracted into a dedicated custom hook (e.g., `useVelocityDrag`) separate from the rendering component.
4. THE Velocity_Lane SHALL expose a clean public API through an index.ts barrel export, matching the PianoRoll export pattern.
5. THE shared state management between Piano_Roll_Canvas and Velocity_Lane SHALL be handled by the parent Melody_Editor component via props, not through direct coupling between the two components.

### Requirement 8: Documentation Updates

**User Story:** As a developer, I want the project documentation to reflect the new velocity lane feature, so that contributors understand the system architecture and capabilities.

#### Acceptance Criteria

1. WHEN the velocity lane feature is fully implemented, THE project README.md SHALL be updated to document the velocity lane editing capability in the feature list. IF the README update fails, THE feature implementation SHALL still be considered complete.
2. WHEN the velocity lane feature is fully implemented, THE ARCHITECTURE.md file SHALL be updated to include the Velocity_Lane component in the system architecture description, including its relationship to the Piano_Roll_Canvas and Melody_Editor. Documentation updates SHALL NOT occur before the feature is fully implemented.
3. THE ARCHITECTURE.md update SHALL document the data flow between the Melody_Editor, Piano_Roll_Canvas, and Velocity_Lane components.

### Requirement 9: Velocity Lane Canvas Rendering

**User Story:** As a music producer, I want the velocity lane to render smoothly using the same canvas technology as the piano roll, so that performance remains consistent.

#### Acceptance Criteria

1. THE Velocity_Lane SHALL render using an HTML5 Canvas element where the canvas buffer size equals the CSS display size multiplied by window.devicePixelRatio, and the 2D context is scaled by devicePixelRatio, matching the PianoRoll setupCanvas approach.
2. WHILE a drag interaction is active on the Velocity_Lane, THE Velocity_Lane SHALL render at a minimum of 30 frames per second.
3. WHILE the Velocity_Lane is visible, WHEN a note is added, OR a note is removed, OR any note property (pitch, start, duration, or velocity) is changed, THE Velocity_Lane SHALL re-render within the next animation frame.
4. THE Velocity_Lane SHALL render a horizontal baseline at the y-position corresponding to velocity 0, spanning the full width of the lane's grid area. WHILE notes exist in the composition, THE Velocity_Lane SHALL always render the baseline, ensuring it remains visible alongside velocity bars.
5. THE Velocity_Lane SHALL display a scale indicator on the left side of the lane, occupying a fixed width no greater than 40 pixels, showing labeled tick marks at velocity values 0, 0.5, and 1.
6. THE Velocity_Lane SHALL share the same horizontal time axis and visible beat range as the PianoRoll, so that velocity bars align horizontally with their corresponding notes.
