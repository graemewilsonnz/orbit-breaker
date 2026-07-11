(function () {
  "use strict";

  var CONFIG = window.RadialConfig;
  var TAU = CONFIG.TAU;

  function normalizeAngle(angle) {
    angle %= TAU;
    return angle < 0 ? angle + TAU : angle;
  }

  function signedAngleDelta(from, to) {
    var delta = normalizeAngle(to) - normalizeAngle(from);
    if (delta > Math.PI) {
      delta -= TAU;
    } else if (delta < -Math.PI) {
      delta += TAU;
    }
    return delta;
  }

  function angularDistance(a, b) {
    return Math.abs(signedAngleDelta(a, b));
  }

  function polarToCartesian(angle, radius, centerX, centerY) {
    var cx = centerX == null ? CONFIG.arena.centerX : centerX;
    var cy = centerY == null ? CONFIG.arena.centerY : centerY;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    };
  }

  function distance(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function circleOverlap(a, b, padding) {
    var extra = padding || 0;
    return distance(a.x, a.y, b.x, b.y) <= (a.size + b.size + extra);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function choose(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function moveAngleToward(current, target, maxStep) {
    var delta = signedAngleDelta(current, target);
    if (Math.abs(delta) <= maxStep) {
      return normalizeAngle(target);
    }
    return normalizeAngle(current + Math.sign(delta) * maxStep);
  }

  function polarDistance(a, b) {
    var pa = polarToCartesian(a.angle, a.radius);
    var pb = polarToCartesian(b.angle, b.radius);
    return distance(pa.x, pa.y, pb.x, pb.y);
  }

  window.RadialMath = {
    normalizeAngle: normalizeAngle,
    signedAngleDelta: signedAngleDelta,
    angularDistance: angularDistance,
    polarToCartesian: polarToCartesian,
    distance: distance,
    circleOverlap: circleOverlap,
    clamp: clamp,
    rand: rand,
    choose: choose,
    moveAngleToward: moveAngleToward,
    polarDistance: polarDistance
  };
}());
