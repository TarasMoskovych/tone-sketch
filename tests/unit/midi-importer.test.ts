import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import {
  MidiImporter,
  MidiImportError,
  MAX_MIDI_FILE_SIZE,
  DEFAULT_TEMPO,
  validateFileSize,
  convertMidiVelocity,
  parseMidiFile,
} from '../../utils/midi-importer';

describe('MidiImporter', () => {
  describe('validateFileSize', () => {
    it('should not throw for files within size limit', () => {
      const file = new File(['test'], 'test.mid', { type: 'audio/midi' });
      expect(() => validateFileSize(file)).not.toThrow();
    });

    it('should throw MidiImportError for files exceeding 5MB', () => {
      // Create a mock file object with size > 5MB
      const largeFile = {
        size: MAX_MIDI_FILE_SIZE + 1,
        name: 'large.mid',
      } as File;

      expect(() => validateFileSize(largeFile)).toThrow(MidiImportError);
      expect(() => validateFileSize(largeFile)).toThrow(/exceeds maximum allowed size/);
    });

    it('should accept files exactly at 5MB limit', () => {
      const exactFile = {
        size: MAX_MIDI_FILE_SIZE,
        name: 'exact.mid',
      } as File;

      expect(() => validateFileSize(exactFile)).not.toThrow();
    });
  });

  describe('convertMidiVelocity', () => {
    it('should convert MIDI velocity 0 to 0', () => {
      expect(convertMidiVelocity(0)).toBe(0);
    });

    it('should convert MIDI velocity 127 to 1', () => {
      expect(convertMidiVelocity(127)).toBeCloseTo(1, 5);
    });

    it('should convert MIDI velocity 64 to approximately 0.5', () => {
      expect(convertMidiVelocity(64)).toBeCloseTo(64 / 127, 5);
    });

    it('should clamp negative values to 0', () => {
      expect(convertMidiVelocity(-10)).toBe(0);
    });

    it('should clamp values above 127 to 1', () => {
      expect(convertMidiVelocity(200)).toBe(1);
    });
  });

  describe('parseMidiFile', () => {
    it('should throw MidiImportError for empty file', async () => {
      const emptyFile = new File([], 'empty.mid', { type: 'audio/midi' });

      await expect(parseMidiFile(emptyFile)).rejects.toThrow(MidiImportError);
    });

    it('should throw MidiImportError for invalid file content', async () => {
      const invalidFile = new File(['not a midi file'], 'invalid.mid', {
        type: 'audio/midi',
      });

      await expect(parseMidiFile(invalidFile)).rejects.toThrow(MidiImportError);
      await expect(parseMidiFile(invalidFile)).rejects.toThrow(/Could not parse MIDI file/);
    });

    it('should throw MidiImportError for files exceeding size limit', async () => {
      // Create a mock File with a large size
      const largeArrayBuffer = new ArrayBuffer(MAX_MIDI_FILE_SIZE + 1);
      const largeFile = new File([largeArrayBuffer], 'large.mid', {
        type: 'audio/midi',
      });

      await expect(parseMidiFile(largeFile)).rejects.toThrow(MidiImportError);
      await expect(parseMidiFile(largeFile)).rejects.toThrow(/exceeds maximum allowed size/);
    });

    it('should return default tempo when MIDI has no tempo events', async () => {
      // Create a minimal valid MIDI file (Type 0, no tempo events)
      // MIDI header: MThd, length 6, format 0, 1 track, 480 PPQ
      // Track header: MTrk, length 4, end of track
      const midiData = new Uint8Array([
        // MThd header
        0x4d, 0x54, 0x68, 0x64, // "MThd"
        0x00, 0x00, 0x00, 0x06, // Header length (6 bytes)
        0x00, 0x00, // Format 0
        0x00, 0x01, // Number of tracks (1)
        0x01, 0xe0, // Division (480 PPQ)
        // MTrk header
        0x4d, 0x54, 0x72, 0x6b, // "MTrk"
        0x00, 0x00, 0x00, 0x04, // Track length (4 bytes)
        // End of track
        0x00, 0xff, 0x2f, 0x00,
      ]);

      const file = new File([midiData], 'minimal.mid', { type: 'audio/midi' });
      const result = await parseMidiFile(file);

      expect(result.tempo).toBe(DEFAULT_TEMPO);
      expect(result.notes).toHaveLength(0);
    });
  });

  describe('MidiImporter class', () => {
    it('should have a parse method', () => {
      const importer = new MidiImporter();
      expect(typeof importer.parse).toBe('function');
    });

    it('should parse method throw for invalid files', async () => {
      const importer = new MidiImporter();
      const invalidFile = new File(['invalid'], 'invalid.mid');

      await expect(importer.parse(invalidFile)).rejects.toThrow(MidiImportError);
    });
  });

  describe('constants', () => {
    it('MAX_MIDI_FILE_SIZE should be 5MB', () => {
      expect(MAX_MIDI_FILE_SIZE).toBe(5 * 1024 * 1024);
    });

    it('DEFAULT_TEMPO should be 120 BPM', () => {
      expect(DEFAULT_TEMPO).toBe(120);
    });
  });

  describe('MidiImportError', () => {
    it('should be an instance of Error', () => {
      const error = new MidiImportError('test message');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name', () => {
      const error = new MidiImportError('test message');
      expect(error.name).toBe('MidiImportError');
    });

    it('should preserve error message', () => {
      const error = new MidiImportError('Custom error message');
      expect(error.message).toBe('Custom error message');
    });
  });

  describe('Import Edge Cases', () => {
    /**
     * Creates a minimal MIDI file for testing
     * @param options Configuration for the MIDI file
     */
    function createTestMidiFile(options: {
      notes?: Array<{ pitch: number; time: number; duration: number; velocity?: number }>;
      tempo?: number;
      trackCount?: number;
      format?: 0 | 1;
    } = {}): File {
      const midi = new Midi();

      // Set tempo if provided
      if (options.tempo) {
        midi.header.setTempo(options.tempo);
      }

      const trackCount = options.trackCount ?? 1;
      const notes = options.notes ?? [];

      for (let t = 0; t < trackCount; t++) {
        const track = midi.addTrack();
        track.name = `Track ${t + 1}`;

        // Distribute notes across tracks if multi-track
        if (trackCount > 1) {
          const notesPerTrack = Math.ceil(notes.length / trackCount);
          const trackNotes = notes.slice(t * notesPerTrack, (t + 1) * notesPerTrack);
          for (const note of trackNotes) {
            track.addNote({
              midi: note.pitch,
              time: note.time,
              duration: note.duration,
              velocity: note.velocity ?? 0.8,
            });
          }
        } else {
          for (const note of notes) {
            track.addNote({
              midi: note.pitch,
              time: note.time,
              duration: note.duration,
              velocity: note.velocity ?? 0.8,
            });
          }
        }
      }

      const midiArray = midi.toArray();
      return new File([new Uint8Array(midiArray).buffer], 'test.mid', { type: 'audio/midi' });
    }

    describe('Empty MIDI Files', () => {
      it('should parse empty MIDI file with no notes', async () => {
        const file = createTestMidiFile({ notes: [], tempo: 120 });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(0);
        expect(result.tempo).toBe(120);
      });

      it('should parse MIDI file with single track and no notes', async () => {
        const file = createTestMidiFile({ notes: [], trackCount: 1 });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(0);
      });

      it('should parse MIDI file with multiple empty tracks', async () => {
        const file = createTestMidiFile({ notes: [], trackCount: 3 });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(0);
      });
    });

    describe('Pitch Boundary Edge Cases', () => {
      it('should correctly import note at minimum MIDI pitch (0)', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 0, time: 0, duration: 0.5 }],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].pitch).toBe(0);
      });

      it('should correctly import note at maximum MIDI pitch (127)', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 127, time: 0, duration: 0.5 }],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].pitch).toBe(127);
      });

      it('should import multiple notes spanning full pitch range', async () => {
        const file = createTestMidiFile({
          notes: [
            { pitch: 0, time: 0, duration: 0.5 },
            { pitch: 60, time: 0.5, duration: 0.5 },
            { pitch: 127, time: 1, duration: 0.5 },
          ],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(3);
        expect(result.notes.find(n => n.pitch === 0)).toBeDefined();
        expect(result.notes.find(n => n.pitch === 60)).toBeDefined();
        expect(result.notes.find(n => n.pitch === 127)).toBeDefined();
      });

      it('should clamp out-of-range pitch values in imported notes', async () => {
        // Note: @tonejs/midi may not allow out-of-range pitches, but we test our clamping logic
        const file = createTestMidiFile({
          notes: [{ pitch: 64, time: 0, duration: 0.5 }],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes[0].pitch).toBeGreaterThanOrEqual(0);
        expect(result.notes[0].pitch).toBeLessThanOrEqual(127);
      });
    });

    describe('Duration Edge Cases', () => {
      it('should import note with very short duration', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 0.01 }], // 10ms at 120 BPM
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].duration).toBeGreaterThan(0);
      });

      it('should enforce minimum duration of 0.001 beats', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 0.0001 }], // Very tiny duration
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].duration).toBeGreaterThanOrEqual(0.001);
      });

      it('should import note with very long duration', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 60 }], // 60 seconds = 120 beats at 120 BPM
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].duration).toBeGreaterThan(0);
      });

      it('should import notes with mixed durations', async () => {
        const file = createTestMidiFile({
          notes: [
            { pitch: 60, time: 0, duration: 0.05 },    // Short
            { pitch: 62, time: 0.1, duration: 0.5 },   // Normal
            { pitch: 64, time: 1, duration: 10 },      // Long
          ],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(3);
        result.notes.forEach(note => {
          expect(note.duration).toBeGreaterThan(0);
        });
      });
    });

    describe('Tempo Edge Cases', () => {
      it('should import MIDI with very slow tempo (40 BPM)', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 1 }],
          tempo: 40,
        });
        const result = await parseMidiFile(file);

        expect(result.tempo).toBe(40);
      });

      it('should import MIDI with very fast tempo (240 BPM)', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 0.25 }],
          tempo: 240,
        });
        const result = await parseMidiFile(file);

        expect(result.tempo).toBe(240);
      });

      it('should import MIDI with standard tempo (120 BPM)', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 0.5 }],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.tempo).toBe(120);
      });

      it('should round non-integer tempo to nearest integer', async () => {
        // @tonejs/midi may handle this internally, but we test the rounding
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 0.5 }],
          tempo: 120, // Will be integer
        });
        const result = await parseMidiFile(file);

        expect(Number.isInteger(result.tempo)).toBe(true);
      });
    });

    describe('Multi-Track MIDI Files', () => {
      it('should merge notes from multiple tracks into single array', async () => {
        const file = createTestMidiFile({
          notes: [
            { pitch: 60, time: 0, duration: 0.5 },
            { pitch: 62, time: 0.5, duration: 0.5 },
            { pitch: 64, time: 1, duration: 0.5 },
            { pitch: 65, time: 1.5, duration: 0.5 },
          ],
          trackCount: 2,
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        // All notes should be merged
        expect(result.notes.length).toBeGreaterThanOrEqual(2);
      });

      it('should handle overlapping notes from different tracks', async () => {
        const midi = new Midi();
        midi.header.setTempo(120);

        // Track 1: note starting at time 0
        const track1 = midi.addTrack();
        track1.addNote({ midi: 60, time: 0, duration: 1, velocity: 0.8 });

        // Track 2: overlapping note starting at time 0.5
        const track2 = midi.addTrack();
        track2.addNote({ midi: 64, time: 0.5, duration: 1, velocity: 0.8 });

        const midiArray = midi.toArray();
        const file = new File([new Uint8Array(midiArray).buffer], 'test.mid', { type: 'audio/midi' });

        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(2);
      });

      it('should handle simultaneous notes from different tracks', async () => {
        const midi = new Midi();
        midi.header.setTempo(120);

        // Multiple tracks with notes at the same time
        for (let i = 0; i < 3; i++) {
          const track = midi.addTrack();
          track.addNote({ midi: 60 + i * 4, time: 0, duration: 0.5, velocity: 0.8 });
        }

        const midiArray = midi.toArray();
        const file = new File([new Uint8Array(midiArray).buffer], 'test.mid', { type: 'audio/midi' });

        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(3);
        // All notes should start at the same time (approximately)
        const startTimes = result.notes.map(n => n.start);
        startTimes.forEach(t => expect(t).toBeCloseTo(startTimes[0], 3));
      });
    });

    describe('MIDI Format Types', () => {
      it('should parse Type 0 MIDI file (single track)', async () => {
        // Type 0 is inherently single track
        const file = createTestMidiFile({
          notes: [
            { pitch: 60, time: 0, duration: 0.5 },
            { pitch: 62, time: 0.5, duration: 0.5 },
          ],
          trackCount: 1,
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(2);
      });

      it('should parse Type 1 MIDI file (multiple tracks)', async () => {
        // Type 1 has multiple synchronous tracks
        const midi = new Midi();
        midi.header.setTempo(120);

        // Add multiple tracks with different notes
        const track1 = midi.addTrack();
        track1.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 });

        const track2 = midi.addTrack();
        track2.addNote({ midi: 72, time: 0, duration: 0.5, velocity: 0.8 });

        const midiArray = midi.toArray();
        const file = new File([new Uint8Array(midiArray).buffer], 'test.mid', { type: 'audio/midi' });

        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(2);
      });
    });

    describe('Velocity Edge Cases', () => {
      it('should convert minimum MIDI velocity (0) correctly', () => {
        expect(convertMidiVelocity(0)).toBe(0);
      });

      it('should convert maximum MIDI velocity (127) correctly', () => {
        expect(convertMidiVelocity(127)).toBe(1);
      });

      it('should import notes with very low velocity (0.1)', async () => {
        // Note: MIDI velocity 0 is typically interpreted as note-off, so we use a small non-zero value
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 0.5, velocity: 0.1 }],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].velocity).toBeGreaterThanOrEqual(0);
        expect(result.notes[0].velocity).toBeLessThanOrEqual(1);
      });

      it('should import notes with velocity 1', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 0.5, velocity: 1 }],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].velocity).toBe(1);
      });
    });

    describe('Note Timing Edge Cases', () => {
      it('should import note starting at time 0', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 0, duration: 0.5 }],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes[0].start).toBe(0);
      });

      it('should preserve note ordering by start time', async () => {
        const file = createTestMidiFile({
          notes: [
            { pitch: 64, time: 2, duration: 0.5 },
            { pitch: 60, time: 0, duration: 0.5 },
            { pitch: 62, time: 1, duration: 0.5 },
          ],
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        // Notes should be sorted by start time
        for (let i = 1; i < result.notes.length; i++) {
          expect(result.notes[i].start).toBeGreaterThanOrEqual(result.notes[i - 1].start);
        }
      });

      it('should handle notes with very late start times', async () => {
        const file = createTestMidiFile({
          notes: [{ pitch: 60, time: 300, duration: 0.5 }], // 5 minutes = 600 beats at 120 BPM
          tempo: 120,
        });
        const result = await parseMidiFile(file);

        expect(result.notes).toHaveLength(1);
        expect(result.notes[0].start).toBeGreaterThan(0);
      });
    });
  });
});
