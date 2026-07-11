import { CONFIG } from "../config";
import type { EnemyType, TunableNumber } from "../content/enemies";
import {
  angularDistance,
  moveAngleToward,
  normalizeAngle,
  polarToCartesian,
} from "../core/geometry";
import type { RandomSource } from "../core/rng";
import type { BossPhase } from "../content/boss";
import type { BossState, CartesianPosition, EnemyState, ProjectileState } from "../state";
import type { EnemyOverrides, SimulationHost } from "./host";
import { takePlayerHit } from "./player";
import { createShooterProjectile } from "./weapons";

function valueFromRange(value: TunableNumber, rng: RandomSource): number {
  return typeof value === "number" ? value : rng.range(value[0], value[1]);
}

export function createEnemy(
  type: EnemyType,
  angle: number,
  rng: RandomSource,
  overrides: EnemyOverrides = {},
): EnemyState {
  const stats = CONFIG.enemies[type];
  const health = overrides.health || stats.health;
  const enemy: EnemyState = {
    type,
    angle: normalizeAngle(angle),
    radius: overrides.radius == null ? CONFIG.arena.enemySpawnRadius : overrides.radius,
    health,
    maxHealth: health,
    radialSpeed: overrides.radialSpeed || valueFromRange(stats.radialSpeed, rng),
    angularVelocity: overrides.angularVelocity || 0,
    turnRate: overrides.turnRate || 0,
    fireRadius: 0,
    fireCooldown: 0,
    fireTimer: 0,
    size: stats.size,
    score: stats.score,
    active: true,
    age: 0,
    hitFlash: 0,
    shielded: false,
    hasFiredIntro: false,
  };

  if (type === "spiral") {
    enemy.angularVelocity =
      valueFromRange(CONFIG.enemies.spiral.angularVelocity, rng) * (rng.chance(0.5) ? -1 : 1);
  } else if (type === "hunter") {
    enemy.turnRate = valueFromRange(CONFIG.enemies.hunter.turnRate, rng);
  } else if (type === "shooter") {
    enemy.fireRadius = valueFromRange(CONFIG.enemies.shooter.fireRadius, rng);
    enemy.fireCooldown = valueFromRange(CONFIG.enemies.shooter.fireCooldown, rng);
    enemy.fireTimer = rng.range(0.4, 0.9);
  } else if (type === "shield") {
    enemy.angularVelocity = rng.range(-0.18, 0.18);
    enemy.shieldRadius = CONFIG.enemies.shield.shieldRadius;
  }

  return enemy;
}

export function updateEnemy(enemy: EnemyState, dt: number, host: SimulationHost): void {
  enemy.age += dt;
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

  if (enemy.type === "spiral") {
    enemy.angle = normalizeAngle(enemy.angle + enemy.angularVelocity * dt);
    enemy.radius += enemy.radialSpeed * dt;
  } else if (enemy.type === "hunter") {
    enemy.angle = moveAngleToward(enemy.angle, host.state.player.angle, enemy.turnRate * dt);
    enemy.radius += enemy.radialSpeed * dt;
  } else if (enemy.type === "shooter") {
    if (enemy.radius < enemy.fireRadius) {
      enemy.radius += enemy.radialSpeed * dt;
    } else {
      enemy.radius += 16 * dt;
      enemy.angle = moveAngleToward(enemy.angle, host.state.player.angle, 1.25 * dt);
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        fireEnemy(enemy, host);
        enemy.fireTimer = valueFromRange(CONFIG.enemies.shooter.fireCooldown, host.rng);
      }
    }
  } else if (enemy.type === "shield") {
    enemy.angle = normalizeAngle(enemy.angle + enemy.angularVelocity * dt);
    enemy.radius += enemy.radialSpeed * dt;
  } else {
    enemy.radius += enemy.radialSpeed * dt;
  }

  if (enemy.radius > CONFIG.arena.outerKillRadius + enemy.size) {
    enemy.active = false;
  }
}

export function fireEnemy(enemy: EnemyState, host: SimulationHost): ProjectileState {
  const projectile = createShooterProjectile(enemy);
  host.state.enemyBullets.push(projectile);
  host.addEffect({
    type: "burst",
    angle: enemy.angle,
    radius: enemy.radius,
    color: CONFIG.colors.shooter,
    size: 24,
    duration: 0.14,
  });
  return projectile;
}

export function damageEnemy(enemy: EnemyState, amount: number): boolean {
  if (enemy.shielded && enemy.type !== "shield") {
    enemy.hitFlash = 0.12;
    return false;
  }

  enemy.health -= amount;
  enemy.hitFlash = 0.08;
  return enemy.health <= 0;
}

export function enemyPosition(enemy: EnemyState): CartesianPosition {
  return polarToCartesian(enemy.angle, enemy.radius, CONFIG.arena.centerX, CONFIG.arena.centerY);
}

export function enemyColor(enemy: EnemyState): string {
  if (enemy.hitFlash > 0) {
    return "#ffffff";
  }

  switch (enemy.type) {
    case "drifter":
      return CONFIG.colors.drifter;
    case "spiral":
      return CONFIG.colors.spiral;
    case "mine":
      return CONFIG.colors.mine;
    case "shooter":
      return CONFIG.colors.shooter;
    case "hunter":
      return CONFIG.colors.hunter;
    case "shield":
      return CONFIG.colors.shield;
  }
}

