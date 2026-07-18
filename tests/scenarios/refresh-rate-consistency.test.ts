import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { FixedStepClock } from "../../src/game/core/clock";
import { SeededRng } from "../../src/game/core/rng";
import { InputManager } from "../../src/game/systems/input";

interface CadenceResult {
  readonly deterministicState: string;
  readonly simulationTimeSeconds: number;
  readonly snapshot: ReturnType<Game["snapshot"]>;
  readonly dashCooldown: number;
}

interface TimedInput {
  readonly atSeconds: number;
  readonly apply: (input: InputManager) => void;
}

const RUN_SECONDS = 6;

function runAtDisplayRate(displayHz: 30 | 60 | 120): CadenceResult {
  const game = new Game({
    seed: "m1-refresh-rate",
    presentationRandom: new SeededRng("presentation-only"),
  });
  const clock = new FixedStepClock();
  const input = new InputManager();
  const timeline: readonly TimedInput[] = [
    {
      atSeconds: 2.001,
      apply: (manager) => manager.injectTap("pause"),
    },
    {
      atSeconds: 2.501,
      apply: (manager) => manager.injectTap("pause"),
    },
    {
      atSeconds: 3.001,
      apply: (manager) => {
        manager.injectRelease("right");
        manager.injectPress("left");
      },
    },
    {
      atSeconds: 5.401,
      apply: (manager) => manager.injectTap("dash"),
    },
  ];

  game.startRun();
  input.injectPress("right");
  input.injectPress("fire");
  clock.advance(0, () => undefined);

  let nextInput = 0;
  const frameCount = RUN_SECONDS * displayHz;
  for (let frame = 1; frame <= frameCount; frame += 1) {
    const frameSeconds = frame / displayHz;
    while (true) {
      const event = timeline[nextInput];
      if (event === undefined || event.atSeconds > frameSeconds) {
        break;
      }
      event.apply(input);
      nextInput += 1;
    }

    clock.advance(frameSeconds * 1000, (stepSeconds) => {
      game.step(stepSeconds, input.consumeStep());
    });
  }

  return {
    deterministicState: game.deterministicState(),
    simulationTimeSeconds: clock.simulationTimeSeconds,
    snapshot: game.snapshot(),
    dashCooldown: game.view().player.dashCooldown,
  };
}

describe("M1 refresh-rate consistency", () => {
  it("produces the same deterministic outcome at 30, 60, and 120 Hz", () => {
    const at30Hz = runAtDisplayRate(30);
    const at60Hz = runAtDisplayRate(60);
    const at120Hz = runAtDisplayRate(120);

    expect(at30Hz.simulationTimeSeconds).toBeCloseTo(RUN_SECONDS, 10);
    expect(at60Hz.simulationTimeSeconds).toBeCloseTo(RUN_SECONDS, 10);
    expect(at120Hz.simulationTimeSeconds).toBeCloseTo(RUN_SECONDS, 10);

    expect(at30Hz.deterministicState).toBe(at60Hz.deterministicState);
    expect(at120Hz.deterministicState).toBe(at60Hz.deterministicState);

    expect(at60Hz.snapshot.state).toBe("playing");
    expect(at60Hz.snapshot.waveElapsed).toBeGreaterThan(5);
    expect(at60Hz.snapshot.waveElapsed).toBeLessThan(RUN_SECONDS);
    expect(at60Hz.snapshot.pendingSpawns).toBeLessThan(10);
    expect(at60Hz.snapshot.playerShots).toBeGreaterThan(0);
    expect(at60Hz.snapshot.playerAngle).not.toBeCloseTo(-Math.PI / 2, 5);
    expect(at60Hz.dashCooldown).toBeGreaterThan(0);
  });
});
