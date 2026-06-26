/**
 * @vitest-environment jsdom
 */

/**
 * Integration tests for Edit page flows.
 *
 * Tests:
 * - Ownership detection and readOnly mode for non-owners
 * - Save success indicator with 3-second timeout
 * - Delete confirmation flow
 * - Header rendering based on ownership
 *
 * Validates: Requirements 4.1, 4.4, 4.5, 4.7, 4.8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';

// ============================================================================
// Mock Setup
// ============================================================================

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock useMelodyPersistence
const mockUpdateMelody = vi.fn();
const mockDeleteMelody = vi.fn();
let mockIsSaving = false;
let mockPersistenceError: string | null = null;

// Mock useOwnership - configurable per test
let mockIsOwnerFn = vi.fn((_melodyOwnerId: string) => true);
let mockOwnerId = 'current-user-id';

vi.mock('@/hooks', () => ({
  useMelodyPersistence: () => ({
    isSaving: mockIsSaving,
    isLoading: false,
    error: mockPersistenceError,
    clearError: vi.fn(),
    saveMelody: vi.fn(),
    updateMelody: mockUpdateMelody,
    deleteMelody: mockDeleteMelody,
    loadMelody: vi.fn(),
  }),
  useOwnership: () => ({
    ownerId: mockOwnerId,
    getOwnerId: vi.fn(() => mockOwnerId),
    isOwner: mockIsOwnerFn,
  }),
}));

// Mock the MelodyEditor shared component - capture props
let capturedMelodyEditorProps: Record<string, unknown> = {};

vi.mock('@/components', () => ({
  MelodyEditor: (props: Record<string, unknown>) => {
    capturedMelodyEditorProps = props;

    // Simulate calling onMidiImport to provide loadNotes reference
    const onMidiImport = props.onMidiImport as ((fn: unknown) => void) | undefined;
    const onStateChange = props.onStateChange as ((state: unknown) => void) | undefined;

    React.useEffect(() => {
      onMidiImport?.((_notes: unknown[], _tempo?: number) => {
        // no-op for test
      });
    }, [onMidiImport]);

    // Simulate initial state emission
    React.useEffect(() => {
      onStateChange?.({
        notes: [{ id: 'note-1', pitch: 60, start: 0, duration: 1, velocity: 0.8 }],
        synthConfig: { oscillatorType: 'sine', volume: 0.8 },
        tempo: 140,
      });
    }, [onStateChange]);

    return React.createElement('div', { 'data-testid': 'melody-editor' }, props.headerSlot as React.ReactNode);
  },
  MidiControls: ({ allowImport }: { allowImport?: boolean }) =>
    React.createElement('div', { 'data-testid': 'midi-controls', 'data-allow-import': String(!!allowImport) }),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

// Import the component AFTER mocks
import EditPageMelodyEditor from '@/app/m/[id]/EditMelodyClient';

// ============================================================================
// Helpers
// ============================================================================

const baseMelody = {
  id: 'melody-123',
  title: 'Test Melody',
  notes: [{ id: 'note-1', pitch: 60, start: 0, duration: 1, velocity: 0.8 }],
  tempo: 140,
  synth: {
    oscillatorType: 'sine' as const,
    volume: 0.8,
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 },
    filter: { enabled: false, type: 'lowpass' as const, frequency: 1000 },
    effects: {
      reverb: { enabled: false, roomSize: 0.5, wetDry: 0.3 },
      delay: { enabled: false, time: 0.25, feedback: 0.3, wetDry: 0.3 },
      chorus: { enabled: false, rate: 1.5, depth: 0.5, wetDry: 0.3 },
      flanger: { enabled: false, rate: 0.5, depth: 0.5, feedback: 0.5, wetDry: 0.3 },
    },
    presetName: null,
  },
  ownerId: 'melody-owner-id',
};

// ============================================================================
// Tests
// ============================================================================

describe('Edit Page Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPush.mockClear();
    mockUpdateMelody.mockClear();
    mockDeleteMelody.mockClear();
    mockIsSaving = false;
    mockPersistenceError = null;
    mockOwnerId = 'current-user-id';
    mockIsOwnerFn = vi.fn((_melodyOwnerId: string) => true);
    capturedMelodyEditorProps = {};
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe('Requirement 4.1: Renders MelodyEditor with melody data', () => {
    it('renders the MelodyEditor component', () => {
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      expect(screen.getByTestId('melody-editor')).toBeTruthy();
    });

    it('passes initialNotes, initialSynthConfig, and initialTempo from melody data', () => {
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));

      expect(capturedMelodyEditorProps.initialNotes).toEqual(baseMelody.notes);
      expect(capturedMelodyEditorProps.initialSynthConfig).toEqual(baseMelody.synth);
      expect(capturedMelodyEditorProps.initialTempo).toBe(baseMelody.tempo);
    });

    it('renders the melody title in the header', () => {
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      expect(screen.getByText('Test Melody')).toBeTruthy();
    });
  });

  describe('Requirement 4.4: Ownership detection and readOnly for non-owners', () => {
    it('shows "Preview Mode" badge when user is NOT the owner', () => {
      mockIsOwnerFn = vi.fn(() => false);
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));

      act(() => { vi.runAllTimers(); });

      expect(screen.getByText('Preview Mode')).toBeTruthy();
    });

    it('does not show "Preview Mode" badge when user is the owner', () => {
      mockIsOwnerFn = vi.fn(() => true);
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));

      act(() => { vi.runAllTimers(); });

      expect(screen.queryByText('Preview Mode')).toBeNull();
    });

    it('shows Save and Delete buttons for owner', () => {
      mockIsOwnerFn = vi.fn(() => true);
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));

      act(() => { vi.runAllTimers(); });

      expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
    });

    it('hides Save and Delete buttons for non-owner', () => {
      mockIsOwnerFn = vi.fn(() => false);
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));

      act(() => { vi.runAllTimers(); });

      expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    });

    it('passes allowMidiImport=true for owner, false for non-owner', () => {
      // Test owner case
      mockIsOwnerFn = vi.fn(() => true);
      const { unmount } = render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });
      expect(capturedMelodyEditorProps.allowMidiImport).toBe(true);
      unmount();

      // Test non-owner case
      mockIsOwnerFn = vi.fn(() => false);
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });
      expect(capturedMelodyEditorProps.allowMidiImport).toBe(false);
    });
  });

  describe('Requirement 4.5: Save success indicator with 3-second timeout', () => {
    it('shows "Saved!" indicator after successful save', async () => {
      mockIsOwnerFn = vi.fn(() => true);
      mockUpdateMelody.mockResolvedValue(undefined);

      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // Click Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await act(async () => {
        fireEvent.click(saveButton);
        // Allow the resolved promise to settle and state to update
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should show "Saved!" text
      expect(screen.getByText('Saved!')).toBeTruthy();
    });

    it('"Saved!" indicator disappears after 3 seconds', async () => {
      mockIsOwnerFn = vi.fn(() => true);
      mockUpdateMelody.mockResolvedValue(undefined);

      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // Click Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await act(async () => {
        fireEvent.click(saveButton);
        await Promise.resolve();
        await Promise.resolve();
      });

      // Verify "Saved!" is shown
      expect(screen.getByText('Saved!')).toBeTruthy();

      // Advance timers by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // "Saved!" should be gone
      expect(screen.queryByText('Saved!')).toBeNull();
    });

    it('shows error message when save fails', async () => {
      mockIsOwnerFn = vi.fn(() => true);
      mockPersistenceError = 'Failed to update';

      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // The error from useMelodyPersistence should be visible
      expect(screen.getByText('Failed to update')).toBeTruthy();
    });

    it('calls updateMelody with correct parameters', async () => {
      mockIsOwnerFn = vi.fn(() => true);
      mockUpdateMelody.mockResolvedValue(undefined);

      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // Click Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await act(async () => {
        fireEvent.click(saveButton);
        await vi.runAllTimersAsync();
      });

      expect(mockUpdateMelody).toHaveBeenCalledWith(
        'melody-123',
        expect.objectContaining({
          title: 'Test Melody',
          ownerId: mockOwnerId,
        })
      );
    });
  });

  describe('Requirement 4.7 & 4.8: Delete confirmation flow', () => {
    it('opens delete confirmation dialog when Delete is clicked', () => {
      mockIsOwnerFn = vi.fn(() => true);
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));

      // Should show confirmation dialog
      expect(screen.getByText('Delete Melody')).toBeTruthy();
      expect(screen.getByText(/are you sure you want to delete/i)).toBeTruthy();
      expect(screen.getByText(/this action cannot be undone/i)).toBeTruthy();
    });

    it('shows melody title in the delete confirmation dialog', () => {
      mockIsOwnerFn = vi.fn(() => true);
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // Click Delete
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));

      // Dialog should mention the melody title (it appears in both header and dialog text)
      const matches = screen.getAllByText(/Test Melody/);
      expect(matches.length).toBeGreaterThanOrEqual(2); // In header + dialog text
      expect(screen.getByText(/this action cannot be undone/i)).toBeTruthy();
    });

    it('cancels deletion when Cancel is clicked in dialog', () => {
      mockIsOwnerFn = vi.fn(() => true);
      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // Click Delete to open dialog
      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

      // Click Cancel in dialog
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Dialog should be closed
      expect(screen.queryByText('Delete Melody')).toBeNull();
      expect(mockDeleteMelody).not.toHaveBeenCalled();
    });

    it('deletes melody and redirects to home on confirm', async () => {
      mockIsOwnerFn = vi.fn(() => true);
      mockDeleteMelody.mockResolvedValue(undefined);

      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // Open delete dialog
      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

      // Get the Delete button in the dialog (there are now two Delete buttons - one in header, one in dialog)
      const dialogDeleteButtons = screen.getAllByRole('button', { name: /delete/i });
      const confirmButton = dialogDeleteButtons[dialogDeleteButtons.length - 1];

      await act(async () => {
        fireEvent.click(confirmButton);
        await vi.runAllTimersAsync();
      });

      expect(mockDeleteMelody).toHaveBeenCalledWith('melody-123', mockOwnerId);
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('shows error in dialog when deletion fails', async () => {
      mockIsOwnerFn = vi.fn(() => true);
      mockDeleteMelody.mockRejectedValue(new Error('Delete failed'));

      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // Open delete dialog
      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

      // Confirm deletion
      const dialogDeleteButtons = screen.getAllByRole('button', { name: /delete/i });
      const confirmButton = dialogDeleteButtons[dialogDeleteButtons.length - 1];

      await act(async () => {
        fireEvent.click(confirmButton);
        await vi.runAllTimersAsync();
      });

      // Should show error in dialog
      expect(screen.getByText('Delete failed')).toBeTruthy();

      // Should NOT redirect
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Dirty state clears save success indicator', () => {
    it('clears "Saved!" when onDirtyStateChange fires with true', async () => {
      mockIsOwnerFn = vi.fn(() => true);
      mockUpdateMelody.mockResolvedValue(undefined);

      render(React.createElement(EditPageMelodyEditor, { melody: baseMelody }));
      act(() => { vi.runAllTimers(); });

      // Click Save to get "Saved!" indicator
      const saveButton = screen.getByRole('button', { name: /save/i });
      await act(async () => {
        fireEvent.click(saveButton);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText('Saved!')).toBeTruthy();

      // Simulate dirty state by calling the onDirtyStateChange callback
      act(() => {
        const onDirtyStateChange = capturedMelodyEditorProps.onDirtyStateChange as (isDirty: boolean) => void;
        onDirtyStateChange?.(true);
      });

      // "Saved!" should be cleared
      expect(screen.queryByText('Saved!')).toBeNull();
    });
  });
});
