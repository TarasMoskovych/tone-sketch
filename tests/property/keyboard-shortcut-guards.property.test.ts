/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

/**
 * Feature: copy-paste-notes
 * Property 12: Text input suppresses clipboard shortcuts
 * Property 13: Active drag suppresses clipboard shortcuts
 *
 * Validates: Requirements 6.1, 6.4
 */

// Clipboard key codes and their corresponding event codes
const CLIPBOARD_KEYS = ['KeyC', 'KeyX', 'KeyV', 'KeyD'] as const;
type ClipboardKey = (typeof CLIPBOARD_KEYS)[number];

// Modifier types
type ModifierType = 'ctrl' | 'meta';

// Text input element types for Property 12
type TextInputType = 'text-input' | 'textarea' | 'contenteditable';

// Arbitraries
const clipboardKeyArb: fc.Arbitrary<ClipboardKey> = fc.constantFrom(...CLIPBOARD_KEYS);
const modifierArb: fc.Arbitrary<ModifierType> = fc.constantFrom('ctrl', 'meta');
const textInputTypeArb: fc.Arbitrary<TextInputType> = fc.constantFrom(
  'text-input',
  'textarea',
  'contenteditable'
);

/**
 * Creates a text input element based on type
 */
function createTextInputElement(type: TextInputType): HTMLElement {
  switch (type) {
    case 'text-input': {
      const input = document.createElement('input');
      input.type = 'text';
      return input;
    }
    case 'textarea': {
      return document.createElement('textarea');
    }
    case 'contenteditable': {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      return div;
    }
  }
}

/**
 * Gets modifier key init based on modifier type
 */
function getModifierInit(modifier: ModifierType): Partial<KeyboardEventInit> {
  return modifier === 'ctrl' ? { ctrlKey: true } : { metaKey: true };
}

describe('Property 12: Text input suppresses clipboard shortcuts', () => {
  let mockContainer: HTMLDivElement;
  let containerRef: { current: HTMLElement | null };
  let onCopy: ReturnType<typeof vi.fn<() => void>>;
  let onCut: ReturnType<typeof vi.fn<() => void>>;
  let onPaste: ReturnType<typeof vi.fn<() => void>>;
  let onDuplicate: ReturnType<typeof vi.fn<() => void>>;
  let onTogglePlayback: ReturnType<typeof vi.fn<() => void>>;
  let onDeleteNote: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.setAttribute('tabindex', '0');
    document.body.appendChild(mockContainer);
    containerRef = { current: mockContainer };

    onCopy = vi.fn<() => void>();
    onCut = vi.fn<() => void>();
    onPaste = vi.fn<() => void>();
    onDuplicate = vi.fn<() => void>();
    onTogglePlayback = vi.fn<() => void>();
    onDeleteNote = vi.fn<() => void>();
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 6.1**
   *
   * For any keyboard event with Ctrl/Cmd+C/X/V/D where the event target is a text input,
   * textarea, or contenteditable element, the piano roll SHALL NOT trigger clipboard
   * operations and SHALL allow default browser behavior.
   */
  it('SHALL NOT trigger clipboard operations when event target is a text input element', () => {
    fc.assert(
      fc.property(
        clipboardKeyArb,
        modifierArb,
        textInputTypeArb,
        (key, modifier, inputType) => {
          // Reset mocks for each iteration
          onCopy.mockClear();
          onCut.mockClear();
          onPaste.mockClear();
          onDuplicate.mockClear();

          // Create and mount the text input element inside container
          const textElement = createTextInputElement(inputType);
          mockContainer.appendChild(textElement);
          textElement.focus();

          // Render the hook
          const { unmount } = renderHook(() =>
            useKeyboardShortcuts({
              enabled: true,
              onTogglePlayback,
              onDeleteNote,
              onCopy,
              onCut,
              onPaste,
              onDuplicate,
              isDragging: false,
              containerRef,
            })
          );

          // Dispatch keyboard event with the text input as target
          const event = new KeyboardEvent('keydown', {
            code: key,
            bubbles: true,
            cancelable: true,
            ...getModifierInit(modifier),
          });
          Object.defineProperty(event, 'target', { value: textElement, writable: false });
          document.dispatchEvent(event);

          // Verify none of the clipboard callbacks were called
          expect(onCopy).not.toHaveBeenCalled();
          expect(onCut).not.toHaveBeenCalled();
          expect(onPaste).not.toHaveBeenCalled();
          expect(onDuplicate).not.toHaveBeenCalled();

          // Verify event.preventDefault() was NOT called (default browser behavior allowed)
          expect(event.defaultPrevented).toBe(false);

          // Cleanup
          mockContainer.removeChild(textElement);
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 13: Active drag suppresses clipboard shortcuts', () => {
  let mockContainer: HTMLDivElement;
  let containerRef: { current: HTMLElement | null };
  let onCopy: ReturnType<typeof vi.fn<() => void>>;
  let onCut: ReturnType<typeof vi.fn<() => void>>;
  let onPaste: ReturnType<typeof vi.fn<() => void>>;
  let onDuplicate: ReturnType<typeof vi.fn<() => void>>;
  let onTogglePlayback: ReturnType<typeof vi.fn<() => void>>;
  let onDeleteNote: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockContainer.setAttribute('tabindex', '0');
    document.body.appendChild(mockContainer);
    containerRef = { current: mockContainer };

    onCopy = vi.fn<() => void>();
    onCut = vi.fn<() => void>();
    onPaste = vi.fn<() => void>();
    onDuplicate = vi.fn<() => void>();
    onTogglePlayback = vi.fn<() => void>();
    onDeleteNote = vi.fn<() => void>();
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 6.4**
   *
   * For any state where isDragging=true, Ctrl/Cmd+C/X/V/D SHALL NOT trigger
   * clipboard operations.
   */
  it('SHALL NOT trigger clipboard operations when isDragging is true', () => {
    fc.assert(
      fc.property(
        clipboardKeyArb,
        modifierArb,
        (key, modifier) => {
          // Reset mocks for each iteration
          onCopy.mockClear();
          onCut.mockClear();
          onPaste.mockClear();
          onDuplicate.mockClear();

          // Focus the container (non-text element)
          mockContainer.focus();

          // Render the hook with isDragging=true
          const { unmount } = renderHook(() =>
            useKeyboardShortcuts({
              enabled: true,
              onTogglePlayback,
              onDeleteNote,
              onCopy,
              onCut,
              onPaste,
              onDuplicate,
              isDragging: true,
              containerRef,
            })
          );

          // Dispatch keyboard event
          const event = new KeyboardEvent('keydown', {
            code: key,
            bubbles: true,
            cancelable: true,
            ...getModifierInit(modifier),
          });
          document.dispatchEvent(event);

          // Verify none of the clipboard callbacks were called
          expect(onCopy).not.toHaveBeenCalled();
          expect(onCut).not.toHaveBeenCalled();
          expect(onPaste).not.toHaveBeenCalled();
          expect(onDuplicate).not.toHaveBeenCalled();

          // Verify event.preventDefault() was NOT called
          expect(event.defaultPrevented).toBe(false);

          // Cleanup
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
