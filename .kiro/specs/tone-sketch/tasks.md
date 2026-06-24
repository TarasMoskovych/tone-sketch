# Implementation Plan: Tone Sketch

## Overview

This implementation plan covers building Tone Sketch, a web-based music creation platform with a piano roll editor, Tone.js synthesizer, and PostgreSQL persistence. The plan follows an incremental approach: first establishing project structure and core types, then building the audio engine and piano roll editor, followed by API routes and database integration, and finally the pages and user-facing features.

## Tasks

- [ ] 1. Set up project structure and core types
  - [-] 1.1 Initialize Next.js 16 project with TypeScript and Tailwind CSS
    - Create Next.js app with App Router
    - Configure TypeScript strict mode
    - Set up Tailwind CSS
    - Install dependencies: tone, @neondatabase/serverless, uuid
    - _Requirements: Technology Stack from Design_

  - [~] 1.2 Create core type definitions and interfaces
    - Create `types/note.ts` with Note interface (id, pitch, start, duration, velocity)
    - Create `types/melody.ts` with Melody, MelodySummary interfaces
    - Create `types/synth.ts` with SynthesizerConfig, OscillatorType, ADSREnvelope, FilterConfig
    - Create `types/grid.ts` with GridSnapConfig, GridDivision, VisibleRegion
    - _Requirements: Data Models from Design, 1.1, 2.2_

  - [~] 1.3 Create validation utility functions
    - Implement note field validation (pitch 0-127, start 0-10000, duration 0.001-1000, velocity 0-1)
    - Implement melody validation (title 1-200 chars, notes ≤10000)
    - Implement synth config validation (volume 0-1, ADSR ranges, filter frequency 20-20000)
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 27.2, 27.3_

  - [~] 1.4 Write property tests for validation functions
    - **Property 12: Title Validation**
    - **Property 13: Note Count Limit**
    - **Property 14: Note Field Validation**
    - **Validates: Requirements 31.1, 31.2, 31.3, 31.4, 31.5, 27.2, 27.3**

- [~] 2. Checkpoint - Verify project setup
  - Ensure all dependencies install correctly
  - Ensure TypeScript compiles without errors
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Implement synthesizer engine
  - [~] 3.1 Create SynthesizerEngine class with Tone.js integration
    - Initialize PolySynth with configurable oscillator types (sine, square, sawtooth, triangle)
    - Implement configure() method for updating synth parameters
    - Implement volume control with real-time updates
    - Implement ADSR envelope application
    - Implement optional filter (lowpass/highpass) in audio chain
    - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 12.3, 12.4_

  - [~] 3.2 Implement playback controls
    - Implement play() with note scheduling from current position
    - Implement pause() to stop notes and maintain position
    - Implement stop() to silence and reset to position zero
    - Implement loop mode with automatic restart
    - Implement triggerNote() for single note preview
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 14.1, 14.2, 14.3, 15.1, 15.2, 15.3, 15.4_

  - [~] 3.3 Implement playhead synchronization
    - Use Tone.Draw for visual sync with audio
    - Implement onPlayheadUpdate callback mechanism
    - Ensure ≤50ms latency between audio and visual
    - _Requirements: 8.2, 8.4, 29.1, 29.2, 29.3_

  - [~] 3.4 Write unit tests for synthesizer engine
    - Test configuration application
    - Test playback state transitions
    - Test ADSR envelope values
    - _Requirements: 9.1, 9.2, 10.1, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2_

- [ ] 4. Implement grid snap utility
  - [~] 4.1 Create grid snap calculation functions
    - Implement snapToGrid(position, division) for all divisions (1, 0.5, 0.25, 0.125, 0.0625)
    - Implement free positioning at 1/32 beat resolution when snap disabled
    - Implement minimum duration enforcement based on snap state
    - _Requirements: 7.2, 7.4, 7.5, 5.3, 5.4_

  - [~] 4.2 Write property tests for grid snap
    - **Property 3: Grid Snap Quantization**
    - **Property 5: Minimum Duration Enforcement**
    - **Property 8: Free Positioning Resolution**
    - **Validates: Requirements 2.3, 3.2, 5.2, 5.3, 5.4, 7.4, 7.5**

