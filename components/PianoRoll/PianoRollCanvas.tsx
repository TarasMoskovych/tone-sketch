'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { VisibleRegion } from '@/types/grid';
import type { Note } from '@/types/note';
import { snapPosition, getMinimumDuration } from '@/utils/grid-snap';
import { useKeyboardShortcuts } from '@/hooks';
import { isPlatformModifierKey, getNoteRange, calculateGroupMoveConstraints } from '@/lib/selection-utils';
import { CANVAS_CONFIG, DEFAULT_GRID_SNAP_CONFIG, DEFAULT_VISIBLE_REGION } from './constants';
import type { PianoRollCanvasProps } from './types';
import { constrainVisibleRegion } from './coordinate-utils';
import { setupCanvas, renderGrid, renderNotes, renderPlayhead, renderPitchLabels, renderTimeMarkers, renderScrollbars, renderMarquee, calculateRenderDimensions } from './renderers';
import { findNoteAtPosition, findNoteAtPixelPosition, isClickOnExistingNote, getScrollbarAtPosition } from './event-utils';
import { getTouchDistance, getTouchCenter } from './touch-utils';
import { useDragState } from './hooks/useDragState';
import { useMarqueeSelection } from './hooks/useMarqueeSelection';

const {
  PITCH_LABEL_WIDTH,
  TIME_MARKER_HEIGHT,
  SCROLLBAR_WIDTH,
  SCROLLBAR_HEIGHT,
  SCROLL_SPEED_HORIZONTAL,
  SCROLL_SPEED_VERTICAL,
  ZOOM_FACTOR,
  MIN_VISIBLE_BEATS,
  MAX_VISIBLE_BEATS,
  MIN_VISIBLE_SEMITONES,
  MAX_VISIBLE_SEMITONES,
  TOTAL_BEATS,
  GRID_BACKGROUND,
} = CANVAS_CONFIG;

