# Technical Design Document

## Overview

Tone Sketch is a web-based music creation platform built as a full-stack Next.js application. The system enables users to sketch melodies using a piano roll editor, preview them through a Tone.js-powered synthesizer, and share compositions publicly. The architecture prioritizes real-time audio-visual synchronization, responsive UI interactions at 60fps, and reliable data persistence through PostgreSQL.

### Key Design Goals

1. **Low-latency audio**: Sub-50ms playback response using Tone.js Web Audio scheduling
2. **Smooth interactions**: 60fps rendering during drag operations and playback
3. **Simple ownership model**: localStorage-based owner_id without user authentication
4. **Atomic persistence**: Database transactions ensure melody data integrity

### Technology Stack

- **Frontend**: Next.js 16 (App Router) with React 19, TypeScript
- **Audio Engine**: Tone.js for Web Audio synthesis
- **Canvas Rendering**: HTML5 Canvas for piano roll grid (performance-critical)
- **Database**: Neon Postgres (via Vercel Marketplace, free tier available) with JSONB for flexible note/synth storage
- **Database Client**: `@neondatabase/serverless` for serverless-optimized PostgreSQL queries
- **Styling**: Tailwind CSS for UI components
- **Deployment**: Vercel (serverless functions for API routes)

## Environment Configuration

The application requires environment variables to be configured for database connectivity.

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon Postgres connection string | `postgres://user:pass@host/db?sslmode=require` |

### .env.example

The project root contains an `.env.example` file documenting all required environment variables:

```bash
# Database Configuration
# Neon Postgres connection string for serverless PostgreSQL
# Format: postgres://[user]:[password]@[host]/[database]?sslmode=require
DATABASE_URL=postgres://username:password@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

## Architecture

The application follows a layered architecture separating UI, business logic, audio engine, and data persistence concerns.

```mermaid
graph TB
    subgraph "Client Browser"
        UI[React UI Components]
        PianoRoll[Piano Roll Canvas]
        SynthEngine[Tone.js Synth Engine]
        Effects[Audio Effects Chain]
        Presets[Synth Presets]
        LocalStorage[localStorage]
        Hooks[Custom Hooks]
    end

    subgraph "Next.js Server"
        Pages[Pages/App Router]
        API[API Routes]
        Validation[Validation Layer]
    end

    subgraph "Data Layer"
        DB[(Neon Postgres)]
    end

    UI --> PianoRoll
    UI --> SynthEngine
    SynthEngine --> Effects
    Presets --> SynthEngine
    Presets --> Effects
    PianoRoll --> SynthEngine
    UI --> LocalStorage
    Hooks --> UI
    Hooks --> SynthEngine
    Hooks --> PianoRoll

    UI --> Pages
    Pages --> API
    API --> Validation
    Validation --> DB
```

### System Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant Canvas as Piano Roll
    participant Synth as Tone.js
    participant API as API Routes
    participant DB as Neon Postgres

    User->>UI: Navigate to /create
    UI->>Canvas: Initialize empty grid
    UI->>Synth: Initialize with defaults

    User->>Canvas: Click to add note
    Canvas->>Canvas: Create note at position
    Canvas->>Synth: Schedule note preview

    User->>UI: Click Play
    UI->>Synth: Start playback
    Synth->>Canvas: Update playhead position

    User->>UI: Click Save
    UI->>API: POST /api/melodies
    API->>DB: INSERT melody
    DB-->>API: Return id
    API-->>UI: Redirect to /m/[id]
```

## Components and Interfaces

### Core Components

#### 1. PianoRollEditor

The primary visual editing interface rendered using HTML5 Canvas for performance.

```typescript
interface PianoRollEditorProps {
  notes: Note[];
  playheadPosition: number;
  isPlaying: boolean;
  gridSnap: GridSnapConfig;
  visibleRegion: VisibleRegion;
  readOnly: boolean;
  highlightedPitch: number | null; // Currently highlighted pitch from keyboard piano
  totalBeats?: number; // Optional explicit canvas length, otherwise calculated dynamically
  autoScrollDuringPlayback?: boolean; // Enable auto-scroll during playback, default true
  onNoteCreate: (note: Note) => void;
  onNoteUpdate: (noteId: string, updates: Partial<Note>) => void;
  onNoteDelete: (noteId: string) => void;
  onPlayheadChange: (position: number) => void;
  onVisibleRegionChange: (region: VisibleRegion) => void;
  onKeyboardShortcut: (action: KeyboardAction) => void;
  onKeyboardPianoNote: (pitch: number, isPressed: boolean) => void; // Keyboard piano events
}

type KeyboardAction = 'togglePlayback' | 'delete';

interface GridSnapConfig {
  enabled: boolean;
  division: GridDivision;
}

type GridDivision = 1 | 0.5 | 0.25 | 0.125 | 0.0625; // 1, 1/2, 1/4, 1/8, 1/16 beats

interface VisibleRegion {
  startBeat: number;
  endBeat: number;
  startPitch: number; // MIDI note number
  endPitch: number;
}

interface ScrollbarState {
  horizontalPosition: number; // 0-1 normalized position
  verticalPosition: number;   // 0-1 normalized position
  horizontalThumbSize: number; // 0-1 proportion of visible area
  verticalThumbSize: number;   // 0-1 proportion of visible area
}
```

