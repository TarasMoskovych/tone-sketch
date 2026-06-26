/**
 * @vitest-environment jsdom
 */

/**
 * Integration tests for Create page flows.
 *
 * Tests:
 * - Renders the shared MelodyEditor component
 * - Save dialog opens when Save button is clicked
 * - Title validation works (empty, whitespace-only, >200 chars rejected)
 * - Successful save persists via POST and redirects to /m/{id}
 * - Cancel closes dialog without saving
 *
 * Validates: Requirements 3.1, 3.3, 3.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
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

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

// Mock useMelodyPersistence
const mockSaveMelody = vi.fn();
const mockClearError = vi.fn();
let mockIsSaving = false;
let mockPersistenceError: string | null = null;

// Mock useOwnership
const mockGetOwnerId = vi.fn(() => 'test-owner-id');

vi.mock('@/hooks', () => ({
  useMelodyPersistence: () => ({
    isSaving: mockIsSaving,
    isLoading: false,
    error: mockPersistenceError,
    clearError: mockClearError,
    saveMelody: mockSaveMelody,
    updateMelody: vi.fn(),
    deleteMelody: vi.fn(),
    loadMelody: vi.fn(),
  }),
  useOwnership: () => ({
    ownerId: 'test-owner-id',
    getOwnerId: mockGetOwnerId,
    isOwner: vi.fn(() => true),
  }),
}));

// Mock the MelodyEditor shared component
vi.mock('@/components', () => ({
  MelodyEditor: ({ headerSlot, onStateChange, onMidiImport }: {
    headerSlot?: React.ReactNode;
    onStateChange?: (state: { notes: unknown[]; synthConfig: unknown; tempo: number }) => void;
    onMidiImport?: (fn: (notes: unknown[], tempo?: number) => void) => void;
  }) => {
    // Simulate calling onMidiImport to provide loadNotes reference
    React.useEffect(() => {
      onMidiImport?.((_notes, _tempo) => {
        // no-op for test
      });
    }, [onMidiImport]);

    // Simulate calling onStateChange with some state
    React.useEffect(() => {
      onStateChange?.({
        notes: [{ id: 'note-1', pitch: 60, start: 0, duration: 1, velocity: 0.8 }],
        synthConfig: { oscillatorType: 'sine', volume: 0.8 },
        tempo: 120,
      });
    }, [onStateChange]);

    return React.createElement('div', { 'data-testid': 'melody-editor' }, headerSlot);
  },
  MidiControls: (_props: { onImport?: unknown }) =>
    React.createElement('div', { 'data-testid': 'midi-controls' }),
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

// Import the page component AFTER mocks
import CreatePage from '@/app/create/page';

// ============================================================================
// Tests
// ============================================================================

describe('Create Page Integration Tests', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSaveMelody.mockClear();
    mockClearError.mockClear();
    mockGetOwnerId.mockClear();
    mockIsSaving = false;
    mockPersistenceError = null;
  });

  afterEach(() => {
    cleanup();
  });

  describe('Requirement 3.1: Renders shared MelodyEditor with default state', () => {
    it('renders the MelodyEditor component', () => {
      render(React.createElement(CreatePage));
      expect(screen.getByTestId('melody-editor')).toBeTruthy();
    });

    it('renders the "Create Melody" title in the header slot', () => {
      render(React.createElement(CreatePage));
      expect(screen.getByText('Create Melody')).toBeTruthy();
    });

    it('renders a Save button in the header', () => {
      render(React.createElement(CreatePage));
      expect(screen.getByRole('button', { name: /save/i })).toBeTruthy();
    });

    it('renders MIDI controls in the header', () => {
      render(React.createElement(CreatePage));
      expect(screen.getByTestId('midi-controls')).toBeTruthy();
    });
  });

  describe('Requirement 3.3: Save dialog opens and title validation works', () => {
    it('opens save dialog when Save button is clicked', () => {
      render(React.createElement(CreatePage));

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(screen.getByRole('heading', { name: 'Save Melody' })).toBeTruthy();
      expect(screen.getByLabelText(/melody title/i)).toBeTruthy();
    });

    it('shows validation error for empty title', async () => {
      render(React.createElement(CreatePage));

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Click save without entering a title - the button should be disabled
      const saveMelodyButton = screen.getByRole('button', { name: /save melody/i });
      expect(saveMelodyButton).toHaveProperty('disabled', true);
    });

    it('shows validation error for whitespace-only title when submitted', async () => {
      render(React.createElement(CreatePage));

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Enter whitespace-only title
      const input = screen.getByLabelText(/melody title/i);
      fireEvent.change(input, { target: { value: '   ' } });

      // The "Save Melody" button is disabled when title.trim() is empty
      const saveMelodyButton = screen.getByRole('button', { name: /save melody/i });
      expect(saveMelodyButton).toHaveProperty('disabled', true);
    });

    it('shows validation error for title longer than 200 characters', async () => {
      render(React.createElement(CreatePage));

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Enter a title longer than 200 chars (the input has maxLength=200, but the validation still checks)
      const longTitle = 'a'.repeat(201);
      const input = screen.getByLabelText(/melody title/i);
      fireEvent.change(input, { target: { value: longTitle } });

      // Click save
      const saveMelodyButton = screen.getByRole('button', { name: /save melody/i });
      fireEvent.click(saveMelodyButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/title must be 200 characters or less/i)).toBeTruthy();
      });
    });

    it('has a character counter in the dialog', () => {
      render(React.createElement(CreatePage));

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(screen.getByText('0/200 characters')).toBeTruthy();
    });
  });

  describe('Requirement 3.4: Successful save redirects to /m/{id}', () => {
    it('saves and redirects to Edit page on successful save', async () => {
      mockSaveMelody.mockResolvedValueOnce('new-melody-id');

      render(React.createElement(CreatePage));

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Enter a valid title
      const input = screen.getByLabelText(/melody title/i);
      fireEvent.change(input, { target: { value: 'My Test Melody' } });

      // Click save
      const saveMelodyButton = screen.getByRole('button', { name: /save melody/i });
      fireEvent.click(saveMelodyButton);

      await waitFor(() => {
        expect(mockSaveMelody).toHaveBeenCalledTimes(1);
      });

      // Should call saveMelody with correct data
      expect(mockSaveMelody).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Test Melody',
          ownerId: 'test-owner-id',
        })
      );

      // Should redirect
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/m/new-melody-id');
      });
    });

    it('displays error when save fails', async () => {
      mockSaveMelody.mockRejectedValueOnce(new Error('Network error'));

      render(React.createElement(CreatePage));

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Enter a valid title
      const input = screen.getByLabelText(/melody title/i);
      fireEvent.change(input, { target: { value: 'My Melody' } });

      // Click save
      const saveMelodyButton = screen.getByRole('button', { name: /save melody/i });
      fireEvent.click(saveMelodyButton);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeTruthy();
      });

      // Should NOT redirect
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 3.5: Cancel closes dialog without saving', () => {
    it('closes dialog when Cancel is clicked', () => {
      render(React.createElement(CreatePage));

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
      expect(screen.getByRole('heading', { name: 'Save Melody' })).toBeTruthy();

      // Click cancel
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Dialog should be closed
      expect(screen.queryByRole('heading', { name: 'Save Melody' })).toBeNull();
    });

    it('clears title and error when Cancel is clicked', () => {
      render(React.createElement(CreatePage));

      // Open dialog and enter a title
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
      const input = screen.getByLabelText(/melody title/i);
      fireEvent.change(input, { target: { value: 'Test Title' } });

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Re-open dialog
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Title should be cleared
      const newInput = screen.getByLabelText(/melody title/i) as HTMLInputElement;
      expect(newInput.value).toBe('');
    });

    it('does not call saveMelody when Cancel is clicked', () => {
      render(React.createElement(CreatePage));

      // Open dialog
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Enter title
      const input = screen.getByLabelText(/melody title/i);
      fireEvent.change(input, { target: { value: 'Test' } });

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockSaveMelody).not.toHaveBeenCalled();
    });
  });
});
