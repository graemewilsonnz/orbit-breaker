import "../styles/main.css";

import {
  DEFAULT_PREFERENCES,
  loadHighScore,
  loadPreferences,
  saveHighScore,
  savePreferences,
  type PlayerPreferences,
  type PreferenceStorage,
} from "./preferences";
import { RuntimeProfiler } from "./runtimeProfile";
import { Game, DEFAULT_RUN_SEED } from "../game/Game";
import { AudioEngine } from "../game/audio/AudioEngine";
import { validateGameContent } from "../game/config";
import { FixedStepClock } from "../game/core/clock";
import type { EventUnion, GameplayEventMap } from "../game/core/events";
import { SystemRng } from "../game/core/rng";
import type { DebugCommand } from "../game/debug/DebugPanel";
import { CanvasRenderer } from "../game/render/CanvasRenderer";
import type { GameStateId, ReadonlyGameState } from "../game/state";
import { InputManager } from "../game/systems/input";

interface RuntimeStats {
  fps: number;
  updateMs: number;
  renderMs: number;
  steps: number;
  entities: number;
}

interface Runtime {
  readonly game: Game;
  readonly renderer: CanvasRenderer;
  readonly input: InputManager;
  readonly clock: FixedStepClock;
  readonly audio: AudioEngine;
  readonly profiler: RuntimeProfiler | null;
  readonly stats: RuntimeStats;
  readonly eventHistory: EventUnion<GameplayEventMap>[];
  readonly debugCommands: DebugCommand[];
  readonly storage: PreferenceStorage | null;
  preferences: PlayerPreferences;
  highScore: number;
  newHighScore: boolean;
  previousState: GameStateId;
  timeScale: number;
  singleStepRequested: boolean;
}

void bootstrap().catch(showFatalError);

async function bootstrap(): Promise<void> {
  validateGameContent();

  const canvas = requireElement("gameCanvas", HTMLCanvasElement);
  const status = requireElement("appStatus", HTMLParagraphElement);
  const parameters = new URLSearchParams(window.location.search);
  const seed = parameters.get("seed") ?? DEFAULT_RUN_SEED;
  const storage = getBrowserStorage();
  const reducedMotionPreferred = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const preferences = loadPreferences(storage, {
    ...DEFAULT_PREFERENCES,
    reducedShake: reducedMotionPreferred ?? false,
  });

  const audio = new AudioEngine(window);
  audio.setMix({
    master: preferences.masterVolume,
    music: preferences.musicVolume,
    effects: preferences.effectsVolume,
    muted: preferences.muted,
  });
  const input = new InputManager({
    target: window,
    onAudioUnlock: () => audio.init(),
  });
  const game = new Game({ seed, presentationRandom: new SystemRng() });
  const renderer = new CanvasRenderer(canvas, new SystemRng());
  const highScore = loadHighScore(storage);
  const runtime: Runtime = {
    game,
    renderer,
    input,
    clock: new FixedStepClock(),
    audio,
    profiler: import.meta.env.DEV ? new RuntimeProfiler() : null,
    stats: { fps: 0, updateMs: 0, renderMs: 0, steps: 0, entities: 0 },
    eventHistory: [],
    debugCommands: [],
    storage,
    preferences,
    highScore,
    newHighScore: false,
    previousState: game.state.state,
    timeScale: 1,
    singleStepRequested: false,
  };
  syncRendererPresentation(runtime);
  setupGameInterface(runtime);
  setupInterruptionHandling(runtime);

  let updateDebugPanel: (() => void) | undefined;
  if (import.meta.env.DEV) {
    updateDebugPanel = await setupDevelopmentTools(runtime, parameters.has("debug"));
  }

  let previousFrameTime = performance.now();
  const frame = (now: number): void => {
    const frameWorkStart = performance.now();
    const wallFrameSeconds = Math.max(0.000_001, (now - previousFrameTime) / 1000);
    previousFrameTime = now;
    runtime.stats.fps = smooth(runtime.stats.fps, 1 / wallFrameSeconds, 0.1);

    const updateStart = performance.now();
    const clockFrame = runtime.clock.advance(now, (stepSeconds) => {
      processDebugCommands(runtime);
      if (runtime.timeScale === 0 && !runtime.singleStepRequested) {
        return;
      }
      const scaledStep = runtime.timeScale === 0 ? stepSeconds : stepSeconds * runtime.timeScale;
      runtime.singleStepRequested = false;
      runtime.game.step(scaledStep, runtime.input.consumeStep());
      consumeEvents(runtime);
    });
    runtime.stats.steps = clockFrame.simulatedSteps;
    const updateMs = performance.now() - updateStart;
    runtime.stats.updateMs = smooth(runtime.stats.updateMs, updateMs, 0.15);

    const view = runtime.game.view();
    updateTerminalPresentation(runtime, view);
    runtime.audio.updateMusic(createAdaptiveMusicState(view));

    const renderStart = performance.now();
    runtime.renderer.render(view);
    const renderMs = performance.now() - renderStart;
    runtime.stats.renderMs = smooth(runtime.stats.renderMs, renderMs, 0.15);
    const snapshot = runtime.game.snapshot();
    runtime.stats.entities =
      snapshot.enemies +
      snapshot.playerShots +
      snapshot.enemyBullets +
      snapshot.powerups +
      (snapshot.bossHealth === null ? 0 : 1);
    runtime.profiler?.record({
      updateMs,
      renderMs,
      frameWorkMs: performance.now() - frameWorkStart,
      entities: runtime.stats.entities,
      heapBytes: readHeapBytes(performance),
      audioVoices: runtime.audio.diagnostics().liveVoices,
    });

    status.hidden = true;
    updateDebugPanel?.();
    window.requestAnimationFrame(frame);
  };

  const resize = (): void => renderer.resize();
  window.addEventListener("resize", resize);
  window.requestAnimationFrame(frame);
}

