# Implementation Plan: Melody Editor Refactor

## Overview

Refactor the duplicated piano roll editor logic from `app/create/page.tsx` and `app/m/[id]/MelodyEditor.tsx` into a single `MelodyEditor` component in `components/`. Both pages will consume the shared component via props and slots for mode-specific behavior. The Create page gains copy/paste support as a side-effect of this refactor.

## Tasks

- [x] 1. Create MelodyEditor component with types and core structure
  - [x] 1.1 Create types file and props interface for MelodyEditor
    - Create `components/MelodyEditor/types.ts` with `MelodyEditorProps`, `EditorState`, and `LoadNotesFn` type definitions
    - Export all types for consumption by route pages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 1.2 Implement MelodyEditor component with hook initialization and engine lifecycle
    - Create `components/MelodyEditor/MelodyEditor.tsx`
    - Initialize `usePianoRoll`, `useSynthesizer`, `usePlayback`, `useKeyboardPiano`, `useCopyPaste` hooks internally
    - Create `SynthesizerEngine` on mount, configure with resolved synth config and tempo, dispose on unmount
    - Clamp `initialTempo` to [20, 300], default to 120 when omitted
    - Handle `readOnly` prop to disable mutation operations at the handler level
    - Implement `onStateChange` callback firing on any notes/synthConfig/tempo change
    - Implement `onDirtyStateChange` callback tracking mutations after initialization
    - Implement `onMidiImport` callback providing `loadNotes` function reference to parent
    - Respect `allowMidiImport` prop to gate import operations
    - _Requirements: 1.1, 1.2, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 5.6, 5.8, 5.9, 6.1, 6.2, 7.1, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 9.1, 9.2_

  - [x] 1.3 Implement MelodyEditor UI rendering (transport bar, canvas, sidebar, fullscreen)
    - Render transport bar with `TransportControls`, `GridSnapControls`, clear-all button (hidden when `readOnly`), and `FullscreenToggle`
    - Render `PianoRollCanvas` with all note CRUD, selection, playback toggle, and copy/paste callbacks wired to internal hooks
    - Pass `highlightedPitch` and `activePitches` from `useKeyboardPiano` to `PianoRollCanvas`
    - Pass `selectionAnchor` from `usePianoRoll` to `PianoRollCanvas`
    - Render synth controls sidebar (hidden in fullscreen mode) with `SynthControls`
    - Render `headerSlot` prop content in header area
    - Manage fullscreen toggle state and Escape key handling internally
    - Wrap canvas and synth controls in `ErrorBoundary` components
    - Apply matching CSS classes: `bg-gray-900`, `bg-gray-800 border-b border-gray-700` on transport, `border-l border-gray-700` on sidebar, `overflow-y-auto overscroll-contain` on sidebar content
    - Apply fullscreen classes: `fixed inset-0 z-40 bg-gray-900` with `transition-all duration-300`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 2.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.10, 9.3_

  - [x] 1.4 Create barrel export for MelodyEditor
    - Create `components/MelodyEditor/index.ts` exporting the component and types
    - Update `components/index.ts` to re-export `MelodyEditor`
    - _Requirements: 1.1_

- [x] 2. Integrate MelodyEditor into Create page
  - [x] 2.1 Refactor Create page to use MelodyEditor
    - Replace all duplicated hook logic, event handlers, transport bar, canvas, and sidebar with `MelodyEditor`
    - Pass `headerSlot` with "Create Melody" title, `MidiControls`, and Save button
    - Wire `onStateChange` to track current notes/tempo/synthConfig for save dialog
    - Wire `onMidiImport` to connect `MidiControls.onImport` to the shared component's `loadNotes`
    - Keep save dialog (title input, validation, confirm/cancel) in the Create page
    - Keep `useMelodyPersistence` and `useOwnership` in the Create page
    - Ensure copy/paste shortcuts work via the shared component's `useCopyPaste` integration
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2_

  - [x] 2.2 Write property tests for MelodyEditor initialization and state callbacks
    - **Property 1: Initialization Preserves Provided State**
    - **Property 2: State Change Callback Fires on Any Mutation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 9.4**

  - [x] 2.3 Write property tests for readOnly and dirty state
    - **Property 3: ReadOnly Blocks All Mutations**
    - **Property 7: Dirty State Fires on Any Mutation**
    - **Validates: Requirements 2.5, 5.7, 7.5, 8.1, 8.2, 8.3**

- [x] 3. Checkpoint - Verify Create page refactor
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate MelodyEditor into Edit page
  - [x] 4.1 Refactor Edit page to use MelodyEditor
    - Replace all duplicated hook logic, event handlers, transport bar, canvas, and sidebar with `MelodyEditor`
    - Pass `initialNotes`, `initialSynthConfig`, `initialTempo` from the melody data
    - Pass `readOnly={!isOwner}` based on ownership check
    - Pass `headerSlot` with melody title, "Preview Mode" badge (when not owner), `MidiControls`, Save button, and Delete button (when owner)
    - Pass `allowMidiImport={isOwner}` to restrict MIDI import for non-owners
    - Wire `onStateChange` to track current state for save operations
    - Wire `onDirtyStateChange` to clear the "Saved!" success indication on further edits
    - Wire `onMidiImport` to connect `MidiControls.onImport` to the shared component's `loadNotes`
    - Keep save (PUT), delete confirmation dialog, ownership check, and redirect logic in the Edit page
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 7.1, 7.2, 8.4_

  - [x] 4.2 Write property tests for MIDI import and title validation
    - **Property 4: Title Validation Rejects Invalid Input**
    - **Property 5: MIDI Import Replaces All State**
    - **Property 6: allowMidiImport=false Blocks Import**
    - **Validates: Requirements 3.3, 7.3, 7.4**

  - [x] 4.3 Write property test for tempo propagation
    - **Property 8: Tempo Change Propagates to Engine**
    - **Validates: Requirements 9.2**

- [x] 5. Checkpoint - Verify Edit page refactor
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Clean up and final integration
  - [x] 6.1 Remove dead code from original implementations
    - Remove all extracted hook initialization, event handler wrappers, transport bar JSX, and canvas rendering code that is now handled by `MelodyEditor` from both `app/create/page.tsx` and `app/m/[id]/MelodyEditor.tsx`
    - Remove unused imports from both files
    - Verify no orphaned helper functions remain
    - _Requirements: 1.1, 1.2_

  - [x] 6.2 Write integration tests for Create and Edit page flows
    - Test Create page: renders shared editor, save dialog opens, title validation works, successful save redirects
    - Test Edit page: ownership detection, readOnly mode for non-owners, save success indicator with 3-second timeout, delete confirmation flow
    - _Requirements: 3.1, 3.3, 3.4, 4.1, 4.4, 4.5, 4.7, 4.8_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit/integration tests validate specific examples and edge cases
- The shared component owns all editor state internally; parents only receive state via callbacks
- Route-specific logic (save dialogs, delete confirmation, ownership checks) remains in consuming pages
- TypeScript is the implementation language (matching all existing source code and design examples)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["2.1"] },
    { "id": 5, "tasks": ["2.2", "2.3"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2", "4.3"] },
    { "id": 8, "tasks": ["6.1"] },
    { "id": 9, "tasks": ["6.2"] }
  ]
}
```
