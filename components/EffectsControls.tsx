'use client';

import { useCallback, useState } from 'react';
import { ChevronIcon } from './icons';
import type { EffectsConfig } from '@/types/synth';
import {
  REVERB_RANGES,
  DELAY_RANGES,
  CHORUS_RANGES,
  FLANGER_RANGES,
} from '@/types/synth';

/**
 * Props for the EffectsControls component
 */
export interface EffectsControlsProps {
  /** Current effects configuration */
  effects: EffectsConfig;
  /** Callback when any effects value changes */
  onChange: (effects: Partial<EffectsConfig>) => void;
  /** Whether controls are disabled (e.g., read-only mode) */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Format time value for display
 */
function formatTime(seconds: number): string {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  }
  return `${seconds.toFixed(2)}s`;
}

/**
 * Format percentage value for display
 */
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Compact slider component with inline label and value
 */
function CompactSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  formatValue,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  formatValue?: (value: number) => string;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange]
  );

  const displayValue = formatValue ? formatValue(value) : value.toFixed(2);

  return (
    <div className="flex items-center gap-2 h-6">
      <label htmlFor={id} className="text-xs text-gray-400 w-12 shrink-0">
        {label}
      </label>
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayValue}
      />
      <span className="text-xs text-gray-500 w-14 text-right">{displayValue}</span>
    </div>
  );
}

/**
 * Toggle switch component
 */
function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const handleClick = useCallback(() => {
    if (!disabled) {
      onChange(!checked);
    }
  }, [checked, onChange, disabled]);

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        checked ? 'bg-indigo-600' : 'bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/**
 * Effect row component with enable toggle and expandable parameters
 */
