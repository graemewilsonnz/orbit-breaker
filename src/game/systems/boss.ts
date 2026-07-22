import { CONFIG } from "../config";
import { getBossPhaseDefinition, type BossPhase, type BossPhaseDefinition } from "../content/boss";
import { angularDistance, normalizeAngle } from "../core/geometry";
import type { BossSafeArcState, BossState, EnemyState, ProjectileState } from "../state";
import type { SimulationHost } from "./host";
import { takePlayerHit } from "./player";

export const BOSS_BEAM_COLLISION_PADDING = 0.035;

export interface BossAngularArc {
  readonly angle: number;
  readonly width: number;
}

export function createBoss(
  initialPlayerAngle = -Math.PI / 2,
  startingPhase: BossPhase = 1,
): BossState {
  const phase = getBossPhaseDefinition(startingPhase);
  const startingHealth =
    startingPhase === 1
      ? CONFIG.boss.health
      : getBossPhaseDefinition((startingPhase - 1) as BossPhase).healthFloor;
  return {
    id: "mothership",
    health: startingHealth,
    maxHealth: CONFIG.boss.health,
    rotation: 0,
    phase: startingPhase,
    elapsed: 0,
    phaseElapsed: 0,
    phaseDurations: { 1: null, 2: null, 3: null },
    transitionTimer: 0,
    shieldMode: "opening",
    shieldTimer: phase.shield.openingWarning,
    weakAngle: normalizeAngle(initialPlayerAngle + 0.95),
    shieldCycle: 1,
    attackTimer: phase.beam.initialDelay,
    spawnTimer: phase.adds.initialDelay,
    beams: [],
    safeArcs: [],
    active: true,
    defeatAwarded: false,
    hitFlash: 0,
    blockFlash: 0,
    feedbackAudioCooldown: 0,
    noticeText: `PHASE ${startingPhase} — FOLLOW THE GOLD APERTURE`,
    noticeTimer: phase.shield.openingWarning + 0.8,
    phaseAwarded: { 2: startingPhase >= 2, 3: startingPhase >= 3 },
  };
}

export function updateBoss(boss: BossState, dt: number, host: SimulationHost): void {
  if (!boss.active) {
    return;
  }

  boss.elapsed += dt;
  boss.phaseElapsed += dt;
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);
  boss.blockFlash = Math.max(0, boss.blockFlash - dt);
  boss.feedbackAudioCooldown = Math.max(0, boss.feedbackAudioCooldown - dt);
  boss.noticeTimer = Math.max(0, boss.noticeTimer - dt);

  const phase = currentBossPhase(boss);
  const rotationScale = boss.transitionTimer > 0 ? 0.35 : 1;
  boss.rotation = normalizeAngle(boss.rotation + phase.rotationSpeed * rotationScale * dt);

  if (boss.transitionTimer > 0) {
    boss.transitionTimer = Math.max(0, boss.transitionTimer - dt);
    return;
  }

  updateBossShield(boss, dt, host, phase);
  const beamAttackEnded = updateBossBeams(boss, dt, host, phase);
  updateBossAttackSchedule(boss, dt, host, phase, beamAttackEnded);
  updateBossAddPressure(boss, dt, host, phase);
}

