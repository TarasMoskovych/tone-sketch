# Requirements Document

## Introduction

This document specifies the requirements for refactoring the `PianoRollCanvas` component from a single ~3000-line file into a modular, well-organized folder structure. The refactoring aims to improve code maintainability, readability, and testability while preserving all existing functionality and maintaining backward compatibility with current consumers.

## Glossary

- **PianoRollCanvas**: The main React component that renders a piano roll grid using HTML5 Canvas for music note editing
- **Barrel_Export**: An `index.ts` file that re-exports modules from a folder, enabling clean import paths
- **Coordinate_Converter**: Utility functions that convert between pixel coordinates and musical coordinates (beats/pitches)
- **Rendering_Function**: A function responsible for drawing a specific visual layer on the canvas (grid, notes, playhead, etc.)
- **Event_Handler**: A callback function that responds to user interactions (mouse, touch, keyboard events)
- **Drag_State**: State object tracking an ongoing drag operation (note move, resize, or scrollbar drag)
- **Marquee_State**: State object tracking an ongoing rectangle selection operation
- **Canvas_Config**: Configuration constants defining colors, dimensions, and behavior parameters for the canvas
- **Consumer**: Code that imports and uses the PianoRollCanvas component (e.g., `app/create/page.tsx`, `app/m/[id]/page.tsx`)
- **Hook**: A custom React hook that encapsulates reusable stateful logic

## Requirements

### Requirement 1: Folder Structure Organization

**User Story:** As a developer, I want the PianoRollCanvas code organized in a dedicated folder, so that related files are co-located and easy to navigate.

#### Acceptance Criteria

1. THE Refactoring SHALL create a `components/PianoRoll/` folder to contain all PianoRollCanvas-related files
2. THE Refactoring SHALL create a Barrel_Export file at `components/PianoRoll/index.ts` that exports all public interfaces
3. THE Refactoring SHALL place each logical module in its own file within the `components/PianoRoll/` folder
4. THE Refactoring SHALL maintain a flat structure within the folder (no nested subfolders) for simplicity

### Requirement 2: Constants and Configuration Extraction

**User Story:** As a developer, I want canvas configuration constants in a separate file, so that I can easily find and modify visual parameters.

#### Acceptance Criteria

1. THE Refactoring SHALL extract `CANVAS_CONFIG` to `components/PianoRoll/constants.ts`
2. THE Refactoring SHALL extract `DEFAULT_GRID_SNAP_CONFIG` to `components/PianoRoll/constants.ts`
3. THE Refactoring SHALL extract `DEFAULT_VISIBLE_REGION` to `components/PianoRoll/constants.ts`
4. THE Refactoring SHALL extract `RESIZE_HANDLE_WIDTH` to `components/PianoRoll/constants.ts`
5. THE Barrel_Export SHALL re-export `CANVAS_CONFIG` for backward compatibility with existing Consumer imports

### Requirement 3: Type Definitions Extraction

**User Story:** As a developer, I want type definitions in a separate file, so that I can understand the component's data contracts at a glance.

#### Acceptance Criteria

1. THE Refactoring SHALL extract the `PianoRollCanvasProps` interface to `components/PianoRoll/types.ts`
2. THE Refactoring SHALL extract the `SelectionModifiers` interface to `components/PianoRoll/types.ts`
3. THE Refactoring SHALL extract the `DragState` interface to `components/PianoRoll/types.ts`
4. THE Refactoring SHALL extract the `ScrollbarDragState` interface to `components/PianoRoll/types.ts`
5. THE Refactoring SHALL extract the `MarqueeState` interface to `components/PianoRoll/types.ts`
6. THE Barrel_Export SHALL re-export `PianoRollCanvasProps` and `SelectionModifiers` for backward compatibility

### Requirement 4: Coordinate Conversion Utilities Extraction

**User Story:** As a developer, I want coordinate conversion functions in a dedicated utilities file, so that the pixel-to-beat/pitch logic is reusable and testable.

