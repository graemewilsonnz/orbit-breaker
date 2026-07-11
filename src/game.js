(function () {
  "use strict";

  var CONFIG = window.RadialConfig;
  var M = window.RadialMath;
  var Player = window.RadialPlayer;
  var Projectile = window.RadialProjectile;
  var PowerUp = window.RadialPowerUp;
  var PowerUps = window.RadialPowerUps;
  var Enemies = window.RadialEnemies;
  var WaveManager = window.RadialWaveManager;
  var MothershipBoss = window.RadialMothershipBoss;
  var UI = window.RadialUI;

  function InputManager(audio) {
    this.audio = audio;
    this.down = {};
    this.pressed = {};
    this.bind();
  }

  InputManager.prototype.bind = function () {
    var self = this;
    window.addEventListener("keydown", function (event) {
      var action = keyToAction(event.code);
      if (!action) {
        return;
      }
      event.preventDefault();
      self.audio.init();
      if (!self.down[action]) {
        self.pressed[action] = true;
      }
      self.down[action] = true;
    });

    window.addEventListener("keyup", function (event) {
      var action = keyToAction(event.code);
      if (!action) {
        return;
      }
      event.preventDefault();
      self.down[action] = false;
    });

    window.addEventListener("blur", function () {
      self.down = {};
      self.pressed = {};
    });
  };

  InputManager.prototype.isDown = function (action) {
    return Boolean(this.down[action]);
  };

  InputManager.prototype.wasPressed = function (action) {
    return Boolean(this.pressed[action]);
  };

  InputManager.prototype.endFrame = function () {
    this.pressed = {};
  };

  function keyToAction(code) {
    if (code === "ArrowLeft" || code === "KeyA") {
      return "left";
    }
    if (code === "ArrowRight" || code === "KeyD") {
      return "right";
    }
    if (code === "Space" || code === "KeyZ") {
      return "fire";
    }
    if (code === "ShiftLeft" || code === "ShiftRight" || code === "KeyX") {
      return "dash";
    }
    if (code === "KeyB" || code === "KeyC") {
      return "bomb";
    }
    if (code === "KeyP" || code === "Escape") {
      return "pause";
    }
    if (code === "Enter" || code === "NumpadEnter") {
      return "enter";
    }
    return null;
  }

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.canvas.width = CONFIG.canvas.width;
    this.canvas.height = CONFIG.canvas.height;
    this.audio = window.RadialAudio();
    this.input = new InputManager(this.audio);
    this.player = new Player();
    this.waveManager = new WaveManager(this);
    this.enemies = [];
    this.playerShots = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.effects = [];
    this.stars = [];
    this.boss = null;
    this.state = "title";
    this.stateTimer = 0;
    this.currentWave = 1;
    this.waveReached = 1;
    this.killStreak = 0;
    this.perfectWave = true;
    this.lastWavePerfect = false;
    this.shake = 0;
    this.initStars();
  }

  Game.prototype.initStars = function () {
    this.stars = [];
    for (var i = 0; i < 150; i += 1) {
      this.stars.push({
        angle: Math.random() * CONFIG.TAU,
        radius: Math.random() * (CONFIG.arena.outerKillRadius + 50),
        speed: M.rand(18, 86),
        size: M.rand(0.7, 2.2)
      });
    }
  };

  Game.prototype.startRun = function () {
    this.player.reset();
    this.enemies = [];
    this.playerShots = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.effects = [];
    this.boss = null;
    this.currentWave = 1;
    this.waveReached = 1;
    this.killStreak = 0;
    this.perfectWave = true;
    this.lastWavePerfect = false;
    this.shake = 0;
    this.waveManager.start(1);
    this.state = "playing";
    this.stateTimer = 0;
  };

  Game.prototype.frame = function (dt) {
    this.update(dt);
    this.render();
    this.input.endFrame();
  };

  Game.prototype.update = function (dt) {
    this.updateStars(dt);

    if (this.state === "title") {
      if (this.input.wasPressed("enter")) {
        this.startRun();
      }
      return;
    }

    if (this.state === "gameOver" || this.state === "victory") {
      this.updateEffects(dt);
      if (this.input.wasPressed("enter")) {
        this.startRun();
      }
      return;
    }

    if (this.state === "paused") {
      if (this.input.wasPressed("pause")) {
        this.state = "playing";
      }
      return;
    }

    if (this.state === "waveClear") {
      this.stateTimer -= dt;
      this.updatePowerups(dt);
      this.handlePowerupCollisions();
      this.updateEffects(dt);
      if (this.stateTimer <= 0) {
        this.afterWaveClear();
      }
      return;
    }

    if (this.state === "bossIntro") {
      this.stateTimer -= dt;
      this.updatePowerups(dt);
      this.handlePowerupCollisions();
      this.updateEffects(dt);
      if (this.stateTimer <= 0) {
        this.boss = new MothershipBoss();
        this.state = "playing";
      }
      return;
    }

    if (this.input.wasPressed("pause")) {
      this.state = "paused";
      return;
    }

    this.updatePlaying(dt);
  };

  Game.prototype.updatePlaying = function (dt) {
    this.player.update(dt, this.input, this);

    for (var i = 0; i < this.enemies.length; i += 1) {
      this.enemies[i].update(dt, this);
    }
    if (this.boss) {
      this.boss.update(dt, this);
    }
    for (i = 0; i < this.playerShots.length; i += 1) {
      this.playerShots[i].update(dt);
    }
    for (i = 0; i < this.enemyBullets.length; i += 1) {
      this.enemyBullets[i].update(dt);
    }

    this.updatePowerups(dt);
    this.updateShieldLinks();
    this.handleCollisions();
    this.updateEffects(dt);
    this.cleanup();

    if (this.player.lives <= 0 && this.state === "playing") {
      this.gameOver();
      return;
    }

    if (this.state === "playing") {
      this.waveManager.update(dt);
    }
  };

  Game.prototype.updateStars = function (dt) {
    for (var i = 0; i < this.stars.length; i += 1) {
      var star = this.stars[i];
      star.radius += star.speed * dt;
      if (star.radius > CONFIG.arena.outerKillRadius + 80) {
        star.angle = Math.random() * CONFIG.TAU;
        star.radius = M.rand(0, 18);
        star.speed = M.rand(18, 86);
        star.size = M.rand(0.7, 2.2);
      }
    }
  };

  Game.prototype.updatePowerups = function (dt) {
    for (var i = 0; i < this.powerups.length; i += 1) {
      this.powerups[i].update(dt);
    }
  };

  Game.prototype.updateEffects = function (dt) {
    for (var i = 0; i < this.effects.length; i += 1) {
      var effect = this.effects[i];
      effect.age = (effect.age || 0) + dt;
      effect.active = effect.age < effect.duration;
    }
    this.effects = this.effects.filter(function (effect) {
      return effect.active;
    });
    this.shake = Math.max(0, this.shake - dt);
  };

  Game.prototype.spawnEnemy = function (type, angle, overrides) {
    this.enemies.push(Enemies.create(type, angle, overrides));
  };

  Game.prototype.completeWave = function () {
    if (this.state !== "playing" || this.boss) {
      return;
    }

    this.lastWavePerfect = this.perfectWave;
    if (this.perfectWave) {
      this.addScore(CONFIG.scoring.perfectWaveBonus, null, true);
    }

    if (this.currentWave === 8) {
      this.spawnPreBossDrops();
    }

    this.state = "waveClear";
    this.stateTimer = 1.7;
    this.audio.play("waveClear");
  };

  Game.prototype.afterWaveClear = function () {
    if (this.currentWave >= 8) {
      this.state = "bossIntro";
      this.stateTimer = 2.15;
      this.audio.play("bossWarning");
      return;
    }

    this.currentWave += 1;
    this.waveReached = Math.max(this.waveReached, this.currentWave);
    this.perfectWave = true;
    this.waveManager.start(this.currentWave);
    this.state = "playing";
  };

  Game.prototype.spawnPreBossDrops = function () {
    var types = ["twin", "shield", "bomb"];
    for (var i = 0; i < types.length; i += 1) {
      this.powerups.push(new PowerUp(types[i], this.player.angle + (i - 1) * 0.12, this.player.radius - 20));
    }
  };

  Game.prototype.defeatBoss = function () {
    this.addScore(CONFIG.boss.score, null, true);
    if (this.player.bombCount > 0) {
      this.addScore(this.player.bombCount * CONFIG.scoring.unusedBombVictoryBonus, null, true);
    }
    this.state = "victory";
    this.stateTimer = 0;
    this.enemyBullets = [];
    this.enemies = [];
    this.powerups = [];
    this.addEffect({
      type: "bossPulse",
      x: CONFIG.arena.centerX,
      y: CONFIG.arena.centerY,
      color: CONFIG.colors.playerAccent,
      size: 260,
      duration: 0.9
    });
    this.shake = 0.35;
    this.audio.play("waveClear");
  };

  Game.prototype.gameOver = function () {
    this.state = "gameOver";
    this.stateTimer = 0;
    this.audio.play("gameOver");
  };

  Game.prototype.addScore = function (base, source, flat) {
    var amount = base;
    if (source && source.radius <= CONFIG.scoring.earlyKillRadius) {
      amount += Math.round(base * CONFIG.scoring.earlyKillBonus);
    }
    if (!flat) {
      amount *= this.player.multiplier;
    }
    this.player.score += Math.round(amount);
  };

  Game.prototype.registerKill = function (enemy, allowDrop) {
    this.addScore(enemy.score, enemy, false);
    this.killStreak += 1;
    this.player.multiplier = Math.min(
      CONFIG.scoring.maxMultiplier,
      1 + Math.floor(this.killStreak / CONFIG.scoring.killsPerMultiplier)
    );

    this.addEffect({
      type: "burst",
      angle: enemy.angle,
      radius: enemy.radius,
      color: enemy.getColor(),
      size: enemy.size * 3.2,
      duration: 0.28
    });
    this.audio.play("enemyDestroyed");

    if (allowDrop) {
      this.maybeDropPowerUp(enemy);
    }
  };

  Game.prototype.maybeDropPowerUp = function (enemy) {
    var chance = this.currentWave % 3 === 0 ? CONFIG.powerups.thirdWaveDropChance : CONFIG.powerups.baseDropChance;
    if (Math.random() < chance) {
      this.powerups.push(new PowerUp(PowerUps.chooseDropType(), enemy.angle, Math.max(42, enemy.radius)));
    }
  };

  Game.prototype.activateBomb = function () {
    if (this.player.bombCount <= 0 || this.state !== "playing") {
      return;
    }

    this.player.bombCount -= 1;
    for (var i = 0; i < this.enemies.length; i += 1) {
      if (this.enemies[i].active) {
        this.enemies[i].active = false;
        this.registerKill(this.enemies[i], false);
      }
    }
    this.enemyBullets = [];

    if (this.boss && this.boss.active) {
      this.boss.health -= 5;
      this.boss.hitFlash = 0.1;
      if (this.boss.health <= 0) {
        this.boss.active = false;
        this.defeatBoss();
      }
    }

    this.addEffect({
      type: "bomb",
      x: this.player.position().x,
      y: this.player.position().y,
      color: CONFIG.colors.powerBomb,
      size: 360,
      duration: 0.48
    });
    this.shake = Math.max(this.shake, 0.22);
    this.audio.play("bomb");
  };

  Game.prototype.onPlayerDamaged = function () {
    this.perfectWave = false;
    this.killStreak = 0;
    this.player.multiplier = 1;
    this.clearNearbyEnemyBullets(125);
    this.addEffect({
      type: "burst",
      angle: this.player.angle,
      radius: this.player.radius,
      color: CONFIG.colors.enemyBullet,
      size: 68,
      duration: 0.32
    });
    this.shake = Math.max(this.shake, 0.26);
    this.audio.play("playerHit");
  };

  Game.prototype.clearNearbyEnemyBullets = function (radius) {
    var playerPos = this.player.position();
    for (var i = 0; i < this.enemyBullets.length; i += 1) {
      var bulletPos = this.enemyBullets[i].position();
      if (M.distance(playerPos.x, playerPos.y, bulletPos.x, bulletPos.y) <= radius) {
        this.enemyBullets[i].active = false;
      }
    }
  };

  Game.prototype.updateShieldLinks = function () {
    var carriers = this.enemies.filter(function (enemy) {
      return enemy.active && enemy.type === "shield";
    });

    for (var i = 0; i < this.enemies.length; i += 1) {
      var enemy = this.enemies[i];
      enemy.shielded = false;
      if (!enemy.active || enemy.type === "shield") {
        continue;
      }
      for (var c = 0; c < carriers.length; c += 1) {
        if (M.polarDistance(enemy, carriers[c]) <= carriers[c].shieldRadius) {
          enemy.shielded = true;
          break;
        }
      }
    }
  };

  Game.prototype.handleCollisions = function () {
    this.handleShotEnemyCollisions();
    this.handleShotBossCollisions();
    this.handlePlayerDangerCollisions();
    this.handlePowerupCollisions();
  };

  Game.prototype.handleShotEnemyCollisions = function () {
    for (var s = 0; s < this.playerShots.length; s += 1) {
      var shot = this.playerShots[s];
      if (!shot.active) {
        continue;
      }
      var shotPos = shot.position();

      for (var e = 0; e < this.enemies.length; e += 1) {
        var enemy = this.enemies[e];
        if (!enemy.active) {
          continue;
        }

        var enemyPos = enemy.position();
        var hit = M.distance(shotPos.x, shotPos.y, enemyPos.x, enemyPos.y) <= shot.size + enemy.size * 0.82;
        if (!hit) {
          continue;
        }

        if (enemy.shielded && enemy.type !== "shield") {
          shot.active = false;
          enemy.hitFlash = 0.12;
          this.addEffect({
            type: "burst",
            x: enemyPos.x,
            y: enemyPos.y,
            color: CONFIG.colors.shield,
            size: 24,
            duration: 0.16
          });
          this.audio.play("enemyHit");
          break;
        }

        if (enemy.damage(shot.damage)) {
          enemy.active = false;
          this.registerKill(enemy, true);
        } else {
          this.audio.play("enemyHit");
        }

        if (shot.pierce > 0) {
          shot.pierce -= 1;
        } else {
          shot.active = false;
          break;
        }
      }
    }
  };

  Game.prototype.handleShotBossCollisions = function () {
    if (!this.boss || !this.boss.active) {
      return;
    }

    for (var i = 0; i < this.playerShots.length; i += 1) {
      if (this.playerShots[i].active) {
        this.boss.handleShot(this.playerShots[i], this);
      }
    }
  };

  Game.prototype.handlePlayerDangerCollisions = function () {
    var playerPos = this.player.position();
    var playerCircle = {
      x: playerPos.x,
      y: playerPos.y,
      size: this.player.size * 0.72
    };

    for (var i = 0; i < this.enemyBullets.length; i += 1) {
      var bullet = this.enemyBullets[i];
      if (!bullet.active) {
        continue;
      }
      var bulletPos = bullet.position();
      if (M.circleOverlap(playerCircle, { x: bulletPos.x, y: bulletPos.y, size: bullet.size * 0.9 })) {
        bullet.active = false;
        this.player.takeHit(this);
      }
    }

    for (i = 0; i < this.enemies.length; i += 1) {
      var enemy = this.enemies[i];
      if (!enemy.active) {
        continue;
      }
      var enemyPos = enemy.position();
      if (M.circleOverlap(playerCircle, { x: enemyPos.x, y: enemyPos.y, size: enemy.size * 0.66 })) {
        enemy.active = false;
        this.player.takeHit(this);
        this.addEffect({
          type: "burst",
          x: enemyPos.x,
          y: enemyPos.y,
          color: enemy.getColor(),
          size: enemy.size * 2.6,
          duration: 0.22
        });
      }
    }
  };

  Game.prototype.handlePowerupCollisions = function () {
    var playerPos = this.player.position();
    for (var i = 0; i < this.powerups.length; i += 1) {
      var powerup = this.powerups[i];
      if (!powerup.active) {
        continue;
      }
      var p = powerup.position();
      if (M.distance(playerPos.x, playerPos.y, p.x, p.y) <= this.player.size + powerup.size + 6) {
        powerup.apply(this);
      }
    }
    this.powerups = this.powerups.filter(function (powerup) {
      return powerup.active;
    });
  };

  Game.prototype.cleanup = function () {
    this.enemies = this.enemies.filter(function (enemy) {
      return enemy.active;
    });
    this.playerShots = this.playerShots.filter(function (shot) {
      return shot.active;
    });
    this.enemyBullets = this.enemyBullets.filter(function (shot) {
      return shot.active;
    });
    this.powerups = this.powerups.filter(function (powerup) {
      return powerup.active;
    });
    if (this.boss && !this.boss.active && this.state !== "victory") {
      this.boss = null;
    }
  };

  Game.prototype.addEffect = function (effect) {
    effect.age = 0;
    effect.active = true;
    this.effects.push(effect);
  };

  Game.prototype.render = function () {
    var ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    if (this.shake > 0) {
      var amount = this.shake * 16;
      ctx.translate(M.rand(-amount, amount), M.rand(-amount, amount));
    }

    this.renderBackground(ctx);

    if (this.boss && this.boss.active) {
      this.boss.render(ctx);
    }
    for (var i = 0; i < this.powerups.length; i += 1) {
      this.powerups[i].render(ctx);
    }
    for (i = 0; i < this.enemies.length; i += 1) {
      this.enemies[i].render(ctx);
    }
    for (i = 0; i < this.playerShots.length; i += 1) {
      this.playerShots[i].render(ctx);
    }
    for (i = 0; i < this.enemyBullets.length; i += 1) {
      this.enemyBullets[i].render(ctx);
    }
    this.renderEffects(ctx);

    if (this.state !== "title") {
      this.player.render(ctx);
    }

    ctx.restore();

    UI.renderHud(ctx, this);
    UI.renderOverlay(ctx, this);
  };

  Game.prototype.renderBackground = function (ctx) {
    var cx = CONFIG.arena.centerX;
    var cy = CONFIG.arena.centerY;

    ctx.fillStyle = CONFIG.colors.background;
    ctx.fillRect(-20, -20, CONFIG.canvas.width + 40, CONFIG.canvas.height + 40);

    for (var i = 0; i < this.stars.length; i += 1) {
      var star = this.stars[i];
      var p = M.polarToCartesian(star.angle, star.radius);
      var tail = M.polarToCartesian(star.angle, Math.max(0, star.radius - 8));
      var alpha = M.clamp(star.radius / 280, 0.15, 0.9);
      ctx.strokeStyle = "rgba(180, 226, 255, " + alpha + ")";
      ctx.lineWidth = star.size;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = CONFIG.colors.guide;
    ctx.lineWidth = 1;
    for (i = 0; i < 24; i += 1) {
      var angle = i * CONFIG.TAU / 24;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 34, Math.sin(angle) * 34);
      ctx.lineTo(Math.cos(angle) * CONFIG.arena.playerRadius, Math.sin(angle) * CONFIG.arena.playerRadius);
      ctx.stroke();
    }

    for (i = 0; i < CONFIG.arena.guideRings.length; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, CONFIG.arena.guideRings[i], 0, CONFIG.TAU);
      ctx.stroke();
    }

    ctx.strokeStyle = CONFIG.colors.ring;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.arena.playerRadius, 0, CONFIG.TAU);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 107, 107, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, CONFIG.arena.dangerRadius, 0, CONFIG.TAU);
    ctx.stroke();
    ctx.restore();
  };

  Game.prototype.renderEffects = function (ctx) {
    for (var i = 0; i < this.effects.length; i += 1) {
      var effect = this.effects[i];
      var t = effect.age / effect.duration;
      var alpha = Math.max(0, 1 - t);
      var pos = effect.x == null ? M.polarToCartesian(effect.angle, effect.radius) : { x: effect.x, y: effect.y };

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = effect.color || CONFIG.colors.player;
      ctx.fillStyle = effect.color || CONFIG.colors.player;
      ctx.lineWidth = effect.type === "bomb" ? 4 : 3;
      ctx.shadowColor = effect.color || CONFIG.colors.player;
      ctx.shadowBlur = 18;

      if (effect.type === "bomb") {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, effect.size * t, 0, CONFIG.TAU);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.16;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, effect.size * t * 0.72, 0, CONFIG.TAU);
        ctx.fill();
      } else if (effect.type === "bossPulse") {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, effect.size * t, 0, CONFIG.TAU);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, effect.size * (0.25 + t), 0, CONFIG.TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  window.RadialGame = Game;
}());
