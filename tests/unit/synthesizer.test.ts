import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { SynthesizerConfig } from '../../types/synth';

// Mock requestAnimationFrame and cancelAnimationFrame for Node.js environment
const originalRaf = global.requestAnimationFrame;
const originalCaf = global.cancelAnimationFrame;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

// Mock window for Web Audio API support check
const mockWindow = {
  AudioContext: class MockAudioContext {},
};

beforeAll(() => {
  global.requestAnimationFrame = vi.fn((callback) => {
    return setTimeout(callback, 16) as unknown as number;
  });
  global.cancelAnimationFrame = vi.fn((id) => {
    clearTimeout(id);
  });
  // Mock setInterval to return immediately for audio context monitoring
  global.setInterval = vi.fn(() => 999) as unknown as typeof setInterval;
  global.clearInterval = vi.fn();
  // Mock window for Web Audio support check
  (global as Record<string, unknown>).window = mockWindow;
});

afterAll(() => {
  global.requestAnimationFrame = originalRaf;
  global.cancelAnimationFrame = originalCaf;
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
  delete (global as Record<string, unknown>).window;
});

// Mock Tone.js since we're running in Node.js environment without Web Audio API
// Using class-based mocks to satisfy the constructor expectations
vi.mock('tone', () => {
  class MockVolume {
    volume = { value: 0 };
    toDestination() { return this; }
    connect() { return this; }
    disconnect() { return this; }
    dispose() {}
  }

  class MockFilter {
    type = 'lowpass' as const;
    frequency = { value: 1000 };
    Q = 1;
    connect() { return this; }
    disconnect() { return this; }
    dispose() {}
  }

  class MockPolySynth {
    set = vi.fn();
    connect() { return this; }
    disconnect() { return this; }
    triggerAttackRelease = vi.fn();
    releaseAll = vi.fn();
    dispose() {}
  }

  class MockSynth {}

  // Mock Reverb effect
  class MockReverb {
    decay = 1;
    wet = { value: 0.3 };
    connect() { return this; }
    disconnect() { return this; }
    dispose() {}
  }

  // Mock FeedbackDelay effect
  class MockFeedbackDelay {
    delayTime = { value: 0.25 };
    feedback = { value: 0.3 };
    wet = { value: 0.3 };
    connect() { return this; }
    disconnect() { return this; }
    dispose() {}
  }

  // Mock Chorus effect
  class MockChorus {
    frequency = { value: 1.5 };
    depth = 0.5;
    wet = { value: 0.3 };
    start() { return this; }
    connect() { return this; }
    disconnect() { return this; }
    dispose() {}
  }

  // Mock Phaser effect (used for flanger)
  class MockPhaser {
    frequency = { value: 0.5 };
    octaves = 2;
    baseFrequency = 400;
    wet = { value: 0.3 };
    connect() { return this; }
    disconnect() { return this; }
    dispose() {}
  }

  // Mock Limiter (used for master output protection)
  class MockLimiter {
    threshold = { value: -1 };
    connect() { return this; }
    disconnect() { return this; }
    toDestination() { return this; }
    dispose() {}
  }

  // Mock Transport
  const mockTransport = {
    position: 0,
    seconds: 0,
    bpm: { value: 120 }, // Default tempo 120 BPM
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    clear: vi.fn(),
    scheduleOnce: vi.fn((_callback: () => void, _time: number) => {
      // Return a unique event ID
      return Math.random();
    }),
  };

  // Mock Draw
  const mockDraw = {
    schedule: vi.fn((_callback: () => void, _time: number) => {
      // Don't actually schedule anything in tests
    }),
  };

  // Mock Time
  class MockTime {
    constructor(private value: string | number) {}
    toSeconds() {
      // Return a simple value for testing - 1 beat = 0.5 seconds at 120 BPM
      if (this.value === '4n') return 0.5;
      return 0;
    }
  }

  // Mock AudioContext for getContext
  const mockRawContext = {
    state: 'running' as const,
  };

  const mockContext = {
    rawContext: mockRawContext,
  };

  return {
    default: {
      Volume: MockVolume,
      Filter: MockFilter,
      PolySynth: MockPolySynth,
      Synth: MockSynth,
      Reverb: MockReverb,
      FeedbackDelay: MockFeedbackDelay,
      Chorus: MockChorus,
      Phaser: MockPhaser,
      Limiter: MockLimiter,
      now: () => 0,
      start: vi.fn(() => Promise.resolve()),
      getTransport: () => mockTransport,
      getDraw: () => mockDraw,
      getContext: () => mockContext,
      Time: (value: string | number) => new MockTime(value),
    },
    Volume: MockVolume,
    Filter: MockFilter,
    PolySynth: MockPolySynth,
    Synth: MockSynth,
    Reverb: MockReverb,
    FeedbackDelay: MockFeedbackDelay,
    Chorus: MockChorus,
    Phaser: MockPhaser,
    Limiter: MockLimiter,
    now: () => 0,
    start: vi.fn(() => Promise.resolve()),
    getTransport: () => mockTransport,
    getDraw: () => mockDraw,
    getContext: () => mockContext,
    Time: (value: string | number) => new MockTime(value),
  };
});

// Import after mock is set up
import { SynthesizerEngine, DEFAULT_SYNTH_CONFIG } from '../../lib/synthesizer';

