import { ENEMY_TYPES, isEnemyType, type EnemyType } from "../content/enemies";
import type { BossPhase } from "../content/boss";
import { damageSourceLabel, type DamageSource } from "../runMetrics";
import type { WaveOutcome, WaveStats } from "../waveOutcomes";

export type DebugWave = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type DebugTimeScale = 0 | 0.25 | 0.5 | 1 | 2 | 4;

export type DebugCommand =
  | Readonly<{ type: "set-seed"; seed: string; restart: boolean }>
  | Readonly<{ type: "restart" }>
  | Readonly<{ type: "start-wave"; wave: DebugWave }>
  | Readonly<{ type: "start-boss"; phase?: BossPhase }>
  | Readonly<{ type: "set-invulnerable"; enabled: boolean }>
  | Readonly<{ type: "set-time-scale"; scale: DebugTimeScale }>
  | Readonly<{ type: "set-dash-cooldown"; seconds: number }>
  | Readonly<{ type: "single-step" }>
  | Readonly<{ type: "spawn-enemy"; enemyType: EnemyType }>
  | Readonly<{ type: "show-hitboxes"; enabled: boolean }>
  | Readonly<{ type: "force-state"; state: "gameOver" | "victory" }>
  | Readonly<{ type: "spawn-player-contact" }>;

export interface DebugSnapshot {
  readonly state: string;
  readonly currentWave: number;
  readonly score: number;
  readonly lives: number;
  readonly enemies: number;
  readonly playerShots: number;
  readonly enemyBullets: number;
  readonly powerups: number;
  readonly bossHealth: number | null;
  readonly bossPhase: number | null;
  readonly bossShieldMode: string | null;
  readonly bossElapsed: number | null;
  readonly bossPhaseElapsed: number | null;
  readonly bossTransitionTimer: number | null;
  readonly bossBeamActive: boolean;
  readonly bossBeamCount: number;
  readonly bossSafeArcCount: number;
  readonly pendingSpawns: number;
  readonly waveStats: Readonly<WaveStats>;
  readonly lastWaveOutcome: Readonly<WaveOutcome> | null;
  readonly run: {
    readonly accuracyPercent: number;
    readonly elapsedSeconds: number;
    readonly shotsFired: number;
    readonly shotsHit: number;
    readonly enemiesDestroyed: number;
    readonly damageTaken: number;
    readonly lastDamageSource: DamageSource | null;
    readonly lastDamageEnemyType: EnemyType | null;
    readonly firstMoveSeconds: number | null;
    readonly firstShotSeconds: number | null;
    readonly firstDashSeconds: number | null;
    readonly waveTimings: readonly { readonly wave: number; readonly seconds: number }[];
  };
}

export interface DebugEvent {
  readonly sequence: number;
  readonly type: string;
  readonly summary: string;
}

export interface DebugStats {
  readonly fps: number;
  readonly updateMs: number;
  readonly renderMs: number;
  readonly steps: number;
  readonly entities: number;
  readonly sampleCount: number;
  readonly frameWorkP95Ms: number;
  readonly overBudgetFrames: number;
  readonly peakEntities: number;
  readonly peakHeapBytes: number | null;
  readonly peakAudioVoices: number;
  readonly audioContextState: string;
}

export interface DebugPanelOptions {
  readonly dispatch: (command: DebugCommand) => void;
  readonly getSnapshot: () => DebugSnapshot;
  readonly getEvents: () => readonly DebugEvent[];
  readonly getStats: () => DebugStats;
  readonly initiallyOpen?: boolean;
}

export interface DebugPanelHandle {
  update(): void;
  dispose(): void;
}

const DEBUG_WAVES = [1, 2, 3, 4, 5, 6, 7, 8] as const satisfies readonly DebugWave[];
const DEBUG_TIME_SCALES = [0, 0.25, 0.5, 1, 2, 4] as const satisfies readonly DebugTimeScale[];
const MAX_EVENT_LINES = 50;

