import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { CONFIG } from "../../src/game/config";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { SeededRng } from "../../src/game/core/rng";
import { EMPTY_INPUT_SNAPSHOT, createInputSnapshot } from "../../src/game/systems/input";
import { createProjectile } from "../../src/game/systems/weapons";

function createGame(): Game {
  return new Game({ seed: "m1-summary", presentationRandom: new SeededRng("visual") });
}

describe("M1 run summary", () => {
  it("records first actions, projectile accuracy, kills, damage source, and timing", () => {
    const game = createGame();
    game.startRun();

    game.spawnEnemy("drifter", game.state.player.angle, {
      radius: 250,
      radialSpeed: 60,
    });
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["fire"] }));
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ held: ["right"], pressed: ["dash"] }));

    expect(game.snapshot().run).toMatchObject({
      accuracyPercent: 100,
      shotsFired: 1,
      shotsHit: 1,
      enemiesDestroyed: 1,
      firstMoveSeconds: FIXED_STEP_SECONDS * 2,
      firstShotSeconds: FIXED_STEP_SECONDS,
      firstDashSeconds: FIXED_STEP_SECONDS * 2,
    });

    game.state.player.invulnerabilityTimer = 0;
    game.state.player.dashInvulnerabilityTimer = 0;
    game.spawnEnemy("drifter", game.state.player.angle, {
      radius: 279,
      radialSpeed: 60,
    });
    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    game.forceState("gameOver");

    expect(game.snapshot().run).toMatchObject({
      damageTaken: 1,
      lastDamageSource: "enemy-contact",
      damageBySource: {
        "enemy-projectile": 0,
        "enemy-contact": 1,
        "boss-beam": 0,
      },
    });
  });

  it("captures a wave duration and resets every metric on restart", () => {
    const game = createGame();
    game.startRun();
    game.state.wave.queue = [];

    for (let step = 0; step < 50; step += 1) {
      game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    }

    expect(game.snapshot().state).toBe("waveClear");
    expect(game.snapshot().run.waveTimings).toHaveLength(1);
    expect(game.snapshot().run.waveTimings[0]).toMatchObject({ wave: 1 });
    expect(game.snapshot().run.waveTimings[0]?.seconds).toBeCloseTo(48 * FIXED_STEP_SECONDS, 8);

    game.forceState("gameOver");
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["enter"] }));

    expect(game.snapshot().run).toMatchObject({
      elapsedSeconds: 0,
      shotsFired: 0,
      shotsHit: 0,
      enemiesDestroyed: 0,
      damageTaken: 0,
      firstMoveSeconds: null,
      firstShotSeconds: null,
      firstDashSeconds: null,
      waveTimings: [],
    });
  });

  it("attributes hostile projectiles and boss beams at their damage paths", () => {
    const projectileGame = createGame();
    projectileGame.startRun();
    projectileGame.state.enemyBullets.push(
      createProjectile({
        owner: "enemy",
        angle: projectileGame.state.player.angle,
        radius: CONFIG.arena.playerRadius - CONFIG.projectiles.enemySpeed * FIXED_STEP_SECONDS,
        radialSpeed: CONFIG.projectiles.enemySpeed,
        size: CONFIG.projectiles.enemySize,
        color: CONFIG.colors.enemyBullet,
      }),
    );
    projectileGame.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    expect(projectileGame.snapshot().run.lastDamageSource).toBe("enemy-projectile");

    const bossGame = createGame();
    bossGame.startBossScenario();
    const boss = bossGame.state.boss;
    expect(boss).not.toBeNull();
    if (boss === null) {
      return;
    }
    boss.beams.push({
      angle: bossGame.state.player.angle,
      width: 0.2,
      timer: CONFIG.boss.warningTime,
      active: true,
    });
    bossGame.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    expect(bossGame.snapshot().run.lastDamageSource).toBe("boss-beam");
  });
});
