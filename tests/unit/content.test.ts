import { describe, expect, it } from "vitest";

import { CONFIG, GAME_CONTENT, validateGameContent } from "../../src/game/config";
import { BOSS_DEFINITIONS, BOSS_IDS, validateBossDefinitions } from "../../src/game/content/boss";
import {
  ENEMY_DEFINITIONS,
  ENEMY_TYPES,
  validateEnemyDefinitions,
} from "../../src/game/content/enemies";
import {
  POWER_UP_CONFIG,
  POWER_UP_DEFINITIONS,
  POWER_UP_TYPES,
  validatePowerUpDefinitions,
  validatePowerUpTuning,
} from "../../src/game/content/powerups";
import {
  WAVE_DEFINITIONS,
  WAVE_PATTERNS,
  validateWaveDefinitions,
} from "../../src/game/content/waves";

describe("typed content parity", () => {
  it("preserves every legacy configuration value", () => {
    expect(CONFIG).toEqual({
      canvas: { width: 960, height: 720 },
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
        rotationSpeed: 3.2,
        fireCooldown: 0.18,
        dashCooldown: 1.2,
        dashDistance: 0.65,
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
      enemies: {
        drifter: { health: 1, radialSpeed: [55, 75], size: 13, score: 100 },
        spiral: {
          health: 1,
          radialSpeed: [50, 70],
          angularVelocity: [0.8, 1.3],
          size: 13,
          score: 150,
        },
        mine: { health: 2, radialSpeed: [25, 40], size: 20, score: 200 },
        shooter: {
          health: 2,
          radialSpeed: 45,
          fireRadius: [150, 210],
          fireCooldown: [1.5, 2.5],
          size: 16,
          score: 250,
        },
        hunter: {
          health: 1,
          radialSpeed: [70, 90],
          turnRate: [0.7, 1.0],
          size: 15,
          score: 300,
        },
        shield: {
          health: 4,
          radialSpeed: [35, 50],
          shieldRadius: 80,
          size: 20,
          score: 500,
        },
      },
      boss: {
        health: 80,
        rotationSpeed: 0.8,
        phase2Threshold: 55,
        phase3Threshold: 25,
        score: 5000,
        coreRadius: 58,
        panelRadius: 72,
        panelWidth: 0.55,
        warningTime: 0.95,
        beamTime: 0.52,
      },
      scoring: {
        earlyKillRadius: 130,
        earlyKillBonus: 0.5,
        perfectWaveBonus: 1000,
        bossPhaseBonus: 1000,
        unusedBombVictoryBonus: 500,
        killsPerMultiplier: 5,
        maxMultiplier: 5,
      },
      powerups: {
        baseDropChance: 0.08,
        thirdWaveDropChance: 0.16,
        size: 14,
        radialSpeed: 34,
        weaponBoostDuration: 18,
      },
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
      TAU: Math.PI * 2,
    });
  });

  it("preserves all enemy, power-up, boss, wave, and pattern identifiers", () => {
    expect(ENEMY_TYPES).toEqual(["drifter", "spiral", "mine", "shooter", "hunter", "shield"]);
    expect(POWER_UP_TYPES).toEqual(["twin", "shield", "bomb"]);
    expect(BOSS_IDS).toEqual(["mothership"]);
    expect(WAVE_PATTERNS).toEqual(["sweep", "mirror", "fan", "random"]);
  });

  it("preserves every authored wave group", () => {
    expect(WAVE_DEFINITIONS).toEqual([
      {
        name: "Wave 1: Entry",
        groups: [
          { type: "drifter", count: 10, start: 0.5, interval: 0.62, pattern: "sweep", step: 0.62 },
        ],
      },
      {
        name: "Wave 2: More Angles",
        groups: [
          { type: "drifter", count: 8, start: 0.4, interval: 0.48, pattern: "mirror", step: 0.42 },
          { type: "drifter", count: 8, start: 3.2, interval: 0.42, pattern: "random" },
        ],
      },
      {
        name: "Wave 3: Spiral Introduction",
        groups: [
          { type: "drifter", count: 7, start: 0.4, interval: 0.5, pattern: "sweep", step: 0.55 },
          { type: "spiral", count: 8, start: 2.2, interval: 0.6, pattern: "fan", spread: 1.8 },
        ],
      },
      {
        name: "Wave 4: First Pressure Mix",
        groups: [
          { type: "drifter", count: 7, start: 0.4, interval: 0.46, pattern: "random" },
          { type: "spiral", count: 6, start: 1.8, interval: 0.6, pattern: "sweep", step: -0.7 },
          { type: "hunter", count: 4, start: 4.8, interval: 0.72, pattern: "mirror", step: 0.52 },
        ],
      },
      {
        name: "Wave 5: Minefield",
        groups: [
          { type: "mine", count: 7, start: 0.4, interval: 0.78, pattern: "sweep", step: 0.75 },
          { type: "drifter", count: 10, start: 2.2, interval: 0.48, pattern: "random" },
        ],
      },
      {
        name: "Wave 6: Crossfire",
        groups: [
          { type: "shooter", count: 5, start: 0.5, interval: 1.15, pattern: "fan", spread: 2.7 },
          { type: "drifter", count: 8, start: 1.4, interval: 0.48, pattern: "mirror", step: 0.48 },
          { type: "spiral", count: 6, start: 4.2, interval: 0.54, pattern: "random" },
        ],
      },
      {
        name: "Wave 7: Priority Targets",
        groups: [
          { type: "shield", count: 2, start: 0.5, interval: 3.2, pattern: "mirror", step: 0.0 },
          { type: "drifter", count: 10, start: 1.0, interval: 0.45, pattern: "fan", spread: 2.4 },
          { type: "hunter", count: 5, start: 4.3, interval: 0.7, pattern: "random" },
        ],
      },
      {
        name: "Wave 8: Final Mixed Wave",
        groups: [
          { type: "drifter", count: 8, start: 0.35, interval: 0.38, pattern: "sweep", step: 0.5 },
          { type: "spiral", count: 6, start: 1.4, interval: 0.5, pattern: "mirror", step: 0.4 },
          { type: "mine", count: 4, start: 2.0, interval: 0.85, pattern: "fan", spread: 2.2 },
          { type: "shooter", count: 3, start: 3.6, interval: 1.2, pattern: "random" },
          { type: "hunter", count: 5, start: 5.4, interval: 0.56, pattern: "random" },
          { type: "shield", count: 1, start: 6.4, interval: 1.0, pattern: "random" },
        ],
      },
    ]);
  });
});

