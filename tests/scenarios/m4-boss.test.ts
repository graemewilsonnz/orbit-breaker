import { describe, expect, it } from "vitest";

import { Game } from "../../src/game/Game";
import { CONFIG } from "../../src/game/config";
import { getBossPhaseDefinition } from "../../src/game/content/boss";
import { FIXED_STEP_SECONDS } from "../../src/game/core/clock";
import { angularDistance, normalizeAngle, signedAngleDelta } from "../../src/game/core/geometry";
import { SeededRng } from "../../src/game/core/rng";
import type { BossState, ProjectileState } from "../../src/game/state";
import {
  closestSafeArc,
  damageBoss,
  handleBossShot,
  isBossAngleInWeakWindow,
  isBossShotBlocked,
  spawnBossPressure,
  startBossBeamAttack,
  updateBoss,
} from "../../src/game/systems/boss";
import { EMPTY_INPUT_SNAPSHOT, createInputSnapshot } from "../../src/game/systems/input";
import { createProjectile } from "../../src/game/systems/weapons";

describe("M4 mothership boss", () => {
  it("blocks guarded and off-aperture shots while accepting shots inside an exposed weak arc", () => {
    const game = createBossGame("shot-windows");
    const boss = requireBoss(game);
    const aperture = getBossPhaseDefinition(1).shield.apertureWidth;
    const initialHealth = boss.health;

    const guardedShot = playerShot(boss.weakAngle);
    expect(handleBossShot(boss, guardedShot, game)).toBe(true);
    expect(guardedShot.active).toBe(false);
    expect(boss.health).toBe(initialHealth);
    expect(boss.noticeText).toContain("SHIELD BLOCK");

    boss.shieldMode = "vulnerable";
    const boundaryAngle = normalizeAngle(boss.weakAngle + aperture * 0.5);
    expect(isBossAngleInWeakWindow(boss, boundaryAngle)).toBe(false);
    expect(isBossShotBlocked(boss, boundaryAngle)).toBe(true);
    const boundaryShot = playerShot(boundaryAngle);
    handleBossShot(boss, boundaryShot, game);
    expect(boss.health).toBe(initialHealth);

    const weakAngle = normalizeAngle(boss.weakAngle + aperture * 0.5 - 0.001);
    expect(isBossAngleInWeakWindow(boss, weakAngle)).toBe(true);
    expect(isBossShotBlocked(boss, weakAngle)).toBe(false);
    const weakShot = playerShot(weakAngle);
    handleBossShot(boss, weakShot, game);

    expect(boss.health).toBe(initialHealth - weakShot.damage);
    expect(weakShot.active).toBe(false);
    expect(game.snapshot().run.shotsHit).toBe(3);
  });

  it("keeps a complete beam warning harmless, authors real safe arcs, and latches one hit", () => {
    const game = createBossGame("beam-contract");
    const boss = requireBoss(game);
    const phase = getBossPhaseDefinition(1);
    const startingLives = game.state.player.lives;
    game.state.player.shieldActive = true;

    startBossBeamAttack(boss, game, phase);

    expect(boss.beams).toHaveLength(phase.beam.count);
    expect(boss.safeArcs).toHaveLength(phase.beam.count);
    expect(boss.noticeText).toContain("MOVE TO CYAN");
    for (const arc of boss.safeArcs) {
      expect(arc.width).toBeCloseTo(CONFIG.TAU / phase.beam.count - phase.beam.width);
      for (const beam of boss.beams) {
        expect(angularDistance(arc.angle, beam.angle)).toBeGreaterThan(beam.width * 0.5);
      }
    }
    expect(closestSafeArc(boss.safeArcs, game.state.player.angle)).not.toBeNull();

    updateBoss(boss, phase.beam.warningTime - 0.001, game);
    expect(boss.beams.every((beam) => !beam.active && !beam.hitPlayer)).toBe(true);
    expect(game.state.player.shieldActive).toBe(true);
    expect(game.state.player.lives).toBe(startingLives);

    updateBoss(boss, 0.002, game);
    expect(boss.beams.some((beam) => beam.active)).toBe(true);
    expect(boss.beams.filter((beam) => beam.hitPlayer)).toHaveLength(1);
    expect(game.state.player.shieldActive).toBe(false);
    expect(game.state.player.lives).toBe(startingLives);

    game.state.player.invulnerabilityTimer = 0;
    updateBoss(boss, phase.beam.activeTime * 0.5, game);
    expect(game.state.player.lives).toBe(startingLives);
    expect(boss.beams.filter((beam) => beam.hitPlayer)).toHaveLength(1);
  });

  it("clamps every phase gate, awards it once, and clears only boss hazards", () => {
    const game = createBossGame("phase-gates");
    const boss = requireBoss(game);
    const bossAdd = spawnEnemy(game, "boss", 0.4);
    const waveEnemy = spawnEnemy(game, "wave", 1.2);
    game.state.enemyBullets.push(enemyShot(game.state.player.angle));
    startBossBeamAttack(boss, game);

    expect(damageBoss(boss, 10_000, game)).toBe(true);
    expect(boss).toMatchObject({
      phase: 2,
      health: getBossPhaseDefinition(1).healthFloor,
      transitionTimer: CONFIG.boss.transitionTime,
    });
    expect(boss.phaseAwarded).toEqual({ 2: true, 3: false });
    expect(game.state.player.score).toBe(CONFIG.scoring.bossPhaseBonus);
    expect(bossAdd).toMatchObject({ active: false, resolution: "transition" });
    expect(waveEnemy).toMatchObject({ active: true, resolution: null });
    expect(game.state.enemyBullets).toHaveLength(0);
    expect(boss.beams).toHaveLength(0);
    expect(boss.safeArcs).toHaveLength(0);

    expect(damageBoss(boss, 10_000, game)).toBe(false);
    expect(game.state.player.score).toBe(CONFIG.scoring.bossPhaseBonus);
    boss.transitionTimer = 0;
    const secondBossAdd = spawnEnemy(game, "boss", 2.2);
    game.state.enemyBullets.push(enemyShot(2.2));

    expect(damageBoss(boss, 10_000, game)).toBe(true);
    expect(boss).toMatchObject({
      phase: 3,
      health: getBossPhaseDefinition(2).healthFloor,
      transitionTimer: CONFIG.boss.transitionTime,
    });
    expect(boss.phaseAwarded).toEqual({ 2: true, 3: true });
    expect(game.state.player.score).toBe(CONFIG.scoring.bossPhaseBonus * 2);
    expect(secondBossAdd).toMatchObject({ active: false, resolution: "transition" });
    expect(waveEnemy.active).toBe(true);
    expect(game.state.enemyBullets).toHaveLength(0);

    expect(damageBoss(boss, 1, game)).toBe(false);
    expect(game.state.player.score).toBe(CONFIG.scoring.bossPhaseBonus * 2);
  });

  it("spawns deterministic boss-origin pressure without exceeding the phase cap", () => {
    const game = createBossGame("capped-adds");
    const boss = requireBoss(game);
    boss.phase = 3;
    boss.transitionTimer = 0;
    const phase = getBossPhaseDefinition(3);
    spawnEnemy(game, "wave", 0.1);

    spawnBossPressure(boss, game, phase);
    spawnBossPressure(boss, game, phase);
    spawnBossPressure(boss, game, phase);

    let activeAdds = game.state.enemies.filter(
      (enemy) => enemy.origin === "boss" && enemy.active && enemy.resolution === null,
    );
    expect(activeAdds).toHaveLength(phase.adds.maxActive);
    expect(activeAdds.map((enemy) => enemy.type)).toEqual([
      "drifter",
      "spiral",
      "drifter",
      "spiral",
    ]);
    expect(game.state.enemies.filter((enemy) => enemy.origin === "wave")).toHaveLength(1);

    const firstAngles = activeAdds.map((enemy) => enemy.angle);
    const repeated = createBossGame("capped-adds");
    const repeatedBoss = requireBoss(repeated);
    repeatedBoss.phase = 3;
    repeatedBoss.transitionTimer = 0;
    spawnEnemy(repeated, "wave", 0.1);
    spawnBossPressure(repeatedBoss, repeated, phase);
    spawnBossPressure(repeatedBoss, repeated, phase);
    expect(
      repeated.state.enemies.filter((enemy) => enemy.origin === "boss").map((enemy) => enemy.angle),
    ).toEqual(firstAngles);

    const resolvedAdd = activeAdds[0];
    if (resolvedAdd === undefined) {
      throw new Error("Expected a capped boss add to resolve");
    }
    expect(game.resolveEnemy(resolvedAdd, "transition")).toBe(true);
    spawnBossPressure(boss, game, phase);
    activeAdds = game.state.enemies.filter(
      (enemy) => enemy.origin === "boss" && enemy.active && enemy.resolution === null,
    );
    expect(activeAdds).toHaveLength(phase.adds.maxActive);
  });

  it("automatically schedules adds only after beam and aperture pressure has recovered", () => {
    const game = createBossGame("add-schedule");
    const boss = requireBoss(game);
    const phase = getBossPhaseDefinition(2);
    boss.phase = 2;
    boss.transitionTimer = 0;
    boss.attackTimer = 999;
    boss.spawnTimer = 0;
    boss.shieldMode = "guarded";
    boss.shieldTimer = phase.shield.guardedTime;
    startBossBeamAttack(boss, game, phase);

    updateBoss(boss, FIXED_STEP_SECONDS, game);
    expect(game.state.enemies.filter((enemy) => enemy.origin === "boss")).toHaveLength(0);

    boss.beams = [];
    boss.safeArcs = [];
    boss.shieldMode = "opening";
    boss.shieldTimer = phase.shield.openingWarning;
    boss.spawnTimer = 0;
    updateBoss(boss, FIXED_STEP_SECONDS, game);
    expect(game.state.enemies.filter((enemy) => enemy.origin === "boss")).toHaveLength(0);

    boss.shieldMode = "vulnerable";
    boss.shieldTimer = phase.shield.vulnerableTime;
    boss.spawnTimer = 0;
    updateBoss(boss, FIXED_STEP_SECONDS, game);
    expect(game.state.enemies.filter((enemy) => enemy.origin === "boss")).toHaveLength(0);

    boss.shieldMode = "guarded";
    boss.shieldTimer = phase.shield.guardedTime;
    boss.spawnTimer = 0;
    updateBoss(boss, FIXED_STEP_SECONDS, game);
    expect(game.state.enemies.filter((enemy) => enemy.origin === "boss")).toHaveLength(1);
    expect(boss.spawnTimer).toBe(phase.adds.interval);
  });

  it("routes a bomb through boss damage, phase gating, beam cleanup, and resource use", () => {
    const game = createBossGame("bomb-path");
    const boss = requireBoss(game);
    boss.health = getBossPhaseDefinition(1).healthFloor + 3;
    boss.shieldMode = "guarded";
    startBossBeamAttack(boss, game);
    game.state.enemyBullets.push(enemyShot(game.state.player.angle));

    game.activateBomb();

    expect(game.snapshot()).toMatchObject({
      bombs: 0,
      bossHealth: getBossPhaseDefinition(1).healthFloor,
      bossPhase: 2,
    });
    expect(boss.transitionTimer).toBe(CONFIG.boss.transitionTime);
    expect(boss.beams).toHaveLength(0);
    expect(boss.safeArcs).toHaveLength(0);
    expect(game.state.enemyBullets).toHaveLength(0);
    expect(game.state.waveStats.bombUsed).toBe(false);
    expect(game.state.player.score).toBe(CONFIG.scoring.bossPhaseBonus);

    game.activateBomb();
    expect(boss.health).toBe(getBossPhaseDefinition(1).healthFloor);
    expect(game.state.player.score).toBe(CONFIG.scoring.bossPhaseBonus);
  });

  it("lets the final bomb defeat the boss exactly once without an unused-bomb award", () => {
    const game = createBossGame("final-bomb");
    const boss = requireBoss(game);
    boss.phase = 3;
    boss.health = CONFIG.boss.bombDamage;
    boss.transitionTimer = 0;
    boss.shieldMode = "guarded";
    game.state.player.bombCount = 1;
    game.drainEvents();

    game.activateBomb();

    expect(game.snapshot()).toMatchObject({
      state: "victory",
      bombs: 0,
      bossHealth: 0,
      bossPhase: 3,
      score: CONFIG.boss.score,
    });
    expect(boss).toMatchObject({ active: false, defeatAwarded: true });

    game.activateBomb();
    game.defeatBoss();
    expect(game.state.player.score).toBe(CONFIG.boss.score);
    expect(
      game
        .drainEvents()
        .filter((event) => event.type === "audio" && event.payload.cue === "bossDefeated"),
    ).toHaveLength(1);
  });

  it("defeats once, awards retained resources once, and leaves no hostile encounter state", () => {
    const game = createBossGame("defeat-latch");
    const boss = requireBoss(game);
    boss.phase = 3;
    boss.health = 1;
    boss.transitionTimer = 0;
    game.state.player.bombCount = 2;
    const add = spawnEnemy(game, "boss", 0.7);
    game.state.enemyBullets.push(enemyShot(game.state.player.angle));
    game.spawnPowerUp("twin", game.state.player.angle + 1);
    game.drainEvents();

    expect(damageBoss(boss, 1, game)).toBe(true);
    const awardedScore = CONFIG.boss.score + 2 * CONFIG.scoring.unusedBombVictoryBonus;
    expect(game.snapshot()).toMatchObject({ state: "victory", score: awardedScore });
    expect(boss).toMatchObject({ active: false, defeatAwarded: true, health: 0 });
    expect(add).toMatchObject({ active: false, resolution: "transition" });
    expect(game.state.enemyBullets).toHaveLength(0);
    expect(game.state.powerups).toHaveLength(0);

    expect(damageBoss(boss, 1, game)).toBe(false);
    game.defeatBoss();
    expect(game.state.player.score).toBe(awardedScore);
    expect(
      game
        .drainEvents()
        .filter((event) => event.type === "audio" && event.payload.cue === "bossDefeated"),
    ).toHaveLength(1);
  });

  it("repeats the same seeded boss script independently of presentation randomness", () => {
    const first = runBossController("deterministic-boss", "visual-a", 28);
    const second = runBossController("deterministic-boss", "visual-b", 28);

    expect(first.deterministicState).toBe(second.deterministicState);
    expect(first.elapsed).toBe(second.elapsed);
  });

  it("freezes boss timers, beams, and run time while paused", () => {
    const game = createBossGame("boss-pause");
    const boss = requireBoss(game);
    startBossBeamAttack(boss, game);
    game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["pause"] }));
    expect(game.snapshot()).toMatchObject({ state: "paused", pausedFrom: "playing" });
    const pausedBoss = JSON.stringify(boss);
    const pausedElapsed = game.snapshot().run.elapsedSeconds;

    for (let step = 0; step < 120; step += 1) {
      game.step(FIXED_STEP_SECONDS, EMPTY_INPUT_SNAPSHOT);
    }

    expect(JSON.stringify(boss)).toBe(pausedBoss);
    expect(game.snapshot().run.elapsedSeconds).toBe(pausedElapsed);
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ pressed: ["pause"] }));
    expect(game.snapshot().state).toBe("playing");
    expect(JSON.stringify(boss)).toBe(pausedBoss);
  });

  it("keeps a scripted level-one, no-powerup clear inside the 60–90 second target", () => {
    const result = runBossController("m4-duration-controller", "duration-visuals", 100);

    expect(result, JSON.stringify({ ...result, deterministicState: undefined })).toMatchObject({
      state: "victory",
      weaponLevel: 1,
      powerupsCollected: 0,
      bombsUsed: 0,
    });
    expect(result.lives).toBeGreaterThan(0);
    expect(result.elapsed).toBeGreaterThanOrEqual(60);
    expect(result.elapsed).toBeLessThanOrEqual(90);
  });
});

