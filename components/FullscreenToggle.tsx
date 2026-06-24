'use client';

import { ExpandIcon } from './icons';

export interface FullscreenToggleProps {
  isFullscreen: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * FullscreenToggle component
 *
 * A reusable button to toggle fullscreen mode for the piano roll.
 * Shows "Expand" when not fullscreen and "Exit" when in fullscreen mode.
 */
export function FullscreenToggle({
  isFullscreen,
  onToggle,
  className = '',
}: FullscreenToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors ${className}`}
      title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen piano roll'}
    >
      <ExpandIcon expanded={isFullscreen} className="w-4 h-4" />
      {isFullscreen ? 'Exit' : 'Expand'}
    </button>
  );
}

export default FullscreenToggle;