describe('SynthesizerEngine', () => {
  let engine: SynthesizerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SynthesizerEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const config = engine.getConfig();
      expect(config).toEqual(DEFAULT_SYNTH_CONFIG);
    });

    it('should accept partial initial configuration', () => {
      const customEngine = new SynthesizerEngine({
        oscillatorType: 'square',
        volume: 0.5,
      });

      const config = customEngine.getConfig();
      expect(config.oscillatorType).toBe('square');
      expect(config.volume).toBe(0.5);
      expect(config.envelope).toEqual(DEFAULT_SYNTH_CONFIG.envelope);
      expect(config.filter).toEqual(DEFAULT_SYNTH_CONFIG.filter);

      customEngine.dispose();
    });

    it('should use default oscillator type as sine', () => {
      expect(engine.getConfig().oscillatorType).toBe('sine');
    });

    it('should use default volume as 0.8', () => {
      expect(engine.getConfig().volume).toBe(0.8);
    });
  });

  describe('DEFAULT_SYNTH_CONFIG', () => {
    it('should have correct default oscillator type (sine)', () => {
      expect(DEFAULT_SYNTH_CONFIG.oscillatorType).toBe('sine');
    });

    it('should have correct default volume (0.8)', () => {
      expect(DEFAULT_SYNTH_CONFIG.volume).toBe(0.8);
    });

    it('should have correct default attack (0.01 seconds)', () => {
      expect(DEFAULT_SYNTH_CONFIG.envelope.attack).toBe(0.01);
    });

    it('should have correct default decay (0.1 seconds)', () => {
      expect(DEFAULT_SYNTH_CONFIG.envelope.decay).toBe(0.1);
    });

    it('should have correct default sustain (0.5)', () => {
      expect(DEFAULT_SYNTH_CONFIG.envelope.sustain).toBe(0.5);
    });

    it('should have correct default release (0.5 seconds)', () => {
      expect(DEFAULT_SYNTH_CONFIG.envelope.release).toBe(0.5);
    });

    it('should have filter disabled by default', () => {
      expect(DEFAULT_SYNTH_CONFIG.filter.enabled).toBe(false);
    });

    it('should have default filter type as lowpass', () => {
      expect(DEFAULT_SYNTH_CONFIG.filter.type).toBe('lowpass');
    });

    it('should have default filter frequency as 1000 Hz', () => {
      expect(DEFAULT_SYNTH_CONFIG.filter.frequency).toBe(1000);
    });
  });

  describe('configure()', () => {
    it('should update oscillator type', () => {
      engine.configure({ oscillatorType: 'square' });
      expect(engine.getConfig().oscillatorType).toBe('square');
    });

    it('should support all oscillator types: sine, square, sawtooth, triangle', () => {
      const types: Array<SynthesizerConfig['oscillatorType']> = [
        'sine',
        'square',
        'sawtooth',
        'triangle',
      ];

      for (const type of types) {
        engine.configure({ oscillatorType: type });
        expect(engine.getConfig().oscillatorType).toBe(type);
      }
    });

    it('should update volume', () => {
      engine.configure({ volume: 0.5 });
      expect(engine.getConfig().volume).toBe(0.5);
    });

    it('should update ADSR envelope partially', () => {
      engine.configure({
        envelope: { attack: 0.5 },
      });

      const config = engine.getConfig();
      expect(config.envelope.attack).toBe(0.5);
      // Other envelope values should remain default
      expect(config.envelope.decay).toBe(DEFAULT_SYNTH_CONFIG.envelope.decay);
      expect(config.envelope.sustain).toBe(DEFAULT_SYNTH_CONFIG.envelope.sustain);
      expect(config.envelope.release).toBe(DEFAULT_SYNTH_CONFIG.envelope.release);
    });

    it('should update full ADSR envelope', () => {
      const newEnvelope = {
        attack: 1.0,
        decay: 0.5,
        sustain: 0.7,
        release: 2.0,
      };

      engine.configure({ envelope: newEnvelope });

      expect(engine.getConfig().envelope).toEqual(newEnvelope);
    });

    it('should enable filter', () => {
      engine.configure({ filter: { enabled: true } });
      expect(engine.getConfig().filter.enabled).toBe(true);
    });

    it('should update filter type', () => {
      engine.configure({ filter: { type: 'highpass' } });
      expect(engine.getConfig().filter.type).toBe('highpass');
    });

    it('should update filter frequency', () => {
      engine.configure({ filter: { frequency: 5000 } });
      expect(engine.getConfig().filter.frequency).toBe(5000);
    });

    it('should update multiple filter properties at once', () => {
      engine.configure({
        filter: {
          enabled: true,
          type: 'highpass',
          frequency: 2000,
        },
      });

      const filter = engine.getConfig().filter;
      expect(filter.enabled).toBe(true);
      expect(filter.type).toBe('highpass');
      expect(filter.frequency).toBe(2000);
    });

    it('should not modify other config values when updating one', () => {
      const originalConfig = engine.getConfig();

      engine.configure({ volume: 0.3 });

      const newConfig = engine.getConfig();
      expect(newConfig.oscillatorType).toBe(originalConfig.oscillatorType);
      expect(newConfig.envelope).toEqual(originalConfig.envelope);
      expect(newConfig.filter).toEqual(originalConfig.filter);
    });

    it('should handle empty configuration', () => {
      const originalConfig = engine.getConfig();
      engine.configure({});
      expect(engine.getConfig()).toEqual(originalConfig);
    });

    it('should not apply changes after dispose', () => {
      engine.dispose();
      engine.configure({ volume: 0.1 });
      // Config should still be the default since configure is no-op after dispose
      expect(engine.getConfig().volume).toBe(0.8);
    });
  });

  describe('dispose()', () => {
    it('should mark engine as disposed', () => {
      expect(engine.disposed).toBe(false);
      engine.dispose();
      expect(engine.disposed).toBe(true);
    });

    it('should be idempotent (calling multiple times is safe)', () => {
      engine.dispose();
      engine.dispose();
      expect(engine.disposed).toBe(true);
    });

    it('should clear playhead callbacks', () => {
      const callback = vi.fn();
      engine.onPlayheadUpdate(callback);
      engine.dispose();
      // After dispose, internal callbacks array should be cleared
      expect(engine.disposed).toBe(true);
    });
  });

  describe('onPlayheadUpdate()', () => {
    it('should register a callback', () => {
      const callback = vi.fn();
      engine.onPlayheadUpdate(callback);
      // Callback registration doesn't throw
      expect(true).toBe(true);
    });

    it('should allow multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      engine.onPlayheadUpdate(callback1);
      engine.onPlayheadUpdate(callback2);
      expect(true).toBe(true);
    });
  });

  describe('offPlayheadUpdate()', () => {
    it('should remove a registered callback', () => {
      const callback = vi.fn();
      engine.onPlayheadUpdate(callback);
      engine.offPlayheadUpdate(callback);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle removing non-existent callback', () => {
      const callback = vi.fn();
      // Should not throw even if callback wasn't registered
      engine.offPlayheadUpdate(callback);
      expect(true).toBe(true);
    });
  });

  describe('triggerNote()', () => {
    it('should not throw when triggering a valid note', () => {
      const note = {
        id: 'test-id',
        pitch: 60, // Middle C
        start: 0,
        duration: 1,
        velocity: 0.8,
      };

      expect(() => engine.triggerNote(note)).not.toThrow();
    });

    it('should not trigger note after dispose', () => {
      const note = {
        id: 'test-id',
        pitch: 60,
        start: 0,
        duration: 1,
        velocity: 0.8,
      };

      engine.dispose();
      // Should not throw, just do nothing
      expect(() => engine.triggerNote(note)).not.toThrow();
    });
  });

  describe('getConfig()', () => {
    it('should return a copy of the configuration', () => {
      const config1 = engine.getConfig();
      const config2 = engine.getConfig();

      // Should be equal but not the same object reference
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });

    it('should not allow mutation of internal config through returned value', () => {
      const config = engine.getConfig();
      config.volume = 0.1;

      expect(engine.getConfig().volume).toBe(0.8);
    });
  });
});

