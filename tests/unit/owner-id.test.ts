import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getOwnerId,
  hasOwnerId,
  clearOwnerId,
  OWNER_ID_STORAGE_KEY,
} from '../../utils/owner-id';

/**
 * Mock localStorage implementation for testing.
 */
function createMockLocalStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
}

describe('Owner ID Utility', () => {
  let mockLocalStorage: Storage;
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    // Save original window
    originalWindow = globalThis.window;

    // Create fresh mock localStorage
    mockLocalStorage = createMockLocalStorage();

    // Mock window with localStorage
    globalThis.window = {
      localStorage: mockLocalStorage,
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    // Restore original window
    globalThis.window = originalWindow;
    vi.clearAllMocks();
  });

  describe('getOwnerId()', () => {
    it('should return a new UUID when localStorage is empty', () => {
      const ownerId = getOwnerId();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(ownerId).toMatch(uuidV4Regex);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(OWNER_ID_STORAGE_KEY, ownerId);
    });

    it('should return the same UUID on subsequent calls', () => {
      const firstOwnerId = getOwnerId();
      const secondOwnerId = getOwnerId();

      expect(firstOwnerId).toBe(secondOwnerId);
    });

    it('should return the previously stored UUID', () => {
      const storedId = '550e8400-e29b-41d4-a716-446655440000';
      mockLocalStorage.setItem(OWNER_ID_STORAGE_KEY, storedId);

      const ownerId = getOwnerId();

      expect(ownerId).toBe(storedId);
    });

    it('should generate new UUID if stored value is empty string', () => {
      mockLocalStorage.setItem(OWNER_ID_STORAGE_KEY, '');

      const ownerId = getOwnerId();

      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(ownerId).toMatch(uuidV4Regex);
      expect(ownerId).not.toBe('');
    });
  });

  describe('hasOwnerId()', () => {
    it('should return false when no owner ID exists', () => {
      const result = hasOwnerId();

      expect(result).toBe(false);
    });

    it('should return true after owner ID is created', () => {
      getOwnerId(); // This creates and stores the owner ID

      const result = hasOwnerId();

      expect(result).toBe(true);
    });

    it('should return false if stored value is empty string', () => {
      mockLocalStorage.setItem(OWNER_ID_STORAGE_KEY, '');

      const result = hasOwnerId();

      expect(result).toBe(false);
    });

    it('should return true when owner ID exists in localStorage', () => {
      mockLocalStorage.setItem(OWNER_ID_STORAGE_KEY, 'some-uuid');

      const result = hasOwnerId();

      expect(result).toBe(true);
    });
  });

  describe('clearOwnerId()', () => {
    it('should remove owner ID from localStorage', () => {
      // First create an owner ID
      getOwnerId();
      expect(hasOwnerId()).toBe(true);

      // Clear it
      clearOwnerId();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(OWNER_ID_STORAGE_KEY);
    });

    it('should result in hasOwnerId() returning false after clear', () => {
      // First create an owner ID
      getOwnerId();
      expect(hasOwnerId()).toBe(true);

      // Clear it
      clearOwnerId();

      expect(hasOwnerId()).toBe(false);
    });

    it('should allow a new UUID to be generated after clearing', () => {
      const firstId = getOwnerId();
      clearOwnerId();

      // Force localStorage to return null after clear
      vi.mocked(mockLocalStorage.getItem).mockReturnValueOnce(null);

      const secondId = getOwnerId();

      // The second ID should be different (new UUID generated)
      expect(secondId).not.toBe(firstId);
    });
  });

  describe('SSR/Edge cases', () => {
    it('should return empty string when window is undefined (SSR)', () => {
      // Simulate SSR by removing window
      // @ts-expect-error - intentionally setting to undefined for SSR test
      globalThis.window = undefined;

      const ownerId = getOwnerId();

      expect(ownerId).toBe('');
    });

    it('should return false for hasOwnerId when window is undefined (SSR)', () => {
      // @ts-expect-error - intentionally setting to undefined for SSR test
      globalThis.window = undefined;

      const result = hasOwnerId();

      expect(result).toBe(false);
    });

    it('should handle clearOwnerId gracefully when window is undefined (SSR)', () => {
      // @ts-expect-error - intentionally setting to undefined for SSR test
      globalThis.window = undefined;

      // Should not throw
      expect(() => clearOwnerId()).not.toThrow();
    });

    it('should handle localStorage errors gracefully', () => {
      // Create a localStorage that throws on setItem
      const errorStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceededError');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      };

      globalThis.window = {
        localStorage: errorStorage,
      } as unknown as Window & typeof globalThis;

      // Should return empty string when localStorage is inaccessible
      const ownerId = getOwnerId();
      expect(ownerId).toBe('');
    });

    it('should handle localStorage errors during availability check', () => {
      // Create a localStorage that throws on setItem (used in availability check)
      const errorStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw new Error('SecurityError');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(() => null),
      };

      globalThis.window = {
        localStorage: errorStorage,
      } as unknown as Window & typeof globalThis;

      // Should return false when localStorage throws errors
      const result = hasOwnerId();
      expect(result).toBe(false);
    });
  });

  describe('OWNER_ID_STORAGE_KEY constant', () => {
    it('should export the correct storage key', () => {
      expect(OWNER_ID_STORAGE_KEY).toBe('tone-sketch-owner-id');
    });
  });
});
