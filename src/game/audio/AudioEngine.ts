import type { AudioCue } from "../core/events";

export const SOUND_NAMES = [
  "fire",
  "enemyHit",
  "enemyDestroyed",
  "drifterSignal",
  "spiralSignal",
  "mineSignal",
  "shooterSignal",
  "hunterSignal",
  "shieldSignal",
  "shooterFire",
  "playerHit",
  "powerup",
  "waveClear",
  "bossWarning",
  "bossShieldBlock",
  "bossHit",
  "bossWeakOpen",
  "bossBeamFire",
  "bossPhase",
  "bossDefeated",
  "gameOver",
  "dash",
  "bomb",
] as const satisfies readonly AudioCue[];

export type SoundName = AudioCue;

type OscillatorShape = OscillatorType;
type AudioBus = "effects" | "music";

export interface AudioMix {
  readonly master: number;
  readonly music: number;
  readonly effects: number;
  readonly muted: boolean;
}

export interface AdaptiveMusicState {
  readonly active: boolean;
  readonly pressure: number;
  readonly bossPhase: number | null;
}

export interface AudioDiagnostics {
  readonly contextState: AudioContextState | "unavailable" | "not-started";
  readonly liveVoices: number;
  readonly peakVoices: number;
}

interface AudioWindow extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

