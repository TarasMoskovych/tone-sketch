/**
 * Format a duration in seconds to a human-readable string.
 * - < 60s: "0:SS" (e.g., "0:05")
 * - 60s to < 3600s: "M:SS" (e.g., "1:05")
 * - >= 3600s: "H:MM:SS" (e.g., "1:02:30")
 *
 * Returns "0:00" for invalid inputs (undefined, null, negative, zero).
 */
export function formatDuration(durationSeconds: number | null | undefined): string {
  if (durationSeconds === null || durationSeconds === undefined || durationSeconds <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    const paddedMinutes = minutes.toString().padStart(2, '0');
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}
