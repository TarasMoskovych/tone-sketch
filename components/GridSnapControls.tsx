'use client';

import { useCallback } from 'react';
import type { GridSnapConfig, GridDivision } from '@/types/grid';
import { GridIcon } from './icons';

/**
 * Props for the GridSnapControls component
 *
 * Implements the interface defined in the design document for grid snap configuration.
 * Requirements: 39.2, 39.3, 39.5
 */
export interface GridSnapControlsProps {
  /** Current grid snap configuration */
  config: GridSnapConfig;
  /** Callback when configuration changes */
  onChange: (config: GridSnapConfig) => void;
  /** Whether controls are disabled (e.g., read-only mode) */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Grid division options with display labels
 * Requirement 7.2: Grid division options of 1, 1/2, 1/4, 1/8, 1/16 beat
 */
const DIVISION_OPTIONS: Array<{ value: GridDivision; label: string; shortLabel: string }> = [
  { value: 1, label: '1 Beat', shortLabel: '1' },
  { value: 0.5, label: '1/2 Beat', shortLabel: '1/2' },
  { value: 0.25, label: '1/4 Beat', shortLabel: '1/4' },
  { value: 0.125, label: '1/8 Beat', shortLabel: '1/8' },
  { value: 0.0625, label: '1/16 Beat', shortLabel: '1/16' },
];

/**
 * Shared styles for form elements
 */
const STYLES = {
  container: 'bg-gray-800 rounded-lg p-3',
  row: 'flex items-center gap-3',
  label: 'text-xs text-gray-400',
  toggle: 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed',
  toggleEnabled: 'bg-indigo-600',
  toggleDisabled: 'bg-gray-600',
  toggleKnob: 'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
  toggleKnobEnabled: 'translate-x-6',
  toggleKnobDisabled: 'translate-x-1',
  divisionContainer: 'flex items-center gap-1',
  divisionButton: 'px-2 py-1 text-xs rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed',
  divisionButtonActive: 'bg-indigo-600 text-white',
  divisionButtonInactive: 'bg-gray-700 text-gray-300 hover:bg-gray-600',
  stateIndicator: 'flex items-center gap-1.5',
  statusDot: 'w-2 h-2 rounded-full',
  statusDotEnabled: 'bg-indigo-500',
  statusDotDisabled: 'bg-gray-500',
  statusText: 'text-xs text-gray-400',
};

/**
 * Toggle switch component
 */
function ToggleControl({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const handleClick = useCallback(() => {
    if (!disabled) {
      onChange(!checked);
    }
  }, [checked, onChange, disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
        e.preventDefault();
        onChange(!checked);
      }
    },
    [checked, onChange, disabled]
  );

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`${STYLES.toggle} ${checked ? STYLES.toggleEnabled : STYLES.toggleDisabled}`}
      >
        <span
          className={`${STYLES.toggleKnob} ${checked ? STYLES.toggleKnobEnabled : STYLES.toggleKnobDisabled}`}
        />
      </button>
      <label htmlFor={id} className={STYLES.label}>
        {label}
      </label>
    </div>
  );
}

/**
 * Division button group component
 */
function DivisionSelector({
  value,
  onChange,
  disabled,
}: {
  value: GridDivision;
  onChange: (division: GridDivision) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={STYLES.divisionContainer}
      role="radiogroup"
      aria-label="Grid division"
    >
      {DIVISION_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`${STYLES.divisionButton} ${
              isActive ? STYLES.divisionButtonActive : STYLES.divisionButtonInactive
            }`}
            title={option.label}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Gets the display label for a grid division
 */
function getDivisionLabel(division: GridDivision): string {
  const option = DIVISION_OPTIONS.find((opt) => opt.value === division);
  return option?.label ?? `${division} Beat`;
}

/**
 * GridSnapControls component
 *
 * Provides UI controls for grid snap configuration:
 * - Toggle to enable/disable grid snap
 * - Button group to select grid division (1, 1/2, 1/4, 1/8, 1/16 beats)
 * - Visual feedback showing current grid snap state
 *
 * Requirements:
 * - 7.1: Toggle control to enable/disable Grid_Snap, enabled by default
 * - 7.2: Grid division options of 1, 1/2, 1/4, 1/8, 1/16 beat, default 1/4
 * - 7.3: Visually indicate current Grid_Snap state on toggle control
 */
export function GridSnapControls({
  config,
  onChange,
  disabled = false,
  className = '',
}: GridSnapControlsProps) {
  /**
   * Handle snap enabled toggle
   * Requirement 7.1: Toggle to enable/disable Grid_Snap
   */
  const handleEnabledChange = useCallback(
    (enabled: boolean) => {
      onChange({ ...config, enabled });
    },
    [config, onChange]
  );

  /**
   * Handle division change
   * Requirement 7.2: Grid division options
   */
  const handleDivisionChange = useCallback(
    (division: GridDivision) => {
      onChange({ ...config, division });
    },
    [config, onChange]
  );

  return (
    <div
      className={`${STYLES.container} ${className}`}
      role="region"
      aria-label="Grid snap controls"
    >
      <div className={STYLES.row}>
        {/* Grid icon with state indicator */}
        <div className={STYLES.stateIndicator}>
          <GridIcon className="w-4 h-4 text-gray-400" />
          <span
            className={`${STYLES.statusDot} ${
              config.enabled ? STYLES.statusDotEnabled : STYLES.statusDotDisabled
            }`}
            aria-hidden="true"
          />
        </div>

        {/* Snap toggle */}
        <ToggleControl
          id="grid-snap-toggle"
          label="Snap"
          checked={config.enabled}
          onChange={handleEnabledChange}
          disabled={disabled}
        />

        {/* Vertical divider */}
        <div className="w-px h-6 bg-gray-600" aria-hidden="true" />

        {/* Division selector - only interactive when snap is enabled */}
        <DivisionSelector
          value={config.division}
          onChange={handleDivisionChange}
          disabled={disabled || !config.enabled}
        />
      </div>

      {/* Visual state indicator for screen readers */}
      <span className="sr-only" aria-live="polite">
        Grid snap {config.enabled ? 'enabled' : 'disabled'}
        {config.enabled ? `, division: ${getDivisionLabel(config.division)}` : ''}
      </span>
    </div>
  );
}

export default GridSnapControls;
