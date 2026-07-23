import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { CONFIG } from "../../src/game/config";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { SeededRng } from "../../src/game/core/rng";
import { handleShotBossCollisions } from "../../src/game/systems/collision";
import { EMPTY_INPUT_SNAPSHOT } from "../../src/game/systems/input";
import {
  createProjectile,
  projectilePosition,
  updateProjectile,
} from "../../src/game/systems/weapons";

describe("M5 projectile lifecycle and swept collisions", () => {
  it("terminates an inward player shot at the centre without a negative-radius frame", () => {
    const shot = createProjectile({
      owner: "player",
      angle: 0.4,
      radius: 4,
      radialSpeed: -CONFIG.projectiles.playerSpeed,
    });

    updateProjectile(shot, FIXED_STEP_SECONDS);

    expect(shot).toMatchObject({
      active: false,
      radius: CONFIG.arena.innerKillRadius,
    });
    expect(projectilePosition(shot)).toEqual({
      x: CONFIG.arena.centerX,
      y: CONFIG.arena.centerY,
    });
  });

  it("still resolves a boss-core shot before the centre cutoff", () => {
    const game = createGame("m5-boss-boundary");
    game.startBossScenario();
    const boss = game.state.boss;
    if (boss === null) {
      throw new Error("Expected boss");
    }
    boss.shieldMode = "vulnerable";
    boss.weakAngle = 0;
    const initialHealth = boss.health;
    const shot = createProjectile({
      owner: "player",
      angle: boss.weakAngle,
      radius: CONFIG.arena.bossHitRadius + 4,
      radialSpeed: -CONFIG.projectiles.playerSpeed,
    });
    game.state.playerShots.push(shot);

    updateProjectile(shot, FIXED_STEP_SECONDS);
    handleShotBossCollisions(game);

    expect(shot.active).toBe(false);
    expect(boss.health).toBe(initialHealth - shot.damage);
  });

  it("hits an enemy crossed between projectile endpoints", () => {
    const game = createGame("m5-player-sweep");
    game.startRun();
    game.state.wave.queue = [];
    game.spawnEnemy("drifter", 0, {
      angularVelocity: 0,
      origin: "debug",
      radialSpeed: 0,
      radius: 200,
    });
    game.state.playerShots.push(
      createProjectile({
        owner: "player",
        angle: 0,
        radius: 220,
        radialSpeed: -2400,
      }),
    );

    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);

    expect(game.state.enemies).toHaveLength(0);
    expect(game.state.runMetrics.shotsHit).toBe(1);
  });

  it("hits the player when a hostile projectile crosses the orbit between endpoints", () => {
    const game = createGame("m5-hostile-sweep");
    game.startRun();
    game.state.wave.queue = [];
    game.state.player.angle = 0;
    game.state.enemyBullets.push(
      createProjectile({
        owner: "enemy",
        angle: 0,
        radius: 250,
        radialSpeed: 3600,
        size: CONFIG.projectiles.enemySize,
        color: CONFIG.colors.enemyBullet,
        sourceEnemyType: "shooter",
      }),
    );

    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);

    expect(game.state.player.lives).toBe(CONFIG.player.lives - 1);
    expect(game.state.runMetrics.lastDamageSource).toBe("enemy-projectile");
  });

  it("does not turn a swept near-miss into a hit", () => {
    const game = createGame("m5-hostile-near-miss");
    game.startRun();
    game.state.wave.queue = [];
    game.state.player.angle = 0;
    game.state.enemyBullets.push(
      createProjectile({
        owner: "enemy",
        angle: 0.09,
        radius: 250,
        radialSpeed: 3600,
        size: CONFIG.projectiles.enemySize,
        color: CONFIG.colors.enemyBullet,
        sourceEnemyType: "shooter",
      }),
    );

    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);

    expect(game.state.player.lives).toBe(CONFIG.player.lives);
    expect(game.state.runMetrics.damageTaken).toBe(0);
  });
});

function createGame(seed: string): Game {
  return new Game({ seed, presentationRandom: new SeededRng("m5-projectile-visuals") });
}