- [ ] 5. Implement piano roll canvas renderer
  - [~] 5.1 Create PianoRollCanvas component with HTML5 Canvas
    - Set up canvas with device pixel ratio handling
    - Implement grid rendering with beat lines and pitch rows
    - Render pitch labels (C0-C10) on vertical axis
    - Render time markers on horizontal axis
    - Implement visible region management (default: 16 beats × 24 semitones)
    - _Requirements: 1.1, 1.3, 1.4, 1.7_

  - [~] 5.2 Implement note rendering
    - Render notes as rectangles at correct grid positions
    - Calculate X = start × pixelsPerBeat, Y = (127 - pitch) × pixelsPerSemitone
    - Calculate width = duration × pixelsPerBeat
    - Implement selection highlight for selected notes
    - _Requirements: 1.2_

  - [~] 5.3 Write property tests for note rendering position
    - **Property 1: Note Rendering Position Calculation**
    - **Validates: Requirements 1.2**

  - [~] 5.4 Implement playhead rendering
    - Draw vertical playhead line at current position
    - Update position at 60fps using requestAnimationFrame
    - _Requirements: 8.1, 8.2, 8.3_

  - [~] 5.5 Implement scroll and zoom controls
    - Handle scroll events to update visible region
    - Debounce scroll events to prevent excessive redraws
    - Maintain 60fps during scroll operations
    - _Requirements: 1.5, 1.6, 30.1, 30.2_

- [ ] 6. Implement piano roll interactions
  - [~] 6.1 Implement click detection and note creation
    - Detect clicks on empty grid positions
    - Create notes with default duration (1 beat) and velocity (0.8)
    - Apply grid snap to start time when enabled
    - Select existing notes when clicking on occupied positions
    - Trigger note preview on creation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [~] 6.2 Write property tests for note creation
    - **Property 2: Note Creation at Valid Position**
    - **Validates: Requirements 2.1, 2.2**

  - [~] 6.3 Implement horizontal drag (time adjustment)
    - Track drag start position and original note state
    - Update note start time during drag
    - Apply grid snap when enabled
    - Clamp start time to non-negative values
    - Support drag cancel with state restoration
    - Maintain 60fps during drag
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [~] 6.4 Write property tests for horizontal drag
    - **Property 4: Note Boundary Clamping**
    - **Property 6: Drag Cancel Restores Original State**
    - **Validates: Requirements 3.3, 3.5, 4.2**

  - [~] 6.5 Implement vertical drag (pitch adjustment)
    - Update note pitch to nearest MIDI value
    - Clamp pitch between 0 and 127
    - Maintain 60fps during drag
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [~] 6.6 Implement duration resize
    - Detect right edge drag
    - Update duration proportionally to drag distance
    - Apply grid snap to end time when enabled
    - Enforce minimum duration (grid division or 0.1 beats)
    - Maintain 60fps during resize
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [~] 6.7 Implement note deletion
    - Handle Delete/Backspace key on selected notes
    - Handle right-click deletion
    - Update display within 100ms
    - Stop audio for currently playing deleted notes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [~] 6.8 Write property tests for note deletion
    - **Property 7: Note Deletion Removes from Melody**
    - **Validates: Requirements 6.1, 6.2**

  - [~] 6.9 Implement timeline click for playhead positioning
    - Detect clicks on timeline area
    - Reposition playhead to clicked time
    - _Requirements: 8.5_

  - [~] 6.10 Write property tests for timeline click
    - **Property 9: Timeline Click Positions Playhead**
    - **Validates: Requirements 8.5**

- [~] 7. Checkpoint - Verify canvas and interactions
  - Ensure piano roll renders correctly
  - Ensure all interactions work at 60fps
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement UI control components
  - [~] 8.1 Create TransportControls component
    - Play, pause, stop buttons with state indicators
    - Loop toggle button
    - Connect to synthesizer engine
    - _Requirements: 13.1, 13.2, 14.1, 15.1_

  - [~] 8.2 Create SynthControls component
    - Oscillator type selector (sine, square, sawtooth, triangle)
    - Volume slider (0-1)
    - ADSR envelope controls (attack 0-2s, decay 0-2s, sustain 0-1, release 0-5s)
    - Filter enable toggle, type selector, frequency slider
    - _Requirements: 9.1, 10.1, 10.3, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2_

  - [~] 8.3 Create GridSnapControls component
    - Enable/disable toggle (default: enabled)
    - Division selector (1, 1/2, 1/4, 1/8, 1/16 beats, default: 1/4)
    - Visual indicator of current state
    - _Requirements: 7.1, 7.2, 7.3_

  - [~] 8.4 Write unit tests for control components
    - Test state management
    - Test callback invocation
    - _Requirements: 7.1, 9.1, 10.1_

