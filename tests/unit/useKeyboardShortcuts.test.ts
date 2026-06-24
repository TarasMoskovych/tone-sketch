/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let mockOnTogglePlayback: ReturnType<typeof vi.fn>;
  let mockOnDeleteNote: ReturnType<typeof vi.fn>;
  let mockContainer: HTMLDivElement;
  let containerRef: { current: HTMLElement | null };

  beforeEach(() => {
    mockOnTogglePlayback = vi.fn();
    mockOnDeleteNote = vi.fn();

    // Create a mock container element
    mockContainer = document.createElement('div');
    mockContainer.setAttribute('tabindex', '0');
    document.body.appendChild(mockContainer);

    containerRef = { current: mockContainer };
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
  });

  /**
   * Helper to dispatch a keyboard event on the document
   */
  function dispatchKeyEvent(code: string, options: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    document.dispatchEvent(event);
    return event;
  }

  describe('Space bar toggle playback', () => {
    /**
     * Requirement 33.1: WHEN the user presses the Space bar while the Piano_Roll_Editor has focus,
     * THE Application SHALL toggle playback state between playing and stopped
     *
     * Property 21: Space Bar Toggles Playback
     */
    it('should call onTogglePlayback when Space is pressed and container has focus', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      dispatchKeyEvent('Space');

      expect(mockOnTogglePlayback).toHaveBeenCalledTimes(1);
    });

    /**
     * Requirement 33.4: THE Application SHALL prevent the default browser behavior
     * for the Space bar key when the Piano_Roll_Editor has focus
     */
    it('should prevent default browser behavior when Space is pressed', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      const event = dispatchKeyEvent('Space');

      expect(event.defaultPrevented).toBe(true);
    });

    it('should not call onTogglePlayback when disabled', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: false,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      dispatchKeyEvent('Space');

      expect(mockOnTogglePlayback).not.toHaveBeenCalled();
    });

    it('should not call onTogglePlayback when container does not have focus', () => {
      // Don't focus the container
      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      dispatchKeyEvent('Space');

      expect(mockOnTogglePlayback).not.toHaveBeenCalled();
    });
  });

  describe('Text input detection', () => {
    /**
     * Requirement 33.5: WHILE the user is typing in a text input field,
     * THE Application SHALL NOT trigger playback control on Space bar press
     *
     * Property 22: Space Bar Ignored in Text Inputs
     */
    it('should not trigger playback when focus is in a text input', () => {
      const textInput = document.createElement('input');
      textInput.type = 'text';
      mockContainer.appendChild(textInput);
      textInput.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      // Create event with the text input as target
      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: textInput, writable: false });
      document.dispatchEvent(event);

      expect(mockOnTogglePlayback).not.toHaveBeenCalled();
    });

    it('should not trigger playback when focus is in a textarea', () => {
      const textarea = document.createElement('textarea');
      mockContainer.appendChild(textarea);
      textarea.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: textarea, writable: false });
      document.dispatchEvent(event);

      expect(mockOnTogglePlayback).not.toHaveBeenCalled();
    });

    it('should not trigger playback when focus is in a contenteditable element', () => {
      const contentEditable = document.createElement('div');
      contentEditable.contentEditable = 'true';
      mockContainer.appendChild(contentEditable);
      contentEditable.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: contentEditable, writable: false });
      document.dispatchEvent(event);

      expect(mockOnTogglePlayback).not.toHaveBeenCalled();
    });

    it('should not trigger playback for password input', () => {
      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      mockContainer.appendChild(passwordInput);
      passwordInput.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: passwordInput, writable: false });
      document.dispatchEvent(event);

      expect(mockOnTogglePlayback).not.toHaveBeenCalled();
    });

    it('should allow shortcuts for non-text input types like checkbox', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      mockContainer.appendChild(checkbox);
      checkbox.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: checkbox, writable: false });
      document.dispatchEvent(event);

      expect(mockOnTogglePlayback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete/Backspace note deletion', () => {
    /**
     * Requirement 6.1: WHEN the user selects a Note and presses the Delete key or Backspace key,
     * THE Piano_Roll_Editor SHALL remove the Note from the Melody
     */
    it('should call onDeleteNote when Delete key is pressed', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      dispatchKeyEvent('Delete');

      expect(mockOnDeleteNote).toHaveBeenCalledTimes(1);
    });

    it('should call onDeleteNote when Backspace key is pressed', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      dispatchKeyEvent('Backspace');

      expect(mockOnDeleteNote).toHaveBeenCalledTimes(1);
    });

    it('should prevent default browser back navigation on Backspace', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      const event = dispatchKeyEvent('Backspace');

      expect(event.defaultPrevented).toBe(true);
    });

    it('should not delete notes when in text input', () => {
      const textInput = document.createElement('input');
      textInput.type = 'text';
      mockContainer.appendChild(textInput);
      textInput.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      const event = new KeyboardEvent('keydown', {
        code: 'Delete',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: textInput, writable: false });
      document.dispatchEvent(event);

      expect(mockOnDeleteNote).not.toHaveBeenCalled();
    });
  });

  describe('Other keys', () => {
    it('should not call any callbacks for unhandled keys', () => {
      mockContainer.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      dispatchKeyEvent('KeyA');
      dispatchKeyEvent('Enter');
      dispatchKeyEvent('Escape');

      expect(mockOnTogglePlayback).not.toHaveBeenCalled();
      expect(mockOnDeleteNote).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listener on unmount', () => {
      mockContainer.focus();

      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      unmount();

      dispatchKeyEvent('Space');

      expect(mockOnTogglePlayback).not.toHaveBeenCalled();
    });

    it('should remove event listener when disabled changes to false', () => {
      mockContainer.focus();

      const { rerender } = renderHook(
        ({ enabled }) =>
          useKeyboardShortcuts({
            enabled,
            onTogglePlayback: mockOnTogglePlayback,
            onDeleteNote: mockOnDeleteNote,
            containerRef,
          }),
        { initialProps: { enabled: true } }
      );

      // Verify it works when enabled
      dispatchKeyEvent('Space');
      expect(mockOnTogglePlayback).toHaveBeenCalledTimes(1);

      // Disable the hook
      rerender({ enabled: false });

      // Should not respond when disabled
      dispatchKeyEvent('Space');
      expect(mockOnTogglePlayback).toHaveBeenCalledTimes(1); // Still 1, no new calls
    });
  });

  describe('Focus on child elements', () => {
    it('should handle shortcuts when focus is on a child element of container', () => {
      const childDiv = document.createElement('div');
      childDiv.setAttribute('tabindex', '0');
      mockContainer.appendChild(childDiv);
      childDiv.focus();

      renderHook(() =>
        useKeyboardShortcuts({
          enabled: true,
          onTogglePlayback: mockOnTogglePlayback,
          onDeleteNote: mockOnDeleteNote,
          containerRef,
        })
      );

      dispatchKeyEvent('Space');

      expect(mockOnTogglePlayback).toHaveBeenCalledTimes(1);
    });
  });
});