function consumeEvents(runtime: Runtime): void {
  for (const event of runtime.game.drainEvents()) {
    runtime.eventHistory.push(event);
    if (event.type === "audio") {
      runtime.audio.play(event.payload.cue);
    }
    if (event.type === "effect") {
      const freezeSeconds = impactFreezeFor(event.payload.kind, event.payload.size);
      runtime.renderer.triggerImpactFreeze(freezeSeconds);
    }
  }
  if (runtime.eventHistory.length > 50) {
    runtime.eventHistory.splice(0, runtime.eventHistory.length - 50);
  }
}

function setupGameInterface(runtime: Runtime): void {
  const stage = requireElement("gameStage", HTMLElement);
  const settingsPanel = requireElement("settingsPanel", HTMLElement);
  const settingsButton = requireElement("settingsButton", HTMLButtonElement);
  const muteButton = requireElement("muteButton", HTMLButtonElement);
  const closeButton = requireElement("closeSettingsButton", HTMLButtonElement);
  const doneButton = requireElement("doneSettingsButton", HTMLButtonElement);
  const fullscreenButton = requireElement("fullscreenButton", HTMLButtonElement);
  const masterInput = requireElement("masterVolume", HTMLInputElement);
  const musicInput = requireElement("musicVolume", HTMLInputElement);
  const effectsInput = requireElement("effectsVolume", HTMLInputElement);
  const masterOutput = requireElement("masterVolumeValue", HTMLOutputElement);
  const musicOutput = requireElement("musicVolumeValue", HTMLOutputElement);
  const effectsOutput = requireElement("effectsVolumeValue", HTMLOutputElement);
  const muteToggle = requireElement("muteToggle", HTMLInputElement);
  const reducedShakeToggle = requireElement("reducedShakeToggle", HTMLInputElement);

  const updatePreferences = (patch: Partial<PlayerPreferences>): void => {
    runtime.preferences = { ...runtime.preferences, ...patch };
    savePreferences(runtime.storage, runtime.preferences);
    runtime.audio.setMix({
      master: runtime.preferences.masterVolume,
      music: runtime.preferences.musicVolume,
      effects: runtime.preferences.effectsVolume,
      muted: runtime.preferences.muted,
    });
    syncRendererPresentation(runtime);
    syncControls();
  };

  const syncControls = (): void => {
    const { preferences } = runtime;
    setVolumeControl(masterInput, masterOutput, preferences.masterVolume);
    setVolumeControl(musicInput, musicOutput, preferences.musicVolume);
    setVolumeControl(effectsInput, effectsOutput, preferences.effectsVolume);
    muteToggle.checked = preferences.muted;
    reducedShakeToggle.checked = preferences.reducedShake;
    muteButton.textContent = preferences.muted ? "SOUND OFF" : "SOUND ON";
    muteButton.setAttribute("aria-pressed", String(preferences.muted));
  };

  const openSettings = (): void => {
    if (!settingsPanel.hidden) {
      return;
    }
    runtime.audio.init();
    runtime.input.clear();
    runtime.game.pause("settings");
    settingsPanel.hidden = false;
    settingsButton.setAttribute("aria-expanded", "true");
    closeButton.focus();
  };

  const closeSettings = (): void => {
    if (settingsPanel.hidden) {
      return;
    }
    runtime.input.clear();
    settingsPanel.hidden = true;
    settingsButton.setAttribute("aria-expanded", "false");
    settingsButton.focus();
  };

  const toggleFullscreen = async (): Promise<void> => {
    runtime.audio.init();
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
      } else {
        await stage.requestFullscreen();
      }
    } catch {
      fullscreenButton.textContent = "FULLSCREEN UNAVAILABLE";
      fullscreenButton.disabled = true;
    }
  };

  masterInput.addEventListener("input", () =>
    updatePreferences({ masterVolume: readVolumeControl(masterInput) }),
  );
  musicInput.addEventListener("input", () =>
    updatePreferences({ musicVolume: readVolumeControl(musicInput) }),
  );
  effectsInput.addEventListener("input", () =>
    updatePreferences({ effectsVolume: readVolumeControl(effectsInput) }),
  );
  muteToggle.addEventListener("change", () => updatePreferences({ muted: muteToggle.checked }));
  reducedShakeToggle.addEventListener("change", () =>
    updatePreferences({ reducedShake: reducedShakeToggle.checked }),
  );
  muteButton.addEventListener("click", () => {
    runtime.audio.init();
    updatePreferences({ muted: !runtime.preferences.muted });
  });
  settingsButton.addEventListener("click", openSettings);
  closeButton.addEventListener("click", closeSettings);
  doneButton.addEventListener("click", closeSettings);
  fullscreenButton.addEventListener("click", () => void toggleFullscreen());

  settingsPanel.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.code === "Escape") {
      event.preventDefault();
      closeSettings();
    }
  });
  settingsPanel.addEventListener("keyup", (event) => event.stopPropagation());

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.repeat || isEditableTarget(event.target) || !settingsPanel.hidden) {
        return;
      }
      switch (event.code) {
        case "KeyM":
          event.preventDefault();
          event.stopPropagation();
          runtime.audio.init();
          updatePreferences({ muted: !runtime.preferences.muted });
          break;
        case "KeyF":
          event.preventDefault();
          event.stopPropagation();
          void toggleFullscreen();
          break;
        case "KeyS":
          event.preventDefault();
          event.stopPropagation();
          openSettings();
          break;
      }
    },
    true,
  );

  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.disabled = false;
    fullscreenButton.textContent =
      document.fullscreenElement === stage ? "EXIT FULLSCREEN" : "ENTER FULLSCREEN";
    runtime.renderer.resize();
  });
  window.addEventListener("pointerdown", () => runtime.audio.init(), { passive: true });

  if (!document.fullscreenEnabled) {
    fullscreenButton.textContent = "FULLSCREEN UNAVAILABLE";
    fullscreenButton.disabled = true;
  }
  syncControls();
}

