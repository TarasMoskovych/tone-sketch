'use client';

import { useEffect, useCallback, RefObject } from 'react';

/**
 * Props for the useKeyboardShortcuts hook
 *
 * @interface UseKeyboardShortcutsProps
 */
export interface UseKeyboardShortcutsProps {
  /** Whether keyboard shortcuts are enabled */
  enabled: boolean;
  /** Callback to toggle playback state (play/stop) */
  onTogglePlayback: () => void;
  /** Callback to delete the currently selected note */
  onDeleteNote: () => void;
  /** Callback to select all notes (Ctrl+A/Cmd+A) */
  onSelectAll?: () => void;
  /** Callback for copy operation (Ctrl+C/Cmd+C) */
  onCopy?: () => void;
  /** Callback for cut operation (Ctrl+X/Cmd+X) */
  onCut?: () => void;
  /** Callback for paste operation (Ctrl+V/Cmd+V) */
  onPaste?: () => void;
  /** Callback for duplicate operation (Ctrl+D/Cmd+D) */
  onDuplicate?: () => void;
  /** Callback for undo operation (Ctrl+Z/Cmd+Z) */
  onUndo?: () => void;
  /** Callback for redo operation (Ctrl+Shift+Z/Cmd+Shift+Z or Ctrl+Y/Cmd+Y) */
  onRedo?: () => void;
  /** Whether a drag/resize/marquee operation is in progress */
  isDragging?: boolean;
  /** Reference to the container element that should have focus for shortcuts to work */
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * Check if the event target is a text input element
 * This prevents shortcuts from triggering when the user is typing in text fields
 *
 * Requirement 33.5: WHILE the user is typing in a text input field,
 * THE Application SHALL NOT trigger playback control on Space bar press
 *
 * @param target - The event target element
 * @returns true if the target is a text input element
 */
function isTextInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  // Check for standard text input elements
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input') {
    const inputType = (target as HTMLInputElement).type.toLowerCase();
    // These input types accept text input
    const textInputTypes = ['text', 'password', 'email', 'number', 'search', 'tel', 'url'];
    return textInputTypes.includes(inputType);
  }

  if (tagName === 'textarea') {
    return true;
  }

  // Check for contenteditable elements
  if (target.isContentEditable) {
    return true;
  }

  return false;
}

/**
 * Check if the container element or any of its children has focus
 *
 * @param containerRef - Reference to the container element
 * @returns true if the container or its children have focus
 */
function containerHasFocus(containerRef: RefObject<HTMLElement | null>): boolean {
  const container = containerRef.current;
  if (!container) {
    return false;
  }

  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }

  // Check if the active element is the container or a child of the container
  return container === activeElement || container.contains(activeElement);
}

/**
 * Custom hook for handling keyboard shortcuts in the Piano Roll Editor
 *
 * Implements:
 * - Space bar: Toggle play/stop (Requirements 33.1, 33.2, 33.3)
 * - Delete/Backspace: Delete selected note (Requirement 6.1)
 *
 * Implementation Notes:
 * - Checks if the event target is a text input before handling (Requirement 33.5)
 * - Prevents default browser behavior for handled keys (Requirement 33.4)
 * - Only handles shortcuts when the container element or its children have focus
 *
 * Property 21: Space Bar Toggles Playback
 * - For any playback state when the Piano Roll Editor has focus and the user is not
 *   in a text input field, pressing the Space bar SHALL toggle the playback state
 *
 * Property 22: Space Bar Ignored in Text Inputs
 * - For any text input field that has focus, pressing the Space bar SHALL NOT trigger
 *   playback toggle and SHALL allow normal text input behavior
 *
 * @param props - The hook props
 */
export function useKeyboardShortcuts({
  enabled,
  onTogglePlayback,
  onDeleteNote,
  onSelectAll,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onUndo,
  onRedo,
  isDragging,
  containerRef,
}: UseKeyboardShortcutsProps): void {
  /**
   * Handle keydown events for keyboard shortcuts
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts if disabled
    if (!enabled) {
      return;
    }

    // Don't handle shortcuts when typing in text inputs (Requirement 33.5, Property 22)
    if (isTextInputElement(event.target)) {
      return;
    }

    // Only handle shortcuts when the container has focus
    if (!containerHasFocus(containerRef)) {
      return;
    }

    switch (event.code) {
      case 'Space':
        // Toggle playback (Requirements 33.1, 33.2, 33.3)
        // Prevent default browser scroll behavior (Requirement 33.4)
        event.preventDefault();
        onTogglePlayback();
        break;

      case 'Delete':
      case 'Backspace':
        // Delete selected note (Requirement 6.1)
        // Prevent default browser back navigation on Backspace
        event.preventDefault();
        onDeleteNote();
        break;

      case 'KeyA':
        // Select All (Ctrl+A on Windows/Linux, Cmd+A on macOS)
        // Requirements 6.1, 6.2, 6.3
        if ((event.ctrlKey || event.metaKey) && onSelectAll) {
          // Prevent default browser text selection behavior
          event.preventDefault();
          onSelectAll();
        }
        break;

      case 'KeyC':
        // Copy (Ctrl+C/Cmd+C) — Requirement 6.1, 6.2, 6.3, 6.4
        if ((event.ctrlKey || event.metaKey) && onCopy) {
          if (isDragging) break;
          event.preventDefault();
          onCopy();
        }
        break;

      case 'KeyX':
        // Cut (Ctrl+X/Cmd+X) — Requirement 6.1, 6.2, 6.3, 6.4
        if ((event.ctrlKey || event.metaKey) && onCut) {
          if (isDragging) break;
          event.preventDefault();
          onCut();
        }
        break;

      case 'KeyV':
        // Paste (Ctrl+V/Cmd+V) — Requirement 6.1, 6.2, 6.3, 6.4
        if ((event.ctrlKey || event.metaKey) && onPaste) {
          if (isDragging) break;
          event.preventDefault();
          onPaste();
        }
        break;

      case 'KeyD':
        // Duplicate (Ctrl+D/Cmd+D) — Requirement 6.1, 6.2, 6.3, 6.4
        if ((event.ctrlKey || event.metaKey) && onDuplicate) {
          if (isDragging) break;
          event.preventDefault();
          onDuplicate();
        }
        break;

      case 'KeyZ':
        // Undo (Ctrl+Z/Cmd+Z) or Redo (Ctrl+Shift+Z/Cmd+Shift+Z)
        // Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.8
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && onRedo) {
          if (isDragging) break;
          event.preventDefault();
          onRedo();
        } else if ((event.ctrlKey || event.metaKey) && !event.shiftKey && onUndo) {
          if (isDragging) break;
          event.preventDefault();
          onUndo();
        }
        break;

      case 'KeyY':
        // Redo alternative (Ctrl+Y/Cmd+Y) — Requirement 6.2
        if ((event.ctrlKey || event.metaKey) && onRedo) {
          if (isDragging) break;
          event.preventDefault();
          onRedo();
        }
        break;

      default:
        // No action for other keys
        break;
    }
  }, [enabled, onTogglePlayback, onDeleteNote, onSelectAll, onCopy, onCut, onPaste, onDuplicate, onUndo, onRedo, isDragging, containerRef]);

  /**
   * Set up and clean up keyboard event listeners
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Add event listener to the document to catch all keyboard events
    // We filter by focus state in the handler
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

export default useKeyboardShortcuts;
