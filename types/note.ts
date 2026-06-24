/**
 * Core data structure for musical events.
 * Represents a single note in the piano roll editor.
 */
export interface Note {
  /** UUID v4, client-generated */
  id: string;
  /** MIDI note number (0-127) */
  pitch: number;
  /** Start time in beats (>= 0, <= 10000) */
  start: number;
  /** Duration in beats (>= 0.001, <= 1000) */
  duration: number;
  /** Volume/intensity (0-1) */
  velocity: number;
}

/**
 * Represents a validation error for a specific field.
 */
export interface ValidationError {
  /** The name of the field that failed validation */
  field: string;
  /** Human-readable message describing the validation failure */
  message: string;
}

/**
 * Result of validating a Note object.
 */
export interface ValidationResult {
  /** Whether the note passed all validation checks */
  valid: boolean;
  /** Array of validation errors (empty if valid) */
  errors: ValidationError[];
}
