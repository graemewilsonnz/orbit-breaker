(function () {
  "use strict";

  var CONFIG = window.RadialConfig;
  var M = window.RadialMath;
  var Enemies = window.RadialEnemies;

  function MothershipBoss() {
    this.health = CONFIG.boss.health;
    this.maxHealth = CONFIG.boss.health;
    this.rotation = 0;
    this.phase = 1;
    this.attackTimer = 2.0;
    this.spawnTimer = 3.2;
    this.beams = [];
    this.active = true;
    this.hitFlash = 0;
    this.phaseAwarded = {
      2: false,
      3: false
    };
  }

  MothershipBoss.prototype.update = function (dt, game) {
    if (!this.active) {
      return;
    }

    this.rotation = M.normalizeAngle(this.rotation + CONFIG.boss.rotationSpeed * dt * (this.phase === 3 ? 1.45 : 1));
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.updatePhase(game);
    this.updateBeams(dt, game);

    if (this.phase >= 2) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.startBeamAttack(game);
        this.attackTimer = this.phase === 3 ? 2.45 : 3.25;
      }
    }

    if (this.phase >= 3) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnPressure(game);
        this.spawnTimer = 2.15;
      }
    }
  };

  MothershipBoss.prototype.updatePhase = function (game) {
    var nextPhase = 1;
    if (this.health <= CONFIG.boss.phase3Threshold) {
      nextPhase = 3;
    } else if (this.health <= CONFIG.boss.phase2Threshold) {
      nextPhase = 2;
    }

    if (nextPhase !== this.phase) {
      this.phase = nextPhase;
      if (!this.phaseAwarded[nextPhase]) {
        this.phaseAwarded[nextPhase] = true;
        game.addScore(CONFIG.scoring.bossPhaseBonus, null, true);
        game.addEffect({
          type: "bossPulse",
          x: CONFIG.arena.centerX,
          y: CONFIG.arena.centerY,
          color: CONFIG.colors.bossCore,
          size: 150,
          duration: 0.45
        });
        game.shake = Math.max(game.shake, 0.18);
        game.audio.play("waveClear");
      }
    }
  };

  MothershipBoss.prototype.updateBeams = function (dt, game) {
    for (var i = 0; i < this.beams.length; i += 1) {
      var beam = this.beams[i];
      beam.timer += dt;
      beam.active = beam.timer >= CONFIG.boss.warningTime;

      if (beam.active) {
        var inArc = M.angularDistance(game.player.angle, beam.angle) < beam.width * 0.5;
        if (inArc) {
          game.player.takeHit(game);
        }
      }

      if (beam.timer > CONFIG.boss.warningTime + CONFIG.boss.beamTime) {
        beam.done = true;
      }
    }

    this.beams = this.beams.filter(function (beam) {
      return !beam.done;
    });
  };

  MothershipBoss.prototype.startBeamAttack = function (game) {
    var count = this.phase === 3 ? 5 : 4;
    var width = this.phase === 3 ? 0.18 : 0.15;
    var base = M.normalizeAngle(this.rotation + M.rand(-0.24, 0.24));

    for (var i = 0; i < count; i += 1) {
      this.beams.push({
        angle: M.normalizeAngle(base + i * CONFIG.TAU / count),
        width: width,
        timer: 0,
        active: false
      });
    }

    game.audio.play("bossWarning");
  };

  MothershipBoss.prototype.spawnPressure = function (game) {
    var base = Math.random() * CONFIG.TAU;
    game.enemies.push(Enemies.create("drifter", base, { radius: CONFIG.arena.enemySpawnRadius + 15 }));
    game.enemies.push(Enemies.create("spiral", base + Math.PI * 0.85, { radius: CONFIG.arena.enemySpawnRadius + 15 }));
  };

  MothershipBoss.prototype.handleShot = function (shot, game) {
    if (!this.active || shot.radius > CONFIG.arena.bossHitRadius) {
      return false;
    }

    if (this.isBlocked(shot.angle)) {
      shot.active = false;
      game.addEffect({
        type: "burst",
        angle: shot.angle,
        radius: CONFIG.arena.bossHitRadius,
        color: CONFIG.colors.shield,
        size: 24,
        duration: 0.18
      });
      game.audio.play("enemyHit");
      return true;
    }

    this.health -= shot.damage;
    this.hitFlash = 0.08;
    shot.active = false;
    game.shake = Math.max(game.shake, 0.05);
    game.addEffect({
      type: "burst",
      angle: shot.angle,
      radius: CONFIG.boss.coreRadius,
      color: CONFIG.colors.bossCore,
      size: 30,
      duration: 0.18
    });
    game.audio.play("enemyHit");

    if (this.health <= 0) {
      this.active = false;
      game.defeatBoss();
    }

    return true;
  };

  MothershipBoss.prototype.isBlocked = function (angle) {
    var panels = 4;
    var panelWidth = this.phase === 3 ? CONFIG.boss.panelWidth * 0.78 : CONFIG.boss.panelWidth;
    for (var i = 0; i < panels; i += 1) {
      var panelAngle = this.rotation + i * CONFIG.TAU / panels;
      if (M.angularDistance(angle, panelAngle) < panelWidth * 0.5) {
        return true;
      }
    }
    return false;
  };

  MothershipBoss.prototype.render = function (ctx) {
    this.renderBeams(ctx);
    this.renderCore(ctx);
  };

  MothershipBoss.prototype.renderBeams = function (ctx) {
    var centerX = CONFIG.arena.centerX;
    var centerY = CONFIG.arena.centerY;
    var length = CONFIG.arena.outerKillRadius + 40;

    for (var i = 0; i < this.beams.length; i += 1) {
      var beam = this.beams[i];
      var alpha = beam.active ? 0.84 : 0.28 + Math.sin(beam.timer * 28) * 0.08;
      var width = beam.active ? 23 : 12;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(beam.angle);
      ctx.strokeStyle = beam.active ? CONFIG.colors.beam : CONFIG.colors.warning;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(length, 0);
      ctx.stroke();
      ctx.restore();
    }
  };

  MothershipBoss.prototype.renderCore = function (ctx) {
    var cx = CONFIG.arena.centerX;
    var cy = CONFIG.arena.centerY;
    var flash = this.hitFlash > 0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = CONFIG.colors.boss;
    ctx.shadowBlur = 18;

    ctx.fillStyle = flash ? "#ffffff" : "rgba(240, 91, 120, 0.32)";
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.boss.coreRadius + 10, 0, CONFIG.TAU);
    ctx.fill();

    ctx.strokeStyle = CONFIG.colors.boss;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.boss.coreRadius + 9, 0, CONFIG.TAU);
    ctx.stroke();

    ctx.fillStyle = flash ? "#ffffff" : CONFIG.colors.bossCore;
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.boss.coreRadius * 0.58, 0, CONFIG.TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.boss.coreRadius * 0.34, 0, CONFIG.TAU);
    ctx.stroke();

    ctx.rotate(this.rotation);
    for (var i = 0; i < 4; i += 1) {
      var start = i * CONFIG.TAU / 4 - CONFIG.boss.panelWidth * 0.5;
      var end = i * CONFIG.TAU / 4 + CONFIG.boss.panelWidth * 0.5;
      ctx.strokeStyle = CONFIG.colors.shield;
      ctx.lineWidth = 13;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, CONFIG.boss.panelRadius, start, end);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.58)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, CONFIG.boss.panelRadius, start, end);
      ctx.stroke();
    }

    ctx.restore();
  };

  window.RadialMothershipBoss = MothershipBoss;
}());
