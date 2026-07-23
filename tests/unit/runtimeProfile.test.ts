import { describe, expect, it } from "vitest";

import { FRAME_BUDGET_MS, RuntimeProfiler } from "../../src/app/runtimeProfile";

describe("M6 runtime release profiling", () => {
  it("reports rolling p95, peak allocation, entity, and audio pressure", () => {
    const profiler = new RuntimeProfiler(4);
    for (let index = 1; index <= 5; index += 1) {
      profiler.record({
        updateMs: index,
        renderMs: index * 2,
        frameWorkMs: index === 5 ? FRAME_BUDGET_MS + 1 : index * 3,
        entities: index * 10,
        heapBytes: index === 4 ? null : index * 1_000,
        audioVoices: index,
      });
    }

    expect(profiler.snapshot()).toEqual({
      sampleCount: 4,
      updateP95Ms: 5,
      renderP95Ms: 10,
      frameWorkP95Ms: FRAME_BUDGET_MS + 1,
      frameWorkMaxMs: FRAME_BUDGET_MS + 1,
      overBudgetFrames: 1,
      peakEntities: 50,
      peakHeapBytes: 5_000,
      peakAudioVoices: 5,
    });
  });

  it("can reset the release sample window", () => {
    const profiler = new RuntimeProfiler();
    profiler.record({
      updateMs: 1,
      renderMs: 2,
      frameWorkMs: 3,
      entities: 4,
      heapBytes: null,
      audioVoices: 0,
    });

    profiler.reset();

    expect(profiler.snapshot()).toMatchObject({
      sampleCount: 0,
      frameWorkP95Ms: 0,
      peakHeapBytes: null,
    });
  });
});