function updateBossShield(
  boss: BossState,
  dt: number,
  host: SimulationHost,
  phase: Readonly<BossPhaseDefinition>,
): void {
  boss.shieldTimer = Math.max(0, boss.shieldTimer - dt);
  if (boss.shieldTimer > 0) {
    return;
  }

  switch (boss.shieldMode) {
    case "guarded":
      boss.shieldMode = "opening";
      boss.shieldTimer = phase.shield.openingWarning;
      boss.weakAngle = chooseNextWeakAngle(boss, host);
      boss.noticeText = "APERTURE SHIFT — FOLLOW GOLD";
      boss.noticeTimer = phase.shield.openingWarning + 0.4;
      break;
    case "opening":
      boss.shieldMode = "vulnerable";
      boss.shieldTimer = phase.shield.vulnerableTime;
      boss.noticeText = "CORE EXPOSED — FIRE";
      boss.noticeTimer = 1.05;
      host.addEffect({
        type: "ring",
        x: CONFIG.arena.centerX,
        y: CONFIG.arena.centerY,
        color: CONFIG.colors.bossCore,
        size: CONFIG.boss.panelRadius + 26,
        duration: 0.3,
      });
      host.emitAudio("bossWeakOpen");
      break;
    case "vulnerable":
      boss.shieldMode = "recovering";
      boss.shieldTimer = phase.shield.recoveryTime;
      boss.noticeText = "SHIELD REFORMING";
      boss.noticeTimer = 0.7;
      break;
    case "recovering":
      boss.shieldMode = "guarded";
      boss.shieldTimer = phase.shield.guardedTime;
      break;
  }
}

function chooseNextWeakAngle(boss: BossState, host: SimulationHost): number {
  const direction = boss.shieldCycle % 2 === 0 ? -1 : 1;
  boss.shieldCycle += 1;
  const offset = host.rng.range(0.82, 1.28);
  return normalizeAngle(host.state.player.angle + direction * offset);
}

function updateBossBeams(
  boss: BossState,
  dt: number,
  host: SimulationHost,
  phase: Readonly<BossPhaseDefinition>,
): boolean {
  if (boss.beams.length === 0) {
    return false;
  }

  let activatedThisStep = false;
  for (const beam of boss.beams) {
    const wasActive = beam.active;
    beam.timer += dt;
    beam.active = beam.timer >= beam.warningTime && beam.timer < beam.warningTime + beam.activeTime;
    if (!wasActive && beam.active) {
      activatedThisStep = true;
    }

    const damagingHalfWidth = Math.max(0, beam.width * 0.5 - BOSS_BEAM_COLLISION_PADDING);
    if (
      beam.active &&
      !beam.hitPlayer &&
      angularDistance(host.state.player.angle, beam.angle) < damagingHalfWidth
    ) {
      beam.hitPlayer = true;
      takePlayerHit(host.state.player, host, "boss-beam");
    }

    beam.done = beam.timer >= beam.warningTime + beam.activeTime;
  }

  if (activatedThisStep) {
    host.addEffect({
      type: "bossPulse",
      x: CONFIG.arena.centerX,
      y: CONFIG.arena.centerY,
      color: CONFIG.colors.beam,
      size: 112,
      duration: 0.2,
    });
    host.setShake(0.07);
    host.emitAudio("bossBeamFire");
  }

  boss.beams = boss.beams.filter((beam) => !beam.done);
  if (boss.beams.length > 0) {
    return false;
  }

  boss.safeArcs = [];
  boss.attackTimer = phase.beam.recoveryTime;
  return true;
}

function updateBossAttackSchedule(
  boss: BossState,
  dt: number,
  host: SimulationHost,
  phase: Readonly<BossPhaseDefinition>,
  beamAttackEnded: boolean,
): void {
  if (boss.beams.length > 0 || beamAttackEnded) {
    return;
  }

  boss.attackTimer = Math.max(0, boss.attackTimer - dt);
  if (boss.attackTimer <= 0) {
    startBossBeamAttack(boss, host, phase);
  }
}

export function startBossBeamAttack(
  boss: BossState,
  host: SimulationHost,
  phase: Readonly<BossPhaseDefinition> = currentBossPhase(boss),
): void {
  if (!boss.active || boss.transitionTimer > 0 || boss.beams.length > 0) {
    return;
  }

  const beam = phase.beam;
  const spacing = CONFIG.TAU / beam.count;
  const base = normalizeAngle(
    host.state.player.angle + host.rng.range(-beam.width * 0.18, beam.width * 0.18),
  );
  boss.beams = [];
  boss.safeArcs = [];

  for (let index = 0; index < beam.count; index += 1) {
    boss.beams.push({
      angle: normalizeAngle(base + index * spacing),
      width: beam.width,
      timer: 0,
      warningTime: beam.warningTime,
      activeTime: beam.activeTime,
      active: false,
      hitPlayer: false,
      done: false,
    });
    boss.safeArcs.push({
      angle: normalizeAngle(base + (index + 0.5) * spacing),
      width: spacing - beam.width,
    });
  }

  boss.noticeText = "RADIAL LOCK — MOVE TO CYAN";
  boss.noticeTimer = beam.warningTime;
  host.emitAudio("bossWarning");
}

