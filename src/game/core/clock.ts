export const FIXED_STEP_SECONDS = 1 / 60;

const DEFAULT_MAX_FRAME_SECONDS = 0.25;
const DEFAULT_MAX_STEPS_PER_FRAME = 8;
const FLOATING_POINT_EPSILON = 1e-10;

export interface FixedStepClockOptions {
  readonly stepSeconds?: number;
  readonly maxFrameSeconds?: number;
  readonly maxStepsPerFrame?: number;
}

export interface FixedStepFrame {
  readonly rawFrameSeconds: number;
  readonly simulatedSteps: number;
  readonly simulatedSeconds: number;
  readonly droppedSeconds: number;
  readonly interpolationAlpha: number;
  readonly simulationTimeSeconds: number;
}

export type FixedStepCallback = (stepSeconds: number) => void;

export class FixedStepClock {
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly maxStepsPerFrame: number;
  private accumulatorSeconds = 0;
  private lastTimestampMilliseconds: number | null = null;
  private elapsedSimulationSeconds = 0;

  constructor(options: FixedStepClockOptions = {}) {
    this.stepSeconds = options.stepSeconds ?? FIXED_STEP_SECONDS;
    this.maxFrameSeconds = options.maxFrameSeconds ?? DEFAULT_MAX_FRAME_SECONDS;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? DEFAULT_MAX_STEPS_PER_FRAME;
    assertPositiveFinite(this.stepSeconds, "stepSeconds");
    assertPositiveFinite(this.maxFrameSeconds, "maxFrameSeconds");
    if (!Number.isSafeInteger(this.maxStepsPerFrame) || this.maxStepsPerFrame <= 0) {
      throw new RangeError("maxStepsPerFrame must be a positive safe integer");
    }
  }

  get simulationTimeSeconds(): number {
    return this.elapsedSimulationSeconds;
  }

  get interpolationAlpha(): number {
    return this.accumulatorSeconds / this.stepSeconds;
  }

  advance(timestampMilliseconds: number, onStep: FixedStepCallback): FixedStepFrame {
    if (!Number.isFinite(timestampMilliseconds)) {
      throw new TypeError("timestampMilliseconds must be finite");
    }
    if (this.lastTimestampMilliseconds === null) {
      this.lastTimestampMilliseconds = timestampMilliseconds;
      return this.emptyFrame();
    }
    const elapsedMilliseconds = Math.max(0, timestampMilliseconds - this.lastTimestampMilliseconds);
    this.lastTimestampMilliseconds = timestampMilliseconds;
    return this.advanceBy(elapsedMilliseconds / 1000, onStep);
  }

  advanceBy(frameSeconds: number, onStep: FixedStepCallback): FixedStepFrame {
    if (!Number.isFinite(frameSeconds) || frameSeconds < 0) {
      throw new RangeError("frameSeconds must be a finite non-negative number");
    }

    const acceptedFrameSeconds = Math.min(frameSeconds, this.maxFrameSeconds);
    let droppedSeconds = frameSeconds - acceptedFrameSeconds;
    let simulatedSteps = 0;
    this.accumulatorSeconds += acceptedFrameSeconds;

    while (
      this.accumulatorSeconds + FLOATING_POINT_EPSILON >= this.stepSeconds &&
      simulatedSteps < this.maxStepsPerFrame
    ) {
      this.accumulatorSeconds -= this.stepSeconds;
      if (Math.abs(this.accumulatorSeconds) < FLOATING_POINT_EPSILON) {
        this.accumulatorSeconds = 0;
      }
      this.elapsedSimulationSeconds += this.stepSeconds;
      simulatedSteps += 1;
      onStep(this.stepSeconds);
    }

    if (this.accumulatorSeconds + FLOATING_POINT_EPSILON >= this.stepSeconds) {
      const droppedWholeSteps = Math.floor(
        (this.accumulatorSeconds + FLOATING_POINT_EPSILON) / this.stepSeconds,
      );
      const droppedAccumulatorSeconds = droppedWholeSteps * this.stepSeconds;
      this.accumulatorSeconds -= droppedAccumulatorSeconds;
      if (Math.abs(this.accumulatorSeconds) < FLOATING_POINT_EPSILON) {
        this.accumulatorSeconds = 0;
      }
      droppedSeconds += droppedAccumulatorSeconds;
    }

    return {
      rawFrameSeconds: frameSeconds,
      simulatedSteps,
      simulatedSeconds: simulatedSteps * this.stepSeconds,
      droppedSeconds,
      interpolationAlpha: this.interpolationAlpha,
      simulationTimeSeconds: this.elapsedSimulationSeconds,
    };
  }

  reset(timestampMilliseconds?: number): void {
    if (timestampMilliseconds !== undefined && !Number.isFinite(timestampMilliseconds)) {
      throw new TypeError("timestampMilliseconds must be finite");
    }
    this.accumulatorSeconds = 0;
    this.elapsedSimulationSeconds = 0;
    this.lastTimestampMilliseconds = timestampMilliseconds ?? null;
  }

  private emptyFrame(): FixedStepFrame {
    return {
      rawFrameSeconds: 0,
      simulatedSteps: 0,
      simulatedSeconds: 0,
      droppedSeconds: 0,
      interpolationAlpha: this.interpolationAlpha,
      simulationTimeSeconds: this.elapsedSimulationSeconds,
    };
  }
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}
