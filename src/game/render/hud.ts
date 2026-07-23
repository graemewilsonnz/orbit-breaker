import { CONFIG } from "../config";
import { getBossPhaseDefinition } from "../content/boss";
import { accuracyPercent, damageSourceLabel, type ReadonlyRunMetrics } from "../runMetrics";
import type { ReadonlyBossState, ReadonlyGameState } from "../state";

export interface OverlayPresentation {
  readonly highScore: number;
  readonly muted: boolean;
  readonly newHighScore: boolean;
  readonly reducedShake: boolean;
}

export function renderHud(context: CanvasRenderingContext2D, state: ReadonlyGameState): void {
  if (state.state === "title" || state.state === "gameOver" || state.state === "victory") {
    return;
  }

  context.save();
  context.font = "600 18px Segoe UI, Arial, sans-serif";
  context.textBaseline = "top";
  context.fillStyle = CONFIG.colors.text;
  context.shadowColor = "rgba(0, 0, 0, 0.8)";
  context.shadowBlur = 6;

  context.fillText(`SCORE ${formatScore(state.player.score)}`, 22, 18);
  context.fillText(`LIVES ${state.player.lives}`, 22, 44);
  context.fillText(`WAVE ${state.boss ? "BOSS" : state.currentWave}`, 22, 70);

  context.textAlign = "right";
  context.fillText(`x${state.player.multiplier} MULT`, CONFIG.canvas.width - 22, 18);
  context.fillText(`BOMBS ${state.player.bombCount}`, CONFIG.canvas.width - 22, 44);
  context.fillText(`WEAPON L${state.player.weaponLevel}`, CONFIG.canvas.width - 22, 70);

  if (state.scoreFeedback !== null) {
    const alpha = Math.min(1, state.scoreFeedback.timer * 2.5);
    context.globalAlpha = alpha;
    context.textAlign = "center";
    context.fillStyle =
      state.scoreFeedback.primary === "CHAIN LOST"
        ? CONFIG.colors.enemyBullet
        : CONFIG.colors.playerAccent;
    context.font = "800 24px Segoe UI, Arial, sans-serif";
    context.fillText(state.scoreFeedback.primary, CONFIG.canvas.width / 2, 82);
    context.fillStyle = CONFIG.colors.text;
    context.font = "700 13px Segoe UI, Arial, sans-serif";
    context.fillText(state.scoreFeedback.secondary, CONFIG.canvas.width / 2, 111);
    context.globalAlpha = 1;
  } else if (state.wave.definition !== null && state.wave.elapsed < 3.2 && !state.boss) {
    const alpha = Math.min(1, state.wave.elapsed * 2, (3.2 - state.wave.elapsed) * 1.5);
    context.globalAlpha = Math.max(0, alpha);
    context.textAlign = "center";
    context.fillStyle = CONFIG.colors.text;
    context.font = "700 18px Segoe UI, Arial, sans-serif";
    context.fillText(state.wave.definition.name.toUpperCase(), CONFIG.canvas.width / 2, 82);
    context.fillStyle = CONFIG.colors.mutedText;
    context.font = "600 13px Segoe UI, Arial, sans-serif";
    context.fillText(state.wave.definition.identity, CONFIG.canvas.width / 2, 108);
    context.globalAlpha = 1;
  }

  if (state.boss?.active) {
    renderBossBar(context, state.boss);
  }

  context.restore();
}