/**
 * Browser audio adapter. Simulation code emits sound events; only this class
 * touches Web Audio, keeping audio availability and timing out of game state.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private readonly AudioContextConstructor: typeof AudioContext | undefined;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private mix: AudioMix = {
    master: 0.8,
    music: 0.42,
    effects: 0.78,
    muted: false,
  };
  private nextMusicBeat = 0;
  private musicBeat = 0;
  private musicWasActive = false;
  private liveVoices = 0;
  private peakVoices = 0;

  constructor(browserWindow: Window = window) {
    const compatibleWindow = browserWindow as AudioWindow;
    this.AudioContextConstructor =
      compatibleWindow.AudioContext ?? compatibleWindow.webkitAudioContext;
  }

  init(): void {
    if (this.AudioContextConstructor === undefined) {
      return;
    }

    if (this.context === null) {
      this.context = new this.AudioContextConstructor();
      this.createMixer(this.context);
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  suspend(): void {
    if (this.context?.state === "running") {
      void this.context.suspend();
    }
  }

  diagnostics(): AudioDiagnostics {
    return {
      contextState:
        this.AudioContextConstructor === undefined
          ? "unavailable"
          : (this.context?.state ?? "not-started"),
      liveVoices: this.liveVoices,
      peakVoices: this.peakVoices,
    };
  }

  setMix(mix: AudioMix): void {
    this.mix = {
      master: clampVolume(mix.master),
      music: clampVolume(mix.music),
      effects: clampVolume(mix.effects),
      muted: mix.muted,
    };
    this.applyMix();
  }

  updateMusic(state: AdaptiveMusicState): void {
    const context = this.context;
    if (context === null || context.state !== "running") {
      this.musicWasActive = false;
      return;
    }

    const audible = state.active && !this.mix.muted && this.mix.master > 0 && this.mix.music > 0;
    if (!audible) {
      this.nextMusicBeat = context.currentTime + 0.04;
      this.musicWasActive = false;
      return;
    }

    const pressure = clampVolume(state.pressure);
    if (!this.musicWasActive || this.nextMusicBeat < context.currentTime - 0.2) {
      this.nextMusicBeat = context.currentTime + 0.025;
      this.musicBeat = 0;
    }
    this.musicWasActive = true;

    const bpm = 78 + pressure * 54 + (state.bossPhase ?? 0) * 4;
    const beatSeconds = 60 / bpm;
    const scheduleThrough = context.currentTime + 0.14;
    let scheduled = 0;
    while (this.nextMusicBeat <= scheduleThrough && scheduled < 4) {
      this.scheduleMusicPulse(this.nextMusicBeat, pressure, state.bossPhase);
      this.nextMusicBeat += beatSeconds;
      this.musicBeat += 1;
      scheduled += 1;
    }
  }

  play(name: SoundName): void {
    if (this.context === null) {
      return;
    }

    switch (name) {
      case "fire":
        this.tone(660, 0.055, "square", 0.025, -230);
        break;
      case "enemyHit":
        this.tone(220, 0.055, "triangle", 0.035, -80);
        break;
      case "enemyDestroyed":
        this.tone(150, 0.09, "sawtooth", 0.045, -85);
        this.noise(0.07, 0.025);
        break;
      case "drifterSignal":
        this.tone(265, 0.11, "triangle", 0.026, 115);
        break;
      case "spiralSignal":
        this.tone(510, 0.1, "sine", 0.026, 260);
        this.tone(760, 0.11, "triangle", 0.021, -330, 0.055);
        break;
      case "mineSignal":
        this.tone(118, 0.085, "square", 0.032, -18);
        this.tone(92, 0.1, "square", 0.028, -12, 0.13);
        break;
      case "shooterSignal":
        this.tone(310, 0.055, "square", 0.022, 45);
        this.tone(420, 0.055, "square", 0.024, 55, 0.075);
        this.tone(560, 0.07, "square", 0.026, 75, 0.15);
        break;
      case "hunterSignal":
        this.tone(820, 0.17, "sawtooth", 0.028, -590);
        this.tone(390, 0.09, "square", 0.018, -150, 0.065);
        break;
      case "shieldSignal":
        this.tone(360, 0.2, "sine", 0.022, 18);
        this.tone(540, 0.2, "sine", 0.018, 24, 0.025);
        break;
      case "shooterFire":
        this.tone(205, 0.095, "sawtooth", 0.042, -125);
        this.noise(0.045, 0.018, 0, 1350);
        break;
      case "playerHit":
        this.tone(95, 0.18, "sawtooth", 0.06, -42);
        this.noise(0.16, 0.04);
        break;
      case "powerup":
        this.tone(520, 0.08, "sine", 0.04, 260);
        this.tone(820, 0.08, "sine", 0.035, 120, 0.06);
        break;
      case "waveClear":
        this.tone(420, 0.12, "triangle", 0.04, 180);
        this.tone(660, 0.12, "triangle", 0.04, 160, 0.09);
        break;
      case "bossWarning":
        this.tone(180, 0.2, "sawtooth", 0.045, 65);
        break;
      case "bossShieldBlock":
        this.tone(760, 0.075, "square", 0.028, -240);
        this.tone(1080, 0.055, "sine", 0.018, -360, 0.018);
        break;
      case "bossHit":
        this.tone(285, 0.065, "triangle", 0.03, 95);
        break;
      case "bossWeakOpen":
        this.tone(420, 0.16, "sine", 0.032, 300);
        this.tone(630, 0.18, "triangle", 0.025, 260, 0.055);
        break;
      case "bossBeamFire":
        this.tone(92, 0.22, "sawtooth", 0.05, 75);
        this.noise(0.1, 0.025, 0, 520);
        break;
      case "bossPhase":
        this.tone(145, 0.26, "sawtooth", 0.045, 180);
        this.tone(310, 0.22, "triangle", 0.03, 190, 0.12);
        break;
      case "bossDefeated":
        this.tone(330, 0.28, "triangle", 0.045, 310);
        this.tone(620, 0.32, "sine", 0.04, 280, 0.12);
        this.noise(0.24, 0.035, 0, 780);
        break;
      case "gameOver":
        this.tone(190, 0.25, "sawtooth", 0.05, -80);
        this.tone(120, 0.28, "sawtooth", 0.05, -50, 0.15);
        break;
      case "dash":
        this.tone(360, 0.06, "triangle", 0.025, 240);
        break;
      case "bomb":
        this.tone(90, 0.22, "sawtooth", 0.06, 120);
        this.noise(0.22, 0.055);
        break;
    }
  }

  private tone(
    frequency: number,
    duration: number,
    shape: OscillatorShape,
    volume: number,
    slide: number,
    delaySeconds = 0,
    bus: AudioBus = "effects",
  ): void {
    const context = this.context;
    const output = bus === "music" ? this.musicGain : this.effectsGain;
    if (context === null || output === null) {
      return;
    }

    const now = context.currentTime + delaySeconds;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide !== 0) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, frequency + slide),
        now + duration,
      );
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(output);
    this.trackVoice(oscillator);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private noise(duration: number, volume: number, delaySeconds = 0, centerFrequency = 900): void {
    const context = this.context;
    if (context === null || this.effectsGain === null) {
      return;
    }

    const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime + delaySeconds;
    filter.type = "bandpass";
    filter.frequency.value = centerFrequency;
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effectsGain);
    this.trackVoice(source);
    source.start(now);
  }

  private createMixer(context: AudioContext): void {
    this.masterGain = context.createGain();
    this.musicGain = context.createGain();
    this.effectsGain = context.createGain();
    this.musicGain.connect(this.masterGain);
    this.effectsGain.connect(this.masterGain);
    this.masterGain.connect(context.destination);
    this.applyMix();
  }

  private applyMix(): void {
    const context = this.context;
    if (
      context === null ||
      this.masterGain === null ||
      this.musicGain === null ||
      this.effectsGain === null
    ) {
      return;
    }

    const now = context.currentTime;
    setGain(this.masterGain, this.mix.muted ? 0 : this.mix.master, now);
    setGain(this.musicGain, this.mix.music, now);
    setGain(this.effectsGain, this.mix.effects, now);
  }

  private scheduleMusicPulse(startTime: number, pressure: number, bossPhase: number | null): void {
    const context = this.context;
    if (context === null) {
      return;
    }

    const scale = bossPhase === null ? [82.41, 98, 110, 123.47] : [73.42, 92.5, 110, 138.59];
    const root = scale[this.musicBeat % scale.length] ?? scale[0] ?? 82.41;
    const delay = Math.max(0, startTime - context.currentTime);
    const accent = this.musicBeat % 4 === 0;
    this.tone(
      root,
      0.13 + pressure * 0.055,
      "triangle",
      (accent ? 0.082 : 0.058) + pressure * 0.018,
      -root * 0.12,
      delay,
      "music",
    );
    if (accent || pressure > 0.72) {
      this.tone(
        root * (bossPhase === null ? 2 : 1.5),
        0.075,
        "sine",
        0.024 + pressure * 0.012,
        root * 0.08,
        delay + 0.012,
        "music",
      );
    }
  }

  private trackVoice(source: AudioScheduledSourceNode): void {
    this.liveVoices += 1;
    this.peakVoices = Math.max(this.peakVoices, this.liveVoices);
    const previousHandler = source.onended;
    source.onended = (event): void => {
      this.liveVoices = Math.max(0, this.liveVoices - 1);
      previousHandler?.call(source, event);
    };
  }
}

function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function setGain(node: GainNode, value: number, now: number): void {
  node.gain.cancelScheduledValues(now);
  node.gain.setTargetAtTime(value, now, 0.018);
}
