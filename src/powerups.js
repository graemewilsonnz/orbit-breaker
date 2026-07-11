(function () {
  "use strict";

  var CONFIG = window.RadialConfig;
  var M = window.RadialMath;

  var TYPES = ["twin", "shield", "bomb"];

  function PowerUp(type, angle, radius) {
    this.type = type || M.choose(TYPES);
    this.angle = M.normalizeAngle(angle);
    this.radius = radius;
    this.size = CONFIG.powerups.size;
    this.radialSpeed = CONFIG.powerups.radialSpeed;
    this.angularVelocity = M.rand(-0.28, 0.28);
    this.spin = 0;
    this.life = 13;
    this.active = true;
  }

  PowerUp.prototype.update = function (dt) {
    this.life -= dt;
    this.spin += dt * 4;
    this.angle = M.normalizeAngle(this.angle + this.angularVelocity * dt);
    this.radius += this.radialSpeed * dt;

    if (this.life <= 0 || this.radius > CONFIG.arena.outerKillRadius + 20) {
      this.active = false;
    }
  };

  PowerUp.prototype.position = function () {
    return M.polarToCartesian(this.angle, this.radius);
  };

  PowerUp.prototype.apply = function (game) {
    var player = game.player;

    if (this.type === "twin") {
      if (player.weaponLevel < 2) {
        player.weaponLevel = 2;
      } else if (player.weaponLevel < 3) {
        player.weaponLevel = 3;
        player.weaponTimer = CONFIG.powerups.weaponBoostDuration;
      } else {
        player.weaponTimer = CONFIG.powerups.weaponBoostDuration;
        game.addScore(750, null, true);
      }
    } else if (this.type === "shield") {
      player.shieldActive = true;
      player.shieldAngle = 0;
    } else if (this.type === "bomb") {
      player.bombCount = Math.min(CONFIG.player.maxBombs, player.bombCount + 1);
    }

    game.addEffect({
      type: "burst",
      x: this.position().x,
      y: this.position().y,
      color: this.getColor(),
      size: 38,
      duration: 0.34
    });
    game.audio.play("powerup");
    this.active = false;
  };

  PowerUp.prototype.getColor = function () {
    if (this.type === "shield") {
      return CONFIG.colors.powerShield;
    }
    if (this.type === "bomb") {
      return CONFIG.colors.powerBomb;
    }
    return CONFIG.colors.powerTwin;
  };

  PowerUp.prototype.render = function (ctx) {
    var p = this.position();
    var color = this.getColor();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(this.spin);
    ctx.globalAlpha = Math.max(0.35, Math.min(1, this.life));
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.fillStyle = "rgba(5, 7, 13, 0.7)";
    ctx.lineWidth = 2.5;

    if (this.type === "shield") {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, CONFIG.TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.54, -0.9, Math.PI + 0.9);
      ctx.stroke();
    } else if (this.type === "bomb") {
      ctx.beginPath();
      ctx.moveTo(0, -this.size);
      ctx.lineTo(this.size, 0);
      ctx.lineTo(0, this.size);
      ctx.lineTo(-this.size, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, CONFIG.TAU);
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.rect(-this.size * 0.72, -this.size * 0.72, this.size * 1.44, this.size * 1.44);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-7, -2);
      ctx.lineTo(-1, -8);
      ctx.lineTo(7, 8);
      ctx.moveTo(0, -8);
      ctx.lineTo(7, -8);
      ctx.lineTo(7, -1);
      ctx.stroke();
    }

    ctx.restore();
  };

  function chooseDropType() {
    var roll = Math.random();
    if (roll < 0.38) {
      return "twin";
    }
    if (roll < 0.72) {
      return "shield";
    }
    return "bomb";
  }

  window.RadialPowerUp = PowerUp;
  window.RadialPowerUps = {
    chooseDropType: chooseDropType
  };
}());
