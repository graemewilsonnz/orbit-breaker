import {
  BOSS_DEFINITIONS,
  MOTHERSHIP_BOSS,
  validateBossDefinitions,
  type BossDefinitions,
} from "./content/boss";
import {
  ENEMY_DEFINITIONS,
  validateEnemyDefinitions,
  type EnemyDefinitions,
} from "./content/enemies";
import {
  POWER_UP_CONFIG,
  POWER_UP_DEFINITIONS,
  validatePowerUpDefinitions,
  validatePowerUpTuning,
  type PowerUpDefinitions,
  type PowerUpTuning,
} from "./content/powerups";
import { WAVE_DEFINITIONS, validateWaveDefinitions, type WaveDefinition } from "./content/waves";

export const TAU = Math.PI * 2;

export const CONFIG = {
  canvas: {
    width: 960,
    height: 720,
  },
  arena: {
    centerX: 480,
    centerY: 360,
    playerRadius: 280,
    enemySpawnRadius: 20,
    dangerRadius: 240,
    outerKillRadius: 330,
    bossHitRadius: 94,
    guideRings: [90, 160, 240, 280],
  },
  player: {
    size: 16,
    lives: 3,
    rotationSpeed: 3.6,
    fireCooldown: 0.15,
    dashCooldown: 0.9,
    dashDistance: 0.72,
    dashInputBuffer: 0.15,
    dashInvulnerability: 0.15,
    invulnerabilityAfterHit: 1.5,
    maxBombs: 3,
    startingBombs: 1,
    shieldOrbitRadius: 26,
  },
  projectiles: {
    playerSpeed: 520,
    enemySpeed: 175,
    playerSize: 4,
    enemySize: 5,
    twinOffset: 0.045,
  },
  hitboxes: {
    playerDamageScale: 0.72,
    enemyTargetScale: 0.82,
    enemyContactScale: 0.66,
    enemyProjectileScale: 0.9,
  },
  telegraphs: {
    enemySpawnSeconds: 0.78,
  },
  enemies: ENEMY_DEFINITIONS,
  boss: MOTHERSHIP_BOSS,
  scoring: {
    earlyKillRadius: 130,
    earlyKillBonus: 0.5,
    perfectWaveBonus: 1000,
    bossPhaseBonus: 1000,
    unusedBombVictoryBonus: 500,
    killsPerMultiplier: 5,
    maxMultiplier: 5,
    feedbackSeconds: 1.15,
  },
  powerups: POWER_UP_CONFIG,
  colors: {
    background: "#05070d",
    text: "#ecf8ff",
    mutedText: "#8fa8ba",
    ring: "rgba(119, 174, 199, 0.42)",
    guide: "rgba(119, 174, 199, 0.15)",
    player: "#4de0ff",
    playerAccent: "#f9f871",
    playerBullet: "#f9f871",
    enemyBullet: "#ff6b6b",
    drifter: "#ffb84d",
    spiral: "#d98cff",
    mine: "#ff5d88",
    shooter: "#69e89f",
    hunter: "#ff7f50",
    shield: "#7ad7ff",
    shieldAura: "rgba(110, 210, 255, 0.28)",
    boss: "#f05b78",
    bossCore: "#ffd166",
    warning: "rgba(255, 206, 84, 0.34)",
    beam: "rgba(255, 77, 109, 0.74)",
    powerTwin: "#f9f871",
    powerShield: "#61e8ff",
    powerBomb: "#ff9f43",
  },
  TAU,
} as const;

export const GAME_CONFIG = CONFIG;
export type GameConfig = typeof CONFIG;

export interface PowerUpContent {
  readonly definitions: PowerUpDefinitions;
  readonly tuning: PowerUpTuning;
}

export interface GameContent {
  readonly enemies: EnemyDefinitions;
  readonly waves: readonly WaveDefinition[];
  readonly bosses: BossDefinitions;
  readonly powerups: PowerUpContent;
}

export const GAME_CONTENT = {
  enemies: ENEMY_DEFINITIONS,
  waves: WAVE_DEFINITIONS,
  bosses: BOSS_DEFINITIONS,
  powerups: {
    definitions: POWER_UP_DEFINITIONS,
    tuning: POWER_UP_CONFIG,
  },
} as const satisfies GameContent;

function contentError(path: string, message: string): never {
  throw new Error(`Invalid game content at ${path}: ${message}`);
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    contentError(path, "expected an object");
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value);
  const missing = expected.filter((key) => !(key in value));
  const unexpected = actual.filter((key) => !expected.includes(key));
  if (missing.length > 0) {
    contentError(path, `missing ${missing.join(", ")}`);
  }
  if (unexpected.length > 0) {
    contentError(path, `unexpected ${unexpected.join(", ")}`);
  }
}

export function validateGameContent(value: unknown = GAME_CONTENT): asserts value is GameContent {
  assertRecord(value, "content");
  assertExactKeys(value, ["enemies", "waves", "bosses", "powerups"], "content");
  validateEnemyDefinitions(value.enemies);
  validateWaveDefinitions(value.waves);
  validateBossDefinitions(value.bosses);

  const powerups: unknown = value.powerups;
  assertRecord(powerups, "content.powerups");
  assertExactKeys(powerups, ["definitions", "tuning"], "content.powerups");
  validatePowerUpDefinitions(powerups.definitions);
  validatePowerUpTuning(powerups.tuning);
}

validateGameContent();
