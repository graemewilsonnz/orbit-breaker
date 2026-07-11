import { describe, expect, it, vi } from "vitest";

import { FIXED_STEP_SECONDS, FixedStepClock } from "../../src/game/core/clock";

describe("FixedStepClock", () => {
  it("accumulates display frames and emits only fixed simulation steps", () => {
    const onStep = vi.fn();
    const clock = new FixedStepClock();

    const partial = clock.advanceBy(FIXED_STEP_SECONDS / 2, onStep);
    expect(partial.simulatedSteps).toBe(0);
    expect(partial.interpolationAlpha).toBeCloseTo(0.5);

    const completed = clock.advanceBy(FIXED_STEP_SECONDS / 2, onStep);
    expect(completed.simulatedSteps).toBe(1);
    expect(completed.interpolationAlpha).toBe(0);
    expect(onStep).toHaveBeenCalledExactlyOnceWith(FIXED_STEP_SECONDS);
  });

  it("anchors the first browser timestamp without advancing simulation", () => {
    const onStep = vi.fn();
    const clock = new FixedStepClock({ stepSeconds: 0.01 });

    expect(clock.advance(1_000, onStep).simulatedSteps).toBe(0);
    expect(clock.advance(1_025, onStep).simulatedSteps).toBe(2);
    expect(clock.interpolationAlpha).toBeCloseTo(0.5);
  });

  it("clamps stalls and drops excess whole steps to prevent a spiral", () => {
    const onStep = vi.fn();
    const clock = new FixedStepClock({
      maxFrameSeconds: 0.05,
      maxStepsPerFrame: 3,
      stepSeconds: 0.01,
    });

    const frame = clock.advanceBy(1, onStep);

    expect(frame.rawFrameSeconds).toBe(1);
    expect(frame.simulatedSteps).toBe(3);
    expect(frame.simulatedSeconds).toBeCloseTo(0.03);
    expect(frame.droppedSeconds).toBeCloseTo(0.97);
    expect(frame.interpolationAlpha).toBeCloseTo(0);
    expect(onStep).toHaveBeenCalledTimes(3);
  });

  it("resets accumulated time and can re-anchor timestamps", () => {
    const clock = new FixedStepClock({ stepSeconds: 0.01 });
    clock.advanceBy(0.015, () => undefined);

    clock.reset(2_000);

    expect(clock.simulationTimeSeconds).toBe(0);
    expect(clock.interpolationAlpha).toBe(0);
    expect(clock.advance(2_010, () => undefined).simulatedSteps).toBe(1);
  });

  it("rejects invalid clock configuration and elapsed time", () => {
    expect(() => new FixedStepClock({ stepSeconds: 0 })).toThrow(RangeError);
    expect(() => new FixedStepClock({ maxStepsPerFrame: 1.5 })).toThrow(RangeError);

    const clock = new FixedStepClock();
    expect(() => clock.advanceBy(-1, () => undefined)).toThrow(RangeError);
    expect(() => clock.advance(Number.NaN, () => undefined)).toThrow(TypeError);
  });
});
