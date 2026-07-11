(function () {
  "use strict";

  var CONFIG = window.RadialConfig;
  var M = window.RadialMath;

  function Projectile(options) {
    this.owner = options.owner;
    this.angle = M.normalizeAngle(options.angle);
    this.radius = options.radius;
    this.radialSpeed = options.radialSpeed;
    this.angularVelocity = options.angularVelocity || 0;
    this.size = options.size || CONFIG.projectiles.playerSize;
    this.damage = options.damage || 1;
    this.pierce = options.pierce || 0;
    this.color = options.color || CONFIG.colors.playerBullet;
    this.active = true;
    this.age = 0;
  }

  Projectile.prototype.update = function (dt) {
    this.age += dt;
    this.angle = M.normalizeAngle(this.angle + this.angularVelocity * dt);
    this.radius += this.radialSpeed * dt;

    if (this.owner === "player" && this.radius < -24) {
      this.active = false;
    }
    if (this.owner === "enemy" && this.radius > CONFIG.arena.outerKillRadius + 52) {
      this.active = false;
    }
  };

  Projectile.prototype.position = function () {
    return M.polarToCartesian(this.angle, this.radius);
  };

  Projectile.prototype.render = function (ctx) {
    var head = this.position();
    var tailRadius = this.radius - Math.sign(this.radialSpeed || 1) * 13;
    var tail = M.polarToCartesian(this.angle, tailRadius);

    ctx.save();
    ctx.globalAlpha = this.owner === "player" ? 0.95 : 0.88;
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = this.owner === "player" ? 3 : 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(head.x, head.y, this.size, 0, CONFIG.TAU);
    ctx.fill();
    ctx.restore();
  };

  window.RadialProjectile = Projectile;
}());