const DEBUG_PANEL_CSS = `
.ob-debug {
  color-scheme: dark;
  position: fixed;
  z-index: 10000;
  top: 0.75rem;
  right: 0.75rem;
  width: min(24rem, calc(100vw - 1.5rem));
  border: 1px solid #61708d;
  border-radius: 0.4rem;
  background: rgb(9 13 24 / 96%);
  color: #f4f7ff;
  box-shadow: 0 0.5rem 2rem rgb(0 0 0 / 45%);
  font: 12px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.ob-debug > summary {
  padding: 0.55rem 0.7rem;
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  user-select: none;
}

.ob-debug[open] > summary {
  border-bottom: 1px solid #39445b;
}

.ob-debug__body {
  display: grid;
  gap: 0.65rem;
  max-height: calc(100vh - 4.5rem);
  padding: 0.7rem;
  overflow: auto;
}

.ob-debug fieldset {
  min-width: 0;
  margin: 0;
  padding: 0.5rem;
  border: 1px solid #39445b;
  border-radius: 0.25rem;
}

.ob-debug legend,
.ob-debug h2 {
  margin: 0;
  color: #a9d5ff;
  font: inherit;
  font-weight: 700;
}

.ob-debug h2 {
  margin-bottom: 0.3rem;
}

.ob-debug__row,
.ob-debug__buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.ob-debug__row + .ob-debug__row,
.ob-debug__buttons + .ob-debug__row {
  margin-top: 0.4rem;
}

.ob-debug label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.ob-debug input[type="text"],
.ob-debug select,
.ob-debug button {
  min-height: 1.9rem;
  border: 1px solid #61708d;
  border-radius: 0.2rem;
  background: #172035;
  color: inherit;
  font: inherit;
}

.ob-debug input[type="text"] {
  min-width: 0;
  flex: 1 1 9rem;
  padding: 0 0.4rem;
}

.ob-debug select,
.ob-debug button {
  padding: 0.2rem 0.45rem;
}

.ob-debug button {
  cursor: pointer;
}

.ob-debug button:hover {
  background: #263553;
}

.ob-debug :focus-visible {
  outline: 2px solid #72c6ff;
  outline-offset: 2px;
}

.ob-debug__metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid #39445b;
  border-radius: 0.25rem;
  background: #39445b;
}

.ob-debug__metric {
  min-width: 0;
  padding: 0.35rem 0.2rem;
  background: #11182a;
  text-align: center;
}

.ob-debug__metric dt {
  color: #aab5ca;
  font-size: 0.82em;
  text-transform: uppercase;
}

.ob-debug__metric dd {
  margin: 0.1rem 0 0;
  overflow: hidden;
  color: #fff;
  font-weight: 700;
  text-overflow: ellipsis;
}

.ob-debug__snapshot {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.ob-debug__events {
  max-height: 11rem;
  margin: 0;
  padding: 0.4rem 0.4rem 0.4rem 1.8rem;
  overflow: auto;
  border: 1px solid #39445b;
  border-radius: 0.25rem;
  background: #080c16;
  overflow-wrap: anywhere;
}

.ob-debug__events li + li {
  margin-top: 0.18rem;
}

.ob-debug__events-empty {
  color: #8e9ab0;
  list-style: none;
}
`;

interface RetainedStyles {
  readonly element: HTMLStyleElement;
  users: number;
}

const stylesByDocument = new WeakMap<Document, RetainedStyles>();
let nextPanelId = 1;

/**
 * Mounts the development-only controls. Import this module conditionally so the
 * panel and its CSS are absent from production bundles.
 */
