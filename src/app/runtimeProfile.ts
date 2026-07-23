export const FRAME_BUDGET_MS = 1000 / 60;

export interface RuntimeProfileSample {
  readonly updateMs: number;
  readonly renderMs: number;
  readonly frameWorkMs: number;
  readonly entities: number;
  readonly heapBytes: number | null;
  readonly audioVoices: number;
}

export interface RuntimeProfileSnapshot {
  readonly sampleCount: number;
  readonly updateP95Ms: number;
  readonly renderP95Ms: number;
  readonly frameWorkP95Ms: number;
  readonly frameWorkMaxMs: number;
  readonly overBudgetFrames: number;
  readonly peakEntities: number;
  readonly peakHeapBytes: number | null;
  readonly peakAudioVoices: number;
}

/**
 * Keeps a bounded rolling profile for release-candidate stress checks. This is
 * presentation-only instrumentation and never feeds values back into gameplay.
 */
export class RuntimeProfiler {
  private readonly samples: RuntimeProfileSample[] = [];

  constructor(private readonly capacity = 600) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("RuntimeProfiler capacity must be a positive integer");
    }
  }

  record(sample: RuntimeProfileSample): void {
    assertFiniteNonNegative(sample.updateMs, "updateMs");
    assertFiniteNonNegative(sample.renderMs, "renderMs");
    assertFiniteNonNegative(sample.frameWorkMs, "frameWorkMs");
    assertFiniteNonNegative(sample.entities, "entities");
    assertFiniteNonNegative(sample.audioVoices, "audioVoices");
    if (sample.heapBytes !== null) {
      assertFiniteNonNegative(sample.heapBytes, "heapBytes");
    }

    this.samples.push({ ...sample });
    if (this.samples.length > this.capacity) {
      this.samples.splice(0, this.samples.length - this.capacity);
    }
  }

  reset(): void {
    this.samples.splice(0);
  }

  snapshot(): RuntimeProfileSnapshot {
    if (this.samples.length === 0) {
      return {
        sampleCount: 0,
        updateP95Ms: 0,
        renderP95Ms: 0,
        frameWorkP95Ms: 0,
        frameWorkMaxMs: 0,
        overBudgetFrames: 0,
        peakEntities: 0,
        peakHeapBytes: null,
        peakAudioVoices: 0,
      };
    }

    const heapSamples = this.samples.flatMap((sample) =>
      sample.heapBytes === null ? [] : [sample.heapBytes],
    );
    return {
      sampleCount: this.samples.length,
      updateP95Ms: percentile(
        this.samples.map((sample) => sample.updateMs),
        0.95,
      ),
      renderP95Ms: percentile(
        this.samples.map((sample) => sample.renderMs),
        0.95,
      ),
      frameWorkP95Ms: percentile(
        this.samples.map((sample) => sample.frameWorkMs),
        0.95,
      ),
      frameWorkMaxMs: Math.max(...this.samples.map((sample) => sample.frameWorkMs)),
      overBudgetFrames: this.samples.filter((sample) => sample.frameWorkMs > FRAME_BUDGET_MS)
        .length,
      peakEntities: Math.max(...this.samples.map((sample) => sample.entities)),
      peakHeapBytes: heapSamples.length === 0 ? null : Math.max(...heapSamples),
      peakAudioVoices: Math.max(...this.samples.map((sample) => sample.audioVoices)),
    };
  }
}

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Runtime profile ${label} must be finite and non-negative`);
  }
}
