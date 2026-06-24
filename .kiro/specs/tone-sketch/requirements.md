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