export function mountDebugPanel(options: DebugPanelOptions): DebugPanelHandle {
  const ownerDocument = document;
  const releaseStyles = retainStyles(ownerDocument);
  const panelId = nextPanelId;
  nextPanelId += 1;

  const root = ownerDocument.createElement("details");
  root.className = "ob-debug";
  root.dataset.debugPanel = "";
  root.open = options.initiallyOpen === true;
  root.innerHTML = panelMarkup(panelId);

  const seedForm = requireElement<HTMLFormElement>(root, '[data-role="seed-form"]');
  const seedInput = requireElement<HTMLInputElement>(root, '[data-role="seed"]');
  const invulnerableInput = requireElement<HTMLInputElement>(root, '[data-role="invulnerable"]');
  const timeScaleSelect = requireElement<HTMLSelectElement>(root, '[data-role="time-scale"]');
  const hitboxesInput = requireElement<HTMLInputElement>(root, '[data-role="hitboxes"]');
  const eventLog = requireElement<HTMLOListElement>(root, '[data-role="events"]');

  const values = {
    fps: requireElement<HTMLElement>(root, '[data-value="fps"]'),
    updateMs: requireElement<HTMLElement>(root, '[data-value="update-ms"]'),
    renderMs: requireElement<HTMLElement>(root, '[data-value="render-ms"]'),
    steps: requireElement<HTMLElement>(root, '[data-value="steps"]'),
    entities: requireElement<HTMLElement>(root, '[data-value="entities"]'),
    frameP95: requireElement<HTMLElement>(root, '[data-value="frame-p95"]'),
    overBudget: requireElement<HTMLElement>(root, '[data-value="over-budget"]'),
    peakEntities: requireElement<HTMLElement>(root, '[data-value="peak-entities"]'),
    peakHeap: requireElement<HTMLElement>(root, '[data-value="peak-heap"]'),
    audioPressure: requireElement<HTMLElement>(root, '[data-value="audio-pressure"]'),
    state: requireElement<HTMLElement>(root, '[data-value="state"]'),
    wave: requireElement<HTMLElement>(root, '[data-value="wave"]'),
    score: requireElement<HTMLElement>(root, '[data-value="score"]'),
    lives: requireElement<HTMLElement>(root, '[data-value="lives"]'),
    enemies: requireElement<HTMLElement>(root, '[data-value="enemies"]'),
    playerShots: requireElement<HTMLElement>(root, '[data-value="player-shots"]'),
    enemyBullets: requireElement<HTMLElement>(root, '[data-value="enemy-bullets"]'),
    powerups: requireElement<HTMLElement>(root, '[data-value="powerups"]'),
    bossHealth: requireElement<HTMLElement>(root, '[data-value="boss-health"]'),
    bossPhase: requireElement<HTMLElement>(root, '[data-value="boss-phase"]'),
    bossMode: requireElement<HTMLElement>(root, '[data-value="boss-mode"]'),
    bossTime: requireElement<HTMLElement>(root, '[data-value="boss-time"]'),
    bossPhaseTime: requireElement<HTMLElement>(root, '[data-value="boss-phase-time"]'),
    bossTransition: requireElement<HTMLElement>(root, '[data-value="boss-transition"]'),
    bossBeams: requireElement<HTMLElement>(root, '[data-value="boss-beams"]'),
    bossSafeArcs: requireElement<HTMLElement>(root, '[data-value="boss-safe-arcs"]'),
    pendingSpawns: requireElement<HTMLElement>(root, '[data-value="pending-spawns"]'),
    requiredEnemies: requireElement<HTMLElement>(root, '[data-value="wave-required"]'),
    destroyedEnemies: requireElement<HTMLElement>(root, '[data-value="wave-destroyed"]'),
    bombKills: requireElement<HTMLElement>(root, '[data-value="wave-bomb-kills"]'),
    breaches: requireElement<HTMLElement>(root, '[data-value="wave-breaches"]'),
    escapes: requireElement<HTMLElement>(root, '[data-value="wave-escapes"]'),
    playerDamaged: requireElement<HTMLElement>(root, '[data-value="wave-damaged"]'),
    bombUsed: requireElement<HTMLElement>(root, '[data-value="wave-bomb-used"]'),
    lastWaveClear: requireElement<HTMLElement>(root, '[data-value="last-wave-clear"]'),
    lastNoDamage: requireElement<HTMLElement>(root, '[data-value="last-no-damage"]'),
    lastFullClear: requireElement<HTMLElement>(root, '[data-value="last-full-clear"]'),
    lastPerfect: requireElement<HTMLElement>(root, '[data-value="last-perfect"]'),
    accuracy: requireElement<HTMLElement>(root, '[data-value="accuracy"]'),
    runTime: requireElement<HTMLElement>(root, '[data-value="run-time"]'),
    hits: requireElement<HTMLElement>(root, '[data-value="hits"]'),
    kills: requireElement<HTMLElement>(root, '[data-value="kills"]'),
    damage: requireElement<HTMLElement>(root, '[data-value="damage"]'),
    damageSource: requireElement<HTMLElement>(root, '[data-value="damage-source"]'),
    firstMove: requireElement<HTMLElement>(root, '[data-value="first-move"]'),
    firstShot: requireElement<HTMLElement>(root, '[data-value="first-shot"]'),
    firstDash: requireElement<HTMLElement>(root, '[data-value="first-dash"]'),
    waveOneTime: requireElement<HTMLElement>(root, '[data-value="wave-one-time"]'),
    waveTwoTime: requireElement<HTMLElement>(root, '[data-value="wave-two-time"]'),
  };

  let disposed = false;
  let lastEventSignature: string | undefined;

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    options.dispatch({
      type: "set-seed",
      seed: seedInput.value,
      restart: true,
    });
  };

  const onClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest<HTMLButtonElement>("button[data-command]");
    if (button === null || !root.contains(button)) {
      return;
    }

    switch (button.dataset.command) {
      case "set-seed":
        options.dispatch({
          type: "set-seed",
          seed: seedInput.value,
          restart: false,
        });
        break;
      case "restart":
        options.dispatch({ type: "restart" });
        break;
      case "start-wave": {
        const wave = Number(button.dataset.wave);
        if (isDebugWave(wave)) {
          options.dispatch({ type: "start-wave", wave });
        }
        break;
      }
      case "start-boss":
        options.dispatch({ type: "start-boss", phase: parseBossPhase(button.dataset.phase) });
        break;
      case "single-step":
        options.dispatch({ type: "single-step" });
        break;
      case "force-state": {
        const state = button.dataset.state;
        if (state === "gameOver" || state === "victory") {
          options.dispatch({ type: "force-state", state });
        }
        break;
      }
      case "spawn-player-contact":
        options.dispatch({ type: "spawn-player-contact" });
        break;
      case "spawn-enemy": {
        const enemyType = button.dataset.enemyType;
        if (isEnemyType(enemyType)) {
          options.dispatch({ type: "spawn-enemy", enemyType });
        }
        break;
      }
    }
  };

  const onChange = (event: Event): void => {
    if (event.target === invulnerableInput) {
      options.dispatch({
        type: "set-invulnerable",
        enabled: invulnerableInput.checked,
      });
      return;
    }

    if (event.target === hitboxesInput) {
      options.dispatch({
        type: "show-hitboxes",
        enabled: hitboxesInput.checked,
      });
      return;
    }

    if (event.target === timeScaleSelect) {
      const scale = Number(timeScaleSelect.value);
      if (isDebugTimeScale(scale)) {
        options.dispatch({ type: "set-time-scale", scale });
      }
    }
  };

  seedForm.addEventListener("submit", onSubmit);
  root.addEventListener("click", onClick);
  root.addEventListener("change", onChange);
  ownerDocument.body.append(root);

  const update = (): void => {
    if (disposed || !root.open) {
      return;
    }

    const stats = options.getStats();
    values.fps.textContent = formatNumber(stats.fps, 1);
    values.updateMs.textContent = formatMilliseconds(stats.updateMs);
    values.renderMs.textContent = formatMilliseconds(stats.renderMs);
    values.steps.textContent = formatNumber(stats.steps);
    values.entities.textContent = formatNumber(stats.entities);
    values.frameP95.textContent = formatMilliseconds(stats.frameWorkP95Ms);
    values.overBudget.textContent = `${stats.overBudgetFrames}/${stats.sampleCount}`;
    values.peakEntities.textContent = formatNumber(stats.peakEntities);
    values.peakHeap.textContent =
      stats.peakHeapBytes === null
        ? "\u2014"
        : `${(stats.peakHeapBytes / (1024 * 1024)).toFixed(1)} MB`;
    values.audioPressure.textContent = `${stats.peakAudioVoices} · ${stats.audioContextState}`;

    const snapshot = options.getSnapshot();
    values.state.textContent = snapshot.state;
    values.wave.textContent = formatNumber(snapshot.currentWave);
    values.score.textContent = formatNumber(snapshot.score);
    values.lives.textContent = formatNumber(snapshot.lives);
    values.enemies.textContent = formatNumber(snapshot.enemies);
    values.playerShots.textContent = formatNumber(snapshot.playerShots);
    values.enemyBullets.textContent = formatNumber(snapshot.enemyBullets);
    values.powerups.textContent = formatNumber(snapshot.powerups);
    values.bossHealth.textContent =
      snapshot.bossHealth === null ? "\u2014" : formatNumber(snapshot.bossHealth);
    values.bossPhase.textContent =
      snapshot.bossPhase === null ? "\u2014" : formatNumber(snapshot.bossPhase);
    values.bossMode.textContent = snapshot.bossShieldMode ?? "\u2014";
    values.bossTime.textContent =
      snapshot.bossElapsed === null ? "\u2014" : formatDuration(snapshot.bossElapsed);
    values.bossPhaseTime.textContent =
      snapshot.bossPhaseElapsed === null ? "\u2014" : formatDuration(snapshot.bossPhaseElapsed);
    values.bossTransition.textContent =
      snapshot.bossTransitionTimer === null
        ? "\u2014"
        : formatSeconds(snapshot.bossTransitionTimer);
    values.bossBeams.textContent = `${snapshot.bossBeamCount}${snapshot.bossBeamActive ? " active" : ""}`;
    values.bossSafeArcs.textContent = formatNumber(snapshot.bossSafeArcCount);
    values.pendingSpawns.textContent = formatNumber(snapshot.pendingSpawns);
    values.requiredEnemies.textContent = formatNumber(snapshot.waveStats.requiredEnemiesSpawned);
    values.destroyedEnemies.textContent = formatNumber(snapshot.waveStats.enemiesDestroyed);
    values.bombKills.textContent = formatNumber(snapshot.waveStats.enemiesKilledByBomb);
    values.breaches.textContent = formatNumber(snapshot.waveStats.enemiesBreached);
    values.escapes.textContent = formatNumber(snapshot.waveStats.enemiesEscaped);
    values.playerDamaged.textContent = formatBoolean(snapshot.waveStats.playerDamaged);
    values.bombUsed.textContent = formatBoolean(snapshot.waveStats.bombUsed);
    values.lastWaveClear.textContent = formatOutcome(snapshot.lastWaveOutcome?.waveClear);
    values.lastNoDamage.textContent = formatOutcome(snapshot.lastWaveOutcome?.noDamage);
    values.lastFullClear.textContent = formatOutcome(snapshot.lastWaveOutcome?.fullClear);
    values.lastPerfect.textContent = formatOutcome(snapshot.lastWaveOutcome?.perfect);
    values.accuracy.textContent = `${formatNumber(snapshot.run.accuracyPercent)}%`;
    values.runTime.textContent = formatDuration(snapshot.run.elapsedSeconds);
    values.hits.textContent = `${snapshot.run.shotsHit}/${snapshot.run.shotsFired}`;
    values.kills.textContent = formatNumber(snapshot.run.enemiesDestroyed);
    values.damage.textContent = formatNumber(snapshot.run.damageTaken);
    values.damageSource.textContent =
      snapshot.run.lastDamageSource === null
        ? "\u2014"
        : damageSourceLabel(snapshot.run.lastDamageSource, snapshot.run.lastDamageEnemyType);
    values.firstMove.textContent = formatSeconds(snapshot.run.firstMoveSeconds);
    values.firstShot.textContent = formatSeconds(snapshot.run.firstShotSeconds);
    values.firstDash.textContent = formatSeconds(snapshot.run.firstDashSeconds);
    values.waveOneTime.textContent = formatWaveTime(snapshot.run.waveTimings, 1);
    values.waveTwoTime.textContent = formatWaveTime(snapshot.run.waveTimings, 2);

    const events = options.getEvents().slice(-MAX_EVENT_LINES);
    const eventSignature = JSON.stringify(events);
    if (eventSignature !== lastEventSignature) {
      renderEvents(ownerDocument, eventLog, events);
      lastEventSignature = eventSignature;
    }
  };

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    seedForm.removeEventListener("submit", onSubmit);
    root.removeEventListener("click", onClick);
    root.removeEventListener("change", onChange);
    root.remove();
    releaseStyles();
  };

  update();

  return { dispose, update };
}

