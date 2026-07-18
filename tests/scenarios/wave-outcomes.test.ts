import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { CONFIG } from "../../src/game/config";
import type { EnemyType } from "../../src/game/content/enemies";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { SeededRng } from "../../src/game/core/rng";
import type { EnemyState } from "../../src/game/state";
import type { EnemyOverrides } from "../../src/game/systems/host";
import { EMPTY_INPUT_SNAPSHOT, createInputSnapshot } from "../../src/game/systems/input";
import { WAVE_COMPLETION_DELAY_SECONDS } from "../../src/game/systems/spawning";
import { createProjectile } from "../../src/game/systems/weapons";
import type { WaveOutcome } from "../../src/game/waveOutcomes";

const PERFECT_OUTCOME: WaveOutcome = {
  waveClear: true,
  noDamage: true,
  fullClear: true,
  perfect: true,
};

interface AbsorptionCase {
  readonly name: string;
  readonly configure: (game: Game) => void;
}

const ABSORPTION_CASES = [
  {
    name: "dash invulnerability",
    configure: (game: Game) => {
      game.state.player.dashInvulnerabilityTimer = 0.5;
    },
  },
  {
    name: "post-hit invulnerability",
    configure: (game: Game) => {
      game.state.player.invulnerabilityTimer = 0.5;
    },
  },
  {
    name: "an orbit shield",
    configure: (game: Game) => {
      game.state.player.shieldActive = true;
    },
  },
] as const satisfies readonly AbsorptionCase[];

