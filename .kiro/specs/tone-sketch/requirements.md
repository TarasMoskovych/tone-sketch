# Requirements Document

## Introduction

Tone Sketch is a web-based music creation platform that enables users to quickly sketch melodies using a piano roll editor, hear them instantly through a built-in synthesizer, and share them publicly with others. The platform prioritizes speed of creation and ease of sharing over complex DAW features. Built as a full-stack Next.js application with Tone.js for audio synthesis and PostgreSQL for data persistence.

## Glossary

- **Piano_Roll_Editor**: A grid-based visual interface where users create and edit musical notes by clicking, dragging, and resizing note blocks on a time-pitch grid
- **Note**: A musical event with properties: pitch (MIDI 0-127), start (beats), duration (beats), and velocity (0-1)
- **Synthesizer**: The audio engine that generates sound from notes using oscillators and audio parameters
- **Oscillator**: A sound wave generator supporting types: sine, square, sawtooth, and triangle
- **ADSR_Envelope**: Attack, Decay, Sustain, Release parameters that shape how a sound evolves over time
- **Playhead**: A visual indicator showing the current playback position on the timeline
- **Melody**: A composition containing a collection of notes, tempo setting, and synthesizer configuration
- **Owner**: The user who created a melody and has exclusive edit and delete permissions
- **Feed**: The public homepage displaying a paginated list of all melodies
- **Grid_Snap**: Quantization feature that aligns notes to discrete time intervals
- **MIDI_File**: A standard music file format (.mid) for importing and exporting note data
- **Tempo**: The speed of playback measured in beats per minute (BPM)
- **Custom_Hook**: A React hook function (use* naming convention) that encapsulates reusable stateful logic and side effects
- **Shared_Component**: A reusable React component that provides UI functionality across multiple pages or features
- **Icon_Component**: A reusable SVG-based React component that renders a specific icon, accepting className props for styling
- **Keyboard_Piano**: A feature that maps computer keyboard keys to piano notes, allowing users to play musical pitches using QWERTY keyboard input
- **SynthControls**: The sidebar UI component that displays and manages all synthesizer parameters including oscillator type, ADSR envelope, filter, and audio effects
- **ResizeObserver**: A browser API that monitors changes to an element's dimensions, enabling responsive canvas rendering

## Requirements

### Requirement 1: Piano Roll Grid Display

**User Story:** As a music creator, I want to see a grid-based editor, so that I can visualize note placement across time and pitch.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL display a grid with horizontal axis representing time in beats and vertical axis representing pitch from MIDI note 0 to 127
2. THE Piano_Roll_Editor SHALL render existing notes as rectangular blocks positioned according to their pitch, start time, and duration
3. THE Piano_Roll_Editor SHALL display pitch labels on the vertical axis showing note names in scientific pitch notation at minimum for each octave boundary (C0, C1, C2, through C10)
4. THE Piano_Roll_Editor SHALL display time markers on the horizontal axis showing beat numbers at intervals of 1 beat
5. WHILE the user is performing drag, resize, or scroll operations, THE Piano_Roll_Editor SHALL render the grid at 60 frames per second
6. THE Piano_Roll_Editor SHALL provide scroll controls to navigate the visible region across the full pitch range (MIDI 0-127) and time range of the Melody
7. THE Piano_Roll_Editor SHALL display a default visible region of 16 beats horizontally and 24 semitones (2 octaves) vertically upon initial load

### Requirement 2: Note Creation

**User Story:** As a music creator, I want to add notes by clicking on the grid, so that I can compose melodies visually.

#### Acceptance Criteria

1. WHEN the user clicks on a grid position where no existing Note occupies that pitch and time, THE Piano_Roll_Editor SHALL create a new Note at the clicked pitch and time position
2. WHEN a Note is created, THE Piano_Roll_Editor SHALL assign default duration of one beat and default velocity of 0.8
3. WHEN Grid_Snap is enabled, THE Piano_Roll_Editor SHALL align the new Note start time to the nearest grid division
4. WHEN a Note is created, THE Piano_Roll_Editor SHALL display the Note within 100 milliseconds of the click event
5. IF the user clicks on a grid position where an existing Note occupies that pitch and time, THEN THE Piano_Roll_Editor SHALL select the existing Note instead of creating a new Note

### Requirement 3: Note Editing - Horizontal Movement

**User Story:** As a music creator, I want to drag notes horizontally, so that I can adjust when notes play in time.

#### Acceptance Criteria

1. WHEN the user drags a Note horizontally, THE Piano_Roll_Editor SHALL update the Note start time to match the drag position in beats
2. WHILE Grid_Snap is enabled, WHEN the user drags a Note horizontally, THE Piano_Roll_Editor SHALL align the Note start time to the nearest grid division
3. THE Piano_Roll_Editor SHALL constrain Note start time to non-negative values, clamping at zero when dragged beyond the left boundary
4. WHILE the user is dragging a Note, THE Piano_Roll_Editor SHALL update the Note display position at 60 frames per second
5. IF the user cancels a drag operation, THEN THE Piano_Roll_Editor SHALL restore the Note to its original position before the drag began

### Requirement 4: Note Editing - Vertical Movement

**User Story:** As a music creator, I want to drag notes vertically, so that I can change the pitch of notes.

#### Acceptance Criteria

1. WHEN the user drags a Note vertically, THE Piano_Roll_Editor SHALL update the Note pitch to the nearest MIDI note value corresponding to the drag position
2. THE Piano_Roll_Editor SHALL constrain Note pitch values between MIDI note 0 and MIDI note 127
3. WHILE the user is dragging a Note vertically, THE Piano_Roll_Editor SHALL update the Note display position at 60 frames per second
4. THE Piano_Roll_Editor SHALL apply pitch changes independently of Grid_Snap settings, as pitch values are inherently quantized to discrete MIDI notes