function panelMarkup(panelId: number): string {
  const seedId = `ob-debug-seed-${panelId}`;
  const invulnerableId = `ob-debug-invulnerable-${panelId}`;
  const timeScaleId = `ob-debug-time-scale-${panelId}`;
  const hitboxesId = `ob-debug-hitboxes-${panelId}`;

  const waveButtons = DEBUG_WAVES.map(
    (wave) =>
      `<button type="button" data-command="start-wave" data-wave="${wave}">Wave ${wave}</button>`,
  ).join("");
  const enemyButtons = ENEMY_TYPES.map(
    (enemyType) =>
      `<button type="button" data-command="spawn-enemy" data-enemy-type="${enemyType}">` +
      `Spawn ${enemyType}</button>`,
  ).join("");
  const timeScaleOptions = DEBUG_TIME_SCALES.map(
    (scale) => `<option value="${scale}"${scale === 1 ? " selected" : ""}>${scale}\u00d7</option>`,
  ).join("");

  return `
    <summary>Debug</summary>
    <div class="ob-debug__body">
      <form data-role="seed-form">
        <fieldset>
          <legend>Run</legend>
          <div class="ob-debug__row">
            <label for="${seedId}">Seed</label>
            <input id="${seedId}" data-role="seed" type="text" autocomplete="off" spellcheck="false" required>
          </div>
          <div class="ob-debug__buttons">
            <button type="button" data-command="set-seed">Set seed</button>
            <button type="submit" data-command="set-seed-restart">Set &amp; restart</button>
            <button type="button" data-command="restart">Restart</button>
          </div>
        </fieldset>
      </form>

      <fieldset>
        <legend>Scenario</legend>
        <div class="ob-debug__buttons">${waveButtons}</div>
        <div class="ob-debug__row">
          <button type="button" data-command="start-boss" data-phase="1">Start boss</button>
          <button type="button" data-command="start-boss" data-phase="2">Boss P2</button>
          <button type="button" data-command="start-boss" data-phase="3">Boss P3</button>
          <button type="button" data-command="force-state" data-state="gameOver">Game over</button>
          <button type="button" data-command="force-state" data-state="victory">Victory</button>
          <button type="button" data-command="spawn-player-contact">Test contact</button>
          <label for="${invulnerableId}">
            <input id="${invulnerableId}" data-role="invulnerable" type="checkbox">
            Invulnerable
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Clock &amp; display</legend>
        <div class="ob-debug__row">
          <label for="${timeScaleId}">Time scale</label>
          <select id="${timeScaleId}" data-role="time-scale">${timeScaleOptions}</select>
          <button type="button" data-command="single-step">Single step</button>
          <label for="${hitboxesId}">
            <input id="${hitboxesId}" data-role="hitboxes" type="checkbox">
            Show hitboxes
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Spawn enemy</legend>
        <div class="ob-debug__buttons">${enemyButtons}</div>
      </fieldset>

      <section aria-labelledby="ob-debug-performance-${panelId}">
        <h2 id="ob-debug-performance-${panelId}">Performance</h2>
        <dl class="ob-debug__metrics" aria-live="off">
          ${metric("FPS", "fps")}
          ${metric("Update", "update-ms")}
          ${metric("Render", "render-ms")}
          ${metric("Steps", "steps")}
          ${metric("Entities", "entities")}
          ${metric("Frame p95", "frame-p95")}
          ${metric("Over budget", "over-budget")}
          ${metric("Peak entities", "peak-entities")}
          ${metric("Peak heap", "peak-heap")}
          ${metric("Audio voices", "audio-pressure")}
        </dl>
      </section>

      <section aria-labelledby="ob-debug-snapshot-${panelId}">
        <h2 id="ob-debug-snapshot-${panelId}">Snapshot</h2>
        <dl class="ob-debug__metrics ob-debug__snapshot" aria-live="off">
          ${metric("State", "state")}
          ${metric("Wave", "wave")}
          ${metric("Score", "score")}
          ${metric("Lives", "lives")}
          ${metric("Enemies", "enemies")}
          ${metric("Shots", "player-shots")}
          ${metric("Bullets", "enemy-bullets")}
          ${metric("Power-ups", "powerups")}
          ${metric("Boss HP", "boss-health")}
          ${metric("Boss phase", "boss-phase")}
          ${metric("Shield", "boss-mode")}
          ${metric("Boss time", "boss-time")}
          ${metric("Phase time", "boss-phase-time")}
          ${metric("Transition", "boss-transition")}
          ${metric("Beams", "boss-beams")}
          ${metric("Safe arcs", "boss-safe-arcs")}
          ${metric("Pending", "pending-spawns")}
        </dl>
      </section>

      <section aria-labelledby="ob-debug-wave-outcome-${panelId}">
        <h2 id="ob-debug-wave-outcome-${panelId}">Wave outcome</h2>
        <dl class="ob-debug__metrics ob-debug__snapshot" aria-live="off">
          ${metric("Required", "wave-required")}
          ${metric("Destroyed", "wave-destroyed")}
          ${metric("Bomb kills", "wave-bomb-kills")}
          ${metric("Breaches", "wave-breaches")}
          ${metric("Escapes", "wave-escapes")}
          ${metric("Damaged", "wave-damaged")}
          ${metric("Bomb used", "wave-bomb-used")}
          ${metric("Last clear", "last-wave-clear")}
          ${metric("Last flawless", "last-no-damage")}
          ${metric("Last full", "last-full-clear")}
          ${metric("Last perfect", "last-perfect")}
        </dl>
      </section>

      <section aria-labelledby="ob-debug-summary-${panelId}">
        <h2 id="ob-debug-summary-${panelId}">Run summary</h2>
        <dl class="ob-debug__metrics ob-debug__snapshot" aria-live="off">
          ${metric("Accuracy", "accuracy")}
          ${metric("Run time", "run-time")}
          ${metric("Hits/Shots", "hits")}
          ${metric("Kills", "kills")}
          ${metric("Damage", "damage")}
          ${metric("Last source", "damage-source")}
          ${metric("First move", "first-move")}
          ${metric("First shot", "first-shot")}
          ${metric("First dash", "first-dash")}
          ${metric("Wave 1", "wave-one-time")}
          ${metric("Wave 2", "wave-two-time")}
        </dl>
      </section>

      <section aria-labelledby="ob-debug-events-${panelId}">
        <h2 id="ob-debug-events-${panelId}">Recent events</h2>
        <ol class="ob-debug__events" data-role="events" aria-live="polite" aria-relevant="additions text"></ol>
      </section>
    </div>
  `;
}

