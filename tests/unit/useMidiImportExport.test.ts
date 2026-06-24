/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMidiImportExport } from '../../hooks/useMidiImportExport';
import * as midiImporter from '../../utils/midi-importer';
import * as midiExporter from '../../utils/midi-exporter';

// Mock the MIDI utilities
vi.mock('../../utils/midi-importer', async () => {
  const actual = await vi.importActual('../../utils/midi-importer');
  return {
    ...actual,
    parseMidiFile: vi.fn(),
  };
});

vi.mock('../../utils/midi-exporter', async () => {
  const actual = await vi.importActual('../../utils/midi-exporter');
  return {
    ...actual,
    createMidiFile: vi.fn(),
    exportMelodyToMidi: vi.fn(),
  };
});

describe('useMidiImportExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initial state', () => {
    it('should return isImporting as false initially', () => {
      const { result } = renderHook(() => useMidiImportExport());
      expect(result.current.isImporting).toBe(false);
    });

    it('should return isExporting as false initially', () => {
      const { result } = renderHook(() => useMidiImportExport());
      expect(result.current.isExporting).toBe(false);
    });

    it('should return error as null initially', () => {
      const { result } = renderHook(() => useMidiImportExport());
      expect(result.current.error).toBeNull();
    });

    it('should return maxFileSize as 5MB', () => {
      const { result } = renderHook(() => useMidiImportExport());
      expect(result.current.maxFileSize).toBe(5 * 1024 * 1024);
    });
  });

  describe('validateFileSize', () => {
    it('should return true for files under 5MB', () => {
      const { result } = renderHook(() => useMidiImportExport());
      const file = { size: 1024 * 1024 } as File; // 1MB

      expect(result.current.validateFileSize(file)).toBe(true);
    });

    it('should return true for files exactly at 5MB', () => {
      const { result } = renderHook(() => useMidiImportExport());
      const file = { size: 5 * 1024 * 1024 } as File; // 5MB

      expect(result.current.validateFileSize(file)).toBe(true);
    });

    it('should return false for files over 5MB', () => {
      const { result } = renderHook(() => useMidiImportExport());
      const file = { size: 6 * 1024 * 1024 } as File; // 6MB

      expect(result.current.validateFileSize(file)).toBe(false);
    });
  });

  describe('getFilename', () => {
    it('should generate sanitized filename with .mid extension', () => {
      const { result } = renderHook(() => useMidiImportExport());

      expect(result.current.getFilename('My Melody')).toBe('My Melody.mid');
    });

    it('should sanitize invalid characters', () => {
      const { result } = renderHook(() => useMidiImportExport());

      expect(result.current.getFilename('My/Melody<2024>')).toBe('My_Melody_2024.mid');
    });

    it('should return "melody.mid" for empty title', () => {
      const { result } = renderHook(() => useMidiImportExport());

      expect(result.current.getFilename('')).toBe('melody.mid');
    });
  });

  describe('clearError', () => {
    it('should clear the error state', async () => {
      vi.mocked(midiImporter.parseMidiFile).mockRejectedValue(
        new midiImporter.MidiImportError('Import error')
      );

      const { result } = renderHook(() => useMidiImportExport());
      const file = new File(['test'], 'test.mid', { type: 'audio/midi' });

      // Generate an error
      await act(async () => {
        await result.current.importMidi(file);
      });
      expect(result.current.error).not.toBeNull();

      // Clear the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('importMidi', () => {
    it('should successfully import a valid MIDI file', async () => {
      const mockResult = {
        notes: [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 }],
        tempo: 120,
      };
      vi.mocked(midiImporter.parseMidiFile).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useMidiImportExport());
      const file = new File(['midi data'], 'test.mid', { type: 'audio/midi' });

      let importResult;
      await act(async () => {
        importResult = await result.current.importMidi(file);
      });

      expect(importResult).toEqual(mockResult);
      expect(result.current.error).toBeNull();
      expect(result.current.isImporting).toBe(false);
    });

    it('should return null and set error for file exceeding 5MB', async () => {
      const { result } = renderHook(() => useMidiImportExport());
      const file = new File(['test'], 'large.mid', { type: 'audio/midi' });
      Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 }); // 6MB

      let importResult;
      await act(async () => {
        importResult = await result.current.importMidi(file);
      });

      expect(importResult).toBeNull();
      expect(result.current.error).toContain('exceeds maximum allowed size');
    });

    it('should return null and set error for invalid MIDI file', async () => {
      vi.mocked(midiImporter.parseMidiFile).mockRejectedValue(
        new midiImporter.MidiImportError('Could not parse MIDI file')
      );

      const { result } = renderHook(() => useMidiImportExport());
      const file = new File(['invalid'], 'invalid.mid', { type: 'audio/midi' });

      let importResult;
      await act(async () => {
        importResult = await result.current.importMidi(file);
      });

      expect(importResult).toBeNull();
      expect(result.current.error).toContain('Could not parse MIDI file');
    });
  });

  describe('exportMidi', () => {
    it('should successfully export melody to blob', () => {
      const mockBlob = new Blob(['midi data'], { type: 'audio/midi' });
      vi.mocked(midiExporter.createMidiFile).mockReturnValue(mockBlob);

      const { result } = renderHook(() => useMidiImportExport());
      const melody = {
        title: 'Test Melody',
        notes: [{ id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 }],
        tempo: 120,
      };

      let blob;
      act(() => {
        blob = result.current.exportMidi(melody);
      });

      expect(blob).toBe(mockBlob);
      expect(result.current.error).toBeNull();
      expect(result.current.isExporting).toBe(false);
    });

    it('should return null and set error on export failure', () => {
      vi.mocked(midiExporter.createMidiFile).mockImplementation(() => {
        throw new midiExporter.MidiExportError('Export failed');
      });

      const { result } = renderHook(() => useMidiImportExport());
      const melody = {
        title: 'Test Melody',
        notes: [],
        tempo: 120,
      };

      let blob;
      act(() => {
        blob = result.current.exportMidi(melody);
      });

      expect(blob).toBeNull();
      expect(result.current.error).toContain('Export failed');
    });
  });

  describe('downloadMidi', () => {
    it('should trigger download without errors', () => {
      const mockBlob = new Blob(['midi data'], { type: 'audio/midi' });
      vi.mocked(midiExporter.exportMelodyToMidi).mockReturnValue(mockBlob);

      const { result } = renderHook(() => useMidiImportExport());
      const melody = {
        title: 'Test Melody',
        notes: [],
        tempo: 120,
      };

      act(() => {
        result.current.downloadMidi(melody);
      });

      expect(midiExporter.exportMelodyToMidi).toHaveBeenCalledWith(melody);
      expect(result.current.error).toBeNull();
      expect(result.current.isExporting).toBe(false);
    });

    it('should set error on download failure', () => {
      vi.mocked(midiExporter.exportMelodyToMidi).mockImplementation(() => {
        throw new midiExporter.MidiExportError('Download failed');
      });

      const { result } = renderHook(() => useMidiImportExport());
      const melody = {
        title: 'Test Melody',
        notes: [],
        tempo: 120,
      };

      act(() => {
        result.current.downloadMidi(melody);
      });

      expect(result.current.error).toContain('Download failed');
    });
  });

  describe('interface compliance', () => {
    it('should return an object with all required properties and methods', () => {
      const { result } = renderHook(() => useMidiImportExport());

      expect(result.current).toHaveProperty('isImporting');
      expect(result.current).toHaveProperty('isExporting');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('importMidi');
      expect(result.current).toHaveProperty('exportMidi');
      expect(result.current).toHaveProperty('downloadMidi');
      expect(result.current).toHaveProperty('getFilename');
      expect(result.current).toHaveProperty('validateFileSize');
      expect(result.current).toHaveProperty('clearError');
      expect(result.current).toHaveProperty('maxFileSize');

      expect(typeof result.current.isImporting).toBe('boolean');
      expect(typeof result.current.isExporting).toBe('boolean');
      expect(result.current.error).toBeNull();
      expect(typeof result.current.importMidi).toBe('function');
      expect(typeof result.current.exportMidi).toBe('function');
      expect(typeof result.current.downloadMidi).toBe('function');
      expect(typeof result.current.getFilename).toBe('function');
      expect(typeof result.current.validateFileSize).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.maxFileSize).toBe('number');
    });
  });
});