export function createBoss(): BossState {
  return {
    id: "mothership",
    health: CONFIG.boss.health,
    maxHealth: CONFIG.boss.health,
    rotation: 0,
    phase: 1,
    attackTimer: 2,
    spawnTimer: 3.2,
    beams: [],
    active: true,
    hitFlash: 0,
    phaseAwarded: {
      2: false,
      3: false,
    },
  };
}

export function updateBoss(boss: BossState, dt: number, host: SimulationHost): void {
  if (!boss.active) {
    return;
  }

  boss.rotation = normalizeAngle(
    boss.rotation + CONFIG.boss.rotationSpeed * dt * (boss.phase === 3 ? 1.45 : 1),
  );
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  updateBossPhase(boss, host);
  updateBossBeams(boss, dt, host);

  if (boss.phase >= 2) {
    boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      startBossBeamAttack(boss, host);
      boss.attackTimer = boss.phase === 3 ? 2.45 : 3.25;
    }
  }

  if (boss.phase >= 3) {
    boss.spawnTimer -= dt;
    if (boss.spawnTimer <= 0) {
      spawnBossPressure(host);
      boss.spawnTimer = 2.15;
    }
  }
}

function updateBossPhase(boss: BossState, host: SimulationHost): void {
  let nextPhase: BossPhase = 1;
  if (boss.health <= CONFIG.boss.phase3Threshold) {
    nextPhase = 3;
  } else if (boss.health <= CONFIG.boss.phase2Threshold) {
    nextPhase = 2;
  }

  if (nextPhase === boss.phase) {
    return;
  }

  boss.phase = nextPhase;
  if (nextPhase !== 1 && !boss.phaseAwarded[nextPhase]) {
    boss.phaseAwarded[nextPhase] = true;
    host.addScore(CONFIG.scoring.bossPhaseBonus, null, true);
    host.addEffect({
      type: "bossPulse",
      x: CONFIG.arena.centerX,
      y: CONFIG.arena.centerY,
      color: CONFIG.colors.bossCore,
      size: 150,
      duration: 0.45,
    });
    host.setShake(0.18);
    host.emitAudio("waveClear");
  }
}

function updateBossBeams(boss: BossState, dt: number, host: SimulationHost): void {
  for (const beam of boss.beams) {
    beam.timer += dt;
    beam.active = beam.timer >= CONFIG.boss.warningTime;

    if (beam.active && angularDistance(host.state.player.angle, beam.angle) < beam.width * 0.5) {
      takePlayerHit(host.state.player, host);
    }

    if (beam.timer > CONFIG.boss.warningTime + CONFIG.boss.beamTime) {
      beam.done = true;
    }
  }

  boss.beams = boss.beams.filter((beam) => !beam.done);
}

export function startBossBeamAttack(boss: BossState, host: SimulationHost): void {
  const count = boss.phase === 3 ? 5 : 4;
  const width = boss.phase === 3 ? 0.18 : 0.15;
  const base = normalizeAngle(boss.rotation + host.rng.range(-0.24, 0.24));

  for (let index = 0; index < count; index += 1) {
    boss.beams.push({
      angle: normalizeAngle(base + (index * CONFIG.TAU) / count),
      width,
      timer: 0,
      active: false,
    });
  }

  host.emitAudio("bossWarning");
}

export function spawnBossPressure(host: SimulationHost): void {
  const base = host.rng.range(0, CONFIG.TAU);
  const radius = CONFIG.arena.enemySpawnRadius + 15;
  host.spawnEnemy("drifter", base, { radius });
  host.spawnEnemy("spiral", base + Math.PI * 0.85, { radius });
}

export function handleBossShot(
  boss: BossState,
  shot: ProjectileState,
  host: SimulationHost,
): boolean {
  if (!boss.active || shot.radius > CONFIG.arena.bossHitRadius) {
    return false;
  }

  if (isBossShotBlocked(boss, shot.angle)) {
    shot.active = false;
    host.addEffect({
      type: "burst",
      angle: shot.angle,
      radius: CONFIG.arena.bossHitRadius,
      color: CONFIG.colors.shield,
      size: 24,
      duration: 0.18,
    });
    host.emitAudio("enemyHit");
    return true;
  }

  boss.health -= shot.damage;
  boss.hitFlash = 0.08;
  shot.active = false;
  host.setShake(0.05);
  host.addEffect({
    type: "burst",
    angle: shot.angle,
    radius: CONFIG.boss.coreRadius,
    color: CONFIG.colors.bossCore,
    size: 30,
    duration: 0.18,
  });
  host.emitAudio("enemyHit");

  if (boss.health <= 0) {
    boss.active = false;
    host.defeatBoss();
  }

  return true;
}

export function isBossShotBlocked(boss: BossState, angle: number): boolean {
  const panelWidth = boss.phase === 3 ? CONFIG.boss.panelWidth * 0.78 : CONFIG.boss.panelWidth;

  for (let index = 0; index < 4; index += 1) {
    const panelAngle = boss.rotation + (index * CONFIG.TAU) / 4;
    if (angularDistance(angle, panelAngle) < panelWidth * 0.5) {
      return true;
    }
  }

  return false;
}
