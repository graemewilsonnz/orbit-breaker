import type { BossId, BossPhase } from "./content/boss";
import type { EnemyType } from "./content/enemies";
import type { PowerUpType } from "./content/powerups";
import type { WaveDefinition } from "./content/waves";

export const GAME_STATES = [
  "title",
  "playing",
  "paused",
  "waveClear",
  "bossIntro",
  "gameOver",
  "victory",
] as const;

export type GameStateId = (typeof GAME_STATES)[number];

export const PROJECTILE_OWNERS = ["player", "enemy"] as const;
export type ProjectileOwner = (typeof PROJECTILE_OWNERS)[number];

export const EFFECT_TYPES = ["ring", "burst", "bossPulse", "bomb"] as const;
export type EffectType = (typeof EFFECT_TYPES)[number];

export interface CartesianPosition {
  x: number;
  y: number;
}

export interface PolarPosition {
  angle: number;
  radius: number;
}

export interface PlayerState extends PolarPosition {
  rotationSpeed: number;
  fireCooldown: number;
  dashCooldown: number;
  lives: number;
  invulnerabilityTimer: number;
  dashInvulnerabilityTimer: number;
  weaponLevel: 1 | 2 | 3;
  weaponTimer: number;
  shieldActive: boolean;
  shieldAngle: number;
  bombCount: number;
  score: number;
  multiplier: number;
  lastMoveDirection: -1 | 1;
  flashTimer: number;
  size: number;
}

export interface ProjectileState extends PolarPosition {
  owner: ProjectileOwner;
  radialSpeed: number;
  angularVelocity: number;
  size: number;
  damage: number;
  pierce: number;
  color: string;
  active: boolean;
  age: number;
}

export interface EnemyState extends PolarPosition {
  type: EnemyType;
  health: number;
  maxHealth: number;
  radialSpeed: number;
  angularVelocity: number;
  turnRate: number;
  fireRadius: number;
  fireCooldown: number;
  fireTimer: number;
  size: number;
  score: number;
  active: boolean;
  age: number;
  hitFlash: number;
  shielded: boolean;
  hasFiredIntro: boolean;
  shieldRadius?: number;
}

export interface PowerUpState extends PolarPosition {
  type: PowerUpType;
  size: number;
  radialSpeed: number;
  angularVelocity: number;
  spin: number;
  life: number;
  active: boolean;
}

export interface BossBeamState {
  angle: number;
  width: number;
  timer: number;
  active: boolean;
  done?: boolean;
}

export interface BossState {
  id: BossId;
  health: number;
  maxHealth: number;
  rotation: number;
  phase: BossPhase;
  attackTimer: number;
  spawnTimer: number;
  beams: BossBeamState[];
  active: boolean;
  hitFlash: number;
  phaseAwarded: Record<2 | 3, boolean>;
}

export interface EffectState {
  type: EffectType;
  x?: number;
  y?: number;
  angle?: number;
  radius?: number;
  color: string;
  size: number;
  duration: number;
  age: number;
  active: boolean;
}

export interface StarState extends PolarPosition {
  speed: number;
  size: number;
}

export interface WaveSpawnState {
  type: EnemyType;
  time: number;
  angle: number;
}

export interface WaveRuntimeState {
  waveNumber: number;
  definition: WaveDefinition | null;
  queue: WaveSpawnState[];
  elapsed: number;
  completeDelay: number;
}

export interface GameState {
  state: GameStateId;
  stateTimer: number;
  player: PlayerState;
  wave: WaveRuntimeState;
  enemies: EnemyState[];
  playerShots: ProjectileState[];
  enemyBullets: ProjectileState[];
  powerups: PowerUpState[];
  effects: EffectState[];
  stars: StarState[];
  boss: BossState | null;
  currentWave: number;
  waveReached: number;
  killStreak: number;
  perfectWave: boolean;
  lastWavePerfect: boolean;
  shake: number;
}

export type ReadonlyPlayerState = Readonly<PlayerState>;
export type ReadonlyProjectileState = Readonly<ProjectileState>;
export type ReadonlyEnemyState = Readonly<EnemyState>;
export type ReadonlyPowerUpState = Readonly<PowerUpState>;
export type ReadonlyBossBeamState = Readonly<BossBeamState>;
export type ReadonlyEffectState = Readonly<EffectState>;
export type ReadonlyStarState = Readonly<StarState>;

export interface ReadonlyBossState extends Omit<Readonly<BossState>, "beams" | "phaseAwarded"> {
  readonly beams: readonly ReadonlyBossBeamState[];
  readonly phaseAwarded: Readonly<Record<2 | 3, boolean>>;
}

export interface ReadonlyWaveRuntimeState extends Omit<Readonly<WaveRuntimeState>, "queue"> {
  readonly queue: readonly Readonly<WaveSpawnState>[];
}

export interface ReadonlyGameState {
  readonly state: GameStateId;
  readonly stateTimer: number;
  readonly player: ReadonlyPlayerState;
  readonly wave: ReadonlyWaveRuntimeState;
  readonly enemies: readonly ReadonlyEnemyState[];
  readonly playerShots: readonly ReadonlyProjectileState[];
  readonly enemyBullets: readonly ReadonlyProjectileState[];
  readonly powerups: readonly ReadonlyPowerUpState[];
  readonly effects: readonly ReadonlyEffectState[];
  readonly stars: readonly ReadonlyStarState[];
  readonly boss: ReadonlyBossState | null;
  readonly currentWave: number;
  readonly waveReached: number;
  readonly killStreak: number;
  readonly perfectWave: boolean;
  readonly lastWavePerfect: boolean;
  readonly shake: number;
}

export function asReadonlyGameState(state: GameState): ReadonlyGameState {
  return state;
}
