/**
 * @vitest-environment jsdom
 */

/**
 * Unit Tests for AudioVisualizer Accessibility Attributes
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 *
 * Verifies that the AudioVisualizer canvas element:
 * - Has aria-hidden="true" (Requirement 7.1)
 * - Has tabindex="-1" (Requirement 7.2)
 * - Contains no ARIA live regions, roles, or labels (Requirement 7.3)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

// Mock requestAnimationFrame / cancelAnimationFrame
let rafId = 0;
vi.stubGlobal('requestAnimationFrame', vi.fn((_cb: FrameRequestCallback) => ++rafId));
vi.stubGlobal('cancelAnimationFrame', vi.fn());

// Mock ResizeObserver
vi.stubGlobal('ResizeObserver', class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
});

// Mock IntersectionObserver
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

import { AudioVisualizer } from '@/components/AudioVisualizer';

describe('AudioVisualizer Accessibility Attributes', () => {
  const mockAnalyserRef = { current: null } as React.RefObject<null>;

  afterEach(() => {
    cleanup();
  });

  it('canvas element has aria-hidden="true" (Requirement 7.1)', () => {
    const { container } = render(
      React.createElement(AudioVisualizer, { analyserRef: mockAnalyserRef })
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas!.getAttribute('aria-hidden')).toBe('true');
  });

  it('canvas element has tabindex="-1" (Requirement 7.2)', () => {
    const { container } = render(
      React.createElement(AudioVisualizer, { analyserRef: mockAnalyserRef })
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas!.getAttribute('tabindex')).toBe('-1');
  });

  it('no elements have a role attribute (Requirement 7.3)', () => {
    const { container } = render(
      React.createElement(AudioVisualizer, { analyserRef: mockAnalyserRef })
    );

    const elementsWithRole = container.querySelectorAll('[role]');
    expect(elementsWithRole.length).toBe(0);
  });

  it('no elements have an aria-live attribute (Requirement 7.3)', () => {
    const { container } = render(
      React.createElement(AudioVisualizer, { analyserRef: mockAnalyserRef })
    );

    const elementsWithAriaLive = container.querySelectorAll('[aria-live]');
    expect(elementsWithAriaLive.length).toBe(0);
  });

  it('canvas has no aria-label or aria-labelledby attributes (Requirement 7.3)', () => {
    const { container } = render(
      React.createElement(AudioVisualizer, { analyserRef: mockAnalyserRef })
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas!.getAttribute('aria-label')).toBeNull();
    expect(canvas!.getAttribute('aria-labelledby')).toBeNull();
  });
});