- [ ] 9. Implement MIDI import/export
  - [~] 9.1 Create MidiImporter utility
    - Parse Standard MIDI File types 0 and 1
    - Merge multiple tracks into single note array
    - Extract initial tempo
    - Validate file size ≤5MB
    - Handle invalid/corrupted files with error messages
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [~] 9.2 Create MidiExporter utility
    - Generate Standard MIDI File type 0
    - Include tempo track and note track
    - Sanitize filename (replace invalid chars with underscores)
    - Handle empty melodies (tempo track only)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [~] 9.3 Write property tests for MIDI round-trip
    - **Property 10: MIDI Import/Export Round-Trip**
    - **Property 19: Export Filename Sanitization**
    - **Validates: Requirements 16.7, 17.1, 17.2, 17.3, 17.4**

  - [~] 9.4 Write unit tests for MIDI edge cases
    - Test file size validation
    - Test corrupted file handling
    - Test empty melody export
    - _Requirements: 16.4, 16.5, 17.5_

- [ ] 10. Implement database layer
  - [~] 10.1 Set up Neon Postgres connection
    - Configure @neondatabase/serverless client
    - Create database schema migration script
    - Set up indexes on created_at and owner_id
    - _Requirements: 27.1, Database Schema from Design_

  - [~] 10.2 Create melody data access functions
    - Implement createMelody() with UUID generation
    - Implement getMelodyById()
    - Implement updateMelody()
    - Implement deleteMelody()
    - Implement getMelodiesPaginated() with ordering by created_at DESC
    - Wrap all writes in transactions
    - _Requirements: 27.4, 27.5, 27.6_

  - [~] 10.3 Write property tests for melody persistence
    - **Property 11: Melody Persistence Round-Trip**
    - **Property 17: Feed Sorting**
    - **Property 20: UUID Generation**
    - **Validates: Requirements 9.4, 10.4, 11.6, 12.5, 18.3, 20.6, 22.1, 27.4**

- [ ] 11. Implement API routes
  - [~] 11.1 Create GET /api/melodies endpoint
    - Accept page and limit query parameters
    - Return paginated melody list with total, hasMore
    - Order by created_at descending
    - _Requirements: 22.5_

  - [~] 11.2 Create GET /api/melodies/[id] endpoint
    - Return full melody data including notes and synth config
    - Return 404 for non-existent melodies
    - _Requirements: 19.1, 28.2_

  - [~] 11.3 Create POST /api/melodies endpoint
    - Validate request body (title, notes, tempo, synth, ownerId)
    - Generate UUID for new melody
    - Return created melody id
    - Return 400 for validation errors with details
    - _Requirements: 18.1, 18.3, 18.6, 28.3_

  - [~] 11.4 Create PUT /api/melodies/[id] endpoint
    - Verify owner_id matches stored value
    - Return 403 for non-owners or missing owner_id
    - Update melody atomically
    - Return 404 for non-existent melodies
    - _Requirements: 20.3, 20.6, 20.7, 26.3, 26.4, 26.5, 28.5_

  - [~] 11.5 Create DELETE /api/melodies/[id] endpoint
    - Verify owner_id matches stored value
    - Return 403 for non-owners or missing owner_id
    - Return 204 on successful deletion
    - Return 404 for non-existent melodies
    - _Requirements: 21.4, 21.7, 26.3, 26.4, 26.5_

  - [~] 11.6 Write property tests for API authorization
    - **Property 15: Owner Authorization**
    - **Property 16: API Error Response Format**
    - **Validates: Requirements 20.7, 21.7, 26.3, 26.4, 26.5, 28.1, 28.2, 28.3, 28.4**

  - [~] 11.7 Write integration tests for API routes
    - Test full CRUD lifecycle
    - Test pagination behavior
    - Test error responses
    - _Requirements: 18.1, 19.1, 20.3, 21.4, 22.5_

- [~] 12. Checkpoint - Verify backend functionality
  - Ensure database connection works
  - Ensure all API routes function correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement owner ID management
  - [~] 13.1 Create localStorage owner ID utility
    - Generate UUID v4 on first access
    - Store in localStorage with consistent key
    - Retrieve for API requests
    - _Requirements: 26.1, 26.2_

  - [~] 13.2 Write unit tests for owner ID utility
    - Test generation on missing key
    - Test retrieval of existing key
    - _Requirements: 26.2_

- [ ] 14. Implement application pages
  - [~] 14.1 Create /create page
    - Display empty PianoRollEditor
    - Display SynthControls with defaults
    - Display TransportControls and GridSnapControls
    - Add MIDI upload button
    - Add save button with title prompt
    - Redirect to /m/[id] on successful save
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 18.1, 18.2_

  - [~] 14.2 Create /m/[id] melody page
    - Fetch melody data with loading indicator
    - Display PianoRollEditor with loaded notes
    - Configure synth with saved settings
    - Display read-only controls for non-owners
    - Display save/delete buttons for owners
    - Handle 404 with not found message
    - Handle errors with retry option
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 20.1, 20.2, 20.4, 20.5, 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

  - [~] 14.3 Write integration tests for create and melody pages
    - Test create workflow: add notes → save → redirect
    - Test edit workflow: load → edit → save
    - Test permission states for owner vs non-owner
    - _Requirements: 18.2, 20.1, 20.2_

