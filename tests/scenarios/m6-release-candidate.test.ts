import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { SeededRng } from "../../src/game/core/rng";
import { damageBoss } from "../../src/game/systems/boss";
import { createInputSnapshot, EMPTY_INPUT_SNAPSHOT } from "../../src/game/systems/input";

const RELEASE_SEEDS = [
  "m6-outer-017",
  "m6-crossfire-113",
  "m6-lattice-229",
  "m6-pulse-347",
  "m6-aperture-461",
  "m6-drift-587",
  "m6-collapse-613",
  "m6-vector-739",
  "m6-shield-857",
  "m6-orbit-983",
] as const;

const LOADOUTS = [
  { name: "baseline", weaponLevel: 1, shield: false, bombs: 0, useBomb: false },
  { name: "twin", weaponLevel: 2, shield: false, bombs: 0, useBomb: false },
  { name: "shield", weaponLevel: 1, shield: true, bombs: 0, useBomb: false },
  { name: "bomb", weaponLevel: 1, shield: false, bombs: 2, useBomb: true },
  { name: "full", weaponLevel: 3, shield: true, bombs: 3, useBomb: true },
] as const;

describe("M6 seeded release-candidate matrix", () => {
  it.each(RELEASE_SEEDS)("finishes seed %s without a stuck or invalid transition", (seed) => {
    const result = completeReleaseRun(seed);

    expect(result.state).toBe("victory");
    expect(result.waves).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.bossPhases).toEqual([1, 2, 3]);
    expect(result.waveTimings).toHaveLength(8);
    expect(result.elapsedSeconds).toBeGreaterThan(0);
    expect(result.steps).toBeLessThan(30_000);
    expect(result.maxEffects).toBeLessThanOrEqual(96);
  });

  it("replays the same release seed and power schedule exactly", () => {
    const first = completeReleaseRun(RELEASE_SEEDS[4]);
    const second = completeReleaseRun(RELEASE_SEEDS[4]);

    expect(second.deterministicState).toBe(first.deterministicState);
  });

  it("survives rapid restart, pause, and long fixed-step sessions", () => {
    const game = new Game({
      seed: "m6-long-session",
      presentationRandom: new SeededRng("m6-long-session-visuals"),
    });

    for (let restart = 0; restart < 50; restart += 1) {
      game.startRun();
      game.step(FIXED_STEP_SECONDS, createInputSnapshot({ held: ["right", "fire"] }));
      expect(game.pause(restart % 2 === 0 ? "focus" : "manual")).toBe(true);
      const pausedState = game.deterministicState();
      for (let step = 0; step < 30; step += 1) {
        game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
      }
      expect(game.deterministicState()).toBe(pausedState);
      expect(game.resume()).toBe(true);
      game.forceState("gameOver");
      expect(game.state.state).toBe("gameOver");
    }

    game.startRun();
    game.setDebugInvulnerable(true);
    for (let step = 0; step < 30 * 60 * 60; step += 1) {
      if (game.state.state === "playing") {
        for (const enemy of [...game.state.enemies]) {
          game.resolveEnemy(enemy, "shot");
        }
      }
      game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
      game.drainEvents();
      if (game.state.boss !== null) {
        break;
      }
    }

    expect(game.state.boss).not.toBeNull();
    expect(game.state.runMetrics.elapsedSeconds).toBeLessThan(30 * 60);
    expect(game.state.effects.length).toBeLessThanOrEqual(96);
  });
});

function completeReleaseRun(seed: string): ReleaseRunResult {
  const game = new Game({
    seed,
    presentationRandom: new SeededRng(`${seed}-visuals`),
  });
  const waves = new Set<number>();
  const bossPhases = new Set<number>();
  const appliedWaves = new Set<number>();
  let bombUsed = false;
  let maxEffects = 0;
  let steps = 0;

  game.startRun();
  game.setDebugInvulnerable(true);

  for (; steps < 30_000 && game.state.state !== "victory"; steps += 1) {
    expect(["playing", "paused", "waveClear", "bossIntro", "gameOver", "victory"]).toContain(
      game.state.state,
    );
    expect(Number.isFinite(game.state.stateTimer)).toBe(true);
    expect(game.state.player.lives).toBeGreaterThan(0);

    if (!appliedWaves.has(game.state.currentWave)) {
      appliedWaves.add(game.state.currentWave);
      const loadout = LOADOUTS[(game.state.currentWave - 1) % LOADOUTS.length] ?? LOADOUTS[0];
      game.state.player.weaponLevel = loadout.weaponLevel;
      game.state.player.shieldActive = loadout.shield;
      game.state.player.bombCount = loadout.bombs;
    }

    if (game.state.state === "playing") {
      waves.add(game.state.currentWave);
      for (const enemy of [...game.state.enemies]) {
        game.resolveEnemy(enemy, "shot");
      }

      const loadout = LOADOUTS[(game.state.currentWave - 1) % LOADOUTS.length] ?? LOADOUTS[0];
      if (
        loadout.useBomb &&
        !bombUsed &&
        game.state.currentWave >= 4 &&
        game.state.player.bombCount > 0
      ) {
        game.activateBomb();
        bombUsed = true;
      }

      const boss = game.state.boss;
      if (boss !== null) {
        bossPhases.add(boss.phase);
        if (boss.transitionTimer <= 0) {
          damageBoss(boss, 10_000, game);
        }
      }
    }

    if (game.snapshot().state === "victory") {
      break;
    }

    const direction = Math.floor(steps / 240) % 2 === 0 ? "right" : "left";
    game.step(
      FIXED_STEP_SECONDS,
      createInputSnapshot({
        held: game.state.state === "playing" ? [direction, "fire"] : [],
        pressed: game.state.state === "playing" && steps % 360 === 0 ? ["dash"] : [],
      }),
    );
    maxEffects = Math.max(maxEffects, game.state.effects.length);
    game.drainEvents();
  }

  return {
    state: game.state.state,
    waves: [...waves].sort((left, right) => left - right),
    bossPhases: [...bossPhases].sort((left, right) => left - right),
    waveTimings: game.state.runMetrics.waveTimings.map((timing) => ({ ...timing })),
    elapsedSeconds: game.state.runMetrics.elapsedSeconds,
    steps,
    maxEffects,
    deterministicState: game.deterministicState(),
  };
}

interface ReleaseRunResult {
  readonly state: string;
  readonly waves: number[];
  readonly bossPhases: number[];
  readonly waveTimings: readonly { readonly wave: number; readonly seconds: number }[];
  readonly elapsedSeconds: number;
  readonly steps: number;
  readonly maxEffects: number;
  readonly deterministicState: string;
}
