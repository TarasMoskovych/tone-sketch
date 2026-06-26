# Implementation Plan: Velocity Lane Editor

## Overview

This plan implements an FL Studio-style collapsible velocity lane panel below the piano roll canvas. The implementation follows the project's modular architecture, creating a dedicated `components/VelocityLane/` directory mirroring the PianoRoll structure. The velocity lane shares the horizontal time axis with the PianoRollCanvas via props from MelodyEditor, supports single and multi-note velocity editing via drag, and synchronizes selection state bidirectionally.

## Tasks

- [x] 1. Set up VelocityLane module structure and types
  - [x] 1.1 Create VelocityLane directory with types, constants, and barrel export
    - Create `components/VelocityLane/types.ts` with `VelocityLaneCanvasProps`, `VelocityDragState`, `VelocityRenderDimensions` interfaces
    - Create `components/VelocityLane/constants.ts` with `VELOCITY_LANE_CONFIG` object (colors, dimensions, playhead settings)
    - Create `components/VelocityLane/index.ts` barrel export
    - _Requirements: 7.1, 7.2, 7.4_

- [x] 2. Implement coordinate utilities and renderers
  - [x] 2.1 Create coordinate utility functions
    - Create `components/VelocityLane/coordinate-utils.ts`
    - Implement `pointerYToVelocity`, `velocityToBarHeight`, `velocityToBarY`, `noteToBarX`, `noteToBarWidth`, `findBarAtPosition`, `clampVelocity`, `applyVelocityDelta`
    - Use the same horizontal formula as PianoRollCanvas: `(beat - startBeat) × pixelsPerBeat`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.1, 3.5, 4.1, 4.2, 5.1, 5.2_

  - [x] 2.2 Write property tests for coordinate utilities
    - **Property 4: Bar Horizontal Positioning** — verify x-offset equals `gridX + (note.start - visibleRegion.startBeat) × pixelsPerBeat`
    - **Property 5: Bar Width Calculation** — verify width equals `note.duration × pixelsPerBeat`
    - **Property 6: Bar Height and Y-Position** — verify height equals `velocity × laneHeight` and y-position is bottom-anchored
    - **Property 7: Horizontal Coordinate Alignment** — verify VelocityLane and PianoRoll produce identical x-coordinates for same beat
    - **Property 8: Pointer-to-Velocity Conversion with Clamping** — verify clamping to [0, 1] for all inputs
    - **Property 10: Multi-Note Delta Application** — verify `clamp(vᵢ + d, 0, 1)` for all notes
    - **Property 11: Multi-Note Editing Activation Condition** — verify multi-note applies iff `N ∈ S AND |S| ≥ 2`
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 3.1, 3.5, 4.1, 4.2, 5.1, 5.2, 5.4, 5.5**

  - [x] 2.3 Create renderer functions
    - Create `components/VelocityLane/renderers.ts`
    - Implement `setupCanvas`, `renderVelocityBars`, `renderBaseline`, `renderScaleIndicator`, `renderBeatGrid`, `renderPlayhead`
    - Use devicePixelRatio scaling matching PianoRoll pattern
    - Render bars bottom-anchored, selected bars with distinct color
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 6.1, 9.1, 9.4, 9.5, 9.6_