function updateBossAddPressure(
  boss: BossState,
  dt: number,
  host: SimulationHost,
  phase: Readonly<BossPhaseDefinition>,
): void {
  if (phase.adds.maxActive === 0) {
    return;
  }

  boss.spawnTimer = Math.max(0, boss.spawnTimer - dt);
  if (
    boss.spawnTimer > 0 ||
    boss.beams.length > 0 ||
    boss.shieldMode !== "guarded" ||
    activeBossAdds(host.state.enemies) >= phase.adds.maxActive
  ) {
    return;
  }

  spawnBossPressure(boss, host, phase);
  boss.spawnTimer = phase.adds.interval;
}

export function spawnBossPressure(
  boss: BossState,
  host: SimulationHost,
  phase: Readonly<BossPhaseDefinition> = currentBossPhase(boss),
): void {
  const capacity = phase.adds.maxActive - activeBossAdds(host.state.enemies);
  if (capacity <= 0 || phase.adds.types.length === 0) {
    return;
  }

  const count = Math.min(capacity, phase.adds.types.length);
  const base = host.rng.range(0, CONFIG.TAU);
  for (let index = 0; index < count; index += 1) {
    const type = phase.adds.types[index];
    if (type !== undefined) {
      host.spawnEnemy(type, normalizeAngle(base + (index * CONFIG.TAU) / count), {
        radius: CONFIG.arena.enemySpawnRadius + 15,
        origin: "boss",
      });
    }
  }
}

function activeBossAdds(enemies: readonly EnemyState[]): number {
  return enemies.filter(
    (enemy) => enemy.origin === "boss" && enemy.active && enemy.resolution === null,
  ).length;
}

export function handleBossShot(
  boss: BossState,
  shot: ProjectileState,
  host: SimulationHost,
): boolean {
  if (!boss.active || shot.radius > CONFIG.arena.bossHitRadius) {
    return false;
  }

  host.registerShotHit(shot);
  shot.active = false;
  if (isBossShotBlocked(boss, shot.angle)) {
    boss.blockFlash = 0.13;
    boss.noticeText =
      boss.transitionTimer > 0 ? "PHASE SHIFT — HOLD FIRE" : "SHIELD BLOCK — FOLLOW GOLD";
    boss.noticeTimer = 0.9;
    host.addEffect({
      type: "burst",
      angle: shot.angle,
      radius: CONFIG.arena.bossHitRadius,
      color: CONFIG.colors.shield,
      size: 24,
      duration: 0.18,
    });
    if (boss.feedbackAudioCooldown <= 0) {
      boss.feedbackAudioCooldown = 0.16;
      host.emitAudio("bossShieldBlock");
    }
    return true;
  }

  host.setShake(0.035);
  host.addEffect({
    type: "burst",
    angle: shot.angle,
    radius: CONFIG.boss.coreRadius,
    color: CONFIG.colors.bossCore,
    size: 30,
    duration: 0.18,
  });
  if (boss.feedbackAudioCooldown <= 0) {
    boss.feedbackAudioCooldown = 0.09;
    host.emitAudio("bossHit");
  }
  damageBoss(boss, shot.damage, host);
  return true;
}

