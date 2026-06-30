'use client';

import { useRef, useEffect, useCallback } from 'react';
import type * as Tone from 'tone';

/**
 * Props for the AudioVisualizer component
 *
 * Requirements: 3.1, 3.5, 3.6, 3.7, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.2, 7.3
 */
export interface AudioVisualizerProps {
  /** Reference to the Tone.Analyser node for reading frequency data */
  analyserRef: React.RefObject<Tone.Analyser | null>;
  /** Number of frequency bars to display (default 16 for compact mode) */
  barCount?: number;
  /** Whether audio is actively playing. When false, bars animate down to zero. */
  isPlaying?: boolean;
  /** Height of the visualizer in pixels (default 32 for compact card placement) */
  height?: number;
}

/** Gap between bars in pixels */
const BAR_GAP = 1;

/** Frame budget in milliseconds (Requirement 5.5) */
const FRAME_BUDGET_MS = 16;

/** Decay factor per frame for fade-out animation (0-1, lower = slower decay) */
const DECAY_FACTOR = 0.88;

/** Number of frames to hold peak before decaying */
const PEAK_HOLD_FRAMES = 8;

/** Peak indicator height in pixels */
const PEAK_HEIGHT = 2;

/** Peak decay rate per frame */
const PEAK_DECAY = 0.92;

/**
 * Normalize a dB value (typically -100 to 0) to 0-255 range.
 * Design document formula: Math.max(0, Math.min(255, ((dbValue + 100) / 100) * 255))
 */
export function normalizeDb(dbValue: number): number {
  return Math.max(0, Math.min(255, ((dbValue + 100) / 100) * 255));
}

/**
 * Calculate bar height from normalized amplitude value.
 * Formula: (amplitude / 255) * canvasHeight
 *
 * Requirements: 3.7, 3.8
 */
export function calculateBarHeight(amplitude: number, canvasHeight: number): number {
  return (amplitude / 255) * canvasHeight;
}

/**
 * AudioVisualizer component
 *
 * Compact canvas-based audio visualizer rendering frequency bars.
 * Designed to fit inline within a MelodyCard near the play/stop button.
 * Uses requestAnimationFrame for smooth animation.
 * When isPlaying transitions to false, bars smoothly decay to zero.
 *
 * Requirements:
 * - 3.1: Render animated frequency bars
 * - 3.5: Display frequency bars evenly spaced
 * - 3.6: Update at display refresh rate using requestAnimationFrame
 * - 3.7: Bars scaled proportionally to frequency amplitude
 * - 3.8: Silence renders all bars at zero height
 * - 5.1: Complete canvas draw within 16ms
 * - 5.2: Use canvas element for rendering
 * - 5.3: Pause animation when fully off-screen (0% intersection)
 * - 5.4: Resume animation immediately when transitioning to visible
 * - 5.5: Skip frame visual update if render exceeds budget
 * - 7.1: aria-hidden="true"
 * - 7.2: tabindex="-1"
 * - 7.3: No ARIA live regions, roles, or labels
 */
