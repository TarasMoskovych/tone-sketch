'use client';

/**
 * PianoRollSkeleton component
 *
 * Loading skeleton for the piano roll canvas area.
 * Displays a visual placeholder while the piano roll is loading.
 *
 * Requirements:
 * - 19.2: Display loading indicator while fetching melody data
 */

interface PianoRollSkeletonProps {
  /** Additional CSS class names */
  className?: string;
}

/**
 * Configuration matching PianoRollCanvas styles
 */
const SKELETON_CONFIG = {
  PITCH_LABEL_WIDTH: 50,
  TIME_MARKER_HEIGHT: 24,
  ROW_COUNT: 12,
  COLUMN_COUNT: 8,
};

export function PianoRollSkeleton({ className = '' }: PianoRollSkeletonProps) {
  const { PITCH_LABEL_WIDTH, TIME_MARKER_HEIGHT, ROW_COUNT, COLUMN_COUNT } = SKELETON_CONFIG;

  return (
    <div
      className={`relative bg-gray-900 overflow-hidden ${className}`}
      role="status"
      aria-label="Loading piano roll editor"
    >
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-800/30 to-transparent animate-shimmer" />

      {/* Time marker area skeleton */}
      <div
        className="absolute top-0 right-0 bg-gray-800 border-b border-gray-700"
        style={{
          left: PITCH_LABEL_WIDTH,
          height: TIME_MARKER_HEIGHT,
        }}
      >
        <div className="flex items-center h-full px-4 gap-8">
          {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
            <div
              key={i}
              className="w-8 h-3 bg-gray-700 rounded animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Pitch label area skeleton */}
      <div
        className="absolute left-0 bg-gray-800 border-r border-gray-700"
        style={{
          top: TIME_MARKER_HEIGHT,
          width: PITCH_LABEL_WIDTH,
          bottom: 0,
        }}
      >
        <div className="flex flex-col h-full py-2">
          {Array.from({ length: ROW_COUNT }).map((_, i) => (
            <div
              key={i}
              className="flex-1 flex items-center justify-end px-2"
            >
              <div
                className="w-8 h-4 bg-gray-700 rounded animate-pulse"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Grid area skeleton */}
      <div
        className="absolute bg-gray-850"
        style={{
          top: TIME_MARKER_HEIGHT,
          left: PITCH_LABEL_WIDTH,
          right: 0,
          bottom: 0,
        }}
      >
        {/* Grid lines */}
        <div className="absolute inset-0">
          {/* Horizontal lines */}
          {Array.from({ length: ROW_COUNT + 1 }).map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute left-0 right-0 h-px bg-gray-700"
              style={{ top: `${(i / ROW_COUNT) * 100}%` }}
            />
          ))}
          {/* Vertical lines */}
          {Array.from({ length: COLUMN_COUNT + 1 }).map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute top-0 bottom-0 w-px bg-gray-700"
              style={{ left: `${(i / COLUMN_COUNT) * 100}%` }}
            />
          ))}
        </div>

        {/* Placeholder notes */}
        <div className="absolute inset-0 p-4">
          <div className="relative w-full h-full">
            {/* Fake note placeholders */}
            <div
              className="absolute w-24 h-6 bg-gray-700/50 rounded animate-pulse"
              style={{ top: '20%', left: '10%', animationDelay: '0ms' }}
            />
            <div
              className="absolute w-16 h-6 bg-gray-700/50 rounded animate-pulse"
              style={{ top: '35%', left: '25%', animationDelay: '200ms' }}
            />
            <div
              className="absolute w-32 h-6 bg-gray-700/50 rounded animate-pulse"
              style={{ top: '50%', left: '15%', animationDelay: '400ms' }}
            />
            <div
              className="absolute w-20 h-6 bg-gray-700/50 rounded animate-pulse"
              style={{ top: '65%', left: '40%', animationDelay: '600ms' }}
            />
          </div>
        </div>
      </div>

      {/* Loading text (screen reader only) */}
      <span className="sr-only">Loading piano roll editor, please wait...</span>
    </div>
  );
}

export default PianoRollSkeleton;