function setupInterruptionHandling(runtime: Runtime): void {
  const interrupt = (): void => {
    runtime.input.clear();
    runtime.game.pause("focus");
    runtime.audio.suspend();
  };

  window.addEventListener("blur", interrupt);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      interrupt();
    }
  });
}

function updateTerminalPresentation(runtime: Runtime, state: ReadonlyGameState): void {
  const terminal = state.state === "gameOver" || state.state === "victory";
  if (terminal && state.player.score > runtime.highScore) {
    runtime.highScore = state.player.score;
    runtime.newHighScore = true;
    saveHighScore(runtime.storage, runtime.highScore);
    syncRendererPresentation(runtime);
  } else if (state.state !== runtime.previousState && state.state === "playing") {
    runtime.newHighScore = false;
    syncRendererPresentation(runtime);
  }
  runtime.previousState = state.state;
}

function syncRendererPresentation(runtime: Runtime): void {
  runtime.renderer.setPresentation({
    highScore: runtime.highScore,
    muted: runtime.preferences.muted,
    newHighScore: runtime.newHighScore,
    reducedShake: runtime.preferences.reducedShake,
  });
}

function createAdaptiveMusicState(state: ReadonlyGameState) {
  const active =
    state.state === "playing" || state.state === "waveClear" || state.state === "bossIntro";
  const wavePressure = ((Math.max(1, state.currentWave) - 1) / 7) * 0.58;
  const entityPressure = Math.min(0.28, (state.enemies.length + state.enemyBullets.length) * 0.012);
  const bossPressure = state.boss === null ? 0 : 0.62 + state.boss.phase * 0.09;
  return {
    active,
    pressure: Math.min(1, Math.max(wavePressure + entityPressure, bossPressure)),
    bossPhase: state.boss?.phase ?? null,
  };
}