describe("M2 wave outcome integration", () => {
  it("awards all four outcomes only for a surviving normal-fire full clear", () => {
    const game = createWaveScenario("normal-full-clear");
    const first = spawnRequired(game, "drifter");
    const second = spawnRequired(game, "spiral", Math.PI);

    expect(game.resolveEnemy(first, "shot")).toBe(true);
    expect(game.resolveEnemy(second, "shot")).toBe(true);

    const scoreBeforeOutcome = game.state.player.score;
    const snapshot = finishWave(game);

    expect(snapshot.waveStats).toEqual({
      requiredEnemiesSpawned: 2,
      enemiesDestroyed: 2,
      enemiesKilledByBomb: 0,
      enemiesBreached: 0,
      enemiesEscaped: 0,
      playerDamaged: false,
      bombUsed: false,
    });
    expect(snapshot.lastWaveOutcome).toEqual(PERFECT_OUTCOME);
    expect(snapshot.score).toBe(scoreBeforeOutcome + CONFIG.scoring.perfectWaveBonus);
  });

  it("records a normal-shot destruction through the gameplay collision path", () => {
    const game = createWaveScenario("shot-path");
    const enemy = spawnRequired(game, "drifter", 0.4, {
      radius: 120,
      radialSpeed: 0,
    });
    game.state.playerShots.push(
      createProjectile({
        owner: "player",
        angle: enemy.angle,
        radius: enemy.radius,
        radialSpeed: 0,
        damage: enemy.health,
        size: CONFIG.projectiles.playerSize,
        color: CONFIG.colors.playerBullet,
      }),
    );

    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);

    expect(enemy).toMatchObject({ active: false, resolution: "shot" });
    expect(game.state.waveStats).toMatchObject({
      requiredEnemiesSpawned: 1,
      enemiesDestroyed: 1,
      enemiesEscaped: 0,
      enemiesBreached: 0,
    });
  });

  it("records a natural outer-boundary escape through enemy movement", () => {
    const game = createWaveScenario("escape-path");
    const enemy = spawnRequired(game, "drifter", 0, {
      radius: CONFIG.arena.outerKillRadius + CONFIG.enemies.drifter.size + 1,
      radialSpeed: 0,
    });

    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);

    expect(enemy).toMatchObject({ active: false, resolution: "escaped" });
    expect(game.state.waveStats).toMatchObject({
      requiredEnemiesSpawned: 1,
      enemiesDestroyed: 0,
      enemiesEscaped: 1,
      enemiesBreached: 0,
    });
  });

  it("keeps Wave Clear and Flawless but rejects Full Clear when an enemy escapes", () => {
    const game = createWaveScenario("escape");
    const destroyed = spawnRequired(game, "drifter");
    const escaped = spawnRequired(game, "spiral");

    game.resolveEnemy(destroyed, "shot");
    game.resolveEnemy(escaped, "escaped");

    const scoreBeforeOutcome = game.state.player.score;
    const snapshot = finishWave(game);
    expect(snapshot.lastWaveOutcome).toEqual({
      waveClear: true,
      noDamage: true,
      fullClear: false,
      perfect: false,
    });
    expect(snapshot.score).toBe(scoreBeforeOutcome);
    expect(game.state.waveStats.enemiesEscaped).toBe(1);
  });

  it("records damaging contact as both player damage and a breach", () => {
    const game = createWaveScenario("damaging-contact");
    const hunter = spawnAtPlayer(game, "hunter");
    hunter.behavior = "release";

    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);

    expect(game.state.player.lives).toBe(2);
    expect(game.state.waveStats).toMatchObject({
      requiredEnemiesSpawned: 1,
      enemiesDestroyed: 0,
      enemiesBreached: 1,
      playerDamaged: true,
    });
    expect(game.snapshot().run).toMatchObject({
      damageTaken: 1,
      lastDamageSource: "enemy-contact",
      lastDamageEnemyType: "hunter",
    });
    expect(finishWave(game).lastWaveOutcome).toEqual({
      waveClear: true,
      noDamage: false,
      fullClear: false,
      perfect: false,
    });
  });

  it.each(ABSORPTION_CASES)(
    "treats contact absorbed by $name as a no-damage breach",
    ({ configure }) => {
      const game = createWaveScenario("absorbed-contact");
      configure(game);
      spawnAtPlayer(game, "drifter");

      game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);

      expect(game.state.player.lives).toBe(3);
      expect(game.state.waveStats).toMatchObject({
        requiredEnemiesSpawned: 1,
        enemiesDestroyed: 0,
        enemiesBreached: 1,
        playerDamaged: false,
      });
      expect(finishWave(game).lastWaveOutcome).toEqual({
        waveClear: true,
        noDamage: true,
        fullClear: false,
        perfect: false,
      });
    },
  );

  it("counts bomb kills as destructions while disqualifying Perfect", () => {
    const game = createWaveScenario("bomb-clear");
    const shooter = spawnRequired(game, "shooter");
    const drifter = spawnRequired(game, "drifter", Math.PI);

    shooter.behavior = "windup";
    shooter.behaviorTimer = 0;
    shooter.targetAngle = game.state.player.angle;
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["bomb"] }));

    expect(shooter.resolution).toBe("bomb");
    expect(drifter.resolution).toBe("bomb");
    expect(game.state.enemyBullets).toHaveLength(0);
    expect(game.state.waveStats).toEqual({
      requiredEnemiesSpawned: 2,
      enemiesDestroyed: 2,
      enemiesKilledByBomb: 2,
      enemiesBreached: 0,
      enemiesEscaped: 0,
      playerDamaged: false,
      bombUsed: true,
    });
    const scoreBeforeOutcome = game.state.player.score;
    const snapshot = finishWave(game);
    expect(snapshot.lastWaveOutcome).toEqual({
      waveClear: true,
      noDamage: true,
      fullClear: true,
      perfect: false,
    });
    expect(snapshot.score).toBe(scoreBeforeOutcome);
  });

  it("allows a dash while still awarding an otherwise Perfect wave", () => {
    const game = createWaveScenario("dash-perfect");
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["dash"] }));
    expect(game.snapshot().run.firstDashSeconds).toEqual(expect.any(Number));

    const enemy = spawnRequired(game, "drifter");
    game.resolveEnemy(enemy, "shot");
    const scoreBeforeOutcome = game.state.player.score;
    const snapshot = finishWave(game);

    expect(snapshot.lastWaveOutcome).toEqual(PERFECT_OUTCOME);
    expect(snapshot.score).toBe(scoreBeforeOutcome + CONFIG.scoring.perfectWaveBonus);
  });

  it("excludes transition cleanup from destruction, escape, breach, and run-kill counts", () => {
    const game = createWaveScenario("transition-cleanup");
    const required = spawnRequired(game, "drifter");
    const debug = spawnWithOrigin(game, "spiral", "debug");
    const bossAdd = spawnWithOrigin(game, "hunter", "boss");

    expect(game.resolveEnemy(required, "transition")).toBe(true);
    expect(game.resolveEnemy(debug, "transition")).toBe(true);
    expect(game.resolveEnemy(bossAdd, "transition")).toBe(true);

    expect(game.state.waveStats).toEqual({
      requiredEnemiesSpawned: 1,
      enemiesDestroyed: 0,
      enemiesKilledByBomb: 0,
      enemiesBreached: 0,
      enemiesEscaped: 0,
      playerDamaged: false,
      bombUsed: false,
    });
    expect(game.state.runMetrics.enemiesDestroyed).toBe(0);
    expect(game.state.player.score).toBe(0);
  });

  it("excludes boss and debug enemies from every wave-resolution counter", () => {
    const game = createWaveScenario("origin-exclusions");
    const resolutions = ["shot", "bomb", "contact", "escaped"] as const;

    for (const origin of ["boss", "debug"] as const) {
      for (const resolution of resolutions) {
        const enemy = spawnWithOrigin(game, "drifter", origin);
        expect(game.resolveEnemy(enemy, resolution)).toBe(true);
      }
    }

    expect(game.state.waveStats).toEqual({
      requiredEnemiesSpawned: 0,
      enemiesDestroyed: 0,
      enemiesKilledByBomb: 0,
      enemiesBreached: 0,
      enemiesEscaped: 0,
      playerDamaged: false,
      bombUsed: false,
    });
  });

  it("resolves each enemy at most once without double-counting kills or escapes", () => {
    const game = createWaveScenario("idempotent-resolution");
    const killed = spawnRequired(game, "drifter");
    const escaped = spawnRequired(game, "spiral");

    expect(game.resolveEnemy(killed, "shot")).toBe(true);
    expect(game.resolveEnemy(killed, "bomb")).toBe(false);
    expect(game.resolveEnemy(killed, "escaped")).toBe(false);
    expect(game.resolveEnemy(escaped, "escaped")).toBe(true);
    expect(game.resolveEnemy(escaped, "escaped")).toBe(false);
    expect(game.resolveEnemy(escaped, "shot")).toBe(false);

    expect(game.state.waveStats).toMatchObject({
      requiredEnemiesSpawned: 2,
      enemiesDestroyed: 1,
      enemiesKilledByBomb: 0,
      enemiesBreached: 0,
      enemiesEscaped: 1,
    });
    expect(game.state.runMetrics.enemiesDestroyed).toBe(1);
  });

  it("keeps an accurate clear summary and resets statistics for the next wave", () => {
    const game = createWaveScenario("wave-reset");
    const destroyed = spawnRequired(game, "drifter");
    const escaped = spawnRequired(game, "spiral");
    game.resolveEnemy(destroyed, "shot");
    game.resolveEnemy(escaped, "escaped");

    const clearSnapshot = finishWave(game);
    const clearOutcome = {
      waveClear: true,
      noDamage: true,
      fullClear: false,
      perfect: false,
    } as const;

    expect(clearSnapshot.waveStats).toMatchObject({
      requiredEnemiesSpawned: 2,
      enemiesDestroyed: 1,
      enemiesEscaped: 1,
    });
    expect(clearSnapshot.lastWaveOutcome).toEqual(clearOutcome);

    game.step(game.state.stateTimer, EMPTY_INPUT_SNAPSHOT);

    expect(game.snapshot()).toMatchObject({
      state: "playing",
      currentWave: 2,
      waveStats: {
        requiredEnemiesSpawned: 0,
        enemiesDestroyed: 0,
        enemiesKilledByBomb: 0,
        enemiesBreached: 0,
        enemiesEscaped: 0,
        playerDamaged: false,
        bombUsed: false,
      },
      lastWaveOutcome: clearOutcome,
    });
  });
});

