export const POWER_UP_TYPES = ["twin", "shield", "bomb"] as const;
export type PowerUpType = (typeof POWER_UP_TYPES)[number];

export interface PowerUpDefinition {
  readonly id: PowerUpType;
}

export type PowerUpDefinitions = Readonly<Record<PowerUpType, Readonly<PowerUpDefinition>>>;

export interface PowerUpTuning {
  readonly waveDropChances: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  readonly pityKills: number;
  readonly maxDropsPerWave: number;
  readonly maxActiveDrops: number;
  readonly size: number;
  readonly radialSpeed: number;
  readonly weaponBoostDuration: number;
}

export const POWER_UP_DEFINITIONS = {
  twin: { id: "twin" },
  shield: { id: "shield" },
  bomb: { id: "bomb" },
} as const satisfies PowerUpDefinitions;

export const POWER_UP_CONFIG = {
  waveDropChances: [0.06, 0.07, 0.13, 0.08, 0.1, 0.14, 0.1, 0.12],
  pityKills: 10,
  maxDropsPerWave: 2,
  maxActiveDrops: 2,
  size: 14,
  radialSpeed: 34,
  weaponBoostDuration: 18,
} as const satisfies PowerUpTuning;

export const POWERUP_TYPES = POWER_UP_TYPES;
export const POWERUP_DEFINITIONS = POWER_UP_DEFINITIONS;
export const POWERUP_CONFIG = POWER_UP_CONFIG;

function contentError(path: string, message: string): never {
  throw new Error(`Invalid power-up content at ${path}: ${message}`);
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

function assertProbability(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    contentError(path, "expected a probability from 0 through 1");
  }
}

function assertPositive(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    contentError(path, "expected a finite number greater than zero");
  }
}

export function isPowerUpType(value: unknown): value is PowerUpType {
  return typeof value === "string" && POWER_UP_TYPES.some((type) => type === value);
}

export function validatePowerUpDefinitions(
  value: unknown = POWER_UP_DEFINITIONS,
): asserts value is PowerUpDefinitions {
  assertRecord(value, "powerups.definitions");
  assertExactKeys(value, POWER_UP_TYPES, "powerups.definitions");

  for (const type of POWER_UP_TYPES) {
    const definition: unknown = value[type];
    const path = `powerups.definitions.${type}`;
    assertRecord(definition, path);
    assertExactKeys(definition, ["id"], path);
    if (definition.id !== type) {
      contentError(`${path}.id`, `expected ${JSON.stringify(type)}`);
    }
  }
}

export function validatePowerUpTuning(
  value: unknown = POWER_UP_CONFIG,
): asserts value is PowerUpTuning {
  assertRecord(value, "powerups.tuning");
  assertExactKeys(
    value,
    [
      "waveDropChances",
      "pityKills",
      "maxDropsPerWave",
      "maxActiveDrops",
      "size",
      "radialSpeed",
      "weaponBoostDuration",
    ],
    "powerups.tuning",
  );
  if (!Array.isArray(value.waveDropChances) || value.waveDropChances.length !== 8) {
    contentError("powerups.tuning.waveDropChances", "expected one chance for each of eight waves");
  }
  value.waveDropChances.forEach((chance, index) =>
    assertProbability(chance, `powerups.tuning.waveDropChances[${index}]`),
  );
  assertPositiveInteger(value.pityKills, "powerups.tuning.pityKills");
  assertPositiveInteger(value.maxDropsPerWave, "powerups.tuning.maxDropsPerWave");
  assertPositiveInteger(value.maxActiveDrops, "powerups.tuning.maxActiveDrops");
  assertPositive(value.size, "powerups.tuning.size");
  assertPositive(value.radialSpeed, "powerups.tuning.radialSpeed");
  assertPositive(value.weaponBoostDuration, "powerups.tuning.weaponBoostDuration");
}

function assertPositiveInteger(value: unknown, path: string): asserts value is number {
  assertPositive(value, path);
  if (!Number.isInteger(value)) {
    contentError(path, "expected a positive integer");
  }
}

validatePowerUpDefinitions();
validatePowerUpTuning();
