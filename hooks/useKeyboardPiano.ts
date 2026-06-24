'use client';

import { useState, useCallback, useEffect, useRef, RefObject } from 'react';

/**
 * Props for the useKeyboardPiano hook
 *
 * @interface UseKeyboardPianoProps
 */
export interface UseKeyboardPianoProps {
  /** Whether keyboard piano functionality is enabled */
  enabled: boolean;
  /** Whether the synthesizer is ready to play notes */
  synthesizerReady: boolean;
  /** Callback triggered when a note should start playing */
  onNoteOn: (pitch: number, velocity: number) => void;
  /** Callback triggered when a note should stop playing */
  onNoteOff: (pitch: number) => void;
  /** Reference to the container element (optional - for potential future focus-based features) */
  containerRef?: RefObject<HTMLElement | null>;
}

/**
 * Return type for the useKeyboardPiano hook
 *
 * @interface UseKeyboardPianoReturn
 */
export interface UseKeyboardPianoReturn {
  /** Currently pressed keyboard keys */
  pressedKeys: Set<string>;
  /** Primary highlighted pitch for visual feedback (most recently pressed key) */
  highlightedPitch: number | null;
  /** All currently active pitches (for polyphony support) */
  activePitches: Set<number>;
}

/**
 * Keyboard to MIDI note mapping
 *
 * Property 28: Keyboard Piano Key Mapping
 * All mapped keys produce correct MIDI note numbers based on:
 * - Bottom row (Z-M): C3 to B3 white keys
 * - Middle row (A-L): C4 to D5 white keys
 * - Top row (Q-P): C5 to E6 white keys
 * - Number row (2,3,5,6,7): Sharp/black keys for C4 octave
 *
 * Requirements: 40.1, 40.2
 */
export const KEYBOARD_PIANO_MAPPING: Record<string, number> = {
  // Bottom row (Z-M): C3 to B3 white keys
  'z': 48, // C3
  'x': 50, // D3
  'c': 52, // E3
  'v': 53, // F3
  'b': 55, // G3
  'n': 57, // A3
  'm': 59, // B3

  // Middle row (A-L): C4 to D5 white keys
  'a': 60, // C4 (Middle C)
  's': 62, // D4
  'd': 64, // E4
  'f': 65, // F4
  'g': 67, // G4
  'h': 69, // A4
  'j': 71, // B4
  'k': 72, // C5
  'l': 74, // D5

  // Top row (Q-P): C5 to E6 white keys
  'q': 72, // C5
  'w': 74, // D5
  'e': 76, // E5
  'r': 77, // F5
  't': 79, // G5
  'y': 81, // A5
  'u': 83, // B5
  'i': 84, // C6
  'o': 86, // D6
  'p': 88, // E6

  // Number row: Sharp/black keys for C4 octave
  '2': 61, // C#4
  '3': 63, // D#4
  '5': 66, // F#4
  '6': 68, // G#4
  '7': 70, // A#4
};

/**
 * Check if the event target is a text input element
 * This prevents keyboard piano from triggering when the user is typing
 *
 * Requirement 40.6: WHILE the user is typing in a text input field, textarea,
 * or contenteditable element, THE Piano_Roll_Editor SHALL NOT trigger keyboard piano playing
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
 * Custom hook for handling keyboard-to-MIDI note mapping for playing notes via computer keyboard.
 *
 * Implements:
 * - QWERTY keyboard to piano note mapping (Requirements 40.1, 40.2)
 * - Note triggering with velocity 0.8 (Requirement 40.3)
 * - Note release with ADSR envelope support (Requirement 40.4)
 * - Visual feedback via highlightedPitch (Requirement 40.5)
 * - Text input exclusion (Requirement 40.6)
 * - Polyphonic support via activePitches (Requirement 40.7)
 * - Graceful handling when synthesizer is not ready (Requirement 40.8)
 *
 * Property 28: Keyboard Piano Key Mapping
 * - All mapped keys produce correct MIDI note numbers
 *
 * Property 29: Keyboard Piano Note Triggering
 * - Pressing a mapped key triggers note with velocity 0.8
 * - Releasing a mapped key triggers note off
 *
 * Property 30: Keyboard Piano Text Input Exclusion
 * - Keys pressed in text inputs do not trigger notes
 *
 * @param props - The hook props
 * @returns Current state including pressed keys, highlighted pitch, and active pitches
 */
