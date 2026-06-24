import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OWNER_ID_STORAGE_KEY } from '../../utils/owner-id';

// Since we're testing in a node environment without jsdom, we'll test the hook's
// underlying logic directly by importing and invoking the functions it uses.

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

describe('useOwnership hook logic', () => {
  let mockLocalStorage: Storage;
  let originalWindow: typeof globalThis.window;
  // We need to import dynamically to reset module state between tests
  let useOwnership: typeof import('../../hooks/useOwnership').useOwnership;

  beforeEach(async () => {
    // Save original window
    originalWindow = globalThis.window;

    // Create fresh mock localStorage
    mockLocalStorage = createMockLocalStorage();

    // Mock window with localStorage
    globalThis.window = {
      localStorage: mockLocalStorage,
    } as unknown as Window & typeof globalThis;

    // Clear module cache and re-import to get fresh state
    vi.resetModules();
    const ownershipModule = await import('../../hooks/useOwnership');
    useOwnership = ownershipModule.useOwnership;
  });

  afterEach(() => {
    // Restore original window
    globalThis.window = originalWindow;
    vi.clearAllMocks();
  });

  describe('getOwnerId()', () => {
    it('should return a valid UUID v4 when called', () => {
      // Simulate calling the hook by invoking its returned function
      const hookResult = useOwnership();
      const ownerId = hookResult.getOwnerId();

      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(ownerId).toMatch(uuidV4Regex);
    });

    it('should return the same ID on subsequent calls', () => {
      const hookResult = useOwnership();

      const firstId = hookResult.getOwnerId();
      const secondId = hookResult.getOwnerId();

      expect(firstId).toBe(secondId);
    });

    it('should persist the owner ID to localStorage', () => {
      const hookResult = useOwnership();
      const ownerId = hookResult.getOwnerId();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(OWNER_ID_STORAGE_KEY, ownerId);
    });

    it('should return the stored owner ID if one exists', () => {
      const storedId = '550e8400-e29b-41d4-a716-446655440000';
      mockLocalStorage.setItem(OWNER_ID_STORAGE_KEY, storedId);

      const hookResult = useOwnership();
      const ownerId = hookResult.getOwnerId();

      expect(ownerId).toBe(storedId);
    });
  });

  describe('ownerId property', () => {
    it('should return a valid UUID v4 owner ID', () => {
      const hookResult = useOwnership();

      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(hookResult.ownerId).toMatch(uuidV4Regex);
    });

    it('should return the stored owner ID if one exists', () => {
      const storedId = '550e8400-e29b-41d4-a716-446655440000';
      mockLocalStorage.setItem(OWNER_ID_STORAGE_KEY, storedId);

      const hookResult = useOwnership();

      expect(hookResult.ownerId).toBe(storedId);
    });
  });

  describe('isOwner()', () => {
    it('should return true when the melody owner ID matches the current owner ID', () => {
      const hookResult = useOwnership();

      const currentOwnerId = hookResult.getOwnerId();
      const result = hookResult.isOwner(currentOwnerId);

      expect(result).toBe(true);
    });

    it('should return false when the melody owner ID does not match', () => {
      const hookResult = useOwnership();

      hookResult.getOwnerId(); // Ensure we have an owner ID
      const differentOwnerId = '550e8400-e29b-41d4-a716-446655440000';
      const result = hookResult.isOwner(differentOwnerId);

      expect(result).toBe(false);
    });

    it('should return false for empty melody owner ID', () => {
      const hookResult = useOwnership();

      hookResult.getOwnerId(); // Ensure we have an owner ID
      const result = hookResult.isOwner('');

      expect(result).toBe(false);
    });

    it('should return false when no owner ID exists in localStorage and checking ownership', async () => {
      // Clear localStorage and reset modules to get fresh state
      mockLocalStorage.clear();
      vi.resetModules();

      // Mock getItem to return null consistently
      vi.mocked(mockLocalStorage.getItem).mockReturnValue(null);

      const freshModule = await import('../../hooks/useOwnership');
      const freshHook = freshModule.useOwnership();

      // The isOwner should return false since hasOwnerId will return false
      const result = freshHook.isOwner('some-owner-id');

      expect(result).toBe(false);
    });
  });

  describe('SSR behavior', () => {
    it('should return empty string for ownerId when window is undefined', async () => {
      // Simulate SSR by removing window
      // @ts-expect-error - intentionally setting to undefined for SSR test
      globalThis.window = undefined;

      vi.resetModules();
      const ownershipModule = await import('../../hooks/useOwnership');
      const hookResult = ownershipModule.useOwnership();

      expect(hookResult.ownerId).toBe('');
    });

    it('should return false for isOwner when window is undefined', async () => {
      // @ts-expect-error - intentionally setting to undefined for SSR test
      globalThis.window = undefined;

      vi.resetModules();
      const ownershipModule = await import('../../hooks/useOwnership');
      const hookResult = ownershipModule.useOwnership();

      expect(hookResult.isOwner('any-owner-id')).toBe(false);
    });

    it('should return empty string for getOwnerId when window is undefined', async () => {
      // @ts-expect-error - intentionally setting to undefined for SSR test
      globalThis.window = undefined;

      vi.resetModules();
      const ownershipModule = await import('../../hooks/useOwnership');
      const hookResult = ownershipModule.useOwnership();

      expect(hookResult.getOwnerId()).toBe('');
    });
  });

  describe('interface compliance', () => {
    it('should return an object with ownerId, getOwnerId, and isOwner', () => {
      const hookResult = useOwnership();

      expect(hookResult).toHaveProperty('ownerId');
      expect(hookResult).toHaveProperty('getOwnerId');
      expect(hookResult).toHaveProperty('isOwner');
      expect(typeof hookResult.ownerId).toBe('string');
      expect(typeof hookResult.getOwnerId).toBe('function');
      expect(typeof hookResult.isOwner).toBe('function');
    });
  });
});
