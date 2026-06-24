'use client';

import { useCallback, useMemo } from 'react';
import type { PresetName, PresetCategory, SynthPreset } from '@/types/synth';
import { PRESETS, PRESET_CATEGORIES } from '@/lib/presets';
import { ChevronIcon } from './icons';

/**
 * Props for the PresetSelector component
 *
 * Implements the interface defined in the design document for preset selection.
 * Requirements: 37.1, 37.2, 37.3, 37.4, 37.5, 37.6
 */
export interface PresetSelectorProps {
  /** Currently selected preset name, or null if using custom settings */
  currentPreset: PresetName | null;
  /** Callback when a preset is selected */
  onPresetSelect: (presetName: PresetName) => void;
  /** Whether the selector is disabled (e.g., read-only mode) */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Preset group interface for organizing presets by category
 */
interface PresetGroup {
  category: PresetCategory;
  presets: SynthPreset[];
}

/**
 * Shared styles for the component
 */
const STYLES = {
  container: 'relative',
  label: 'block text-xs text-gray-400 mb-1',
  select: 'w-full bg-gray-700 border border-gray-600 rounded-md pl-3 pr-8 py-2 text-sm text-gray-200 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed',
  selectActive: 'text-indigo-400 font-medium',
  chevronContainer: 'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400',
  optgroup: 'bg-gray-700 text-gray-400 font-semibold text-xs uppercase tracking-wider',
  option: 'bg-gray-700 text-gray-200 py-1',
  optionSelected: 'bg-indigo-600 text-white',
};

/**
 * Get all presets organized by category for the dropdown
 */
function getPresetGroups(): PresetGroup[] {
  return PRESET_CATEGORIES.map((category) => ({
    category,
    presets: PRESETS[category],
  }));
}

/**
 * PresetSelector component
 *
 * Provides a dropdown/select component for choosing synthesizer presets.
 * Presets are organized into 5 categories with 3 presets each (15 total):
 * - Piano: Acoustic Piano, Electric Piano, Soft Piano
 * - Lead: Classic Lead, Saw Lead, Square Lead
 * - Pluck: Short Pluck, Soft Pluck, Bright Pluck
 * - Guitar: Clean Guitar, Muted Guitar, Acoustic Guitar
 * - Bass: Sub Bass, Synth Bass, Punchy Bass
 *
 * Requirements:
 * - 37.1: Provide preset selection with Piano, Lead, Pluck, Guitar, Bass categories
 * - 37.2: Each category has 3 presets (Piano, Lead, Pluck, Guitar, Bass)
 * - 37.3: Display presets organized by category in the selector
 * - 37.4: Highlight currently selected preset
 * - 37.5: Support disabled state for read-only mode
 * - 37.6: When user selects a preset, apply the configuration
 */
export function PresetSelector({
  currentPreset,
  onPresetSelect,
  disabled = false,
  className = '',
}: PresetSelectorProps) {
  /**
   * Memoize preset groups for performance
   */
  const presetGroups = useMemo(() => getPresetGroups(), []);

  /**
   * Handle preset selection from the dropdown
   * Requirement 37.6: Apply preset when selected
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = e.target.value;
      if (selectedValue) {
        onPresetSelect(selectedValue as PresetName);
      }
    },
    [onPresetSelect]
  );

  /**
   * Determine if the current preset is valid/selected
   * Used for visual highlighting per Requirement 37.4
   */
  const hasActivePreset = currentPreset !== null;

  return (
    <div
      className={`${STYLES.container} ${className}`}
      role="region"
      aria-label="Preset selector"
    >
      <label htmlFor="preset-selector" className={STYLES.label}>
        Preset
      </label>
      <div className="relative">
        <select
          id="preset-selector"
          value={currentPreset ?? ''}
          onChange={handleChange}
          disabled={disabled}
          className={`${STYLES.select} ${hasActivePreset ? STYLES.selectActive : ''}`}
          aria-label="Select a synthesizer preset"
        >
          {/* Custom/No Preset option */}
          <option value="" disabled={hasActivePreset}>
            {hasActivePreset ? 'Custom' : 'Select a preset...'}
          </option>

          {/* Render presets grouped by category */}
          {presetGroups.map((group) => (
            <optgroup
              key={group.category}
              label={group.category}
              className={STYLES.optgroup}
            >
              {group.presets.map((preset) => (
                <option
                  key={preset.name}
                  value={preset.name}
                  className={`${STYLES.option} ${
                    currentPreset === preset.name ? STYLES.optionSelected : ''
                  }`}
                >
                  {preset.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Custom dropdown chevron indicator */}
        <div className={STYLES.chevronContainer}>
          <ChevronIcon className="w-4 h-4" direction="down" />
        </div>
      </div>

      {/* Visual state indicator for screen readers */}
      <span className="sr-only" aria-live="polite">
        {currentPreset
          ? `Selected preset: ${currentPreset}`
          : 'No preset selected, using custom settings'}
      </span>
    </div>
  );
}

export default PresetSelector;