### Requirement 5: Note Editing - Duration Resize

**User Story:** As a music creator, I want to resize notes, so that I can control how long each note plays.

#### Acceptance Criteria

1. WHEN the user drags the right edge of a Note, THE Piano_Roll_Editor SHALL update the Note duration proportionally to the horizontal drag distance in grid units
2. WHEN Grid_Snap is enabled during resize, THE Piano_Roll_Editor SHALL align the Note end time to the nearest grid division
3. WHILE Grid_Snap is enabled, THE Piano_Roll_Editor SHALL enforce a minimum Note duration of one grid division
4. WHILE Grid_Snap is disabled, THE Piano_Roll_Editor SHALL enforce a minimum Note duration of 0.1 beats
5. THE Piano_Roll_Editor SHALL update the Note display width at 60 frames per second during the resize operation

### Requirement 6: Note Deletion

**User Story:** As a music creator, I want to delete notes, so that I can remove mistakes from my composition.

#### Acceptance Criteria

1. WHEN the user selects a Note and presses the Delete key or Backspace key, THE Piano_Roll_Editor SHALL remove the Note from the Melody
2. WHEN the user right-clicks on a Note, THE Piano_Roll_Editor SHALL remove the Note from the Melody
3. WHEN a Note is deleted, THE Piano_Roll_Editor SHALL update the display to remove the Note within 100 milliseconds
4. WHILE playback is active AND the user deletes a Note that is currently sounding, THE Piano_Roll_Editor SHALL stop the audio for that Note immediately
5. IF Note deletion fails due to a system error, THEN THE Piano_Roll_Editor SHALL display an error message indicating the deletion could not be completed and retain the Note in the Melody

### Requirement 7: Grid Snap Configuration

**User Story:** As a music creator, I want to toggle grid snapping, so that I can choose between precise placement and free-form editing.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL provide a toggle control to enable or disable Grid_Snap, with Grid_Snap enabled by default
2. THE Piano_Roll_Editor SHALL provide grid division options of 1 beat, 1/2 beat, 1/4 beat, 1/8 beat, and 1/16 beat, with 1/4 beat as the default
3. THE Piano_Roll_Editor SHALL visually indicate the current Grid_Snap state on the toggle control
4. WHILE Grid_Snap is enabled, THE Piano_Roll_Editor SHALL quantize all note placement and resize operations to the selected grid division
5. WHILE Grid_Snap is disabled, THE Piano_Roll_Editor SHALL allow note positioning at 1/32 beat resolution

### Requirement 8: Playhead Display

