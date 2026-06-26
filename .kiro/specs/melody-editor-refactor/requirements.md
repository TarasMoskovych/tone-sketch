# Requirements Document

## Introduction

Refactor the melody editor into a shared component to eliminate code duplication between the Create page (`app/create/page.tsx`) and the Edit page (`app/m/[id]/MelodyEditor.tsx`). Both pages currently duplicate the piano roll editor core — including hook setup (`usePianoRoll`, `useSynthesizer`, `usePlayback`, `useKeyboardPiano`), all event handler wrappers, transport/grid controls, `PianoRollCanvas` rendering, and fullscreen toggle logic. The Create page is also missing copy/paste support that the Edit page has. This refactor extracts a shared `MelodyEditor` component into `components/` that both routes consume via props/callbacks for mode-specific behavior.

## Glossary

- **Melody_Editor**: A reusable React component in `components/` that encapsulates the piano roll editor core (hooks initialization, event handlers, transport bar, canvas rendering, fullscreen toggle, synth sidebar, and copy/paste integration)
- **Create_Page**: The route at `app/create/page.tsx` for creating new melodies, which owns the save dialog and POST persistence logic
- **Edit_Page**: The route at `app/m/[id]/MelodyEditor.tsx` for editing existing melodies, which owns the save (PUT), delete, ownership checks, and preview mode logic
- **Editor_Core**: The set of hooks (`usePianoRoll`, `useSynthesizer`, `usePlayback`, `useKeyboardPiano`, `useCopyPaste`), event handler wrappers, transport controls, grid snap controls, `PianoRollCanvas`, fullscreen toggle, and synth sidebar that both pages share
- **Mode_Specific_Logic**: Route-level behavior that differs between Create and Edit pages (e.g., save dialog, delete confirmation, preview mode, ownership checks, initial data loading)
- **Piano_Roll_Canvas**: The canvas component (`PianoRollCanvas`) that renders notes, handles mouse/keyboard interactions, and emits note CRUD events
- **Transport_Bar**: The UI bar containing playback controls (`TransportControls`), grid snap controls (`GridSnapControls`), clear-all button, and fullscreen toggle

## Requirements

### Requirement 1: Extract Shared Piano Roll Editor Component

**User Story:** As a developer, I want the duplicated piano roll editor logic extracted into a single shared component, so that both routes use the same implementation and bugs are fixed in one place.

#### Acceptance Criteria

1. THE Melody_Editor SHALL be a single React component located in the `components/` directory
2. THE Melody_Editor SHALL create a `SynthesizerEngine` instance on mount, initialize `usePianoRoll`, `useSynthesizer`, `usePlayback`, `useKeyboardPiano`, and `useCopyPaste` hooks internally, configure the engine with the resolved synth config and tempo, and dispose the engine on unmount
3. THE Melody_Editor SHALL render the Transport_Bar containing `TransportControls`, `GridSnapControls`, a clear-all button (hidden when `readOnly` is true), and a `FullscreenToggle`
4. THE Melody_Editor SHALL render the `PianoRollCanvas` with note CRUD callbacks, selection callbacks, playback toggle callback, and copy/paste callbacks wired to the internal hooks, and SHALL trigger audio playback via the synth engine when a note is created
5. THE Melody_Editor SHALL render the synth controls sidebar (hidden in fullscreen mode) with `SynthControls`
6. THE Melody_Editor SHALL manage fullscreen toggle state and Escape key handling internally
7. THE Melody_Editor SHALL wrap the canvas and synth controls in `ErrorBoundary` components

### Requirement 2: Shared Component Props Interface

**User Story:** As a developer, I want the shared component to accept props for mode-specific behavior, so that each route can customize save actions, header content, and initial data without modifying the shared logic.

#### Acceptance Criteria

1. THE Melody_Editor SHALL accept an optional `initialNotes` prop (array of Note objects) to load pre-existing notes on mount, defaulting to an empty array when omitted
2. THE Melody_Editor SHALL accept an optional `initialSynthConfig` prop (SynthesizerConfig object) to load a pre-existing synthesizer configuration on mount, defaulting to the `useSynthesizer` hook's default config when omitted
3. THE Melody_Editor SHALL accept an optional `initialTempo` prop (number in the range 20 to 300 BPM) to set the starting tempo on mount, defaulting to 120 BPM when omitted
4. WHEN notes, synth config, or tempo change within the editor, THE Melody_Editor SHALL invoke the `onStateChange` callback prop with an object containing the current `notes` (Note[]), `synthConfig` (SynthesizerConfig), and `tempo` (number)
5. THE Melody_Editor SHALL accept an optional `readOnly` prop that, when true, disables note creation, deletion, editing, clear-all, synth parameter changes, and MIDI import while keeping playback controls, grid snap, and fullscreen toggle functional
6. THE Melody_Editor SHALL accept an optional `headerSlot` prop (React node) that is rendered in the header area, allowing the parent to inject route-specific header content
7. THE Melody_Editor SHALL accept an optional `allowMidiImport` prop (defaulting to true) to control whether MIDI import is enabled

