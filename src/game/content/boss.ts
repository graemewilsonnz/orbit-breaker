export const BOSS_IDS = ["mothership"] as const;
export type BossId = (typeof BOSS_IDS)[number];
export type BossPhase = 1 | 2 | 3;

export interface BossDefinition {
  readonly health: number;
  readonly rotationSpeed: number;
  readonly phase2Threshold: number;
  readonly phase3Threshold: number;
  readonly score: number;
  readonly coreRadius: number;
  readonly panelRadius: number;
  readonly panelWidth: number;
  readonly warningTime: number;
  readonly beamTime: number;
}

export type BossDefinitions = Readonly<Record<BossId, Readonly<BossDefinition>>>;

export const BOSS_DEFINITIONS = {
  mothership: {
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
} as const satisfies BossDefinitions;

export const MOTHERSHIP_BOSS = BOSS_DEFINITIONS.mothership;

const BOSS_FIELDS = [
  "health",
  "rotationSpeed",
  "phase2Threshold",
  "phase3Threshold",
  "score",
  "coreRadius",
  "panelRadius",
  "panelWidth",
  "warningTime",
  "beamTime",
] as const;

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

function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    contentError(path, "expected a non-negative integer");
  }
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
    assertPositive(definition.rotationSpeed, `${path}.rotationSpeed`);
    assertPositive(definition.phase2Threshold, `${path}.phase2Threshold`);
    assertPositive(definition.phase3Threshold, `${path}.phase3Threshold`);
    assertNonNegativeInteger(definition.score, `${path}.score`);
    assertPositive(definition.coreRadius, `${path}.coreRadius`);
    assertPositive(definition.panelRadius, `${path}.panelRadius`);
    assertPositive(definition.panelWidth, `${path}.panelWidth`);
    assertPositive(definition.warningTime, `${path}.warningTime`);
    assertPositive(definition.beamTime, `${path}.beamTime`);

    if (
      definition.phase2Threshold >= definition.health ||
      definition.phase3Threshold >= definition.phase2Threshold
    ) {
      contentError(
        path,
        "phase thresholds must satisfy health > phase2Threshold > phase3Threshold",
      );
    }
    if (definition.panelRadius <= definition.coreRadius) {
      contentError(
        `${path}.panelRadius`,
        "must be greater than coreRadius so shield panels remain outside the core",
      );
    }
    if (definition.panelWidth >= Math.PI * 2) {
      contentError(`${path}.panelWidth`, "must be less than a full rotation");
    }
  }
}

validateBossDefinitions();
