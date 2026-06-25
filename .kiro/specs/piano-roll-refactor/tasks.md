# Implementation Plan: Piano Roll Canvas Refactoring

## Overview

This implementation plan covers refactoring the `PianoRollCanvas` component from a single ~3000-line file into a modular folder structure within `components/PianoRoll/`. The refactoring preserves all existing functionality while improving code maintainability, readability, and testability. Each task builds incrementally, ensuring the component remains functional throughout the refactoring process.

## Tasks

- [x] 1. Set up folder structure and foundational files
  - [x] 1.1 Create PianoRoll folder and extract constants
    - Create `components/PianoRoll/` directory
    - Create `components/PianoRoll/constants.ts` with `CANVAS_CONFIG`, `DEFAULT_GRID_SNAP_CONFIG`, `DEFAULT_VISIBLE_REGION`, and `RESIZE_HANDLE_WIDTH` extracted from lines 14-95 and 241, 353-358 of the original file
    - Ensure all color values, dimensions, and behavior parameters are preserved exactly
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Extract type definitions
    - Create `components/PianoRoll/types.ts`
    - Extract `SelectionModifiers` interface (lines 102-107)
    - Extract `PianoRollCanvasProps` interface (lines 112-237)
    - Extract `DragState` interface (lines 247-264)
    - Extract `ScrollbarDragState` interface (lines 268-279)
    - Extract `MarqueeState` interface (lines 283-296)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2. Extract coordinate conversion utilities
  - [x] 2.1 Create coordinate-utils.ts with pure functions
    - Create `components/PianoRoll/coordinate-utils.ts`
    - Extract `isOctaveBoundary` function (lines 303-305)
    - Extract `calculateScrollbarState` function (lines 318-348)
    - Extract `pixelXToBeat` function (lines 922-932)
    - Extract `pixelYToPitch` function (lines 940-953)
    - Extract `beatToPixelX` function (lines 960-973)
    - Add `pitchToPixelY` function for completeness (inverse of pixelYToPitch)
    - Extract `constrainVisibleRegion` function (lines 631-660)
    - Ensure all functions accept explicit parameters (not refs) for testability
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.2 Write property test for coordinate round-trip (Property 1)
    - **Property 1: Coordinate Conversion Round-Trip**
    - Test that `|pixelXToBeat(beatToPixelX(beat)) - beat| < ε` for any valid beat
    - Test that `|pixelYToPitch(pitchToPixelY(pitch)) - pitch| < 1` for any valid pitch
    - Use fast-check with min 100 iterations
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.6**

  - [x] 2.3 Write property test for scrollbar state bounds (Property 2)
    - **Property 2: Scrollbar State Bounds Invariant**
    - Test that horizontalPosition and verticalPosition are in range [0, 1]
    - Test that thumbSize values are in range (0, 1] and proportional to visible/total range
    - Use fast-check with min 100 iterations
    - **Validates: Requirements 4.4**

  - [x] 2.4 Write property test for octave boundary detection (Property 3)
    - **Property 3: Octave Boundary Detection**
    - Test that `isOctaveBoundary(note)` returns true iff `note % 12 === 0`
    - Test all MIDI notes 0-127
    - **Validates: Requirements 4.5**

