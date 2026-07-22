import { ENEMY_TYPES, type EnemyType } from "./enemies";

export const BOSS_IDS = ["mothership"] as const;
export type BossId = (typeof BOSS_IDS)[number];

export const BOSS_PHASES = [1, 2, 3] as const;
export type BossPhase = (typeof BOSS_PHASES)[number];

export const BOSS_SHIELD_MODES = ["guarded", "opening", "vulnerable", "recovering"] as const;
export type BossShieldMode = (typeof BOSS_SHIELD_MODES)[number];

export interface BossShieldDefinition {
  readonly guardedTime: number;
  readonly openingWarning: number;
  readonly vulnerableTime: number;
  readonly recoveryTime: number;
  readonly apertureWidth: number;
}

export interface BossBeamDefinition {
  readonly count: number;
  readonly width: number;
  readonly warningTime: number;
  readonly activeTime: number;
  readonly recoveryTime: number;
  readonly initialDelay: number;
}

export interface BossAddDefinition {
  readonly types: readonly EnemyType[];
  readonly interval: number;
  readonly initialDelay: number;
  readonly maxActive: number;
}

export interface BossPhaseDefinition {
  readonly phase: BossPhase;
  readonly name: string;
  readonly healthFloor: number;
  readonly rotationSpeed: number;
  readonly shield: Readonly<BossShieldDefinition>;
  readonly beam: Readonly<BossBeamDefinition>;
  readonly adds: Readonly<BossAddDefinition>;
}

export interface BossDefinition {
  readonly health: number;
  readonly score: number;
  readonly bombDamage: number;
  readonly coreRadius: number;
  readonly panelRadius: number;
  readonly panelWidth: number;
  readonly panelCount: number;
  readonly transitionTime: number;
  readonly phases: readonly Readonly<BossPhaseDefinition>[];
}

export type BossDefinitions = Readonly<Record<BossId, Readonly<BossDefinition>>>;

export const BOSS_DEFINITIONS = {
  mothership: {
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
} as const satisfies BossDefinitions;

export const MOTHERSHIP_BOSS = BOSS_DEFINITIONS.mothership;

export const MIN_BOSS_BEAM_WARNING_SECONDS = 0.9;
export const MIN_BOSS_OPENING_WARNING_SECONDS = 0.65;
export const MIN_BOSS_SAFE_ARC_WIDTH = 0.42;

const BOSS_FIELDS = [
  "health",
  "score",
  "bombDamage",
  "coreRadius",
  "panelRadius",
  "panelWidth",
  "panelCount",
  "transitionTime",
  "phases",
] as const;
const PHASE_FIELDS = [
  "phase",
  "name",
  "healthFloor",
  "rotationSpeed",
  "shield",
  "beam",
  "adds",
] as const;
const SHIELD_FIELDS = [
  "guardedTime",
  "openingWarning",
  "vulnerableTime",
  "recoveryTime",
  "apertureWidth",
] as const;
const BEAM_FIELDS = [
  "count",
  "width",
  "warningTime",
  "activeTime",
  "recoveryTime",
  "initialDelay",
] as const;
const ADD_FIELDS = ["types", "interval", "initialDelay", "maxActive"] as const;

function contentError(path: string, message: string): never {
  throw new Error(`Invalid boss content at ${path}: ${message}`);
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

function assertPositive(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    contentError(path, "expected a finite number greater than zero");
  }
}

function assertNonNegative(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    contentError(path, "expected a finite non-negative number");
  }
}

function assertPositiveInteger(value: unknown, path: string): asserts value is number {
  assertPositive(value, path);
  if (!Number.isInteger(value)) {
    contentError(path, "expected an integer");
  }
}

function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  assertNonNegative(value, path);
  if (!Number.isInteger(value)) {
    contentError(path, "expected an integer");
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    contentError(path, "expected a non-empty string");
  }
}

function validateShield(value: unknown, path: string): void {
  assertRecord(value, path);
  assertExactKeys(value, SHIELD_FIELDS, path);
  assertPositive(value.guardedTime, `${path}.guardedTime`);
  assertPositive(value.openingWarning, `${path}.openingWarning`);
  assertPositive(value.vulnerableTime, `${path}.vulnerableTime`);
  assertPositive(value.recoveryTime, `${path}.recoveryTime`);
  assertPositive(value.apertureWidth, `${path}.apertureWidth`);
  if (value.openingWarning < MIN_BOSS_OPENING_WARNING_SECONDS) {
    contentError(
      `${path}.openingWarning`,
      `must be at least ${MIN_BOSS_OPENING_WARNING_SECONDS} seconds`,
    );
  }
  if (value.apertureWidth >= Math.PI * 2) {
    contentError(`${path}.apertureWidth`, "must be less than a full rotation");
  }
}