export function useKeyboardPiano({
  enabled,
  synthesizerReady,
  onNoteOn,
  onNoteOff,
}: UseKeyboardPianoProps): UseKeyboardPianoReturn {
  // Track currently pressed keyboard keys
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // Track the most recently pressed pitch for visual highlighting
  const [highlightedPitch, setHighlightedPitch] = useState<number | null>(null);

  // Track all currently active pitches for polyphonic support
  const [activePitches, setActivePitches] = useState<Set<number>>(new Set());

  // Use refs to avoid stale closures in event handlers
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const activePitchesRef = useRef<Set<number>>(new Set());

  // Default velocity for keyboard-triggered notes (Requirement 40.3)
  const DEFAULT_VELOCITY = 0.8;

  /**
   * Handle keydown events for keyboard piano
   * Requirement 40.3: Immediately trigger note sound with velocity 0.8
   * Requirement 40.7: Support playing multiple notes simultaneously
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle if disabled
    if (!enabled) {
      return;
    }

    // Don't trigger notes when typing in text inputs (Requirement 40.6, Property 30)
    if (isTextInputElement(event.target)) {
      return;
    }

    // Get the lowercase key
    const key = event.key.toLowerCase();

    // Check if this key is mapped to a MIDI note
    const pitch = KEYBOARD_PIANO_MAPPING[key];
    if (pitch === undefined) {
      return;
    }

    // Prevent default for mapped keys to avoid unexpected browser behavior
    event.preventDefault();

    // Don't trigger again if key is already pressed (key repeat)
    if (pressedKeysRef.current.has(key)) {
      return;
    }

    // Add to pressed keys
    const newPressedKeys = new Set(pressedKeysRef.current);
    newPressedKeys.add(key);
    pressedKeysRef.current = newPressedKeys;
    setPressedKeys(newPressedKeys);

    // Add to active pitches
    const newActivePitches = new Set(activePitchesRef.current);
    newActivePitches.add(pitch);
    activePitchesRef.current = newActivePitches;
    setActivePitches(newActivePitches);

    // Update highlighted pitch to the most recently pressed
    setHighlightedPitch(pitch);

    // Trigger note if synthesizer is ready (Requirement 40.8)
    // Property 29: Note Triggering
    if (synthesizerReady) {
      onNoteOn(pitch, DEFAULT_VELOCITY);
    }
  }, [enabled, synthesizerReady, onNoteOn]);

  /**
   * Handle keyup events for keyboard piano
   * Requirement 40.4: Stop note sound, allowing ADSR release phase to complete
   */
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    // Don't handle if disabled
    if (!enabled) {
      return;
    }

    // Get the lowercase key
    const key = event.key.toLowerCase();

    // Check if this key is mapped to a MIDI note
    const pitch = KEYBOARD_PIANO_MAPPING[key];
    if (pitch === undefined) {
      return;
    }

    // Remove from pressed keys
    const newPressedKeys = new Set(pressedKeysRef.current);
    newPressedKeys.delete(key);
    pressedKeysRef.current = newPressedKeys;
    setPressedKeys(newPressedKeys);

    // Remove from active pitches
    const newActivePitches = new Set(activePitchesRef.current);
    newActivePitches.delete(pitch);
    activePitchesRef.current = newActivePitches;
    setActivePitches(newActivePitches);

    // Update highlighted pitch
    // If there are still active pitches, highlight the most recent one
    // Otherwise, clear the highlight
    if (newActivePitches.size > 0) {
      // Get the first active pitch as the highlighted one
      // (In practice, this is typically the last one added, but Set doesn't maintain order)
      const remainingPitches = Array.from(newActivePitches);
      setHighlightedPitch(remainingPitches[remainingPitches.length - 1]);
    } else {
      setHighlightedPitch(null);
    }

    // Trigger note off if synthesizer is ready (Requirement 40.8)
    // Property 29: Note Off Triggering
    if (synthesizerReady) {
      onNoteOff(pitch);
    }
  }, [enabled, synthesizerReady, onNoteOff]);

  /**
   * Handle blur event to release all notes when window loses focus
   */
  const handleBlur = useCallback(() => {
    // Release all currently pressed notes
    if (synthesizerReady) {
      for (const pitch of activePitchesRef.current) {
        onNoteOff(pitch);
      }
    }

    // Clear all state
    pressedKeysRef.current = new Set();
    activePitchesRef.current = new Set();
    setPressedKeys(new Set());
    setActivePitches(new Set());
    setHighlightedPitch(null);
  }, [synthesizerReady, onNoteOff]);

  /**
   * Set up and clean up keyboard event listeners
   */
  useEffect(() => {
    if (!enabled) {
      // Clear state when disabled
      if (pressedKeysRef.current.size > 0 || activePitchesRef.current.size > 0) {
        handleBlur();
      }
      return;
    }

    // Add event listeners to document to catch all keyboard events
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);

      // Release all notes on cleanup
      if (synthesizerReady) {
        for (const pitch of activePitchesRef.current) {
          onNoteOff(pitch);
        }
      }
    };
  }, [enabled, handleKeyDown, handleKeyUp, handleBlur, synthesizerReady, onNoteOff]);

  return {
    pressedKeys,
    highlightedPitch,
    activePitches,
  };
}

export default useKeyboardPiano;