function metric(label: string, value: string): string {
  return `<div class="ob-debug__metric"><dt>${label}</dt><dd data-value="${value}">\u2014</dd></div>`;
}

function requireElement<ElementType extends Element>(
  root: ParentNode,
  selector: string,
): ElementType {
  const element = root.querySelector<ElementType>(selector);
  if (element === null) {
    throw new Error(`Debug panel is missing required element: ${selector}`);
  }
  return element;
}

function isDebugWave(value: number): value is DebugWave {
  return Number.isInteger(value) && value >= 1 && value <= 8;
}

function isDebugTimeScale(value: number): value is DebugTimeScale {
  return DEBUG_TIME_SCALES.some((scale) => scale === value);
}

function parseBossPhase(value: string | undefined): BossPhase {
  const phase = Number(value);
  return phase === 2 || phase === 3 ? phase : 1;
}

function formatNumber(value: number, fractionDigits = 0): string {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : "\u2014";
}

function formatMilliseconds(value: number): string {
  const formatted = formatNumber(value, 2);
  return formatted === "\u2014" ? formatted : `${formatted} ms`;
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatSeconds(value: number | null): string {
  return value === null ? "\u2014" : `${value.toFixed(1)} s`;
}

function formatBoolean(value: boolean): string {
  return value ? "yes" : "no";
}

function formatOutcome(value: boolean | undefined): string {
  return value === undefined ? "\u2014" : formatBoolean(value);
}

function formatWaveTime(
  timings: readonly { readonly wave: number; readonly seconds: number }[],
  wave: number,
): string {
  const timing = timings.find((candidate) => candidate.wave === wave);
  return timing === undefined ? "\u2014" : formatDuration(timing.seconds);
}

function renderEvents(
  ownerDocument: Document,
  eventLog: HTMLOListElement,
  events: readonly DebugEvent[],
): void {
  const fragment = ownerDocument.createDocumentFragment();

  if (events.length === 0) {
    const empty = ownerDocument.createElement("li");
    empty.className = "ob-debug__events-empty";
    empty.textContent = "No events yet.";
    fragment.append(empty);
  } else {
    for (const event of events) {
      const line = ownerDocument.createElement("li");
      line.textContent = `#${event.sequence} ${event.type} \u2014 ${event.summary}`;
      fragment.append(line);
    }
  }

  eventLog.replaceChildren(fragment);
  eventLog.scrollTop = eventLog.scrollHeight;
}

function retainStyles(ownerDocument: Document): () => void {
  let retained = stylesByDocument.get(ownerDocument);
  if (retained === undefined || !retained.element.isConnected) {
    const element = ownerDocument.createElement("style");
    element.dataset.orbitBreakerDebug = "";
    element.textContent = DEBUG_PANEL_CSS;
    ownerDocument.head.append(element);
    retained = { element, users: 0 };
    stylesByDocument.set(ownerDocument, retained);
  }

  retained.users += 1;
  let released = false;

  return () => {
    if (released) {
      return;
    }
    released = true;
    retained.users -= 1;
    if (retained.users === 0) {
      retained.element.remove();
      stylesByDocument.delete(ownerDocument);
    }
  };
}