function renderBossBar(context: CanvasRenderingContext2D, boss: ReadonlyBossState): void {
  const width = 360;
  const height = 12;
  const x = CONFIG.canvas.width / 2 - width / 2;
  const y = 22;
  const percentage = Math.max(0, boss.health / boss.maxHealth);

  context.save();
  context.shadowBlur = 0;
  context.fillStyle = "rgba(0, 0, 0, 0.55)";
  context.fillRect(x, y, width, height);
  context.fillStyle = CONFIG.colors.boss;
  context.fillRect(x, y, width * percentage, height);
  context.fillStyle = "rgba(255, 255, 255, 0.72)";
  for (const phase of CONFIG.boss.phases.slice(0, -1)) {
    const markerX = x + width * (phase.healthFloor / boss.maxHealth);
    context.fillRect(markerX - 1, y, 2, height);
  }
  context.strokeStyle = "rgba(255, 255, 255, 0.65)";
  context.lineWidth = 1;
  context.strokeRect(x, y, width, height);
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = "600 13px Segoe UI, Arial, sans-serif";
  context.fillStyle = CONFIG.colors.text;
  const phase = getBossPhaseDefinition(boss.phase);
  context.fillText(
    `MOTHERSHIP · PHASE ${boss.phase}/3 · ${phase.name.toUpperCase()}`,
    CONFIG.canvas.width / 2,
    y + 17,
  );
  context.fillStyle =
    boss.shieldMode === "vulnerable" ? CONFIG.colors.bossCore : CONFIG.colors.text;
  context.font = "700 12px Segoe UI, Arial, sans-serif";
  context.fillText(
    boss.noticeTimer > 0 ? boss.noticeText : bossStatus(boss),
    CONFIG.canvas.width / 2,
    y + 36,
  );
  context.restore();
}

function bossStatus(boss: ReadonlyBossState): string {
  if (boss.transitionTimer > 0) {
    return "PHASE SHIFT · ATTACKS SUSPENDED";
  }
  if (boss.beams.some((beam) => beam.active)) {
    return "BEAMS ACTIVE";
  }
  if (boss.beams.length > 0) {
    return "RADIAL LOCK · MOVE TO CYAN SAFE ARC";
  }
  switch (boss.shieldMode) {
    case "guarded":
      return "SHIELD LOCKED";
    case "opening":
      return "APERTURE FORMING · FOLLOW GOLD";
    case "vulnerable":
      return "CORE EXPOSED · FIRE THROUGH GOLD";
    case "recovering":
      return "SHIELD REFORMING";
  }
}

