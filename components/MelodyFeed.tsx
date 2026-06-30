'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MelodyCard } from './MelodyCard';
import { useFeedPreview } from '@/hooks';
import type { MelodySummary } from '../types/melody';
import { MusicNoteIcon, ErrorIcon, LoadingIcon, CloseIcon } from './icons';

/**
 * Response type from GET /api/melodies endpoint
 */
interface GetMelodiesResponse {
  melodies: MelodySummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Props for the MelodyFeed component
 */
export interface MelodyFeedProps {
  /** Initial melodies to display (server-side rendered) */
  initialMelodies?: MelodySummary[];
}

/**
 * Loading skeleton for melody cards
 */
function MelodyCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-800 border border-gray-700 animate-pulse">
      {/* Icon placeholder */}
      <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-gray-700" />

      {/* Content placeholder */}
      <div className="flex-1 min-w-0">
        <div className="h-5 w-3/4 bg-gray-700 rounded mb-2" />
        <div className="h-4 w-1/3 bg-gray-700 rounded" />
      </div>

      {/* Button placeholder */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-700" />
    </div>
  );
}

/**
 * Empty state when no melodies exist
 * Requirement 22.6: Display empty state message when no melodies available
 * Requirements: 39.2, 39.3, 39.5
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <MusicNoteIcon className="w-16 h-16 text-gray-500 mb-4" />
      <h2 className="text-xl font-semibold text-gray-300 mb-2">
        No melodies yet
      </h2>
      <p className="text-gray-400 max-w-sm">
        Be the first to create a melody! Click the &quot;Create&quot; button to get started.
      </p>
    </div>
  );
}

/**
 * Error state for feed loading failures
 * Requirements: 39.2, 39.3, 39.5
 */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <ErrorIcon className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-xl font-semibold text-gray-300 mb-2">
        Failed to load melodies
      </h2>
      <p className="text-gray-400 max-w-sm mb-4">
        Something went wrong while loading the melodies. Please try again.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        Try Again
      </button>
    </div>
  );
}

/**
 * Loading indicator for infinite scroll
 * Requirements: 39.2, 39.3, 39.5
 */
function LoadingIndicator() {
  return (
    <div className="flex justify-center py-4">
      <LoadingIcon
        className="w-8 h-8 text-indigo-500"
        aria-hidden={false}
      />
      <span className="sr-only">Loading more melodies</span>
    </div>
  );
}

/**
 * MelodyFeed component
 *
 * Homepage feed displaying paginated melody list with infinite scroll and preview capabilities.
 * Uses the MelodyCard component for individual items and useFeedPreview hook for preview playback.
 *
 * Requirements:
 * - 22.1: Display first 20 melodies ordered by creation date (newest first)
 * - 22.4: Load next 20 melodies on scroll to bottom (infinite scroll)
 * - 22.5: Load feed data using GET /api/melodies with page and limit
 * - 22.6: Display empty state message when no melodies available
 * - 23.1: Begin audio playback when play clicked with visual indicator
 * - 23.2: Stop current playback when playing different melody
 * - 23.3: Fetch full melody data before playback
 * - 23.4: Display loading indicator while fetching
 * - 23.5: Display error if fetch fails
 * - 23.6: Display error if playback fails
 * - 30.3: Complete item rendering within 16ms
 * - 38.1: Uses useFeedPreview hook for preview playback state management
 */
