import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { CONFIG } from "../../src/game/config";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { SeededRng } from "../../src/game/core/rng";
import { EMPTY_INPUT_SNAPSHOT, createInputSnapshot } from "../../src/game/systems/input";
import { createProjectile } from "../../src/game/systems/weapons";

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
      pendingSpawns: 9,
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

  it("records focus and settings pauses without hiding a live simulation", () => {
    const game = createGame();
    game.startRun();
    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    const beforePause = game.deterministicState();

    expect(game.pause("focus")).toBe(true);
    expect(game.snapshot()).toMatchObject({
      state: "paused",
      pausedFrom: "playing",
      pauseReason: "focus",
    });
    for (let step = 0; step < 30; step += 1) {
      game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    }
    expect(game.deterministicState()).not.toBe(beforePause);
    const pausedState = game.deterministicState();
    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    expect(game.deterministicState()).toBe(pausedState);

    expect(game.resume()).toBe(true);
    expect(game.snapshot()).toMatchObject({ state: "playing", pauseReason: "manual" });
    expect(game.pause("settings")).toBe(true);
    expect(game.snapshot()).toMatchObject({ state: "paused", pauseReason: "settings" });
  });

  it("does not drop pause taps during transition states", () => {
    const game = createGame();
    game.startRun();
    game.state.state = "waveClear";
    game.state.stateTimer = 1;

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["pause"] }));
    expect(game.snapshot()).toMatchObject({ state: "paused", pausedFrom: "waveClear" });
    expect(game.state.stateTimer).toBe(1);

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["pause"] }));
    expect(game.snapshot().state).toBe("waveClear");
    expect(game.state.stateTimer).toBe(1);
  });

  it("clears buffered dash input when a wave leaves active play", () => {
    const game = createGame();
    game.startRun();
    game.state.wave.queue = [];
    game.state.wave.completeDelay = 0.79;
    game.state.player.dashCooldown = 0.2;

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["dash"] }));

    expect(game.snapshot().state).toBe("waveClear");
    expect(game.state.player.dashBufferTimer).toBe(0);
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

  it("gives a fatal boss beam precedence over a final player shot in the same step", () => {
    const game = createGame();
    game.startBossScenario();
    const boss = game.state.boss;
    expect(boss).not.toBeNull();
    if (boss === null) {
      return;
    }

    game.state.player.lives = 1;
    boss.health = 1;
    boss.phase = 3;
    boss.phaseAwarded = { 2: true, 3: true };
    boss.beams.push({
      angle: game.state.player.angle,
      width: 0.2,
      timer: CONFIG.boss.phases[2].beam.warningTime,
      warningTime: CONFIG.boss.phases[2].beam.warningTime,
      activeTime: CONFIG.boss.phases[2].beam.activeTime,
      active: true,
      hitPlayer: false,
      done: false,
    });
    game.state.playerShots.push(
      createProjectile({
        owner: "player",
        angle: boss.rotation + Math.PI / 4,
        radius: CONFIG.arena.bossHitRadius,
        radialSpeed: 0,
        damage: 1,
        size: CONFIG.projectiles.playerSize,
        color: CONFIG.colors.playerBullet,
      }),
    );

    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);

    expect(game.snapshot()).toMatchObject({
      state: "gameOver",
      lives: 0,
      bossHealth: 1,
    });
  });
});
