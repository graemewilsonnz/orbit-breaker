export interface WaveStats {
  requiredEnemiesSpawned: number;
  enemiesDestroyed: number;
  enemiesKilledByBomb: number;
  enemiesBreached: number;
  enemiesEscaped: number;
  playerDamaged: boolean;
  bombUsed: boolean;
}

export interface WaveOutcome {
  waveClear: boolean;
  noDamage: boolean;
  fullClear: boolean;
  perfect: boolean;
}

export function createWaveStats(): WaveStats {
  return {
    requiredEnemiesSpawned: 0,
    enemiesDestroyed: 0,
    enemiesKilledByBomb: 0,
    enemiesBreached: 0,
    enemiesEscaped: 0,
    playerDamaged: false,
    bombUsed: false,
  };
}

export function deriveWaveOutcome(stats: Readonly<WaveStats>, survived: boolean): WaveOutcome {
  const waveClear = survived;
  const noDamage = !stats.playerDamaged;
  const fullClear =
    stats.enemiesDestroyed === stats.requiredEnemiesSpawned &&
    stats.enemiesBreached === 0 &&
    stats.enemiesEscaped === 0;

  return {
    waveClear,
    noDamage,
    fullClear,
    perfect: waveClear && noDamage && fullClear && !stats.bombUsed,
  };
}