#### Acceptance Criteria

1. THE Refactoring SHALL extract `pixelXToBeat` function to `components/PianoRoll/coordinate-utils.ts`
2. THE Refactoring SHALL extract `pixelYToPitch` function to `components/PianoRoll/coordinate-utils.ts`
3. THE Refactoring SHALL extract `beatToPixelX` function to `components/PianoRoll/coordinate-utils.ts`
4. THE Refactoring SHALL extract `calculateScrollbarState` function to `components/PianoRoll/coordinate-utils.ts`
5. THE Refactoring SHALL extract `isOctaveBoundary` helper function to `components/PianoRoll/coordinate-utils.ts`
6. WHEN a Coordinate_Converter function is called with the same parameters, THE function SHALL return identical results before and after refactoring

### Requirement 5: Rendering Functions Extraction

**User Story:** As a developer, I want rendering functions in a dedicated file, so that canvas drawing logic is isolated from React component logic.

#### Acceptance Criteria

1. THE Refactoring SHALL extract `renderGrid` function to `components/PianoRoll/renderers.ts`
2. THE Refactoring SHALL extract `renderNotes` function to `components/PianoRoll/renderers.ts`
3. THE Refactoring SHALL extract `renderPlayhead` function to `components/PianoRoll/renderers.ts`
4. THE Refactoring SHALL extract `renderPitchLabels` function to `components/PianoRoll/renderers.ts`
5. THE Refactoring SHALL extract `renderTimeMarkers` function to `components/PianoRoll/renderers.ts`
6. THE Refactoring SHALL extract `renderScrollbars` function to `components/PianoRoll/renderers.ts`
7. THE Refactoring SHALL extract `renderMarquee` function to `components/PianoRoll/renderers.ts`
8. THE Refactoring SHALL extract `calculateNotePosition` function to `components/PianoRoll/renderers.ts`
9. THE Refactoring SHALL extract `setupCanvas` function to `components/PianoRoll/renderers.ts`

### Requirement 6: Event Handler Utilities Extraction

**User Story:** As a developer, I want event handling utilities in a dedicated file, so that interaction logic is separated from the main component.

#### Acceptance Criteria

1. THE Refactoring SHALL extract `findNoteAtPosition` function to `components/PianoRoll/event-utils.ts`
2. THE Refactoring SHALL extract `findNoteAtPixelPosition` function to `components/PianoRoll/event-utils.ts`
3. THE Refactoring SHALL extract `isClickOnExistingNote` function to `components/PianoRoll/event-utils.ts`
4. THE Refactoring SHALL extract `isOnResizeHandle` function to `components/PianoRoll/event-utils.ts`
5. THE Refactoring SHALL extract `getScrollbarAtPosition` function to `components/PianoRoll/event-utils.ts`

### Requirement 7: Touch Gesture Utilities Extraction

**User Story:** As a developer, I want touch gesture handling in a dedicated file, so that mobile/trackpad interaction logic is isolated.

#### Acceptance Criteria

1. THE Refactoring SHALL extract `getTouchDistance` function to `components/PianoRoll/touch-utils.ts`
2. THE Refactoring SHALL extract `getTouchCenter` function to `components/PianoRoll/touch-utils.ts`
3. WHEN a touch gesture is performed after refactoring, THE pinch-to-zoom behavior SHALL work identically to before refactoring

### Requirement 8: Custom Hook for Drag State Management

**User Story:** As a developer, I want drag state logic encapsulated in a custom hook, so that the main component is cleaner and the logic is reusable.

#### Acceptance Criteria

1. THE Refactoring SHALL create a `useDragState` hook in `components/PianoRoll/hooks/useDragState.ts`
2. THE useDragState Hook SHALL manage note drag operations (move and resize)
3. THE useDragState Hook SHALL manage scrollbar drag operations
4. THE useDragState Hook SHALL support drag cancellation via Escape key with state restoration
5. WHEN Escape is pressed during a drag operation, THE original note positions SHALL be restored exactly as before refactoring

