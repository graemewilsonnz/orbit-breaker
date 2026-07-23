import { describe, expect, it } from "vitest";

import { CONFIG, GAME_CONTENT, validateGameContent } from "../../src/game/config";
import {
  BOSS_DEFINITIONS,
  BOSS_IDS,
  BOSS_PHASES,
  MIN_BOSS_BEAM_WARNING_SECONDS,
  MIN_BOSS_OPENING_WARNING_SECONDS,
  MIN_BOSS_SAFE_ARC_WIDTH,
  validateBossDefinitions,
} from "../../src/game/content/boss";
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

describe("typed M1 content contract", () => {
  it("pins the current gameplay configuration", () => {
    expect(CONFIG).toEqual({
      canvas: { width: 960, height: 720 },
      arena: {
        centerX: 480,
        centerY: 360,
        playerRadius: 280,
        enemySpawnRadius: 20,
        innerKillRadius: 0,
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
      enemies: {
        drifter: { health: 1, radialSpeed: [55, 75], size: 13, score: 100 },
        spiral: {
          health: 1,
          radialSpeed: [50, 70],
          angularVelocity: [0.8, 1.3],
          size: 13,
          score: 150,
        },
        mine: {
          health: 2,
          radialSpeed: [25, 40],
          claimRadius: 220,
          warningTime: 0.8,
          holdTime: 2.8,
          releaseSpeed: 82,
          dangerRadius: 60,
          size: 20,
          score: 200,
        },
        shooter: {
          health: 2,
          radialSpeed: 45,
          fireRadius: [150, 210],
          fireCooldown: [1.35, 2.0],
          warningTime: 0.7,
          aimTurnRate: 2.8,
          driftSpeed: 10,
          size: 16,
          score: 250,
        },
        hunter: {
          health: 1,
          radialSpeed: [70, 90],
          turnRate: [0.7, 1.0],
          lockRadius: 202,
          warningTime: 0.58,
          lungeSpeed: 112,
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
        health: 150,
        score: 5000,
        bombDamage: 8,
        coreRadius: 58,
        panelRadius: 72,
        panelWidth: 0.46,
        panelCount: 8,
        transitionTime: 1.15,
        phases: [
          {
            phase: 1,
            name: "Lattice Lock",
            healthFloor: 100,
            rotationSpeed: 0.52,
            shield: {
              guardedTime: 2,
              openingWarning: 0.85,
              vulnerableTime: 2.3,
              recoveryTime: 0.75,
              apertureWidth: 0.9,
            },
            beam: {
              count: 2,
              width: 0.58,
              warningTime: 1.15,
              activeTime: 0.55,
              recoveryTime: 4,
              initialDelay: 3.4,
            },
            adds: { types: [], interval: 0, initialDelay: 0, maxActive: 0 },
          },
          {
            phase: 2,
            name: "Radial Crosscurrent",
            healthFloor: 50,
            rotationSpeed: 0.72,
            shield: {
              guardedTime: 1.9,
              openingWarning: 0.8,
              vulnerableTime: 2.15,
              recoveryTime: 0.75,
              apertureWidth: 0.82,
            },
            beam: {
              count: 3,
              width: 0.62,
              warningTime: 1.08,
              activeTime: 0.58,
              recoveryTime: 3.2,
              initialDelay: 2.4,
            },
            adds: { types: ["drifter"], interval: 7.4, initialDelay: 4.6, maxActive: 2 },
          },
          {
            phase: 3,
            name: "Orbit Collapse",
            healthFloor: 0,
            rotationSpeed: 0.92,
            shield: {
              guardedTime: 1.7,
              openingWarning: 0.75,
              vulnerableTime: 2,
              recoveryTime: 0.7,
              apertureWidth: 0.74,
            },
            beam: {
              count: 4,
              width: 0.64,
              warningTime: 1,
              activeTime: 0.6,
              recoveryTime: 2.7,
              initialDelay: 2,
            },
            adds: {
              types: ["drifter", "spiral"],
              interval: 6.2,
              initialDelay: 3,
              maxActive: 4,
            },
          },
        ],
      },
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
      powerups: {
        waveDropChances: [0.06, 0.07, 0.13, 0.08, 0.1, 0.14, 0.1, 0.12],
        pityKills: 10,
        maxDropsPerWave: 2,
        maxActiveDrops: 2,
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

  it("pins the authored M4 phase and fairness contract", () => {
    expect(BOSS_PHASES).toEqual([1, 2, 3]);
    expect(
      BOSS_DEFINITIONS.mothership.phases.map((phase) => ({
        phase: phase.phase,
        floor: phase.healthFloor,
        beamCount: phase.beam.count,
        warning: phase.beam.warningTime,
        safeArc: CONFIG.TAU / phase.beam.count - phase.beam.width,
        adds: phase.adds.types,
        maxAdds: phase.adds.maxActive,
      })),
    ).toEqual([
      {
        phase: 1,
        floor: 100,
        beamCount: 2,
        warning: 1.15,
        safeArc: CONFIG.TAU / 2 - 0.58,
        adds: [],
        maxAdds: 0,
      },
      {
        phase: 2,
        floor: 50,
        beamCount: 3,
        warning: 1.08,
        safeArc: CONFIG.TAU / 3 - 0.62,
        adds: ["drifter"],
        maxAdds: 2,
      },
      {
        phase: 3,
        floor: 0,
        beamCount: 4,
        warning: 1,
        safeArc: CONFIG.TAU / 4 - 0.64,
        adds: ["drifter", "spiral"],
        maxAdds: 4,
      },
    ]);
    for (const phase of BOSS_DEFINITIONS.mothership.phases) {
      expect(phase.shield.openingWarning).toBeGreaterThanOrEqual(MIN_BOSS_OPENING_WARNING_SECONDS);
      expect(phase.beam.warningTime).toBeGreaterThanOrEqual(MIN_BOSS_BEAM_WARNING_SECONDS);
      expect(CONFIG.TAU / phase.beam.count - phase.beam.width).toBeGreaterThanOrEqual(
        MIN_BOSS_SAFE_ARC_WIDTH,
      );
    }
  });

  it("pins every authored wave group", () => {
    expect(WAVE_DEFINITIONS.map(({ name, groups }) => ({ name, groups }))).toEqual([
      {
        name: "Wave 1: Trace the Ring",
        groups: [
          { type: "drifter", count: 7, start: 0.85, interval: 0.72, pattern: "sweep", step: 0.68 },
          { type: "drifter", count: 2, start: 8.3, interval: 0.7, pattern: "mirror", step: 0.45 },
        ],
      },
      {
        name: "Wave 2: Crossing Lines",
        groups: [
          { type: "drifter", count: 12, start: 0.65, interval: 0.48, pattern: "mirror", step: 0.5 },
          { type: "drifter", count: 5, start: 11, interval: 0.45, pattern: "fan", spread: 1.65 },
        ],
      },
      {
        name: "Wave 3: Spiral Introduction",
        groups: [
          { type: "drifter", count: 7, start: 0.4, interval: 0.5, pattern: "sweep", step: 0.55 },
          { type: "spiral", count: 8, start: 10, interval: 0.55, pattern: "fan", spread: 1.8 },
        ],
      },
      {
        name: "Wave 4: First Pressure Mix",
        groups: [
          { type: "drifter", count: 7, start: 0.4, interval: 0.46, pattern: "random" },
          { type: "spiral", count: 6, start: 5, interval: 0.6, pattern: "sweep", step: -0.7 },
          { type: "hunter", count: 4, start: 15, interval: 0.65, pattern: "mirror", step: 0.52 },
        ],
      },
      {
        name: "Wave 5: Minefield",
        groups: [
          { type: "mine", count: 7, start: 0.4, interval: 0.78, pattern: "sweep", step: 0.75 },
          { type: "drifter", count: 10, start: 12, interval: 0.55, pattern: "random" },
        ],
      },
      {
        name: "Wave 6: Crossfire",
        groups: [
          { type: "shooter", count: 5, start: 0.5, interval: 1.15, pattern: "fan", spread: 2.7 },
          { type: "drifter", count: 8, start: 7, interval: 0.48, pattern: "mirror", step: 0.48 },
          { type: "spiral", count: 6, start: 18, interval: 0.54, pattern: "random" },
        ],
      },
      {
        name: "Wave 7: Priority Targets",
        groups: [
          { type: "shield", count: 2, start: 0.5, interval: 3.5, pattern: "mirror", step: 0.0 },
          { type: "drifter", count: 10, start: 5, interval: 0.45, pattern: "fan", spread: 2.4 },
          { type: "hunter", count: 5, start: 19, interval: 0.7, pattern: "random" },
        ],
      },
      {
        name: "Wave 8: Final Mixed Wave",
        groups: [
          { type: "drifter", count: 8, start: 0.35, interval: 0.45, pattern: "sweep", step: 0.5 },
          { type: "spiral", count: 6, start: 1.4, interval: 0.55, pattern: "mirror", step: 0.4 },
          { type: "mine", count: 4, start: 8, interval: 0.85, pattern: "fan", spread: 2.2 },
          { type: "shooter", count: 3, start: 9, interval: 0.9, pattern: "random" },
          { type: "hunter", count: 5, start: 21, interval: 0.65, pattern: "random" },
          { type: "shield", count: 1, start: 22.5, interval: 1.0, pattern: "random" },
        ],
      },
    ]);
  });

  it("pins the M3 pressure, duration, and recovery contract", () => {
    expect(
      WAVE_DEFINITIONS.map(({ pressureBudget, targetDuration, recoveryBeats }) => ({
        pressureBudget,
        targetDuration,
        recoveryBeats,
      })),
    ).toEqual([
      { pressureBudget: 9, targetDuration: [14, 22], recoveryBeats: [{ at: 5.2, duration: 3.1 }] },
      { pressureBudget: 17, targetDuration: [17, 25], recoveryBeats: [{ at: 6, duration: 5 }] },
      { pressureBudget: 19, targetDuration: [19, 28], recoveryBeats: [{ at: 4, duration: 6 }] },
      { pressureBudget: 24, targetDuration: [21, 30], recoveryBeats: [{ at: 8.2, duration: 6.8 }] },
      { pressureBudget: 24, targetDuration: [22, 31], recoveryBeats: [{ at: 5.2, duration: 6.8 }] },
      {
        pressureBudget: 27,
        targetDuration: [24, 34],
        recoveryBeats: [{ at: 10.5, duration: 7.5 }],
      },
      { pressureBudget: 26, targetDuration: [25, 36], recoveryBeats: [{ at: 9.2, duration: 9.8 }] },
      {
        pressureBudget: 44,
        targetDuration: [28, 40],
        recoveryBeats: [
          { at: 5, duration: 3 },
          { at: 11, duration: 10 },
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
        phases: BOSS_DEFINITIONS.mothership.phases.map((phase, index) =>
          index === 1 ? { ...phase, healthFloor: 110 } : phase,
        ),
      },
    };
    expect(() => validateBossDefinitions(invalid)).toThrow(
      "bosses.mothership.phases[1].healthFloor: must descend from the previous phase boundary",
    );
  });

  it("rejects boss attacks that shorten the warning or erase the authored safe arc", () => {
    const shortWarning = {
      mothership: {
        ...BOSS_DEFINITIONS.mothership,
        phases: BOSS_DEFINITIONS.mothership.phases.map((phase, index) =>
          index === 0
            ? {
                ...phase,
                beam: { ...phase.beam, warningTime: MIN_BOSS_BEAM_WARNING_SECONDS - 0.01 },
              }
            : phase,
        ),
      },
    };
    expect(() => validateBossDefinitions(shortWarning)).toThrow(
      `bosses.mothership.phases[0].beam.warningTime: must be at least ${MIN_BOSS_BEAM_WARNING_SECONDS} seconds`,
    );

    const noSafeArc = {
      mothership: {
        ...BOSS_DEFINITIONS.mothership,
        phases: BOSS_DEFINITIONS.mothership.phases.map((phase, index) =>
          index === 2
            ? {
                ...phase,
                beam: {
                  ...phase.beam,
                  width: CONFIG.TAU / phase.beam.count - MIN_BOSS_SAFE_ARC_WIDTH + 0.01,
                },
              }
            : phase,
        ),
      },
    };
    expect(() => validateBossDefinitions(noSafeArc)).toThrow(
      `bosses.mothership.phases[2].beam.width: must leave a safe arc at least ${MIN_BOSS_SAFE_ARC_WIDTH} radians wide`,
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
