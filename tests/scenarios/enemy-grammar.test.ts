import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { CONFIG } from "../../src/game/config";
import { ENEMY_TYPES, type EnemyType } from "../../src/game/content/enemies";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { normalizeAngle } from "../../src/game/core/geometry";
import { SeededRng } from "../../src/game/core/rng";
import type { EnemyState } from "../../src/game/state";
import { enemyContactRadius, updateShieldLinks } from "../../src/game/systems/collision";
import { createEnemy, updateEnemy } from "../../src/game/systems/enemies";
import { createInputSnapshot } from "../../src/game/systems/input";

describe("M2 enemy grammar", () => {
  it("creates deterministic, distinct runtime signatures for all six enemy types", () => {
    const signatures = ENEMY_TYPES.map((type) => {
      const first = createEnemy(type, 0.4, new SeededRng(`grammar-${type}`), {
        origin: "wave",
      });
      const repeated = createEnemy(type, 0.4, new SeededRng(`grammar-${type}`), {
        origin: "wave",
      });

      expect(repeated).toEqual(first);
      expect(first).toMatchObject({
        type,
        origin: "wave",
        resolution: null,
        active: true,
        age: 0,
      });

      return JSON.stringify({
        behavior: first.behavior,
        fireCooldown: first.fireCooldown,
        fireRadius: first.fireRadius,
        health: first.health,
        radialSpeed: first.radialSpeed,
        shieldRadius: first.shieldRadius ?? 0,
        size: first.size,
        turnRate: first.turnRate,
        angularVelocity: first.angularVelocity,
      });
    });

    expect(new Set(signatures).size).toBe(ENEMY_TYPES.length);
  });

  it("emits a unique pre-spawn identity cue for every enemy type", () => {
    const game = createGrammarGame("spawn-signals");

    for (const [index, type] of ENEMY_TYPES.entries()) {
      game.spawnEnemy(type, index, { origin: "debug" });
    }

    expect(drainAudioCues(game)).toEqual([
      "drifterSignal",
      "spiralSignal",
      "mineSignal",
      "shooterSignal",
      "hunterSignal",
      "shieldSignal",
    ]);
  });

  it("keeps drifter, spiral, and shield motion signatures deterministic and distinct", () => {
    const game = createGrammarGame("basic-motion");
    const drifter = createEnemy("drifter", 0.25, new SeededRng(1), {
      origin: "debug",
      radius: 20,
      radialSpeed: 60,
    });
    const spiral = createEnemy("spiral", 0.25, new SeededRng(2), {
      origin: "debug",
      angularVelocity: 1,
      radius: 20,
      radialSpeed: 60,
    });
    const shield = createEnemy("shield", 1, new SeededRng(3), {
      origin: "debug",
      angularVelocity: -0.2,
      radius: 20,
      radialSpeed: 40,
    });
    const initialSpiralAngle = spiral.angle;
    const spiralAngularVelocity = spiral.angularVelocity;

    updateEnemy(drifter, 0.25, game);
    updateEnemy(spiral, 0.25, game);
    updateEnemy(shield, 0.5, game);

    expect(drifter).toMatchObject({ angle: 0.25, radius: 35, behavior: "approach" });
    expect(spiral.angle).toBeCloseTo(
      normalizeAngle(initialSpiralAngle + spiralAngularVelocity * 0.25),
    );
    expect(spiral.radius).toBeCloseTo(35);
    expect(shield.angle).toBeCloseTo(0.9);
    expect(shield.radius).toBeCloseTo(40);
  });

  it("gives mines a full arming warning before expanding their danger radius and releasing", () => {
    const game = createGrammarGame("mine-warning");
    const mine = createEnemy("mine", 0, new SeededRng(4), {
      origin: "debug",
      radius: CONFIG.enemies.mine.claimRadius - 1,
      radialSpeed: 10,
    });
    game.state.enemies.push(mine);

    updateEnemy(mine, 0.1, game);

    expect(mine).toMatchObject({
      behavior: "arming",
      behaviorTimer: CONFIG.enemies.mine.warningTime,
      radius: CONFIG.enemies.mine.claimRadius,
    });
    expect(drainAudioCues(game)).toEqual(["mineSignal"]);
    expect(enemyContactRadius(mine)).toBeCloseTo(mine.size * CONFIG.hitboxes.enemyContactScale);

    updateEnemy(mine, CONFIG.enemies.mine.warningTime - 0.01, game);
    expect(mine.behavior).toBe("arming");
    expect(enemyContactRadius(mine)).toBeLessThan(CONFIG.enemies.mine.dangerRadius);

    updateEnemy(mine, 0.011, game);
    expect(mine).toMatchObject({
      behavior: "armed",
      behaviorTimer: CONFIG.enemies.mine.holdTime,
    });
    expect(enemyContactRadius(mine)).toBe(CONFIG.enemies.mine.dangerRadius);

    updateEnemy(mine, CONFIG.enemies.mine.holdTime + 0.001, game);
    expect(mine.behavior).toBe("release");
    const heldRadius = mine.radius;
    updateEnemy(mine, 0.25, game);
    expect(mine.radius - heldRadius).toBeCloseTo(CONFIG.enemies.mine.releaseSpeed * 0.25);
  });

  it("locks shooter aim and emits no projectile until the complete wind-up elapses", () => {
    const game = createGrammarGame("shooter-warning");
    game.state.player.angle = 1.1;
    const shooter = createEnemy("shooter", 0, new SeededRng(5), {
      origin: "debug",
    });
    shooter.radius = shooter.fireRadius;
    game.state.enemies.push(shooter);

    updateEnemy(shooter, 0.001, game);

    expect(shooter).toMatchObject({
      behavior: "windup",
      behaviorTimer: CONFIG.enemies.shooter.warningTime,
      targetAngle: 1.1,
    });
    expect(drainAudioCues(game)).toEqual(["shooterSignal"]);
    expect(game.state.enemyBullets).toHaveLength(0);

    game.state.player.angle = 4.2;
    updateEnemy(shooter, CONFIG.enemies.shooter.warningTime - 0.01, game);
    expect(shooter.behavior).toBe("windup");
    expect(shooter.targetAngle).toBe(1.1);
    expect(game.state.enemyBullets).toHaveLength(0);

    updateEnemy(shooter, 0.011, game);
    expect(shooter.behavior).toBe("recovery");
    expect(shooter.targetAngle).toBeNull();
    expect(game.state.enemyBullets).toHaveLength(1);
    expect(game.state.enemyBullets[0]).toMatchObject({
      owner: "enemy",
      radialSpeed: CONFIG.projectiles.enemySpeed,
      sourceEnemyType: "shooter",
    });
    expect(drainAudioCues(game)).toEqual(["shooterFire"]);

    updateEnemy(shooter, shooter.fireCooldown - 0.01, game);
    expect(shooter.behavior).toBe("recovery");
    expect(game.state.enemyBullets).toHaveLength(1);

    updateEnemy(shooter, 0.011, game);
    expect(shooter).toMatchObject({
      behavior: "windup",
      behaviorTimer: CONFIG.enemies.shooter.warningTime,
    });
    expect(game.state.enemyBullets).toHaveLength(1);
    expect(drainAudioCues(game)).toEqual(["shooterSignal"]);
  });

  it.each(ENEMY_TYPES)("keeps %s harmless throughout its pre-spawn warning window", (type) => {
    const game = createGrammarGame(`minimum-warning-${type}`);
    game.spawnEnemy(type, game.state.player.angle, { origin: "wave" });

    game.step(CONFIG.telegraphs.enemySpawnSeconds - 0.001, createInputSnapshot());

    expect(game.state.player.lives).toBe(CONFIG.player.lives);
    expect(game.state.waveStats.playerDamaged).toBe(false);
    expect(game.state.enemies[0]?.resolution).toBeNull();
  });

  it("locks a hunter target behind a complete warning before its non-tracking lunge", () => {
    const game = createGrammarGame("hunter-warning");
    game.state.player.angle = 0.6;
    const hunter = createEnemy("hunter", 0, new SeededRng(6), {
      origin: "debug",
      radius: CONFIG.enemies.hunter.lockRadius - 1,
      radialSpeed: 100,
      turnRate: 1,
    });
    game.state.enemies.push(hunter);

    updateEnemy(hunter, 0.02, game);
    const lockedAngle = hunter.angle;
    const lockedRadius = hunter.radius;

    expect(hunter).toMatchObject({
      behavior: "locked",
      behaviorTimer: CONFIG.enemies.hunter.warningTime,
      targetAngle: lockedAngle,
      radius: CONFIG.enemies.hunter.lockRadius,
    });
    expect(drainAudioCues(game)).toEqual(["hunterSignal"]);

    game.state.player.angle = 3.4;
    updateEnemy(hunter, CONFIG.enemies.hunter.warningTime - 0.01, game);
    expect(hunter).toMatchObject({ behavior: "locked", angle: lockedAngle, radius: lockedRadius });

    updateEnemy(hunter, 0.011, game);
    expect(hunter.behavior).toBe("release");
    expect(hunter.radius).toBe(lockedRadius);

    updateEnemy(hunter, 0.25, game);
    expect(hunter.angle).toBe(lockedAngle);
    expect(hunter.radius - lockedRadius).toBeCloseTo(CONFIG.enemies.hunter.lungeSpeed * 0.25);
  });

  it("makes Shield Carrier protection spatially obvious and removes links immediately on death", () => {
    const game = createGrammarGame("shield-links");
    const carrier = controlledEnemy("shield", { angle: 0, radius: 100 });
    const protectedEnemy = controlledEnemy("drifter", { angle: 0, radius: 150 });
    const outsideEnemy = controlledEnemy("spiral", { angle: 0, radius: 190 });
    game.state.enemies.push(carrier, protectedEnemy, outsideEnemy);

    updateShieldLinks(game);

    expect(carrier.shieldRadius).toBe(CONFIG.enemies.shield.shieldRadius);
    expect(protectedEnemy.shielded).toBe(true);
    expect(outsideEnemy.shielded).toBe(false);

    expect(game.resolveEnemy(carrier, "shot")).toBe(true);
    expect(protectedEnemy.shielded).toBe(false);
    expect(outsideEnemy.shielded).toBe(false);
  });

  it("does not let a zero-timer shooter fire later in the same step after a bomb resolves it", () => {
    const game = createGrammarGame("bombed-shooter");
    game.spawnEnemy("shooter", game.state.player.angle, { origin: "wave" });
    const shooter = required(game.state.enemies.at(-1), "bombed shooter");
    shooter.behavior = "windup";
    shooter.behaviorTimer = 0;
    shooter.targetAngle = game.state.player.angle;
    game.drainEvents();

    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["bomb"] }));

    expect(shooter).toMatchObject({ active: false, resolution: "bomb" });
    expect(game.state.enemyBullets).toHaveLength(0);
    expect(game.state.waveStats).toMatchObject({
      requiredEnemiesSpawned: 1,
      enemiesDestroyed: 1,
      enemiesKilledByBomb: 1,
      bombUsed: true,
    });
  });
});

function createGrammarGame(seed: string): Game {
  const game = new Game({ seed, presentationRandom: new SeededRng("enemy-grammar-visuals") });
  game.startRun();
  game.state.wave.queue = [];
  game.state.enemies = [];
  game.drainEvents();
  return game;
}

function controlledEnemy(
  type: EnemyType,
  position: Pick<EnemyState, "angle" | "radius">,
): EnemyState {
  return createEnemy(type, position.angle, new SeededRng(`controlled-${type}`), {
    origin: "debug",
    angularVelocity: 0,
    radialSpeed: 0,
    radius: position.radius,
  });
}

function drainAudioCues(game: Game): string[] {
  const cues: string[] = [];
  for (const event of game.drainEvents()) {
    if (event.type === "audio") {
      cues.push(event.payload.cue);
    }
  }
  return cues;
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}
