'use client';

import { useCallback, useState } from 'react';
import { ChevronIcon } from './icons';
import { PresetSelector } from './PresetSelector';
import { EffectsControls } from './EffectsControls';
import type {
  SynthesizerConfig,
  OscillatorType,
  FilterType,
  EffectsConfig,
  PresetName,
} from '@/types/synth';

/**
 * Props for the SynthControls component
 *
 * Implements the interface defined in the design document for synthesizer parameter controls.
 */
export interface SynthControlsProps {
  /** Current synthesizer configuration */
  config: SynthesizerConfig;
  /** Callback when any configuration value changes */
  onChange: (config: Partial<SynthesizerConfig>) => void;
  /** Callback when a preset is selected */
  onPresetChange?: (presetName: PresetName) => void;
  /** Current tempo in BPM */
  tempo?: number;
  /** Callback when tempo changes */
  onTempoChange?: (tempo: number) => void;
  /** Whether controls are disabled (e.g., read-only mode) */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Available oscillator types with display labels
 * Requirement 9.1: oscillator types sine, square, sawtooth, triangle
 */
const OSCILLATOR_OPTIONS: Array<{ value: OscillatorType; label: string }> = [
  { value: 'sine', label: 'Sine' },
  { value: 'square', label: 'Square' },
  { value: 'sawtooth', label: 'Sawtooth' },
  { value: 'triangle', label: 'Triangle' },
];

/**
 * Available filter types with display labels
 * Requirement 12.1: filter types lowpass and highpass
 */
const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: 'lowpass', label: 'Lowpass' },
  { value: 'highpass', label: 'Highpass' },
];

/**
 * Configuration for slider ranges based on requirements
 */
const SLIDER_CONFIG = {
  volume: { min: 0, max: 1, step: 0.01 },
  tempo: { min: 40, max: 240, step: 1 },
  attack: { min: 0, max: 2, step: 0.01 },
  decay: { min: 0, max: 2, step: 0.01 },
  sustain: { min: 0, max: 1, step: 0.01 },
  release: { min: 0, max: 5, step: 0.01 },
  filterFrequency: { min: 20, max: 20000, step: 1 },
};

/**
 * Format BPM value for display
 */
function formatBPM(bpm: number): string {
  return `${Math.round(bpm)} BPM`;
}

/**
 * Format frequency value for display
 */
