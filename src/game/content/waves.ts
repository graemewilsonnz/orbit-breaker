import { ENEMY_TYPES, isEnemyType, type EnemyType } from "./enemies";

export const WAVE_PATTERNS = ["sweep", "mirror", "fan", "random"] as const;
export type WavePattern = (typeof WAVE_PATTERNS)[number];

export const ENEMY_PRESSURE_COST = {
  drifter: 1,
  spiral: 1.5,
  mine: 2,
  shooter: 2,
  hunter: 2,
  shield: 3,
} as const satisfies Readonly<Record<EnemyType, number>>;

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
  readonly identity: string;
  readonly pressureBudget: number;
  readonly targetDuration: readonly [minimum: number, maximum: number];
  readonly recoveryBeats: readonly Readonly<{ at: number; duration: number }>[];
  readonly groups: readonly WaveGroup[];
}

export const WAVE_DEFINITIONS = [
  {
    name: "Wave 1: Trace the Ring",
    identity: "Learn the sweep, then breathe before the final pair.",
    pressureBudget: 9,
    targetDuration: [14, 22],
    recoveryBeats: [{ at: 5.2, duration: 3.1 }],
    groups: [
      { type: "drifter", count: 7, start: 0.85, interval: 0.72, pattern: "sweep", step: 0.68 },
      { type: "drifter", count: 2, start: 8.3, interval: 0.7, pattern: "mirror", step: 0.45 },
    ],
  },
  {
    name: "Wave 2: Crossing Lines",
    identity: "Read alternating lanes and reverse with intent.",
    pressureBudget: 17,
    targetDuration: [17, 25],
    recoveryBeats: [{ at: 6.0, duration: 5.0 }],
    groups: [
      { type: "drifter", count: 12, start: 0.65, interval: 0.48, pattern: "mirror", step: 0.5 },
      { type: "drifter", count: 5, start: 11, interval: 0.45, pattern: "fan", spread: 1.65 },
    ],
  },
  {
    name: "Wave 3: Spiral Introduction",
    identity: "Track curved approaches after a familiar opening.",
    pressureBudget: 19,
    targetDuration: [19, 28],
    recoveryBeats: [{ at: 4, duration: 6 }],
    groups: [
      { type: "drifter", count: 7, start: 0.4, interval: 0.5, pattern: "sweep", step: 0.55 },
      { type: "spiral", count: 8, start: 10, interval: 0.55, pattern: "fan", spread: 1.8 },
    ],
  },
  {
    name: "Wave 4: First Pressure Mix",
    identity: "Hold an escape route while Hunters commit.",
    pressureBudget: 24,
    targetDuration: [21, 30],
    recoveryBeats: [{ at: 8.2, duration: 6.8 }],
    groups: [
      { type: "drifter", count: 7, start: 0.4, interval: 0.46, pattern: "random" },
      { type: "spiral", count: 6, start: 5, interval: 0.6, pattern: "sweep", step: -0.7 },
      { type: "hunter", count: 4, start: 15, interval: 0.65, pattern: "mirror", step: 0.52 },
    ],
  },
  {
    name: "Wave 5: Minefield",
    identity: "Clear claimed arcs before the Drifter cross-current arrives.",
    pressureBudget: 24,
    targetDuration: [22, 31],
    recoveryBeats: [{ at: 5.2, duration: 6.8 }],
    groups: [
      { type: "mine", count: 7, start: 0.4, interval: 0.78, pattern: "sweep", step: 0.75 },
      { type: "drifter", count: 10, start: 12, interval: 0.55, pattern: "random" },
    ],
  },
  {
    name: "Wave 6: Crossfire",
    identity: "Break firing lanes, then punish Shooter recovery.",
    pressureBudget: 27,
    targetDuration: [24, 34],
    recoveryBeats: [{ at: 10.5, duration: 7.5 }],
    groups: [
      { type: "shooter", count: 5, start: 0.5, interval: 1.15, pattern: "fan", spread: 2.7 },
      { type: "drifter", count: 8, start: 7, interval: 0.48, pattern: "mirror", step: 0.48 },
      { type: "spiral", count: 6, start: 18, interval: 0.54, pattern: "random" },
    ],
  },
  {
    name: "Wave 7: Priority Targets",
    identity: "Remove protection before the Hunter collapse.",
    pressureBudget: 26,
    targetDuration: [25, 36],
    recoveryBeats: [{ at: 9.2, duration: 9.8 }],
    groups: [
      { type: "shield", count: 2, start: 0.5, interval: 3.5, pattern: "mirror", step: 0.0 },
      { type: "drifter", count: 10, start: 5, interval: 0.45, pattern: "fan", spread: 2.4 },
      { type: "hunter", count: 5, start: 19, interval: 0.7, pattern: "random" },
    ],
  },
  {
    name: "Wave 8: Final Mixed Wave",
    identity: "Master every threat in three escalating movements.",
    pressureBudget: 44,
    targetDuration: [28, 40],
    recoveryBeats: [
      { at: 5, duration: 3 },
      { at: 11, duration: 10 },
    ],
    groups: [
      { type: "drifter", count: 8, start: 0.35, interval: 0.45, pattern: "sweep", step: 0.5 },
      { type: "spiral", count: 6, start: 1.4, interval: 0.55, pattern: "mirror", step: 0.4 },
      { type: "mine", count: 4, start: 8, interval: 0.85, pattern: "fan", spread: 2.2 },
      { type: "shooter", count: 3, start: 9, interval: 0.9, pattern: "random" },
      { type: "hunter", count: 5, start: 21, interval: 0.65, pattern: "random" },
      { type: "shield", count: 1, start: 22.5, interval: 1.0, pattern: "random" },
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
    assertExactKeys(
      definition,
      ["name", "identity", "pressureBudget", "targetDuration", "recoveryBeats", "groups"],
      wavePath,
    );

    if (typeof definition.name !== "string" || definition.name.trim() === "") {
      contentError(`${wavePath}.name`, "expected a non-empty string");
    }
    if (names.has(definition.name)) {
      contentError(`${wavePath}.name`, `duplicate name ${JSON.stringify(definition.name)}`);
    }
    names.add(definition.name);

    if (typeof definition.identity !== "string" || definition.identity.trim() === "") {
      contentError(`${wavePath}.identity`, "expected a non-empty string");
    }
    assertPositive(definition.pressureBudget, `${wavePath}.pressureBudget`);
    if (!Array.isArray(definition.targetDuration) || definition.targetDuration.length !== 2) {
      contentError(`${wavePath}.targetDuration`, "expected [minimum, maximum]");
    }
    const minimumDuration: unknown = definition.targetDuration[0];
    const maximumDuration: unknown = definition.targetDuration[1];
    assertPositive(minimumDuration, `${wavePath}.targetDuration[0]`);
    assertPositive(maximumDuration, `${wavePath}.targetDuration[1]`);
    if (minimumDuration >= maximumDuration) {
      contentError(`${wavePath}.targetDuration`, "minimum must be lower than maximum");
    }

    const recoveryBeats: unknown = definition.recoveryBeats;
    if (!Array.isArray(recoveryBeats) || recoveryBeats.length === 0) {
      contentError(`${wavePath}.recoveryBeats`, "expected at least one recovery beat");
    }
    let previousRecoveryEnd = 0;
    for (let recoveryIndex = 0; recoveryIndex < recoveryBeats.length; recoveryIndex += 1) {
      const recovery: unknown = recoveryBeats[recoveryIndex];
      const recoveryPath = `${wavePath}.recoveryBeats[${recoveryIndex}]`;
      assertRecord(recovery, recoveryPath);
      assertExactKeys(recovery, ["at", "duration"], recoveryPath);
      assertNonNegative(recovery.at, `${recoveryPath}.at`);
      assertPositive(recovery.duration, `${recoveryPath}.duration`);
      if (recovery.at < previousRecoveryEnd) {
        contentError(recoveryPath, "must not overlap an earlier recovery beat");
      }
      previousRecoveryEnd = recovery.at + recovery.duration;
    }

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

    const authoredPressure = groups.reduce((total, group) => {
      assertRecord(group, `${wavePath}.groups`);
      if (!isEnemyType(group.type) || typeof group.count !== "number") {
        return total;
      }
      return total + ENEMY_PRESSURE_COST[group.type] * group.count;
    }, 0);
    if (definition.pressureBudget !== authoredPressure) {
      contentError(
        `${wavePath}.pressureBudget`,
        `expected authored group cost ${authoredPressure}, received ${String(definition.pressureBudget)}`,
      );
    }

    for (const recovery of recoveryBeats) {
      assertRecord(recovery, `${wavePath}.recoveryBeats`);
      if (typeof recovery.at !== "number" || typeof recovery.duration !== "number") {
        continue;
      }
      const recoveryEnd = recovery.at + recovery.duration;
      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        const group = groups[groupIndex];
        assertRecord(group, `${wavePath}.groups[${groupIndex}]`);
        if (
          typeof group.start !== "number" ||
          typeof group.interval !== "number" ||
          typeof group.count !== "number"
        ) {
          continue;
        }
        for (let spawnIndex = 0; spawnIndex < group.count; spawnIndex += 1) {
          const spawnTime = group.start + group.interval * spawnIndex;
          if (spawnTime >= recovery.at && spawnTime < recoveryEnd) {
            contentError(
              `${wavePath}.recoveryBeats`,
              `spawn at ${spawnTime} overlaps recovery ${recovery.at}-${recoveryEnd}`,
            );
          }
        }
      }
    }
  }
}

export function wavePressureCost(definition: WaveDefinition): number {
  return definition.groups.reduce(
    (total, group) => total + ENEMY_PRESSURE_COST[group.type] * group.count,
    0,
  );
}

validateWaveDefinitions();
