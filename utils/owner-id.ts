import { v4 as uuidv4 } from 'uuid';

/**
 * localStorage key for the owner ID.
 */
export const OWNER_ID_STORAGE_KEY = 'tone-sketch-owner-id';

/**
 * Checks if we're running in a browser environment with localStorage available.
 * @returns true if localStorage is available, false otherwise
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if an owner ID exists in localStorage.
 * @returns true if an owner ID exists, false otherwise (including SSR scenarios)
 */
export function hasOwnerId(): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }
  const ownerId = window.localStorage.getItem(OWNER_ID_STORAGE_KEY);
  return ownerId !== null && ownerId.length > 0;
}

/**
 * Gets the owner ID from localStorage, generating and storing a new one if it doesn't exist.
 * Returns an empty string when running server-side (SSR).
 * @returns The owner ID (UUID v4 format) or empty string if localStorage is unavailable
 */
export function getOwnerId(): string {
  if (!isLocalStorageAvailable()) {
    return '';
  }

  let ownerId = window.localStorage.getItem(OWNER_ID_STORAGE_KEY);

  if (!ownerId || ownerId.length === 0) {
    ownerId = uuidv4();
    window.localStorage.setItem(OWNER_ID_STORAGE_KEY, ownerId);
  }

  return ownerId;
}

/**
 * Clears the owner ID from localStorage.
 * Useful for testing and debugging purposes.
 */
export function clearOwnerId(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }
  window.localStorage.removeItem(OWNER_ID_STORAGE_KEY);
}