export function renderOverlay(
  context: CanvasRenderingContext2D,
  state: ReadonlyGameState,
  presentation: OverlayPresentation = {
    highScore: 0,
    muted: false,
    newHighScore: false,
    reducedShake: false,
  },
): void {
  switch (state.state) {
    case "playing":
      return;
    case "waveClear":
      drawOverlay(context, 0.25);
      headline(context, "WAVE CLEAR", 232, 46);
      subline(
        context,
        `REQUIRED ${state.waveStats.requiredEnemiesSpawned}   ` +
          `DESTROYED ${state.waveStats.enemiesDestroyed} ` +
          `(BOMB ${state.waveStats.enemiesKilledByBomb})`,
        294,
        CONFIG.colors.text,
      );
      subline(
        context,
        `BREACHED ${state.waveStats.enemiesBreached}   ` +
          `ESCAPED ${state.waveStats.enemiesEscaped}`,
        324,
      );
      outcomeLine(context, "FLAWLESS / NO DAMAGE", state.lastWaveOutcome?.noDamage ?? false, 370);
      outcomeLine(context, "FULL CLEAR", state.lastWaveOutcome?.fullClear ?? false, 404);
      outcomeLine(
        context,
        `PERFECT +${formatScore(CONFIG.scoring.perfectWaveBonus)}`,
        state.lastWaveOutcome?.perfect ?? false,
        438,
        true,
      );
      return;
    case "bossIntro":
      drawOverlay(context, 0.33);
      headline(context, "CENTRE BREACH", 286, 44);
      subline(context, "MOTHERSHIP SIGNAL LOCKED", 348);
      return;
    case "paused":
      drawOverlay(context, 0.48);
      headline(context, "PAUSED", 305, 50);
      subline(context, pauseReasonLabel(state.pauseReason), 358, CONFIG.colors.text);
      subline(context, "P OR ESCAPE TO RESUME", 390, CONFIG.colors.playerAccent);
      return;
    case "gameOver":
      drawOverlay(context, 0.58);
      headline(context, "GAME OVER", 218, 54);
      subline(
        context,
        `SCORE ${formatScore(state.player.score)}   BEST ${formatScore(presentation.highScore)}   REACHED ${
          state.boss ? "BOSS" : `WAVE ${state.waveReached}`
        }`,
        286,
      );
      if (presentation.newHighScore) {
        badge(context, "NEW HIGH SCORE", 314);
      }
      renderRunSummary(context, state.runMetrics, 336);
      subline(context, "PRESS ENTER TO RESTART", 462, CONFIG.colors.playerAccent);
      return;
    case "victory":
      drawOverlay(context, 0.5);
      headline(context, "VICTORY", 212, 56);
      subline(
        context,
        `FINAL SCORE ${formatScore(state.player.score)}   BEST ${formatScore(presentation.highScore)}`,
        282,
      );
      if (presentation.newHighScore) {
        badge(context, "NEW HIGH SCORE", 310);
      }
      renderRunSummary(context, state.runMetrics, 332);
      if (state.boss !== null) {
        const durations = state.boss.phaseDurations;
        subline(
          context,
          `BOSS ${formatDuration(state.boss.elapsed)}  ` +
            `P1 ${formatBossPhaseDuration(durations[1])}  ` +
            `P2 ${formatBossPhaseDuration(durations[2])}  ` +
            `P3 ${formatBossPhaseDuration(durations[3])}`,
          428,
        );
      }
      subline(context, "PRESS ENTER TO PLAY AGAIN", 470, CONFIG.colors.playerAccent);
      return;
    case "title":
      drawTitle(context, presentation);
  }
}

function drawTitle(context: CanvasRenderingContext2D, presentation: OverlayPresentation): void {
  drawOverlay(context, 0.1);

  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(77, 224, 255, 0.7)";
  context.shadowBlur = 18;
  context.fillStyle = CONFIG.colors.player;
  context.font = "800 64px Segoe UI, Arial, sans-serif";
  context.fillText("ORBIT BREAKER", CONFIG.canvas.width / 2, 220);

  context.shadowBlur = 0;
  context.fillStyle = CONFIG.colors.text;
  context.font = "600 20px Segoe UI, Arial, sans-serif";
  context.fillText(
    "Circle the outer ring. Fire into the centre. Survive the waves.",
    CONFIG.canvas.width / 2,
    280,
  );

  context.fillStyle = CONFIG.colors.mutedText;
  context.font = "500 17px Bahnschrift, Segoe UI, Arial, sans-serif";
  context.fillText(
    "Left/A and Right/D rotate   Space/Z fire   Shift/X dash",
    CONFIG.canvas.width / 2,
    326,
  );
  context.fillText("B/C bomb   P/Escape pause", CONFIG.canvas.width / 2, 354);

  context.fillStyle = CONFIG.colors.mutedText;
  context.font = "600 14px Bahnschrift, Segoe UI, Arial, sans-serif";
  context.fillText(
    `M ${presentation.muted ? "UNMUTE" : "MUTE"}   F FULLSCREEN   S SETTINGS`,
    CONFIG.canvas.width / 2,
    384,
  );

  context.fillStyle = CONFIG.colors.playerAccent;
  context.font = "700 24px Segoe UI, Arial, sans-serif";
  context.fillText("PRESS ENTER TO START", CONFIG.canvas.width / 2, 430);

  context.fillStyle = CONFIG.colors.text;
  context.font = "700 16px Bahnschrift, Segoe UI, Arial, sans-serif";
  context.fillText(
    `LOCAL HIGH SCORE  ${formatScore(presentation.highScore)}`,
    CONFIG.canvas.width / 2,
    474,
  );
  context.restore();
}

