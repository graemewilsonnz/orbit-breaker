(function () {
  "use strict";

  var CONFIG = window.RadialConfig;
  var M = window.RadialMath;
  var Projectile = window.RadialProjectile;

  function valueFromRange(value) {
    return Array.isArray(value) ? M.rand(value[0], value[1]) : value;
  }

  function Enemy(type, angle, overrides) {
    var options = overrides || {};
    var stats = CONFIG.enemies[type];
    this.type = type;
    this.angle = M.normalizeAngle(angle);
    this.radius = options.radius == null ? CONFIG.arena.enemySpawnRadius : options.radius;
    this.health = options.health || stats.health;
    this.maxHealth = this.health;
    this.radialSpeed = options.radialSpeed || valueFromRange(stats.radialSpeed);
    this.angularVelocity = options.angularVelocity || 0;
    this.turnRate = options.turnRate || 0;
    this.fireRadius = 0;
    this.fireCooldown = 0;
    this.fireTimer = 0;
    this.size = stats.size;
    this.score = stats.score;
    this.active = true;
    this.age = 0;
    this.hitFlash = 0;
    this.shielded = false;
    this.hasFiredIntro = false;

    if (type === "spiral") {
      this.angularVelocity = valueFromRange(stats.angularVelocity) * (Math.random() < 0.5 ? -1 : 1);
    } else if (type === "hunter") {
      this.turnRate = valueFromRange(stats.turnRate);
    } else if (type === "shooter") {
      this.fireRadius = valueFromRange(stats.fireRadius);
      this.fireCooldown = valueFromRange(stats.fireCooldown);
      this.fireTimer = M.rand(0.4, 0.9);
    } else if (type === "shield") {
      this.angularVelocity = M.rand(-0.18, 0.18);
      this.shieldRadius = stats.shieldRadius;
    }
  }

  Enemy.prototype.position = function () {
    return M.polarToCartesian(this.angle, this.radius);
  };

  Enemy.prototype.update = function (dt, game) {
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (this.type === "spiral") {
      this.angle = M.normalizeAngle(this.angle + this.angularVelocity * dt);
      this.radius += this.radialSpeed * dt;
    } else if (this.type === "hunter") {
      this.angle = M.moveAngleToward(this.angle, game.player.angle, this.turnRate * dt);
      this.radius += this.radialSpeed * dt;
    } else if (this.type === "shooter") {
      if (this.radius < this.fireRadius) {
        this.radius += this.radialSpeed * dt;
      } else {
        this.radius += 16 * dt;
        this.angle = M.moveAngleToward(this.angle, game.player.angle, 1.25 * dt);
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
          this.fire(game);
          this.fireTimer = valueFromRange(CONFIG.enemies.shooter.fireCooldown);
        }
      }
    } else if (this.type === "shield") {
      this.angle = M.normalizeAngle(this.angle + this.angularVelocity * dt);
      this.radius += this.radialSpeed * dt;
    } else {
      this.radius += this.radialSpeed * dt;
    }

    if (this.radius > CONFIG.arena.outerKillRadius + this.size) {
      this.active = false;
    }
  };

  Enemy.prototype.fire = function (game) {
    game.enemyBullets.push(new Projectile({
      owner: "enemy",
      angle: this.angle,
      radius: this.radius + this.size,
      radialSpeed: CONFIG.projectiles.enemySpeed,
      size: CONFIG.projectiles.enemySize,
      color: CONFIG.colors.enemyBullet
    }));
    game.addEffect({
      type: "burst",
      angle: this.angle,
      radius: this.radius,
      color: CONFIG.colors.shooter,
      size: 24,
      duration: 0.14
    });
  };

  Enemy.prototype.damage = function (amount) {
    if (this.shielded && this.type !== "shield") {
      this.hitFlash = 0.12;
      return false;
    }

    this.health -= amount;
    this.hitFlash = 0.08;
    return this.health <= 0;
  };

  Enemy.prototype.getColor = function () {
    if (this.hitFlash > 0) {
      return "#ffffff";
    }
    if (this.type === "drifter") {
      return CONFIG.colors.drifter;
    }
    if (this.type === "spiral") {
      return CONFIG.colors.spiral;
    }
    if (this.type === "mine") {
      return CONFIG.colors.mine;
    }
    if (this.type === "shooter") {
      return CONFIG.colors.shooter;
    }
    if (this.type === "hunter") {
      return CONFIG.colors.hunter;
    }
    return CONFIG.colors.shield;
  };

  Enemy.prototype.render = function (ctx) {
    var p = this.position();
    var color = this.getColor();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(this.angle + Math.PI / 2);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    if (this.shielded && this.type !== "shield") {
      ctx.strokeStyle = CONFIG.colors.shieldAura;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, this.size + 7, 0, CONFIG.TAU);
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = 1.5;

    if (this.type === "drifter") {
      drawPolygon(ctx, 4, this.size, Math.PI / 4);
    } else if (this.type === "spiral") {
      drawSpiral(ctx, this.size, this.age);
    } else if (this.type === "mine") {
      drawMine(ctx, this.size, this.age);
    } else if (this.type === "shooter") {
      drawShooter(ctx, this.size);
    } else if (this.type === "hunter") {
      drawHunter(ctx, this.size);
    } else if (this.type === "shield") {
      drawShieldCarrier(ctx, this.size, this.age);
    }

    if (this.health > 1 || this.health < this.maxHealth) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
      ctx.fillRect(-this.size, this.size + 7, this.size * 2, 3);
      ctx.fillStyle = color;
      ctx.fillRect(-this.size, this.size + 7, this.size * 2 * Math.max(0, this.health / this.maxHealth), 3);
    }

    ctx.restore();
  };

  function drawPolygon(ctx, sides, radius, rotation) {
    ctx.beginPath();
    for (var i = 0; i < sides; i += 1) {
      var angle = rotation + i * CONFIG.TAU / sides;
      var x = Math.cos(angle) * radius;
      var y = Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawSpiral(ctx, size, age) {
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.9, size * 0.8);
    ctx.lineTo(0, size * 0.42);
    ctx.lineTo(-size * 0.9, size * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.rotate(age * 4);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.55, 0.4, Math.PI * 1.55);
    ctx.stroke();
  }

  function drawMine(ctx, size, age) {
    var pulse = 1 + Math.sin(age * 6) * 0.08;
    ctx.beginPath();
    for (var i = 0; i < 12; i += 1) {
      var r = i % 2 === 0 ? size * 1.05 * pulse : size * 0.58 * pulse;
      var a = i * CONFIG.TAU / 12;
      var x = Math.cos(a) * r;
      var y = Math.sin(a) * r;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawShooter(ctx, size) {
    ctx.beginPath();
    ctx.rect(-size * 0.75, -size * 0.75, size * 1.5, size * 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(5, 7, 13, 0.72)";
    ctx.fillRect(-5, -size - 7, 10, size);
    ctx.strokeRect(-5, -size - 7, 10, size);
  }

  function drawHunter(ctx, size) {
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.18);
    ctx.lineTo(size, size * 0.86);
    ctx.lineTo(0, size * 0.35);
    ctx.lineTo(-size, size * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawShieldCarrier(ctx, size, age) {
    drawPolygon(ctx, 6, size, Math.PI / 6);
    ctx.strokeStyle = CONFIG.colors.shieldAura;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, size + 7 + Math.sin(age * 3) * 2, 0, CONFIG.TAU);
    ctx.stroke();
  }

  function createEnemy(type, angle, overrides) {
    return new Enemy(type, angle, overrides);
  }

  window.RadialEnemy = Enemy;
  window.RadialEnemies = {
    create: createEnemy
  };
}());