- [x] 3. Checkpoint - Verify coordinate utilities
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extract event handling utilities
  - [x] 4.1 Create event-utils.ts with hit detection functions
    - Create `components/PianoRoll/event-utils.ts`
    - Extract `isClickOnExistingNote` function (lines 889-897)
    - Extract `findNoteAtPosition` function (lines 906-916)
    - Extract `findNoteAtPixelPosition` function (lines 1155-1166)
    - Extract `isOnResizeHandle` function (lines 979-986)
    - Extract `getScrollbarAtPosition` function (lines 994-1047)
    - Ensure functions accept explicit parameters for testability
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 4.2 Write property test for note hit detection (Property 4)
    - **Property 4: Note Hit Detection Consistency**
    - Test that `isClickOnExistingNote` returns true iff `findNoteAtPosition !== null`
    - Test that returned note bounds contain the query position
    - Use fast-check with min 100 iterations
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 4.3 Write property test for resize handle detection (Property 5)
    - **Property 5: Resize Handle Detection**
    - Test that `isOnResizeHandle` returns true iff pixelX is within RESIZE_HANDLE_WIDTH of note's right edge
    - Use fast-check with min 100 iterations
    - **Validates: Requirements 6.4**

  - [x] 4.4 Write property test for scrollbar hit detection (Property 6)
    - **Property 6: Scrollbar Hit Detection**
    - Test that positions cannot be in both scrollbar thumbs simultaneously
    - Test that return values are 'horizontal', 'vertical', or null based on position
    - Use fast-check with min 100 iterations
    - **Validates: Requirements 6.5**

- [x] 5. Extract touch utilities
  - [x] 5.1 Create touch-utils.ts with gesture helpers
    - Create `components/PianoRoll/touch-utils.ts`
    - Extract `getTouchDistance` function (lines 779-785)
    - Extract `getTouchCenter` function (lines 789-797)
    - _Requirements: 7.1, 7.2_

  - [x] 5.2 Write property test for touch geometry (Property 7)
    - **Property 7: Touch Geometry Calculations**
    - Test that `getTouchDistance` returns Euclidean distance and is non-negative
    - Test that `getTouchCenter` returns midpoint within bounding box of two points
    - Use fast-check with min 100 iterations
    - **Validates: Requirements 7.1, 7.2**

- [x] 6. Checkpoint - Verify all utility modules
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Extract rendering functions
  - [x] 7.1 Create renderers.ts with canvas drawing functions
    - Create `components/PianoRoll/renderers.ts`
    - Define `RenderDimensions` interface for consistent parameter passing
    - Extract `setupCanvas` function (lines 2053-2078)
    - Extract `renderPitchLabels` function (lines 2097-2156)
    - Extract `renderTimeMarkers` function (lines 2164-2193)
    - Extract `renderGrid` function (lines 2199-2287)
    - Extract `calculateNotePosition` function (lines 2324-2363)
    - Extract `renderNotes` function (lines 2379-2455)
    - Extract `renderPlayhead` function (lines 2479-2513)
    - Extract `renderScrollbars` function (lines 2529-2623)
    - Extract `renderMarquee` function (lines 2639-2672)
    - Ensure all functions receive data as parameters (not closures)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

- [x] 8. Create custom hooks
  - [x] 8.1 Create useDragState hook
    - Create `components/PianoRoll/hooks/` directory
    - Create `components/PianoRoll/hooks/useDragState.ts`
    - Implement `UseDragStateOptions` and `UseDragStateReturn` interfaces
    - Extract note drag state management (`dragState`)
    - Extract scrollbar drag state management (`scrollbarDragState`)
    - Extract `handleScrollbarDrag` logic (lines 1055-1134)
    - Implement drag cancellation with Escape key and state restoration
    - Export `startNoteDrag`, `updateNoteDrag`, `endNoteDrag`, `cancelNoteDrag`
    - Export `startScrollbarDrag`, `updateScrollbarDrag`, `endScrollbarDrag`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.2 Create useMarqueeSelection hook
    - Create `components/PianoRoll/hooks/useMarqueeSelection.ts`
    - Implement `UseMarqueeSelectionOptions` and `UseMarqueeSelectionReturn` interfaces
    - Extract marquee state management (`marqueeState`)
    - Extract `handleMarqueeMove` logic (lines 1469-1548)
    - Implement intersecting notes calculation during drag
    - Implement additive selection mode (Ctrl/Cmd modifier)
    - Implement cancellation with Escape key and state restoration
    - Export `startMarquee`, `updateMarquee`, `endMarquee`, `cancelMarquee`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 8.3 Write unit tests for useDragState hook
    - Test drag start/update/end lifecycle
    - Test drag cancellation restores original positions
    - Test group drag behavior
    - Test scrollbar drag behavior
    - _Requirements: 8.4, 8.5_

  - [x] 8.4 Write unit tests for useMarqueeSelection hook
    - Test marquee start/update/end lifecycle
    - Test intersecting notes calculation
    - Test additive selection with modifier keys
    - Test cancellation restores previous selection
    - _Requirements: 9.4, 9.5_