function drawOverlay(context: CanvasRenderingContext2D, alpha: number): void {
  context.save();
  context.fillStyle = `rgba(2, 4, 8, ${alpha})`;
  context.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
  context.restore();
}

function headline(context: CanvasRenderingContext2D, text: string, y: number, size: number): void {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(77, 224, 255, 0.55)";
  context.shadowBlur = 18;
  context.fillStyle = CONFIG.colors.text;
  context.font = `800 ${size}px Segoe UI, Arial, sans-serif`;
  context.fillText(text, CONFIG.canvas.width / 2, y);
  context.restore();
}

function subline(
  context: CanvasRenderingContext2D,
  text: string,
  y: number,
  color: string = CONFIG.colors.mutedText,
): void {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.font = "600 18px Segoe UI, Arial, sans-serif";
  context.fillText(text, CONFIG.canvas.width / 2, y);
  context.restore();
}

function badge(context: CanvasRenderingContext2D, text: string, y: number): void {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = CONFIG.colors.playerAccent;
  context.shadowColor = CONFIG.colors.playerAccent;
  context.shadowBlur = 10;
  context.font = "800 13px Bahnschrift, Segoe UI, Arial, sans-serif";
  context.fillText(text, CONFIG.canvas.width / 2, y);
  context.restore();
}

function pauseReasonLabel(reason: ReadonlyGameState["pauseReason"]): string {
  switch (reason) {
    case "focus":
      return "AUTO-PAUSED · WINDOW FOCUS LOST";
    case "settings":
      return "SETTINGS OPENED · GAMEPLAY HELD";
    case "manual":
      return "SIMULATION HELD · DANGER FROZEN";
  }
}

function outcomeLine(
  context: CanvasRenderingContext2D,
  label: string,
  achieved: boolean,
  y: number,
  scored = false,
): void {
  const status = achieved ? (scored ? "AWARDED" : "ACHIEVED") : "MISSED";
  subline(
    context,
    `${label} — ${status}`,
    y,
    achieved ? CONFIG.colors.playerAccent : CONFIG.colors.mutedText,
  );
}

function renderRunSummary(
  context: CanvasRenderingContext2D,
  metrics: ReadonlyRunMetrics,
  startY: number,
): void {
  const lastDamage =
    metrics.lastDamageSource === null
      ? "NO DAMAGE"
      : damageSourceLabel(metrics.lastDamageSource, metrics.lastDamageEnemyType);
  subline(
    context,
    `ACCURACY ${accuracyPercent(metrics)}%  ${metrics.shotsHit}/${metrics.shotsFired} HITS` +
      `     DAMAGE ${metrics.damageTaken}  ${lastDamage}`,
    startY,
    CONFIG.colors.text,
  );

  const firstWave = metrics.waveTimings.find((timing) => timing.wave === 1);
  const secondWave = metrics.waveTimings.find((timing) => timing.wave === 2);
  subline(
    context,
    `RUN ${formatDuration(metrics.elapsedSeconds)}` +
      `     W1 ${firstWave ? formatDuration(firstWave.seconds) : "--:--"}` +
      `     W2 ${secondWave ? formatDuration(secondWave.seconds) : "--:--"}`,
    startY + 32,
  );
  subline(
    context,
    `FIRST MOVE ${formatFirstAction(metrics.firstMoveSeconds)}` +
      `     FIRE ${formatFirstAction(metrics.firstShotSeconds)}` +
      `     DASH ${formatFirstAction(metrics.firstDashSeconds)}`,
    startY + 64,
  );
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatFirstAction(seconds: number | null): string {
  return seconds === null ? "--" : `${seconds.toFixed(1)}s`;
}

function formatBossPhaseDuration(seconds: number | null): string {
  return seconds === null ? "--:--" : formatDuration(seconds);
}

export function formatScore(score: number): string {
  return String(Math.floor(score)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
