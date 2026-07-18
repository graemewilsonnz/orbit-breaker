import type { EnemyType } from "./content/enemies";

export const DAMAGE_SOURCES = ["enemy-projectile", "enemy-contact", "boss-beam"] as const;

export type DamageSource = (typeof DAMAGE_SOURCES)[number];

export const PLAYER_ACTIONS = ["move", "fire", "dash"] as const;

export type PlayerActionMetric = (typeof PLAYER_ACTIONS)[number];

export interface WaveTiming {
  wave: number;
  seconds: number;
}

export interface RunMetrics {
  elapsedSeconds: number;
  shotsFired: number;
  shotsHit: number;
  enemiesDestroyed: number;
  damageTaken: number;
  damageBySource: Record<DamageSource, number>;
  lastDamageSource: DamageSource | null;
  lastDamageEnemyType: EnemyType | null;
  firstMoveSeconds: number | null;
  firstShotSeconds: number | null;
  firstDashSeconds: number | null;
  waveStartedSeconds: number;
  waveTimings: WaveTiming[];
}

export interface ReadonlyRunMetrics extends Omit<
  Readonly<RunMetrics>,
  "damageBySource" | "waveTimings"
> {
  readonly damageBySource: Readonly<Record<DamageSource, number>>;
  readonly waveTimings: readonly Readonly<WaveTiming>[];
}

export function createRunMetrics(): RunMetrics {
  return {
    elapsedSeconds: 0,
    shotsFired: 0,
    shotsHit: 0,
    enemiesDestroyed: 0,
    damageTaken: 0,
    damageBySource: {
      "enemy-projectile": 0,
      "enemy-contact": 0,
      "boss-beam": 0,
    },
    lastDamageSource: null,
    lastDamageEnemyType: null,
    firstMoveSeconds: null,
    firstShotSeconds: null,
    firstDashSeconds: null,
    waveStartedSeconds: 0,
    waveTimings: [],
  };
}

export function accuracyPercent(metrics: Pick<RunMetrics, "shotsFired" | "shotsHit">): number {
  if (metrics.shotsFired <= 0) {
    return 0;
  }
  return Math.round((metrics.shotsHit / metrics.shotsFired) * 100);
}

export function recordFirstAction(
  metrics: RunMetrics,
  action: PlayerActionMetric,
  timeSeconds = metrics.elapsedSeconds,
): void {
  const value = Math.max(0, timeSeconds);
  if (action === "move" && metrics.firstMoveSeconds === null) {
    metrics.firstMoveSeconds = value;
  } else if (action === "fire" && metrics.firstShotSeconds === null) {
    metrics.firstShotSeconds = value;
  } else if (action === "dash" && metrics.firstDashSeconds === null) {
    metrics.firstDashSeconds = value;
  }
}

export function recordDamage(
  metrics: RunMetrics,
  source: DamageSource,
  enemyType: EnemyType | null = null,
): void {
  metrics.damageTaken += 1;
  metrics.damageBySource[source] += 1;
  metrics.lastDamageSource = source;
  metrics.lastDamageEnemyType = enemyType;
}

export function recordWaveTiming(metrics: RunMetrics, wave: number): void {
  const seconds = Math.max(0, metrics.elapsedSeconds - metrics.waveStartedSeconds);
  metrics.waveTimings.push({ wave, seconds });
  metrics.waveStartedSeconds = metrics.elapsedSeconds;
}

export function damageSourceLabel(
  source: DamageSource,
  enemyType: EnemyType | null = null,
): string {
  switch (source) {
    case "enemy-projectile":
      return enemyType === "shooter" ? "SHOOTER BOLT" : "ENEMY SHOT";
    case "enemy-contact":
      return enemyType === null ? "COLLISION" : `${enemyType.toUpperCase()} BREACH`;
    case "boss-beam":
      return "BOSS BEAM";
  }
}