- [x] 9. Checkpoint - Verify hooks and renderers
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Refactor main component and create exports
  - [x] 10.1 Create simplified PianoRollCanvas.tsx
    - Create `components/PianoRoll/PianoRollCanvas.tsx`
    - Import and use all extracted modules: constants, types, coordinate-utils, renderers, event-utils, touch-utils
    - Import and integrate `useDragState` and `useMarqueeSelection` hooks
    - Keep React refs: `canvasRef`, `containerRef`, `animationFrameRef`, `justFinishedDragRef`, `prevPlayheadPositionRef`, `lastTouchDistanceRef`, `lastTouchCenterRef`
    - Keep computed values: `effectiveTotalBeats`, `playingPitches` via useMemo
    - Keep internal state: `isOverResizeHandle`, `isOverTimeline`, `isOverScrollbar`, `internalVisibleRegion`
    - Wire event handlers that compose extracted utilities
    - Keep the `render` function that composes all rendering functions
    - Keep all `useEffect` hooks for event listener setup and cleanup
    - Keep external dependency imports unchanged
    - Ensure file is under 500 lines
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 10.2 Create barrel export index.ts
    - Create `components/PianoRoll/index.ts`
    - Export `PianoRollCanvas` and `default` from `./PianoRollCanvas`
    - Export `CANVAS_CONFIG` from `./constants`
    - Export types `PianoRollCanvasProps` and `SelectionModifiers` from `./types`
    - Export `calculateScrollbarState` from `./coordinate-utils` for testing
    - _Requirements: 1.2, 2.5, 3.6_

  - [x] 10.3 Create backward compatibility alias
    - Update `components/PianoRollCanvas.tsx` to re-export from `./PianoRoll`
    - Re-export `PianoRollCanvas`, `default`, `CANVAS_CONFIG`
    - Re-export types `PianoRollCanvasProps`, `SelectionModifiers`
    - _Requirements: 11.1, 11.3, 11.4, 11.7_

  - [x] 10.4 Update components barrel export
    - Update `components/index.ts` to re-export from the new `./PianoRoll` location
    - Ensure `PianoRollCanvas` and `CANVAS_CONFIG` are exported
    - _Requirements: 11.2, 11.6_

- [x] 11. Verify backward compatibility and functional parity
  - [x] 11.1 Write backward compatibility smoke tests
    - Test import from `@/components/PianoRollCanvas`
    - Test import from `@/components` barrel export
    - Test import from `@/components/PianoRoll`
    - Verify `PianoRollCanvas`, `CANVAS_CONFIG` are accessible
    - Verify type imports resolve correctly
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 11.2 Write integration tests for functional parity
    - Test note creation via click
    - Test note drag to move
    - Test note resize via right edge drag
    - Test marquee selection
    - Test scrollbar interaction
    - Test keyboard shortcuts (Space, Delete, Ctrl+A)
    - Verify existing test patterns pass without modification
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 13.1, 13.2, 13.3_

- [x] 12. Final checkpoint - Full verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout the refactoring
- Property tests validate universal correctness properties for pure utility functions
- Unit tests validate specific examples and edge cases for hooks
- The design uses TypeScript throughout, matching the existing codebase
- External dependencies from `@/utils/grid-snap`, `@/lib/note-utils`, `@/hooks`, and `@/lib/selection-utils` remain unchanged
- The refactoring preserves all existing functionality - no feature additions or behavior changes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "5.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "5.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "7.1"] },
    { "id": 5, "tasks": ["8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3", "8.4"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.4"] },
    { "id": 9, "tasks": ["11.1", "11.2"] }
  ]
}
```
