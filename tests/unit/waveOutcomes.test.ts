import { describe, expect, it } from "vitest";

import {
  createWaveStats,
  deriveWaveOutcome,
  type WaveOutcome,
  type WaveStats,
} from "../../src/game/waveOutcomes";

interface OutcomeCase {
  readonly name: string;
  readonly stats: Partial<WaveStats>;
  readonly survived: boolean;
  readonly expected: WaveOutcome;
}

const OUTCOME_CASES = [
  {
    name: "awards every outcome for a surviving no-damage full clear",
    stats: { requiredEnemiesSpawned: 3, enemiesDestroyed: 3 },
    survived: true,
    expected: { waveClear: true, noDamage: true, fullClear: true, perfect: true },
  },
  {
    name: "keeps Wave Clear and Flawless when one required enemy escapes",
    stats: { requiredEnemiesSpawned: 3, enemiesDestroyed: 2, enemiesEscaped: 1 },
    survived: true,
    expected: { waveClear: true, noDamage: true, fullClear: false, perfect: false },
  },
  {
    name: "rejects Flawless, Full Clear, and Perfect after a damaging breach",
    stats: {
      requiredEnemiesSpawned: 3,
      enemiesDestroyed: 2,
      enemiesBreached: 1,
      playerDamaged: true,
    },
    survived: true,
    expected: { waveClear: true, noDamage: false, fullClear: false, perfect: false },
  },
  {
    name: "keeps Flawless but rejects Full Clear after an absorbed breach",
    stats: { requiredEnemiesSpawned: 1, enemiesBreached: 1 },
    survived: true,
    expected: { waveClear: true, noDamage: true, fullClear: false, perfect: false },
  },
  {
    name: "allows bomb destructions in Full Clear but not Perfect",
    stats: {
      requiredEnemiesSpawned: 2,
      enemiesDestroyed: 2,
      enemiesKilledByBomb: 2,
      bombUsed: true,
    },
    survived: true,
    expected: { waveClear: true, noDamage: true, fullClear: true, perfect: false },
  },
  {
    name: "rejects Full Clear when a required enemy has no accountable resolution",
    stats: { requiredEnemiesSpawned: 2, enemiesDestroyed: 1 },
    survived: true,
    expected: { waveClear: true, noDamage: true, fullClear: false, perfect: false },
  },
  {
    name: "requires exact destruction accounting rather than accepting over-counts",
    stats: { requiredEnemiesSpawned: 1, enemiesDestroyed: 2 },
    survived: true,
    expected: { waveClear: true, noDamage: true, fullClear: false, perfect: false },
  },
  {
    name: "rejects Wave Clear and Perfect when the player did not survive",
    stats: { requiredEnemiesSpawned: 1, enemiesDestroyed: 1, playerDamaged: true },
    survived: false,
    expected: { waveClear: false, noDamage: false, fullClear: true, perfect: false },
  },
] as const satisfies readonly OutcomeCase[];

describe("wave outcome derivation", () => {
  it("creates independent zeroed statistics for each wave", () => {
    const first = createWaveStats();
    const second = createWaveStats();

    first.requiredEnemiesSpawned = 4;
    first.playerDamaged = true;

    expect(first).not.toBe(second);
    expect(second).toEqual({
      requiredEnemiesSpawned: 0,
      enemiesDestroyed: 0,
      enemiesKilledByBomb: 0,
      enemiesBreached: 0,
      enemiesEscaped: 0,
      playerDamaged: false,
      bombUsed: false,
    });
  });

  it.each(OUTCOME_CASES)("$name", ({ stats, survived, expected }) => {
    const completeStats = { ...createWaveStats(), ...stats };

    expect(deriveWaveOutcome(completeStats, survived)).toEqual(expected);
  });

  it("derives without mutating the supplied statistics", () => {
    const stats = {
      ...createWaveStats(),
      requiredEnemiesSpawned: 2,
      enemiesDestroyed: 2,
    };
    const before = { ...stats };

    deriveWaveOutcome(stats, true);

    expect(stats).toEqual(before);
  });
});
