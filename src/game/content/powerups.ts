export const POWER_UP_TYPES = ["twin", "shield", "bomb"] as const;
export type PowerUpType = (typeof POWER_UP_TYPES)[number];

export interface PowerUpDefinition {
  readonly id: PowerUpType;
}

export type PowerUpDefinitions = Readonly<Record<PowerUpType, Readonly<PowerUpDefinition>>>;

export interface PowerUpTuning {
  readonly baseDropChance: number;
  readonly thirdWaveDropChance: number;
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
  baseDropChance: 0.08,
  thirdWaveDropChance: 0.16,
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
    ["baseDropChance", "thirdWaveDropChance", "size", "radialSpeed", "weaponBoostDuration"],
    "powerups.tuning",
  );
  assertProbability(value.baseDropChance, "powerups.tuning.baseDropChance");
  assertProbability(value.thirdWaveDropChance, "powerups.tuning.thirdWaveDropChance");
  assertPositive(value.size, "powerups.tuning.size");
  assertPositive(value.radialSpeed, "powerups.tuning.radialSpeed");
  assertPositive(value.weaponBoostDuration, "powerups.tuning.weaponBoostDuration");

  if (value.thirdWaveDropChance < value.baseDropChance) {
    contentError("powerups.tuning.thirdWaveDropChance", "must not be lower than baseDropChance");
  }
}

validatePowerUpDefinitions();
validatePowerUpTuning();
