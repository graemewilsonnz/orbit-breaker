import { describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES,
  HIGH_SCORE_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  loadHighScore,
  loadPreferences,
  normalizePreferences,
  saveHighScore,
  savePreferences,
  type PreferenceStorage,
} from "../../src/app/preferences";

describe("M5 persisted preferences", () => {
  it("loads safe defaults when storage is absent, invalid, or blocked", () => {
    expect(loadPreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences(memoryStorage({ [PREFERENCES_STORAGE_KEY]: "{bad json" }))).toEqual(
      DEFAULT_PREFERENCES,
    );
    expect(
      loadPreferences({
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => undefined,
      }),
    ).toEqual(DEFAULT_PREFERENCES);
  });

  it("normalizes every persisted mixer and accessibility value", () => {
    expect(
      normalizePreferences({
        masterVolume: 5,
        musicVolume: -2,
        effectsVolume: 0.35,
        muted: true,
        reducedShake: true,
      }),
    ).toEqual({
      masterVolume: 1,
      musicVolume: 0,
      effectsVolume: 0.35,
      muted: true,
      reducedShake: true,
    });
  });

  it("round-trips preferences and a non-negative integer high score", () => {
    const storage = memoryStorage();
    const preferences = {
      masterVolume: 0.6,
      musicVolume: 0.25,
      effectsVolume: 0.9,
      muted: true,
      reducedShake: true,
    };

    savePreferences(storage, preferences);
    saveHighScore(storage, 12_345.9);

    expect(loadPreferences(storage)).toEqual(preferences);
    expect(loadHighScore(storage)).toBe(12_345);
    expect(storage.values.get(HIGH_SCORE_STORAGE_KEY)).toBe("12345");
  });
});

function memoryStorage(initial: Readonly<Record<string, string>> = {}): PreferenceStorage & {
  readonly values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
