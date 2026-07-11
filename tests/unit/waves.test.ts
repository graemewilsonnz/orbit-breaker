import { describe, expect, it, vi } from "vitest";

import { WAVE_DEFINITIONS, type WaveDefinition } from "../../src/game/content/waves";
import { SeededRng } from "../../src/game/core/rng";
import type { WaveRuntimeState } from "../../src/game/state";
import {
  WAVE_COMPLETION_DELAY_SECONDS,
  angleFor,
  buildSpawnQueue,
  startWave,
  updateWave,
  type WaveUpdateCallbacks,
} from "../../src/game/systems/spawning";

const CANONICAL_WAVE_TIMINGS = [
  { count: 10, first: 0.5, last: 6.08 },
  { count: 16, first: 0.4, last: 6.14 },
  { count: 15, first: 0.4, last: 6.4 },
  { count: 17, first: 0.4, last: 6.96 },
  { count: 17, first: 0.4, last: 6.52 },
  { count: 19, first: 0.5, last: 6.9 },
  { count: 17, first: 0.5, last: 7.1 },
  { count: 27, first: 0.35, last: 7.64 },
] as const;

describe("wave spawn queues", () => {
  it("preserves the canonical event counts and time bounds", () => {
    const queues = WAVE_DEFINITIONS.map((definition, index) => {
      const queue = buildSpawnQueue(definition, new SeededRng(`wave-${index + 1}`));
      const expected = required(CANONICAL_WAVE_TIMINGS[index], `timing ${index}`);

      expect(queue).toHaveLength(expected.count);
      expect(required(queue[0], "first event").time).toBeCloseTo(expected.first);
      expect(required(queue.at(-1), "last event").time).toBeCloseTo(expected.last);
      expect(queue.map((event) => event.time)).toEqual(
        queue
          .map((event) => event.time)
          .slice()
          .sort((left, right) => left - right),
      );
      return queue;
    });

    expect(queues.reduce((total, queue) => total + queue.length, 0)).toBe(138);
  });

  it("keeps authored order when groups produce events at the same time", () => {
    const definition = {
      name: "Stable ordering fixture",
      groups: [
        { type: "shooter", count: 2, start: 1, interval: 1, pattern: "sweep", step: 0 },
        { type: "mine", count: 1, start: 2, interval: 1, pattern: "sweep", step: 0 },
      ],
    } as const satisfies WaveDefinition;

    const queue = buildSpawnQueue(definition, new SeededRng(1));

    expect(queue.map(({ type, time }) => [type, time])).toEqual([
      ["shooter", 1],
      ["shooter", 2],
      ["mine", 2],
    ]);
  });

  it("pins all four angle patterns", () => {
    const random = new SeededRng(99);
    const sweep = required(required(WAVE_DEFINITIONS[0], "wave 1").groups[0], "sweep");
    const mirror = required(required(WAVE_DEFINITIONS[1], "wave 2").groups[0], "mirror");
    const fan = required(required(WAVE_DEFINITIONS[2], "wave 3").groups[1], "fan");
    const randomGroup = required(required(WAVE_DEFINITIONS[1], "wave 2").groups[1], "random");

    expect(angleFor(sweep, 2, 6, random)).toBeCloseTo(0.9568146928204138);
    expect(angleFor(mirror, 3, 0.2, random)).toBeCloseTo(3.7615926535897932);
    expect(angleFor(fan, 0, 0.4, random)).toBeCloseTo(5.783185307179586);
    expect(angleFor(fan, 7, 0.4, random)).toBeCloseTo(1.3);
    expect(angleFor(randomGroup, 0, 0, random)).toBeCloseTo(1.6370473117320847);
  });

  it("pins seeded queue generation and legacy random draw order", () => {
    const first = buildSpawnQueue(WAVE_DEFINITIONS[1], new SeededRng("queue-fixture"));
    const repeated = buildSpawnQueue(WAVE_DEFINITIONS[1], new SeededRng("queue-fixture"));

    expect(repeated).toEqual(first);
    expect(first.slice(0, 6)).toEqual([
      { type: "drifter", time: 0.4, angle: 4.358878091762933 },
      { type: "drifter", time: 0.88, angle: 1.21728543817314 },
      { type: "drifter", time: 1.3599999999999999, angle: 4.778878091762933 },
      { type: "drifter", time: 1.8399999999999999, angle: 1.6372854381731399 },
      { type: "drifter", time: 2.32, angle: 5.198878091762933 },
      { type: "drifter", time: 2.8, angle: 2.057285438173139 },
    ]);
  });
});

