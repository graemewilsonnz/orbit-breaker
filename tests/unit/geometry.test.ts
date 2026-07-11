import { describe, expect, it } from "vitest";

import {
  TAU,
  angularDistance,
  circlesOverlap,
  moveAngleToward,
  normalizeAngle,
  polarDistance,
  polarToCartesian,
  signedAngleDelta,
  sweptCircleOverlap,
} from "../../src/game/core/geometry";

describe("geometry", () => {
  it("normalizes angles into one turn", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(TAU)).toBe(0);
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((Math.PI * 3) / 2);
    expect(normalizeAngle(TAU * 3 + 0.25)).toBeCloseTo(0.25);
  });

  it("finds the signed shortest path across the angle boundary", () => {
    expect(signedAngleDelta(TAU - 0.1, 0.1)).toBeCloseTo(0.2);
    expect(signedAngleDelta(0.1, TAU - 0.1)).toBeCloseTo(-0.2);
    expect(angularDistance(0.1, TAU - 0.1)).toBeCloseTo(0.2);
  });

  it("converts polar positions around an explicit center", () => {
    expect(polarToCartesian(Math.PI / 2, 10, 20, 30)).toEqual({ x: 20, y: 40 });
    expect(polarDistance({ angle: 0, radius: 5 }, { angle: Math.PI, radius: 5 })).toBeCloseTo(10);
  });

  it("treats touching circles as overlapping", () => {
    expect(circlesOverlap({ x: 0, y: 0, radius: 2 }, { x: 5, y: 0, radius: 3 })).toBe(true);
    expect(circlesOverlap({ x: 0, y: 0, radius: 2 }, { x: 5.01, y: 0, radius: 3 })).toBe(false);
  });

  it("detects a fast moving circle crossing a target between frames", () => {
    const target = { x: 0, y: 0, radius: 2 };

    expect(sweptCircleOverlap({ x: -10, y: 0 }, { x: 10, y: 0 }, 1, target)).toBe(true);
    expect(sweptCircleOverlap({ x: -10, y: 4 }, { x: 10, y: 4 }, 1, target)).toBe(false);
  });

  it("moves toward a target without overshooting", () => {
    expect(moveAngleToward(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(moveAngleToward(0, 0.1, 0.25)).toBeCloseTo(0.1);
    expect(moveAngleToward(TAU - 0.1, 0.1, 0.05)).toBeCloseTo(TAU - 0.05);
    expect(() => moveAngleToward(0, 1, -0.1)).toThrow(RangeError);
  });
});