### Requirement 3: Create Page Integration

**User Story:** As a user creating a new melody, I want the Create page to use the shared editor component while keeping its save dialog behavior, so that I get a consistent editing experience with full copy/paste support.

#### Acceptance Criteria

1. WHEN the Create_Page renders, THE Create_Page SHALL render the Melody_Editor with default initial state (empty notes, default tempo of 120 BPM, default synth config)
2. THE Create_Page SHALL render its own header with the "Create Melody" title, MIDI controls, and Save button via the `headerSlot` prop
3. WHEN the user clicks Save on the Create_Page, THE Create_Page SHALL display the title input dialog with a text input (max 200 characters) and validate that the title is non-empty before persisting
4. WHEN a melody is saved successfully on the Create_Page, THE Create_Page SHALL persist the melody via POST using `useMelodyPersistence` and redirect to the Edit page at `/m/{id}`
5. WHEN the user clicks Cancel in the save dialog, THE Create_Page SHALL close the dialog without saving and clear any error messages
6. THE Create_Page SHALL have copy/paste support (copy, cut, paste, duplicate shortcuts) available through the Melody_Editor

### Requirement 4: Edit Page Integration

**User Story:** As a user editing an existing melody, I want the Edit page to use the shared editor component while keeping its ownership, save, and delete behavior, so that I get a consistent editing experience without losing existing functionality.

#### Acceptance Criteria

1. WHEN the Edit_Page renders, THE Edit_Page SHALL render the Melody_Editor with the melody's existing notes, synth config, and tempo as initial props
2. WHILE the user is the owner of the melody, THE Edit_Page SHALL render a header via the `headerSlot` prop containing the melody title, MIDI controls, a Save button, and a Delete button
3. WHILE the user is not the owner of the melody, THE Edit_Page SHALL render a header via the `headerSlot` prop containing the melody title, a "Preview Mode" badge, and MIDI controls (without Save or Delete buttons)
4. WHILE the user is not the owner of the melody, THE Edit_Page SHALL pass `readOnly=true` to the Melody_Editor to disable note creation, deletion, editing, clear-all, synth changes, and MIDI import
5. WHEN the owner clicks Save on the Edit_Page, THE Edit_Page SHALL persist the current notes, tempo, synth config, title, and ownerId via PUT using `useMelodyPersistence` and display a temporary success indication for 3 seconds
6. IF the Save operation fails on the Edit_Page, THEN THE Edit_Page SHALL display an error message indicating the failure reason in the header area
7. WHEN the owner clicks Delete on the Edit_Page, THE Edit_Page SHALL display a delete confirmation dialog showing the melody title and warning that the action cannot be undone
8. WHEN the owner confirms deletion in the dialog, THE Edit_Page SHALL delete the melody via `useMelodyPersistence` and redirect to the home page at `/`
9. THE Edit_Page SHALL determine ownership by comparing the melody's ownerId against the current user's ownerId using `useOwnership`

### Requirement 5: No Visual or Behavioral Regression

**User Story:** As a user, I want the refactored editor to look and behave identically to the current implementation, so that the refactor is transparent to me.

#### Acceptance Criteria

1. THE Melody_Editor SHALL render the same layout structure: a flex column containing a transport bar row and a flex row with the piano roll canvas (flex-1) and a sidebar (w-72)
2. THE Melody_Editor SHALL apply the same CSS classes: `bg-gray-900` on the outer container, `bg-gray-800 border-b border-gray-700` on the transport bar, `border-l border-gray-700` on the sidebar, and `overflow-y-auto overscroll-contain` on the sidebar content wrapper
3. WHEN fullscreen mode is toggled, THE Melody_Editor SHALL apply `fixed inset-0 z-40 bg-gray-900` to the main area with `transition-all duration-300` and hide the sidebar
4. WHEN the Escape key is pressed while in fullscreen mode, THE Melody_Editor SHALL exit fullscreen mode
5. THE Melody_Editor SHALL pass `highlightedPitch` and `activePitches` from `useKeyboardPiano` to the `PianoRollCanvas` for keyboard piano visual feedback
6. WHEN the synthesizer engine initializes, THE Melody_Editor SHALL configure the engine with the provided synth config and tempo before signaling engine readiness
7. WHILE `readOnly` is true, THE Melody_Editor SHALL hide the clear-all button in the Transport_Bar
8. WHEN a note is created via the PianoRollCanvas, THE Melody_Editor SHALL trigger audio playback of that note through the synthesizer engine immediately upon creation
9. WHEN synth config changes are applied, THE Melody_Editor SHALL apply the new configuration to the synthesizer engine in real-time
10. THE Melody_Editor SHALL pass `selectionAnchor` from `usePianoRoll` to the `PianoRollCanvas` for shift-click range selection support

