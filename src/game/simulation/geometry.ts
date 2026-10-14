import type { Point, Rect } from '../types';

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function circleOverlapsRect(point: Point, radius: number, rect: Rect) {
  return (
    Math.hypot(
      point.x - clamp(point.x, rect.x, rect.x + rect.width),
      point.y - clamp(point.y, rect.y, rect.y + rect.height),
    ) < radius
  );
}

export function segmentRectHit(from: Point, to: Point, rect: Rect, padding = 0): number | null {
  let near = 0;
  let far = 1;
  for (const axis of ['x', 'y'] as const) {
    const start = from[axis];
    const delta = to[axis] - start;
    const min = rect[axis] - padding;
    const max = rect[axis] + (axis === 'x' ? rect.width : rect.height) + padding;
    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return null;
    } else {
      const a = (min - start) / delta;
      const b = (max - start) / delta;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return null;
    }
  }
  return near;
}

export function segmentCircleHit(
  from: Point,
  to: Point,
  center: Point,
  radius: number,
): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null;
  const b = 2 * (fx * dx + fy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export function turnTowards(angle: number, target: number, maxTurn: number) {
  const difference = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + clamp(difference, -maxTurn, maxTurn);
}
