import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { SeededRng } from "../../src/game/core/rng";
import { createInputSnapshot } from "../../src/game/systems/input";

function runScenario(seed: string, presentationSeed: string): string {
  const game = new Game({
    seed,
    presentationRandom: new SeededRng(presentationSeed),
  });
  game.startRun();

  for (let step = 0; step < 420; step += 1) {
    game.step(
      FIXED_STEP_SECONDS,
      createInputSnapshot({
        held: [step % 180 < 90 ? "right" : "left", "fire"],
        pressed: step === 30 ? ["dash"] : [],
      }),
    );
  }
  return game.deterministicState();
}

describe("deterministic simulation", () => {
  it("repeats the same spawn order and outcome for a supplied seed", () => {
    expect(runScenario("repeatable-run", "visual-a")).toBe(
      runScenario("repeatable-run", "visual-b"),
    );
  });

  it("produces a different authored spawn sequence for a different seed", () => {
    expect(runScenario("seed-a", "visual")).not.toBe(runScenario("seed-b", "visual"));
  });

  it("resets the gameplay stream when a run restarts", () => {
    const game = new Game({
      seed: "restartable",
      presentationRandom: new SeededRng("visual"),
    });

    const play = (): string => {
      game.startRun();
      for (let step = 0; step < 180; step += 1) {
        game.step(FIXED_STEP_SECONDS, createInputSnapshot({ held: ["right", "fire"] }));
      }
      return game.deterministicState();
    };

    expect(play()).toBe(play());
  });
});
