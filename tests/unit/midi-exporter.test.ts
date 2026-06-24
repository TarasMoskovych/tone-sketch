import { describe, it, expect } from 'vitest';
import {
  MidiExporter,
  MidiExportError,
  DEFAULT_EXPORT_TEMPO,
  TICKS_PER_QUARTER_NOTE,
  convertToMidiVelocity,
  beatsToSeconds,
  sanitizeFilename,
  generateMidiFilename,
  createMidiFile,
  type ExportableMelody,
} from '../../utils/midi-exporter';

describe('MidiExporter', () => {
  describe('convertToMidiVelocity', () => {
    it('should convert application velocity 0 to MIDI velocity 0', () => {
      expect(convertToMidiVelocity(0)).toBe(0);
    });

    it('should convert application velocity 1 to MIDI velocity 127', () => {
      expect(convertToMidiVelocity(1)).toBe(127);
    });

    it('should convert application velocity 0.5 to approximately MIDI velocity 64', () => {
      expect(convertToMidiVelocity(0.5)).toBe(64); // Math.round(0.5 * 127) = 64
    });

    it('should convert application velocity 0.8 to MIDI velocity 102', () => {
      expect(convertToMidiVelocity(0.8)).toBe(102); // Math.round(0.8 * 127) = 102
    });

    it('should clamp negative values to 0', () => {
      expect(convertToMidiVelocity(-0.5)).toBe(0);
    });

    it('should clamp values above 1 to 127', () => {
      expect(convertToMidiVelocity(1.5)).toBe(127);
    });
  });

  describe('beatsToSeconds', () => {
    it('should convert 1 beat at 60 BPM to 1 second', () => {
      expect(beatsToSeconds(1, 60)).toBe(1);
    });

    it('should convert 1 beat at 120 BPM to 0.5 seconds', () => {
      expect(beatsToSeconds(1, 120)).toBe(0.5);
    });

    it('should convert 4 beats at 120 BPM to 2 seconds', () => {
      expect(beatsToSeconds(4, 120)).toBe(2);
    });

    it('should convert 0 beats to 0 seconds', () => {
      expect(beatsToSeconds(0, 120)).toBe(0);
    });

    it('should handle decimal beat values', () => {
      expect(beatsToSeconds(0.5, 120)).toBeCloseTo(0.25, 5);
    });
  });

  describe('sanitizeFilename', () => {
    it('should return the title unchanged if valid', () => {
      expect(sanitizeFilename('My Melody')).toBe('My Melody');
    });

    it('should replace < with underscore', () => {
      expect(sanitizeFilename('test<melody')).toBe('test_melody');
    });

    it('should replace > with underscore', () => {
      expect(sanitizeFilename('test>melody')).toBe('test_melody');
    });

    it('should replace : with underscore', () => {
      expect(sanitizeFilename('test:melody')).toBe('test_melody');
    });

    it('should replace " with underscore', () => {
      expect(sanitizeFilename('test"melody')).toBe('test_melody');
    });

    it('should replace / with underscore', () => {
      expect(sanitizeFilename('test/melody')).toBe('test_melody');
    });

    it('should replace \\ with underscore', () => {
      expect(sanitizeFilename('test\\melody')).toBe('test_melody');
    });

    it('should replace | with underscore', () => {
      expect(sanitizeFilename('test|melody')).toBe('test_melody');
    });

    it('should replace ? with underscore', () => {
      expect(sanitizeFilename('test?melody')).toBe('test_melody');
    });

    it('should replace * with underscore', () => {
      expect(sanitizeFilename('test*melody')).toBe('test_melody');
    });

    it('should replace multiple invalid characters', () => {
      expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
    });

    it('should collapse consecutive underscores into one', () => {
      expect(sanitizeFilename('test<<>>melody')).toBe('test_melody');
    });

    it('should trim leading and trailing underscores', () => {
      expect(sanitizeFilename('*melody*')).toBe('melody');
    });

    it('should return "melody" for empty string', () => {
      expect(sanitizeFilename('')).toBe('melody');
    });

    it('should return "melody" for whitespace-only string', () => {
      expect(sanitizeFilename('   ')).toBe('melody');
    });

    it('should return "melody" when all characters are invalid', () => {
      expect(sanitizeFilename('<>:"|?*')).toBe('melody');
    });

    it('should handle null-like characters', () => {
      expect(sanitizeFilename('test\x00melody')).toBe('test_melody');
    });
  });

  describe('generateMidiFilename', () => {
    it('should append .mid extension to sanitized title', () => {
      expect(generateMidiFilename('My Melody')).toBe('My Melody.mid');
    });

    it('should sanitize and append .mid extension', () => {
      expect(generateMidiFilename('My/Melody')).toBe('My_Melody.mid');
    });

    it('should return "melody.mid" for empty title', () => {
      expect(generateMidiFilename('')).toBe('melody.mid');
    });
  });

  describe('createMidiFile', () => {
    it('should create a valid Blob', () => {
      const melody: ExportableMelody = {
        title: 'Test Melody',
        notes: [],
        tempo: 120,
      };

      const blob = createMidiFile(melody);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/midi');
    });

    it('should create a MIDI file with correct size for empty melody', () => {
      const melody: ExportableMelody = {
        title: 'Empty Melody',
        notes: [],
        tempo: 120,
      };

      const blob = createMidiFile(melody);

      // Empty MIDI file should have some minimum size for headers
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should create a larger MIDI file when notes are included', () => {
      const emptyMelody: ExportableMelody = {
        title: 'Empty',
        notes: [],
        tempo: 120,
      };

      const melodyWithNotes: ExportableMelody = {
        title: 'With Notes',
        notes: [
          { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
          { id: '2', pitch: 62, start: 1, duration: 1, velocity: 0.8 },
          { id: '3', pitch: 64, start: 2, duration: 1, velocity: 0.8 },
        ],
        tempo: 120,
      };

      const emptyBlob = createMidiFile(emptyMelody);
      const notesBlob = createMidiFile(melodyWithNotes);

      expect(notesBlob.size).toBeGreaterThan(emptyBlob.size);
    });

    it('should use default tempo when tempo is 0', () => {
      const melody: ExportableMelody = {
        title: 'Zero Tempo',
        notes: [],
        tempo: 0,
      };

      // Should not throw
      const blob = createMidiFile(melody);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should clamp note pitch to valid MIDI range', () => {
      const melody: ExportableMelody = {
        title: 'Edge Pitches',
        notes: [
          { id: '1', pitch: -10, start: 0, duration: 1, velocity: 0.8 },
          { id: '2', pitch: 200, start: 1, duration: 1, velocity: 0.8 },
        ],
        tempo: 120,
      };

      // Should not throw
      const blob = createMidiFile(melody);
      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('MidiExporter class', () => {
    it('should have an export method', () => {
      const exporter = new MidiExporter();
      expect(typeof exporter.export).toBe('function');
    });

    it('should have a download method', () => {
      const exporter = new MidiExporter();
      expect(typeof exporter.download).toBe('function');
    });

    it('should have a getFilename method', () => {
      const exporter = new MidiExporter();
      expect(typeof exporter.getFilename).toBe('function');
    });

    it('export should return a Blob', () => {
      const exporter = new MidiExporter();
      const melody: ExportableMelody = {
        title: 'Test',
        notes: [],
        tempo: 120,
      };

      const result = exporter.export(melody);
      expect(result).toBeInstanceOf(Blob);
    });

    it('getFilename should return sanitized filename with .mid extension', () => {
      const exporter = new MidiExporter();
      expect(exporter.getFilename('Test/Song')).toBe('Test_Song.mid');
    });
  });

  describe('constants', () => {
    it('DEFAULT_EXPORT_TEMPO should be 120 BPM', () => {
      expect(DEFAULT_EXPORT_TEMPO).toBe(120);
    });

    it('TICKS_PER_QUARTER_NOTE should be 480', () => {
      expect(TICKS_PER_QUARTER_NOTE).toBe(480);
    });
  });

  describe('MidiExportError', () => {
    it('should be an instance of Error', () => {
      const error = new MidiExportError('test message');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have correct name', () => {
      const error = new MidiExportError('test message');
      expect(error.name).toBe('MidiExportError');
    });

    it('should preserve error message', () => {
      const error = new MidiExportError('Custom error message');
      expect(error.message).toBe('Custom error message');
    });
  });

  describe('Export Edge Cases', () => {
    describe('Empty Melody Export', () => {
      it('should export melody with zero notes', () => {
        const melody: ExportableMelody = {
          title: 'Empty Melody',
          notes: [],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('audio/midi');
        expect(blob.size).toBeGreaterThan(0); // Should have header/tempo track at minimum
      });

      it('should export melody with empty title and no notes', () => {
        const melody: ExportableMelody = {
          title: '',
          notes: [],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });

      it('should include tempo track even with no notes', () => {
        const melody: ExportableMelody = {
          title: 'Tempo Only',
          notes: [],
          tempo: 140,
        };

        const blob = createMidiFile(melody);

        // File should still have content (tempo track)
        expect(blob.size).toBeGreaterThan(0);
      });
    });

    describe('Pitch Boundary Edge Cases', () => {
      it('should export note at minimum MIDI pitch (0)', () => {
        const melody: ExportableMelody = {
          title: 'Low Pitch',
          notes: [{ id: '1', pitch: 0, start: 0, duration: 1, velocity: 0.8 }],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);
      });

      it('should export note at maximum MIDI pitch (127)', () => {
        const melody: ExportableMelody = {
          title: 'High Pitch',
          notes: [{ id: '1', pitch: 127, start: 0, duration: 1, velocity: 0.8 }],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);
      });

      it('should clamp negative pitch to 0', () => {
        const melody: ExportableMelody = {
          title: 'Negative Pitch',
          notes: [{ id: '1', pitch: -10, start: 0, duration: 1, velocity: 0.8 }],
          tempo: 120,
        };

        // Should not throw
        const blob = createMidiFile(melody);
        expect(blob).toBeInstanceOf(Blob);
      });

      it('should clamp pitch above 127 to 127', () => {
        const melody: ExportableMelody = {
          title: 'High Pitch',
          notes: [{ id: '1', pitch: 200, start: 0, duration: 1, velocity: 0.8 }],
          tempo: 120,
        };

        // Should not throw
        const blob = createMidiFile(melody);
        expect(blob).toBeInstanceOf(Blob);
      });

      it('should export notes spanning full pitch range', () => {
        const melody: ExportableMelody = {
          title: 'Full Range',
          notes: [
            { id: '1', pitch: 0, start: 0, duration: 0.5, velocity: 0.8 },
            { id: '2', pitch: 64, start: 0.5, duration: 0.5, velocity: 0.8 },
            { id: '3', pitch: 127, start: 1, duration: 0.5, velocity: 0.8 },
          ],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);
      });
    });

    describe('Duration Edge Cases', () => {
      it('should export note with minimum allowed duration (0.001 beats)', () => {
        const melody: ExportableMelody = {
          title: 'Min Duration',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 0.001, velocity: 0.8 }],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });

      it('should export note with very small duration (0.01 beats)', () => {
        const melody: ExportableMelody = {
          title: 'Small Duration',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 0.01, velocity: 0.8 }],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });

      it('should export note with very large duration (1000 beats)', () => {
        const melody: ExportableMelody = {
          title: 'Long Duration',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 1000, velocity: 0.8 }],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });

      it('should export notes with mixed durations', () => {
        const melody: ExportableMelody = {
          title: 'Mixed Durations',
          notes: [
            { id: '1', pitch: 60, start: 0, duration: 0.01, velocity: 0.8 },
            { id: '2', pitch: 62, start: 0.5, duration: 1, velocity: 0.8 },
            { id: '3', pitch: 64, start: 2, duration: 100, velocity: 0.8 },
          ],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });
    });

    describe('Filename Sanitization Edge Cases', () => {
      it('should replace all Windows invalid characters', () => {
        expect(sanitizeFilename('<title>')).toBe('title');
        expect(sanitizeFilename(':title:')).toBe('title');
        expect(sanitizeFilename('"title"')).toBe('title');
        expect(sanitizeFilename('title/name')).toBe('title_name');
        expect(sanitizeFilename('title\\name')).toBe('title_name');
        expect(sanitizeFilename('title|name')).toBe('title_name');
        expect(sanitizeFilename('title?name')).toBe('title_name');
        expect(sanitizeFilename('title*name')).toBe('title_name');
      });

      it('should handle Unicode characters in title', () => {
        expect(sanitizeFilename('Mélodie été')).toBe('Mélodie été');
        expect(sanitizeFilename('メロディー')).toBe('メロディー');
        expect(sanitizeFilename('Мелодия')).toBe('Мелодия');
      });

      it('should handle emojis in title', () => {
        const result = sanitizeFilename('Music 🎵 Song');
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle very long titles', () => {
        const longTitle = 'A'.repeat(500);
        const result = sanitizeFilename(longTitle);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle title with only spaces', () => {
        expect(sanitizeFilename('     ')).toBe('melody');
      });

      it('should handle title with leading/trailing special characters', () => {
        expect(sanitizeFilename('***Song***')).toBe('Song');
        expect(sanitizeFilename('<<<Title>>>')).toBe('Title');
      });

      it('should handle title with multiple consecutive special characters', () => {
        expect(sanitizeFilename('A<<<>>>B')).toBe('A_B');
        expect(sanitizeFilename('A***B')).toBe('A_B');
      });

      it('should handle mixed valid and invalid characters', () => {
        expect(sanitizeFilename('My<Song>2024:Final/Mix')).toBe('My_Song_2024_Final_Mix');
      });

      it('should preserve numbers and letters', () => {
        expect(sanitizeFilename('Song123')).toBe('Song123');
        expect(sanitizeFilename('123Song')).toBe('123Song');
        expect(sanitizeFilename('ABC123DEF')).toBe('ABC123DEF');
      });

      it('should preserve hyphens and underscores', () => {
        expect(sanitizeFilename('my-song')).toBe('my-song');
        expect(sanitizeFilename('my_song')).toBe('my_song');
        expect(sanitizeFilename('my-song_v2')).toBe('my-song_v2');
      });
    });

    describe('Tempo Edge Cases', () => {
      it('should export with very slow tempo (30 BPM)', () => {
        const melody: ExportableMelody = {
          title: 'Slow',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 }],
          tempo: 30,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });

      it('should export with very fast tempo (300 BPM)', () => {
        const melody: ExportableMelody = {
          title: 'Fast',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 0.25, velocity: 0.8 }],
          tempo: 300,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });

      it('should use default tempo when tempo is 0', () => {
        const melody: ExportableMelody = {
          title: 'Zero Tempo',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 }],
          tempo: 0,
        };

        // Should not throw
        const blob = createMidiFile(melody);
        expect(blob).toBeInstanceOf(Blob);
      });

      it('should throw error for negative tempo', () => {
        const melody: ExportableMelody = {
          title: 'Negative Tempo',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 }],
          tempo: -120,
        };

        // Negative tempo is invalid and should throw an error
        expect(() => createMidiFile(melody)).toThrow(MidiExportError);
      });
    });

    describe('Velocity Edge Cases', () => {
      it('should export note with velocity 0 (silent)', () => {
        const melody: ExportableMelody = {
          title: 'Silent',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 0 }],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
        expect(convertToMidiVelocity(0)).toBe(0);
      });

      it('should export note with velocity 1 (maximum)', () => {
        const melody: ExportableMelody = {
          title: 'Loud',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 1 }],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
        expect(convertToMidiVelocity(1)).toBe(127);
      });

      it('should clamp negative velocity to 0', () => {
        expect(convertToMidiVelocity(-0.5)).toBe(0);
      });

      it('should clamp velocity above 1 to 127', () => {
        expect(convertToMidiVelocity(1.5)).toBe(127);
      });
    });

    describe('Start Time Edge Cases', () => {
      it('should export note starting at time 0', () => {
        const melody: ExportableMelody = {
          title: 'Start Zero',
          notes: [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 }],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });

      it('should export note starting at very late time', () => {
        const melody: ExportableMelody = {
          title: 'Late Start',
          notes: [{ id: '1', pitch: 60, start: 10000, duration: 1, velocity: 0.8 }],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });

      it('should export notes with fractional start times', () => {
        const melody: ExportableMelody = {
          title: 'Fractional',
          notes: [
            { id: '1', pitch: 60, start: 0.25, duration: 0.25, velocity: 0.8 },
            { id: '2', pitch: 62, start: 0.5, duration: 0.25, velocity: 0.8 },
            { id: '3', pitch: 64, start: 0.75, duration: 0.25, velocity: 0.8 },
          ],
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });
    });

    describe('Large Melody Export', () => {
      it('should export melody with many notes', () => {
        const notes = Array.from({ length: 1000 }, (_, i) => ({
          id: String(i),
          pitch: 60 + (i % 12),
          start: i * 0.25,
          duration: 0.25,
          velocity: 0.8,
        }));

        const melody: ExportableMelody = {
          title: 'Many Notes',
          notes,
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.size).toBeGreaterThan(0);
      });

      it('should export melody at maximum note limit (10000 notes)', () => {
        const notes = Array.from({ length: 10000 }, (_, i) => ({
          id: String(i),
          pitch: 60 + (i % 12),
          start: i * 0.1,
          duration: 0.1,
          velocity: 0.8,
        }));

        const melody: ExportableMelody = {
          title: 'Max Notes',
          notes,
          tempo: 120,
        };

        const blob = createMidiFile(melody);

        expect(blob).toBeInstanceOf(Blob);
      });
    });

    describe('Title Edge Cases', () => {
      it('should generate filename for empty title', () => {
        expect(generateMidiFilename('')).toBe('melody.mid');
      });

      it('should generate filename for whitespace title', () => {
        expect(generateMidiFilename('   ')).toBe('melody.mid');
      });

      it('should generate filename for title with all invalid characters', () => {
        expect(generateMidiFilename('***???')).toBe('melody.mid');
      });

      it('should generate filename for very long title', () => {
        const longTitle = 'A'.repeat(500);
        const filename = generateMidiFilename(longTitle);

        expect(filename.endsWith('.mid')).toBe(true);
      });

      it('should preserve extension even with special characters in title', () => {
        expect(generateMidiFilename('My*Song')).toBe('My_Song.mid');
        expect(generateMidiFilename('Song<2024>')).toBe('Song_2024.mid');
      });
    });

    describe('beatsToSeconds Edge Cases', () => {
      it('should handle zero beats', () => {
        expect(beatsToSeconds(0, 120)).toBe(0);
      });

      it('should handle very small beat values', () => {
        const result = beatsToSeconds(0.001, 120);
        expect(result).toBeCloseTo(0.0005, 5);
      });

      it('should handle very large beat values', () => {
        const result = beatsToSeconds(10000, 120);
        expect(result).toBe(5000); // 10000 beats * (60/120) = 5000 seconds
      });

      it('should handle various tempos accurately', () => {
        // 1 beat at different tempos
        expect(beatsToSeconds(1, 60)).toBe(1);   // 1 second
        expect(beatsToSeconds(1, 120)).toBe(0.5); // 0.5 seconds
        expect(beatsToSeconds(1, 240)).toBe(0.25); // 0.25 seconds
      });
    });
  });
});