**User Story:** As a music creator, I want to see a playhead indicator, so that I can track the current playback position.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL display the Playhead as a vertical line at its current position at all times
2. WHILE playback is active, THE Piano_Roll_Editor SHALL move the Playhead position synchronized with the audio playback, updating at minimum 60 frames per second
3. WHEN playback stops, THE Piano_Roll_Editor SHALL retain the Playhead at the stop position
4. THE Piano_Roll_Editor SHALL synchronize Playhead position with audio timing within 50 milliseconds accuracy
5. WHEN the user clicks on the timeline area, THE Piano_Roll_Editor SHALL reposition the Playhead to the clicked time position
6. THE Piano_Roll_Editor SHALL render the Playhead as a high-contrast color line (bright red #FF0000 or equivalent high-visibility color) that is clearly distinguishable from the grid and note elements
7. THE Piano_Roll_Editor SHALL render the Playhead with a minimum width of 2 pixels
8. THE Piano_Roll_Editor SHALL render the Playhead spanning the full height of the visible piano roll grid area
9. THE Piano_Roll_Editor SHALL render the Playhead with a z-index higher than all Note elements, ensuring the Playhead is always visible on top of notes

### Requirement 9: Synthesizer Oscillator Configuration

**User Story:** As a music creator, I want to choose different oscillator types, so that I can shape the basic tone of my melody.

#### Acceptance Criteria

1. THE Synthesizer SHALL provide oscillator type selection with options: sine, square, sawtooth, and triangle, with sine as the default
2. WHEN the user selects an oscillator type, THE Synthesizer SHALL apply the selected waveform to all subsequent note playback
3. THE Synthesizer SHALL apply oscillator type changes within 50 milliseconds without stopping playback
4. THE Synthesizer SHALL persist oscillator type settings as part of the Melody configuration

### Requirement 10: Synthesizer Volume Control

**User Story:** As a music creator, I want to adjust the volume, so that I can control the loudness of playback.

#### Acceptance Criteria

1. THE Synthesizer SHALL provide a volume control with range from 0 (silent) to 1 (maximum) and a default value of 0.8
2. WHEN the user adjusts the volume control, THE Synthesizer SHALL apply the new volume level to all audio output, including currently playing notes, within 50 milliseconds
3. THE Synthesizer SHALL display the current volume level value to the user
4. THE Synthesizer SHALL persist volume settings as part of the Melody configuration

### Requirement 11: Synthesizer ADSR Envelope

**User Story:** As a music creator, I want to adjust attack and release parameters, so that I can shape how notes fade in and out.

#### Acceptance Criteria

1. THE Synthesizer SHALL provide attack parameter control with range from 0 to 2 seconds and default value of 0.01 seconds
2. THE Synthesizer SHALL provide decay parameter control with range from 0 to 2 seconds and default value of 0.1 seconds
3. THE Synthesizer SHALL provide sustain parameter control with range from 0 to 1 representing the sustain level and default value of 0.5
4. THE Synthesizer SHALL provide release parameter control with range from 0 to 5 seconds and default value of 0.5 seconds
5. WHEN the user adjusts any ADSR_Envelope parameter, THE Synthesizer SHALL apply the change to all note triggers occurring after the adjustment
6. THE Synthesizer SHALL persist ADSR_Envelope settings as part of the Melody configuration

### Requirement 12: Synthesizer Filter

**User Story:** As a music creator, I want to apply frequency filters, so that I can further shape the sound character.

#### Acceptance Criteria

1. THE Synthesizer SHALL provide an optional filter with types: low-pass and high-pass, with the filter disabled by default
2. THE Synthesizer SHALL provide filter frequency control with range from 20 Hz to 20000 Hz with a default value of 1000 Hz
3. WHEN the user enables a filter, THE Synthesizer SHALL apply the filter to the audio output within 50 milliseconds
4. WHEN the user changes the filter type during playback, THE Synthesizer SHALL apply the new filter type within 50 milliseconds without stopping playback
5. THE Synthesizer SHALL persist filter settings including enabled state, filter type, and frequency as part of the Melody configuration

### Requirement 13: Playback Start and Pause

**User Story:** As a music creator, I want to play and pause my melody, so that I can hear my composition.

#### Acceptance Criteria

1. WHEN the user clicks the play button, THE Synthesizer SHALL begin playing notes from the current Playhead position
2. WHEN the user clicks the pause button during playback, THE Synthesizer SHALL stop all currently sounding notes and maintain the current Playhead position
3. WHEN the user clicks the play button while paused, THE Synthesizer SHALL resume playback from the paused position
4. IF the user clicks the play button when the Playhead is at or past the last note end time, THEN THE Synthesizer SHALL reset the Playhead to position zero before beginning playback
5. IF the Melody contains no notes when the user clicks the play button, THEN THE Synthesizer SHALL remain in stopped state with the Playhead at position zero
6. THE Synthesizer SHALL trigger note playback within 50 milliseconds of scheduled time

### Requirement 14: Playback Stop

**User Story:** As a music creator, I want to stop playback completely, so that I can reset to the beginning.

#### Acceptance Criteria

1. WHEN the user clicks the stop button, THE Synthesizer SHALL silence all currently sounding notes and stop all audio playback within 50 milliseconds
2. WHEN the user clicks the stop button, THE Piano_Roll_Editor SHALL reset the Playhead to position zero
3. IF the user clicks the stop button while playback is not active, THEN THE Piano_Roll_Editor SHALL reset the Playhead to position zero without error

### Requirement 15: Loop Playback

**User Story:** As a music creator, I want to loop playback, so that I can hear my melody repeat continuously.

#### Acceptance Criteria

1. THE Synthesizer SHALL provide a loop toggle control
2. WHILE loop mode is enabled, WHEN playback reaches the end of the last Note in the Melody, THE Synthesizer SHALL restart playback from position zero within 50 milliseconds
3. WHILE loop mode is disabled, WHEN playback reaches the end of the last Note in the Melody, THE Synthesizer SHALL stop playback
4. IF loop mode is enabled AND the Melody contains no Notes, THEN THE Synthesizer SHALL stop playback immediately

### Requirement 16: MIDI File Import

**User Story:** As a music creator, I want to import MIDI files, so that I can use existing compositions as starting points.

#### Acceptance Criteria

1. WHEN the user uploads a valid MIDI_File up to 5 MB in size, THE Piano_Roll_Editor SHALL parse the file and convert all tracks to Note objects, merging multiple tracks into a single Melody
2. WHEN the user uploads a valid MIDI_File, THE Piano_Roll_Editor SHALL replace any existing notes in the editor with the imported notes
3. WHEN the user uploads a valid MIDI_File, THE Piano_Roll_Editor SHALL extract the initial tempo information and set the Melody tempo, ignoring any subsequent tempo changes in the file
4. IF the user uploads a MIDI_File that exceeds 5 MB, THEN THE Piano_Roll_Editor SHALL display an error message indicating the file exceeds the maximum allowed size
5. IF the user uploads an invalid or corrupted MIDI_File, THEN THE Piano_Roll_Editor SHALL display an error message indicating the file could not be parsed
6. THE MIDI_File parser SHALL support Standard MIDI File format types 0 and 1
7. WHEN a valid MIDI_File is imported, exported, and re-imported, THE Piano_Roll_Editor SHALL produce a set of notes with identical pitch, start time, and duration values

### Requirement 17: MIDI File Export

**User Story:** As a music creator, I want to export my melody as a MIDI file, so that I can use it in other music software.

#### Acceptance Criteria

1. WHEN the user clicks the export button, THE Piano_Roll_Editor SHALL generate a MIDI_File containing all notes from the current Melody with their pitch, start time, duration, and velocity properties
2. WHEN the user clicks the export button, THE Piano_Roll_Editor SHALL include the current Melody tempo in the exported MIDI_File tempo track
3. WHEN the user clicks the export button, THE Piano_Roll_Editor SHALL trigger a file download with filename consisting of the Melody title with invalid filename characters replaced by underscores and the .mid file extension
4. THE MIDI_File exporter SHALL produce valid Standard MIDI File format type 0
5. IF the current Melody contains no notes, THEN THE Piano_Roll_Editor SHALL generate a MIDI_File containing only the tempo track with no note events

### Requirement 18: Melody Creation and Save

**User Story:** As a music creator, I want to save my melody, so that I can access it later and share it with others.

#### Acceptance Criteria

1. WHEN the user clicks the save button on the create page, THE Application SHALL send a POST request to /api/melodies with melody data including title, notes, tempo, and Synthesizer settings
2. WHEN the save request succeeds, THE Application SHALL redirect the user to the melody page at /m/[id] where id is returned in the success response
3. WHEN the save request succeeds, THE Application SHALL save the complete Melody including notes, tempo, and Synthesizer settings atomically
4. IF the save request fails, THEN THE Application SHALL display an error message indicating the failure reason and retain the user's work in the editor
5. WHEN a new Melody is created, THE Application SHALL assign a unique owner_id to the Melody
6. IF the melody title is empty or exceeds 200 characters, THEN THE Application SHALL reject the save request with a validation error
7. THE Application SHALL allow saving a Melody with an empty notes array

### Requirement 19: Melody Retrieval

**User Story:** As a user, I want to view any public melody, so that I can see and hear other creators' work.

#### Acceptance Criteria

1. WHEN the user navigates to /m/[id], THE Application SHALL fetch the Melody data from GET /api/melodies/[id] with a maximum response timeout of 10 seconds
2. WHILE the Melody data is being fetched, THE Application SHALL display a loading indicator
3. WHEN the Melody data loads successfully, THE Application SHALL display the notes in the Piano_Roll_Editor
4. WHEN the Melody data loads successfully, THE Application SHALL configure the Synthesizer with the saved settings including oscillator type, volume, ADSR_Envelope parameters, and filter configuration
5. IF the requested Melody does not exist, THEN THE Application SHALL display a not found message
6. IF the API request fails due to network error or server error, THEN THE Application SHALL display an error message indicating the failure and provide an option to retry the request

### Requirement 20: Melody Update

**User Story:** As a melody owner, I want to edit my saved melody, so that I can improve my composition over time.

#### Acceptance Criteria

1. WHILE the user is the Owner of a Melody, THE Application SHALL display the Piano_Roll_Editor with existing notes, Synthesizer controls with saved settings, and a save button on the melody page
2. WHILE the user is not the Owner of a Melody, THE Application SHALL display the Piano_Roll_Editor and Synthesizer controls in read-only mode without a save button
3. WHEN the Owner saves changes, THE Application SHALL send a PUT request to /api/melodies/[id] with the updated notes, tempo, and Synthesizer settings
4. WHEN the update request succeeds, THE Application SHALL display a success indication to the user
5. IF the update request fails, THEN THE Application SHALL display an error message and retain the user's changes in the editor
6. THE Application SHALL save updates atomically without partial writes
7. IF a non-owner attempts to update a Melody, THEN THE Application SHALL reject the request with a 403 Forbidden response

### Requirement 21: Melody Deletion

**User Story:** As a melody owner, I want to delete my melody, so that I can remove compositions I no longer want public.

#### Acceptance Criteria

1. WHILE the user is the Owner of a Melody, THE Application SHALL display a delete button on the melody page
2. WHEN the user is not the Owner of a Melody, THE Application SHALL NOT display a delete button on the melody page
3. WHEN the Owner clicks the delete button, THE Application SHALL display a confirmation dialog requesting the user to confirm the deletion
4. WHEN the Owner confirms deletion in the confirmation dialog, THE Application SHALL send a DELETE request to /api/melodies/[id]
5. WHEN the deletion request succeeds, THE Application SHALL redirect the user to the homepage
6. IF the deletion request fails, THEN THE Application SHALL display an error message indicating the deletion failed and the Melody remains available
7. IF a non-owner attempts to delete a Melody, THEN THE Application SHALL reject the request with a 403 Forbidden response

### Requirement 22: Public Feed Display

**User Story:** As a visitor, I want to browse all public melodies, so that I can discover music created by others.

#### Acceptance Criteria

1. WHEN a user visits the homepage, THE Application SHALL display the first 20 melodies ordered by creation date with newest first
2. THE Application SHALL display melody title (truncated to 100 characters with ellipsis if longer) and creation date for each item in the Feed
3. THE Application SHALL provide a play button for each melody in the Feed to enable preview playback
4. WHEN the user scrolls to the bottom of the Feed, THE Application SHALL load the next 20 melodies using infinite scroll
5. THE Application SHALL load Feed data using GET /api/melodies with page and limit query parameters
6. IF no melodies exist in the database, THEN THE Application SHALL display an empty state message indicating no melodies are available

### Requirement 23: Feed Melody Preview

**User Story:** As a visitor, I want to preview melodies from the feed, so that I can quickly sample different creations.

#### Acceptance Criteria

1. WHEN the user clicks the play button on a Feed item, THE Application SHALL begin audio playback of that Melody and display a visual indicator on the playing item
2. WHEN the user clicks play on a different Feed item during playback, THE Application SHALL stop the current playback immediately and start the new Melody
3. WHEN preview playback is requested, THE Application SHALL fetch the full Melody note data before beginning playback
4. WHILE the Melody note data is being fetched, THE Application SHALL display a loading indicator on the Feed item
5. IF the Melody note data fetch fails, THEN THE Application SHALL display an error message indicating the preview is unavailable and remove the loading indicator
6. IF audio playback fails to start, THEN THE Application SHALL display an error message indicating playback failed

### Requirement 24: Feed Navigation

**User Story:** As a visitor, I want to open melodies from the feed, so that I can view them in full detail.

#### Acceptance Criteria

1. WHEN the user clicks on a melody card in the Feed, THE Application SHALL navigate to /m/[id] for that Melody, where [id] is the unique identifier of the selected melody
2. THE Application SHALL render each melody card in the Feed as a clickable element with the melody title displayed as the primary link text
3. THE Application SHALL ensure the entire melody card area is clickable for navigation, not only the title text

### Requirement 25: Create Page Interface

**User Story:** As a new user, I want to access an empty editor, so that I can start creating a melody from scratch.

#### Acceptance Criteria

1. WHEN a user navigates to /create, THE Application SHALL display a Piano_Roll_Editor containing zero notes
2. WHEN a user navigates to /create, THE Application SHALL display Synthesizer controls with default settings: oscillator type sine, volume 0.8, attack 0.01 seconds, release 0.5 seconds, and filter disabled
3. WHEN a user navigates to /create, THE Application SHALL display a MIDI upload button that triggers MIDI_File import functionality
4. WHEN the user clicks the save button on the create page, THE Application SHALL prompt for a melody title and create a new Melody as specified in Requirement 18

### Requirement 26: Ownership Verification

**User Story:** As the system, I want to verify melody ownership, so that only owners can modify their creations.

#### Acceptance Criteria

1. THE Application SHALL store an owner_id with each Melody in the database
2. WHEN a user first creates a melody AND no owner_id exists in browser storage, THE Application SHALL generate a unique owner_id and store it in localStorage
3. WHEN processing update or delete requests, THE Application SHALL verify the owner_id from the request body matches the Melody owner_id stored in the database
4. IF owner_id verification fails, THEN THE Application SHALL return a 403 Forbidden response without modifying the Melody
5. IF a request to update or delete a Melody does not include an owner_id, THEN THE Application SHALL return a 403 Forbidden response

### Requirement 27: Database Melody Storage

**User Story:** As the system, I want to persist melodies reliably, so that user creations are not lost.

#### Acceptance Criteria

1. THE Application SHALL store melodies in PostgreSQL with schema: id (TEXT PRIMARY KEY NOT NULL), title (TEXT NOT NULL), notes (JSONB NOT NULL), tempo (INT NOT NULL), synth (JSONB NOT NULL), created_at (TIMESTAMP NOT NULL), owner_id (TEXT NOT NULL)
2. THE Application SHALL enforce a maximum title length of 200 characters
3. THE Application SHALL enforce a maximum of 10000 notes per melody
4. WHEN a new melody is created, THE Application SHALL generate a unique identifier using UUID v4 format
5. THE Application SHALL perform all melody writes as atomic database transactions
6. IF a database write fails, THEN THE Application SHALL rollback the transaction and return an error response indicating the failure reason

### Requirement 28: API Error Handling

**User Story:** As a developer, I want consistent error responses, so that the client can handle failures gracefully.

#### Acceptance Criteria

1. THE Application SHALL return all error responses as JSON objects containing an "error" field with a human-readable message describing the failure
2. IF a requested resource does not exist, THEN THE Application SHALL return a 404 Not Found response with error message indicating the resource type and identifier that was not found
3. IF request validation fails, THEN THE Application SHALL return a 400 Bad Request response with error message and a "details" field listing each invalid field and its validation failure reason
4. IF an internal error occurs, THEN THE Application SHALL return a 500 Internal Server Error response with a generic error message that does not expose internal system details
5. IF authorization fails for an authenticated request, THEN THE Application SHALL return a 403 Forbidden response with error message indicating the action is not permitted
6. IF a request requires authentication and no valid owner_id is provided, THEN THE Application SHALL return a 401 Unauthorized response with error message indicating authentication is required

### Requirement 29: Performance - Playback Latency

**User Story:** As a music creator, I want responsive audio playback, so that I can hear notes immediately when triggered.

#### Acceptance Criteria

1. THE Synthesizer SHALL trigger note audio within 50 milliseconds of scheduled playback time
2. WHEN the user initiates a play command, THE Synthesizer SHALL produce audible audio output within 50 milliseconds of the command
3. WHILE multiple notes are scheduled to trigger simultaneously, THE Synthesizer SHALL trigger all concurrent notes within 50 milliseconds of their scheduled playback time
4. IF the audio subsystem is unavailable or unresponsive, THEN THE Synthesizer SHALL display an error message indicating the audio issue within 500 milliseconds

### Requirement 30: Performance - UI Rendering

**User Story:** As a music creator, I want smooth visual interactions, so that editing feels responsive and natural.

#### Acceptance Criteria

1. WHILE the user is performing drag operations on notes, THE Piano_Roll_Editor SHALL maintain a minimum frame rate of 55 frames per second with an average of at least 60 frames per second measured over any 5-second interval
2. WHILE playback is active with Playhead animation, THE Piano_Roll_Editor SHALL maintain a minimum frame rate of 55 frames per second with an average of at least 60 frames per second measured over any 5-second interval
3. WHILE rendering Feed items during scroll, THE Application SHALL complete rendering of each visible item within 16 milliseconds to prevent scroll input delays exceeding 100 milliseconds
4. IF frame rate drops below 55 frames per second for more than 500 milliseconds during drag or playback operations, THEN THE Piano_Roll_Editor SHALL prioritize user input responsiveness over visual updates

### Requirement 31: Note Data Validation

**User Story:** As the system, I want to validate note data, so that invalid compositions cannot corrupt the database.

#### Acceptance Criteria

1. THE Application SHALL validate Note pitch values are integers between 0 and 127 inclusive
2. THE Application SHALL validate Note start values are non-negative numbers with a maximum value of 10000 beats
3. THE Application SHALL validate Note duration values are numbers greater than 0 with a minimum of 0.001 beats and a maximum of 1000 beats
4. THE Application SHALL validate Note velocity values are numbers between 0 and 1 inclusive
5. IF Note validation fails, THEN THE Application SHALL reject the save request with an error response indicating which field failed validation and why

### Requirement 32: Environment Configuration Documentation

**User Story:** As a developer, I want documented environment variables, so that I can configure the application for local development and deployment.

#### Acceptance Criteria

1. THE Application SHALL include an `.env.example` file in the project root directory
2. THE `.env.example` file SHALL document the DATABASE_URL environment variable with a placeholder value indicating Neon Postgres connection string format
3. THE `.env.example` file SHALL include comments describing the purpose and format of each environment variable
4. THE Application SHALL use the DATABASE_URL environment variable to establish database connections to Neon Postgres

### Requirement 33: Keyboard Shortcut - Play/Stop Control

**User Story:** As a music creator, I want to control playback using keyboard shortcuts, so that I can work more efficiently without reaching for the mouse.

#### Acceptance Criteria

1. WHEN the user presses the Space bar while the Piano_Roll_Editor has focus, THE Application SHALL toggle playback state between playing and stopped
2. WHEN playback is stopped AND the user presses the Space bar, THE Synthesizer SHALL begin playing notes from the current Playhead position
3. WHEN playback is active AND the user presses the Space bar, THE Synthesizer SHALL stop all currently sounding notes and stop playback
4. THE Application SHALL prevent the default browser behavior for the Space bar key when the Piano_Roll_Editor has focus
5. WHILE the user is typing in a text input field, THE Application SHALL NOT trigger playback control on Space bar press

### Requirement 34: Piano Roll Scroll Controls

**User Story:** As a music creator, I want visible scrollbars on the piano roll, so that I can navigate the grid without relying solely on mouse wheel scrolling.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL display a horizontal scrollbar at the bottom of the editor for navigating time (beats)
2. THE Piano_Roll_Editor SHALL display a vertical scrollbar on the right side of the editor for navigating pitch (MIDI notes)
3. WHEN the user drags the horizontal scrollbar, THE Piano_Roll_Editor SHALL update the visible time region proportionally to the scrollbar position
4. WHEN the user drags the vertical scrollbar, THE Piano_Roll_Editor SHALL update the visible pitch region proportionally to the scrollbar position
5. THE Piano_Roll_Editor SHALL synchronize scrollbar positions with the current visible region when scrolling via mouse wheel or other navigation methods
6. THE Piano_Roll_Editor SHALL display scrollbar thumb sizes proportional to the visible region relative to the total scrollable area

### Requirement 35: Full Note Name Display

**User Story:** As a music creator, I want to see full note names with octaves on the piano roll, so that I can easily identify specific pitches while composing.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL display note names in the format of note letter, optional sharp symbol, and octave number (C4, C#4, D4, D#4, E4, F4, F#4, G4, G#4, A4, A#4, B4, C5, etc.) for each row in the pitch axis
2. THE Piano_Roll_Editor SHALL display note names for all visible pitch rows, not only at octave boundaries
3. THE Piano_Roll_Editor SHALL use standard scientific pitch notation where middle C is designated as C4 (MIDI note 60)
4. THE Piano_Roll_Editor SHALL display the note name labels in a fixed-width column on the left side of the grid that remains visible during horizontal scrolling
5. THE Piano_Roll_Editor SHALL visually distinguish natural notes from sharp notes in the note name labels

### Requirement 36: Audio Effects

**User Story:** As a music creator, I want to apply audio effects to the synthesizer, so that I can create richer and more expressive sounds.

#### Acceptance Criteria

1. THE Synthesizer SHALL provide a Reverb effect with adjustable room size parameter (range 0 to 1, default 0.5) and wet/dry mix parameter (range 0 to 1, default 0.3)
2. THE Synthesizer SHALL provide a Delay effect with adjustable time parameter (range 0 to 1 seconds, default 0.25), feedback parameter (range 0 to 0.9, default 0.3), and wet/dry mix parameter (range 0 to 1, default 0.3)
3. THE Synthesizer SHALL provide a Chorus effect with adjustable rate parameter (range 0.1 to 10 Hz, default 1.5), depth parameter (range 0 to 1, default 0.5), and wet/dry mix parameter (range 0 to 1, default 0.3)
4. THE Synthesizer SHALL provide a Flanger effect with adjustable rate parameter (range 0.1 to 10 Hz, default 0.5), depth parameter (range 0 to 1, default 0.5), feedback parameter (range 0 to 0.9, default 0.5), and wet/dry mix parameter (range 0 to 1, default 0.3)
5. THE Synthesizer SHALL allow each effect to be independently enabled or disabled, with all effects disabled by default
6. WHEN the user adjusts any effect parameter, THE Synthesizer SHALL apply the change to the audio output within 50 milliseconds
7. THE Synthesizer SHALL persist effect settings including enabled state and all parameters as part of the Melody configuration

### Requirement 37: Synthesizer Sound Presets

**User Story:** As a music creator, I want to select from predefined synthesizer presets, so that I can quickly achieve common sound types without manual parameter adjustment.

#### Acceptance Criteria

1. THE Synthesizer SHALL provide a preset selection control with categorized preset options
2. THE Synthesizer SHALL include Piano presets that configure oscillator, envelope, and effect parameters to emulate piano-like timbres
3. THE Synthesizer SHALL include Lead presets that configure parameters for prominent melodic sounds suitable for lead lines
4. THE Synthesizer SHALL include Pluck presets that configure parameters for short, percussive sounds with fast attack and decay
5. THE Synthesizer SHALL include Guitar presets that configure parameters to emulate guitar-like string timbres
6. THE Synthesizer SHALL include Bass presets that configure parameters for low-frequency sounds suitable for bass lines
7. WHEN the user selects a preset, THE Synthesizer SHALL apply all preset parameter values including oscillator type, ADSR envelope, filter settings, and effect configurations
8. THE Synthesizer SHALL persist the selected preset name as part of the Melody configuration
9. WHEN a Melody is loaded with a saved preset, THE Synthesizer SHALL restore the preset selection and all associated parameter values

### Requirement 38: Code Organization with Hooks and Shared Components

**User Story:** As a developer, I want a modular architecture with lean page files, so that business logic is separated into custom hooks and UI elements are reusable across the application.

#### Acceptance Criteria

1. THE Application SHALL organize page.tsx files to contain only routing, layout composition, and component orchestration, delegating business logic to Custom_Hooks
2. THE Application SHALL extract stateful business logic including data fetching, form handling, and audio control into Custom_Hooks located in a dedicated hooks directory
3. THE Application SHALL extract reusable UI elements into Shared_Components located in the components directory with a barrel export file (index.ts)
4. WHEN a Custom_Hook manages state that multiple components consume, THE Custom_Hook SHALL return typed state values and handler functions
5. WHEN a Shared_Component is created, THE Shared_Component SHALL accept props for all configurable behavior and emit events via callback props for parent communication
6. THE Application SHALL ensure each page.tsx file does not exceed 150 lines of code excluding imports and type definitions
7. IF a page.tsx file requires more than three distinct state management concerns, THEN THE Application SHALL split those concerns into separate Custom_Hooks

### Requirement 39: Icon Component Centralization

**User Story:** As a developer, I want all SVG icons centralized in a dedicated location, so that icons are reusable across components and easier to maintain.

#### Acceptance Criteria

1. THE Application SHALL store all Icon_Components in a dedicated icons file or directory within the components folder
2. THE Application SHALL NOT define SVG icons inline within page files or component files
3. WHEN an Icon_Component is needed, THE Application SHALL import it from the centralized icons location
4. THE Application SHALL export each Icon_Component as a named export accepting a className prop for styling customization
5. THE Application SHALL migrate existing inline SVG icons from TransportControls, MelodyCard, MelodyFeed, PageErrorFallback, GridSnapControls, and page files to the centralized icons location
6. WHEN a new icon is required, THE Application SHALL add the Icon_Component to the centralized icons location rather than defining it inline

### Requirement 40: Keyboard Piano Playing

**User Story:** As a music creator, I want to play musical notes using my computer keyboard, so that I can quickly audition pitches and experiment with melodies without using the mouse.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL map keyboard keys to piano notes using a standard QWERTY piano layout where the bottom row (Z, X, C, V, B, N, M) plays white keys starting from C3, the middle row (A, S, D, F, G, H, J, K, L) plays white keys starting from C4, and the top row (Q, W, E, R, T, Y, U, I, O, P) plays white keys starting from C5
2. THE Piano_Roll_Editor SHALL map sharp/black keys to the row above each white key row, such that keys 2, 3, 5, 6, 7 play C#4, D#4, F#4, G#4, A#4 respectively when the middle row maps to C4
3. WHEN the user presses a mapped keyboard key, THE Synthesizer SHALL immediately trigger the corresponding Note sound with velocity 0.8
4. WHEN the user releases a mapped keyboard key, THE Synthesizer SHALL stop the corresponding Note sound, allowing the ADSR_Envelope release phase to complete
5. THE Piano_Roll_Editor SHALL visually highlight the corresponding piano row in the grid while a keyboard key is held down to indicate which note is being played
6. WHILE the user is typing in a text input field, textarea, or contenteditable element, THE Piano_Roll_Editor SHALL NOT trigger keyboard piano playing
7. THE Piano_Roll_Editor SHALL support playing multiple notes simultaneously when multiple mapped keys are pressed (polyphonic keyboard input)
8. WHEN the Synthesizer is not initialized or audio context is suspended, THE Piano_Roll_Editor SHALL NOT attempt to play keyboard-triggered notes and SHALL NOT display an error


### Requirement 41: Piano Roll Fullscreen Mode

**User Story:** As a music creator, I want to expand the piano roll to fullscreen, so that I can have maximum workspace for composing without distraction.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL provide a fullscreen toggle button in the transport controls bar
2. WHEN the user clicks the fullscreen toggle button, THE Piano_Roll_Editor SHALL expand to cover the entire viewport, hiding the sidebar with synthesizer controls
3. WHILE in fullscreen mode, THE Piano_Roll_Editor SHALL display the transport controls bar at the top with a button to exit fullscreen
4. WHEN the user presses the Escape key while in fullscreen mode, THE Piano_Roll_Editor SHALL exit fullscreen mode and restore the normal layout
5. WHEN the user clicks the fullscreen exit button, THE Piano_Roll_Editor SHALL exit fullscreen mode and restore the normal layout
6. THE fullscreen toggle button SHALL display an expand icon when not in fullscreen and a collapse icon when in fullscreen mode
7. THE transition between fullscreen and normal mode SHALL be animated for a smooth user experience

### Requirement 42: Piano Roll Dynamic Resize Handling

**User Story:** As a music creator, I want the piano roll to automatically adjust when its container size changes, so that the editor renders correctly after layout changes like fullscreen toggle.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL use a ResizeObserver to detect container size changes
2. WHEN the container size changes (e.g., due to fullscreen toggle, window resize, or layout changes), THE Piano_Roll_Editor SHALL re-render the canvas to fit the new container dimensions
3. THE Piano_Roll_Editor SHALL debounce resize events using requestAnimationFrame to prevent excessive redraws
4. WHEN the container resizes, THE Piano_Roll_Editor SHALL maintain the current visible region proportions where possible

### Requirement 43: Compact Synthesizer Controls Layout

**User Story:** As a music creator, I want the synthesizer controls to have a compact, collapsible layout, so that all controls fit without excessive scrolling and I can focus on the most relevant parameters.

#### Acceptance Criteria

1. THE SynthControls component SHALL organize parameters into collapsible sections: Envelope (ADSR), Filter, and Effects
2. WHEN a section header is clicked, THE SynthControls SHALL toggle that section between expanded and collapsed states
3. THE SynthControls SHALL display sliders in a compact inline format with label, slider, and value on a single row
4. THE Effects section SHALL display each effect (Reverb, Delay, Chorus, Flanger) as a collapsible row with an enable toggle
5. WHEN an effect toggle is enabled and the effect row is expanded, THE SynthControls SHALL display that effect's parameter sliders
6. WHEN an effect toggle is disabled, THE SynthControls SHALL hide that effect's parameter sliders regardless of expansion state
7. THE SynthControls SHALL fit all controls within the sidebar without requiring scrolling when all sections are collapsed


### Requirement 44: Tempo Control

**User Story:** As a music creator, I want to adjust the playback tempo using a slider, so that I can control how fast or slow my melody plays without modifying individual note timings.

#### Acceptance Criteria

1. THE SynthControls component SHALL display a Tempo slider control positioned below the Volume slider
2. THE Tempo slider SHALL have a range from 40 BPM to 240 BPM with a default value of 120 BPM
3. THE Tempo slider SHALL display the current tempo value with "BPM" unit suffix (e.g., "120 BPM")
4. WHEN the user adjusts the Tempo slider, THE Synthesizer SHALL apply the new tempo to the audio playback engine immediately
5. WHEN the user adjusts the Tempo slider during active playback, THE Synthesizer SHALL update the playback speed in real-time without stopping or restarting playback
6. THE Application SHALL persist the tempo value as part of the Melody configuration when saving
7. WHEN a Melody is loaded, THE Application SHALL restore the saved tempo value and apply it to the Synthesizer
8. WHILE the user is viewing a Melody they do not own, THE Tempo slider SHALL be displayed in a disabled/read-only state showing the saved tempo value
9. WHILE the user is viewing a Melody they own, THE Tempo slider SHALL be enabled for editing

### Requirement 45: Dynamic Canvas Length

**User Story:** As a music creator, I want the piano roll canvas to automatically extend based on the notes I've placed, so that I can see my entire composition without manually adjusting canvas settings.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL calculate the effective canvas length dynamically based on the position and duration of placed notes
2. WHEN notes are added or imported, THE Piano_Roll_Editor SHALL extend the canvas length to accommodate all notes plus a buffer of at least 16 beats beyond the last note ending
3. THE Piano_Roll_Editor SHALL round the calculated canvas length to the nearest multiple of 16 beats for visual consistency
4. THE Piano_Roll_Editor SHALL maintain a minimum canvas length of 64 beats regardless of note content
5. WHEN a Melody with notes is loaded, THE Piano_Roll_Editor SHALL automatically calculate and apply the appropriate canvas length to display all notes
6. THE Piano_Roll_Editor SHALL accept an optional totalBeats prop to override the automatic calculation when explicit canvas length is desired

### Requirement 46: Auto-Scroll During Playback

**User Story:** As a music creator, I want the piano roll to automatically scroll during playback, so that I can follow along with my melody as it plays without manually scrolling.

#### Acceptance Criteria

1. THE Piano_Roll_Editor SHALL provide auto-scroll functionality that is enabled by default during playback
2. WHILE playback is active AND auto-scroll is enabled, THE Piano_Roll_Editor SHALL monitor the Playhead position relative to the visible canvas region
3. WHEN the Playhead reaches 80% of the visible horizontal region during playback, THE Piano_Roll_Editor SHALL scroll the canvas so that the Playhead is positioned at 20% from the left edge of the visible region
4. THE auto-scroll behavior SHALL only trigger during active playback (isPlaying true AND isPaused false)
5. THE auto-scroll behavior SHALL NOT interfere with manual user scrolling when playback is not active
6. THE Piano_Roll_Editor SHALL accept isPlaying and autoScrollDuringPlayback props to control the auto-scroll behavior

### Requirement 47: Clear All Notes

**User Story:** As a music creator, I want a clear all notes button, so that I can quickly start over with a fresh canvas without manually deleting each note.

#### Acceptance Criteria

1. THE Application SHALL display a "Clear All" button in the transport controls bar on the create page
2. WHILE the user is the Owner of a Melody, THE Application SHALL display a "Clear All" button in the transport controls bar on the melody edit page
3. WHILE the user is not the Owner of a Melody, THE Application SHALL NOT display a "Clear All" button on the melody edit page
4. WHEN the notes array is empty, THE "Clear All" button SHALL be disabled
5. WHEN the user clicks the "Clear All" button, THE Piano_Roll_Editor SHALL remove all notes from the Melody immediately
6. WHEN the "Clear All" button is clicked on the melody edit page, THE Application SHALL clear any save success indicator to indicate unsaved changes
7. THE "Clear All" button SHALL be styled distinctively (e.g., with a warning color) to indicate its destructive nature

### Requirement 48: MIDI Controls Shared Component

**User Story:** As a developer, I want MIDI import and export functionality encapsulated in a reusable component, so that it can be consistently used across the create page and melody edit page.

#### Acceptance Criteria

1. THE Application SHALL provide a MidiControls Shared_Component that encapsulates MIDI file import and export functionality
2. THE MidiControls component SHALL accept props for notes array, melody title, tempo, onImport callback, and optional allowImport flag
3. THE MidiControls component SHALL always display an export button that triggers MIDI file download with the current notes, title, and tempo
4. WHEN allowImport prop is true, THE MidiControls component SHALL display an import button that triggers file selection for MIDI file upload
5. WHEN allowImport prop is false or omitted, THE MidiControls component SHALL NOT display the import button
6. THE MidiControls component SHALL use the useMidiImportExport Custom_Hook internally for MIDI parsing and generation logic
7. THE Application SHALL use the MidiControls component on the create page with import enabled
8. THE Application SHALL use the MidiControls component on the melody edit page with import enabled only for the melody Owner