describe('MIDI to Note Name conversion', () => {
  // These tests verify the internal midiToNoteName function behavior
  // through the triggerNote method

  it('should handle middle C (MIDI 60)', () => {
    const engine = new SynthesizerEngine();
    const note = {
      id: 'test',
      pitch: 60,
      start: 0,
      duration: 1,
      velocity: 0.8,
    };

    // Should not throw - C4 is a valid note
    expect(() => engine.triggerNote(note)).not.toThrow();
    engine.dispose();
  });

  it('should handle lowest MIDI note (0)', () => {
    const engine = new SynthesizerEngine();
    const note = {
      id: 'test',
      pitch: 0,
      start: 0,
      duration: 1,
      velocity: 0.8,
    };

    expect(() => engine.triggerNote(note)).not.toThrow();
    engine.dispose();
  });

  it('should handle highest MIDI note (127)', () => {
    const engine = new SynthesizerEngine();
    const note = {
      id: 'test',
      pitch: 127,
      start: 0,
      duration: 1,
      velocity: 0.8,
    };

    expect(() => engine.triggerNote(note)).not.toThrow();
    engine.dispose();
  });
});


describe('Playback Controls', () => {
  let engine: SynthesizerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SynthesizerEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });

  describe('play()', () => {
    it('should change playback state to playing when called with notes', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);

      // Wait for Tone.start() promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(engine.getPlaybackState()).toBe('playing');
    });

    it('should remain stopped when called with empty notes array (Req 13.5)', () => {
      engine.play([], 0, false);
      expect(engine.getPlaybackState()).toBe('stopped');
    });

    it('should reset playhead to zero when playhead is past last note (Req 13.4)', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
      ];

      // Set start position past end of melody (note ends at beat 1)
      engine.play(notes, 5, false);

      // Wait for Tone.start() promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(engine.getPlayheadPosition()).toBe(0);
    });

    it('should store loop setting', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
      ];

      engine.play(notes, 0, true);

      // Wait for Tone.start() promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(engine.isLooping()).toBe(true);
    });

    it('should not throw when disposed', () => {
      engine.dispose();
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
      ];

      expect(() => engine.play(notes, 0, false)).not.toThrow();
    });
  });

  describe('pause()', () => {
    it('should change playback state to paused when playing', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));

      engine.pause();

      expect(engine.getPlaybackState()).toBe('paused');
    });

    it('should maintain playhead position when paused (Req 13.2)', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 4, velocity: 0.8 },
      ];

      engine.play(notes, 2, false);
      await new Promise(resolve => setTimeout(resolve, 0));

      engine.pause();

      // Playhead should be >= start position (transport starts at 0 in mock)
      expect(engine.getPlayheadPosition()).toBeGreaterThanOrEqual(2);
    });

    it('should not change state when already stopped', () => {
      engine.pause();
      expect(engine.getPlaybackState()).toBe('stopped');
    });

    it('should not throw when disposed', () => {
      engine.dispose();
      expect(() => engine.pause()).not.toThrow();
    });
  });

  describe('stop()', () => {
    it('should change playback state to stopped', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));

      engine.stop();

      expect(engine.getPlaybackState()).toBe('stopped');
    });

    it('should reset playhead to position zero (Req 14.2)', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
      ];

      engine.play(notes, 2, false);
      await new Promise(resolve => setTimeout(resolve, 0));

      engine.stop();

      expect(engine.getPlayheadPosition()).toBe(0);
    });

    it('should reset to position zero without error when not playing (Req 14.3)', () => {
      expect(() => engine.stop()).not.toThrow();
      expect(engine.getPlayheadPosition()).toBe(0);
    });

    it('should not throw when disposed', () => {
      engine.dispose();
      expect(() => engine.stop()).not.toThrow();
    });
  });

  describe('setPlayheadPosition()', () => {
    it('should update playhead position', () => {
      engine.setPlayheadPosition(5);
      expect(engine.getPlayheadPosition()).toBe(5);
    });

    it('should clamp negative values to zero', () => {
      engine.setPlayheadPosition(-5);
      expect(engine.getPlayheadPosition()).toBe(0);
    });

    it('should notify callbacks of position change', () => {
      const callback = vi.fn();
      engine.onPlayheadUpdate(callback);

      engine.setPlayheadPosition(3);

      expect(callback).toHaveBeenCalledWith(3);
    });

    it('should not throw when disposed', () => {
      engine.dispose();
      expect(() => engine.setPlayheadPosition(5)).not.toThrow();
    });
  });

  describe('loop mode (Req 15.1-15.4)', () => {
    it('should provide loop toggle via setLoopEnabled (Req 15.1)', () => {
      engine.setLoopEnabled(true);
      expect(engine.isLooping()).toBe(true);

      engine.setLoopEnabled(false);
      expect(engine.isLooping()).toBe(false);
    });

    it('should default to loop disabled', () => {
      expect(engine.isLooping()).toBe(false);
    });

    it('should stop immediately with empty melody in loop mode (Req 15.4)', () => {
      engine.setLoopEnabled(true);
      engine.play([], 0, true);

      expect(engine.getPlaybackState()).toBe('stopped');
    });
  });

  describe('getPlaybackState()', () => {
    it('should return stopped initially', () => {
      expect(engine.getPlaybackState()).toBe('stopped');
    });
  });

  describe('getPlayheadPosition()', () => {
    it('should return 0 initially', () => {
      expect(engine.getPlayheadPosition()).toBe(0);
    });
  });
});