interface BossControllerResult {
  readonly state: string;
  readonly elapsed: number;
  readonly lives: number;
  readonly weaponLevel: number;
  readonly powerupsCollected: number;
  readonly bombsUsed: number;
  readonly bossHealth: number | null;
  readonly bossPhase: number | null;
  readonly shotsFired: number;
  readonly shotsHit: number;
  readonly enemies: number;
  readonly deterministicState: string;
}

function runBossController(
  seed: string,
  presentationSeed: string,
  maximumSeconds: number,
): BossControllerResult {
  const game = createBossGame(seed, presentationSeed);
  game.state.player.bombCount = 0;
  game.state.wave.dropsAwarded = CONFIG.powerups.maxDropsPerWave;
  let powerupsCollected = 0;
  let elapsed = 0;
  const maximumSteps = Math.ceil(maximumSeconds / FIXED_STEP_SECONDS);

  for (let step = 0; step < maximumSteps && game.state.state === "playing"; step += 1) {
    const boss = requireBoss(game);
    const phase = getBossPhaseDefinition(boss.phase);
    const activeAdds = game.state.enemies
      .filter((enemy) => enemy.origin === "boss" && enemy.active && enemy.resolution === null)
      .sort((left, right) => right.radius - left.radius);
    const beamSafeArc =
      boss.beams.length > 0 ? closestSafeArc(boss.safeArcs, boss.weakAngle) : null;
    const urgentAdd = activeAdds.find((enemy) => enemy.radius >= 175);
    const beamTargetAngle =
      beamSafeArc === null
        ? null
        : normalizeAngle(
            beamSafeArc.angle +
              clampMagnitude(
                signedAngleDelta(beamSafeArc.angle, boss.weakAngle),
                beamSafeArc.width * 0.5 - 0.08,
              ),
          );
    const targetAngle = beamTargetAngle ?? urgentAdd?.angle ?? boss.weakAngle;
    const delta = signedAngleDelta(game.state.player.angle, targetAngle);
    const aligned = Math.abs(delta) <= 0.035;
    const projectileTravelTime =
      (game.state.player.radius - 20 - CONFIG.arena.bossHitRadius) / CONFIG.projectiles.playerSpeed;
    const bossCanReceiveShot =
      boss.shieldMode === "vulnerable" ||
      (boss.shieldMode === "opening" && boss.shieldTimer <= projectileTravelTime);
    const safeFromBeams = boss.beams.every(
      (beam) => angularDistance(game.state.player.angle, beam.angle) >= beam.width * 0.5 + 0.02,
    );
    const fireAtBoss =
      (beamSafeArc === null || safeFromBeams) &&
      urgentAdd === undefined &&
      bossCanReceiveShot &&
      angularDistance(game.state.player.angle, boss.weakAngle) <
        phase.shield.apertureWidth * 0.5 - 0.04;
    const fireAtAdd = beamSafeArc === null && urgentAdd !== undefined && aligned;
    const held = [
      ...(delta > 0.035 ? (["right"] as const) : delta < -0.035 ? (["left"] as const) : []),
      ...(fireAtBoss || fireAtAdd ? (["fire"] as const) : []),
    ];
    const dash = Math.abs(delta) > 0.82 && game.state.player.dashCooldown === 0;

    game.state.powerups = [];
    game.step(FIXED_STEP_SECONDS, createInputSnapshot({ held, pressed: dash ? ["dash"] : [] }));
    elapsed += FIXED_STEP_SECONDS;
    if (
      game.state.player.weaponLevel !== 1 ||
      game.state.player.shieldActive ||
      game.state.player.bombCount !== 0
    ) {
      powerupsCollected += 1;
    }
  }

  return {
    state: game.state.state,
    elapsed,
    lives: game.state.player.lives,
    weaponLevel: game.state.player.weaponLevel,
    powerupsCollected,
    bombsUsed: 0,
    bossHealth: game.state.boss?.health ?? null,
    bossPhase: game.state.boss?.phase ?? null,
    shotsFired: game.state.runMetrics.shotsFired,
    shotsHit: game.state.runMetrics.shotsHit,
    enemies: game.state.enemies.length,
    deterministicState: game.deterministicState(),
  };
}

