# 🏗️ Architecture Overview

This document explains how Tone Sketch works under the hood — the rendering pipeline, audio synthesis, and how browser technologies make it all possible.

## Table of Contents

- [System Overview](#system-overview)
- [Canvas Rendering](#canvas-rendering)
- [Audio Synthesis](#audio-synthesis)
- [Playback System](#playback-system)
- [State Management](#state-management)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Components                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ PianoRollCanvas │  │ SynthControls│  │ TransportControls  │  │
│  └────────┬────────┘  └──────┬───────┘  └─────────┬──────────┘  │
├───────────┼──────────────────┼────────────────────┼─────────────┤
│           │    Custom Hooks  │                    │             │
│  ┌────────▼────────┐  ┌──────▼───────┐  ┌────────▼─────────┐   │
│  │  usePianoRoll   │  │useSynthesizer│  │   usePlayback    │   │
│  └────────┬────────┘  └──────┬───────┘  └────────┬─────────┘   │
├───────────┼──────────────────┼────────────────────┼─────────────┤
│           │      Libraries   │                    │             │
│  ┌────────▼────────┐  ┌──────▼───────────────────▼─────────┐   │
│  │  HTML5 Canvas   │  │              Tone.js               │   │
│  └────────┬────────┘  └──────────────────┬─────────────────┘   │
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
| `components/PianoRollCanvas.tsx` | Main canvas rendering component |
| `hooks/usePianoRoll.ts` | Note and selection state management |
| `hooks/usePlayback.ts` | Transport and playhead control |
| `hooks/useSynthesizer.ts` | Synthesizer configuration |
| `lib/synthesizer.ts` | Core Tone.js setup and presets |
| `lib/note-utils.ts` | MIDI/frequency conversions |
| `types/note.ts` | Note data structure |
| `types/grid.ts` | Grid and visible region types |