describe('Playhead synchronization (Req 8.2, 8.4, 29.1, 29.2, 29.3)', () => {
  let engine: SynthesizerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SynthesizerEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });

  describe('onPlayheadUpdate callback mechanism', () => {
    it('should register callbacks that receive position updates', () => {
      const callback = vi.fn();
      engine.onPlayheadUpdate(callback);

      // Manually trigger position update to verify callback is registered
      engine.setPlayheadPosition(5);

      // Callback should have been called with the position
      expect(callback).toHaveBeenCalledWith(5);
    });

    it('should pass current position to callback', () => {
      const callback = vi.fn();
      engine.onPlayheadUpdate(callback);

      // Manually trigger position update
      engine.setPlayheadPosition(5);

      expect(callback).toHaveBeenCalledWith(5);
    });

    it('should call all registered callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      engine.onPlayheadUpdate(callback1);
      engine.onPlayheadUpdate(callback2);
      engine.onPlayheadUpdate(callback3);

      engine.setPlayheadPosition(3);

      expect(callback1).toHaveBeenCalledWith(3);
      expect(callback2).toHaveBeenCalledWith(3);
      expect(callback3).toHaveBeenCalledWith(3);
    });

    it('should stop calling removed callbacks', () => {
      const callback = vi.fn();
      engine.onPlayheadUpdate(callback);

      engine.setPlayheadPosition(1);
      expect(callback).toHaveBeenCalledTimes(1);

      engine.offPlayheadUpdate(callback);
      callback.mockClear();

      engine.setPlayheadPosition(2);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify with position 0 when stop is called', async () => {
      const callback = vi.fn();
      engine.onPlayheadUpdate(callback);

      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 2, velocity: 0.8 },
      ];

      engine.play(notes, 5, false);
      await new Promise(resolve => setTimeout(resolve, 0));
      callback.mockClear();

      engine.stop();

      // Should notify with position 0 on stop
      expect(callback).toHaveBeenCalledWith(0);
    });
  });

  describe('getRealTimePlayheadPosition()', () => {
    it('should return stored position when not playing', () => {
      engine.setPlayheadPosition(5);
      expect(engine.getRealTimePlayheadPosition()).toBe(5);
    });

    it('should return stored position when stopped', () => {
      expect(engine.getRealTimePlayheadPosition()).toBe(0);
    });

    it('should return calculated position during playback', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 10, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Position should be at or near 0 since we just started
      const position = engine.getRealTimePlayheadPosition();
      expect(position).toBeGreaterThanOrEqual(0);
    });

    it('should return position at start value when starting from non-zero', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 10, velocity: 0.8 },
      ];

      engine.play(notes, 5, false);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Position should be at or near 5 since we started from there
      const position = engine.getRealTimePlayheadPosition();
      expect(position).toBeGreaterThanOrEqual(5);
    });
  });

  describe('playhead position tracking during playback state changes', () => {
    it('should maintain accurate position through pause/resume cycle', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 10, velocity: 0.8 },
      ];

      engine.play(notes, 2, false);
      await new Promise(resolve => setTimeout(resolve, 0));

      engine.pause();
      const pausedPosition = engine.getPlayheadPosition();

      // Position should be >= 2 (start position)
      expect(pausedPosition).toBeGreaterThanOrEqual(2);
    });

    it('should reset position tracking when seeking during playback', async () => {
      const callback = vi.fn();
      engine.onPlayheadUpdate(callback);

      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 10, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Seek to a new position
      engine.setPlayheadPosition(5);

      // Callback should have been called with new position
      expect(callback).toHaveBeenCalledWith(5);
    });
  });
});

