/**
 * Icon components module
 *
 * All SVG icons are centralized here for reusability and maintainability.
 * Each icon accepts className prop for Tailwind styling, optional size,
 * and aria-hidden for accessibility.
 *
 * Requirements: 39.1, 39.4
 */

/**
 * Common props interface for all icon components
 *
 * @property className - Optional CSS class names for Tailwind styling
 * @property size - Optional size in pixels (applies to both width and height)
 * @property aria-hidden - Whether the icon should be hidden from assistive technologies
 */
export interface IconProps {
  /** Optional CSS class names for Tailwind styling */
  className?: string;
  /** Optional size in pixels (applies to both width and height) */
  size?: number;
  /** Whether the icon should be hidden from assistive technologies (default: true) */
  'aria-hidden'?: boolean;
}

// Transport control icons
export { PlayIcon } from './PlayIcon';
export { PauseIcon } from './PauseIcon';
export { StopIcon } from './StopIcon';
export { LoopIcon } from './LoopIcon';

// Action icons
export { DeleteIcon } from './DeleteIcon';
export { SaveIcon } from './SaveIcon';
export { UploadIcon } from './UploadIcon';
export { DownloadIcon } from './DownloadIcon';

// State and UI icons
export { ErrorIcon } from './ErrorIcon';
export { LoadingIcon } from './LoadingIcon';
export { ChevronIcon } from './ChevronIcon';
export type { ChevronIconProps } from './ChevronIcon';
export { GridIcon } from './GridIcon';
export { MusicNoteIcon } from './MusicNoteIcon';
export { HomeIcon } from './HomeIcon';
export { RefreshIcon } from './RefreshIcon';
export { CloseIcon } from './CloseIcon';
export { ExpandIcon } from './ExpandIcon';

// Social icons
export { GitHubIcon } from './GitHubIcon';
export { LinkedInIcon } from './LinkedInIcon';