describe("runtime content validation", () => {
  it("accepts the canonical content", () => {
    expect(() => validateEnemyDefinitions(ENEMY_DEFINITIONS)).not.toThrow();
    expect(() => validateWaveDefinitions(WAVE_DEFINITIONS)).not.toThrow();
    expect(() => validateBossDefinitions(BOSS_DEFINITIONS)).not.toThrow();
    expect(() => validatePowerUpDefinitions(POWER_UP_DEFINITIONS)).not.toThrow();
    expect(() => validatePowerUpTuning(POWER_UP_CONFIG)).not.toThrow();
    expect(() => validateGameContent(GAME_CONTENT)).not.toThrow();
  });

  it("reports the precise enemy field for an inverted range", () => {
    const invalid = {
      ...ENEMY_DEFINITIONS,
      shooter: { ...ENEMY_DEFINITIONS.shooter, fireCooldown: [3, 2] },
    };
    expect(() => validateEnemyDefinitions(invalid)).toThrow(
      "enemies.shooter.fireCooldown: minimum must not exceed maximum",
    );
  });

  it("reports an unknown enemy identifier in its wave group", () => {
    const invalid = WAVE_DEFINITIONS.map((wave, index) =>
      index === 0
        ? {
            ...wave,
            groups: [{ ...(wave.groups[0] ?? {}), type: "unknown-enemy" }],
          }
        : wave,
    );
    expect(() => validateWaveDefinitions(invalid)).toThrow("waves[0].groups[0].type");
  });

  it("reports invalid boss phase ordering", () => {
    const invalid = {
      mothership: {
        ...BOSS_DEFINITIONS.mothership,
        phase2Threshold: 20,
        phase3Threshold: 25,
      },
    };
    expect(() => validateBossDefinitions(invalid)).toThrow(
      "health > phase2Threshold > phase3Threshold",
    );
  });

  it("reports a power-up whose embedded identifier does not match its key", () => {
    const invalid = {
      ...POWER_UP_DEFINITIONS,
      twin: { id: "bomb" },
    };
    expect(() => validatePowerUpDefinitions(invalid)).toThrow(
      'powerups.definitions.twin.id: expected "twin"',
    );
  });

  it("reports a missing top-level content section", () => {
    expect(() =>
      validateGameContent({
        enemies: ENEMY_DEFINITIONS,
        waves: WAVE_DEFINITIONS,
        bosses: BOSS_DEFINITIONS,
      }),
    ).toThrow("Invalid game content at content: missing powerups");
  });
});