export function MelodyFeed({ initialMelodies = [] }: MelodyFeedProps) {
  // Melody list state
  const [melodies, setMelodies] = useState<MelodySummary[]>(initialMelodies);
  const [page, setPage] = useState(initialMelodies.length > 0 ? 1 : 0);
  const [hasMore, setHasMore] = useState(true);

  // Loading and error states for feed
  const [isLoading, setIsLoading] = useState(initialMelodies.length === 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the useFeedPreview hook for preview playback state management
  // Requirements 23.1-23.6, 38.1
  const {
    previewingMelodyId,
    isPreviewLoading,
    previewError,
    playPreview,
    stopPreview,
    analyserRef,
  } = useFeedPreview();

  // Track which melody should show the visualizer during fade-out.
  // fadingOutMelodyId holds the ID of a melody whose visualizer is fading out.
  const [fadingOutMelodyId, setFadingOutMelodyId] = useState<string | null>(null);
  const prevPreviewingIdRef = useRef<string | null>(null);

  // Detect transitions: when previewingMelodyId changes from a value to null,
  // start the fade-out on the previously-playing melody.
  useEffect(() => {
    const prevId = prevPreviewingIdRef.current;
    prevPreviewingIdRef.current = previewingMelodyId;

    if (!previewingMelodyId && prevId) {
      // Playback just stopped — start fade-out
      setFadingOutMelodyId(prevId);
    } else if (previewingMelodyId) {
      // A new melody started — cancel any existing fade-out
      setFadingOutMelodyId(null);
    }
  }, [previewingMelodyId]);

  // Clear fade-out state after animation completes (~800ms)
  useEffect(() => {
    if (fadingOutMelodyId) {
      const timeout = setTimeout(() => {
        setFadingOutMelodyId(null);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [fadingOutMelodyId]);

  // Determine which melody should show the visualizer
  const visualizerMelodyId = previewingMelodyId ?? fadingOutMelodyId;

  // Track which melody is currently loading for preview (for UI indicator)
  const [loadingMelodyId, setLoadingMelodyId] = useState<string | null>(null);

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  /**
   * Fetch melodies from the API
   * Requirement 22.5: Load feed data using GET /api/melodies
   */
  const fetchMelodies = useCallback(async (pageNum: number, isLoadMore: boolean = false) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(`/api/melodies?page=${pageNum}&limit=20`);

      if (!response.ok) {
        throw new Error('Failed to fetch melodies');
      }

      const data: GetMelodiesResponse = await response.json();

      if (isLoadMore) {
        setMelodies(prev => [...prev, ...data.melodies]);
      } else {
        setMelodies(data.melodies);
      }

      setPage(pageNum);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Error fetching melodies:', err);
      if (!isLoadMore) {
        setError('Failed to load melodies');
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  /**
   * Load initial data if no initial melodies provided
   */
  useEffect(() => {
    if (initialMelodies.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional data fetch on mount
      void fetchMelodies(1);
    }
  }, [fetchMelodies, initialMelodies.length]);

  /**
   * Set up intersection observer for infinite scroll
   * Requirement 22.4: Load next 20 melodies on scroll to bottom
   */
  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Don't observe if no more melodies or currently loading
    if (!hasMore || isLoadingMore || isLoading) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          fetchMelodies(page + 1, true);
        }
      },
      {
        root: null,
        rootMargin: '100px', // Start loading before user reaches bottom
        threshold: 0.1,
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, isLoading, page, fetchMelodies]);

  /**
   * Handle play button click on a melody card
   * Uses useFeedPreview hook for playback management
   */
  const handlePlayClick = useCallback((melodyId: string) => {
    // If clicking the same melody that's playing, it will stop — set fade-out
    if (previewingMelodyId === melodyId) {
      setFadingOutMelodyId(melodyId);
    }
    setLoadingMelodyId(melodyId);
    playPreview(melodyId);
  }, [playPreview, previewingMelodyId]);

  /**
   * Handle stop button click on a melody card
   * Set fadingOutMelodyId synchronously before stopping to prevent unmount flicker
   */
  const handleStopClick = useCallback(() => {
    if (previewingMelodyId) {
      setFadingOutMelodyId(previewingMelodyId);
    }
    setLoadingMelodyId(null);
    stopPreview();
  }, [stopPreview, previewingMelodyId]);

  // Clear loading indicator when preview starts or stops
  useEffect(() => {
    if (!isPreviewLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync loading state with preview
      setLoadingMelodyId(null);
    }
  }, [isPreviewLoading]);

  /**
   * Retry loading after error
   */
  const handleRetry = useCallback(() => {
    fetchMelodies(1);
  }, [fetchMelodies]);

  // Dismiss preview error
  const handleDismissError = useCallback(() => {
    // The useFeedPreview hook clears error on next playPreview call
    // For dismissing, we just stop the preview which clears state
    stopPreview();
  }, [stopPreview]);

  // Show loading skeletons on initial load
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Loading melodies">
        {Array.from({ length: 5 }).map((_, index) => (
          <MelodyCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  // Show error state
  if (error && melodies.length === 0) {
    return <ErrorState onRetry={handleRetry} />;
  }

  // Show empty state
  // Requirement 22.6: Display empty state when no melodies
  if (melodies.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Preview error notification */}
      {previewError && (
        <div
          className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-300"
          role="alert"
        >
          <ErrorIcon className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{previewError}</span>
          <button
            onClick={handleDismissError}
            className="ml-auto p-1 hover:bg-red-800/30 rounded transition-colors"
            aria-label="Dismiss error"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Melody list */}
      <div
        className="flex flex-col gap-4"
        role="feed"
        aria-label="Melody feed"
        aria-busy={isLoadingMore}
      >
        {melodies.map((melody) => (
          <React.Fragment key={melody.id}>
            <MelodyCard
              melody={melody}
              isPlaying={previewingMelodyId === melody.id}
              isLoading={loadingMelodyId === melody.id && isPreviewLoading}
              onPlayClick={() => handlePlayClick(melody.id)}
              onStopClick={handleStopClick}
              analyserRef={analyserRef}
              showVisualizer={visualizerMelodyId === melody.id}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Infinite scroll trigger element */}
      {hasMore && (
        <div ref={loadMoreRef} className="min-h-[1px]">
          {isLoadingMore && <LoadingIndicator />}
        </div>
      )}

      {/* End of feed message */}
      {!hasMore && melodies.length > 0 && (
        <p className="text-center text-gray-500 py-4">
          You&apos;ve reached the end of the feed
        </p>
      )}
    </div>
  );
}

export default MelodyFeed;
