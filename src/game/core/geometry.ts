export const TAU = Math.PI * 2;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PolarPoint {
  readonly angle: number;
  readonly radius: number;
}

export interface Circle extends Point {
  readonly radius: number;
}

export function normalizeAngle(angle: number): number {
  const normalized = angle % TAU;
  if (normalized === 0) return 0;
  return normalized < 0 ? normalized + TAU : normalized;
}

export function signedAngleDelta(from: number, to: number): number {
  let delta = normalizeAngle(to) - normalizeAngle(from);
  if (delta > Math.PI) delta -= TAU;
  else if (delta < -Math.PI) delta += TAU;
  return delta;
}

export function angularDistance(a: number, b: number): number {
  return Math.abs(signedAngleDelta(a, b));
}

export function polarToCartesian(angle: number, radius: number, centerX = 0, centerY = 0): Point {
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
}

export function distanceSquared(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

export function distance(a: Point, b: Point): number {
  return Math.sqrt(distanceSquared(a, b));
}

export function circlesOverlap(a: Circle, b: Circle, padding = 0): boolean {
  const combinedRadius = a.radius + b.radius + padding;
  return distanceSquared(a, b) <= combinedRadius * combinedRadius;
}

export const circleOverlap = circlesOverlap;

export function sweptCircleOverlap(
  start: Point,
  end: Point,
  movingRadius: number,
  target: Circle,
  padding = 0,
): boolean {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
  const combinedRadius = movingRadius + target.radius + padding;

  if (segmentLengthSquared === 0) {
    return distanceSquared(start, target) <= combinedRadius * combinedRadius;
  }

  const targetX = target.x - start.x;
  const targetY = target.y - start.y;
  const projection = (targetX * segmentX + targetY * segmentY) / segmentLengthSquared;
  const t = clamp(projection, 0, 1);
  const closestPoint = {
    x: start.x + segmentX * t,
    y: start.y + segmentY * t,
  };
  return distanceSquared(closestPoint, target) <= combinedRadius * combinedRadius;
}

export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new RangeError("min must be less than or equal to max");
  return Math.max(min, Math.min(max, value));
}

export function moveAngleToward(current: number, target: number, maxStep: number): number {
  if (maxStep < 0) throw new RangeError("maxStep must be non-negative");
  const delta = signedAngleDelta(current, target);
  if (Math.abs(delta) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(delta) * maxStep);
}

export function polarDistance(a: PolarPoint, b: PolarPoint, centerX = 0, centerY = 0): number {
  return distance(
    polarToCartesian(a.angle, a.radius, centerX, centerY),
    polarToCartesian(b.angle, b.radius, centerX, centerY),
  );
}