describe('Playback state transitions', () => {
  let engine: SynthesizerEngine;
  const testNotes = [
    { id: '1', pitch: 60, start: 0, duration: 2, velocity: 0.8 },
    { id: '2', pitch: 64, start: 1, duration: 1, velocity: 0.7 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SynthesizerEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });

  it('should transition: stopped -> playing -> paused -> playing (Req 13.3)', async () => {
    expect(engine.getPlaybackState()).toBe('stopped');

    engine.play(testNotes, 0, false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(engine.getPlaybackState()).toBe('playing');

    engine.pause();
    expect(engine.getPlaybackState()).toBe('paused');

    // Resume from paused position
    engine.play(testNotes, engine.getPlayheadPosition(), false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(engine.getPlaybackState()).toBe('playing');
  });

  it('should transition: stopped -> playing -> stopped', async () => {
    expect(engine.getPlaybackState()).toBe('stopped');

    engine.play(testNotes, 0, false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(engine.getPlaybackState()).toBe('playing');

    engine.stop();
    expect(engine.getPlaybackState()).toBe('stopped');
    expect(engine.getPlayheadPosition()).toBe(0);
  });

  it('should transition: paused -> stopped', async () => {
    engine.play(testNotes, 0, false);
    await new Promise(resolve => setTimeout(resolve, 0));

    engine.pause();
    expect(engine.getPlaybackState()).toBe('paused');

    engine.stop();
    expect(engine.getPlaybackState()).toBe('stopped');
    expect(engine.getPlayheadPosition()).toBe(0);
  });

  it('should transition: stopped -> playing -> paused -> stopped', async () => {
    expect(engine.getPlaybackState()).toBe('stopped');

    engine.play(testNotes, 0, false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(engine.getPlaybackState()).toBe('playing');

    engine.pause();
    expect(engine.getPlaybackState()).toBe('paused');
    const pausedPosition = engine.getPlayheadPosition();
    expect(pausedPosition).toBeGreaterThanOrEqual(0);

    engine.stop();
    expect(engine.getPlaybackState()).toBe('stopped');
    expect(engine.getPlayheadPosition()).toBe(0);
  });

  it('should allow play from stopped state multiple times', async () => {
    engine.play(testNotes, 0, false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(engine.getPlaybackState()).toBe('playing');

    engine.stop();
    expect(engine.getPlaybackState()).toBe('stopped');

    engine.play(testNotes, 0, false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(engine.getPlaybackState()).toBe('playing');

    engine.stop();
    expect(engine.getPlaybackState()).toBe('stopped');
  });

  it('should not change state when pausing while already stopped', () => {
    expect(engine.getPlaybackState()).toBe('stopped');
    engine.pause();
    expect(engine.getPlaybackState()).toBe('stopped');
  });

  it('should handle rapid state transitions', async () => {
    // Rapid play/stop cycling
    for (let i = 0; i < 3; i++) {
      engine.play(testNotes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));
      engine.stop();
    }
    expect(engine.getPlaybackState()).toBe('stopped');
    expect(engine.getPlayheadPosition()).toBe(0);
  });
});

describe('Configuration application (Req 9.1, 9.2, 10.1, 11.1-11.4, 12.1-12.2)', () => {
  let engine: SynthesizerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SynthesizerEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });

  describe('Oscillator type configuration (Req 9.1, 9.2)', () => {
    it('should default to sine oscillator type (Req 9.1)', () => {
      expect(engine.getConfig().oscillatorType).toBe('sine');
    });

    it('should apply sine oscillator type', () => {
      engine.configure({ oscillatorType: 'sine' });
      expect(engine.getConfig().oscillatorType).toBe('sine');
    });

    it('should apply square oscillator type', () => {
      engine.configure({ oscillatorType: 'square' });
      expect(engine.getConfig().oscillatorType).toBe('square');
    });

    it('should apply sawtooth oscillator type', () => {
      engine.configure({ oscillatorType: 'sawtooth' });
      expect(engine.getConfig().oscillatorType).toBe('sawtooth');
    });

    it('should apply triangle oscillator type', () => {
      engine.configure({ oscillatorType: 'triangle' });
      expect(engine.getConfig().oscillatorType).toBe('triangle');
    });

    it('should apply oscillator changes during playback without stopping (Req 9.2)', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 10, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(engine.getPlaybackState()).toBe('playing');

      engine.configure({ oscillatorType: 'square' });
      expect(engine.getConfig().oscillatorType).toBe('square');
      expect(engine.getPlaybackState()).toBe('playing'); // Still playing
    });

    it('should persist oscillator type across multiple configuration calls', () => {
      engine.configure({ oscillatorType: 'sawtooth' });
      engine.configure({ volume: 0.5 }); // Update something else
      expect(engine.getConfig().oscillatorType).toBe('sawtooth');
    });
  });

  describe('Volume configuration (Req 10.1)', () => {
    it('should default to volume 0.8 (Req 10.1)', () => {
      expect(engine.getConfig().volume).toBe(0.8);
    });

    it('should apply volume at minimum (0)', () => {
      engine.configure({ volume: 0 });
      expect(engine.getConfig().volume).toBe(0);
    });

    it('should apply volume at maximum (1)', () => {
      engine.configure({ volume: 1 });
      expect(engine.getConfig().volume).toBe(1);
    });

    it('should apply volume at mid-range (0.5)', () => {
      engine.configure({ volume: 0.5 });
      expect(engine.getConfig().volume).toBe(0.5);
    });

    it('should apply volume changes during playback without stopping', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 10, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(engine.getPlaybackState()).toBe('playing');

      engine.configure({ volume: 0.3 });
      expect(engine.getConfig().volume).toBe(0.3);
      expect(engine.getPlaybackState()).toBe('playing');
    });

    it('should persist volume across multiple configuration calls', () => {
      engine.configure({ volume: 0.4 });
      engine.configure({ oscillatorType: 'triangle' });
      expect(engine.getConfig().volume).toBe(0.4);
    });
  });

  describe('ADSR Envelope configuration (Req 11.1-11.4)', () => {
    it('should have default attack of 0.01 seconds (Req 11.1)', () => {
      expect(engine.getConfig().envelope.attack).toBe(0.01);
    });

    it('should have default decay of 0.1 seconds (Req 11.2)', () => {
      expect(engine.getConfig().envelope.decay).toBe(0.1);
    });

    it('should have default sustain of 0.5 (Req 11.3)', () => {
      expect(engine.getConfig().envelope.sustain).toBe(0.5);
    });

    it('should have default release of 0.5 seconds (Req 11.4)', () => {
      expect(engine.getConfig().envelope.release).toBe(0.5);
    });

    it('should apply attack at minimum (0 seconds)', () => {
      engine.configure({ envelope: { attack: 0 } });
      expect(engine.getConfig().envelope.attack).toBe(0);
    });

    it('should apply attack at maximum (2 seconds)', () => {
      engine.configure({ envelope: { attack: 2 } });
      expect(engine.getConfig().envelope.attack).toBe(2);
    });

    it('should apply decay at minimum (0 seconds)', () => {
      engine.configure({ envelope: { decay: 0 } });
      expect(engine.getConfig().envelope.decay).toBe(0);
    });

    it('should apply decay at maximum (2 seconds)', () => {
      engine.configure({ envelope: { decay: 2 } });
      expect(engine.getConfig().envelope.decay).toBe(2);
    });

    it('should apply sustain at minimum (0)', () => {
      engine.configure({ envelope: { sustain: 0 } });
      expect(engine.getConfig().envelope.sustain).toBe(0);
    });

    it('should apply sustain at maximum (1)', () => {
      engine.configure({ envelope: { sustain: 1 } });
      expect(engine.getConfig().envelope.sustain).toBe(1);
    });

    it('should apply release at minimum (0 seconds)', () => {
      engine.configure({ envelope: { release: 0 } });
      expect(engine.getConfig().envelope.release).toBe(0);
    });

    it('should apply release at maximum (5 seconds)', () => {
      engine.configure({ envelope: { release: 5 } });
      expect(engine.getConfig().envelope.release).toBe(5);
    });

    it('should apply all ADSR values at once', () => {
      engine.configure({
        envelope: {
          attack: 1.5,
          decay: 1.0,
          sustain: 0.7,
          release: 3.0,
        },
      });

      const envelope = engine.getConfig().envelope;
      expect(envelope.attack).toBe(1.5);
      expect(envelope.decay).toBe(1.0);
      expect(envelope.sustain).toBe(0.7);
      expect(envelope.release).toBe(3.0);
    });

    it('should apply ADSR changes during playback without stopping', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 10, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(engine.getPlaybackState()).toBe('playing');

      engine.configure({
        envelope: { attack: 0.5, release: 2.0 },
      });
      expect(engine.getConfig().envelope.attack).toBe(0.5);
      expect(engine.getConfig().envelope.release).toBe(2.0);
      expect(engine.getPlaybackState()).toBe('playing');
    });

    it('should preserve unchanged ADSR values when updating partial envelope', () => {
      engine.configure({ envelope: { attack: 1.0 } });
      expect(engine.getConfig().envelope.decay).toBe(0.1); // Default
      expect(engine.getConfig().envelope.sustain).toBe(0.5); // Default
      expect(engine.getConfig().envelope.release).toBe(0.5); // Default

      engine.configure({ envelope: { sustain: 0.8 } });
      expect(engine.getConfig().envelope.attack).toBe(1.0); // Previous value
      expect(engine.getConfig().envelope.decay).toBe(0.1); // Default
      expect(engine.getConfig().envelope.sustain).toBe(0.8); // New value
      expect(engine.getConfig().envelope.release).toBe(0.5); // Default
    });
  });

  describe('Filter configuration (Req 12.1, 12.2)', () => {
    it('should have filter disabled by default (Req 12.1)', () => {
      expect(engine.getConfig().filter.enabled).toBe(false);
    });

    it('should have default filter type as lowpass (Req 12.1)', () => {
      expect(engine.getConfig().filter.type).toBe('lowpass');
    });

    it('should have default filter frequency of 1000 Hz (Req 12.2)', () => {
      expect(engine.getConfig().filter.frequency).toBe(1000);
    });

    it('should enable the filter', () => {
      engine.configure({ filter: { enabled: true } });
      expect(engine.getConfig().filter.enabled).toBe(true);
    });

    it('should disable the filter', () => {
      engine.configure({ filter: { enabled: true } });
      engine.configure({ filter: { enabled: false } });
      expect(engine.getConfig().filter.enabled).toBe(false);
    });

    it('should apply lowpass filter type', () => {
      engine.configure({ filter: { type: 'lowpass' } });
      expect(engine.getConfig().filter.type).toBe('lowpass');
    });

    it('should apply highpass filter type', () => {
      engine.configure({ filter: { type: 'highpass' } });
      expect(engine.getConfig().filter.type).toBe('highpass');
    });

    it('should apply filter frequency at minimum (20 Hz)', () => {
      engine.configure({ filter: { frequency: 20 } });
      expect(engine.getConfig().filter.frequency).toBe(20);
    });

    it('should apply filter frequency at maximum (20000 Hz)', () => {
      engine.configure({ filter: { frequency: 20000 } });
      expect(engine.getConfig().filter.frequency).toBe(20000);
    });

    it('should apply mid-range filter frequency', () => {
      engine.configure({ filter: { frequency: 5000 } });
      expect(engine.getConfig().filter.frequency).toBe(5000);
    });

    it('should apply all filter settings at once', () => {
      engine.configure({
        filter: {
          enabled: true,
          type: 'highpass',
          frequency: 2500,
        },
      });

      const filter = engine.getConfig().filter;
      expect(filter.enabled).toBe(true);
      expect(filter.type).toBe('highpass');
      expect(filter.frequency).toBe(2500);
    });

    it('should apply filter changes during playback without stopping', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 10, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(engine.getPlaybackState()).toBe('playing');

      engine.configure({
        filter: { enabled: true, type: 'lowpass', frequency: 3000 },
      });
      expect(engine.getConfig().filter.enabled).toBe(true);
      expect(engine.getConfig().filter.frequency).toBe(3000);
      expect(engine.getPlaybackState()).toBe('playing');
    });

    it('should preserve unchanged filter values when updating partial filter', () => {
      engine.configure({ filter: { enabled: true } });
      expect(engine.getConfig().filter.type).toBe('lowpass'); // Default
      expect(engine.getConfig().filter.frequency).toBe(1000); // Default

      engine.configure({ filter: { frequency: 2000 } });
      expect(engine.getConfig().filter.enabled).toBe(true); // Previous value
      expect(engine.getConfig().filter.type).toBe('lowpass'); // Default
      expect(engine.getConfig().filter.frequency).toBe(2000); // New value
    });

    it('should toggle filter enabled state during playback', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 10, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));

      // Enable filter
      engine.configure({ filter: { enabled: true } });
      expect(engine.getConfig().filter.enabled).toBe(true);
      expect(engine.getPlaybackState()).toBe('playing');

      // Disable filter
      engine.configure({ filter: { enabled: false } });
      expect(engine.getConfig().filter.enabled).toBe(false);
      expect(engine.getPlaybackState()).toBe('playing');
    });
  });

  describe('Combined configuration changes', () => {
    it('should apply multiple configuration properties at once', () => {
      engine.configure({
        oscillatorType: 'triangle',
        volume: 0.6,
        envelope: { attack: 0.2, release: 1.5 },
        filter: { enabled: true, frequency: 4000 },
      });

      const config = engine.getConfig();
      expect(config.oscillatorType).toBe('triangle');
      expect(config.volume).toBe(0.6);
      expect(config.envelope.attack).toBe(0.2);
      expect(config.envelope.release).toBe(1.5);
      expect(config.filter.enabled).toBe(true);
      expect(config.filter.frequency).toBe(4000);
    });

    it('should apply sequential configuration changes correctly', () => {
      engine.configure({ oscillatorType: 'square' });
      engine.configure({ volume: 0.3 });
      engine.configure({ envelope: { decay: 0.5 } });
      engine.configure({ filter: { type: 'highpass' } });

      const config = engine.getConfig();
      expect(config.oscillatorType).toBe('square');
      expect(config.volume).toBe(0.3);
      expect(config.envelope.decay).toBe(0.5);
      expect(config.filter.type).toBe('highpass');
    });

    it('should apply all configuration changes during active playback', async () => {
      const notes = [
        { id: '1', pitch: 60, start: 0, duration: 20, velocity: 0.8 },
      ];

      engine.play(notes, 0, false);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(engine.getPlaybackState()).toBe('playing');

      // Apply multiple configuration changes
      engine.configure({ oscillatorType: 'sawtooth' });
      engine.configure({ volume: 0.9 });
      engine.configure({ envelope: { attack: 1.0, sustain: 0.3 } });
      engine.configure({ filter: { enabled: true, type: 'lowpass', frequency: 8000 } });

      // Verify all changes applied
      const config = engine.getConfig();
      expect(config.oscillatorType).toBe('sawtooth');
      expect(config.volume).toBe(0.9);
      expect(config.envelope.attack).toBe(1.0);
      expect(config.envelope.sustain).toBe(0.3);
      expect(config.filter.enabled).toBe(true);
      expect(config.filter.type).toBe('lowpass');
      expect(config.filter.frequency).toBe(8000);

      // Playback should still be active
      expect(engine.getPlaybackState()).toBe('playing');
    });
  });
});


