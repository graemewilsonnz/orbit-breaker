import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { SeededRng } from "../../src/game/core/rng";
import { EMPTY_INPUT_SNAPSHOT, createInputSnapshot } from "../../src/game/systems/input";

function createGame(): Game {
  return new Game({ seed: "state-routes", presentationRandom: new SeededRng("visual") });
}

describe("game state routes", () => {
  it("starts on the title and Enter begins a clean wave-one run", () => {
    const game = createGame();

    expect(game.snapshot().state).toBe("title");
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["enter"] }));

    expect(game.snapshot()).toMatchObject({
      state: "playing",
      currentWave: 1,
      waveReached: 1,
      score: 0,
      lives: 3,
      bombs: 1,
      pendingSpawns: 10,
    });
  });

  it("pauses before simulation and resumes without advancing the wave", () => {
    const game = createGame();
    game.startRun();
    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    const beforePause = game.snapshot().waveElapsed;

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["pause"] }));
    expect(game.snapshot().state).toBe("paused");
    expect(game.snapshot().waveElapsed).toBe(beforePause);

    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    expect(game.snapshot().waveElapsed).toBe(beforePause);

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["pause"] }));
    expect(game.snapshot().state).toBe("playing");
    expect(game.snapshot().waveElapsed).toBe(beforePause);
  });

  it("restarts cleanly from game over", () => {
    const game = createGame();
    game.startRun();
    game.state.player.score = 4321;
    game.forceState("gameOver");

    expect(game.snapshot()).toMatchObject({ state: "gameOver", lives: 0, score: 4321 });
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["enter"] }));

    expect(game.snapshot()).toMatchObject({
      state: "playing",
      currentWave: 1,
      score: 0,
      lives: 3,
      bombs: 1,
    });
  });

  it("reaches victory and restarts cleanly", () => {
    const game = createGame();
    game.startBossScenario();
    game.forceState("victory");

    expect(game.snapshot()).toMatchObject({
      state: "victory",
      score: 5500,
      enemies: 0,
      enemyBullets: 0,
    });
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["enter"] }));
    expect(game.snapshot()).toMatchObject({
      state: "playing",
      currentWave: 1,
      score: 0,
      lives: 3,
    });
  });
});
