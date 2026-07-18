import type { EnemyType } from "../content/enemies";
import type { AudioCue } from "../core/events";
import type { RandomSource } from "../core/rng";
import type { DamageSource } from "../runMetrics";
import type { EffectState, EnemyState, GameState, ProjectileState } from "../state";

/** The enemy constructor fields that the prototype allowed callers to override. */
export type EnemyOverrides = Partial<
  Pick<EnemyState, "angularVelocity" | "health" | "radialSpeed" | "radius" | "turnRate">
>;

export type EffectRequest = Omit<EffectState, "active" | "age">;

/**
 * The small orchestration surface used by simulation entities.
 *
 * Implementations own presentation-event delivery and higher-level game rules.
 * setShake() raises the current shake to at least the supplied intensity.
 */
export interface SimulationHost {
  readonly state: GameState;
  readonly rng: RandomSource;

  emitAudio(cue: AudioCue): void;
  addEffect(effect: EffectRequest): void;
  setShake(intensity: number): void;

  activateBomb(): void;
  clearNearbyEnemyBullets(radius: number): void;
  onPlayerDamaged(source: DamageSource): void;
  registerShotHit(projectile: ProjectileState): void;
  addScore(base: number, source?: EnemyState | null, flat?: boolean): void;
  defeatBoss(): void;
  spawnEnemy(type: EnemyType, angle: number, overrides?: EnemyOverrides): void;
}
