import { beforeEach, describe, expect, it } from "vitest";

import { AudioEngine } from "../../src/game/audio/AudioEngine";

describe("M5 audio mixer and native scheduling", () => {
  beforeEach(() => FakeAudioContext.reset());

  it("schedules multi-note cues on the Web Audio timeline", () => {
    const audio = createAudio();
    audio.init();

    audio.play("powerup");

    expect(FakeAudioContext.oscillatorStarts).toEqual([10, 10.06]);
  });

  it("routes a full mute to an exact zero master gain", () => {
    const audio = createAudio();
    audio.setMix({ master: 0.8, music: 0.4, effects: 0.75, muted: true });
    audio.init();

    expect(FakeAudioContext.gains[0]?.gain.targets.at(-1)).toBe(0);
  });

  it("schedules an adaptive pulse only while gameplay music is active", () => {
    const audio = createAudio();
    audio.init();

    audio.updateMusic({ active: false, pressure: 0.8, bossPhase: null });
    expect(FakeAudioContext.oscillatorStarts).toHaveLength(0);

    audio.updateMusic({ active: true, pressure: 0.8, bossPhase: 2 });
    expect(FakeAudioContext.oscillatorStarts.length).toBeGreaterThan(0);
    expect(FakeAudioContext.oscillatorStarts[0]).toBeGreaterThan(10);
  });

  it("reports audio availability and peak scheduled voice pressure", () => {
    const audio = createAudio();
    expect(audio.diagnostics()).toMatchObject({
      contextState: "not-started",
      liveVoices: 0,
      peakVoices: 0,
    });

    audio.init();
    audio.play("powerup");

    expect(audio.diagnostics()).toMatchObject({
      contextState: "running",
      liveVoices: 2,
      peakVoices: 2,
    });
    FakeAudioContext.oscillators[0]?.finish();
    expect(audio.diagnostics().liveVoices).toBe(1);
  });
});

function createAudio(): AudioEngine {
  return new AudioEngine({
    AudioContext: FakeAudioContext as unknown as typeof AudioContext,
  } as unknown as Window);
}

class FakeAudioParam {
  readonly targets: number[] = [];

  value = 0;

  cancelScheduledValues(): void {
    return undefined;
  }

  setTargetAtTime(value: number): void {
    this.targets.push(value);
  }

  setValueAtTime(value: number): void {
    this.value = value;
  }

  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class FakeGain {
  readonly gain = new FakeAudioParam();

  connect(): void {
    return undefined;
  }
}

class FakeOscillator {
  readonly frequency = new FakeAudioParam();

  type: OscillatorType = "sine";
  onended: ((this: AudioScheduledSourceNode, event: Event) => unknown) | null = null;

  connect(): void {
    return undefined;
  }

  start(time: number): void {
    FakeAudioContext.oscillatorStarts.push(time);
  }

  stop(): void {
    return undefined;
  }

  finish(): void {
    this.onended?.call(this as unknown as AudioScheduledSourceNode, new Event("ended"));
  }
}

class FakeAudioContext {
  static readonly gains: FakeGain[] = [];
  static readonly oscillatorStarts: number[] = [];
  static readonly oscillators: FakeOscillator[] = [];

  readonly currentTime = 10;
  readonly destination = {};
  readonly sampleRate = 48_000;
  readonly state: AudioContextState = "running";

  static reset(): void {
    FakeAudioContext.gains.splice(0);
    FakeAudioContext.oscillatorStarts.splice(0);
    FakeAudioContext.oscillators.splice(0);
  }

  createGain(): GainNode {
    const gain = new FakeGain();
    FakeAudioContext.gains.push(gain);
    return gain as unknown as GainNode;
  }

  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillator();
    FakeAudioContext.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    return Promise.resolve();
  }
}
