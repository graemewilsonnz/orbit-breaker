import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { CONFIG } from "../../src/game/config";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { signedAngleDelta } from "../../src/game/core/geometry";
import { SeededRng } from "../../src/game/core/rng";
import { EMPTY_INPUT_SNAPSHOT, createInputSnapshot } from "../../src/game/systems/input";

function createPlayingGame(): Game {
  const game = new Game({
    seed: "m1-controls",
    presentationRandom: new SeededRng("m1-controls-visuals"),
  });
  game.startRun();
  game.drainEvents();
  return game;
}

describe("M1 control feel", () => {
  it("uses the golden-first-minute movement, fire, and dash tuning", () => {
    expect(CONFIG.player).toMatchObject({
      rotationSpeed: 3.6,
      fireCooldown: 0.15,
      dashCooldown: 0.9,
      dashDistance: 0.72,
      dashInputBuffer: 0.15,
    });
  });

  it("reverses direction on the next fixed simulation step", () => {
    const game = createPlayingGame();
    const startAngle = game.state.player.angle;

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ held: ["right"] }));
    const rightAngle = game.state.player.angle;
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ held: ["left"] }));

    expect(signedAngleDelta(startAngle, rightAngle)).toBeCloseTo(
      CONFIG.player.rotationSpeed * FIXED_STEP_SECONDS,
    );
    expect(signedAngleDelta(rightAngle, game.state.player.angle)).toBeCloseTo(
      -CONFIG.player.rotationSpeed * FIXED_STEP_SECONDS,
    );
  });

  it("fires a complete tap and then respects the tuned cadence while held", () => {
    const game = createPlayingGame();

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["fire"] }));
    expect(game.state.playerShots).toHaveLength(1);

    const cooldownSteps = Math.round(CONFIG.player.fireCooldown / FIXED_STEP_SECONDS);
    for (let step = 1; step < cooldownSteps; step += 1) {
      game.step(FIXED_STEP_SECONDS, createInputSnapshot({ held: ["fire"] }));
      expect(game.state.playerShots).toHaveLength(1);
    }

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ held: ["fire"] }));
    expect(game.state.playerShots).toHaveLength(2);
  });
});

describe("M1 dash input buffer", () => {
  it("executes an early dash press on the first step the cooldown is ready", () => {
    const game = createPlayingGame();
    const player = game.state.player;
    const startAngle = player.angle;
    player.lastMoveDirection = 1;
    player.dashCooldown = FIXED_STEP_SECONDS * 2.5;

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["dash"] }));
    expect(player.angle).toBe(startAngle);
    expect(player.dashBufferTimer).toBeGreaterThan(0);

    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    expect(player.angle).toBe(startAngle);
    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);

    expect(signedAngleDelta(startAngle, player.angle)).toBeCloseTo(CONFIG.player.dashDistance);
    expect(player.dashCooldown).toBe(CONFIG.player.dashCooldown);
    expect(player.dashBufferTimer).toBe(0);
    expect(
      game.drainEvents().filter((event) => event.type === "audio" && event.payload.cue === "dash"),
    ).toHaveLength(1);
  });

  it("expires a dash press made outside the buffer window", () => {
    const game = createPlayingGame();
    const player = game.state.player;
    const startAngle = player.angle;
    player.dashCooldown = CONFIG.player.dashInputBuffer + FIXED_STEP_SECONDS * 3;

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["dash"] }));
    const stepsUntilReady = Math.ceil(player.dashCooldown / FIXED_STEP_SECONDS) + 1;
    for (let step = 0; step < stepsUntilReady; step += 1) {
      game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    }

    expect(player.angle).toBe(startAngle);
    expect(player.dashCooldown).toBe(0);
    expect(player.dashBufferTimer).toBe(0);
    expect(
      game.drainEvents().some((event) => event.type === "audio" && event.payload.cue === "dash"),
    ).toBe(false);
  });
});