### Requirement 9: Custom Hook for Marquee Selection

**User Story:** As a developer, I want marquee selection logic encapsulated in a custom hook, so that rectangle selection behavior is isolated and testable.

#### Acceptance Criteria

1. THE Refactoring SHALL create a `useMarqueeSelection` hook in `components/PianoRoll/hooks/useMarqueeSelection.ts`
2. THE useMarqueeSelection Hook SHALL manage the marquee rectangle state during drag
3. THE useMarqueeSelection Hook SHALL calculate intersecting notes during marquee drag
4. THE useMarqueeSelection Hook SHALL support additive selection mode (Ctrl/Cmd modifier)
5. THE useMarqueeSelection Hook SHALL support selection cancellation via Escape key with state restoration

### Requirement 10: Main Component Simplification

**User Story:** As a developer, I want the main PianoRollCanvas.tsx file to be a thin orchestration layer, so that it's easy to understand the component's structure.

#### Acceptance Criteria

1. THE Refactoring SHALL place the main PianoRollCanvas component in `components/PianoRoll/PianoRollCanvas.tsx`
2. THE main component file SHALL import and compose modules from the other files in the folder
3. THE main component file SHALL be reduced to under 500 lines of code
4. THE main component file SHALL focus on React lifecycle, state orchestration, and event handler wiring

### Requirement 11: Backward Compatibility

**User Story:** As a developer using PianoRollCanvas, I want my existing imports to continue working, so that the refactoring doesn't break my code.

#### Acceptance Criteria

1. WHEN a Consumer imports from `@/components/PianoRollCanvas`, THE import SHALL resolve successfully
2. WHEN a Consumer imports `PianoRollCanvas` from `@/components`, THE import SHALL resolve successfully
3. WHEN a Consumer imports `CANVAS_CONFIG` from `@/components/PianoRollCanvas`, THE import SHALL resolve successfully
4. WHEN a Consumer imports `PianoRollCanvasProps` type from `@/components/PianoRollCanvas`, THE import SHALL resolve successfully
5. WHEN a Consumer imports `SelectionModifiers` type from `@/components/PianoRoll`, THE import SHALL resolve successfully
6. THE Refactoring SHALL update `components/index.ts` to re-export from the new location
7. THE Refactoring SHALL create a backward-compatible alias at `components/PianoRollCanvas.tsx` that re-exports from the new location

### Requirement 12: Functional Parity

**User Story:** As a user of the piano roll editor, I want all existing features to work identically after refactoring, so that my workflow is not disrupted.

#### Acceptance Criteria

1. WHEN a user clicks on the grid to create a note, THE note creation behavior SHALL be identical to before refactoring
2. WHEN a user drags a note to move it, THE drag behavior SHALL be identical to before refactoring
3. WHEN a user drags the right edge of a note to resize, THE resize behavior SHALL be identical to before refactoring
4. WHEN a user uses marquee selection to select multiple notes, THE selection behavior SHALL be identical to before refactoring
5. WHEN a user scrolls or zooms the canvas, THE navigation behavior SHALL be identical to before refactoring
6. WHEN a user uses keyboard shortcuts (Space, Delete, Ctrl+A), THE shortcut behavior SHALL be identical to before refactoring
7. WHEN the playhead moves during playback, THE visual rendering SHALL be identical to before refactoring
8. WHEN keyboard piano keys are pressed, THE row highlighting SHALL be identical to before refactoring

### Requirement 13: Test Compatibility

**User Story:** As a developer, I want existing tests to pass without modification, so that refactoring doesn't introduce regressions.

#### Acceptance Criteria

1. WHEN property-based tests import `CANVAS_CONFIG`, THE import SHALL resolve to the same values as before refactoring
2. WHEN integration tests verify component behavior, THE tests SHALL pass without modification
3. THE Refactoring SHALL not change any exported function signatures or return types
