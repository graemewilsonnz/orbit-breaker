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
  "gameOver",
  "dash",
  "bomb",
] as const satisfies readonly AudioCue[];

export type SoundName = AudioCue;

type OscillatorShape = OscillatorType;

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

  constructor(browserWindow: Window = window) {
    const compatibleWindow = browserWindow as AudioWindow;
    this.AudioContextConstructor =
      compatibleWindow.AudioContext ?? compatibleWindow.webkitAudioContext;
  }

  init(): void {
    if (this.AudioContextConstructor === undefined) {
      return;
    }

    this.context ??= new this.AudioContextConstructor();
    if (this.context.state === "suspended") {
      void this.context.resume();
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
        window.setTimeout(() => this.tone(820, 0.08, "sine", 0.035, 120), 60);
        break;
      case "waveClear":
        this.tone(420, 0.12, "triangle", 0.04, 180);
        window.setTimeout(() => this.tone(660, 0.12, "triangle", 0.04, 160), 90);
        break;
      case "bossWarning":
        this.tone(180, 0.2, "sawtooth", 0.045, 65);
        break;
      case "gameOver":
        this.tone(190, 0.25, "sawtooth", 0.05, -80);
        window.setTimeout(() => this.tone(120, 0.28, "sawtooth", 0.05, -50), 150);
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
  ): void {
    const context = this.context;
    if (context === null) {
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
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private noise(duration: number, volume: number, delaySeconds = 0, centerFrequency = 900): void {
    const context = this.context;
    if (context === null) {
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
    filter.type = "bandpass";
    filter.frequency.value = centerFrequency;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(context.currentTime + delaySeconds);
  }
}
