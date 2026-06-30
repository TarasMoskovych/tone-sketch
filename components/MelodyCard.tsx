'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import type * as Tone from 'tone';
import type { MelodySummary } from '../types/melody';
import { truncateTitle } from '../utils/text';
import { formatDuration } from '../utils/duration';
import { AudioVisualizer } from './AudioVisualizer';
import { PlayIcon, StopIcon, LoadingIcon, MusicNoteIcon } from './icons';

/**
 * Props for the MelodyCard component
 *
 * Implements the interface defined in the design document for feed melody items.
 * Requirements: 39.2, 39.3, 39.5
 */
export interface MelodyCardProps {
  /** Melody summary data for display */
  melody: MelodySummary;
  /** Whether this melody is currently playing */
  isPlaying: boolean;
  /** Whether melody data is being loaded for preview */
  isLoading: boolean;
  /**
   * Callback when play button is clicked
   * Requirement 23.1: Begin audio playback when play clicked
   */
  onPlayClick: () => void;
  /**
   * Callback when stop button is clicked
   * Requirement 23.2: Stop current playback when different melody clicked
   */
  onStopClick: () => void;
  /** Reference to the Tone.Analyser node for the inline visualizer */
  analyserRef?: React.RefObject<Tone.Analyser | null>;
  /** Whether to show the inline audio visualizer */
  showVisualizer?: boolean;
}

/**
 * Configuration for button styles - matches TransportControls styling
 */
const BUTTON_STYLES = {
  base: 'flex items-center justify-center rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900',
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500',
  active: 'bg-indigo-500 text-white ring-2 ring-indigo-400',
  size: {
    default: 'w-10 h-10',
    icon: 'w-5 h-5',
  },
};

/**
 * Formats a date string in relative time format
 *
 * Requirement 22.3: Display creation date in relative format ("2 hours ago")
 *
 * @param dateString - ISO 8601 formatted date string
 * @returns Relative time string (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Less than a minute
  if (diffInSeconds < 60) {
    return 'just now';
  }

  // Less than an hour
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
  }

  // Less than a day
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  }

  // Less than a week
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
  }

  // Less than a month (approx 30 days)
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInDays < 30) {
    return diffInWeeks === 1 ? '1 week ago' : `${diffInWeeks} weeks ago`;
  }

  // Less than a year
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInDays < 365) {
    return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`;
  }

  // Years
  const diffInYears = Math.floor(diffInDays / 365);
  return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`;
}

/**
 * MelodyCard component
 *
 * Individual feed item displaying melody information with play preview and navigation.
 * Used in the public feed to display melody summaries.
 *
 * Requirements:
 * - 22.2: Display melody title (truncated to 100 chars with ellipsis)
 * - 22.2: Display creation date
 * - 22.3: Provide play button for preview playback
 * - 23.1: Begin audio playback when play clicked
 * - 23.4: Display loading indicator while fetching
 * - 24.1: Navigate to /m/[id] when card clicked
 * - 24.2: Render as clickable element with title as primary link text
 * - 24.3: Entire card area is clickable for navigation
 */
export function MelodyCard({
  melody,
  isPlaying,
  isLoading,
  onPlayClick,
  onStopClick,
  analyserRef,
  showVisualizer = false,
}: MelodyCardProps) {
  /**
   * Handle play/stop button click
   * Prevents navigation when clicking the play button
   */
  const handlePlayButtonClick = useCallback(
    (event: React.MouseEvent) => {
      // Prevent the link navigation when clicking play button
      event.preventDefault();
      event.stopPropagation();

      if (isPlaying) {
        onStopClick();
      } else {
        onPlayClick();
      }
    },
    [isPlaying, onPlayClick, onStopClick]
  );

  const truncatedTitle = truncateTitle(melody.title);
  const formattedDate = formatRelativeTime(melody.createdAt);

  return (
    <Link
      href={`/m/${melody.id}`}
      className="block group"
      aria-label={`View melody: ${melody.title}`}
    >
      <article
        className={`
          relative flex items-center gap-4 p-4 rounded-xl
          bg-gray-800 hover:bg-gray-750 dark:bg-gray-800 dark:hover:bg-gray-700
          border border-gray-700 hover:border-gray-600
          transition-all duration-200
          cursor-pointer
          ${isPlaying ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}
        `}
      >
        {/* Visual preview - Music note icon */}
        <div
          className={`
            flex-shrink-0 flex items-center justify-center
            w-14 h-14 rounded-lg
            bg-gray-700 group-hover:bg-gray-600
            transition-colors duration-200
            ${isPlaying ? 'bg-indigo-600 group-hover:bg-indigo-500' : ''}
          `}
        >
          <MusicNoteIcon
            className={`w-7 h-7 ${isPlaying ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}
          />
        </div>

        {/* Melody info */}
        <div className="flex-1 min-w-0">
          {/* Title - Requirement 22.2, 24.2 */}
          <h3
            className="text-base font-medium text-white truncate group-hover:text-indigo-300 transition-colors duration-200"
            title={melody.title}
          >
            {truncatedTitle}
          </h3>

          {/* Duration - Requirements 2.1, 2.7 */}
          <p className="mt-1 text-sm text-gray-400">
            {formatDuration(melody.durationSeconds)}
          </p>

          {/* Creation date - Requirement 22.2 */}
          <p className="mt-1 text-sm text-gray-400">
            {formattedDate}
          </p>
        </div>

        {/* Inline audio visualizer - shown when playing or fading out */}
        {showVisualizer && analyserRef && (
          <div className="flex-shrink-0 w-24">
            <AudioVisualizer
              analyserRef={analyserRef}
              barCount={16}
              isPlaying={isPlaying}
              height={32}
            />
          </div>
        )}

        {/* Play/Stop button - Requirement 22.3, 23.1 */}
        <button
          type="button"
          onClick={handlePlayButtonClick}
          disabled={isLoading}
          className={`
            ${BUTTON_STYLES.base}
            ${BUTTON_STYLES.size.default}
            ${isPlaying ? BUTTON_STYLES.active : BUTTON_STYLES.primary}
            ${isLoading ? 'opacity-50 cursor-wait' : ''}
            flex-shrink-0
          `}
          aria-label={
            isLoading
              ? 'Loading preview...'
              : isPlaying
              ? 'Stop preview'
              : 'Play preview'
          }
          title={
            isLoading
              ? 'Loading...'
              : isPlaying
              ? 'Stop preview'
              : 'Play preview'
          }
        >
          {isLoading ? (
            <LoadingIcon className={BUTTON_STYLES.size.icon} />
          ) : isPlaying ? (
            <StopIcon className={BUTTON_STYLES.size.icon} />
          ) : (
            <PlayIcon className={BUTTON_STYLES.size.icon} />
          )}
        </button>

        {/* Playing indicator for screen readers */}
        {isPlaying && (
          <span className="sr-only" aria-live="polite">
            Now playing: {melody.title}
          </span>
        )}

        {/* Loading indicator for screen readers */}
        {isLoading && (
          <span className="sr-only" aria-live="polite">
            Loading preview for: {melody.title}
          </span>
        )}
      </article>
    </Link>
  );
}

export default MelodyCard;