function createBossGame(seed: string, presentationSeed = "m4-test-visuals"): Game {
  const game = new Game({ seed, presentationRandom: new SeededRng(presentationSeed) });
  game.startBossScenario();
  game.drainEvents();
  return game;
}

function requireBoss(game: Game): BossState {
  if (game.state.boss === null) {
    throw new Error("Expected an active mothership boss");
  }
  return game.state.boss;
}

function playerShot(angle: number): ProjectileState {
  return createProjectile({
    owner: "player",
    angle,
    radius: CONFIG.arena.bossHitRadius,
    radialSpeed: 0,
    size: CONFIG.projectiles.playerSize,
    color: CONFIG.colors.playerBullet,
  });
}

function enemyShot(angle: number): ProjectileState {
  return createProjectile({
    owner: "enemy",
    angle,
    radius: CONFIG.arena.playerRadius - 8,
    radialSpeed: 0,
    size: CONFIG.projectiles.enemySize,
    color: CONFIG.colors.enemyBullet,
    sourceEnemyType: "shooter",
  });
}

function spawnEnemy(game: Game, origin: "boss" | "wave", angle: number) {
  game.spawnEnemy("drifter", angle, { origin, radialSpeed: 0, radius: 80 });
  const enemy = game.state.enemies.at(-1);
  if (enemy === undefined) {
    throw new Error("Expected spawned enemy");
  }
  return enemy;
}

function clampMagnitude(value: number, maximum: number): number {
  return Math.max(-maximum, Math.min(maximum, value));
}