**Rendering Strategy**:
- Use `requestAnimationFrame` for smooth 60fps updates
- Batch note rendering by visible region
- Separate layers for grid, notes, playhead, and scrollbars
- Debounce scroll events to prevent excessive redraws
- Render note name labels (C4, C#4, D4, etc.) for all visible pitch rows
- Display horizontal scrollbar at bottom, vertical scrollbar on right
- Synchronize scrollbar thumb position and size with visible region
- Highlight piano row background when keyboard piano key is held

**Dynamic Canvas Length**:
- Calculate effective canvas length from notes: find last note end time, add 16-beat buffer, round to nearest 16 beats
- Minimum canvas length: 64 beats regardless of note content
- Use `totalBeats` prop if provided to override automatic calculation
- Recalculate on notes array change or MIDI import

**Auto-Scroll During Playback**:
- Monitor playhead position relative to visible region width during active playback
- Trigger scroll when playhead reaches 80% of visible horizontal region
- Reposition view so playhead is at 20% from left edge of visible region
- Only active when `isPlaying` is true and `autoScrollDuringPlayback` is true (default)
- Does not interfere with manual scrolling when playback is inactive

**Playhead Rendering**:
- Color: Bright red (#FF0000) for high contrast visibility
- Width: Minimum 2 pixels
- Height: Full height of the visible piano roll grid area
- Z-index: Higher than all Note elements (rendered on top layer)

**Keyboard Shortcuts**:
- Space bar: Toggle play/stop (only when Piano Roll has focus, not in text inputs)
- Delete/Backspace: Delete selected note

**Note Name Display**:
- Display scientific pitch notation (C4, C#4, D4, D#4, E4, F4, F#4, G4, G#4, A4, A#4, B4, etc.)
- Middle C (MIDI 60) = C4
- Fixed-width label column on left side, visible during horizontal scroll
- Visual distinction between natural notes and sharps (e.g., background color)

#### 2. SynthesizerEngine

Wraps Tone.js to provide melody playback with configurable sound parameters.

```typescript
interface SynthesizerConfig {
  oscillatorType: OscillatorType;
  volume: number; // 0-1
  envelope: ADSREnvelope;
  filter: FilterConfig;
  effects: EffectsConfig;
  presetName: string | null; // null if custom settings
}

type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface ADSREnvelope {
  attack: number;  // 0-2 seconds
  decay: number;   // 0-2 seconds
  sustain: number; // 0-1 level
  release: number; // 0-5 seconds
}

interface FilterConfig {
  enabled: boolean;
  type: 'lowpass' | 'highpass';
  frequency: number; // 20-20000 Hz
}

interface EffectsConfig {
  reverb: ReverbConfig;
  delay: DelayConfig;
  chorus: ChorusConfig;
  flanger: FlangerConfig;
}

interface ReverbConfig {
  enabled: boolean;
  roomSize: number; // 0-1, default 0.5
  wetDry: number;   // 0-1, default 0.3
}

interface DelayConfig {
  enabled: boolean;
  time: number;     // 0-1 seconds, default 0.25
  feedback: number; // 0-0.9, default 0.3
  wetDry: number;   // 0-1, default 0.3
}

interface ChorusConfig {
  enabled: boolean;
  rate: number;     // 0.1-10 Hz, default 1.5
  depth: number;    // 0-1, default 0.5
  wetDry: number;   // 0-1, default 0.3
}

interface FlangerConfig {
  enabled: boolean;
  rate: number;     // 0.1-10 Hz, default 0.5
  depth: number;    // 0-1, default 0.5
  feedback: number; // 0-0.9, default 0.5
  wetDry: number;   // 0-1, default 0.3
}

interface SynthesizerEngine {
  configure(config: Partial<SynthesizerConfig>): void;
  applyPreset(presetName: PresetName): SynthesizerConfig;
  play(notes: Note[], startPosition: number, loop: boolean): void;
  pause(): void;
  stop(): void;
  setPlayheadPosition(position: number): void;
  setTempo(bpm: number): void;   // Set playback tempo, clamped to 40-240 BPM
  getTempo(): number;            // Get current tempo in BPM
  onPlayheadUpdate: (callback: (position: number) => void) => void;
  triggerNote(note: Note): void;
  dispose(): void;
}

type PresetCategory = 'Piano' | 'Lead' | 'Pluck' | 'Guitar' | 'Bass';

interface SynthPreset {
  name: PresetName;
  category: PresetCategory;
  config: Omit<SynthesizerConfig, 'presetName'>;
}

type PresetName =
  | 'Acoustic Piano' | 'Electric Piano' | 'Soft Piano'
  | 'Classic Lead' | 'Saw Lead' | 'Square Lead'
  | 'Short Pluck' | 'Soft Pluck' | 'Bright Pluck'
  | 'Clean Guitar' | 'Muted Guitar' | 'Acoustic Guitar'
  | 'Sub Bass' | 'Synth Bass' | 'Punchy Bass';
```

**Implementation Notes**:
- Use Tone.js `PolySynth` for polyphonic playback
- Schedule notes using Tone.js Transport for precise timing
- Apply filter via Tone.js `Filter` node in audio chain
- Apply effects via Tone.js effect nodes (`Reverb`, `FeedbackDelay`, `Chorus`, `Phaser` for flanger)
- Chain audio nodes: Synth → Filter → Effects → Master Output
- Use `Tone.Draw` to synchronize visual updates with audio
- Tempo control via `Tone.getTransport().bpm.value`, clamped to 40-240 BPM range
- Tempo changes apply immediately during playback without restart

#### 3. SynthControls

UI component for adjusting synthesizer parameters including tempo control.

```typescript
interface SynthControlsProps {
  config: SynthesizerConfig;
  onChange: (config: Partial<SynthesizerConfig>) => void;
  onPresetChange?: (presetName: PresetName) => void;
  tempo?: number;                        // Current tempo in BPM (40-240)
  onTempoChange?: (tempo: number) => void; // Callback when tempo slider changes
  disabled: boolean;
}
```

**Tempo Control**:
- Positioned below Volume slider in the controls layout
- Range: 40-240 BPM, default 120 BPM, step 1
- Display format: "{value} BPM" (e.g., "120 BPM")
- When `tempo` prop is provided, renders tempo slider
- When `onTempoChange` is undefined or disabled=true, slider is read-only
- Updates playback speed in real-time via `Tone.getTransport().bpm.value`

#### 4. EffectsControls

UI component for adjusting audio effects parameters.

```typescript
interface EffectsControlsProps {
  effects: EffectsConfig;
  onChange: (effects: Partial<EffectsConfig>) => void;
  disabled: boolean;
}
```

#### 5. PresetSelector

UI component for selecting synthesizer presets.

```typescript
interface PresetSelectorProps {
  currentPreset: PresetName | null;
  onPresetSelect: (presetName: PresetName) => void;
  disabled: boolean;
}

// Presets are grouped by category for display
interface PresetGroup {
  category: PresetCategory;
  presets: SynthPreset[];
}
```

#### 6. TransportControls

Playback control buttons (play, pause, stop, loop toggle).

```typescript
interface TransportControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  isLooping: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onLoopToggle: () => void;
}
```

#### 7. GridSnapControls

Toggle and division selector for grid snapping.

```typescript
interface GridSnapControlsProps {
  config: GridSnapConfig;
  onChange: (config: GridSnapConfig) => void;
}
```

#### 8. PianoRollScrollbars

Scrollbar controls for navigating the piano roll grid.

```typescript
interface PianoRollScrollbarsProps {
  visibleRegion: VisibleRegion;
  totalBeats: number;       // Total timeline length
  totalPitchRange: number;  // 128 (MIDI 0-127)
  onHorizontalScroll: (position: number) => void;
  onVerticalScroll: (position: number) => void;
}
```

**Implementation Notes**:
- Horizontal scrollbar at bottom for time navigation
- Vertical scrollbar on right for pitch navigation
- Thumb size proportional to visible region / total range
- Bidirectional sync: scrollbar changes update visible region, visible region changes update scrollbar

#### 9. MelodyFeed

Homepage feed displaying paginated melody list with preview capabilities.

```typescript
interface MelodyFeedProps {
  initialMelodies: MelodySummary[];
}

interface MelodySummary {
  id: string;
  title: string;
  createdAt: string;
}
```

#### 10. MelodyCard

Individual feed item with play preview and navigation.

```typescript
interface MelodyCardProps {
  melody: MelodySummary;
  isPlaying: boolean;
  isLoading: boolean;
  onPlayClick: () => void;
  onStopClick: () => void;
}

#### 11. MidiControls

Shared component for MIDI file import and export operations.

```typescript
interface MidiControlsProps {
  notes: Note[];
  title: string;
  tempo: number;
  onImport: (notes: Note[], tempo: number) => void;
  allowImport?: boolean; // Whether to show import button, default false
}
```

**Implementation Notes**:
- Uses `useMidiImportExport` hook internally for MIDI parsing and file generation
- Export button always visible, triggers download with current notes, title, and tempo
- Import button conditionally shown based on `allowImport` prop
- On create page: `allowImport={true}` for new compositions
- On melody edit page: `allowImport={isOwner}` to restrict import to owners only
- Handles file size validation (max 5MB) and parse errors with user feedback
```

### Icons Module

All SVG icons are centralized in `components/icons/` for reusability and maintainability.

```typescript
// components/icons/index.ts - barrel export
export { PlayIcon } from './PlayIcon';
export { PauseIcon } from './PauseIcon';
export { StopIcon } from './StopIcon';
export { LoopIcon } from './LoopIcon';
export { DeleteIcon } from './DeleteIcon';
export { SaveIcon } from './SaveIcon';
export { UploadIcon } from './UploadIcon';
export { DownloadIcon } from './DownloadIcon';
export { ErrorIcon } from './ErrorIcon';
export { LoadingIcon } from './LoadingIcon';
export { ChevronIcon } from './ChevronIcon';
export { GridIcon } from './GridIcon';

// Icon component interface
interface IconProps {
  className?: string;
  size?: number;
  'aria-hidden'?: boolean;
}
```

**Implementation Notes**:
- Each icon is a named export accepting `className` prop for Tailwind styling
- No inline SVGs in page files or non-icon components
- Icons from TransportControls, MelodyCard, MelodyFeed, PageErrorFallback, GridSnapControls migrated here

### Custom Hooks

Business logic is extracted from page files into reusable custom hooks in the `hooks/` directory.

```typescript
// hooks/index.ts - barrel export
export { usePianoRoll } from './usePianoRoll';
export { useSynthesizer } from './useSynthesizer';
export { usePlayback } from './usePlayback';
export { useMelodyPersistence } from './useMelodyPersistence';
export { useMidiImportExport } from './useMidiImportExport';
export { useOwnership } from './useOwnership';
export { useFeedPreview } from './useFeedPreview';
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export { useKeyboardPiano } from './useKeyboardPiano';
```

#### usePianoRoll

Manages piano roll state including notes, selection, and visible region.

```typescript
interface UsePianoRollReturn {
  notes: Note[];
  selectedNoteId: string | null;
  visibleRegion: VisibleRegion;
  gridSnap: GridSnapConfig;
  createNote: (pitch: number, start: number) => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  deleteNote: (noteId: string) => void;
  setVisibleRegion: (region: VisibleRegion) => void;
  setGridSnap: (config: GridSnapConfig) => void;
  selectNote: (noteId: string | null) => void;
  clearNotes: () => void;
  loadNotes: (notes: Note[]) => void;
}
```

#### useSynthesizer

Manages synthesizer configuration, presets, and effects.

```typescript
interface UseSynthesizerReturn {
  config: SynthesizerConfig;
  updateConfig: (updates: Partial<SynthesizerConfig>) => void;
  applyPreset: (presetName: PresetName) => void;
  updateEffects: (effects: Partial<EffectsConfig>) => void;
  resetToDefaults: () => void;
}
```

#### usePlayback

Manages playback state and transport controls.

```typescript
interface UsePlaybackReturn {
  isPlaying: boolean;
  isPaused: boolean;
  isLooping: boolean;
  playheadPosition: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggleLoop: () => void;
  setPlayheadPosition: (position: number) => void;
}
```

#### useMelodyPersistence

Handles saving and loading melodies to/from the API.

```typescript
interface UseMelodyPersistenceReturn {
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  saveMelody: (melody: MelodyData) => Promise<string>;
  updateMelody: (id: string, melody: MelodyData) => Promise<void>;
  deleteMelody: (id: string) => Promise<void>;
  loadMelody: (id: string) => Promise<Melody>;
}
```

#### useKeyboardShortcuts

Handles keyboard shortcuts for the piano roll.

```typescript
interface UseKeyboardShortcutsProps {
  enabled: boolean;
  onTogglePlayback: () => void;
  onDeleteNote: () => void;
  containerRef: React.RefObject<HTMLElement>;
}

interface UseKeyboardShortcutsReturn {
  // Hook sets up event listeners, no return values needed
}
```

**Implementation Notes**:
- Page files limited to ~150 lines (excluding imports/types)
- Pages handle routing, layout composition, and hook orchestration
- Hooks handle all stateful business logic
- Pages with 3+ state concerns split logic into separate hooks

#### useKeyboardPiano

Manages keyboard-to-MIDI note mapping for playing notes via computer keyboard.

```typescript
interface UseKeyboardPianoProps {
  enabled: boolean;
  synthesizerReady: boolean;
  onNoteOn: (pitch: number, velocity: number) => void;
  onNoteOff: (pitch: number) => void;
  containerRef: React.RefObject<HTMLElement>;
}

interface UseKeyboardPianoReturn {
  pressedKeys: Set<string>;        // Currently pressed keyboard keys
  highlightedPitch: number | null; // Primary highlighted pitch for visual feedback
  activePitches: Set<number>;      // All currently active pitches (for polyphony)
}

// Keyboard to MIDI note mapping
interface KeyboardPianoMapping {
  // Bottom row (Z-M): C3 to B3 white keys
  'z': 48, // C3
  'x': 50, // D3
  'c': 52, // E3
  'v': 53, // F3
  'b': 55, // G3
  'n': 57, // A3
  'm': 59, // B3

  // Middle row (A-L): C4 to B4 white keys
  'a': 60, // C4 (Middle C)
  's': 62, // D4
  'd': 64, // E4
  'f': 65, // F4
  'g': 67, // G4
  'h': 69, // A4
  'j': 71, // B4
  'k': 72, // C5
  'l': 74, // D5

  // Top row (Q-P): C5 to B5 white keys
  'q': 72, // C5
  'w': 74, // D5
  'e': 76, // E5
  'r': 77, // F5
  't': 79, // G5
  'y': 81, // A5
  'u': 83, // B5
  'i': 84, // C6
  'o': 86, // D6
  'p': 88, // E6

  // Number row: Sharp/black keys for C4 octave
  '2': 61, // C#4
  '3': 63, // D#4
  '5': 66, // F#4
  '6': 68, // G#4
  '7': 70, // A#4
}
```

**Implementation Notes**:
- Listens for `keydown` and `keyup` events on document
- Checks if event target is text input, textarea, or contenteditable before processing
- Maintains Set of currently pressed keys for polyphonic support
- Triggers `onNoteOn` with velocity 0.8 on keydown (if key not already pressed)
- Triggers `onNoteOff` on keyup to allow ADSR release phase
- Does not trigger notes if `synthesizerReady` is false
- Returns `highlightedPitch` for visual feedback in piano roll

### API Routes

#### GET /api/melodies

Fetch paginated melody list for feed.

```typescript
// Query Parameters
interface GetMelodiesQuery {
  page?: number;  // Default: 1
  limit?: number; // Default: 20, Max: 100
}

// Response
interface GetMelodiesResponse {
  melodies: MelodySummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
```

#### GET /api/melodies/[id]

Fetch single melody with full data.

```typescript
// Response
interface GetMelodyResponse {
  id: string;
  title: string;
  notes: Note[];
  tempo: number;
  synth: SynthesizerConfig;
  createdAt: string;
  ownerId: string;
}
```

#### POST /api/melodies

Create new melody.

```typescript
// Request Body
interface CreateMelodyRequest {
  title: string;
  notes: Note[];
  tempo: number;
  synth: SynthesizerConfig;
  ownerId: string;
}

// Response
interface CreateMelodyResponse {
  id: string;
}
```

#### PUT /api/melodies/[id]

Update existing melody.

```typescript
// Request Body
interface UpdateMelodyRequest {
  title: string;
  notes: Note[];
  tempo: number;
  synth: SynthesizerConfig;
  ownerId: string;
}

// Response: 200 OK with empty body on success
```

#### DELETE /api/melodies/[id]

Delete melody.

```typescript
// Request Body
interface DeleteMelodyRequest {
  ownerId: string;
}

// Response: 204 No Content on success
```

### MIDI Processing

#### MidiImporter

Parses MIDI files and converts to internal Note format.

```typescript
interface MidiImporter {
  parse(file: File): Promise<MidiImportResult>;
}

interface MidiImportResult {
  notes: Note[];
  tempo: number;
}

// Supported formats: SMF Type 0 and Type 1
// Max file size: 5MB
// Behavior: Merges all tracks, extracts first tempo event
```

#### MidiExporter

Generates MIDI files from melody data.

```typescript
interface MidiExporter {
  export(melody: ExportableMelody): Blob;
}

interface ExportableMelody {
  title: string;
  notes: Note[];
  tempo: number;
}

// Output format: SMF Type 0
// Includes tempo track and note track
```

## Data Models

### Note

Core data structure for musical events.

```typescript
interface Note {
  id: string;           // UUID v4, client-generated
  pitch: number;        // MIDI note 0-127
  start: number;        // Start time in beats (>= 0, <= 10000)
  duration: number;     // Duration in beats (>= 0.001, <= 1000)
  velocity: number;     // Volume 0-1
}
```

### Melody

Complete composition with metadata.

```typescript
interface Melody {
  id: string;           // UUID v4
  title: string;        // 1-200 characters
  notes: Note[];        // Max 10000 notes
  tempo: number;        // BPM (integer)
  synth: SynthesizerConfig;
  createdAt: Date;
  ownerId: string;      // UUID v4
}
```

### Database Schema

Neon Postgres uses standard PostgreSQL syntax. The database is provisioned via the Vercel Marketplace integration.

```sql
-- Run via Neon console or migration script
CREATE TABLE melodies (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  notes JSONB NOT NULL,
  tempo INT NOT NULL,
  synth JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  owner_id TEXT NOT NULL
);

CREATE INDEX idx_melodies_created_at ON melodies(created_at DESC);
CREATE INDEX idx_melodies_owner_id ON melodies(owner_id);
```

**Neon Connection (Serverless):**
```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Example query
const result = await sql`
  SELECT * FROM melodies WHERE id = ${id}
`;
```

### Validation Constraints

| Field | Type | Constraints |
|-------|------|-------------|
| Note.pitch | integer | 0 ≤ value ≤ 127 |
| Note.start | number | 0 ≤ value ≤ 10000 |
| Note.duration | number | 0.001 ≤ value ≤ 1000 |
| Note.velocity | number | 0 ≤ value ≤ 1 |
| Melody.title | string | 1 ≤ length ≤ 200 |
| Melody.notes | array | length ≤ 10000 |
| Melody.tempo | integer | 40 ≤ value ≤ 240 (BPM) |
| Synth.volume | number | 0 ≤ value ≤ 1 |
| Synth.envelope.attack | number | 0 ≤ value ≤ 2 |
| Synth.envelope.decay | number | 0 ≤ value ≤ 2 |
| Synth.envelope.sustain | number | 0 ≤ value ≤ 1 |
| Synth.envelope.release | number | 0 ≤ value ≤ 5 |
| Synth.filter.frequency | number | 20 ≤ value ≤ 20000 |
| Effects.reverb.roomSize | number | 0 ≤ value ≤ 1 |
| Effects.reverb.wetDry | number | 0 ≤ value ≤ 1 |
| Effects.delay.time | number | 0 ≤ value ≤ 1 |
| Effects.delay.feedback | number | 0 ≤ value ≤ 0.9 |
| Effects.delay.wetDry | number | 0 ≤ value ≤ 1 |
| Effects.chorus.rate | number | 0.1 ≤ value ≤ 10 |
| Effects.chorus.depth | number | 0 ≤ value ≤ 1 |
| Effects.chorus.wetDry | number | 0 ≤ value ≤ 1 |
| Effects.flanger.rate | number | 0.1 ≤ value ≤ 10 |
| Effects.flanger.depth | number | 0 ≤ value ≤ 1 |
| Effects.flanger.feedback | number | 0 ≤ value ≤ 0.9 |
| Effects.flanger.wetDry | number | 0 ≤ value ≤ 1 |


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Note Rendering Position Calculation

*For any* Note with valid pitch (0-127), start time (≥0), and duration (>0), the rendered rectangle position SHALL be calculated as:
- X position = start time × pixels per beat
- Y position = (127 - pitch) × pixels per semitone
- Width = duration × pixels per beat

**Validates: Requirements 1.2**

### Property 2: Note Creation at Valid Position

*For any* click on the piano roll grid at a position not occupied by an existing note, a new Note SHALL be created with:
- pitch = MIDI note corresponding to Y position
- start = beat corresponding to X position (quantized if snap enabled)
- duration = 1 beat (default)
- velocity = 0.8 (default)

**Validates: Requirements 2.1, 2.2**

### Property 3: Grid Snap Quantization

*For any* position value P and grid division D (where D ∈ {1, 0.5, 0.25, 0.125, 0.0625}), when grid snap is enabled, the snapped position SHALL equal `round(P / D) * D`.

**Validates: Requirements 2.3, 3.2, 5.2, 7.4**

### Property 4: Note Boundary Clamping

*For any* drag operation on a Note:
- The start time SHALL be clamped to the range [0, ∞)
- The pitch SHALL be clamped to the range [0, 127]

**Validates: Requirements 3.3, 4.2**

### Property 5: Minimum Duration Enforcement

*For any* resize operation on a Note:
- When grid snap is enabled, the minimum duration SHALL be the current grid division
- When grid snap is disabled, the minimum duration SHALL be 0.1 beats

**Validates: Requirements 5.3, 5.4**

### Property 6: Drag Cancel Restores Original State

*For any* Note with initial position (pitch, start, duration) and any drag operation that is cancelled, the Note SHALL be restored to its exact original position values.

**Validates: Requirements 3.5**

### Property 7: Note Deletion Removes from Melody

*For any* Note in a Melody, when the Note is deleted (via Delete/Backspace key or right-click), the Note SHALL no longer exist in the Melody's notes array.

**Validates: Requirements 6.1, 6.2**

### Property 8: Free Positioning Resolution

*For any* note position when grid snap is disabled, the position SHALL be quantized to 1/32 beat resolution (0.03125 beats).

**Validates: Requirements 7.5**

### Property 9: Timeline Click Positions Playhead

*For any* click on the timeline area at time T, the playhead position SHALL be set to T.

**Validates: Requirements 8.5**

### Property 10: MIDI Import/Export Round-Trip

*For any* valid set of Notes with pitch (0-127), start (≥0), duration (>0), and velocity (0-1), exporting to MIDI and re-importing SHALL produce a set of Notes with identical pitch, start time, and duration values for each Note.

**Validates: Requirements 16.7, 17.1, 17.2, 17.4**

### Property 11: Melody Persistence Round-Trip

*For any* valid Melody (title 1-200 chars, notes ≤10000, valid synth config including effects and preset), saving to the database and retrieving SHALL produce an identical Melody with:
- Same title
- Same notes array (all properties preserved)
- Same tempo
- Same synthesizer configuration (oscillator, volume, ADSR, filter)
- Same effects configuration (reverb, delay, chorus, flanger with all parameters)
- Same preset name (if selected)

**Validates: Requirements 9.4, 10.4, 11.6, 12.5, 18.3, 20.6, 36.7, 37.8, 37.9**

### Property 12: Title Validation

*For any* string S:
- If S is empty or length > 200 characters, save SHALL be rejected with a validation error
- If 1 ≤ length(S) ≤ 200, the title SHALL be accepted

**Validates: Requirements 18.6, 27.2**

### Property 13: Note Count Limit

*For any* Melody with notes array length N:
- If N > 10000, save SHALL be rejected with a validation error
- If N ≤ 10000, the notes array SHALL be accepted

**Validates: Requirements 27.3**

### Property 14: Note Field Validation

*For any* Note object, the following validations SHALL apply:
- pitch: integer, 0 ≤ pitch ≤ 127
- start: number, 0 ≤ start ≤ 10000
- duration: number, 0.001 ≤ duration ≤ 1000
- velocity: number, 0 ≤ velocity ≤ 1

If any field fails validation, the save request SHALL be rejected with an error indicating the invalid field and reason.

**Validates: Requirements 31.1, 31.2, 31.3, 31.4, 31.5**

### Property 15: Owner Authorization

*For any* update or delete request on a Melody with owner_id O:
- If request owner_id ≠ O, the request SHALL be rejected with 403 Forbidden
- If request lacks owner_id, the request SHALL be rejected with 403 Forbidden
- If request owner_id = O, the request SHALL be processed

**Validates: Requirements 20.7, 21.7, 26.3, 26.4, 26.5**

### Property 16: API Error Response Format

*For any* API error response, the response body SHALL be a JSON object containing an "error" field with a human-readable message. Additionally:
- 400 responses SHALL include a "details" field listing invalid fields
- 404 responses SHALL indicate the resource type and identifier not found
- 500 responses SHALL NOT expose internal system details

**Validates: Requirements 28.1, 28.2, 28.3, 28.4**

### Property 17: Feed Sorting

*For any* set of melodies returned by the feed API, the melodies SHALL be ordered by created_at descending (newest first).

**Validates: Requirements 22.1**

### Property 18: Title Truncation in Feed

*For any* melody title displayed in the feed:
- If length > 100 characters, display SHALL show first 100 characters followed by ellipsis ("...")
- If length ≤ 100 characters, display SHALL show the complete title

**Validates: Requirements 22.2**

### Property 19: Export Filename Sanitization

*For any* melody title, the exported MIDI filename SHALL:
- Replace all characters not valid in filenames with underscores
- End with the ".mid" extension

**Validates: Requirements 17.3**

### Property 20: UUID Generation

*For any* newly created Melody, the assigned id SHALL be a valid UUID v4 format string.

**Validates: Requirements 27.4**

### Property 21: Space Bar Toggles Playback

*For any* playback state (playing or stopped) when the Piano Roll Editor has focus and the user is not in a text input field, pressing the Space bar SHALL toggle the playback state:
- If stopped → start playing from current playhead position
- If playing → stop playback

**Validates: Requirements 33.1, 33.2, 33.3, 33.5**

### Property 22: Space Bar Ignored in Text Inputs

*For any* text input field that has focus, pressing the Space bar SHALL NOT trigger playback toggle and SHALL allow normal text input behavior.

**Validates: Requirements 33.5**

### Property 23: Scrollbar-Visible Region Synchronization

*For any* visible region change (via scroll wheel, drag, or scrollbar), the scrollbar position and thumb size SHALL be synchronized:
- Scrollbar position = (visibleRegion.start - minRange) / (maxRange - minRange)
- Thumb size = (visibleRegion.end - visibleRegion.start) / (maxRange - minRange)

Conversely, dragging a scrollbar to position P SHALL update the visible region proportionally.

**Validates: Requirements 34.3, 34.4, 34.5, 34.6**

### Property 24: MIDI Note to Scientific Pitch Notation

*For any* MIDI note number N (0-127), the displayed note name SHALL follow scientific pitch notation:
- Note letter = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][N % 12]
- Octave = floor(N / 12) - 1
- Middle C (MIDI 60) = C4

**Validates: Requirements 35.1, 35.2, 35.3**

### Property 25: Effect Parameter Validation

*For any* effect configuration, the following parameter constraints SHALL be enforced:
- Reverb: roomSize (0-1), wetDry (0-1)
- Delay: time (0-1s), feedback (0-0.9), wetDry (0-1)
- Chorus: rate (0.1-10Hz), depth (0-1), wetDry (0-1)
- Flanger: rate (0.1-10Hz), depth (0-1), feedback (0-0.9), wetDry (0-1)

If any parameter is outside its valid range, the value SHALL be clamped to the nearest valid value.

**Validates: Requirements 36.1, 36.2, 36.3, 36.4**

### Property 26: Effect Independence

*For any* combination of effect enabled states (reverb, delay, chorus, flanger), each effect SHALL operate independently:
- Enabling one effect SHALL NOT affect other effects' enabled states
- Disabling one effect SHALL NOT affect other effects' parameters

**Validates: Requirements 36.5**

### Property 27: Preset Application

*For any* preset selection, the synthesizer configuration SHALL be updated to match the preset's defined values for:
- Oscillator type
- ADSR envelope (attack, decay, sustain, release)
- Filter settings (enabled, type, frequency)
- Effect configurations (all four effects with all parameters)

**Validates: Requirements 37.7**

### Property 28: Keyboard Piano Key Mapping

*For any* keyboard key in the defined QWERTY piano mapping (Z-M for C3 octave, A-L for C4 octave, Q-P for C5 octave, and 2, 3, 5, 6, 7 for sharps), the key SHALL map to exactly one MIDI note number, and the mapping SHALL follow standard piano layout where:
- Bottom row starts at C3 (MIDI 48)
- Middle row starts at C4 (MIDI 60)
- Top row starts at C5 (MIDI 72)
- Number row maps to sharp notes in the C4 octave

**Validates: Requirements 40.1, 40.2**

### Property 29: Keyboard Piano Note Triggering

*For any* mapped keyboard key press when the synthesizer is ready and the focus is not on a text input element:
- Pressing a key SHALL trigger a note-on event with velocity 0.8 for the corresponding MIDI pitch
- Releasing a key SHALL trigger a note-off event for the corresponding MIDI pitch
- Multiple simultaneous key presses SHALL each trigger independent note-on events (polyphonic support)

**Validates: Requirements 40.3, 40.4, 40.7**

### Property 30: Keyboard Piano Text Input Exclusion

*For any* keyboard key press when focus is on a text input, textarea, or contenteditable element, the keyboard piano mapping SHALL NOT trigger any note events, allowing normal text input behavior.

**Validates: Requirements 40.6**

### Property 31: Playhead Visual Rendering

*For any* playhead position within the visible region of the piano roll:
- The playhead SHALL be rendered as a vertical line with color #FF0000 (bright red)
- The playhead width SHALL be at least 2 pixels
- The playhead height SHALL span the full visible grid area
- The playhead SHALL be rendered with a z-index higher than all note elements (always visible on top)

**Validates: Requirements 8.6, 8.7, 8.8, 8.9**

### Property 32: Dynamic Canvas Length Calculation

*For any* set of Notes, the effective canvas length SHALL be calculated as:
- Find the maximum note end time: `max(note.start + note.duration)` for all notes
- Add a buffer of 16 beats to the maximum note end time
- Round up to the nearest multiple of 16 beats
- Apply a minimum floor of 64 beats

If `totalBeats` prop is provided, it SHALL override the automatic calculation.

**Validates: Requirements 45.1, 45.2, 45.3, 45.4, 45.5, 45.6**

### Property 33: Auto-Scroll Trigger Position

*For any* playhead position P during active playback with auto-scroll enabled, when P reaches 80% of the visible horizontal region width, the canvas SHALL scroll such that:
- The playhead is repositioned to 20% from the left edge of the visible region
- The scroll only occurs during active playback (isPlaying=true AND isPaused=false)

**Validates: Requirements 46.2, 46.3, 46.4, 46.5**

### Property 34: Clear All Notes Operation

*For any* notes array with N notes where N > 0, invoking the clearNotes operation SHALL result in:
- The notes array becoming empty (length = 0)
- All previously existing notes being removed
- The operation completing immediately without confirmation (confirmation handled by UI)

**Validates: Requirements 47.5**

### Property 35: MidiControls Import Availability

*For any* MidiControls component instance:
- If `allowImport` is true, the import button SHALL be displayed and functional
- If `allowImport` is false or undefined, the import button SHALL NOT be rendered
- The export button SHALL always be displayed regardless of `allowImport` value

**Validates: Requirements 48.3, 48.4, 48.5**

## Error Handling

### Client-Side Errors

| Error Type | Handling Strategy | User Feedback |
|------------|-------------------|---------------|
| MIDI parse failure | Catch parser exception | "Could not parse MIDI file. Please ensure it's a valid .mid file." |
| MIDI file too large | Check size before parsing | "File exceeds 5MB limit. Please use a smaller file." |
| Audio context unavailable | Detect on initialization | "Audio playback unavailable. Please check browser permissions." |
| Network request timeout | 10s timeout, offer retry | "Request timed out. Please check your connection and try again." |
| Validation error | Display field-specific messages | "Title must be between 1 and 200 characters." |

### Server-Side Errors

| Status Code | Condition | Response Format |
|-------------|-----------|-----------------|
| 400 Bad Request | Validation failure | `{ "error": "Validation failed", "details": [{"field": "...", "reason": "..."}] }` |
| 401 Unauthorized | Missing owner_id | `{ "error": "Authentication required" }` |
| 403 Forbidden | owner_id mismatch | `{ "error": "You do not have permission to perform this action" }` |
| 404 Not Found | Resource doesn't exist | `{ "error": "Melody not found", "id": "..." }` |
| 500 Internal Error | Unexpected server error | `{ "error": "An unexpected error occurred" }` |

### Database Error Recovery

- All write operations use transactions
- On failure, transaction is rolled back
- Client receives error response with generic message
- Server logs detailed error for debugging

### Audio Error Handling

- Detect AudioContext state on initialization
- Handle "suspended" state by requesting user interaction
- Catch synthesis errors and stop affected notes
- Display user-friendly error messages for audio failures

## Testing Strategy

### Unit Testing

Unit tests cover specific behaviors, edge cases, and component isolation.

**Piano Roll Editor Tests**:
- Note rendering at correct positions
- Click detection and note selection
- Drag operation state management
- Grid snap calculation accuracy
- Scroll and zoom behavior
- Scrollbar position and thumb size calculation
- Scrollbar drag updates visible region
- Note name label rendering for all visible pitches
- MIDI to scientific pitch notation conversion
- Keyboard shortcut handling (Space bar, Delete)
- Focus detection for keyboard shortcuts
- Keyboard piano key-to-MIDI mapping correctness
- Keyboard piano polyphonic key tracking
- Keyboard piano text input exclusion
- Playhead rendering color (#FF0000)
- Playhead rendering width (minimum 2px)
- Playhead rendering height (full grid)
- Playhead z-index (above notes)
- Dynamic canvas length calculation from notes
- Canvas length minimum (64 beats)
- Canvas length rounding (nearest 16 beats)
- totalBeats prop override behavior
- Auto-scroll trigger at 80% visible width
- Auto-scroll repositioning to 20% from left
- Auto-scroll only during active playback
- Clear all notes operation

**Synthesizer Engine Tests**:
- Configuration application
- Note scheduling
- Playback state transitions
- ADSR envelope application
- Effect chain configuration
- Effect parameter validation and clamping
- Effect independence (enable/disable)
- Preset loading and application
- Preset parameter mapping

**MIDI Processing Tests**:
- Type 0 file parsing
- Type 1 file parsing (multi-track merge)
- Tempo extraction
- Note conversion accuracy
- Export file format compliance
- Edge cases: empty files, large files, corrupted files
- MidiControls import button conditional rendering
- MidiControls export always available

**API Route Tests**:
- Request validation
- Response format compliance
- Authorization checks
- Database transaction behavior
- Error response formatting

### Property-Based Testing

Property tests use randomized inputs to verify universal properties hold across all valid inputs.

**Configuration**: Each property test runs minimum 100 iterations using fast-check library.

**Tagging Format**: Each test includes comment referencing design property:
```typescript
// Feature: tone-sketch, Property 10: MIDI Import/Export Round-Trip
```

**Property Test Coverage**:

| Property | Test Description | Generator |
|----------|------------------|-----------|
| 3 | Grid snap quantization | Random positions × all divisions |
| 10 | MIDI round-trip | Random valid Note arrays |
| 11 | Melody persistence round-trip | Random valid Melody objects with effects and presets |
| 12 | Title validation | Arbitrary strings including edge lengths |
| 14 | Note field validation | Random numbers for each field |
| 15 | Owner authorization | Random owner_ids with match/mismatch |
| 17 | Feed sorting | Random melody sets with timestamps |
| 18 | Title truncation | Strings of varying lengths |
| 19 | Filename sanitization | Strings with special characters |
| 20 | UUID generation | Batch UUID creation |
| 21 | Space bar toggles playback | Random playback states × focus states |
| 22 | Space bar ignored in text inputs | Random input field types |
| 23 | Scrollbar-visible region sync | Random visible regions × scroll positions |
| 24 | MIDI note to pitch notation | All MIDI notes 0-127 |
| 25 | Effect parameter validation | Random effect configs with edge values |
| 26 | Effect independence | Random effect enabled combinations |
| 27 | Preset application | All preset types × random prior configs |
| 28 | Keyboard piano key mapping | All mapped keys → MIDI note verification |
| 29 | Keyboard piano note triggering | Random key sequences × synth ready states |
| 30 | Keyboard piano text input exclusion | Random keys × input element types |
| 31 | Playhead visual rendering | Random playhead positions × visible regions |
| 32 | Dynamic canvas length calculation | Random note arrays × different note distributions |
| 33 | Auto-scroll trigger position | Random playhead positions × visible regions × playback states |
| 34 | Clear all notes operation | Random note arrays with varying sizes |
| 35 | MidiControls import availability | Boolean allowImport values × component instances |

### Integration Testing

**API Integration Tests**:
- Full CRUD lifecycle for melodies
- Pagination behavior verification
- Concurrent request handling
- Database constraint enforcement

**UI Integration Tests (Playwright)**:
- Create page workflow: create notes → save → redirect
- Edit page workflow: load → edit → save
- Feed interaction: scroll → preview → navigate
- MIDI import/export workflow
- Keyboard shortcut workflow: Space bar play/stop toggle
- Keyboard piano workflow: key press → note plays → row highlights → key release → note stops
- Effects panel interaction: enable/disable, adjust parameters
- Preset selection: apply preset, verify parameter changes
- Scrollbar interaction: drag to navigate, verify region updates
- Playhead rendering: verify red color, 2px width, full height, z-index above notes

### Performance Testing

**Frame Rate Validation**:
- Measure fps during drag operations
- Measure fps during playback with moving playhead
- Target: 55fps minimum, 60fps average

**Latency Validation**:
- Measure audio onset latency
- Measure UI response to user input
- Target: <50ms for audio, <100ms for UI

### Test Organization

```
tests/
├── unit/
│   ├── piano-roll/
│   │   ├── note-rendering.test.ts
│   │   ├── grid-snap.test.ts
│   │   ├── drag-operations.test.ts
│   │   ├── scrollbars.test.ts
│   │   ├── note-names.test.ts
│   │   ├── keyboard-shortcuts.test.ts
│   │   ├── keyboard-piano.test.ts
│   │   ├── playhead-rendering.test.ts
│   │   ├── dynamic-canvas-length.test.ts
│   │   ├── auto-scroll.test.ts
│   │   └── clear-notes.test.ts
│   ├── synthesizer/
│   │   ├── configuration.test.ts
│   │   ├── playback.test.ts
│   │   ├── effects.test.ts
│   │   └── presets.test.ts
│   ├── midi/
│   │   ├── importer.test.ts
│   │   ├── exporter.test.ts
│   │   └── midi-controls.test.ts
│   └── api/
│       ├── melodies.test.ts
│       └── validation.test.ts
├── property/
│   ├── grid-snap.property.test.ts
│   ├── midi-roundtrip.property.test.ts
│   ├── melody-persistence.property.test.ts
│   ├── validation.property.test.ts
│   ├── authorization.property.test.ts
│   ├── keyboard-shortcuts.property.test.ts
│   ├── keyboard-piano.property.test.ts
│   ├── scrollbar-sync.property.test.ts
│   ├── note-names.property.test.ts
│   ├── effects.property.test.ts
│   ├── presets.property.test.ts
│   ├── playhead-rendering.property.test.ts
│   ├── dynamic-canvas-length.property.test.ts
│   ├── auto-scroll.property.test.ts
│   ├── clear-notes.property.test.ts
│   └── midi-controls.property.test.ts
├── integration/
│   ├── api/
│   │   └── melody-lifecycle.test.ts
│   └── e2e/
│       ├── create-workflow.spec.ts
│       ├── edit-workflow.spec.ts
│       ├── feed-interaction.spec.ts
│       ├── keyboard-shortcuts.spec.ts
│       └── keyboard-piano.spec.ts
└── performance/
    ├── frame-rate.test.ts
    └── latency.test.ts
```
