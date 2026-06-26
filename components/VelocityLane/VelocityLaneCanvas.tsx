'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { VelocityLaneCanvasProps, VelocityRenderDimensions } from './types';
import { VELOCITY_LANE_CONFIG } from './constants';
import {
  setupCanvas,
  renderVelocityBars,
  renderBaseline,
  renderScaleIndicator,
  renderBeatGrid,
  renderPlayhead,
} from './renderers';
import { findBarAtPosition } from './coordinate-utils';
import { useVelocityDrag } from './hooks/useVelocityDrag';

/**
 * Horizontal scroll speed multiplier (beats per pixel of wheel delta).
 * Matches the PianoRoll's scroll behavior.
 */
const SCROLL_SPEED_HORIZONTAL = 0.02;

/**
 * VelocityLaneCanvas component.
 *
 * Renders velocity bars for notes on an HTML5 Canvas, synchronized
 * horizontally with the PianoRollCanvas. Supports single and multi-note
 * velocity editing via drag, selection via click, and horizontal scroll
 * via wheel events.
 *
 * Requirements: 2.1, 3.2, 3.3, 4.1, 4.3, 4.4, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 9.1, 9.2, 9.3
 */
export function VelocityLaneCanvas({
  notes = [],
  selectedNoteIds = new Set(),
  visibleRegion,
  playheadPosition,
  onNoteUpdate,
  onBulkNoteUpdate,
  onVisibleRegionChange,
  onNoteSelect,
  onToggleNoteSelection,
  onDeselectAll,
  className = '',
}: VelocityLaneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // Use velocity drag hook for drag interactions
  const { dragState, startDrag, updateDrag, endDrag } = useVelocityDrag({
    notes,
    selectedNoteIds,
    containerRef,
    onNoteUpdate,
    onBulkNoteUpdate,
  });

  // =========================================================================
  // Rendering
  // =========================================================================

  /**
   * Compute VelocityRenderDimensions from container size.
   * gridX = SCALE_INDICATOR_WIDTH, gridY = 0
   * gridWidth = displayWidth - SCALE_INDICATOR_WIDTH, gridHeight = displayHeight
   */
  const computeDimensions = useCallback(
    (displayWidth: number, displayHeight: number): VelocityRenderDimensions => ({
      displayWidth,
      displayHeight,
      gridX: VELOCITY_LANE_CONFIG.SCALE_INDICATOR_WIDTH,
      gridY: 0,
      gridWidth: displayWidth - VELOCITY_LANE_CONFIG.SCALE_INDICATOR_WIDTH,
      gridHeight: displayHeight,
    }),
    []
  );

  /**
   * Main render function. Clears the canvas and draws all layers in order:
   * beat grid → baseline → velocity bars → scale indicator → playhead
   *
   * Requirements: 9.2, 9.3 - requestAnimationFrame scheduling, re-render on prop changes
   */
  const render = useCallback(() => {
    const result = setupCanvas(canvasRef.current, containerRef.current);
    if (!result) return;

    const { ctx, displayWidth, displayHeight } = result;
    const dimensions = computeDimensions(displayWidth, displayHeight);

    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Fill background
    ctx.fillStyle = VELOCITY_LANE_CONFIG.LANE_BACKGROUND;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Render layers in order
    renderBeatGrid(ctx, dimensions, visibleRegion);
    renderBaseline(ctx, dimensions);
    renderVelocityBars(ctx, dimensions, notes, selectedNoteIds, visibleRegion, dragState);
    renderScaleIndicator(ctx, dimensions);
    renderPlayhead(ctx, dimensions, playheadPosition, visibleRegion);
  }, [notes, selectedNoteIds, visibleRegion, playheadPosition, dragState, computeDimensions]);

  // =========================================================================
  // Canvas setup and resize handling
  // =========================================================================

  useEffect(() => {
    const container = containerRef.current;
    render();

    const handleResize = () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(render);
    };

    window.addEventListener('resize', handleResize);

    let ro: ResizeObserver | null = null;
    if (container) {
      ro = new ResizeObserver(handleResize);
      ro.observe(container);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      ro?.disconnect();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [render]);

  // Re-render on prop changes using requestAnimationFrame
  useEffect(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(render);
  }, [notes, selectedNoteIds, visibleRegion, playheadPosition, render]);

  // =========================================================================
  // Pointer Event Handlers
  // Requirements: 4.1, 6.3, 6.4 - Click for selection, drag for velocity edit
  // =========================================================================

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const displayWidth = rect.width;
      const displayHeight = rect.height;

      const dimensions = computeDimensions(displayWidth, displayHeight);

      // Find if a bar was clicked
      const hitNote = findBarAtPosition(notes, x, y, visibleRegion, dimensions, selectedNoteIds);

      if (hitNote) {
        const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey;

        if (hasModifier) {
          // Ctrl/Shift+click: toggle selection, do NOT start drag
          // Requirement 6.4
          onToggleNoteSelection?.(hitNote.id);
        } else {
          // No modifier: replace selection with this note, then start drag
          // Requirement 6.3
          onNoteSelect?.(hitNote.id);

          // Start drag - pointerY relative to grid area
          const pointerY = y - dimensions.gridY;
          startDrag(hitNote.id, pointerY);
          isDraggingRef.current = true;
          setIsDragging(true);

          // Set pointer capture for reliable drag outside bounds
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }
      } else {
        // Click on empty area: deselect all
        onDeselectAll?.();
      }
    },
    [notes, visibleRegion, selectedNoteIds, computeDimensions, onNoteSelect, onToggleNoteSelection, onDeselectAll, startDrag]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const displayHeight = rect.height;
      const dimensions = computeDimensions(rect.width, displayHeight);

      // pointerY relative to grid area top
      const pointerY = y - dimensions.gridY;
      updateDrag(pointerY);
    },
    [computeDimensions, updateDrag]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      setIsDragging(false);
      endDrag();

      // Release pointer capture
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    },
    [endDrag]
  );

  // =========================================================================
  // Wheel Event Handler
  // Requirement 3.3 - Horizontal scroll syncs with PianoRoll
  // =========================================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (!onVisibleRegionChange) return;

      const { deltaX, deltaY, shiftKey } = e;

      // Horizontal scroll: deltaX, or shift+wheel (vertical wheel with shift)
      const delta = shiftKey
        ? deltaY * SCROLL_SPEED_HORIZONTAL
        : (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) * SCROLL_SPEED_HORIZONTAL;

      const beatSpan = visibleRegion.endBeat - visibleRegion.startBeat;
      const scrollAmount = delta * beatSpan;

      const newStartBeat = visibleRegion.startBeat + scrollAmount;
      const newEndBeat = visibleRegion.endBeat + scrollAmount;

      onVisibleRegionChange({
        startBeat: newStartBeat,
        endBeat: newEndBeat,
        startPitch: visibleRegion.startPitch,
        endPitch: visibleRegion.endPitch,
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [visibleRegion, onVisibleRegionChange]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        aria-label="Velocity lane editor"
        role="img"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: isDragging ? 'ns-resize' : 'default' }}
      />
    </div>
  );
}

export default VelocityLaneCanvas;
