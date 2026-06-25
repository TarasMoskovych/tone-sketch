import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getTouchDistance, getTouchCenter } from '@/components/PianoRoll/touch-utils';

/**
 * Helper to create a mock TouchList from coordinate pairs.
 * This creates a minimal TouchList-like object for testing purposes.
 */
function createMockTouchList(
  touches: Array<{ clientX: number; clientY: number }>
): TouchList {
  const touchArray = touches.map((t, index) => ({
    clientX: t.clientX,
    clientY: t.clientY,
    clientZ: 0,
    force: 1,
    identifier: index,
    pageX: t.clientX,
    pageY: t.clientY,
    radiusX: 1,
    radiusY: 1,
    rotationAngle: 0,
    screenX: t.clientX,
    screenY: t.clientY,
    target: null as unknown as EventTarget,
  })) as Touch[];

  return {
    length: touchArray.length,
    item: (index: number) => touchArray[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const touch of touchArray) {
        yield touch;
      }
    },
    ...touchArray.reduce(
      (acc, touch, idx) => ({ ...acc, [idx]: touch }),
      {} as { [key: number]: Touch }
    ),
  } as TouchList;
}

/**
 * Feature: piano-roll-refactor, Property 7: Touch Geometry Calculations
 *
 * *For any* two touch points with coordinates (x1, y1) and (x2, y2):
 * - `getTouchDistance(touches)` shall return √((x2-x1)² + (y2-y1)²) (Euclidean distance)
 * - `getTouchCenter(touches)` shall return { x: (x1+x2)/2, y: (y1+y2)/2 } (midpoint)
 * - Distance shall always be non-negative
 * - Center shall always be within the bounding box of the two points
 *
 * **Validates: Requirements 7.1, 7.2**
 */