- [ ] 15. Implement feed components
  - [~] 15.1 Create MelodyCard component
    - Display title (truncated to 100 chars with ellipsis)
    - Display creation date
    - Play/stop button for preview
    - Loading indicator during fetch
    - Clickable area for navigation
    - _Requirements: 22.2, 22.3, 24.1, 24.2, 24.3_

  - [~] 15.2 Write property tests for title truncation
    - **Property 18: Title Truncation in Feed**
    - **Validates: Requirements 22.2**

  - [~] 15.3 Create MelodyFeed component with infinite scroll
    - Display first 20 melodies
    - Load next 20 on scroll to bottom
    - Display empty state when no melodies
    - Complete item rendering within 16ms
    - _Requirements: 22.1, 22.4, 22.6, 30.3_

  - [~] 15.4 Implement feed preview playback
    - Fetch full melody on play click
    - Start playback with visual indicator
    - Stop current playback when starting another
    - Handle fetch and playback errors
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

  - [~] 15.5 Create homepage with MelodyFeed
    - Display feed as main content
    - Add navigation to /create
    - _Requirements: 22.1_

  - [~] 15.6 Write integration tests for feed interactions
    - Test scroll and load more
    - Test preview playback
    - Test navigation to melody pages
    - _Requirements: 22.4, 23.1, 24.1_

- [~] 16. Checkpoint - Verify complete application
  - Ensure all pages work end-to-end
  - Ensure playback and editing function correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Final integration and polish
  - [~] 17.1 Implement error handling for audio context
    - Detect unavailable/suspended audio context
    - Request user interaction when needed
    - Display user-friendly error messages
    - _Requirements: 29.4, Error Handling from Design_

  - [~] 17.2 Add loading states and error boundaries
    - Add loading indicators for async operations
    - Add error boundaries for graceful degradation
    - Add retry options for recoverable errors
    - _Requirements: 19.2, 19.6, 23.4_

  - [~] 17.3 Write performance tests
    - Measure fps during drag operations (target: 55fps min, 60fps avg)
    - Measure fps during playback (target: 55fps min, 60fps avg)
    - Measure audio latency (target: <50ms)
    - _Requirements: 30.1, 30.2, 29.1, 29.2_

- [~] 18. Final checkpoint - Complete verification
  - Ensure all requirements are met
  - Ensure all tests pass
  - Ensure application is ready for deployment, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript as specified in the design document
- Tone.js handles all Web Audio synthesis
- Neon Postgres via @neondatabase/serverless provides serverless-optimized database access

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["3.1", "4.1", "10.1"] },
    { "id": 5, "tasks": ["3.2", "4.2", "10.2"] },
    { "id": 6, "tasks": ["3.3", "10.3"] },
    { "id": 7, "tasks": ["3.4", "5.1"] },
    { "id": 8, "tasks": ["5.2", "11.1", "11.2"] },
    { "id": 9, "tasks": ["5.3", "5.4", "11.3"] },
    { "id": 10, "tasks": ["5.5", "11.4"] },
    { "id": 11, "tasks": ["6.1", "11.5"] },
    { "id": 12, "tasks": ["6.2", "11.6"] },
    { "id": 13, "tasks": ["6.3", "11.7"] },
    { "id": 14, "tasks": ["6.4", "6.5"] },
    { "id": 15, "tasks": ["6.6"] },
    { "id": 16, "tasks": ["6.7"] },
    { "id": 17, "tasks": ["6.8", "6.9"] },
    { "id": 18, "tasks": ["6.10", "8.1"] },
    { "id": 19, "tasks": ["8.2"] },
    { "id": 20, "tasks": ["8.3"] },
    { "id": 21, "tasks": ["8.4", "9.1"] },
    { "id": 22, "tasks": ["9.2"] },
    { "id": 23, "tasks": ["9.3"] },
    { "id": 24, "tasks": ["9.4", "13.1"] },
    { "id": 25, "tasks": ["13.2", "14.1"] },
    { "id": 26, "tasks": ["14.2"] },
    { "id": 27, "tasks": ["14.3", "15.1"] },
    { "id": 28, "tasks": ["15.2", "15.3"] },
    { "id": 29, "tasks": ["15.4"] },
    { "id": 30, "tasks": ["15.5"] },
    { "id": 31, "tasks": ["15.6", "17.1"] },
    { "id": 32, "tasks": ["17.2"] },
    { "id": 33, "tasks": ["17.3"] }
  ]
}
```