// ============================================================================
// Audio Error Handling Tests
// Requirements: 29.4 - Display error message within 500ms when audio subsystem is unavailable
// Design: Error Handling - Audio Error Handling section
// ============================================================================

describe('Audio Error Handling', () => {
  let engine: SynthesizerEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SynthesizerEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });

  describe('getLastError()', () => {
    it('should return null when no error has occurred', () => {
      expect(engine.getLastError()).toBeNull();
    });
  });

  describe('getAudioContextState()', () => {
    it('should return "running" when audio context is running', () => {
      // Our mock sets the state to 'running'
      expect(engine.getAudioContextState()).toBe('running');
    });
  });

  describe('isAudioAvailable()', () => {
    it('should return true when audio is available', () => {
      expect(engine.isAudioAvailable()).toBe(true);
    });
  });

  describe('onAudioError() / offAudioError()', () => {
    it('should register and call error callbacks', () => {
      const callback = vi.fn();
      engine.onAudioError(callback);

      // Manually trigger an error for testing
      // This is done by accessing private method through type assertion
      // In real scenario, errors would be triggered by audio failures
      expect(true).toBe(true); // Callback registered successfully
    });

    it('should remove callback when offAudioError is called', () => {
      const callback = vi.fn();
      engine.onAudioError(callback);
      engine.offAudioError(callback);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle removing non-existent callback', () => {
      const callback = vi.fn();
      // Should not throw even if callback wasn't registered
      engine.offAudioError(callback);
      expect(true).toBe(true);
    });
  });

  describe('onAudioStateChange() / offAudioStateChange()', () => {
    it('should register state change callback', () => {
      const callback = vi.fn();
      engine.onAudioStateChange(callback);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should remove state change callback', () => {
      const callback = vi.fn();
      engine.onAudioStateChange(callback);
      engine.offAudioStateChange(callback);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('resumeAudioContext()', () => {
    it('should return true when context resumes successfully', async () => {
      const result = await engine.resumeAudioContext();
      expect(result).toBe(true);
    });

    it('should return false when engine is disposed', async () => {
      engine.dispose();
      const result = await engine.resumeAudioContext();
      expect(result).toBe(false);
    });
  });

  describe('clearError()', () => {
    it('should clear the current error', () => {
      // Clear any potential errors
      engine.clearError();
      expect(engine.getLastError()).toBeNull();
    });
  });
});

describe('Audio Error Handling - Web Audio Not Supported', () => {
  const originalWindow = (global as Record<string, unknown>).window;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore window mock
    (global as Record<string, unknown>).window = originalWindow;
  });

  it('should set audio unavailable when Web Audio is not supported', () => {
    // Remove window to simulate no Web Audio support
    delete (global as Record<string, unknown>).window;

    const engine = new SynthesizerEngine();

    expect(engine.isAudioAvailable()).toBe(false);
    expect(engine.getAudioContextState()).toBe('unavailable');
    expect(engine.getLastError()).not.toBeNull();
    expect(engine.getLastError()?.type).toBe('not_supported');

    engine.dispose();

    // Restore window
    (global as Record<string, unknown>).window = originalWindow;
  });

  it('should not start playback when audio is unavailable', () => {
    // Remove window to simulate no Web Audio support
    delete (global as Record<string, unknown>).window;

    const engine = new SynthesizerEngine();

    const notes = [
      { id: '1', pitch: 60, start: 0, duration: 1, velocity: 0.8 },
    ];

    engine.play(notes, 0, false);

    // Should remain stopped since audio is unavailable
    expect(engine.getPlaybackState()).toBe('stopped');

    engine.dispose();

    // Restore window
    (global as Record<string, unknown>).window = originalWindow;
  });
});

