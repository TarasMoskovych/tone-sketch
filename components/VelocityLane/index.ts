/**
 * VelocityLane Module - Barrel Export
 *
 * Provides the public API for the VelocityLane module.
 * Requirements: 7.1, 7.4 - Dedicated component directory with clean public API
 *
 * Usage:
 * - import { VelocityLaneCanvas, VELOCITY_LANE_CONFIG } from '@/components/VelocityLane'
 * - import type { VelocityLaneCanvasProps, VelocityDragState, VelocityRenderDimensions } from '@/components/VelocityLane'
 */

// Components (public API)
export { VelocityLaneCanvas } from './VelocityLaneCanvas';

// Constants (public API)
export { VELOCITY_LANE_CONFIG } from './constants';

// Types (public API)
export type {
  VelocityLaneCanvasProps,
  VelocityDragState,
  VelocityRenderDimensions,
} from './types';
