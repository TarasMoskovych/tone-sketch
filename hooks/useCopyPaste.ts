import { useState, useCallback, useRef, useEffect } from 'react';
import type { Note } from '../types/note';
import type { GridSnapConfig } from '../types/grid';
import {
  normalizeNotesToClipboard,
  pasteNotesAtPosition,
  calculateDuplicateAnchor,
} from './clipboard-operations';
import type { ClipboardNote } from './clipboard-operations';

/**
 * Props for the useCopyPaste hook.
 * Accepts note state, selection, playhead position, grid config,
 * and callbacks for mutating state in the parent.
 */
export interface UseCopyPasteProps {
  notes: Note[];
  selectedNoteIds: Set<string>;
  playheadPosition: number;
  gridSnap: GridSnapConfig;
  onNotesCreated: (notes: Note[]) => void;
  onNotesDeleted: (noteIds: string[]) => void;
  onSelectionChanged: (noteIds: string[]) => void;
}

/**
 * Return value from the useCopyPaste hook.
 * Exposes clipboard operations and state for the UI.
 */
export interface UseCopyPasteReturn {
  /** Copy selected notes to clipboard */
  copy: () => void;
  /** Cut selected notes (copy + delete) */
  cut: () => void;
  /** Paste clipboard contents at playhead */
  paste: () => void;
  /** Duplicate selected notes after selection end */
  duplicate: () => void;
  /** Whether clipboard has content */
  hasClipboardContent: boolean;
  /** Visual feedback flag (briefly true after copy/cut) */
  showCopyFeedback: boolean;
}

/**
 * Hook that manages internal clipboard state and orchestrates
 * copy, cut, paste, and duplicate operations for the piano roll.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4,
 *            3.1, 3.6, 3.7, 3.8, 4.1, 4.5, 4.6, 5.1
 */
export function useCopyPaste(props: UseCopyPasteProps): UseCopyPasteReturn {
  const {
    notes,
    selectedNoteIds,
    playheadPosition,
    gridSnap,
    onNotesCreated,
    onNotesDeleted,
    onSelectionChanged,
  } = props;

  const [clipboard, setClipboard] = useState<ClipboardNote[] | null>(null);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup feedback timer on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  /**
   * Triggers the copy feedback indicator with auto-reset after 200ms.
   * Clears any existing timer before setting a new one.
   */
  const triggerCopyFeedback = useCallback(() => {
    if (feedbackTimerRef.current !== null) {
      clearTimeout(feedbackTimerRef.current);
    }
    setShowCopyFeedback(true);
    feedbackTimerRef.current = setTimeout(() => {
      setShowCopyFeedback(false);
      feedbackTimerRef.current = null;
    }, 200);
  }, []);

  /**
   * Copy selected notes to the internal clipboard.
   * No-op if selection is empty (Req 1.2).
   * Stores deep-copied relative offsets (Req 1.4, 5.1).
   * Triggers visual feedback (Req 1.5).
   */
  const copy = useCallback(() => {
    if (selectedNoteIds.size === 0) {
      return;
    }

    const selectedNotes = notes.filter((note) => selectedNoteIds.has(note.id));
    if (selectedNotes.length === 0) {
      return;
    }

    const clipboardNotes = normalizeNotesToClipboard(selectedNotes);
    setClipboard(clipboardNotes);
    triggerCopyFeedback();
  }, [notes, selectedNoteIds, triggerCopyFeedback]);

  /**
   * Cut selected notes: copy to clipboard, delete originals, clear selection.
   * No-op if selection is empty (Req 2.2).
   * Removes selected notes (Req 2.1, 2.3).
   */
  const cut = useCallback(() => {
    if (selectedNoteIds.size === 0) {
      return;
    }

    const selectedNotes = notes.filter((note) => selectedNoteIds.has(note.id));
    if (selectedNotes.length === 0) {
      return;
    }

    const clipboardNotes = normalizeNotesToClipboard(selectedNotes);
    setClipboard(clipboardNotes);
    triggerCopyFeedback();

    onNotesDeleted(Array.from(selectedNoteIds));
    onSelectionChanged([]);
  }, [notes, selectedNoteIds, triggerCopyFeedback, onNotesDeleted, onSelectionChanged]);

  /**
   * Paste clipboard contents at the current playhead position.
   * No-op if clipboard is empty (Req 3.6).
   * Snaps anchor to grid (Req 3.4, 3.5).
   * Creates notes with new IDs (Req 3.3).
   * Selects only new notes (Req 3.7).
   * Clipboard remains unchanged for multiple pastes (Req 3.8).
   */
  const paste = useCallback(() => {
    if (clipboard === null || clipboard.length === 0) {
      return;
    }

    const newNotes = pasteNotesAtPosition(clipboard, playheadPosition, gridSnap);
    onNotesCreated(newNotes);
    onSelectionChanged(newNotes.map((note) => note.id));
  }, [clipboard, playheadPosition, gridSnap, onNotesCreated, onSelectionChanged]);

  /**
   * Duplicate selected notes, placing them immediately after the selection end.
   * No-op if selection is empty (Req 4.6).
   * Positions at end of latest note, snapped if enabled (Req 4.1, 4.2).
   * Preserves relative timing (Req 4.3).
   * Assigns new IDs (Req 4.4).
   * Selects only duplicated notes (Req 4.5).
   */
  const duplicate = useCallback(() => {
    if (selectedNoteIds.size === 0) {
      return;
    }

    const selectedNotes = notes.filter((note) => selectedNoteIds.has(note.id));
    if (selectedNotes.length === 0) {
      return;
    }

    const clipboardNotes = normalizeNotesToClipboard(selectedNotes);
    const anchor = calculateDuplicateAnchor(selectedNotes, gridSnap);
    const newNotes = pasteNotesAtPosition(clipboardNotes, anchor, gridSnap);

    onNotesCreated(newNotes);
    onSelectionChanged(newNotes.map((note) => note.id));
  }, [notes, selectedNoteIds, gridSnap, onNotesCreated, onSelectionChanged]);

  return {
    copy,
    cut,
    paste,
    duplicate,
    hasClipboardContent: clipboard !== null && clipboard.length > 0,
    showCopyFeedback,
  };
}