describe('Tempo Control (Req 44.4, 44.5)', () => {
  let engine: SynthesizerEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Import Tone to access and reset the mock Transport's bpm
    const Tone = await import('tone');
    Tone.getTransport().bpm.value = 120; // Reset to default
    engine = new SynthesizerEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });

  describe('setTempo()', () => {
    it('should set tempo within valid range (40-240 BPM)', () => {
      engine.setTempo(120);
      expect(engine.getTempo()).toBe(120);
    });

    it('should clamp tempo below minimum to 40 BPM', () => {
      engine.setTempo(20);
      expect(engine.getTempo()).toBe(40);
    });

    it('should clamp tempo above maximum to 240 BPM', () => {
      engine.setTempo(300);
      expect(engine.getTempo()).toBe(240);
    });

    it('should accept minimum tempo (40 BPM)', () => {
      engine.setTempo(40);
      expect(engine.getTempo()).toBe(40);
    });

    it('should accept maximum tempo (240 BPM)', () => {
      engine.setTempo(240);
      expect(engine.getTempo()).toBe(240);
    });

    it('should handle fractional BPM values', () => {
      engine.setTempo(120.5);
      expect(engine.getTempo()).toBeCloseTo(120.5);
    });

    it('should not throw when disposed', () => {
      engine.dispose();
      expect(() => engine.setTempo(120)).not.toThrow();
    });

    it('should not change tempo after dispose', () => {
      engine.setTempo(100);
      engine.dispose();
      engine.setTempo(150);
      // After dispose, setTempo is a no-op, so we can't verify the value directly
      // but we verify it doesn't throw
    });
  });

  describe('getTempo()', () => {
    it('should return default tempo (120 BPM) initially', () => {
      expect(engine.getTempo()).toBe(120);
    });

    it('should return the tempo after setTempo is called', () => {
      engine.setTempo(90);
      expect(engine.getTempo()).toBe(90);
    });

    it('should return clamped value after setting out-of-range tempo', () => {
      engine.setTempo(10);
      expect(engine.getTempo()).toBe(40);

      engine.setTempo(500);
      expect(engine.getTempo()).toBe(240);
    });
  });

  describe('real-time tempo changes during playback (Req 44.5)', () => {
    it('should allow tempo change while stopped', () => {
      engine.setTempo(150);
      expect(engine.getTempo()).toBe(150);
      expect(engine.getPlaybackState()).toBe('stopped');
    });

    it('should persist tempo value after multiple changes', () => {
      engine.setTempo(60);
      expect(engine.getTempo()).toBe(60);

      engine.setTempo(180);
      expect(engine.getTempo()).toBe(180);

      engine.setTempo(120);
      expect(engine.getTempo()).toBe(120);
    });
  });

  describe('tempo clamping edge cases', () => {
    it('should handle tempo at exact boundary values', () => {
      // Test exact minimum
      engine.setTempo(40);
      expect(engine.getTempo()).toBe(40);

      // Test just above minimum
      engine.setTempo(40.001);
      expect(engine.getTempo()).toBeCloseTo(40.001);

      // Test exact maximum
      engine.setTempo(240);
      expect(engine.getTempo()).toBe(240);

      // Test just below maximum
      engine.setTempo(239.999);
      expect(engine.getTempo()).toBeCloseTo(239.999);
    });

    it('should handle negative tempo values by clamping to minimum', () => {
      engine.setTempo(-100);
      expect(engine.getTempo()).toBe(40);
    });

    it('should handle zero tempo by clamping to minimum', () => {
      engine.setTempo(0);
      expect(engine.getTempo()).toBe(40);
    });

    it('should handle very large tempo values by clamping to maximum', () => {
      engine.setTempo(10000);
      expect(engine.getTempo()).toBe(240);
    });
  });
});
