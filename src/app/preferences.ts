export interface PlayerPreferences {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly muted: boolean;
  readonly reducedShake: boolean;
}

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PREFERENCES_STORAGE_KEY = "orbit-breaker.preferences.v1";
export const HIGH_SCORE_STORAGE_KEY = "orbit-breaker.high-score.v1";

export const DEFAULT_PREFERENCES: PlayerPreferences = Object.freeze({
  masterVolume: 0.8,
  musicVolume: 0.42,
  effectsVolume: 0.78,
  muted: false,
  reducedShake: false,
});

export function loadPreferences(
  storage: PreferenceStorage | null | undefined,
  defaults: PlayerPreferences = DEFAULT_PREFERENCES,
): PlayerPreferences {
  if (storage === null || storage === undefined) {
    return { ...defaults };
  }

  try {
    const stored = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (stored === null) {
      return { ...defaults };
    }
    return normalizePreferences(JSON.parse(stored), defaults);
  } catch {
    return { ...defaults };
  }
}

export function savePreferences(
  storage: PreferenceStorage | null | undefined,
  preferences: PlayerPreferences,
): void {
  if (storage === null || storage === undefined) {
    return;
  }

  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)));
  } catch {
    // Storage can be unavailable in privacy modes. Settings still apply for the session.
  }
}

export function loadHighScore(storage: PreferenceStorage | null | undefined): number {
  if (storage === null || storage === undefined) {
    return 0;
  }

  try {
    return normalizeScore(Number(storage.getItem(HIGH_SCORE_STORAGE_KEY)));
  } catch {
    return 0;
  }
}

export function saveHighScore(
  storage: PreferenceStorage | null | undefined,
  highScore: number,
): void {
  if (storage === null || storage === undefined) {
    return;
  }

  try {
    storage.setItem(HIGH_SCORE_STORAGE_KEY, String(normalizeScore(highScore)));
  } catch {
    // A failed persistence write must never interrupt a run.
  }
}

export function normalizePreferences(
  value: unknown,
  defaults: PlayerPreferences = DEFAULT_PREFERENCES,
): PlayerPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...defaults };
  }

  const candidate = value as Partial<Record<keyof PlayerPreferences, unknown>>;
  return {
    masterVolume: normalizeVolume(candidate.masterVolume, defaults.masterVolume),
    musicVolume: normalizeVolume(candidate.musicVolume, defaults.musicVolume),
    effectsVolume: normalizeVolume(candidate.effectsVolume, defaults.effectsVolume),
    muted: normalizeBoolean(candidate.muted, defaults.muted),
    reducedShake: normalizeBoolean(candidate.reducedShake, defaults.reducedShake),
  };
}

function normalizeVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeScore(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
