import { CONFIG } from "../config";
import type { ReadonlyBossState, ReadonlyGameState } from "../state";

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
  context.strokeStyle = "rgba(255, 255, 255, 0.65)";
  context.lineWidth = 1;
  context.strokeRect(x, y, width, height);
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = "600 13px Segoe UI, Arial, sans-serif";
  context.fillStyle = CONFIG.colors.text;
  context.fillText("MOTHERSHIP", CONFIG.canvas.width / 2, y + 17);
  context.restore();
}

export function renderOverlay(context: CanvasRenderingContext2D, state: ReadonlyGameState): void {
  switch (state.state) {
    case "playing":
      return;
    case "waveClear":
      drawOverlay(context, 0.25);
      headline(context, "WAVE CLEAR", 292, 46);
      subline(context, state.lastWavePerfect ? "PERFECT WAVE +1000" : "REGROUP", 352);
      return;
    case "bossIntro":
      drawOverlay(context, 0.33);
      headline(context, "CENTRE BREACH", 286, 44);
      subline(context, "MOTHERSHIP SIGNAL LOCKED", 348);
      return;
    case "paused":
      drawOverlay(context, 0.48);
      headline(context, "PAUSED", 305, 50);
      subline(context, "P OR ESCAPE TO RESUME", 366);
      return;
    case "gameOver":
      drawOverlay(context, 0.58);
      headline(context, "GAME OVER", 260, 54);
      subline(
        context,
        `SCORE ${formatScore(state.player.score)}   REACHED ${
          state.boss ? "BOSS" : `WAVE ${state.waveReached}`
        }`,
        334,
      );
      subline(context, "PRESS ENTER TO RESTART", 376);
      return;
    case "victory":
      drawOverlay(context, 0.5);
      headline(context, "VICTORY", 252, 56);
      subline(context, `FINAL SCORE ${formatScore(state.player.score)}`, 330);
      subline(context, "PRESS ENTER TO PLAY AGAIN", 374);
      return;
    case "title":
      drawTitle(context);
  }
}

function drawTitle(context: CanvasRenderingContext2D): void {
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
  context.font = "500 17px Segoe UI, Arial, sans-serif";
  context.fillText(
    "Left/A and Right/D rotate   Space/Z fire   Shift/X dash   B/C bomb   P/Escape pause",
    CONFIG.canvas.width / 2,
    334,
  );

  context.fillStyle = CONFIG.colors.playerAccent;
  context.font = "700 24px Segoe UI, Arial, sans-serif";
  context.fillText("PRESS ENTER TO START", CONFIG.canvas.width / 2, 414);
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

function subline(context: CanvasRenderingContext2D, text: string, y: number): void {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = CONFIG.colors.mutedText;
  context.font = "600 18px Segoe UI, Arial, sans-serif";
  context.fillText(text, CONFIG.canvas.width / 2, y);
  context.restore();
}

export function formatScore(score: number): string {
  return String(Math.floor(score)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