### Requirement 6: Copy/Paste Parity for Create Page

**User Story:** As a user on the Create page, I want copy/paste keyboard shortcuts (Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D) to work, so that I have the same editing capabilities as the Edit page.

#### Acceptance Criteria

1. THE Melody_Editor SHALL initialize the `useCopyPaste` hook with the internal piano roll state (notes, selectedNoteIds, playheadPosition, gridSnap) and mutation callbacks (onNotesCreated, onNotesDeleted, onSelectionChanged)
2. THE Melody_Editor SHALL pass copy, cut, paste, and duplicate callbacks from `useCopyPaste` to the `PianoRollCanvas` as `onCopy`, `onCut`, `onPaste`, and `onDuplicate` props
3. WHEN a user presses Ctrl+C (or Cmd+C) with notes selected, THE Piano_Roll_Canvas SHALL invoke the copy callback to copy selected notes to the internal clipboard
4. WHEN a user presses Ctrl+X (or Cmd+X) with notes selected, THE Piano_Roll_Canvas SHALL invoke the cut callback to copy selected notes to the clipboard and delete the originals
5. WHEN a user presses Ctrl+V (or Cmd+V) with clipboard content available, THE Piano_Roll_Canvas SHALL invoke the paste callback to place clipboard notes at the playhead position
6. WHEN a user presses Ctrl+D (or Cmd+D) with notes selected, THE Piano_Roll_Canvas SHALL invoke the duplicate callback to duplicate notes immediately after the selection

### Requirement 7: MIDI Import/Export Support

**User Story:** As a user, I want MIDI import and export to continue working through the shared component, so that I can import melodies from MIDI files and export my work.

#### Acceptance Criteria

1. THE Melody_Editor SHALL accept an `onMidiImport` callback prop that receives the current `loadNotes` function reference, enabling the parent to call it from `MidiControls`' `onImport` handler rendered in the `headerSlot`
2. THE Melody_Editor SHALL expose the current notes and tempo state needed by `MidiControls` for export via the `onStateChange` callback
3. WHEN MIDI notes are imported, THE Melody_Editor SHALL replace all existing notes with the imported notes and, if the imported MIDI file contained tempo metadata, update the tempo and synchronize the synthesizer engine to the new tempo value
4. IF `allowMidiImport` is false, THEN THE Melody_Editor SHALL ignore any calls to load imported notes, leaving the current notes and tempo unchanged
5. IF `readOnly` is true, THEN THE Melody_Editor SHALL ignore MIDI import requests, leaving the current notes and tempo unchanged

### Requirement 8: Dirty State Tracking

**User Story:** As a user on the Edit page, I want the editor to track whether I have unsaved changes, so that the save success indicator disappears when I make further edits.

#### Acceptance Criteria

1. THE Melody_Editor SHALL accept an optional `onDirtyStateChange` callback prop that fires with `true` when any notes, synth config, or tempo are modified after the last save (or initial load)
2. WHEN notes are created, updated, deleted, cleared, or imported, THE Melody_Editor SHALL invoke `onDirtyStateChange(true)`
3. WHEN synth config or tempo is changed, THE Melody_Editor SHALL invoke `onDirtyStateChange(true)`
4. THE Edit_Page SHALL use `onDirtyStateChange` to clear the "Saved!" success indication when further edits are made after a successful save

### Requirement 9: Tempo Control

**User Story:** As a user, I want to change the tempo and have the synthesizer respond immediately, so that I can audition my melody at different speeds.

#### Acceptance Criteria

1. THE Melody_Editor SHALL manage tempo state internally, initialized from `initialTempo` (defaulting to 120 BPM)
2. WHEN the user changes the tempo via `SynthControls`, THE Melody_Editor SHALL update the internal tempo state and call `synthEngineRef.current.setTempo(newTempo)` immediately
3. THE Melody_Editor SHALL pass the current tempo to `TransportControls` for display
4. THE Melody_Editor SHALL include the current tempo in `onStateChange` notifications so the parent can access it for persistence