- [x] 3. Implement the useVelocityDrag hook
  - [x] 3.1 Create useVelocityDrag custom hook
    - Create `components/VelocityLane/hooks/useVelocityDrag.ts`
    - Implement `startDrag`, `updateDrag`, `endDrag`, `cancelDrag` functions
    - Track `originalVelocity` and `originalVelocities` map for cancel/restore
    - Support multi-note drag when dragged note is in selection with `|S| ≥ 2`
    - Compute delta as `currentDragVelocity - originalDraggedNoteVelocity` and apply to all selected notes
    - Call `onNoteUpdate` for single-note commit, `onBulkNoteUpdate` for multi-note commit
    - Handle Escape key to cancel and restore original velocities
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.3_

  - [x] 3.2 Write property tests for drag behavior
    - **Property 9: Drag Cancel Restores Original Velocity** — verify Escape restores all notes to original velocities
    - **Validates: Requirements 4.5**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement VelocityLaneCanvas component
  - [x] 5.1 Create VelocityLaneCanvas component
    - Create `components/VelocityLane/VelocityLaneCanvas.tsx`
    - Accept props: `notes`, `selectedNoteIds`, `visibleRegion`, `playheadPosition`, `onNoteUpdate`, `onBulkNoteUpdate`, `onVisibleRegionChange`, `onNoteSelect`, `onToggleNoteSelection`, `onDeselectAll`, `className`
    - Set up canvas with `setupCanvas` on mount and resize
    - Use `useVelocityDrag` hook for drag interactions
    - Render using extracted renderer functions with `requestAnimationFrame` scheduling
    - Handle pointer events for bar click (selection) and drag (velocity edit)
    - Handle wheel events for horizontal scroll (call `onVisibleRegionChange`)
    - Handle Ctrl/Shift+click for toggle selection
    - _Requirements: 2.1, 3.2, 3.3, 4.1, 4.3, 4.4, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 9.1, 9.2, 9.3_

  - [x] 5.2 Write property tests for selection and coloring logic
    - **Property 3: Visible Notes Filtering** — verify only notes overlapping visible region are rendered
    - **Property 12: Selection-Based Bar Coloring** — verify selected vs unselected color assignment
    - **Property 13: Click Selection Without Modifier** — verify click replaces selection with `{clickedNoteId}`
    - **Property 14: Toggle Selection With Modifier** — verify Ctrl/Shift+click toggles note in set
    - **Validates: Requirements 2.1, 6.1, 6.3, 6.4**

- [x] 6. Integrate VelocityLane into MelodyEditor
  - [x] 6.1 Add velocity lane visibility state and toggle button to MelodyEditor
    - Add `velocityLaneVisible` state (default `false`) to MelodyEditor
    - Add toggle button in the transport/controls bar area
    - Implement flex layout split: `flex-[3]` for PianoRollCanvas, `flex-1` for VelocityLane when visible
    - When hidden, PianoRollCanvas takes full height
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 6.2 Wire VelocityLaneCanvas props to MelodyEditor shared state
    - Pass `notes`, `selectedNoteIds`, `visibleRegion`, `playheadPosition` as props
    - Connect `onNoteUpdate` and `onBulkNoteUpdate` to existing handlers
    - Connect `onNoteSelect`, `onToggleNoteSelection`, `onDeselectAll` to existing selection handlers
    - Connect `onVisibleRegionChange` to update shared visible region state (syncs PianoRoll)
    - Hide VelocityLane when `isPianoRollFullscreen` is active
    - _Requirements: 3.1, 3.2, 3.3, 6.2, 6.5, 7.5_

  - [x] 6.3 Write property tests for layout and toggle behavior
    - **Property 1: Height Allocation** — verify ~75%/~25% split when visible, 100% piano roll when hidden
    - **Property 2: Toggle Preserves Editor State** — verify toggling does not modify notes, selectedNoteIds, visibleRegion, or playheadPosition
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update barrel exports and documentation
  - [x] 8.1 Update component barrel exports
    - Add `VelocityLaneCanvas` export to `components/VelocityLane/index.ts`
    - Add VelocityLane to `components/index.ts` barrel export
    - _Requirements: 7.4_

  - [x] 8.2 Update project documentation
    - Update `README.md` to mention velocity lane editing in features list
    - Update `ARCHITECTURE.md` to describe VelocityLane component, its relationship to PianoRollCanvas and MelodyEditor, and the data flow pattern
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript — all implementations use TypeScript/TSX
- The VelocityLane module mirrors the existing PianoRoll directory structure for consistency
- Horizontal synchronization is achieved by sharing `visibleRegion` via props from MelodyEditor — no direct coupling between PianoRoll and VelocityLane

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.3"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2"] },
    { "id": 6, "tasks": ["6.3", "8.1"] },
    { "id": 7, "tasks": ["8.2"] }
  ]
}
```