function impactFreezeFor(kind: GameplayEventMap["effect"]["kind"], size: number): number {
  switch (kind) {
    case "bomb":
      return 0.055;
    case "bossPulse":
      return 0.065;
    case "burst":
      return size >= 58 ? 0.038 : size >= 34 ? 0.022 : 0;
    case "ring":
      return 0;
  }
}

function setVolumeControl(input: HTMLInputElement, output: HTMLOutputElement, value: number): void {
  const percentage = Math.round(value * 100);
  input.value = String(percentage);
  output.value = `${percentage}%`;
}

function readVolumeControl(input: HTMLInputElement): number {
  return Math.max(0, Math.min(1, Number(input.value) / 100));
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function getBrowserStorage(): PreferenceStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function setupDevelopmentTools(
  runtime: Runtime,
  initiallyOpen: boolean,
): Promise<() => void> {
  const profiler = runtime.profiler;
  if (profiler === null) {
    throw new Error("Development profiling is unavailable in a production build");
  }
  const dispatch = (command: DebugCommand): void => {
    runtime.debugCommands.push(command);
  };
  const debugApi = {
    dispatch,
    snapshot: () => runtime.game.snapshot(),
    deterministicState: () => runtime.game.deterministicState(),
    forceState: (state: "gameOver" | "victory") => runtime.game.forceState(state),
    runtimeProfile: () => profiler.snapshot(),
    resetRuntimeProfile: () => profiler.reset(),
    audioDiagnostics: () => runtime.audio.diagnostics(),
  };
  Object.defineProperty(window, "__ORBIT_DEBUG__", {
    value: debugApi,
    configurable: true,
  });

  const { mountDebugPanel } = await import("../game/debug/DebugPanel");
  const panel = mountDebugPanel({
    initiallyOpen,
    dispatch,
    getSnapshot: () => runtime.game.snapshot(),
    getEvents: () =>
      runtime.eventHistory.map((event) => ({
        sequence: event.sequence,
        type: event.type,
        summary: summarizeEvent(event),
      })),
    getStats: () => ({
      ...runtime.stats,
      ...profiler.snapshot(),
      audioContextState: runtime.audio.diagnostics().contextState,
    }),
  });

  return () => panel.update();
}

function processDebugCommands(runtime: Runtime): void {
  for (const command of runtime.debugCommands.splice(0)) {
    switch (command.type) {
      case "set-seed":
        runtime.game.setRunSeed(command.seed, command.restart);
        break;
      case "restart":
        runtime.game.startRun();
        break;
      case "start-wave":
        runtime.game.startAtWave(command.wave);
        break;
      case "start-boss":
        runtime.game.startBossScenario(command.phase);
        break;
      case "set-invulnerable":
        runtime.game.setDebugInvulnerable(command.enabled);
        break;
      case "set-time-scale":
        runtime.timeScale = command.scale;
        break;
      case "set-dash-cooldown":
        runtime.game.setDebugDashCooldown(command.seconds);
        break;
      case "single-step":
        runtime.singleStepRequested = true;
        break;
      case "spawn-enemy":
        runtime.game.spawnEnemy(command.enemyType, runtime.game.state.player.angle + Math.PI);
        break;
      case "show-hitboxes":
        runtime.renderer.setShowHitboxes(command.enabled);
        break;
      case "force-state":
        runtime.game.forceState(command.state);
        break;
      case "spawn-player-contact":
        runtime.game.spawnEnemy("drifter", runtime.game.state.player.angle, {
          radius: runtime.game.state.player.radius - 1,
          radialSpeed: 60,
        });
        break;
    }
  }
}

function summarizeEvent(event: EventUnion<GameplayEventMap>): string {
  if (event.type === "audio") {
    return event.payload.cue;
  }
  if (event.type === "metric") {
    return `${event.payload.name}: ${event.payload.value}`;
  }
  if (event.type === "ui-notice") {
    return event.payload.message ?? event.payload.kind;
  }
  if (event.type === "camera-shake") {
    return `intensity ${event.payload.intensity.toFixed(2)}`;
  }
  return `${event.payload.kind} ${Math.round(event.payload.size)}px`;
}

function requireElement<T extends Element>(id: string, constructor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) {
    throw new Error(`Required element #${id} is missing or has the wrong type`);
  }
  return element;
}