function createWaveScenario(seed: string): Game {
  const game = new Game({ seed, presentationRandom: new SeededRng("wave-outcome-visuals") });
  game.startRun();
  game.state.wave.queue = [];
  game.drainEvents();
  return game;
}

function spawnRequired(
  game: Game,
  type: EnemyType,
  angle = 0,
  overrides: EnemyOverrides = {},
): EnemyState {
  return spawn(game, type, angle, { ...overrides, origin: "wave" });
}

function spawnAtPlayer(game: Game, type: EnemyType): EnemyState {
  return spawnRequired(game, type, game.state.player.angle, {
    radius: game.state.player.radius,
    radialSpeed: 0,
  });
}

function spawnWithOrigin(game: Game, type: EnemyType, origin: "boss" | "debug"): EnemyState {
  return spawn(game, type, 0, { origin });
}

function spawn(game: Game, type: EnemyType, angle: number, overrides: EnemyOverrides): EnemyState {
  game.spawnEnemy(type, angle, overrides);
  const enemy = game.state.enemies.at(-1);
  if (enemy === undefined) {
    throw new Error(`Failed to spawn ${type}`);
  }
  return enemy;
}

function finishWave(game: Game): ReturnType<Game["snapshot"]> {
  game.state.wave.queue = [];
  game.state.wave.completeDelay = 0;
  game.step(WAVE_COMPLETION_DELAY_SECONDS, EMPTY_INPUT_SNAPSHOT);
  expect(game.state.state).toBe("waveClear");
  return game.snapshot();
}
