# Implementation Plan: Homepage Visualizer

## Overview

This plan implements two visual enhancements to the homepage melody feed: a duration display on each MelodyCard and a canvas-based audio visualizer that appears below the actively playing card. Implementation is incremental — data layer first, then UI components, then audio integration, and finally wiring everything together.

## Tasks

- [x] 1. Add duration computation to the data layer
  - [x] 1.1 Add `durationSeconds` to `MelodySummary` type and create `computeMelodyDuration` utility
    - Add `durationSeconds: number` field to the `MelodySummary` interface in `types/melody.ts`
    - Create `lib/duration.ts` with `computeMelodyDuration(notes: Note[], tempo: number): number`
    - The function returns `Math.round((Math.max(...notes.map(n => n.start + n.duration)) / tempo * 60) * 100) / 100`
    - Returns 0 for empty notes array or non-positive tempo
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Write property test for duration computation
    - **Property 1: Duration Computation Correctness**
    - Generate random note arrays (with positive start/duration) and positive tempos
    - Verify computed result matches the formula exactly
    - Verify empty notes or non-positive tempo returns 0
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 1.3 Update `getMelodiesPaginated` to include `durationSeconds` in results
    - Modify the SQL query in `lib/melodies.ts` to also select `notes` and `tempo`
    - Update `rowToMelodySummary` to call `computeMelodyDuration` and include `durationSeconds`
    - _Requirements: 1.1, 1.2_

- [x] 2. Implement duration display on MelodyCard
  - [x] 2.1 Create `formatDuration` utility function
    - Create `utils/duration.ts` with `formatDuration(durationSeconds: number | null | undefined): string`
    - Return "0:00" for undefined, null, negative, or zero values
    - Format < 60s as "0:SS", 60s–3599s as "M:SS", ≥ 3600s as "H:MM:SS"
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 2.2 Write property tests for duration formatting
    - **Property 2: Duration Formatting Decomposition**
    - Generate random non-negative seconds, verify the formatted string decomposes correctly back to the floored-second value
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

  - [x] 2.3 Write property test for invalid duration guard
    - **Property 3: Invalid Duration Guard**
    - Generate undefined, null, negative, and zero inputs, verify "0:00" output
    - **Validates: Requirements 2.6**

  - [x] 2.4 Add duration display to `MelodyCard` component
    - Import `formatDuration` in `components/MelodyCard.tsx`
    - Render formatted duration in a `<p>` element between the title and creation date
    - Style with smaller font size and lower-contrast text matching date styling
    - _Requirements: 2.1, 2.7_

- [x] 3. Checkpoint - Ensure duration feature works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add Tone.Analyser to the feed preview audio chain
  - [x] 4.1 Modify `useFeedPreview` to create and expose a `Tone.Analyser` ref
    - Add `analyserRef: React.RefObject<Tone.Analyser | null>` to the hook's return type
    - Create a `Tone.Analyser` with FFT size 64 and smoothing 0.8 when the synth is initialized
    - Connect the analyser at the end of the audio chain (after limiter, before destination)
    - In the disposal/cleanup logic, wrap analyser disconnect and dispose in try/finally to guarantee cleanup even if synth disposal fails
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 5. Implement AudioVisualizer component
  - [x] 5.1 Create `components/AudioVisualizer.tsx` with canvas rendering
    - Accept `analyserRef: React.RefObject<Tone.Analyser | null>` and optional `barCount` (default 32) props
    - Render a `<canvas>` element with `aria-hidden="true"`, `tabindex="-1"`, no ARIA roles/labels
    - Canvas width matches parent container, fixed height of 48px
    - Use `requestAnimationFrame` loop to read frequency data from analyser and draw bars
    - Normalize dB values from Float32Array to 0–255 range for bar height calculation
    - Bar height = `(amplitude / 255) * canvasHeight`, evenly spaced bars across width
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 3.8, 5.2, 5.6, 7.1, 7.2, 7.3_

  - [x] 5.2 Add IntersectionObserver-based animation pause/resume
    - Use IntersectionObserver to detect when the canvas is fully outside the viewport (0% intersection)
    - When off-screen: cancel the active `requestAnimationFrame` callback
    - When transitioning from off-screen to visible: resume the animation loop immediately
    - If IntersectionObserver is not supported, fallback to always-animate behavior
    - If a render frame exceeds 16ms, skip the visual update without queuing additional frames
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 5.3 Write property test for bar height scaling
    - **Property 4: Bar Height Proportional Scaling**
    - Generate random amplitude values (0–255) and visualizer heights (32–48px)
    - Verify bar height equals `(amplitude / 255) * visualizerHeight`
    - Verify amplitude 0 → height 0 and amplitude 255 → full height
    - **Validates: Requirements 3.7, 3.8**

  - [x] 5.4 Write unit tests for AudioVisualizer accessibility attributes
    - Verify canvas renders with `aria-hidden="true"` and `tabindex="-1"`
    - Verify no ARIA live regions, roles, or labels are present
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 6. Wire visualizer into MelodyFeed
  - [x] 6.1 Update `MelodyFeed` to conditionally render `AudioVisualizer` below playing card
    - Import `AudioVisualizer` component
    - Destructure `analyserRef` from `useFeedPreview()` return value
    - Wrap each melody item in `React.Fragment` and render `<AudioVisualizer>` below the `MelodyCard` when `previewingMelodyId === melody.id`
    - The visualizer is removed from DOM when playback stops or a different melody starts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4_

  - [x] 6.2 Write unit tests for MelodyFeed visualizer integration
    - Verify visualizer renders only when a melody is playing
    - Verify visualizer is removed when playback stops
    - Verify existing screen reader announcements for playing state are not disrupted
    - _Requirements: 3.2, 3.3, 7.4_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript, Vitest for testing, and fast-check for property-based tests
- The AudioVisualizer is scoped exclusively to the homepage (`/`) route via its placement inside `MelodyFeed`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4", "4.1"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2"] }
  ]
}
```