function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)}kHz`;
  }
  return `${Math.round(hz)}Hz`;
}

/**
 * Format time value in seconds for display
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
 * Toggle switch component for enabling/disabling features
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
 * Collapsible section header component
 */
function SectionHeader({
  title,
  expanded,
  onToggle,
  extra,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-300"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <ChevronIcon
          className={`w-3 h-3 transition-transform ${expanded ? '' : '-rotate-90'}`}
          direction={expanded ? 'down' : 'right'}
        />
        {title}
      </button>
      {extra}
    </div>
  );
}

/**
 * SynthControls component
 *
 * Provides UI controls for adjusting synthesizer parameters:
 * - Oscillator type selection (sine, square, sawtooth, triangle)
 * - Volume/gain control (0-1)
 * - ADSR envelope controls (attack, decay, sustain, release)
 * - Filter enable/disable, type selection, and frequency control
 * - Audio effects controls (reverb, delay, chorus, flanger)
 *
 * Uses a compact, collapsible layout to fit all controls without scrolling.
 *
 * Requirements:
 * - 9.1: Oscillator type selection with options sine, square, sawtooth, triangle
 * - 10.1: Volume control with range 0-1, default 0.8
 * - 10.3: Display current volume level
 * - 11.1: Attack parameter 0-2 seconds, default 0.01
 * - 11.2: Decay parameter 0-2 seconds, default 0.1
 * - 11.3: Sustain parameter 0-1 level, default 0.5
 * - 11.4: Release parameter 0-5 seconds, default 0.5
 * - 12.1: Optional filter with lowpass/highpass types
 * - 12.2: Filter frequency 20-20000 Hz, default 1000 Hz
 * - 36.1-36.5: Audio effects (reverb, delay, chorus, flanger)
 */
export function SynthControls({
  config,
  onChange,
  onPresetChange,
  tempo,
  onTempoChange,
  disabled = false,
  className = '',
}: SynthControlsProps) {
  // Track which sections are expanded
  const [sections, setSections] = useState({
    adsr: false,
    filter: false,
    effects: false,
  });

  /**
   * Toggle a section's expanded state
   */
  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ===== Change Handlers =====

  /**
   * Handle oscillator type change
   * Requirement 9.1, 9.2: Apply waveform to subsequent playback
   */
  const handleOscillatorChange = useCallback(
    (oscillatorType: OscillatorType) => {
      onChange({ oscillatorType });
    },
    [onChange]
  );

  /**
   * Handle volume change
   * Requirement 10.1, 10.2: Apply volume within 50ms
   */
  const handleVolumeChange = useCallback(
    (volume: number) => {
      onChange({ volume });
    },
    [onChange]
  );

  /**
   * Handle envelope parameter change
   * Requirements 11.1-11.4: ADSR envelope parameters
   */
  const handleEnvelopeChange = useCallback(
    (key: string, value: number) => {
      onChange({ envelope: { ...config.envelope, [key]: value } });
    },
    [onChange, config.envelope]
  );

  /**
   * Handle filter enabled toggle
   * Requirement 12.1, 12.3: Apply filter within 50ms
   */
  const handleFilterEnabledChange = useCallback(
    (enabled: boolean) => {
      onChange({ filter: { ...config.filter, enabled } });
    },
    [onChange, config.filter]
  );

  /**
   * Handle filter type change
   * Requirement 12.1, 12.4: Apply filter type within 50ms
   */
  const handleFilterTypeChange = useCallback(
    (type: FilterType) => {
      onChange({ filter: { ...config.filter, type } });
    },
    [onChange, config.filter]
  );

  /**
   * Handle filter frequency change
   * Requirement 12.2: Frequency 20-20000 Hz
   */
  const handleFilterFrequencyChange = useCallback(
    (frequency: number) => {
      onChange({ filter: { ...config.filter, frequency } });
    },
    [onChange, config.filter]
  );

  /**
   * Handle effects configuration changes
   * Requirements 36.1-36.5: Audio effects
   */
  const handleEffectsChange = useCallback(
    (effectsChanges: Partial<EffectsConfig>) => {
      onChange({ effects: { ...config.effects, ...effectsChanges } });
    },
    [onChange, config.effects]
  );

  return (
    <div
      className={`bg-gray-800 p-3 space-y-3 ${className}`}
      role="region"
      aria-label="Synthesizer controls"
    >
      {/* Preset Section */}
      <PresetSelector
        currentPreset={config.presetName}
        onPresetSelect={onPresetChange ?? (() => {})}
        disabled={disabled}
      />

      {/* Waveform Section */}
      <div className="space-y-2">
        <label htmlFor="oscillator-type" className="text-xs text-gray-400">Waveform</label>
        <select
          id="oscillator-type"
          value={config.oscillatorType}
          onChange={(e) => handleOscillatorChange(e.target.value as OscillatorType)}
          disabled={disabled}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 disabled:opacity-50"
        >
          {OSCILLATOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Volume Slider */}
      <CompactSlider
        id="volume"
        label="Volume"
        value={config.volume}
        {...SLIDER_CONFIG.volume}
        onChange={handleVolumeChange}
        disabled={disabled}
        formatValue={formatPercent}
      />

      {/* Tempo Slider */}
      {tempo !== undefined && (
        <CompactSlider
          id="tempo"
          label="Tempo"
          value={tempo}
          {...SLIDER_CONFIG.tempo}
          onChange={onTempoChange ?? (() => {})}
          disabled={disabled || !onTempoChange}
          formatValue={formatBPM}
        />
      )}

      {/* Envelope Section (ADSR) */}
      <div className="space-y-2">
        <SectionHeader
          title="Envelope"
          expanded={sections.adsr}
          onToggle={() => toggleSection('adsr')}
        />
        {sections.adsr && (
          <div className="pl-4 space-y-1">
            <CompactSlider
              id="attack"
              label="Attack"
              value={config.envelope.attack}
              {...SLIDER_CONFIG.attack}
              onChange={(v) => handleEnvelopeChange('attack', v)}
              disabled={disabled}
              formatValue={formatTime}
            />
            <CompactSlider
              id="decay"
              label="Decay"
              value={config.envelope.decay}
              {...SLIDER_CONFIG.decay}
              onChange={(v) => handleEnvelopeChange('decay', v)}
              disabled={disabled}
              formatValue={formatTime}
            />
            <CompactSlider
              id="sustain"
              label="Sustain"
              value={config.envelope.sustain}
              {...SLIDER_CONFIG.sustain}
              onChange={(v) => handleEnvelopeChange('sustain', v)}
              disabled={disabled}
              formatValue={formatPercent}
            />
            <CompactSlider
              id="release"
              label="Release"
              value={config.envelope.release}
              {...SLIDER_CONFIG.release}
              onChange={(v) => handleEnvelopeChange('release', v)}
              disabled={disabled}
              formatValue={formatTime}
            />
          </div>
        )}
      </div>

      {/* Filter Section */}
      <div className="space-y-2">
        <SectionHeader
          title="Filter"
          expanded={sections.filter}
          onToggle={() => toggleSection('filter')}
          extra={
            <ToggleSwitch
              id="filter-enabled"
              checked={config.filter.enabled}
              onChange={handleFilterEnabledChange}
              disabled={disabled}
            />
          }
        />
        {sections.filter && config.filter.enabled && (
          <div className="pl-4 space-y-1">
            <div className="flex items-center gap-2 h-6">
              <label htmlFor="filter-type" className="text-xs text-gray-400 w-12">
                Type
              </label>
              <select
                id="filter-type"
                value={config.filter.type}
                onChange={(e) => handleFilterTypeChange(e.target.value as FilterType)}
                disabled={disabled}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-200"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <CompactSlider
              id="filter-frequency"
              label="Freq"
              value={config.filter.frequency}
              {...SLIDER_CONFIG.filterFrequency}
              onChange={handleFilterFrequencyChange}
              disabled={disabled}
              formatValue={formatFrequency}
            />
          </div>
        )}
      </div>

      {/* Effects Section */}
      <div className="space-y-2">
        <SectionHeader
          title="Effects"
          expanded={sections.effects}
          onToggle={() => toggleSection('effects')}
        />
        {sections.effects && (
          <div className="pl-4">
            <EffectsControls
              effects={config.effects}
              onChange={handleEffectsChange}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Visual state indicator for screen readers */}
      <span className="sr-only" aria-live="polite">
        Synthesizer configured: {config.oscillatorType} oscillator,{' '}
        {Math.round(config.volume * 100)}% volume
        {config.filter.enabled
          ? `, ${config.filter.type} filter at ${formatFrequency(config.filter.frequency)}`
          : ', filter disabled'}
        {config.effects.reverb.enabled ? ', reverb enabled' : ''}
        {config.effects.delay.enabled ? ', delay enabled' : ''}
        {config.effects.chorus.enabled ? ', chorus enabled' : ''}
        {config.effects.flanger.enabled ? ', flanger enabled' : ''}
      </span>
    </div>
  );
}

export default SynthControls;
