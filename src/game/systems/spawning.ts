import { WAVE_DEFINITIONS, type WaveDefinition, type WaveGroup } from "../content/waves";
import { TAU, normalizeAngle } from "../core/geometry";
import type { RandomSource } from "../core/rng";
import type { EnemyType } from "../content/enemies";
import type { WaveRuntimeState, WaveSpawnState } from "../state";

export const WAVE_COMPLETION_DELAY_SECONDS = 0.8;
export const WAVE_ANTI_STALL_GRACE_SECONDS = 8;

export interface WaveUpdateCallbacks {
  readonly bossActive: boolean;
  readonly enemyCount: number;
  readonly spawnEnemy: (type: EnemyType, angle: number) => void;
  readonly completeWave: () => void;
  readonly resolveStalledEnemies: () => void;
}

/**
 * Expands authored wave groups into the chronological queue consumed at runtime.
 * A base-angle draw is retained for every group, including random groups, to keep
 * seeded runs compatible with the legacy generator's random-call ordering.
 */
export function buildSpawnQueue(
  definition: WaveDefinition,
  random: RandomSource,
): WaveSpawnState[] {
  const queue: WaveSpawnState[] = [];

  for (const group of definition.groups) {
    const base = random.next() * TAU;
    for (let index = 0; index < group.count; index += 1) {
      queue.push({
        type: group.type,
        time: group.start + group.interval * index,
        angle: angleFor(group, index, base, random),
      });
    }
  }

  // Array.prototype.sort is stable: equal-time events keep authored group order.
  queue.sort((left, right) => left.time - right.time);
  return queue;
}

export function angleFor(
  group: WaveGroup,
  index: number,
  base: number,
  random: RandomSource,
): number {
  switch (group.pattern) {
    case "sweep":
      return normalizeAngle(base + index * group.step);
    case "mirror":
      return normalizeAngle(
        base + Math.floor(index / 2) * group.step + (index % 2 === 1 ? Math.PI : 0),
      );
    case "fan": {
      const progress = group.count <= 1 ? 0.5 : index / (group.count - 1);
      return normalizeAngle(base - group.spread * 0.5 + group.spread * progress);
    }
    case "random":
      return random.next() * TAU;
  }
}

export function startWave(wave: WaveRuntimeState, waveNumber: number, random: RandomSource): void {
  const definition: WaveDefinition | undefined = WAVE_DEFINITIONS[waveNumber - 1];
  if (definition === undefined) {
    throw new RangeError(`waveNumber must be between 1 and ${WAVE_DEFINITIONS.length}`);
  }

  wave.waveNumber = waveNumber;
  wave.definition = definition;
  wave.queue = buildSpawnQueue(definition, random);
  wave.elapsed = 0;
  wave.completeDelay = 0;
  wave.dropsAwarded = 0;
  wave.killsSinceDrop = 0;
  wave.antiStallTriggered = false;
}

export function updateWave(
  wave: WaveRuntimeState,
  dt: number,
  callbacks: WaveUpdateCallbacks,
): void {
  if (wave.definition === null || callbacks.bossActive) {
    return;
  }

  wave.elapsed += dt;
  let spawnedEnemy = false;
  while (wave.queue.length > 0) {
    const event = wave.queue[0];
    if (event === undefined || event.time > wave.elapsed) {
      break;
    }
    wave.queue.shift();
    callbacks.spawnEnemy(event.type, event.angle);
    spawnedEnemy = true;
  }

  const hardDeadline = wave.definition.targetDuration[1] + WAVE_ANTI_STALL_GRACE_SECONDS;
  if (
    wave.queue.length === 0 &&
    callbacks.enemyCount > 0 &&
    wave.elapsed >= hardDeadline &&
    !wave.antiStallTriggered
  ) {
    wave.antiStallTriggered = true;
    callbacks.resolveStalledEnemies();
  }

  if (wave.queue.length === 0 && callbacks.enemyCount === 0 && !spawnedEnemy) {
    wave.completeDelay += dt;
    if (wave.completeDelay >= WAVE_COMPLETION_DELAY_SECONDS) {
      callbacks.completeWave();
    }
  } else {
    wave.completeDelay = 0;
  }
}
