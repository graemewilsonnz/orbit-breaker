import "../styles/main.css";

import { Game, DEFAULT_RUN_SEED } from "../game/Game";
import { AudioEngine } from "../game/audio/AudioEngine";
import { validateGameContent } from "../game/config";
import { FixedStepClock } from "../game/core/clock";
import type { EventUnion, GameplayEventMap } from "../game/core/events";
import { SystemRng } from "../game/core/rng";
import type { DebugCommand } from "../game/debug/DebugPanel";
import { CanvasRenderer } from "../game/render/CanvasRenderer";
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
  readonly stats: RuntimeStats;
  readonly eventHistory: EventUnion<GameplayEventMap>[];
  readonly debugCommands: DebugCommand[];
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

  const audio = new AudioEngine(window);
  const input = new InputManager({
    target: window,
    onAudioUnlock: () => audio.init(),
  });
  const game = new Game({ seed, presentationRandom: new SystemRng() });
  const renderer = new CanvasRenderer(canvas, new SystemRng());
  const runtime: Runtime = {
    game,
    renderer,
    input,
    clock: new FixedStepClock(),
    audio,
    stats: { fps: 0, updateMs: 0, renderMs: 0, steps: 0, entities: 0 },
    eventHistory: [],
    debugCommands: [],
    timeScale: 1,
    singleStepRequested: false,
  };

  let updateDebugPanel: (() => void) | undefined;
  if (import.meta.env.DEV) {
    updateDebugPanel = await setupDevelopmentTools(runtime, parameters.has("debug"));
  }

  let previousFrameTime = performance.now();
  const frame = (now: number): void => {
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
    runtime.stats.updateMs = smooth(runtime.stats.updateMs, performance.now() - updateStart, 0.15);

    const renderStart = performance.now();
    runtime.renderer.render(runtime.game.view());
    runtime.stats.renderMs = smooth(runtime.stats.renderMs, performance.now() - renderStart, 0.15);
    const snapshot = runtime.game.snapshot();
    runtime.stats.entities =
      snapshot.enemies +
      snapshot.playerShots +
      snapshot.enemyBullets +
      snapshot.powerups +
      (snapshot.bossHealth === null ? 0 : 1);

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
  }
  if (runtime.eventHistory.length > 50) {
    runtime.eventHistory.splice(0, runtime.eventHistory.length - 50);
  }
}

async function setupDevelopmentTools(
  runtime: Runtime,
  initiallyOpen: boolean,
): Promise<() => void> {
  const { mountDebugPanel } = await import("../game/debug/DebugPanel");
  const dispatch = (command: DebugCommand): void => {
    runtime.debugCommands.push(command);
  };
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
    getStats: () => runtime.stats,
  });

  const debugApi = {
    dispatch,
    snapshot: () => runtime.game.snapshot(),
    deterministicState: () => runtime.game.deterministicState(),
    forceState: (state: "gameOver" | "victory") => runtime.game.forceState(state),
  };
  Object.defineProperty(window, "__ORBIT_DEBUG__", {
    value: debugApi,
    configurable: true,
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
        runtime.game.startBossScenario();
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
    };
  }
}
