/**
 * Text utilities for display formatting
 *
 * Provides functions for text manipulation and display formatting.
 */

/**
 * Default maximum title length for truncation
 * Requirement 22.2: Truncate titles longer than 100 characters
 */
export const DEFAULT_MAX_TITLE_LENGTH = 100;

/**
 * Ellipsis string used when truncating text
 */
export const ELLIPSIS = '...';

/**
 * Truncates a title to a maximum length with ellipsis
 *
 * Property 18: Title Truncation in Feed
 * - If length > maxLength characters, display shows first maxLength characters followed by ellipsis ("...")
 * - If length ≤ maxLength characters, display shows the complete title
 *
 * Requirement 22.2: Truncate titles longer than 100 characters
 *
 * @param title - The original title string
 * @param maxLength - Maximum length before truncation (default: 100)
 * @returns Truncated title with ellipsis if needed, or original title if within limit
 */
export function truncateTitle(title: string, maxLength: number = DEFAULT_MAX_TITLE_LENGTH): string {
  // Handle edge cases
  if (typeof title !== 'string') {
    return '';
  }

  if (title.length <= maxLength) {
    return title;
  }

  return `${title.slice(0, maxLength)}${ELLIPSIS}`;
}