describe('Property 7: Touch Geometry Calculations', () => {
  // Arbitrary for coordinate values (reasonable screen coordinates)
  const coordinateArb = fc.double({
    min: -10000,
    max: 10000,
    noNaN: true,
    noDefaultInfinity: true,
  });

  // Arbitrary for a single point
  const pointArb = fc.record({
    x: coordinateArb,
    y: coordinateArb,
  });

  // Arbitrary for two points
  const twoPointsArb = fc.tuple(pointArb, pointArb);

  describe('getTouchDistance', () => {
    it('should return Euclidean distance √((x2-x1)² + (y2-y1)²) for any two touch points', () => {
      fc.assert(
        fc.property(twoPointsArb, ([p1, p2]) => {
          const touches = createMockTouchList([
            { clientX: p1.x, clientY: p1.y },
            { clientX: p2.x, clientY: p2.y },
          ]);

          const distance = getTouchDistance(touches);
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const expectedDistance = Math.sqrt(dx * dx + dy * dy);

          expect(distance).toBeCloseTo(expectedDistance, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('should always return a non-negative distance', () => {
      fc.assert(
        fc.property(twoPointsArb, ([p1, p2]) => {
          const touches = createMockTouchList([
            { clientX: p1.x, clientY: p1.y },
            { clientX: p2.x, clientY: p2.y },
          ]);

          const distance = getTouchDistance(touches);

          expect(distance).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should return 0 for identical touch points', () => {
      fc.assert(
        fc.property(pointArb, (p) => {
          const touches = createMockTouchList([
            { clientX: p.x, clientY: p.y },
            { clientX: p.x, clientY: p.y },
          ]);

          const distance = getTouchDistance(touches);

          expect(distance).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should be symmetric: distance(p1, p2) === distance(p2, p1)', () => {
      fc.assert(
        fc.property(twoPointsArb, ([p1, p2]) => {
          const touches1 = createMockTouchList([
            { clientX: p1.x, clientY: p1.y },
            { clientX: p2.x, clientY: p2.y },
          ]);
          const touches2 = createMockTouchList([
            { clientX: p2.x, clientY: p2.y },
            { clientX: p1.x, clientY: p1.y },
          ]);

          const distance1 = getTouchDistance(touches1);
          const distance2 = getTouchDistance(touches2);

          expect(distance1).toBeCloseTo(distance2, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('should return 0 when fewer than 2 touches are provided', () => {
      fc.assert(
        fc.property(pointArb, (p) => {
          // Single touch
          const singleTouch = createMockTouchList([{ clientX: p.x, clientY: p.y }]);
          expect(getTouchDistance(singleTouch)).toBe(0);

          // No touches
          const emptyTouches = createMockTouchList([]);
          expect(getTouchDistance(emptyTouches)).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle axis-aligned distances correctly (horizontal)', () => {
      fc.assert(
        fc.property(
          coordinateArb,
          coordinateArb,
          coordinateArb,
          (x1, x2, y) => {
            const touches = createMockTouchList([
              { clientX: x1, clientY: y },
              { clientX: x2, clientY: y },
            ]);

            const distance = getTouchDistance(touches);
            const expectedDistance = Math.abs(x2 - x1);

            expect(distance).toBeCloseTo(expectedDistance, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle axis-aligned distances correctly (vertical)', () => {
      fc.assert(
        fc.property(
          coordinateArb,
          coordinateArb,
          coordinateArb,
          (x, y1, y2) => {
            const touches = createMockTouchList([
              { clientX: x, clientY: y1 },
              { clientX: x, clientY: y2 },
            ]);

            const distance = getTouchDistance(touches);
            const expectedDistance = Math.abs(y2 - y1);

            expect(distance).toBeCloseTo(expectedDistance, 10);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getTouchCenter', () => {
    it('should return the midpoint { x: (x1+x2)/2, y: (y1+y2)/2 } for any two touch points', () => {
      fc.assert(
        fc.property(twoPointsArb, ([p1, p2]) => {
          const touches = createMockTouchList([
            { clientX: p1.x, clientY: p1.y },
            { clientX: p2.x, clientY: p2.y },
          ]);

          const center = getTouchCenter(touches);
          const expectedX = (p1.x + p2.x) / 2;
          const expectedY = (p1.y + p2.y) / 2;

          expect(center.x).toBeCloseTo(expectedX, 10);
          expect(center.y).toBeCloseTo(expectedY, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('should return a center within the bounding box of two points', () => {
      fc.assert(
        fc.property(twoPointsArb, ([p1, p2]) => {
          const touches = createMockTouchList([
            { clientX: p1.x, clientY: p1.y },
            { clientX: p2.x, clientY: p2.y },
          ]);

          const center = getTouchCenter(touches);

          // Calculate bounding box
          const minX = Math.min(p1.x, p2.x);
          const maxX = Math.max(p1.x, p2.x);
          const minY = Math.min(p1.y, p2.y);
          const maxY = Math.max(p1.y, p2.y);

          // Center must be within bounds (with small tolerance for floating point)
          expect(center.x).toBeGreaterThanOrEqual(minX - 1e-10);
          expect(center.x).toBeLessThanOrEqual(maxX + 1e-10);
          expect(center.y).toBeGreaterThanOrEqual(minY - 1e-10);
          expect(center.y).toBeLessThanOrEqual(maxY + 1e-10);
        }),
        { numRuns: 100 }
      );
    });

    it('should be symmetric: center(p1, p2) === center(p2, p1)', () => {
      fc.assert(
        fc.property(twoPointsArb, ([p1, p2]) => {
          const touches1 = createMockTouchList([
            { clientX: p1.x, clientY: p1.y },
            { clientX: p2.x, clientY: p2.y },
          ]);
          const touches2 = createMockTouchList([
            { clientX: p2.x, clientY: p2.y },
            { clientX: p1.x, clientY: p1.y },
          ]);

          const center1 = getTouchCenter(touches1);
          const center2 = getTouchCenter(touches2);

          expect(center1.x).toBeCloseTo(center2.x, 10);
          expect(center1.y).toBeCloseTo(center2.y, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('should return the same point when both touches are identical', () => {
      fc.assert(
        fc.property(pointArb, (p) => {
          const touches = createMockTouchList([
            { clientX: p.x, clientY: p.y },
            { clientX: p.x, clientY: p.y },
          ]);

          const center = getTouchCenter(touches);

          expect(center.x).toBeCloseTo(p.x, 10);
          expect(center.y).toBeCloseTo(p.y, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('should return the single touch position when only one touch is provided', () => {
      fc.assert(
        fc.property(pointArb, (p) => {
          const singleTouch = createMockTouchList([{ clientX: p.x, clientY: p.y }]);

          const center = getTouchCenter(singleTouch);

          expect(center.x).toBeCloseTo(p.x, 10);
          expect(center.y).toBeCloseTo(p.y, 10);
        }),
        { numRuns: 100 }
      );
    });

    it('should return (0, 0) when no touches are provided', () => {
      const emptyTouches = createMockTouchList([]);
      const center = getTouchCenter(emptyTouches);

      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
    });

    it('center should be equidistant from both touch points', () => {
      fc.assert(
        fc.property(twoPointsArb, ([p1, p2]) => {
          const touches = createMockTouchList([
            { clientX: p1.x, clientY: p1.y },
            { clientX: p2.x, clientY: p2.y },
          ]);

          const center = getTouchCenter(touches);

          // Distance from center to p1
          const d1 = Math.sqrt(
            Math.pow(center.x - p1.x, 2) + Math.pow(center.y - p1.y, 2)
          );
          // Distance from center to p2
          const d2 = Math.sqrt(
            Math.pow(center.x - p2.x, 2) + Math.pow(center.y - p2.y, 2)
          );

          expect(d1).toBeCloseTo(d2, 10);
        }),
        { numRuns: 100 }
      );
    });
  });
});
