import { ENEMY_TYPES, isEnemyType, type EnemyType } from "./enemies";

export const WAVE_PATTERNS = ["sweep", "mirror", "fan", "random"] as const;
export type WavePattern = (typeof WAVE_PATTERNS)[number];

interface WaveGroupBase {
  readonly type: EnemyType;
  readonly count: number;
  readonly start: number;
  readonly interval: number;
}

export type WaveGroup =
  | (WaveGroupBase & {
      readonly pattern: "sweep" | "mirror";
      readonly step: number;
      readonly spread?: never;
    })
  | (WaveGroupBase & {
      readonly pattern: "fan";
      readonly spread: number;
      readonly step?: never;
    })
  | (WaveGroupBase & {
      readonly pattern: "random";
      readonly step?: never;
      readonly spread?: never;
    });

export interface WaveDefinition {
  readonly name: string;
  readonly groups: readonly WaveGroup[];
}

export const WAVE_DEFINITIONS = [
  {
    name: "Wave 1: Trace the Ring",
    groups: [
      { type: "drifter", count: 9, start: 0.85, interval: 0.82, pattern: "sweep", step: 0.68 },
    ],
  },
  {
    name: "Wave 2: Crossing Lines",
    groups: [
      { type: "drifter", count: 12, start: 0.65, interval: 0.46, pattern: "mirror", step: 0.5 },
      { type: "drifter", count: 5, start: 6.25, interval: 0.58, pattern: "fan", spread: 1.65 },
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
] as const satisfies readonly WaveDefinition[];

export const WAVE_COUNT = 8;

function contentError(path: string, message: string): never {
  throw new Error(`Invalid wave content at ${path}: ${message}`);
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

function assertNonNegative(value: unknown, path: string): asserts value is number {
  assertFiniteNumber(value, path);
  if (value < 0) {
    contentError(path, "must not be negative");
  }
}

function assertPositive(value: unknown, path: string): asserts value is number {
  assertFiniteNumber(value, path);
  if (value <= 0) {
    contentError(path, "must be greater than zero");
  }
}

function isWavePattern(value: unknown): value is WavePattern {
  return typeof value === "string" && WAVE_PATTERNS.some((pattern) => pattern === value);
}

export function validateWaveDefinitions(
  value: unknown = WAVE_DEFINITIONS,
): asserts value is readonly WaveDefinition[] {
  if (!Array.isArray(value)) {
    contentError("waves", "expected an array");
  }
  if (value.length !== WAVE_COUNT) {
    contentError("waves", `expected ${WAVE_COUNT} waves, received ${value.length}`);
  }

  const names = new Set<string>();
  for (let waveIndex = 0; waveIndex < value.length; waveIndex += 1) {
    const definition: unknown = value[waveIndex];
    const wavePath = `waves[${waveIndex}]`;
    assertRecord(definition, wavePath);
    assertExactKeys(definition, ["name", "groups"], wavePath);

    if (typeof definition.name !== "string" || definition.name.trim() === "") {
      contentError(`${wavePath}.name`, "expected a non-empty string");
    }
    if (names.has(definition.name)) {
      contentError(`${wavePath}.name`, `duplicate name ${JSON.stringify(definition.name)}`);
    }
    names.add(definition.name);

    const groups: unknown = definition.groups;
    if (!Array.isArray(groups) || groups.length === 0) {
      contentError(`${wavePath}.groups`, "expected at least one group");
    }

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group: unknown = groups[groupIndex];
      const groupPath = `${wavePath}.groups[${groupIndex}]`;
      assertRecord(group, groupPath);

      const pattern: unknown = group.pattern;
      if (!isWavePattern(pattern)) {
        contentError(`${groupPath}.pattern`, `expected one of ${WAVE_PATTERNS.join(", ")}`);
      }

      const patternField = pattern === "fan" ? "spread" : pattern === "random" ? null : "step";
      assertExactKeys(
        group,
        ["type", "count", "start", "interval", "pattern", ...(patternField ? [patternField] : [])],
        groupPath,
      );

      if (!isEnemyType(group.type)) {
        contentError(`${groupPath}.type`, `expected one of ${ENEMY_TYPES.join(", ")}`);
      }
      assertPositive(group.count, `${groupPath}.count`);
      if (!Number.isInteger(group.count)) {
        contentError(`${groupPath}.count`, "must be an integer");
      }
      assertNonNegative(group.start, `${groupPath}.start`);
      assertPositive(group.interval, `${groupPath}.interval`);

      if (patternField === "step") {
        assertFiniteNumber(group.step, `${groupPath}.step`);
      } else if (patternField === "spread") {
        assertPositive(group.spread, `${groupPath}.spread`);
      }
    }
  }
}

validateWaveDefinitions();