function EffectRow({
  name,
  enabled,
  onToggle,
  expanded,
  onExpand,
  disabled,
  children,
}: {
  name: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  expanded: boolean;
  onExpand: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <ToggleSwitch
          id={`${name.toLowerCase()}-toggle`}
          checked={enabled}
          onChange={onToggle}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onExpand}
          className="flex items-center gap-1 text-xs text-gray-300 hover:text-white"
          aria-expanded={expanded}
        >
          <ChevronIcon
            className={`w-2.5 h-2.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
            direction={expanded ? 'down' : 'right'}
          />
          {name}
        </button>
      </div>
      {expanded && enabled && (
        <div className="pl-11 space-y-1">{children}</div>
      )}
    </div>
  );
}

/**
 * EffectsControls component
 *
 * Compact UI controls for adjusting audio effect parameters:
 * - Reverb with roomSize and wetDry controls
 * - Delay with time, feedback, and wetDry controls
 * - Chorus with rate, depth, and wetDry controls
 * - Flanger with rate, depth, feedback, and wetDry controls
 *
 * Each effect has a toggle and expandable parameter sliders.
 *
 * Requirements:
 * - 36.1: Reverb effect with roomSize (0-1) and wetDry (0-1)
 * - 36.2: Delay effect with time (0-1s), feedback (0-0.9), wetDry (0-1)
 * - 36.3: Chorus effect with rate (0.1-10Hz), depth (0-1), wetDry (0-1)
 * - 36.4: Flanger effect with rate (0.1-10Hz), depth (0-1), feedback (0-0.9), wetDry (0-1)
 * - 36.5: Each effect can be independently enabled/disabled
 */
export function EffectsControls({
  effects,
  onChange,
  disabled = false,
  className = '',
}: EffectsControlsProps) {
  // Track which effects are expanded
  const [expandedEffects, setExpandedEffects] = useState({
    reverb: false,
    delay: false,
    chorus: false,
    flanger: false,
  });

  /**
   * Toggle an effect's expanded state
   */
  const toggleEffect = (key: keyof typeof expandedEffects) => {
    setExpandedEffects((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /**
   * Handle effect parameter changes
   */
  const handleEffectChange = useCallback(
    (effectName: string, changes: Record<string, unknown>) => {
      onChange({
        [effectName]: {
          ...effects[effectName as keyof EffectsConfig],
          ...changes,
        },
      });
    },
    [onChange, effects]
  );

  return (
    <div
      className={`space-y-2 ${className}`}
      role="region"
      aria-label="Audio effects controls"
    >
      {/* Reverb */}
      <EffectRow
        name="Reverb"
        enabled={effects.reverb.enabled}
        onToggle={(v) => handleEffectChange('reverb', { enabled: v })}
        expanded={expandedEffects.reverb}
        onExpand={() => toggleEffect('reverb')}
        disabled={disabled}
      >
        <CompactSlider
          id="reverb-room"
          label="Room"
          value={effects.reverb.roomSize}
          min={REVERB_RANGES.roomSize.min}
          max={REVERB_RANGES.roomSize.max}
          step={0.01}
          onChange={(v) => handleEffectChange('reverb', { roomSize: v })}
          disabled={disabled}
          formatValue={formatPercent}
        />
        <CompactSlider
          id="reverb-wet"
          label="Wet"
          value={effects.reverb.wetDry}
          min={REVERB_RANGES.wetDry.min}
          max={REVERB_RANGES.wetDry.max}
          step={0.01}
          onChange={(v) => handleEffectChange('reverb', { wetDry: v })}
          disabled={disabled}
          formatValue={formatPercent}
        />
      </EffectRow>

      {/* Delay */}
      <EffectRow
        name="Delay"
        enabled={effects.delay.enabled}
        onToggle={(v) => handleEffectChange('delay', { enabled: v })}
        expanded={expandedEffects.delay}
        onExpand={() => toggleEffect('delay')}
        disabled={disabled}
      >
        <CompactSlider
          id="delay-time"
          label="Time"
          value={effects.delay.time}
          min={DELAY_RANGES.time.min}
          max={DELAY_RANGES.time.max}
          step={0.01}
          onChange={(v) => handleEffectChange('delay', { time: v })}
          disabled={disabled}
          formatValue={formatTime}
        />
        <CompactSlider
          id="delay-feedback"
          label="Feedback"
          value={effects.delay.feedback}
          min={DELAY_RANGES.feedback.min}
          max={DELAY_RANGES.feedback.max}
          step={0.01}
          onChange={(v) => handleEffectChange('delay', { feedback: v })}
          disabled={disabled}
          formatValue={formatPercent}
        />
        <CompactSlider
          id="delay-wet"
          label="Wet"
          value={effects.delay.wetDry}
          min={DELAY_RANGES.wetDry.min}
          max={DELAY_RANGES.wetDry.max}
          step={0.01}
          onChange={(v) => handleEffectChange('delay', { wetDry: v })}
          disabled={disabled}
          formatValue={formatPercent}
        />
      </EffectRow>

      {/* Chorus */}
      <EffectRow
        name="Chorus"
        enabled={effects.chorus.enabled}
        onToggle={(v) => handleEffectChange('chorus', { enabled: v })}
        expanded={expandedEffects.chorus}
        onExpand={() => toggleEffect('chorus')}
        disabled={disabled}
      >
        <CompactSlider
          id="chorus-rate"
          label="Rate"
          value={effects.chorus.rate}
          min={CHORUS_RANGES.rate.min}
          max={CHORUS_RANGES.rate.max}
          step={0.1}
          onChange={(v) => handleEffectChange('chorus', { rate: v })}
          disabled={disabled}
          formatValue={(v) => `${v.toFixed(1)}Hz`}
        />
        <CompactSlider
          id="chorus-depth"
          label="Depth"
          value={effects.chorus.depth}
          min={CHORUS_RANGES.depth.min}
          max={CHORUS_RANGES.depth.max}
          step={0.01}
          onChange={(v) => handleEffectChange('chorus', { depth: v })}
          disabled={disabled}
          formatValue={formatPercent}
        />
        <CompactSlider
          id="chorus-wet"
          label="Wet"
          value={effects.chorus.wetDry}
          min={CHORUS_RANGES.wetDry.min}
          max={CHORUS_RANGES.wetDry.max}
          step={0.01}
          onChange={(v) => handleEffectChange('chorus', { wetDry: v })}
          disabled={disabled}
          formatValue={formatPercent}
        />
      </EffectRow>

      {/* Flanger */}
      <EffectRow
        name="Flanger"
        enabled={effects.flanger.enabled}
        onToggle={(v) => handleEffectChange('flanger', { enabled: v })}
        expanded={expandedEffects.flanger}
        onExpand={() => toggleEffect('flanger')}
        disabled={disabled}
      >
        <CompactSlider
          id="flanger-rate"
          label="Rate"
          value={effects.flanger.rate}
          min={FLANGER_RANGES.rate.min}
          max={FLANGER_RANGES.rate.max}
          step={0.1}
          onChange={(v) => handleEffectChange('flanger', { rate: v })}
          disabled={disabled}
          formatValue={(v) => `${v.toFixed(1)}Hz`}
        />
        <CompactSlider
          id="flanger-depth"
          label="Depth"
          value={effects.flanger.depth}
          min={FLANGER_RANGES.depth.min}
          max={FLANGER_RANGES.depth.max}
          step={0.01}
          onChange={(v) => handleEffectChange('flanger', { depth: v })}
          disabled={disabled}
          formatValue={formatPercent}
        />
        <CompactSlider
          id="flanger-feedback"
          label="Feedback"
          value={effects.flanger.feedback}
          min={FLANGER_RANGES.feedback.min}
          max={FLANGER_RANGES.feedback.max}
          step={0.01}
          onChange={(v) => handleEffectChange('flanger', { feedback: v })}
          disabled={disabled}
          formatValue={formatPercent}
        />
        <CompactSlider
          id="flanger-wet"
          label="Wet"
          value={effects.flanger.wetDry}
          min={FLANGER_RANGES.wetDry.min}
          max={FLANGER_RANGES.wetDry.max}
          step={0.01}
          onChange={(v) => handleEffectChange('flanger', { wetDry: v })}
          disabled={disabled}
          formatValue={formatPercent}
        />
      </EffectRow>

      {/* Visual state indicator for screen readers */}
      <span className="sr-only" aria-live="polite">
        Effects configured:{' '}
        {effects.reverb.enabled ? 'Reverb enabled, ' : 'Reverb disabled, '}
        {effects.delay.enabled ? 'Delay enabled, ' : 'Delay disabled, '}
        {effects.chorus.enabled ? 'Chorus enabled, ' : 'Chorus disabled, '}
        {effects.flanger.enabled ? 'Flanger enabled' : 'Flanger disabled'}
      </span>
    </div>
  );
}

export default EffectsControls;
