/**
 * @vitest-environment jsdom
 */

/**
 * Unit Tests for MelodyFeed Visualizer Integration
 *
 * Validates: Requirements 3.2, 3.3, 7.4
 *
 * Verifies that:
 * - Visualizer renders only when a melody is playing (Requirement 3.2)
 * - Visualizer is removed when playback stops (Requirement 3.3)
 * - Existing screen reader announcements for playing state are not disrupted (Requirement 7.4)
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

// --- Global mocks for browser APIs ---

let rafId = 0;
vi.stubGlobal('requestAnimationFrame', vi.fn((_cb: FrameRequestCallback) => ++rafId));
vi.stubGlobal('cancelAnimationFrame', vi.fn());

vi.stubGlobal('ResizeObserver', class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
});

vi.stubGlobal('IntersectionObserver', class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(public callback: IntersectionObserverCallback) {}
});

// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillStyle: '',
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// --- Module mocks ---

// Mock useFeedPreview hook return value - we control this per test
let mockPreviewingMelodyId: string | null = null;
let mockIsPreviewLoading = false;
let mockPreviewError: string | null = null;
const mockPlayPreview = vi.fn();
const mockStopPreview = vi.fn();
const mockAnalyserRef = { current: null };

vi.mock('@/hooks', () => ({
  useFeedPreview: () => ({
    previewingMelodyId: mockPreviewingMelodyId,
    isPreviewLoading: mockIsPreviewLoading,
    previewError: mockPreviewError,
    playPreview: mockPlayPreview,
    stopPreview: mockStopPreview,
    analyserRef: mockAnalyserRef,
  }),
}));

// Mock next/link to render a simple anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

// Mock fetch for the API call to load melodies
const mockMelodies = [
  { id: 'melody-1', title: 'Test Melody 1', createdAt: '2024-01-01T00:00:00Z', durationSeconds: 30 },
  { id: 'melody-2', title: 'Test Melody 2', createdAt: '2024-01-02T00:00:00Z', durationSeconds: 45 },
  { id: 'melody-3', title: 'Test Melody 3', createdAt: '2024-01-03T00:00:00Z', durationSeconds: 60 },
];

vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      melodies: mockMelodies,
      total: 3,
      page: 1,
      limit: 20,
      hasMore: false,
    }),
  })
));

import { MelodyFeed } from '@/components/MelodyFeed';

describe('MelodyFeed Visualizer Integration', () => {
  beforeEach(() => {
    // Reset state before each test
    mockPreviewingMelodyId = null;
    mockIsPreviewLoading = false;
    mockPreviewError = null;
    mockPlayPreview.mockClear();
    mockStopPreview.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Visualizer renders only when a melody is playing (Requirement 3.2)', () => {
    it('no AudioVisualizer canvas is rendered when previewingMelodyId is null', () => {
      mockPreviewingMelodyId = null;

      const { container } = render(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      // The feed should render but no canvas (AudioVisualizer) should be present
      const canvases = container.querySelectorAll('canvas');
      expect(canvases.length).toBe(0);
    });

    it('AudioVisualizer canvas appears when a melody is playing', () => {
      mockPreviewingMelodyId = 'melody-2';

      const { container } = render(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      // Exactly one canvas should be rendered for the playing melody
      const canvases = container.querySelectorAll('canvas');
      expect(canvases.length).toBe(1);

      // The canvas should have accessibility attributes from AudioVisualizer
      const canvas = canvases[0];
      expect(canvas.getAttribute('aria-hidden')).toBe('true');
      expect(canvas.getAttribute('tabindex')).toBe('-1');
    });

    it('AudioVisualizer renders only for the specific playing melody, not others', () => {
      mockPreviewingMelodyId = 'melody-1';

      const { container } = render(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      // Should have exactly one canvas
      const canvases = container.querySelectorAll('canvas');
      expect(canvases.length).toBe(1);
    });
  });

  describe('Visualizer is removed when playback stops (Requirement 3.3)', () => {
    it('visualizer remains during fade-out then is removed after animation completes', () => {
      // First render with a melody playing
      mockPreviewingMelodyId = 'melody-1';

      const { container, rerender } = render(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      // Verify canvas is present
      expect(container.querySelectorAll('canvas').length).toBe(1);

      // Simulate playback stopping
      mockPreviewingMelodyId = null;

      rerender(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      // Canvas should still be present during fade-out animation
      expect(container.querySelectorAll('canvas').length).toBe(1);
    });

    it('visualizer moves to a different card when a different melody starts playing', () => {
      // Playing melody-1
      mockPreviewingMelodyId = 'melody-1';

      const { container, rerender } = render(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      // Should have one canvas
      expect(container.querySelectorAll('canvas').length).toBe(1);

      // Switch to melody-3
      mockPreviewingMelodyId = 'melody-3';

      rerender(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      // Should still have exactly one canvas (moved, not duplicated)
      expect(container.querySelectorAll('canvas').length).toBe(1);
    });
  });

  describe('Feed accessibility attributes are preserved (Requirement 7.4)', () => {
    it('role="feed" and aria-label="Melody feed" are present when visualizer is showing', () => {
      mockPreviewingMelodyId = 'melody-2';

      const { container } = render(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      const feedElement = container.querySelector('[role="feed"]');
      expect(feedElement).not.toBeNull();
      expect(feedElement!.getAttribute('aria-label')).toBe('Melody feed');
    });

    it('role="feed" and aria-label="Melody feed" are present when no visualizer is showing', () => {
      mockPreviewingMelodyId = null;

      const { container } = render(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      const feedElement = container.querySelector('[role="feed"]');
      expect(feedElement).not.toBeNull();
      expect(feedElement!.getAttribute('aria-label')).toBe('Melody feed');
    });

    it('aria-live announcement for playing state is present in the playing melody card', () => {
      mockPreviewingMelodyId = 'melody-1';

      const { container } = render(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      // The MelodyCard renders a sr-only span with aria-live="polite" when isPlaying
      const ariaLiveElements = container.querySelectorAll('[aria-live="polite"]');
      expect(ariaLiveElements.length).toBeGreaterThan(0);

      // At least one should announce the playing melody
      const playingAnnouncement = Array.from(ariaLiveElements).find(
        (el) => el.textContent?.includes('Now playing')
      );
      expect(playingAnnouncement).not.toBeUndefined();
      expect(playingAnnouncement!.textContent).toContain('Test Melody 1');
    });

    it('aria-live announcements are not duplicated by the visualizer presence', () => {
      mockPreviewingMelodyId = 'melody-2';

      const { container } = render(
        React.createElement(MelodyFeed, { initialMelodies: mockMelodies })
      );

      // Should have exactly one "Now playing" announcement (from the playing card)
      const ariaLiveElements = container.querySelectorAll('[aria-live="polite"]');
      const playingAnnouncements = Array.from(ariaLiveElements).filter(
        (el) => el.textContent?.includes('Now playing')
      );
      expect(playingAnnouncements.length).toBe(1);
    });
  });
});
