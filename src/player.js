(function () {
  "use strict";

  var CONFIG = window.RadialConfig;
  var M = window.RadialMath;
  var Projectile = window.RadialProjectile;

  function Player() {
    this.reset();
  }

  Player.prototype.reset = function () {
    this.angle = -Math.PI / 2;
    this.radius = CONFIG.arena.playerRadius;
    this.rotationSpeed = CONFIG.player.rotationSpeed;
    this.fireCooldown = 0;
    this.dashCooldown = 0;
    this.lives = CONFIG.player.lives;
    this.invulnerabilityTimer = 0;
    this.dashInvulnerabilityTimer = 0;
    this.weaponLevel = 1;
    this.weaponTimer = 0;
    this.shieldActive = false;
    this.shieldAngle = 0;
    this.bombCount = CONFIG.player.startingBombs;
    this.score = 0;
    this.multiplier = 1;
    this.lastMoveDirection = 1;
    this.flashTimer = 0;
    this.size = CONFIG.player.size;
  };

  Player.prototype.update = function (dt, input, game) {
    var moveDirection = 0;
    if (input.isDown("left")) {
      moveDirection -= 1;
    }
    if (input.isDown("right")) {
      moveDirection += 1;
    }

    if (moveDirection !== 0) {
      this.lastMoveDirection = moveDirection;
      this.angle = M.normalizeAngle(this.angle + moveDirection * this.rotationSpeed * dt);
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    this.dashInvulnerabilityTimer = Math.max(0, this.dashInvulnerabilityTimer - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.shieldAngle = M.normalizeAngle(this.shieldAngle + dt * 4.2);

    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0 && this.weaponLevel > 2) {
        this.weaponLevel = 2;
      }
    }

    if (input.wasPressed("dash")) {
      this.dash(game);
    }
    if (input.isDown("fire")) {
      this.fire(game);
    }
    if (input.wasPressed("bomb")) {
      game.activateBomb();
    }
  };

  Player.prototype.dash = function (game) {
    if (this.dashCooldown > 0) {
      return;
    }

    this.angle = M.normalizeAngle(this.angle + this.lastMoveDirection * CONFIG.player.dashDistance);
    this.dashCooldown = CONFIG.player.dashCooldown;
    this.dashInvulnerabilityTimer = CONFIG.player.dashInvulnerability;
    game.addEffect({
      type: "ring",
      angle: this.angle,
      radius: this.radius,
      color: CONFIG.colors.player,
      size: 42,
      duration: 0.18
    });
    game.audio.play("dash");
  };

  Player.prototype.fire = function (game) {
    if (this.fireCooldown > 0) {
      return;
    }

    var offsets = [0];
    var pierce = 0;
    if (this.weaponLevel >= 2) {
      offsets = [-CONFIG.projectiles.twinOffset, CONFIG.projectiles.twinOffset];
    }
    if (this.weaponLevel >= 3) {
      pierce = 1;
    }

    for (var i = 0; i < offsets.length; i += 1) {
      game.playerShots.push(new Projectile({
        owner: "player",
        angle: this.angle + offsets[i],
        radius: this.radius - 20,
        radialSpeed: -CONFIG.projectiles.playerSpeed,
        size: CONFIG.projectiles.playerSize,
        pierce: pierce,
        color: CONFIG.colors.playerBullet
      }));
    }

    this.fireCooldown = CONFIG.player.fireCooldown;
    game.audio.play("fire");
  };

  Player.prototype.isVulnerable = function () {
    return this.invulnerabilityTimer <= 0 && this.dashInvulnerabilityTimer <= 0;
  };

  Player.prototype.takeHit = function (game) {
    if (!this.isVulnerable()) {
      return false;
    }

    if (this.shieldActive) {
      this.shieldActive = false;
      this.invulnerabilityTimer = 0.35;
      game.clearNearbyEnemyBullets(115);
      game.addEffect({
        type: "burst",
        angle: this.angle,
        radius: this.radius,
        color: CONFIG.colors.powerShield,
        size: 62,
        duration: 0.28
      });
      game.audio.play("playerHit");
      return false;
    }

    this.lives -= 1;
    this.invulnerabilityTimer = CONFIG.player.invulnerabilityAfterHit;
    this.flashTimer = CONFIG.player.invulnerabilityAfterHit;
    game.onPlayerDamaged();
    return true;
  };

  Player.prototype.position = function () {
    return M.polarToCartesian(this.angle, this.radius);
  };

  Player.prototype.render = function (ctx) {
    var p = this.position();
    var flicker = this.invulnerabilityTimer > 0 && Math.floor(this.invulnerabilityTimer * 18) % 2 === 0;
    if (flicker) {
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(this.angle + Math.PI);
    ctx.shadowColor = CONFIG.colors.player;
    ctx.shadowBlur = 16;

    ctx.fillStyle = this.dashInvulnerabilityTimer > 0 ? CONFIG.colors.playerAccent : CONFIG.colors.player;
    ctx.strokeStyle = "#eaffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-11, -10);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = CONFIG.colors.playerAccent;
    ctx.beginPath();
    ctx.moveTo(-13, -5);
    ctx.lineTo(-21, 0);
    ctx.lineTo(-13, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (this.shieldActive) {
      var shieldPos = {
        x: p.x + Math.cos(this.shieldAngle) * CONFIG.player.shieldOrbitRadius,
        y: p.y + Math.sin(this.shieldAngle) * CONFIG.player.shieldOrbitRadius
      };
      ctx.save();
      ctx.strokeStyle = CONFIG.colors.powerShield;
      ctx.fillStyle = "rgba(97, 232, 255, 0.18)";
      ctx.shadowColor = CONFIG.colors.powerShield;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, CONFIG.player.shieldOrbitRadius, 0, CONFIG.TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(shieldPos.x, shieldPos.y, 8, 0, CONFIG.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  };

  window.RadialPlayer = Player;
}());