describe("wave runtime", () => {
  it("starts an authored wave and resets all runtime counters", () => {
    const wave = createWaveState();
    wave.waveNumber = 8;
    wave.elapsed = 42;
    wave.completeDelay = 0.7;

    startWave(wave, 3, new SeededRng("start"));

    expect(wave.waveNumber).toBe(3);
    expect(wave.definition).toBe(WAVE_DEFINITIONS[2]);
    expect(wave.queue).toHaveLength(15);
    expect(wave.elapsed).toBe(0);
    expect(wave.completeDelay).toBe(0);
    expect(() => startWave(wave, 0, new SeededRng(1))).toThrow(RangeError);
    expect(() => startWave(wave, 9, new SeededRng(1))).toThrow(RangeError);
  });

  it("spawns every event whose time is less than or equal to elapsed", () => {
    const wave = createWaveState();
    startWave(wave, 1, new SeededRng("timing"));
    const callbacks = createCallbacks();

    updateWave(wave, 0.499, callbacks);
    expect(callbacks.spawnEnemy).not.toHaveBeenCalled();

    updateWave(wave, 0.001, callbacks);
    expect(callbacks.spawnEnemy).toHaveBeenCalledTimes(1);

    updateWave(wave, 1.24, callbacks);
    expect(callbacks.spawnEnemy).toHaveBeenCalledTimes(3);
    expect(wave.queue).toHaveLength(7);
  });

  it("pauses wave time and spawning while a boss is active", () => {
    const wave = createWaveState();
    startWave(wave, 1, new SeededRng("boss"));
    const callbacks = createCallbacks({ bossActive: true });

    updateWave(wave, 10, callbacks);

    expect(wave.elapsed).toBe(0);
    expect(wave.queue).toHaveLength(10);
    expect(callbacks.spawnEnemy).not.toHaveBeenCalled();
  });

  it("waits 0.8 empty seconds, resets on pressure, and completes through a callback", () => {
    const wave = createWaveState({ definition: WAVE_DEFINITIONS[0] });
    const completeWave = vi.fn();

    updateWave(wave, 0.4, createCallbacks({ completeWave }));
    expect(wave.completeDelay).toBe(0.4);
    expect(completeWave).not.toHaveBeenCalled();

    updateWave(wave, 0.1, createCallbacks({ enemyCount: 1, completeWave }));
    expect(wave.completeDelay).toBe(0);

    updateWave(wave, 0.4, createCallbacks({ completeWave }));
    updateWave(wave, 0.4, createCallbacks({ completeWave }));
    expect(wave.completeDelay).toBe(WAVE_COMPLETION_DELAY_SECONDS);
    expect(completeWave).toHaveBeenCalledTimes(1);
  });

  it("does not begin the clear delay on the tick that spawns the final enemy", () => {
    const wave = createWaveState({
      definition: WAVE_DEFINITIONS[0],
      queue: [{ type: "drifter", time: 0.5, angle: 1 }],
    });
    const callbacks = createCallbacks();

    updateWave(wave, 0.5, callbacks);

    expect(callbacks.spawnEnemy).toHaveBeenCalledExactlyOnceWith("drifter", 1);
    expect(wave.queue).toHaveLength(0);
    expect(wave.completeDelay).toBe(0);
    expect(callbacks.completeWave).not.toHaveBeenCalled();
  });
});

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

function createWaveState(overrides: Partial<WaveRuntimeState> = {}): WaveRuntimeState {
  return {
    waveNumber: 1,
    definition: null,
    queue: [],
    elapsed: 0,
    completeDelay: 0,
    ...overrides,
  };
}

function createCallbacks(overrides: Partial<WaveUpdateCallbacks> = {}): WaveUpdateCallbacks {
  return {
    bossActive: false,
    enemyCount: 0,
    spawnEnemy: vi.fn(),
    completeWave: vi.fn(),
    ...overrides,
  };
}
