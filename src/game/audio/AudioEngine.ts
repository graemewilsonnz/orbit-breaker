export const SOUND_NAMES = [
  "fire",
  "enemyHit",
  "enemyDestroyed",
  "playerHit",
  "powerup",
  "waveClear",
  "bossWarning",
  "gameOver",
  "dash",
  "bomb",
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

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
  ): void {
    const context = this.context;
    if (context === null) {
      return;
    }

    const now = context.currentTime;
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

  private noise(duration: number, volume: number): void {
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
    filter.frequency.value = 900;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
  }
}
