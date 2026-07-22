import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { CONFIG } from "../../src/game/config";
import { WAVE_DEFINITIONS, wavePressureCost } from "../../src/game/content/waves";
import { SeededRng } from "../../src/game/core/rng";
import { EMPTY_INPUT_SNAPSHOT } from "../../src/game/systems/input";

const STEP = 1 / 60;

describe("M3 eight-wave progression", () => {
  it("keeps the authored run-to-boss target inside three to five minutes", () => {
    const minimum = WAVE_DEFINITIONS.reduce((total, wave) => total + wave.targetDuration[0], 0);
    const maximum = WAVE_DEFINITIONS.reduce((total, wave) => total + wave.targetDuration[1], 0);

    expect(minimum).toBeGreaterThanOrEqual(180 - 8 * 1.7);
    expect(maximum).toBeLessThanOrEqual(300);
    for (const wave of WAVE_DEFINITIONS) {
      expect(wave.pressureBudget).toBe(wavePressureCost(wave));
      expect(wave.recoveryBeats.length).toBeGreaterThan(0);
    }
  });

  it.each(WAVE_DEFINITIONS.map((_, index) => index + 1))(
    "completes Wave %i in an invincible idle flow",
    (waveNumber) => {
      const game = new Game({
        seed: `m3-idle-${waveNumber}`,
        presentationRandom: new SeededRng("visuals"),
      });
      game.startAtWave(waveNumber);
      game.setDebugInvulnerable(true);

      stepUntilWaveClear(game, 55);

      expect(game.state.state).toBe("waveClear");
      expect(game.state.wave.queue).toHaveLength(0);
      expect(game.state.waveStats.requiredEnemiesSpawned).toBeGreaterThan(0);
    },
  );

  it.each(WAVE_DEFINITIONS.map((_, index) => index + 1))(
    "completes Wave %i in an invincible full-clear flow",
    (waveNumber) => {
      const game = new Game({
        seed: `m3-clear-${waveNumber}`,
        presentationRandom: new SeededRng("visuals"),
      });
      game.startAtWave(waveNumber);
      game.setDebugInvulnerable(true);

      for (let step = 0; step < 55 / STEP && game.state.state === "playing"; step += 1) {
        game.step(STEP, EMPTY_INPUT_SNAPSHOT);
        for (const enemy of game.state.enemies) {
          game.resolveEnemy(enemy, "shot");
        }
      }

      expect(game.state.state).toBe("waveClear");
      expect(game.state.lastWaveOutcome).toMatchObject({ fullClear: true, perfect: true });
    },
  );
});

describe("M3 scoring and power curve", () => {
  it("makes centre kills visibly more valuable and announces multiplier changes", () => {
    const game = new Game({ seed: "m3-score", presentationRandom: new SeededRng("visuals") });
    game.startRun();
    game.state.wave.queue = [];

    game.spawnEnemy("drifter", 0, { origin: "wave", radius: CONFIG.scoring.earlyKillRadius });
    const centreEnemy = game.state.enemies.at(-1);
    expect(centreEnemy).toBeDefined();
    game.resolveEnemy(required(centreEnemy, "centre enemy"), "shot");
    expect(game.state.player.score).toBe(150);
    expect(game.state.scoreFeedback?.secondary).toContain("CENTRE KILL");

    for (let index = 0; index < 4; index += 1) {
      game.spawnEnemy("drifter", index, { origin: "wave", radius: CONFIG.arena.dangerRadius });
      game.resolveEnemy(required(game.state.enemies.at(-1), "chain enemy"), "shot");
    }
    expect(game.state.player.multiplier).toBe(2);
    expect(game.state.scoreFeedback?.secondary).toBe("MULTIPLIER UP · x2");

    game.onPlayerDamaged("enemy-contact", "drifter");
    expect(game.state.player.multiplier).toBe(1);
    expect(game.state.scoreFeedback).toMatchObject({ primary: "CHAIN LOST" });
  });

  it("guarantees a capped pity drop without allowing pickup clutter", () => {
    const game = new Game({ seed: "m3-drops", presentationRandom: new SeededRng("visuals") });
    game.startRun();
    game.state.wave.queue = [];
    game.state.wave.killsSinceDrop = CONFIG.powerups.pityKills - 1;
    game.spawnEnemy("drifter", 0, { origin: "wave", radius: 200 });
    game.resolveEnemy(required(game.state.enemies.at(-1), "pity enemy"), "shot");

    expect(game.state.powerups).toHaveLength(1);
    expect(game.state.wave.dropsAwarded).toBe(1);
    expect(game.state.wave.killsSinceDrop).toBe(0);

    game.spawnPowerUp("shield");
    game.state.wave.killsSinceDrop = CONFIG.powerups.pityKills - 1;
    game.spawnEnemy("drifter", 1, { origin: "wave", radius: 200 });
    game.resolveEnemy(required(game.state.enemies.at(-1), "capped-drop enemy"), "shot");
    expect(game.state.powerups).toHaveLength(CONFIG.powerups.maxActiveDrops);
  });
});

function stepUntilWaveClear(game: Game, timeoutSeconds: number): void {
  for (let step = 0; step < timeoutSeconds / STEP && game.state.state === "playing"; step += 1) {
    game.step(STEP, EMPTY_INPUT_SNAPSHOT);
  }
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}
