(function () {
  "use strict";

  var CONFIG = window.RadialConfig;

  function renderHud(ctx, game) {
    if (!game.player || game.state === "title" || game.state === "gameOver" || game.state === "victory") {
      return;
    }

    ctx.save();
    ctx.font = "600 18px Segoe UI, Arial, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillStyle = CONFIG.colors.text;
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 6;

    ctx.fillText("SCORE " + formatScore(game.player.score), 22, 18);
    ctx.fillText("LIVES " + game.player.lives, 22, 44);
    ctx.fillText("WAVE " + (game.boss ? "BOSS" : game.currentWave), 22, 70);

    ctx.textAlign = "right";
    ctx.fillText("x" + game.player.multiplier + " MULT", CONFIG.canvas.width - 22, 18);
    ctx.fillText("BOMBS " + game.player.bombCount, CONFIG.canvas.width - 22, 44);
    ctx.fillText("WEAPON L" + game.player.weaponLevel, CONFIG.canvas.width - 22, 70);

    if (game.boss && game.boss.active) {
      renderBossBar(ctx, game.boss);
    }

    ctx.restore();
  }

  function renderBossBar(ctx, boss) {
    var width = 360;
    var height = 12;
    var x = CONFIG.canvas.width / 2 - width / 2;
    var y = 22;
    var pct = Math.max(0, boss.health / boss.maxHealth);

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = CONFIG.colors.boss;
    ctx.fillRect(x, y, width * pct, height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "600 13px Segoe UI, Arial, sans-serif";
    ctx.fillStyle = CONFIG.colors.text;
    ctx.fillText("MOTHERSHIP", CONFIG.canvas.width / 2, y + 17);
    ctx.restore();
  }

  function renderOverlay(ctx, game) {
    if (game.state === "playing") {
      return;
    }

    if (game.state === "waveClear") {
      drawOverlay(ctx, 0.25);
      headline(ctx, "WAVE CLEAR", 292, 46);
      subline(ctx, game.lastWavePerfect ? "PERFECT WAVE +1000" : "REGROUP", 352);
      return;
    }

    if (game.state === "bossIntro") {
      drawOverlay(ctx, 0.33);
      headline(ctx, "CENTRE BREACH", 286, 44);
      subline(ctx, "MOTHERSHIP SIGNAL LOCKED", 348);
      return;
    }

    if (game.state === "paused") {
      drawOverlay(ctx, 0.48);
      headline(ctx, "PAUSED", 305, 50);
      subline(ctx, "P OR ESCAPE TO RESUME", 366);
      return;
    }

    if (game.state === "gameOver") {
      drawOverlay(ctx, 0.58);
      headline(ctx, "GAME OVER", 260, 54);
      subline(ctx, "SCORE " + formatScore(game.player.score) + "   REACHED " + (game.boss ? "BOSS" : "WAVE " + game.waveReached), 334);
      subline(ctx, "PRESS ENTER TO RESTART", 376);
      return;
    }

    if (game.state === "victory") {
      drawOverlay(ctx, 0.5);
      headline(ctx, "VICTORY", 252, 56);
      subline(ctx, "FINAL SCORE " + formatScore(game.player.score), 330);
      subline(ctx, "PRESS ENTER TO PLAY AGAIN", 374);
      return;
    }

    drawTitle(ctx);
  }

  function drawTitle(ctx) {
    drawOverlay(ctx, 0.1);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(77, 224, 255, 0.7)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = CONFIG.colors.player;
    ctx.font = "800 64px Segoe UI, Arial, sans-serif";
    ctx.fillText("ORBIT BREAKER", CONFIG.canvas.width / 2, 220);

    ctx.shadowBlur = 0;
    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = "600 20px Segoe UI, Arial, sans-serif";
    ctx.fillText("Circle the outer ring. Fire into the centre. Survive the waves.", CONFIG.canvas.width / 2, 280);

    ctx.fillStyle = CONFIG.colors.mutedText;
    ctx.font = "500 17px Segoe UI, Arial, sans-serif";
    ctx.fillText("Left/A and Right/D rotate   Space/Z fire   Shift/X dash   B/C bomb   P/Escape pause", CONFIG.canvas.width / 2, 334);

    ctx.fillStyle = CONFIG.colors.playerAccent;
    ctx.font = "700 24px Segoe UI, Arial, sans-serif";
    ctx.fillText("PRESS ENTER TO START", CONFIG.canvas.width / 2, 414);
    ctx.restore();
  }

  function drawOverlay(ctx, alpha) {
    ctx.save();
    ctx.fillStyle = "rgba(2, 4, 8, " + alpha + ")";
    ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
    ctx.restore();
  }

  function headline(ctx, text, y, size) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(77, 224, 255, 0.55)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = "800 " + size + "px Segoe UI, Arial, sans-serif";
    ctx.fillText(text, CONFIG.canvas.width / 2, y);
    ctx.restore();
  }

  function subline(ctx, text, y) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = CONFIG.colors.mutedText;
    ctx.font = "600 18px Segoe UI, Arial, sans-serif";
    ctx.fillText(text, CONFIG.canvas.width / 2, y);
    ctx.restore();
  }

  function formatScore(score) {
    return String(Math.floor(score)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  window.RadialUI = {
    renderHud: renderHud,
    renderOverlay: renderOverlay,
    formatScore: formatScore
  };
}());
