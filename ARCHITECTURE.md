# 🏗️ Architecture Overview

This document explains how Tone Sketch works under the hood — the rendering pipeline, audio synthesis, and how browser technologies make it all possible.

## Table of Contents

- [System Overview](#system-overview)
- [Canvas Rendering](#canvas-rendering)
- [Audio Synthesis](#audio-synthesis)
- [Presets](#presets)
- [Playback System](#playback-system)
- [State Management](#state-management)
- [Velocity Lane](#velocity-lane)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Components                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ PianoRollCanvas │  │VelocityLaneCanvas│  │TransportControls│  │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬────────┘  │
├───────────┼────────────────────┼─────────────────────┼──────────┤
│           │    Custom Hooks    │                      │          │
│  ┌────────▼────────┐  ┌───────▼──────┐  ┌───────────▼───────┐  │
│  │  usePianoRoll   │  │useSynthesizer│  │    usePlayback    │  │
│  └────────┬────────┘  └──────┬───────┘  └───────────┬───────┘  │
├───────────┼──────────────────┼───────────────────────┼──────────┤
│           │      Libraries   │                       │          │
│  ┌────────▼────────┐  ┌──────▼──────────────────────▼───────┐  │
│  │  HTML5 Canvas   │  │              Tone.js                │  │
│  └────────┬────────┘  └──────────────────┬──────────────────┘  │
├───────────┼──────────────────────────────┼─────────────────────┤
│           │      Browser APIs            │                      │
│  ┌────────▼────────┐  ┌──────────────────▼─────────────────┐   │
│  │ Canvas 2D API   │  │         Web Audio API              │   │
│  └─────────────────┘  └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Canvas Rendering

### The Piano Roll Grid

The `PianoRollCanvas` component uses HTML5 Canvas for high-performance rendering. It draws multiple layers in a specific order (back to front):

```javascript
render() {
  renderGrid()        // 1. Background: pitch rows, beat lines
  renderNotes()       // 2. The note rectangles
  renderMarquee()     // 3. Selection rectangle (when dragging)
  renderPlayhead()    // 4. The red vertical line
  renderPitchLabels() // 5. Left sidebar: C3, C4, etc.
  renderTimeMarkers() // 6. Top timeline: beat numbers
  renderScrollbars()  // 7. Navigation scrollbars
}
```

### Coordinate System

The grid maps musical concepts to pixel coordinates:

```
┌──────────────────────────────────────────────────┐
│ Beat:   0    1    2    3    4    5    6    7    │ ← Time (X-axis)
├────┬─────────────────────────────────────────────┤
│ C5 │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ B4 │ ████████████████████████████████████████████ │
│ A4 │ ████████████████████████████████████████████ │ ← Pitch (Y-axis)
│ G4 │ ████████████████████████████████████████████ │   (MIDI 0-127)
│ ...│                                             │
└────┴─────────────────────────────────────────────┘
       ↑ Black key rows have darker background
```

**Key formulas:**

```javascript
// Pixels per musical unit
pixelsPerBeat = gridWidth / (endBeat - startBeat)
pixelsPerSemitone = gridHeight / (endPitch - startPitch)

// Note position calculation
noteX = gridX + (note.start - startBeat) * pixelsPerBeat
noteY = gridY + gridHeight - ((note.pitch - startPitch + 1) * pixelsPerSemitone)
noteWidth = note.duration * pixelsPerBeat
noteHeight = pixelsPerSemitone
```

### Visible Region & Zooming

Only the visible portion is rendered, controlled by `VisibleRegion`:

```typescript
interface VisibleRegion {
  startBeat: number   // e.g., 0
  endBeat: number     // e.g., 16 (shows 16 beats)
  startPitch: number  // e.g., 48 (C3)
  endPitch: number    // e.g., 72 (C5)
}
```

**Zoom behavior:**
- **Zoom in** → Smaller span → More pixels per beat → Larger notes
- **Zoom out** → Larger span → Fewer pixels per beat → Smaller notes
- **Ctrl/Cmd + Scroll** → Zoom centered on mouse position

### The Playhead (Red Line)

The playhead shows current playback position:

```javascript
const playheadX = gridX + (playheadPosition - startBeat) * pixelsPerBeat

ctx.strokeStyle = '#FF0000'  // Bright red
ctx.lineWidth = 2
ctx.beginPath()
ctx.moveTo(playheadX, gridY)
ctx.lineTo(playheadX, gridY + gridHeight)
ctx.stroke()
```

### Row Highlighting

When notes play, their pitch rows light up:

```javascript
// Computed from current playhead position and notes
const playingPitches = new Set<number>()
for (const note of notes) {
  if (playheadPosition >= note.start &&
      playheadPosition < note.start + note.duration) {
    playingPitches.add(note.pitch)  // Integer MIDI pitch
  }
}

// During grid rendering
if (playingPitches.has(pitch)) {
  ctx.fillStyle = 'rgba(99, 102, 241, 0.3)'  // Semi-transparent indigo
  ctx.fillRect(gridX, y, gridWidth, rowHeight)
}
```

---

## Audio Synthesis

### Web Audio API Architecture

Browsers provide native audio capabilities through the Web Audio API. Tone.js builds on top of it:

```
┌─────────────────────────────────────────────────────────────┐
│                      Your App Code                          │
│  (useSynthesizer, usePlayback)                              │
├─────────────────────────────────────────────────────────────┤
│                        Tone.js                              │
│  (PolySynth, Transport, Filter, Effects)                    │
├─────────────────────────────────────────────────────────────┤
│                     Web Audio API                           │
│  (AudioContext, OscillatorNode, GainNode, BiquadFilterNode) │
├─────────────────────────────────────────────────────────────┤
│                Browser's Audio Engine                       │
│  (Native C++ code, hardware-accelerated DSP)                │
└─────────────────────────────────────────────────────────────┘
```

### Waveform Types

The oscillator generates periodic waveforms mathematically:

```
SINE - Pure, smooth tone (flute-like)
    ╭──╮    ╭──╮
   ╱    ╲  ╱    ╲     y = sin(2π × frequency × time)
──╱      ╲╱      ╲──

SQUARE - Harsh, retro/8-bit sound
  ┌──┐  ┌──┐  ┌──┐
  │  │  │  │  │  │    y = sign(sin(2π × f × t))
──┘  └──┘  └──┘  └──

SAWTOOTH - Buzzy, bright (synth leads)
   /│  /│  /│  /│
  / │ / │ / │ / │     y = 2 × (t×f - floor(t×f + 0.5))
 /  │/  │/  │/  │

TRIANGLE - Softer than square (woodwind-like)
   /\    /\    /\
  /  \  /  \  /       y = |sawtooth| - 1
 /    \/    \/
```

### Audio Signal Chain

Sound flows through a processing pipeline:

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Oscillator  │ → │   Envelope   │ → │    Filter    │ → │   Effects    │
│  (waveform)  │   │   (ADSR)     │   │  (lowpass)   │   │ (reverb etc) │
└──────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
                                                                 │
                                                                 ▼
                                                          ┌──────────────┐
                                                          │   Speakers   │
                                                          └──────────────┘
```

### ADSR Envelope

Controls how sound evolves over time:

```
Volume
  │    /\
  │   /  \___________
  │  /               \
  │ /                 \
  └─┴──┴─────────────┴──→ Time
    A  D      S       R

A = Attack  - How fast sound reaches peak (0.001s - 2s)
D = Decay   - Drop from peak to sustain level (0.001s - 2s)
S = Sustain - Held level while key pressed (0 - 1)
R = Release - Fade out after key released (0.001s - 5s)
```

### Filter

Shapes the frequency content:

```javascript
filter: {
  type: 'lowpass',    // Removes frequencies above cutoff
  frequency: 2000,    // Cutoff frequency in Hz
  Q: 1                // Resonance (boost near cutoff)
}
```

**Filter types:**
- `lowpass` - Removes high frequencies (muffled sound)
- `highpass` - Removes low frequencies (thin sound)
- `bandpass` - Keeps only middle frequencies

### MIDI Note to Frequency

Each MIDI note maps to a specific frequency:

```javascript
// MIDI note 69 = A4 = 440 Hz
frequency = 440 * Math.pow(2, (midiNote - 69) / 12)

// Examples:
// C4 (MIDI 60) = 261.63 Hz
// A4 (MIDI 69) = 440.00 Hz
// C5 (MIDI 72) = 523.25 Hz
```

### Presets

A preset is a complete snapshot of synthesizer settings. There are 35 presets across 7 categories:

| Category | Characteristics | Examples |
|----------|----------------|----------|
| Piano | Longer attack, smooth sustain, moderate release | Acoustic, Electric, Soft, Bright, Warm |
| Lead | Quick attack, high sustain, brighter filter | Classic, Saw, Square, Sine, Detuned |
| Pluck | Quick attack, short decay, low sustain | Short, Soft, Bright, Bell, Muted |
| Guitar | Moderate attack, medium sustain | Clean, Muted, Acoustic, Nylon, Steel |
| Bass | Quick attack, full sustain, lower filter | Sub, Synth, Punchy, Warm, Growl |
| Strings | Slow attack, high sustain, warm tone | Violin, Cello, Ensemble, Solo, Pizzicato |
| Pads | Very slow attack, full sustain, long release | Warm, Ambient, Choir, Sweep, Dark |

**Preset structure:**

```typescript
interface SynthPreset {
  name: PresetName;           // e.g., 'Electric Piano'
  category: PresetCategory;   // e.g., 'Piano'
  config: {
    oscillatorType: OscillatorType;  // sine, square, sawtooth, triangle
    volume: number;                  // 0-1
    envelope: ADSREnvelope;          // attack, decay, sustain, release
    filter: FilterConfig;            // type, frequency, enabled
    effects: EffectsConfig;          // reverb, delay, chorus, flanger
  };
}
```

**Example preset — Electric Piano:**

```typescript
{
  name: 'Electric Piano',
  category: 'Piano',
  config: {
    oscillatorType: 'sine',
    volume: 0.75,
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.35, release: 0.6 },
    filter: { enabled: true, type: 'lowpass', frequency: 4000 },
    effects: {
      reverb: { enabled: true, roomSize: 0.4, wetDry: 0.2 },
      delay: { enabled: false, time: 0.25, feedback: 0.3, wetDry: 0.3 },
      chorus: { enabled: true, rate: 1.2, depth: 0.4, wetDry: 0.25 },
      flanger: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.5, wetDry: 0.3 },
    },
  },
}
```

When a preset is applied:
1. All config values are copied to the synthesizer
2. Tone.js nodes update in real-time (oscillator, envelope, filter, effects)
3. Audio chain reconnects if filter enabled state changes
4. Changes apply within 50ms without stopping playback

---

## Playback System

### Transport & Scheduling

Tone.js Transport acts as a master clock:

```javascript
// Start playback
Tone.getTransport().start()

// Schedule a note
Tone.getTransport().scheduleOnce((time) => {
  synth.triggerAttackRelease(
    'C4',        // Pitch
    '4n',        // Duration (quarter note)
    time,        // Exact audio time
    0.8          // Velocity (0-1)
  )
}, '+0.1')       // 0.1 seconds from now
```

### Playhead Animation

The playhead updates at 60fps using `requestAnimationFrame`:

```javascript
useEffect(() => {
  let animationId: number

  const updatePlayhead = () => {
    if (isPlaying) {
      setPlayheadPosition(Tone.getTransport().seconds * (tempo / 60))
      animationId = requestAnimationFrame(updatePlayhead)
    }
  }

  if (isPlaying) {
    animationId = requestAnimationFrame(updatePlayhead)
  }

  return () => cancelAnimationFrame(animationId)
}, [isPlaying, tempo])
```

### Note Triggering Flow

```
1. User clicks Play
         │
         ▼
2. Transport.start()
         │
         ▼
3. For each note in melody:
   Schedule triggerAttackRelease at note.start
         │
         ▼
4. At scheduled time:
   - Oscillator generates waveform
   - Envelope shapes amplitude
   - Filter adjusts tone
   - Effects add reverb/delay
         │
         ▼
5. Audio reaches speakers
```

---

## State Management

### Custom Hooks Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       usePianoRoll                          │
│  - notes[]           - Note CRUD operations                 │
│  - selectedNoteIds   - Selection management                 │
│  - visibleRegion     - Zoom/pan state                       │
│  - gridSnap          - Snap configuration                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      useSynthesizer                         │
│  - synth instance    - Tone.PolySynth                       │
│  - waveform          - sine/square/sawtooth/triangle        │
│  - envelope          - ADSR parameters                      │
│  - filter            - Lowpass configuration                │
│  - effects           - Reverb, delay, chorus                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       usePlayback                           │
│  - isPlaying         - Play/pause state                     │
│  - playheadPosition  - Current position in beats            │
│  - tempo             - BPM setting                          │
│  - loop              - Loop mode toggle                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Interaction
       │
       ▼
┌─────────────────┐
│ Event Handler   │ (onClick, onDrag, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ State Update    │ (via hooks: setNotes, setPlayheadPosition)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ React Re-render │ (component updates)
└────────┬────────┘
         │
         ├─────────────────────────────┐
         ▼                             ▼
┌─────────────────┐           ┌─────────────────┐
│ Canvas Redraw   │           │ Audio Schedule  │
│ (requestAnimationFrame)     │ (Tone.Transport)│
└─────────────────┘           └─────────────────┘
```

---

## Velocity Lane

### Overview

The `VelocityLaneCanvas` is an HTML5 Canvas-based component that renders vertical velocity bars for each note, synchronized horizontally with the PianoRoll. It follows the same rendering patterns (devicePixelRatio scaling, extracted renderers, requestAnimationFrame scheduling) and lives in a dedicated `components/VelocityLane/` directory.

### Relationship to PianoRollCanvas and MelodyEditor

```
┌────────────────────────────────────────────────────────────────┐
│                       MelodyEditor (Parent)                     │
│  Owns: notes, selectedNoteIds, visibleRegion, playheadPosition │
│  Owns: velocityLaneVisible state                               │
├────────────────────────────────────────────────────────────────┤
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                │
│         ▼                  ▼                  ▼                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │PianoRollCanvas│  │VelocityLane  │  │  Toggle Button   │     │
│  │  (flex-[3])   │  │Canvas(flex-1)│  │                  │     │
│  └──────────────┘  └──────────────┘  └──────────────────┘     │
└────────────────────────────────────────────────────────────────┘
```

- **MelodyEditor** is the parent component that holds all shared state.
- Both **PianoRollCanvas** and **VelocityLaneCanvas** receive `notes`, `selectedNoteIds`, `visibleRegion`, and `playheadPosition` as props from MelodyEditor.
- Both components call the same callbacks (`onNoteUpdate`, `onBulkNoteUpdate`, `onVisibleRegionChange`, `onNoteSelect`, `onToggleNoteSelection`, `onDeselectAll`).
- There is no direct coupling between PianoRollCanvas and VelocityLaneCanvas.

### Data Flow

```
              MelodyEditor (shared state owner)
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
 PianoRollCanvas         VelocityLaneCanvas
        │                       │
        └───────────┬───────────┘
                    │
            onVisibleRegionChange
            (either can trigger)
```

1. **Shared state via props** — MelodyEditor manages `notes`, `selectedNoteIds`, `visibleRegion`, `playheadPosition`, and `velocityLaneVisible`. Both canvases receive these as props.
2. **Horizontal synchronization** — Both components receive the same `visibleRegion`. Either can trigger `onVisibleRegionChange` (e.g., via wheel scroll), which updates the parent state and re-renders both in sync.
3. **Selection synchronization** — A shared `selectedNoteIds` set flows from MelodyEditor to both components. Selection changes in either component call the same parent callbacks.
4. **Velocity edits** — The VelocityLane calls `onNoteUpdate` (single note) or `onBulkNoteUpdate` (multi-note), reusing the same callbacks the PianoRoll already uses.

### Module Structure

```
components/VelocityLane/
├── VelocityLaneCanvas.tsx    — Main canvas component
├── renderers.ts              — Canvas rendering functions
├── coordinate-utils.ts       — Position/dimension calculations
├── constants.ts              — Configuration values (colors, sizes)
├── types.ts                  — TypeScript interfaces
├── hooks/
│   └── useVelocityDrag.ts    — Drag interaction hook
└── index.ts                  — Barrel export
```

### Layout

When the velocity lane is visible, MelodyEditor uses CSS flex layout:
- **PianoRollCanvas**: `flex-[3]` (~75% of available height)
- **VelocityLaneCanvas**: `flex-1` (~25% of available height)

When hidden, PianoRollCanvas takes the full available height.

---

## Homepage Feed & Audio Visualizer

### Feed Preview Audio Chain

The homepage feed uses a separate `useFeedPreview` hook for preview playback. It adds a `Tone.Analyser` node at the end of the audio chain to provide real-time frequency data for the visualizer:

```
┌──────────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────────┐
│  PolySynth   │ → │  Filter  │ → │ Effects  │ → │Volume/Limiter│ → │ Tone.Analyser│
└──────────────┘   └──────────┘   └──────────┘   └──────────────┘   └──────┬───────┘
                                                                             │
                                                                             ▼
                                                                      ┌──────────────┐
                                                                      │  Destination │
                                                                      └──────────────┘
```

The analyser uses FFT size 64 (producing 32 frequency bins) with smoothing 0.8 for stable visual output. It's connected after the limiter so the visualized data reflects the final audible output.

### AudioVisualizer Component

`AudioVisualizer` is a canvas-based component that reads frequency data and draws bars on each animation frame:

```
requestAnimationFrame loop:
  1. Read Float32Array (dB values) from Tone.Analyser
  2. Normalize dB (-100 to 0) → amplitude (0 to 255)
  3. Calculate bar height: (amplitude / 255) × canvasHeight
  4. Clear canvas → draw 32 bars evenly spaced
  5. Schedule next frame
```

**Performance optimizations:**
- **IntersectionObserver** — Cancels the rAF loop when fully off-screen (0% intersection), resumes immediately when visible
- **Frame budget** — Skips visual updates when frame time exceeds 16ms to prevent jank
- **Canvas rendering** — Avoids DOM mutations entirely; uses GPU-accelerated 2D canvas

**Accessibility:**
- `aria-hidden="true"` and `tabindex="-1"` keep it out of the accessibility tree and tab order
- No ARIA roles or live regions that could interfere with screen reader navigation

### Duration Computation

Melody duration is computed server-side in the API to keep the feed payload lightweight:

```typescript
// Formula: (maxEndBeat / tempo) * 60, rounded to 2 decimal places
durationSeconds = Math.round((Math.max(...notes.map(n => n.start + n.duration)) / tempo * 60) * 100) / 100
```

The `formatDuration` utility formats this for display: `"0:SS"`, `"M:SS"`, or `"H:MM:SS"`.

---

## Why This Works in Browsers

1. **Web Audio API is native** — Written in C++, runs at near-native speed
2. **Hardware acceleration** — Uses your sound card's DSP capabilities
3. **Sample-accurate timing** — Audio runs on a separate high-priority thread
4. **Canvas 2D is GPU-accelerated** — Efficient for 2D graphics
5. **requestAnimationFrame** — Syncs rendering with display refresh rate (60fps)

---

## File Reference

| File | Purpose |
|------|---------|
| `components/PianoRoll/PianoRollCanvas.tsx` | Main piano roll canvas rendering component |
| `components/VelocityLane/VelocityLaneCanvas.tsx` | Velocity lane canvas component |
| `components/VelocityLane/renderers.ts` | Velocity lane rendering functions |
| `components/VelocityLane/coordinate-utils.ts` | Velocity lane coordinate calculations |
| `components/VelocityLane/hooks/useVelocityDrag.ts` | Velocity drag interaction hook |
| `components/MelodyEditor/MelodyEditor.tsx` | Parent component managing shared state |
| `hooks/usePianoRoll.ts` | Note and selection state management |
| `hooks/usePlayback.ts` | Transport and playhead control |
| `hooks/useSynthesizer.ts` | Synthesizer configuration |
| `lib/synthesizer.ts` | Core Tone.js setup and audio chain |
| `lib/presets.ts` | All 35 synthesizer presets |
| `lib/note-utils.ts` | MIDI/frequency conversions |
| `types/synth.ts` | Synthesizer type definitions |
| `types/note.ts` | Note data structure |
| `types/grid.ts` | Grid and visible region types |
| `components/AudioVisualizer.tsx` | Canvas-based frequency bar visualizer |
| `components/MelodyFeed.tsx` | Homepage feed with infinite scroll and visualizer |
| `hooks/useFeedPreview.ts` | Feed preview playback with Tone.Analyser |
| `lib/duration.ts` | Melody duration computation |
| `utils/duration.ts` | Duration formatting utility |