describe('MIDI Import/Export utilities integration', () => {
  describe('File size validation', () => {
    it('should validate file size is within 5MB limit', () => {
      // Test the underlying utility function
      const smallFile = { size: 1024 * 1024 } as File;
      const exactFile = { size: 5 * 1024 * 1024 } as File;
      const largeFile = { size: 6 * 1024 * 1024 } as File;

      expect(() => midiImporter.validateFileSize(smallFile)).not.toThrow();
      expect(() => midiImporter.validateFileSize(exactFile)).not.toThrow();
      expect(() => midiImporter.validateFileSize(largeFile)).toThrow(midiImporter.MidiImportError);
    });
  });

  describe('Filename sanitization', () => {
    it('should replace invalid filename characters with underscores', () => {
      expect(midiExporter.sanitizeFilename('Test<>:"|?*File')).toBe('Test_File');
    });

    it('should handle empty strings', () => {
      expect(midiExporter.sanitizeFilename('')).toBe('melody');
    });

    it('should preserve valid characters', () => {
      expect(midiExporter.sanitizeFilename('My-Song_2024')).toBe('My-Song_2024');
    });
  });

  describe('MIDI filename generation', () => {
    it('should append .mid extension', () => {
      expect(midiExporter.generateMidiFilename('My Melody')).toBe('My Melody.mid');
    });

    it('should sanitize and append .mid extension', () => {
      expect(midiExporter.generateMidiFilename('My/Invalid<File>')).toBe('My_Invalid_File.mid');
    });
  });

  describe('Velocity conversion', () => {
    it('should convert MIDI velocity (0-127) to application velocity (0-1)', () => {
      expect(midiImporter.convertMidiVelocity(0)).toBe(0);
      expect(midiImporter.convertMidiVelocity(127)).toBeCloseTo(1, 5);
      expect(midiImporter.convertMidiVelocity(64)).toBeCloseTo(64 / 127, 5);
    });

    it('should convert application velocity (0-1) to MIDI velocity (0-127)', () => {
      expect(midiExporter.convertToMidiVelocity(0)).toBe(0);
      expect(midiExporter.convertToMidiVelocity(1)).toBe(127);
      expect(midiExporter.convertToMidiVelocity(0.5)).toBe(64);
    });
  });

  describe('Constants', () => {
    it('should have correct MAX_MIDI_FILE_SIZE', () => {
      expect(midiImporter.MAX_MIDI_FILE_SIZE).toBe(5 * 1024 * 1024);
    });

    it('should have correct DEFAULT_TEMPO', () => {
      expect(midiImporter.DEFAULT_TEMPO).toBe(120);
    });

    it('should have correct DEFAULT_EXPORT_TEMPO', () => {
      expect(midiExporter.DEFAULT_EXPORT_TEMPO).toBe(120);
    });
  });

  describe('Error classes', () => {
    it('MidiImportError should be an instance of Error', () => {
      const error = new midiImporter.MidiImportError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('MidiImportError');
      expect(error.message).toBe('Test error');
    });

    it('MidiExportError should be an instance of Error', () => {
      const error = new midiExporter.MidiExportError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('MidiExportError');
      expect(error.message).toBe('Test error');
    });
  });
});
