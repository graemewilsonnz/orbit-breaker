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
  const health = overrides.health ?? stats.health;
  const enemy: EnemyState = {
    type,
    origin: overrides.origin ?? "debug",
    resolution: null,
    behavior: type === "hunter" ? "tracking" : "approach",
    behaviorTimer: 0,
    targetAngle: null,
    angle: normalizeAngle(angle),
    radius: overrides.radius ?? CONFIG.arena.enemySpawnRadius,
    health,
    maxHealth: health,
    radialSpeed: overrides.radialSpeed ?? valueFromRange(stats.radialSpeed, rng),
    angularVelocity: overrides.angularVelocity ?? 0,
    turnRate: overrides.turnRate ?? 0,
    fireRadius: 0,
    fireCooldown: 0,
    size: stats.size,
    score: stats.score,
    active: true,
    age: 0,
    hitFlash: 0,
    shielded: false,
  };

  if (type === "spiral") {
    enemy.angularVelocity =
      overrides.angularVelocity ??
      valueFromRange(CONFIG.enemies.spiral.angularVelocity, rng) * (rng.chance(0.5) ? -1 : 1);
  } else if (type === "hunter") {
    enemy.turnRate = overrides.turnRate ?? valueFromRange(CONFIG.enemies.hunter.turnRate, rng);
  } else if (type === "shooter") {
    enemy.fireRadius = valueFromRange(CONFIG.enemies.shooter.fireRadius, rng);
    enemy.fireCooldown = valueFromRange(CONFIG.enemies.shooter.fireCooldown, rng);
  } else if (type === "shield") {
    enemy.angularVelocity = overrides.angularVelocity ?? rng.range(-0.18, 0.18);
    enemy.shieldRadius = CONFIG.enemies.shield.shieldRadius;
  }

  return enemy;
}

export function updateEnemy(enemy: EnemyState, dt: number, host: SimulationHost): void {
  if (!enemy.active || enemy.resolution !== null) {
    return;
  }

  enemy.age += dt;
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

  switch (enemy.type) {
    case "drifter":
      enemy.radius += enemy.radialSpeed * dt;
      break;
    case "spiral":
      enemy.angle = normalizeAngle(enemy.angle + enemy.angularVelocity * dt);
      enemy.radius += enemy.radialSpeed * dt;
      break;
    case "mine":
      updateMine(enemy, dt, host);
      break;
    case "shooter":
      updateShooter(enemy, dt, host);
      break;
    case "hunter":
      updateHunter(enemy, dt, host);
      break;
    case "shield":
      enemy.angle = normalizeAngle(enemy.angle + enemy.angularVelocity * dt);
      enemy.radius += enemy.radialSpeed * dt;
      break;
  }

  if (enemy.active && enemy.radius > CONFIG.arena.outerKillRadius + enemy.size) {
    host.resolveEnemy(enemy, "escaped");
  }
}

function updateMine(enemy: EnemyState, dt: number, host: SimulationHost): void {
  const mine = CONFIG.enemies.mine;

  if (enemy.behavior === "approach") {
    enemy.radius = Math.min(mine.claimRadius, enemy.radius + enemy.radialSpeed * dt);
    if (enemy.radius >= mine.claimRadius) {
      enemy.behavior = "arming";
      enemy.behaviorTimer = mine.warningTime;
      host.emitAudio("mineSignal");
    }
    return;
  }

  enemy.behaviorTimer = Math.max(0, enemy.behaviorTimer - dt);
  if (enemy.behavior === "arming" && enemy.behaviorTimer <= 0) {
    enemy.behavior = "armed";
    enemy.behaviorTimer = mine.holdTime;
  } else if (enemy.behavior === "armed" && enemy.behaviorTimer <= 0) {
    enemy.behavior = "release";
  } else if (enemy.behavior === "release") {
    enemy.radius += mine.releaseSpeed * dt;
  }
}

function updateHunter(enemy: EnemyState, dt: number, host: SimulationHost): void {
  const hunter = CONFIG.enemies.hunter;

  if (enemy.behavior === "tracking") {
    if (enemy.radius >= hunter.lockRadius) {
      lockHunter(enemy, host);
      return;
    }
    enemy.angle = moveAngleToward(enemy.angle, host.state.player.angle, enemy.turnRate * dt);
    enemy.radius = Math.min(hunter.lockRadius, enemy.radius + enemy.radialSpeed * dt);
    if (enemy.radius >= hunter.lockRadius) {
      lockHunter(enemy, host);
    }
    return;
  }

  if (enemy.behavior === "locked") {
    enemy.behaviorTimer = Math.max(0, enemy.behaviorTimer - dt);
    if (enemy.behaviorTimer <= 0) {
      enemy.behavior = "release";
    }
    return;
  }

  enemy.radius += hunter.lungeSpeed * dt;
}

function lockHunter(enemy: EnemyState, host: SimulationHost): void {
  enemy.behavior = "locked";
  enemy.behaviorTimer = CONFIG.enemies.hunter.warningTime;
  enemy.targetAngle = enemy.angle;
  host.emitAudio("hunterSignal");
}

function updateShooter(enemy: EnemyState, dt: number, host: SimulationHost): void {
  const shooter = CONFIG.enemies.shooter;

  if (enemy.behavior === "approach") {
    enemy.angle = moveAngleToward(
      enemy.angle,
      host.state.player.angle,
      shooter.aimTurnRate * 0.35 * dt,
    );
    enemy.radius = Math.min(enemy.fireRadius, enemy.radius + enemy.radialSpeed * dt);
    if (enemy.radius >= enemy.fireRadius) {
      beginShooterWindup(enemy, host);
    }
    return;
  }

  enemy.radius += shooter.driftSpeed * dt;
  enemy.behaviorTimer = Math.max(0, enemy.behaviorTimer - dt);
  if (enemy.behavior === "windup") {
    const targetAngle = enemy.targetAngle ?? host.state.player.angle;
    enemy.angle = moveAngleToward(enemy.angle, targetAngle, shooter.aimTurnRate * dt);
    if (enemy.behaviorTimer <= 0) {
      fireEnemy(enemy, host);
      enemy.behavior = "recovery";
      enemy.behaviorTimer = enemy.fireCooldown;
      enemy.targetAngle = null;
    }
  } else if (enemy.behavior === "recovery") {
    enemy.angle = moveAngleToward(enemy.angle, host.state.player.angle, 0.55 * dt);
    if (enemy.behaviorTimer <= 0) {
      beginShooterWindup(enemy, host);
    }
  }
}

function beginShooterWindup(enemy: EnemyState, host: SimulationHost): void {
  enemy.behavior = "windup";
  enemy.behaviorTimer = CONFIG.enemies.shooter.warningTime;
  enemy.targetAngle = host.state.player.angle;
  host.emitAudio("shooterSignal");
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
  host.emitAudio("shooterFire");
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
      takePlayerHit(host.state.player, host, "boss-beam");
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
  host.spawnEnemy("drifter", base, { radius, origin: "boss" });
  host.spawnEnemy("spiral", base + Math.PI * 0.85, { radius, origin: "boss" });
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
    host.registerShotHit(shot);
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

  host.registerShotHit(shot);
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
