# Implementation Plan: Tone Sketch

## Overview

This implementation plan breaks down the Tone Sketch music creation platform into discrete, incremental coding tasks. The plan follows a bottom-up approach: core data models and utilities first, then the synthesizer engine, piano roll editor, API layer, and finally integration of all components. Each task builds on previous work and includes references to specific requirements.

## Tasks

- [x] 1. Set up project foundation and core interfaces
  - [x] 1.1 Create core TypeScript interfaces and types
    - Define `Note`, `Melody`, `SynthesizerConfig`, `EffectsConfig`, `ADSREnvelope`, `FilterConfig` interfaces in `lib/types.ts`
    - Define `GridSnapConfig`, `VisibleRegion`, `KeyboardAction` types
    - Define `PresetName`, `PresetCategory`, `SynthPreset` types for presets
    - _Requirements: 1.1, 1.2, 9.1, 11.1-11.4, 36.1-36.4, 37.1_

  - [x]* 1.2 Write property test for Note field validation
    - **Property 14: Note Field Validation**
    - Test pitch (0-127), start (0-10000), duration (0.001-1000), velocity (0-1) validation
    - **Validates: Requirements 31.1, 31.2, 31.3, 31.4, 31.5**

  - [x] 1.3 Create note utility functions
    - Implement `midiToNoteName(midi: number): string` for scientific pitch notation (C4, C#4, etc.)
    - Implement `validateNote(note: Note): ValidationResult` for field validation
    - Implement `generateNoteId(): string` using UUID v4
    - Update `lib/note-utils.ts` with these functions
    - _Requirements: 35.1, 35.2, 35.3, 31.1-31.5, 27.4_

  - [x]* 1.4 Write property test for MIDI note to pitch notation
    - **Property 24: MIDI Note to Scientific Pitch Notation**
    - Test all MIDI notes 0-127 produce correct notation (Middle C = C4)
    - **Validates: Requirements 35.1, 35.2, 35.3**

- [x] 2. Checkpoint - Core types and utilities
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement synthesizer presets system
  - [x] 3.1 Create preset definitions
    - Define 15 presets across 5 categories: Piano (3), Lead (3), Pluck (3), Guitar (3), Bass (3)
    - Each preset specifies oscillator, ADSR, filter, and effects settings
    - Update `lib/presets.ts` with preset configurations
    - _Requirements: 37.1-37.6_

  - [x]* 3.2 Write property test for preset application
    - **Property 27: Preset Application**
    - Test that selecting any preset updates all synth parameters correctly
    - **Validates: Requirements 37.7**

- [x] 4. Implement synthesizer engine with effects
  - [x] 4.1 Enhance synthesizer with audio effects chain
    - Add Reverb effect using Tone.Reverb with roomSize and wetDry parameters
    - Add Delay effect using Tone.FeedbackDelay with time, feedback, wetDry
    - Add Chorus effect using Tone.Chorus with rate, depth, wetDry
    - Add Flanger effect using Tone.Phaser with rate, depth, feedback, wetDry
    - Chain audio nodes: Synth → Filter → Effects → Master Output
    - Update `lib/synthesizer.ts`
    - _Requirements: 36.1-36.6_

  - [x]* 4.2 Write property test for effect parameter validation
    - **Property 25: Effect Parameter Validation**
    - Test parameter clamping for all effects to valid ranges
    - **Validates: Requirements 36.1, 36.2, 36.3, 36.4**

  - [x]* 4.3 Write property test for effect independence
    - **Property 26: Effect Independence**
    - Test enabling/disabling one effect doesn't affect others
    - **Validates: Requirements 36.5**

  - [x] 4.4 Implement tempo control in synthesizer
    - Add `setTempo(bpm: number)` method clamped to 40-240 BPM
    - Add `getTempo(): number` method
    - Integrate with Tone.getTransport().bpm.value
    - Support real-time tempo changes during playback
    - _Requirements: 44.4, 44.5_

- [x] 5. Checkpoint - Synthesizer engine complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement custom hooks for business logic
  - [x] 6.1 Implement useSynthesizer hook
    - Manage synthesizer configuration state
    - Implement `applyPreset(presetName)` function
    - Implement `updateEffects(effects)` function
    - Implement tempo state management
    - Return typed state and handler functions
    - Update `hooks/useSynthesizer.ts`
    - _Requirements: 38.2, 38.4, 37.7, 44.4_

  - [x] 6.2 Implement usePianoRoll hook
    - Manage notes array, selection, visible region, grid snap state
    - Implement CRUD operations for notes
    - Implement grid snap quantization logic
    - Update `hooks/usePianoRoll.ts`
    - _Requirements: 38.2, 38.4, 2.1-2.5, 7.1-7.5_

  - [x]* 6.3 Write property test for grid snap quantization
    - **Property 3: Grid Snap Quantization**
    - Test `round(P / D) * D` formula for all divisions (1, 0.5, 0.25, 0.125, 0.0625)
    - **Validates: Requirements 2.3, 3.2, 5.2, 7.4**

  - [x] 6.4 Implement usePlayback hook
    - Manage isPlaying, isPaused, isLooping, playheadPosition state
    - Integrate with Tone.js Transport
    - Synchronize playhead with audio using Tone.Draw
    - Update `hooks/usePlayback.ts`
    - _Requirements: 13.1-13.6, 14.1-14.3, 15.1-15.4_

  - [x] 6.5 Implement useKeyboardShortcuts hook
    - Listen for Space bar to toggle playback when Piano Roll has focus
    - Listen for Delete/Backspace to delete selected note
    - Prevent default browser behavior for Space bar
    - Exclude text input fields from shortcut handling
    - Update `hooks/useKeyboardShortcuts.ts`
    - _Requirements: 33.1-33.5, 6.1_

  - [x]* 6.6 Write property test for keyboard shortcut handling
    - **Property 21: Space Bar Toggles Playback**
    - **Property 22: Space Bar Ignored in Text Inputs**
    - **Validates: Requirements 33.1, 33.2, 33.3, 33.5**

  - [x] 6.7 Implement useKeyboardPiano hook
    - Map QWERTY keys to MIDI notes (Z-M → C3, A-L → C4, Q-P → C5)
    - Map number row (2,3,5,6,7) to sharps in C4 octave
    - Track pressed keys for polyphonic support
    - Trigger note on/off events with velocity 0.8
    - Return highlightedPitch for visual feedback
    - Exclude text input elements from triggering
    - Create `hooks/useKeyboardPiano.ts`
    - _Requirements: 40.1-40.8_

  - [x]* 6.8 Write property test for keyboard piano mapping
    - **Property 28: Keyboard Piano Key Mapping**
    - Test all mapped keys produce correct MIDI note numbers
    - **Validates: Requirements 40.1, 40.2**

  - [x]* 6.9 Write property test for keyboard piano note triggering
    - **Property 29: Keyboard Piano Note Triggering**
    - **Property 30: Keyboard Piano Text Input Exclusion**
    - **Validates: Requirements 40.3, 40.4, 40.6, 40.7**

- [x] 7. Checkpoint - Hooks implementation complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Piano Roll Canvas rendering
  - [x] 8.1 Enhance PianoRollCanvas with note name labels
    - Render note names (C4, C#4, D4, etc.) in fixed-width column on left
    - Distinguish natural notes from sharps visually
    - Keep labels visible during horizontal scroll
    - Update `components/PianoRollCanvas.tsx`
    - _Requirements: 35.1-35.5, 1.3_

  - [x] 8.2 Implement playhead rendering with correct styling
    - Render playhead as bright red (#FF0000) vertical line
    - Minimum 2 pixels width, full grid height
    - Render on top layer (higher z-index than notes)
    - Update `components/PianoRollCanvas.tsx`
    - _Requirements: 8.1, 8.6-8.9_

  - [x]* 8.3 Write property test for playhead visual rendering
    - **Property 31: Playhead Visual Rendering**
    - Test color (#FF0000), width (2px min), height (full grid), z-index (above notes)
    - **Validates: Requirements 8.6, 8.7, 8.8, 8.9**

  - [x] 8.4 Implement scrollbar rendering and interaction
    - Render horizontal scrollbar at bottom for time navigation
    - Render vertical scrollbar on right for pitch navigation
    - Calculate thumb size proportional to visible region
    - Synchronize scrollbar position with visible region
    - Support drag interaction on scrollbars
    - Update `components/PianoRollCanvas.tsx`
    - _Requirements: 34.1-34.6, 1.6_

  - [x]* 8.5 Write property test for scrollbar-visible region sync
    - **Property 23: Scrollbar-Visible Region Synchronization**
    - Test bidirectional sync between scrollbar position and visible region
    - **Validates: Requirements 34.3, 34.4, 34.5, 34.6**

  - [x] 8.6 Implement keyboard piano visual feedback
    - Highlight piano row background when keyboard piano key is held
    - Use highlightedPitch from useKeyboardPiano hook
    - Support multiple simultaneous highlights for polyphony
    - Update `components/PianoRollCanvas.tsx`
    - _Requirements: 40.5_

  - [x] 8.7 Implement ResizeObserver for dynamic resize handling
    - Use ResizeObserver to detect container size changes
    - Re-render canvas on container dimension changes
    - Debounce resize events using requestAnimationFrame
    - Maintain visible region proportions on resize
    - Update `components/PianoRollCanvas.tsx`
    - _Requirements: 42.1-42.4_

- [x] 9. Checkpoint - Piano Roll Canvas complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement UI Components
  - [x] 10.1 Implement collapsible SynthControls layout
    - Organize into collapsible sections: Envelope, Filter, Effects
    - Display sliders in compact inline format (label, slider, value on single row)
    - Add tempo slider below volume (40-240 BPM, default 120)
    - Display tempo with "BPM" suffix
    - Update `components/SynthControls.tsx`
    - _Requirements: 43.1-43.7, 44.1-44.3_

  - [x] 10.2 Implement EffectsControls component
    - Display each effect as collapsible row with enable toggle
    - Show parameter sliders when effect is enabled and expanded
    - Hide parameter sliders when effect is disabled
    - Update `components/EffectsControls.tsx`
    - _Requirements: 43.4-43.6, 36.1-36.5_

  - [x] 10.3 Implement PresetSelector component
    - Group presets by category (Piano, Lead, Pluck, Guitar, Bass)
    - Display current preset selection
    - Trigger onPresetSelect callback on selection
    - Update `components/PresetSelector.tsx`
    - _Requirements: 37.1-37.6_

  - [x] 10.4 Add fullscreen toggle to TransportControls
    - Add fullscreen toggle button with expand/collapse icons
    - Handle Escape key to exit fullscreen
    - Animate transition between modes
    - Update `components/TransportControls.tsx`
    - _Requirements: 41.1-41.7_

  - [x] 10.5 Create expand/collapse icons
    - Add ExpandIcon and CollapseIcon to icons module
    - Export from `components/icons/index.ts`
    - _Requirements: 39.1-39.6, 41.6_

- [x] 11. Checkpoint - UI components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement MIDI import/export
  - [x] 12.1 Implement MIDI importer
    - Parse SMF Type 0 and Type 1 files
    - Merge multiple tracks into single melody
    - Extract initial tempo, ignore subsequent tempo changes
    - Validate file size ≤ 5MB
    - Handle parse errors gracefully
    - Update `hooks/useMidiImportExport.ts`
    - _Requirements: 16.1-16.7_

  - [x] 12.2 Implement MIDI exporter
    - Generate SMF Type 0 format
    - Include all notes with pitch, start, duration, velocity
    - Include tempo track
    - Sanitize filename (replace invalid chars with underscore)
    - Handle empty melody (export tempo track only)
    - Update `hooks/useMidiImportExport.ts`
    - _Requirements: 17.1-17.5_

  - [x]* 12.3 Write property test for MIDI round-trip
    - **Property 10: MIDI Import/Export Round-Trip**
    - Test export then import produces identical notes
    - **Validates: Requirements 16.7, 17.1, 17.2, 17.4**

  - [x]* 12.4 Write property test for filename sanitization
    - **Property 19: Export Filename Sanitization**
    - Test special characters replaced with underscores
    - **Validates: Requirements 17.3**

- [x] 13. Checkpoint - MIDI processing complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement API routes with validation
  - [x] 14.1 Enhance melody validation in API routes
    - Validate title length (1-200 chars)
    - Validate notes array (≤10000 items)
    - Validate each note field (pitch, start, duration, velocity)
    - Validate synth config including effects and preset
    - Validate tempo (40-240 BPM)
    - Return detailed validation errors
    - Update `app/api/melodies/route.ts` and `app/api/melodies/[id]/route.ts`
    - _Requirements: 18.6, 27.2, 27.3, 31.1-31.5, 28.3_

  - [x]* 14.2 Write property test for title validation
    - **Property 12: Title Validation**
    - Test empty, 1-200 chars, >200 chars scenarios
    - **Validates: Requirements 18.6, 27.2**

  - [x] 14.3 Implement owner authorization in API
    - Verify owner_id from request matches stored owner_id
    - Return 403 for owner_id mismatch
    - Return 403 for missing owner_id on update/delete
    - Return 401 for requests requiring authentication
    - Update `app/api/melodies/[id]/route.ts`
    - _Requirements: 26.3-26.5, 20.7, 21.7, 28.5, 28.6_

  - [x]* 14.4 Write property test for owner authorization
    - **Property 15: Owner Authorization**
    - Test matching, mismatching, and missing owner_id scenarios
    - **Validates: Requirements 20.7, 21.7, 26.3, 26.4, 26.5**

  - [x] 14.5 Implement consistent API error responses
    - Return JSON with "error" field for all errors
    - Include "details" field for validation errors
    - Include resource type and id for 404 errors
    - Hide internal details for 500 errors
    - Update all API routes
    - _Requirements: 28.1-28.4_

  - [x]* 14.6 Write property test for API error response format
    - **Property 16: API Error Response Format**
    - Test 400, 404, 500 response formats
    - **Validates: Requirements 28.1, 28.2, 28.3, 28.4**

- [x] 15. Checkpoint - API routes complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Implement melody persistence with effects and presets
  - [x] 16.1 Enhance useMelodyPersistence hook
    - Save complete melody including notes, tempo, synth config, effects, preset
    - Handle atomic saves/updates
    - Implement proper error handling and state management
    - Update `hooks/useMelodyPersistence.ts`
    - _Requirements: 18.1-18.4, 20.3-20.6_

  - [x]* 16.2 Write property test for melody persistence round-trip
    - **Property 11: Melody Persistence Round-Trip**
    - Test save and retrieve produces identical melody with effects and preset
    - **Validates: Requirements 9.4, 10.4, 11.6, 12.5, 18.3, 20.6, 36.7, 37.8, 37.9**

  - [x] 16.3 Implement feed sorting and pagination
    - Sort melodies by created_at descending (newest first)
    - Support page and limit query parameters
    - Calculate hasMore for pagination
    - Update API route if needed
    - _Requirements: 22.1, 22.4, 22.5_

  - [x]* 16.4 Write property test for feed sorting
    - **Property 17: Feed Sorting**
    - Test melodies returned in created_at descending order
    - **Validates: Requirements 22.1**

  - [x]* 16.5 Write property test for title truncation
    - **Property 18: Title Truncation in Feed**
    - Test titles >100 chars truncated with ellipsis
    - **Validates: Requirements 22.2**

  - [x]* 16.6 Write property test for UUID generation
    - **Property 20: UUID Generation**
    - Test generated IDs are valid UUID v4 format
    - **Validates: Requirements 27.4**

- [x] 17. Checkpoint - Persistence complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Integrate components on Create page
  - [x] 18.1 Wire up Create page with all hooks and components
    - Initialize empty piano roll with usesPianoRoll hook
    - Initialize synthesizer with useSynthesizer hook (default settings)
    - Initialize playback with usePlayback hook
    - Wire useKeyboardShortcuts and useKeyboardPiano hooks
    - Connect transport controls, synth controls, effects controls
    - Implement fullscreen mode toggle
    - Connect MIDI import functionality
    - Implement save workflow with title prompt
    - Keep page.tsx ≤150 lines (excluding imports/types)
    - Update `app/create/page.tsx`
    - _Requirements: 25.1-25.4, 38.1, 38.6_

- [x] 19. Integrate components on Melody view page
  - [x] 19.1 Wire up Melody page with ownership-aware UI
    - Load melody data with useMelodyPersistence hook
    - Display loading state while fetching
    - Configure synthesizer with saved settings including effects and preset
    - Display read-only mode for non-owners (no save button, disabled controls)
    - Display edit mode for owners (save button, enabled controls)
    - Wire tempo slider as read-only for non-owners, editable for owners
    - Implement delete workflow with confirmation dialog
    - Handle 404 and network errors
    - Update `app/m/[id]/page.tsx`
    - _Requirements: 19.1-19.6, 20.1-20.5, 21.1-21.6, 44.8, 44.9_

- [x] 20. Integrate Feed with preview playback
  - [x] 20.1 Enhance MelodyFeed with preview functionality
    - Display melodies with title (truncated to 100 chars) and creation date
    - Implement play button that fetches full melody and plays
    - Stop current playback when different melody is played
    - Display loading indicator while fetching
    - Handle fetch errors gracefully
    - Update `components/MelodyFeed.tsx` and `components/MelodyCard.tsx`
    - _Requirements: 22.1-22.6, 23.1-23.6, 24.1-24.3_

- [x] 21. Checkpoint - Page integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Final integration testing and validation
  - [x]* 22.1 Write integration tests for melody CRUD lifecycle
    - Test create → read → update → delete flow
    - Test pagination and feed behavior
    - Test concurrent request handling
    - Create `tests/integration/melody-lifecycle.test.ts`
    - _Requirements: 18.1-18.7, 19.1-19.6, 20.1-20.7, 21.1-21.7_

  - [x]* 22.2 Write integration tests for keyboard interactions
    - Test Space bar play/stop toggle
    - Test keyboard piano note triggering
    - Test Delete key for note deletion
    - Update integration tests as needed
    - _Requirements: 33.1-33.5, 40.1-40.8, 6.1_

- [x] 23. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript, Next.js 16 (App Router), React 19, Tone.js, and Vitest with fast-check for testing
- Page files should not exceed 150 lines (excluding imports/types) per Requirement 38.6
- All business logic should be extracted to custom hooks per Requirement 38.1-38.4

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 5, "tasks": ["6.1", "6.2"] },
    { "id": 6, "tasks": ["6.3", "6.4", "6.5"] },
    { "id": 7, "tasks": ["6.6", "6.7"] },
    { "id": 8, "tasks": ["6.8", "6.9"] },
    { "id": 9, "tasks": ["8.1", "8.2"] },
    { "id": 10, "tasks": ["8.3", "8.4"] },
    { "id": 11, "tasks": ["8.5", "8.6", "8.7"] },
    { "id": 12, "tasks": ["10.1", "10.2", "10.3", "10.5"] },
    { "id": 13, "tasks": ["10.4", "12.1", "12.2"] },
    { "id": 14, "tasks": ["12.3", "12.4", "14.1"] },
    { "id": 15, "tasks": ["14.2", "14.3"] },
    { "id": 16, "tasks": ["14.4", "14.5"] },
    { "id": 17, "tasks": ["14.6", "16.1"] },
    { "id": 18, "tasks": ["16.2", "16.3"] },
    { "id": 19, "tasks": ["16.4", "16.5", "16.6"] },
    { "id": 20, "tasks": ["18.1"] },
    { "id": 21, "tasks": ["19.1"] },
    { "id": 22, "tasks": ["20.1"] },
    { "id": 23, "tasks": ["22.1", "22.2"] }
  ]
}
```