function validateBeam(value: unknown, path: string): void {
  assertRecord(value, path);
  assertExactKeys(value, BEAM_FIELDS, path);
  assertPositiveInteger(value.count, `${path}.count`);
  assertPositive(value.width, `${path}.width`);
  assertPositive(value.warningTime, `${path}.warningTime`);
  assertPositive(value.activeTime, `${path}.activeTime`);
  assertPositive(value.recoveryTime, `${path}.recoveryTime`);
  assertPositive(value.initialDelay, `${path}.initialDelay`);
  if (value.warningTime < MIN_BOSS_BEAM_WARNING_SECONDS) {
    contentError(
      `${path}.warningTime`,
      `must be at least ${MIN_BOSS_BEAM_WARNING_SECONDS} seconds`,
    );
  }
  const spacing = (Math.PI * 2) / value.count;
  if (value.width >= spacing) {
    contentError(`${path}.width`, "must leave space between adjacent beams");
  }
  if (spacing - value.width < MIN_BOSS_SAFE_ARC_WIDTH) {
    contentError(
      `${path}.width`,
      `must leave a safe arc at least ${MIN_BOSS_SAFE_ARC_WIDTH} radians wide`,
    );
  }
}

function validateAdds(value: unknown, path: string): void {
  assertRecord(value, path);
  assertExactKeys(value, ADD_FIELDS, path);
  if (!Array.isArray(value.types)) {
    contentError(`${path}.types`, "expected an array");
  }
  for (const [index, type] of value.types.entries()) {
    if (typeof type !== "string" || !ENEMY_TYPES.includes(type as EnemyType)) {
      contentError(`${path}.types[${index}]`, `unknown enemy type ${String(type)}`);
    }
  }
  assertNonNegative(value.interval, `${path}.interval`);
  assertNonNegative(value.initialDelay, `${path}.initialDelay`);
  assertNonNegativeInteger(value.maxActive, `${path}.maxActive`);

  const enabled = value.maxActive > 0;
  if (enabled && (value.types.length === 0 || value.interval <= 0 || value.initialDelay <= 0)) {
    contentError(path, "enabled add pressure requires types, interval, and initialDelay");
  }
  if (!enabled && (value.types.length > 0 || value.interval !== 0 || value.initialDelay !== 0)) {
    contentError(path, "disabled add pressure must use empty types and zero timings");
  }
}

export function getBossPhaseDefinition(
  phase: BossPhase,
  definition: BossDefinition = MOTHERSHIP_BOSS,
): Readonly<BossPhaseDefinition> {
  const phaseDefinition = definition.phases.find((candidate) => candidate.phase === phase);
  if (phaseDefinition === undefined) {
    throw new RangeError(`Missing boss phase ${phase}`);
  }
  return phaseDefinition;
}

export function validateBossDefinitions(
  value: unknown = BOSS_DEFINITIONS,
): asserts value is BossDefinitions {
  assertRecord(value, "bosses");
  assertExactKeys(value, BOSS_IDS, "bosses");

  for (const id of BOSS_IDS) {
    const definition: unknown = value[id];
    const path = `bosses.${id}`;
    assertRecord(definition, path);
    assertExactKeys(definition, BOSS_FIELDS, path);

    assertPositive(definition.health, `${path}.health`);
    assertNonNegativeInteger(definition.score, `${path}.score`);
    assertPositive(definition.bombDamage, `${path}.bombDamage`);
    assertPositive(definition.coreRadius, `${path}.coreRadius`);
    assertPositive(definition.panelRadius, `${path}.panelRadius`);
    assertPositive(definition.panelWidth, `${path}.panelWidth`);
    assertPositiveInteger(definition.panelCount, `${path}.panelCount`);
    assertPositive(definition.transitionTime, `${path}.transitionTime`);

    if (definition.panelRadius <= definition.coreRadius) {
      contentError(
        `${path}.panelRadius`,
        "must be greater than coreRadius so shield panels remain outside the core",
      );
    }
    if (definition.panelWidth >= (Math.PI * 2) / definition.panelCount) {
      contentError(`${path}.panelWidth`, "must leave a visible gap between shield panels");
    }
    if (!Array.isArray(definition.phases) || definition.phases.length !== BOSS_PHASES.length) {
      contentError(`${path}.phases`, "expected exactly three phases");
    }

    let previousFloor = definition.health;
    for (const [index, phase] of definition.phases.entries()) {
      const phasePath = `${path}.phases[${index}]`;
      assertRecord(phase, phasePath);
      assertExactKeys(phase, PHASE_FIELDS, phasePath);
      if (phase.phase !== BOSS_PHASES[index]) {
        contentError(`${phasePath}.phase`, `expected phase ${BOSS_PHASES[index]}`);
      }
      assertString(phase.name, `${phasePath}.name`);
      assertNonNegative(phase.healthFloor, `${phasePath}.healthFloor`);
      assertPositive(phase.rotationSpeed, `${phasePath}.rotationSpeed`);
      if (phase.healthFloor >= previousFloor) {
        contentError(`${phasePath}.healthFloor`, "must descend from the previous phase boundary");
      }
      if (index === BOSS_PHASES.length - 1 && phase.healthFloor !== 0) {
        contentError(`${phasePath}.healthFloor`, "the final phase must end at zero health");
      }
      previousFloor = phase.healthFloor;
      validateShield(phase.shield, `${phasePath}.shield`);
      validateBeam(phase.beam, `${phasePath}.beam`);
      validateAdds(phase.adds, `${phasePath}.adds`);
    }
  }
}

validateBossDefinitions();