function smooth(current: number, next: number, factor: number): number {
  return current === 0 ? next : current + (next - current) * factor;
}

function readHeapBytes(browserPerformance: Performance): number | null {
  const memory = (
    browserPerformance as Performance & {
      readonly memory?: { readonly usedJSHeapSize?: number };
    }
  ).memory;
  const used = memory?.usedJSHeapSize;
  return typeof used === "number" && Number.isFinite(used) && used >= 0 ? used : null;
}

function showFatalError(error: unknown): void {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  const shell = document.querySelector(".game-shell") ?? document.body;
  const status = document.getElementById("appStatus");
  if (status !== null) {
    status.hidden = true;
  }
  const output = document.createElement("pre");
  output.className = "app-error";
  output.setAttribute("role", "alert");
  output.textContent = `Orbit Breaker could not start.\n\n${message}`;
  shell.append(output);
  console.error(error);
}

declare global {
  interface Window {
    __ORBIT_DEBUG__?: {
      readonly dispatch: (command: DebugCommand) => void;
      readonly snapshot: () => unknown;
      readonly deterministicState: () => string;
      readonly forceState: (state: "gameOver" | "victory") => void;
      readonly runtimeProfile: () => unknown;
      readonly resetRuntimeProfile: () => void;
      readonly audioDiagnostics: () => unknown;
    };
  }
}
