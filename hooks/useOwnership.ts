import { getOwnerId as getOwnerIdUtil, hasOwnerId } from '../utils/owner-id';

/**
 * Return type for the useOwnership hook.
 * Provides owner ID management for melody ownership verification.
 */
export interface UseOwnershipReturn {
  /**
   * The current owner ID for this browser/user.
   * Returns empty string during SSR or if localStorage is unavailable.
   */
  ownerId: string;

  /**
   * Gets the current owner ID, generating one if it doesn't exist.
   * @returns The owner ID (UUID v4 format) or empty string if localStorage is unavailable
   */
  getOwnerId: () => string;

  /**
   * Checks if the current user owns a melody by comparing owner IDs.
   * @param melodyOwnerId - The owner_id stored with the melody
   * @returns true if the current user's owner ID matches the melody's owner ID
   */
  isOwner: (melodyOwnerId: string) => boolean;
}

/**
 * Gets the current owner ID.
 * If no owner ID exists, generates a new UUID v4 and stores it in localStorage.
 * @returns The owner ID (UUID v4 format) or empty string if localStorage is unavailable
 */
function getOwnerId(): string {
  return getOwnerIdUtil();
}

/**
 * Checks if the current user owns a melody.
 * Compares the provided melody owner ID with the current user's owner ID.
 *
 * @param melodyOwnerId - The owner_id from the melody
 * @returns true if the current user owns the melody, false otherwise
 */
function isOwner(melodyOwnerId: string): boolean {
  // During SSR or if localStorage is unavailable, we can't verify ownership
  if (typeof window === 'undefined') {
    return false;
  }

  // If no owner ID exists for current user, they can't own anything
  if (!hasOwnerId()) {
    return false;
  }

  const currentOwnerId = getOwnerIdUtil();

  // Both must be non-empty strings for a valid comparison
  if (!currentOwnerId || !melodyOwnerId) {
    return false;
  }

  return currentOwnerId === melodyOwnerId;
}

/**
 * Custom hook for managing melody ownership.
 *
 * Provides functionality to:
 * - Get the current user's owner ID (generating one if needed)
 * - Check if the current user owns a specific melody
 *
 * The owner ID is stored in localStorage and persists across sessions.
 * During SSR, all ownership checks return false and owner ID is empty.
 *
 * Note: This hook does not use React hooks internally to keep the logic simple
 * and testable. The functions are stable references that don't change between renders.
 *
 * @example
 * ```tsx
 * function MelodyPage({ melody }: { melody: Melody }) {
 *   const { ownerId, isOwner } = useOwnership();
 *
 *   const canEdit = isOwner(melody.ownerId);
 *
 *   return (
 *     <div>
 *       {canEdit && <button>Edit</button>}
 *       {canEdit && <button>Delete</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOwnership(): UseOwnershipReturn {
  // Get the current owner ID - this will generate one if it doesn't exist
  // We compute this on each call, but it's fast since it just reads from localStorage
  const currentOwnerId = typeof window === 'undefined' ? '' : getOwnerIdUtil();

  return {
    ownerId: currentOwnerId,
    getOwnerId,
    isOwner,
  };
}