export function PianoRollCanvas({
  notes = [],
  selectedNoteIds = new Set(),
  visibleRegion: controlledVisibleRegion,
  playheadPosition,
  gridSnap = DEFAULT_GRID_SNAP_CONFIG,
  totalBeats: totalBeatsProp,
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete,
  onNoteSelect,
  onToggleNoteSelection,
  onAddToSelection,
  onDeselectAll,
  onSetSelectionAnchor,
  selectionAnchor,
  onBulkNoteUpdate,
  onVisibleRegionChange,
  onPlayheadChange,
  onTogglePlayback,
  keyboardShortcutsEnabled = true,
  onSelectAll,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
   
  highlightedPitch: _highlightedPitch = undefined,
  activePitches = new Set(),
  autoScrollDuringPlayback = true,
  isPlaying = false,
  className = '',
}: PianoRollCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const prevPlayheadRef = useRef<number | undefined>(undefined);
  const lastTouchDistRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);

  const effectiveTotalBeats = useMemo(() => {
    if (totalBeatsProp !== undefined) return totalBeatsProp;
    if (notes.length === 0) return TOTAL_BEATS;
    const maxEnd = Math.max(...notes.map(n => n.start + n.duration));
    return Math.max(TOTAL_BEATS, Math.ceil(maxEnd / 16) * 16 + 16);
  }, [totalBeatsProp, notes]);

  const playingPitches = useMemo(() => {
    const p = new Set<number>();
    if (!isPlaying || playheadPosition === undefined) return p;
    for (const n of notes) {
      if (playheadPosition >= n.start && playheadPosition < n.start + n.duration) {
        p.add(n.pitch);
      }
    }
    return p;
  }, [notes, isPlaying, playheadPosition]);

  const [internalVisibleRegion, setInternalVisibleRegion] = useState<VisibleRegion>(DEFAULT_VISIBLE_REGION);
  const [isOverResizeHandle, setIsOverResizeHandle] = useState(false);
  const [isOverTimeline, setIsOverTimeline] = useState(false);
  const [isOverScrollbar, setIsOverScrollbar] = useState<'horizontal' | 'vertical' | null>(null);
  const visibleRegion = controlledVisibleRegion ?? internalVisibleRegion;

  const updateVisibleRegion = useCallback((r: VisibleRegion) => {
    if (onVisibleRegionChange) {
      onVisibleRegionChange(r);
    } else {
      setInternalVisibleRegion(r);
    }
  }, [onVisibleRegionChange]);

  const { dragState, startNoteDrag, endNoteDrag, cancelNoteDrag, scrollbarDragState, startScrollbarDrag, updateScrollbarDrag, endScrollbarDrag, justFinishedDragRef } = useDragState({
    notes,
    selectedNoteIds,
    visibleRegion,
    gridSnap,
    containerRef,
    effectiveTotalBeats,
    onNoteUpdate,
    onBulkNoteUpdate,
    onVisibleRegionChange: updateVisibleRegion,
  });

  const { marqueeState, startMarquee, updateMarquee, endMarquee, cancelMarquee } = useMarqueeSelection({
    notes,
    selectedNoteIds,
    visibleRegion,
    containerRef,
    onAddToSelection,
    onDeselectAll,
  });

  const handleDeleteShortcut = useCallback(() => {
    if (onNoteDelete) {
      for (const id of selectedNoteIds) {
        onNoteDelete(id);
      }
    }
  }, [onNoteDelete, selectedNoteIds]);

  const handlePlaybackShortcut = useCallback(() => onTogglePlayback?.(), [onTogglePlayback]);
  useKeyboardShortcuts({ enabled: keyboardShortcutsEnabled, onTogglePlayback: handlePlaybackShortcut, onDeleteNote: handleDeleteShortcut, onSelectAll, onCopy, onCut, onPaste, onDuplicate, isDragging: !!dragState || !!marqueeState, containerRef });

  // Auto-scroll during playback
  useEffect(() => {
    if (!autoScrollDuringPlayback || !isPlaying || playheadPosition === undefined) {
      prevPlayheadRef.current = playheadPosition;
      return;
    }

    const vBeats = visibleRegion.endBeat - visibleRegion.startBeat;
    const prev = prevPlayheadRef.current;
    const didLoop = prev !== undefined && prev > playheadPosition && (prev - playheadPosition) > 1;
    let newRegion: VisibleRegion | null = null;

    if (didLoop) {
      const start = Math.max(0, playheadPosition - vBeats * 0.1);
      newRegion = {
        startBeat: start,
        endBeat: start + vBeats,
        startPitch: visibleRegion.startPitch,
        endPitch: visibleRegion.endPitch,
      };
    } else if (playheadPosition >= visibleRegion.startBeat + vBeats * 0.8) {
      const start = Math.max(0, playheadPosition - vBeats * 0.2);
      if (Math.abs(start - visibleRegion.startBeat) > 0.1) {
        newRegion = {
          startBeat: start,
          endBeat: start + vBeats,
          startPitch: visibleRegion.startPitch,
          endPitch: visibleRegion.endPitch,
        };
      }
    }

    prevPlayheadRef.current = playheadPosition;

    if (newRegion) {
      const frameId = requestAnimationFrame(() => updateVisibleRegion(newRegion));
      return () => cancelAnimationFrame(frameId);
    }
  }, [autoScrollDuringPlayback, isPlaying, playheadPosition, visibleRegion, updateVisibleRegion]);

  // Wheel handler for scroll/zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const { deltaY, deltaX } = e;
    const beatSpan = visibleRegion.endBeat - visibleRegion.startBeat;
    const pitchSpan = visibleRegion.endPitch - visibleRegion.startPitch;

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const gw = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
      const gh = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
      const mx = e.clientX - rect.left - PITCH_LABEL_WIDTH;
      const my = e.clientY - rect.top - TIME_MARKER_HEIGHT;
      const xR = Math.max(0, Math.min(1, mx / gw));
      const yR = Math.max(0, Math.min(1, my / gh));
      const zf = 1 + deltaY * ZOOM_FACTOR * 0.01;
      const newBS = Math.max(MIN_VISIBLE_BEATS, Math.min(MAX_VISIBLE_BEATS, beatSpan * zf));
      const newPS = Math.round(Math.max(MIN_VISIBLE_SEMITONES, Math.min(MAX_VISIBLE_SEMITONES, pitchSpan * zf)));
      const bm = visibleRegion.startBeat + xR * beatSpan;
      const pm = visibleRegion.endPitch - yR * pitchSpan;

      updateVisibleRegion(constrainVisibleRegion({
        startBeat: bm - xR * newBS,
        endBeat: bm - xR * newBS + newBS,
        startPitch: pm + yR * newPS - newPS,
        endPitch: pm + yR * newPS,
      }));
    } else if (e.shiftKey) {
      // Vertical scroll
      const d = deltaY * SCROLL_SPEED_VERTICAL;
      updateVisibleRegion(constrainVisibleRegion({
        startBeat: visibleRegion.startBeat,
        endBeat: visibleRegion.endBeat,
        startPitch: visibleRegion.startPitch - d,
        endPitch: visibleRegion.endPitch - d,
      }));
    } else {
      // Horizontal scroll
      const d = (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) * SCROLL_SPEED_HORIZONTAL;
      updateVisibleRegion(constrainVisibleRegion({
        startBeat: visibleRegion.startBeat + d,
        endBeat: visibleRegion.endBeat + d,
        startPitch: visibleRegion.startPitch,
        endPitch: visibleRegion.endPitch,
      }));
    }
  }, [visibleRegion, updateVisibleRegion]);

  // Touch handlers for pinch-to-zoom
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      lastTouchDistRef.current = getTouchDistance(e.touches);
      lastTouchCenterRef.current = getTouchCenter(e.touches);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 2 || !lastTouchDistRef.current) return;
    e.preventDefault();

    const cd = getTouchDistance(e.touches);
    const cc = getTouchCenter(e.touches);
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const gw = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gh = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
    const zf = lastTouchDistRef.current / cd;
    const bs = visibleRegion.endBeat - visibleRegion.startBeat;
    const ps = visibleRegion.endPitch - visibleRegion.startPitch;
    const nbs = Math.max(MIN_VISIBLE_BEATS, Math.min(MAX_VISIBLE_BEATS, bs * zf));
    const nps = Math.round(Math.max(MIN_VISIBLE_SEMITONES, Math.min(MAX_VISIBLE_SEMITONES, ps * zf)));
    const cx = cc.x - rect.left - PITCH_LABEL_WIDTH;
    const cy = cc.y - rect.top - TIME_MARKER_HEIGHT;
    const xR = Math.max(0, Math.min(1, cx / gw));
    const yR = Math.max(0, Math.min(1, cy / gh));
    const bm = visibleRegion.startBeat + xR * bs;
    const pm = visibleRegion.endPitch - yR * ps;

    updateVisibleRegion(constrainVisibleRegion({
      startBeat: bm - xR * nbs,
      endBeat: bm - xR * nbs + nbs,
      startPitch: pm + yR * nps - nps,
      endPitch: pm + yR * nps,
    }));

    lastTouchDistRef.current = cd;
    lastTouchCenterRef.current = cc;
  }, [visibleRegion, updateVisibleRegion]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistRef.current = null;
    lastTouchCenterRef.current = null;
  }, []);

  // Mouse down handler
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;

    const container = containerRef.current;
    if (!container) return;

    // Ensure the canvas retains focus for keyboard shortcuts (Ctrl+C/V/X/D, Space, Delete).
    // preventDefault() below prevents the browser's default focus behavior,
    // so we explicitly focus the canvas element.
    const canvas = canvasRef.current;
    if (canvas && document.activeElement !== canvas) {
      canvas.focus();
    }

    const rect = container.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Check scrollbar hit
    const scrollbarHit = getScrollbarAtPosition(cx, cy, rect.width, rect.height, visibleRegion, effectiveTotalBeats);
    if (scrollbarHit) {
      startScrollbarDrag(scrollbarHit, scrollbarHit === 'horizontal' ? cx : cy);
      e.preventDefault();
      return;
    }

    // Ignore clicks outside grid area
    if (cx < PITCH_LABEL_WIDTH || cy < TIME_MARKER_HEIGHT || cx > rect.width - SCROLLBAR_WIDTH || cy > rect.height - SCROLLBAR_HEIGHT) {
      return;
    }

    // Check if clicking on a note
    const result = findNoteAtPixelPosition(notes, cx, cy, rect.width, rect.height, visibleRegion);

    if (result && onNoteUpdate) {
      const { note, isResize } = result;
      const isSelected = selectedNoteIds.has(note.id);
      const isGroup = isSelected && selectedNoteIds.size > 1 && !isResize;
      const origNotes = new Map<string, Note>();

      if (isGroup) {
        for (const id of selectedNoteIds) {
          const n = notes.find(x => x.id === id);
          if (n) origNotes.set(id, { ...n });
        }
      }

      startNoteDrag(note, cx, cy, isResize, isGroup, origNotes);
      e.preventDefault();
    } else {
      startMarquee(cx, cy, isPlatformModifierKey(e.nativeEvent), new Set(selectedNoteIds));
      e.preventDefault();
    }
  }, [notes, visibleRegion, effectiveTotalBeats, selectedNoteIds, onNoteUpdate, startNoteDrag, startScrollbarDrag, startMarquee]);

  // Mouse move handler for dragging
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !onNoteUpdate) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const gw = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gh = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
    const vb = visibleRegion.endBeat - visibleRegion.startBeat;
    const vs = visibleRegion.endPitch - visibleRegion.startPitch;
    const db = ((curX - dragState.startX) / gw) * vb;

    if (dragState.mode === 'resize') {
      const oe = dragState.originalNote.start + dragState.originalNote.duration;
      const ne = snapPosition(oe + db, gridSnap);
      const dur = Math.max(getMinimumDuration(gridSnap), Math.max(0.001, ne - dragState.originalNote.start));
      onNoteUpdate({ ...dragState.note, duration: dur });
    } else if (dragState.isGroupDrag && dragState.originalSelectedNotes.size > 0) {
      const ns = snapPosition(dragState.originalNote.start + db, gridSnap);
      const sdb = ns - dragState.originalNote.start;
      const dp = Math.round(-((curY - dragState.startY) / gh) * vs);
      const sn = Array.from(dragState.originalSelectedNotes.values());
      const { constrainedDeltaBeat: cdb, constrainedDeltaPitch: cdp } = calculateGroupMoveConstraints(sn, sdb, dp);

      if (onBulkNoteUpdate) {
        const u = new Map<string, Partial<Note>>();
        for (const [id, n] of dragState.originalSelectedNotes) {
          u.set(id, { start: n.start + cdb, pitch: n.pitch + cdp });
        }
        onBulkNoteUpdate(u);
      } else {
        for (const [, n] of dragState.originalSelectedNotes) {
          onNoteUpdate({ ...n, start: n.start + cdb, pitch: n.pitch + cdp });
        }
      }
    } else {
      const ns = Math.max(0, snapPosition(dragState.originalNote.start + db, gridSnap));
      const np = Math.max(0, Math.min(127, Math.round(dragState.originalNote.pitch - ((curY - dragState.startY) / gh) * vs)));
      onNoteUpdate({ ...dragState.note, start: ns, pitch: np });
    }
  }, [dragState, onNoteUpdate, onBulkNoteUpdate, visibleRegion, gridSnap]);

  // Canvas mouse move for hover states
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragState || scrollbarDragState || marqueeState) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check scrollbar hover
    const sbHover = getScrollbarAtPosition(mx, my, rect.width, rect.height, visibleRegion, effectiveTotalBeats);
    if (sbHover) {
      setIsOverScrollbar(sbHover);
      setIsOverTimeline(false);
      setIsOverResizeHandle(false);
      return;
    }
    setIsOverScrollbar(null);

    // Check timeline hover
    const ot = my < TIME_MARKER_HEIGHT && mx >= PITCH_LABEL_WIDTH && mx <= rect.width - SCROLLBAR_WIDTH;
    setIsOverTimeline(ot);
    if (ot) {
      setIsOverResizeHandle(false);
      return;
    }

    // Outside grid area
    if (mx < PITCH_LABEL_WIDTH || my < TIME_MARKER_HEIGHT || mx > rect.width - SCROLLBAR_WIDTH || my > rect.height - SCROLLBAR_HEIGHT) {
      setIsOverResizeHandle(false);
      return;
    }

    // Check note resize handle hover
    const r = findNoteAtPixelPosition(notes, mx, my, rect.width, rect.height, visibleRegion);
    setIsOverResizeHandle(r?.isResize ?? false);
  }, [dragState, scrollbarDragState, marqueeState, notes, visibleRegion, effectiveTotalBeats]);

  const handleCanvasMouseLeave = useCallback(() => {
    if (!dragState && !scrollbarDragState) {
      setIsOverResizeHandle(false);
      setIsOverTimeline(false);
      setIsOverScrollbar(null);
    }
  }, [dragState, scrollbarDragState]);

  // Context menu handler (right-click delete)
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!onNoteDelete) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (cx < PITCH_LABEL_WIDTH || cy < TIME_MARKER_HEIGHT || cx > rect.width - SCROLLBAR_WIDTH || cy > rect.height - SCROLLBAR_HEIGHT) {
      return;
    }

    const r = findNoteAtPixelPosition(notes, cx, cy, rect.width, rect.height, visibleRegion);
    if (r) {
      if (selectedNoteIds.has(r.note.id)) {
        for (const id of selectedNoteIds) onNoteDelete(id);
        onDeselectAll?.();
      } else {
        onNoteDelete(r.note.id);
      }
    }
  }, [notes, visibleRegion, selectedNoteIds, onNoteDelete, onDeselectAll]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    if (dragState) {
      justFinishedDragRef.current = true;
      setTimeout(() => { justFinishedDragRef.current = false; }, 0);
      endNoteDrag();
    }

    if (scrollbarDragState) {
      endScrollbarDrag();
    }

    if (marqueeState) {
      const d = Math.sqrt(
        Math.pow(marqueeState.currentX - marqueeState.startX, 2) +
        Math.pow(marqueeState.currentY - marqueeState.startY, 2)
      );
      if (d >= 5) {
        justFinishedDragRef.current = true;
        setTimeout(() => { justFinishedDragRef.current = false; }, 0);
      }
      endMarquee();
    }
  }, [dragState, scrollbarDragState, marqueeState, endNoteDrag, endScrollbarDrag, endMarquee, justFinishedDragRef]);

  // Key down handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (dragState && onNoteUpdate) cancelNoteDrag();
      if (marqueeState) cancelMarquee();
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && onNoteDelete) {
      e.preventDefault();
      for (const id of selectedNoteIds) {
        onNoteDelete(id);
      }
    }
  }, [dragState, marqueeState, onNoteUpdate, onNoteDelete, selectedNoteIds, cancelNoteDrag, cancelMarquee]);

  // Canvas click handler
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || dragState || justFinishedDragRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const gw = rect.width - PITCH_LABEL_WIDTH - SCROLLBAR_WIDTH;
    const gh = rect.height - TIME_MARKER_HEIGHT - SCROLLBAR_HEIGHT;
    const vb = visibleRegion.endBeat - visibleRegion.startBeat;
    const vs = visibleRegion.endPitch - visibleRegion.startPitch;

    // Timeline click
    if (cy < TIME_MARKER_HEIGHT && cx >= PITCH_LABEL_WIDTH && cx <= rect.width - SCROLLBAR_WIDTH) {
      if (onPlayheadChange) {
        onPlayheadChange(Math.max(0, visibleRegion.startBeat + ((cx - PITCH_LABEL_WIDTH) / gw) * vb));
      }
      return;
    }

    // Ignore clicks outside grid area
    if (cx < PITCH_LABEL_WIDTH || cy < TIME_MARKER_HEIGHT || cx > rect.width - SCROLLBAR_WIDTH || cy > rect.height - SCROLLBAR_HEIGHT) {
      return;
    }

    const gx = cx - PITCH_LABEL_WIDTH;
    const gy = cy - TIME_MARKER_HEIGHT;
    const rawBeat = visibleRegion.startBeat + (gx / gw) * vb;
    const rawPitch = visibleRegion.endPitch - (gy / gh) * vs;
    const pitch = Math.floor(rawPitch);

    if (pitch < 0 || pitch > 127) return;

    const clickedNote = findNoteAtPosition(notes, rawBeat, pitch);
    const isCtrl = isPlatformModifierKey(e.nativeEvent);
    const isShift = e.shiftKey;

    if (clickedNote) {
      if (isShift && selectionAnchor && onAddToSelection) {
        onAddToSelection(getNoteRange(notes, selectionAnchor, clickedNote.id));
      } else if (isCtrl && onToggleNoteSelection) {
        onToggleNoteSelection(clickedNote.id);
        onSetSelectionAnchor?.(clickedNote.id);
      } else if (onNoteSelect) {
        onNoteSelect(clickedNote.id);
        onSetSelectionAnchor?.(clickedNote.id);
      }
      return;
    }

    onDeselectAll?.();
    onSetSelectionAnchor?.(null);

    if (!onNoteCreate) return;

    const sb = Math.max(0, snapPosition(rawBeat, gridSnap));
    if (isClickOnExistingNote(notes, sb, pitch)) return;

    onNoteCreate({ id: crypto.randomUUID(), pitch, start: sb, duration: 1, velocity: 0.8 });
  }, [notes, visibleRegion, gridSnap, selectionAnchor, dragState, justFinishedDragRef, onNoteCreate, onPlayheadChange, onNoteSelect, onToggleNoteSelection, onAddToSelection, onDeselectAll, onSetSelectionAnchor]);

  // Render function
  const render = useCallback(() => {
    const r = setupCanvas(canvasRef.current, containerRef.current);
    if (!r) return;

    const { ctx, displayWidth: dw, displayHeight: dh } = r;
    const dim = calculateRenderDimensions(dw, dh);

    ctx.clearRect(0, 0, dw, dh);
    renderGrid(ctx, dim, visibleRegion, activePitches, playingPitches);
    renderNotes(ctx, dim, notes, selectedNoteIds, visibleRegion, isPlaying, playheadPosition);
    renderMarquee(ctx, dim, marqueeState);
    renderPlayhead(ctx, dim, playheadPosition, visibleRegion);
    renderPitchLabels(ctx, dim, visibleRegion);
    renderTimeMarkers(ctx, dim, visibleRegion);
    renderScrollbars(ctx, dim, visibleRegion, effectiveTotalBeats);

    // Fill corner where labels meet markers
    ctx.fillStyle = GRID_BACKGROUND;
    ctx.fillRect(0, 0, PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT);
  }, [notes, selectedNoteIds, visibleRegion, playheadPosition, activePitches, playingPitches, isPlaying, marqueeState, effectiveTotalBeats]);

  // Effects
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

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;

    c.addEventListener('wheel', handleWheel, { passive: false });
    c.addEventListener('touchstart', handleTouchStart, { passive: true });
    c.addEventListener('touchmove', handleTouchMove, { passive: false });
    c.addEventListener('touchend', handleTouchEnd, { passive: true });
    c.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      c.removeEventListener('wheel', handleWheel);
      c.removeEventListener('touchstart', handleTouchStart);
      c.removeEventListener('touchmove', handleTouchMove);
      c.removeEventListener('touchend', handleTouchEnd);
      c.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(render);
  }, [visibleRegion, notes, selectedNoteIds, playheadPosition, activePitches, playingPitches, marqueeState, render]);

  useEffect(() => {
    if (!dragState) return;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragState, handleMouseMove, handleMouseUp, handleKeyDown]);

  useEffect(() => {
    if (!scrollbarDragState) return;

    const handleScrollbarMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const position = scrollbarDragState.scrollbar === 'horizontal'
        ? e.clientX - rect.left
        : e.clientY - rect.top;
      updateScrollbarDrag(position);
    };

    window.addEventListener('mousemove', handleScrollbarMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleScrollbarMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [scrollbarDragState, updateScrollbarDrag, handleMouseUp]);

  useEffect(() => {
    if (!marqueeState) return;

    const handleMarqueeMove = (e: MouseEvent) => {
      const r = containerRef.current!.getBoundingClientRect();
      updateMarquee(e.clientX - r.left, e.clientY - r.top);
    };

    window.addEventListener('mousemove', handleMarqueeMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMarqueeMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [marqueeState, updateMarquee, handleMouseUp, handleKeyDown]);

  useEffect(() => {
    if (selectedNoteIds.size === 0 || !onNoteDelete || dragState) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteIds, onNoteDelete, handleKeyDown, dragState]);

  const cursorStyle = useMemo(() => {
    if (dragState) return dragState.mode === 'resize' ? 'ew-resize' : 'move';
    if (marqueeState) return 'crosshair';
    if (scrollbarDragState) return 'grabbing';
    if (isOverScrollbar) return 'grab';
    if (isOverTimeline) return 'pointer';
    if (isOverResizeHandle) return 'ew-resize';
    return 'default';
  }, [dragState, marqueeState, scrollbarDragState, isOverScrollbar, isOverTimeline, isOverResizeHandle]);

  return (
    <div ref={containerRef} className={`relative w-full h-full min-h-[400px] ${className}`} style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        aria-label="Piano roll editor grid"
        role="img"
        tabIndex={0}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        onContextMenu={handleContextMenu}
        style={{ cursor: cursorStyle }}
      />
    </div>
  );
}

export default PianoRollCanvas;
