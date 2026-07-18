export const ENEMY_TYPES = ["drifter", "spiral", "mine", "shooter", "hunter", "shield"] as const;

export type EnemyType = (typeof ENEMY_TYPES)[number];
export type NumberRange = readonly [minimum: number, maximum: number];
export type TunableNumber = number | NumberRange;

export interface BaseEnemyDefinition {
  readonly health: number;
  readonly radialSpeed: TunableNumber;
  readonly size: number;
  readonly score: number;
}

export interface SpiralEnemyDefinition extends BaseEnemyDefinition {
  readonly angularVelocity: NumberRange;
}

export interface MineEnemyDefinition extends BaseEnemyDefinition {
  readonly claimRadius: number;
  readonly warningTime: number;
  readonly holdTime: number;
  readonly releaseSpeed: number;
  readonly dangerRadius: number;
}

export interface ShooterEnemyDefinition extends BaseEnemyDefinition {
  readonly fireRadius: NumberRange;
  readonly fireCooldown: NumberRange;
  readonly warningTime: number;
  readonly aimTurnRate: number;
  readonly driftSpeed: number;
}

export interface HunterEnemyDefinition extends BaseEnemyDefinition {
  readonly turnRate: NumberRange;
  readonly lockRadius: number;
  readonly warningTime: number;
  readonly lungeSpeed: number;
}

export interface ShieldEnemyDefinition extends BaseEnemyDefinition {
  readonly shieldRadius: number;
}

export interface EnemyDefinitionByType {
  readonly drifter: BaseEnemyDefinition;
  readonly spiral: SpiralEnemyDefinition;
  readonly mine: MineEnemyDefinition;
  readonly shooter: ShooterEnemyDefinition;
  readonly hunter: HunterEnemyDefinition;
  readonly shield: ShieldEnemyDefinition;
}

export type EnemyDefinition = EnemyDefinitionByType[EnemyType];
export type EnemyDefinitions = Readonly<EnemyDefinitionByType>;

export const ENEMY_DEFINITIONS = {
  drifter: {
    health: 1,
    radialSpeed: [55, 75],
    size: 13,
    score: 100,
  },
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
} as const satisfies EnemyDefinitions;

const COMMON_FIELDS = ["health", "radialSpeed", "size", "score"] as const;

const SPECIAL_FIELDS = {
  drifter: [],
  spiral: ["angularVelocity"],
  mine: ["claimRadius", "warningTime", "holdTime", "releaseSpeed", "dangerRadius"],
  shooter: ["fireRadius", "fireCooldown", "warningTime", "aimTurnRate", "driftSpeed"],
  hunter: ["turnRate", "lockRadius", "warningTime", "lungeSpeed"],
  shield: ["shieldRadius"],
} as const satisfies Readonly<Record<EnemyType, readonly string[]>>;

function contentError(path: string, message: string): never {
  throw new Error(`Invalid enemy content at ${path}: ${message}`);
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

function assertFiniteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    contentError(path, "expected a finite number");
  }
}

function assertPositive(value: unknown, path: string): asserts value is number {
  assertFiniteNumber(value, path);
  if (value <= 0) {
    contentError(path, "must be greater than zero");
  }
}

function assertPositiveInteger(value: unknown, path: string): asserts value is number {
  assertPositive(value, path);
  if (!Number.isInteger(value)) {
    contentError(path, "must be an integer");
  }
}

function assertPositiveRange(value: unknown, path: string): asserts value is NumberRange {
  if (!Array.isArray(value) || value.length !== 2) {
    contentError(path, "expected a [minimum, maximum] pair");
  }

  const minimum: unknown = value[0];
  const maximum: unknown = value[1];
  assertPositive(minimum, `${path}[0]`);
  assertPositive(maximum, `${path}[1]`);
  if (minimum > maximum) {
    contentError(path, "minimum must not exceed maximum");
  }
}

function assertPositiveTunable(value: unknown, path: string): asserts value is TunableNumber {
  if (Array.isArray(value)) {
    assertPositiveRange(value, path);
    return;
  }
  assertPositive(value, path);
}

export function isEnemyType(value: unknown): value is EnemyType {
  return typeof value === "string" && ENEMY_TYPES.some((type) => type === value);
}

export function validateEnemyDefinitions(
  value: unknown = ENEMY_DEFINITIONS,
): asserts value is EnemyDefinitions {
  assertRecord(value, "enemies");
  assertExactKeys(value, ENEMY_TYPES, "enemies");

  for (const type of ENEMY_TYPES) {
    const definition: unknown = value[type];
    const path = `enemies.${type}`;
    assertRecord(definition, path);
    assertExactKeys(definition, [...COMMON_FIELDS, ...SPECIAL_FIELDS[type]], path);
    assertPositiveInteger(definition.health, `${path}.health`);
    assertPositiveTunable(definition.radialSpeed, `${path}.radialSpeed`);
    assertPositive(definition.size, `${path}.size`);
    assertPositiveInteger(definition.score, `${path}.score`);

    if (type === "spiral") {
      assertPositiveRange(definition.angularVelocity, `${path}.angularVelocity`);
    } else if (type === "mine") {
      assertPositive(definition.claimRadius, `${path}.claimRadius`);
      assertPositive(definition.warningTime, `${path}.warningTime`);
      assertPositive(definition.holdTime, `${path}.holdTime`);
      assertPositive(definition.releaseSpeed, `${path}.releaseSpeed`);
      assertPositive(definition.dangerRadius, `${path}.dangerRadius`);
    } else if (type === "shooter") {
      assertPositiveRange(definition.fireRadius, `${path}.fireRadius`);
      assertPositiveRange(definition.fireCooldown, `${path}.fireCooldown`);
      assertPositive(definition.warningTime, `${path}.warningTime`);
      assertPositive(definition.aimTurnRate, `${path}.aimTurnRate`);
      assertPositive(definition.driftSpeed, `${path}.driftSpeed`);
    } else if (type === "hunter") {
      assertPositiveRange(definition.turnRate, `${path}.turnRate`);
      assertPositive(definition.lockRadius, `${path}.lockRadius`);
      assertPositive(definition.warningTime, `${path}.warningTime`);
      assertPositive(definition.lungeSpeed, `${path}.lungeSpeed`);
    } else if (type === "shield") {
      assertPositive(definition.shieldRadius, `${path}.shieldRadius`);
    }
  }
}

validateEnemyDefinitions();
