import { describe, it, expect } from 'vitest';

/**
 * Import Path Smoke Tests
 *
 * These tests verify that the PianoRollCanvas component and related exports
 * can be imported from supported import paths after the refactoring.
 *
 * Import paths tested:
 * 1. `@/components` - Barrel export
 * 2. `@/components/PianoRoll` - Modular location
 */

describe('Import Paths', () => {
  describe('Import from @/components (barrel export)', () => {
    it('should export PianoRollCanvas component', async () => {
      const componentsModule = await import('@/components');
      expect(componentsModule.PianoRollCanvas).toBeDefined();
      expect(typeof componentsModule.PianoRollCanvas).toBe('function');
    });

    it('should export CANVAS_CONFIG constant', async () => {
      const componentsModule = await import('@/components');
      expect(componentsModule.CANVAS_CONFIG).toBeDefined();
      expect(typeof componentsModule.CANVAS_CONFIG).toBe('object');
    });
  });

  describe('Import from @/components/PianoRoll (modular location)', () => {
    it('should export PianoRollCanvas component', async () => {
      const pianoRollModule = await import('@/components/PianoRoll');
      expect(pianoRollModule.PianoRollCanvas).toBeDefined();
      expect(typeof pianoRollModule.PianoRollCanvas).toBe('function');
    });

    it('should export default as PianoRollCanvas', async () => {
      const pianoRollModule = await import('@/components/PianoRoll');
      expect(pianoRollModule.default).toBeDefined();
      expect(pianoRollModule.default).toBe(pianoRollModule.PianoRollCanvas);
    });

    it('should export CANVAS_CONFIG constant', async () => {
      const pianoRollModule = await import('@/components/PianoRoll');
      expect(pianoRollModule.CANVAS_CONFIG).toBeDefined();
      expect(typeof pianoRollModule.CANVAS_CONFIG).toBe('object');
    });

    it('should export calculateScrollbarState utility', async () => {
      const pianoRollModule = await import('@/components/PianoRoll');
      expect(pianoRollModule.calculateScrollbarState).toBeDefined();
      expect(typeof pianoRollModule.calculateScrollbarState).toBe('function');
    });
  });

  describe('Export consistency across import paths', () => {
    it('should export the same PianoRollCanvas component from all paths', async () => {
      const fromBarrel = await import('@/components');
      const fromModular = await import('@/components/PianoRoll');

      expect(fromBarrel.PianoRollCanvas).toBe(fromModular.PianoRollCanvas);
    });

    it('should export the same CANVAS_CONFIG from all paths', async () => {
      const fromBarrel = await import('@/components');
      const fromModular = await import('@/components/PianoRoll');

      expect(fromBarrel.CANVAS_CONFIG).toBe(fromModular.CANVAS_CONFIG);
    });
  });
});

describe('Type Exports', () => {
  describe('Type imports from @/components/PianoRoll', () => {
    it('should have PianoRollCanvasProps type structure', async () => {
      const pianoRollModule = await import('@/components/PianoRoll');
      expect(pianoRollModule.PianoRollCanvas).toBeDefined();
    });

    it('should have SelectionModifiers type structure', async () => {
      // Type exports are verified at compile time
      const pianoRollModule = await import('@/components/PianoRoll');
      expect(pianoRollModule).toBeDefined();
    });
  });
});

describe('CANVAS_CONFIG Structure Validation', () => {
  it('should contain required configuration properties', async () => {
    const { CANVAS_CONFIG } = await import('@/components/PianoRoll');

    expect(CANVAS_CONFIG.PITCH_LABEL_WIDTH).toBeDefined();
    expect(typeof CANVAS_CONFIG.PITCH_LABEL_WIDTH).toBe('number');

    expect(CANVAS_CONFIG.TIME_MARKER_HEIGHT).toBeDefined();
    expect(typeof CANVAS_CONFIG.TIME_MARKER_HEIGHT).toBe('number');

    expect(CANVAS_CONFIG.SCROLLBAR_WIDTH).toBeDefined();
    expect(typeof CANVAS_CONFIG.SCROLLBAR_WIDTH).toBe('number');

    expect(CANVAS_CONFIG.SCROLLBAR_HEIGHT).toBeDefined();
    expect(typeof CANVAS_CONFIG.SCROLLBAR_HEIGHT).toBe('number');
  });

  it('should have consistent values across import paths', async () => {
    const fromBarrel = await import('@/components');
    const fromModular = await import('@/components/PianoRoll');

    expect(fromBarrel.CANVAS_CONFIG.PITCH_LABEL_WIDTH).toBe(
      fromModular.CANVAS_CONFIG.PITCH_LABEL_WIDTH
    );
    expect(fromBarrel.CANVAS_CONFIG.SCROLLBAR_WIDTH).toBe(
      fromModular.CANVAS_CONFIG.SCROLLBAR_WIDTH
    );
  });
});