export function AudioVisualizer({
  analyserRef,
  barCount = 16,
  isPlaying = true,
  height = 32,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const lastFrameTimeRef = useRef<number>(0);
  /** Stores current bar amplitudes for smooth decay animation */
  const barAmplitudesRef = useRef<Float32Array>(new Float32Array(barCount));
  /** Peak amplitudes for peak hold effect */
  const peakAmplitudesRef = useRef<Float32Array>(new Float32Array(barCount));
  /** Frames since peak was set (for hold timer) */
  const peakHoldCountersRef = useRef<Uint8Array>(new Uint8Array(barCount));
  /** Track playing state in a ref so the draw loop can access it without re-creating */
  const isPlayingRef = useRef<boolean>(isPlaying);

  // Keep the ref in sync with the prop
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const startAnimationLoop = useCallback(() => {
    if (animationFrameIdRef.current !== null) return;
    if (!isVisibleRef.current) return;

    const draw = (timestamp: number) => {
      if (!isVisibleRef.current) {
        animationFrameIdRef.current = null;
        return;
      }

      const canvas = canvasRef.current;
      const analyser = analyserRef.current;

      if (!canvas) {
        animationFrameIdRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameIdRef.current = requestAnimationFrame(draw);
        return;
      }

      // Frame skip logic
      const delta = timestamp - lastFrameTimeRef.current;
      if (lastFrameTimeRef.current > 0 && delta > FRAME_BUDGET_MS * 2) {
        lastFrameTimeRef.current = timestamp;
        animationFrameIdRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      const canvasWidth = canvas.width / (window.devicePixelRatio || 1);
      const canvasHeight = canvas.height / (window.devicePixelRatio || 1);
      const barWidth = canvasWidth / barCount;
      const amplitudes = barAmplitudesRef.current;
      const peaks = peakAmplitudesRef.current;
      const peakCounters = peakHoldCountersRef.current;

      if (isPlayingRef.current && analyser) {
        // Read live frequency data
        const frequencyData = analyser.getValue();
        const dataLength = (frequencyData as Float32Array).length;
        // Skip bin 0 (DC offset) — start from bin 1
        const usableLength = dataLength - 1;
        for (let i = 0; i < barCount; i++) {
          // Logarithmic mapping over usable bins (excluding DC offset)
          const logMin = Math.log(1);
          const logMax = Math.log(usableLength);
          const startBin = Math.floor(Math.exp(logMin + (logMax - logMin) * (i / barCount))) + 1;
          const endBin = Math.floor(Math.exp(logMin + (logMax - logMin) * ((i + 1) / barCount))) + 1;
          const binStart = Math.min(startBin, dataLength - 1);
          const binEnd = Math.min(Math.max(endBin, binStart + 1), dataLength);

          // Average the frequency bins in this range for a smoother result
          let sum = 0;
          for (let j = binStart; j < binEnd; j++) {
            sum += (frequencyData as Float32Array)[j] ?? -100;
          }
          const dbValue = sum / (binEnd - binStart);
          const targetAmplitude = normalizeDb(dbValue);
          // Direct assignment — analyser smoothing (0.1) handles jitter
          amplitudes[i] = targetAmplitude;

          // Peak hold logic
          if (amplitudes[i] >= peaks[i]) {
            peaks[i] = amplitudes[i];
            peakCounters[i] = 0;
          } else {
            peakCounters[i]++;
            if (peakCounters[i] > PEAK_HOLD_FRAMES) {
              peaks[i] *= PEAK_DECAY;
            }
          }
        }
      } else {
        // Decay animation: smoothly reduce all bars toward zero
        let allZero = true;
        for (let i = 0; i < barCount; i++) {
          amplitudes[i] *= DECAY_FACTOR;
          peaks[i] *= DECAY_FACTOR;
          if (amplitudes[i] < 0.5) {
            amplitudes[i] = 0;
            peaks[i] = 0;
          } else {
            allZero = false;
          }
        }
        // Once all bars reach zero, stop the loop
        if (allZero) {
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
          animationFrameIdRef.current = null;
          return;
        }
      }

      // Clear and draw
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      for (let i = 0; i < barCount; i++) {
        const barHeight = calculateBarHeight(amplitudes[i], canvasHeight);
        const x = i * barWidth;
        const y = canvasHeight - barHeight;
        const drawWidth = Math.max(1, barWidth - BAR_GAP);

        if (barHeight > 0.5) {
          // Gradient consistent with app's indigo theme:
          // Low amplitude: dim indigo (indigo-900) -> Mid: indigo-500 -> High: violet-400
          const ratio = amplitudes[i] / 255;
          let r: number, g: number, b: number;
          if (ratio < 0.5) {
            // indigo-900 (49,46,129) -> indigo-500 (99,102,241)
            const t = ratio * 2;
            r = Math.round(49 + t * (99 - 49));
            g = Math.round(46 + t * (102 - 46));
            b = Math.round(129 + t * (241 - 129));
          } else {
            // indigo-500 (99,102,241) -> violet-400 (167,139,250)
            const t = (ratio - 0.5) * 2;
            r = Math.round(99 + t * (167 - 99));
            g = Math.round(102 + t * (139 - 102));
            b = Math.round(241 + t * (250 - 241));
          }
          ctx.fillStyle = `rgb(${r},${g},${b})`;

          const radius = Math.min(2, drawWidth / 2);
          ctx.beginPath();
          ctx.roundRect(x, y, drawWidth, barHeight, [radius, radius, 0, 0]);
          ctx.fill();
        }

        // Draw peak indicator
        const peakY = canvasHeight - calculateBarHeight(peaks[i], canvasHeight);
        if (peaks[i] > 1 && peakY < canvasHeight - PEAK_HEIGHT) {
          ctx.fillStyle = 'rgba(165, 180, 252, 0.7)'; // indigo-300 with transparency
          ctx.fillRect(x, peakY, drawWidth, PEAK_HEIGHT);
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(draw);
    };

    animationFrameIdRef.current = requestAnimationFrame(draw);
  }, [analyserRef, barCount]);

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  }, []);

  /**
   * Restart the animation loop when isPlaying changes.
   * When stopping, the loop continues until bars decay to zero.
   */
  useEffect(() => {
    // Always ensure the loop is running when the playing state changes
    // (either to animate live data or to run the decay animation)
    startAnimationLoop();
  }, [isPlaying, startAnimationLoop]);

  // ResizeObserver for canvas sizing (with devicePixelRatio for sharp rendering)
  // Also listens to window resize as fallback for zoom changes where
  // ResizeObserver may not fire (e.g., zoom out without container size change).
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      if (width === 0) return;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    resizeObserver.observe(container);

    // Fallback for zoom changes that may not trigger ResizeObserver
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [height]);

  // IntersectionObserver for off-screen pause
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (typeof IntersectionObserver === 'undefined') {
      isVisibleRef.current = true;
      startAnimationLoop();
      return () => { stopAnimationLoop(); };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio === 0) {
            isVisibleRef.current = false;
            stopAnimationLoop();
          } else {
            isVisibleRef.current = true;
            startAnimationLoop();
          }
        }
      },
      { threshold: 0 }
    );

    observer.observe(container);
    startAnimationLoop();

    return () => {
      observer.disconnect();
      stopAnimationLoop();
    };
  }, [startAnimationLoop, stopAnimationLoop]);

  return (
    <div ref={containerRef} className="w-full" style={{ height: `${height}px` }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        tabIndex={-1}
        className="block w-full"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}

export default AudioVisualizer;