export function damageBoss(boss: BossState, amount: number, host: SimulationHost): boolean {
  if (!boss.active || boss.transitionTimer > 0 || !Number.isFinite(amount) || amount <= 0) {
    return false;
  }

  const phase = currentBossPhase(boss);
  boss.health = Math.max(phase.healthFloor, boss.health - amount);
  boss.hitFlash = 0.09;

  if (boss.health > phase.healthFloor) {
    return true;
  }

  if (boss.phase < 3) {
    beginBossPhaseTransition(boss, (boss.phase + 1) as 2 | 3, host);
  } else {
    boss.phaseDurations[3] = boss.phaseElapsed;
    boss.active = false;
    host.defeatBoss();
  }
  return true;
}

export function damageBossWithBomb(boss: BossState, host: SimulationHost): boolean {
  if (!boss.active) {
    return false;
  }
  boss.beams = [];
  boss.safeArcs = [];
  boss.attackTimer = currentBossPhase(boss).beam.recoveryTime;
  return damageBoss(boss, CONFIG.boss.bombDamage, host);
}

function beginBossPhaseTransition(boss: BossState, nextPhase: 2 | 3, host: SimulationHost): void {
  boss.phaseDurations[boss.phase] = boss.phaseElapsed;
  boss.phase = nextPhase;
  boss.phaseElapsed = 0;
  boss.transitionTimer = CONFIG.boss.transitionTime;
  boss.shieldMode = "guarded";
  boss.beams = [];
  boss.safeArcs = [];

  const phase = currentBossPhase(boss);
  boss.shieldTimer = phase.shield.guardedTime;
  boss.attackTimer = phase.beam.initialDelay;
  boss.spawnTimer = phase.adds.initialDelay;
  boss.noticeText = `PHASE ${nextPhase} — ${phase.name.toUpperCase()}`;
  boss.noticeTimer = CONFIG.boss.transitionTime + 0.65;
  clearBossHazards(host);

  if (!boss.phaseAwarded[nextPhase]) {
    boss.phaseAwarded[nextPhase] = true;
    host.addScore(CONFIG.scoring.bossPhaseBonus, null, true);
    host.addEffect({
      type: "bossPulse",
      x: CONFIG.arena.centerX,
      y: CONFIG.arena.centerY,
      color: CONFIG.colors.bossCore,
      size: 165,
      duration: 0.48,
    });
    host.setShake(0.16);
    host.emitAudio("bossPhase");
  }
}

export function clearBossHazards(host: SimulationHost): void {
  for (const enemy of host.state.enemies) {
    if (enemy.origin === "boss") {
      host.resolveEnemy(enemy, "transition");
    }
  }
  host.state.enemyBullets = [];
}

export function currentBossPhase(boss: Pick<BossState, "phase">): Readonly<BossPhaseDefinition> {
  return getBossPhaseDefinition(boss.phase);
}

export function getBossWeakArc(boss: Pick<BossState, "phase" | "weakAngle">): BossAngularArc {
  return {
    angle: boss.weakAngle,
    width: currentBossPhase(boss).shield.apertureWidth,
  };
}

export function isBossAngleInWeakWindow(
  boss: Pick<BossState, "phase" | "weakAngle">,
  angle: number,
): boolean {
  const aperture = getBossWeakArc(boss);
  return angularDistance(angle, aperture.angle) < aperture.width * 0.5;
}

export function isBossShotBlocked(
  boss: Pick<BossState, "phase" | "shieldMode" | "transitionTimer" | "weakAngle">,
  angle: number,
): boolean {
  return (
    boss.transitionTimer > 0 ||
    boss.shieldMode !== "vulnerable" ||
    !isBossAngleInWeakWindow(boss, angle)
  );
}

export function closestSafeArc(
  arcs: readonly BossSafeArcState[],
  angle: number,
): BossSafeArcState | null {
  let closest: BossSafeArcState | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const arc of arcs) {
    const candidateDistance = angularDistance(angle, arc.angle);
    if (candidateDistance < closestDistance) {
      closest = arc;
      closestDistance = candidateDistance;
    }
  }
  return closest;
}
