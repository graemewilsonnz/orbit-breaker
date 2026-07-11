(function () {
  "use strict";

  var CONFIG = window.RadialConfig;
  var M = window.RadialMath;

  var WAVE_DEFS = [
    {
      name: "Wave 1: Entry",
      groups: [
        { type: "drifter", count: 10, start: 0.5, interval: 0.62, pattern: "sweep", step: 0.62 }
      ]
    },
    {
      name: "Wave 2: More Angles",
      groups: [
        { type: "drifter", count: 8, start: 0.4, interval: 0.48, pattern: "mirror", step: 0.42 },
        { type: "drifter", count: 8, start: 3.2, interval: 0.42, pattern: "random" }
      ]
    },
    {
      name: "Wave 3: Spiral Introduction",
      groups: [
        { type: "drifter", count: 7, start: 0.4, interval: 0.5, pattern: "sweep", step: 0.55 },
        { type: "spiral", count: 8, start: 2.2, interval: 0.6, pattern: "fan", spread: 1.8 }
      ]
    },
    {
      name: "Wave 4: First Pressure Mix",
      groups: [
        { type: "drifter", count: 7, start: 0.4, interval: 0.46, pattern: "random" },
        { type: "spiral", count: 6, start: 1.8, interval: 0.6, pattern: "sweep", step: -0.7 },
        { type: "hunter", count: 4, start: 4.8, interval: 0.72, pattern: "mirror", step: 0.52 }
      ]
    },
    {
      name: "Wave 5: Minefield",
      groups: [
        { type: "mine", count: 7, start: 0.4, interval: 0.78, pattern: "sweep", step: 0.75 },
        { type: "drifter", count: 10, start: 2.2, interval: 0.48, pattern: "random" }
      ]
    },
    {
      name: "Wave 6: Crossfire",
      groups: [
        { type: "shooter", count: 5, start: 0.5, interval: 1.15, pattern: "fan", spread: 2.7 },
        { type: "drifter", count: 8, start: 1.4, interval: 0.48, pattern: "mirror", step: 0.48 },
        { type: "spiral", count: 6, start: 4.2, interval: 0.54, pattern: "random" }
      ]
    },
    {
      name: "Wave 7: Priority Targets",
      groups: [
        { type: "shield", count: 2, start: 0.5, interval: 3.2, pattern: "mirror", step: 0.0 },
        { type: "drifter", count: 10, start: 1.0, interval: 0.45, pattern: "fan", spread: 2.4 },
        { type: "hunter", count: 5, start: 4.3, interval: 0.7, pattern: "random" }
      ]
    },
    {
      name: "Wave 8: Final Mixed Wave",
      groups: [
        { type: "drifter", count: 8, start: 0.35, interval: 0.38, pattern: "sweep", step: 0.5 },
        { type: "spiral", count: 6, start: 1.4, interval: 0.5, pattern: "mirror", step: 0.4 },
        { type: "mine", count: 4, start: 2.0, interval: 0.85, pattern: "fan", spread: 2.2 },
        { type: "shooter", count: 3, start: 3.6, interval: 1.2, pattern: "random" },
        { type: "hunter", count: 5, start: 5.4, interval: 0.56, pattern: "random" },
        { type: "shield", count: 1, start: 6.4, interval: 1.0, pattern: "random" }
      ]
    }
  ];

  function WaveManager(game) {
    this.game = game;
    this.waveNumber = 1;
    this.definition = null;
    this.queue = [];
    this.elapsed = 0;
    this.completeDelay = 0;
  }

  WaveManager.prototype.start = function (waveNumber) {
    this.waveNumber = waveNumber;
    this.definition = WAVE_DEFS[waveNumber - 1];
    this.queue = buildQueue(this.definition);
    this.elapsed = 0;
    this.completeDelay = 0;
  };

  WaveManager.prototype.update = function (dt) {
    if (!this.definition || this.game.boss) {
      return;
    }

    this.elapsed += dt;
    while (this.queue.length && this.queue[0].time <= this.elapsed) {
      var event = this.queue.shift();
      this.game.spawnEnemy(event.type, event.angle);
    }

    if (this.queue.length === 0 && this.game.enemies.length === 0) {
      this.completeDelay += dt;
      if (this.completeDelay >= 0.8) {
        this.game.completeWave();
      }
    } else {
      this.completeDelay = 0;
    }
  };

  WaveManager.prototype.getName = function () {
    return this.definition ? this.definition.name : "";
  };

  function buildQueue(definition) {
    var queue = [];

    for (var g = 0; g < definition.groups.length; g += 1) {
      var group = definition.groups[g];
      var base = Math.random() * CONFIG.TAU;
      for (var i = 0; i < group.count; i += 1) {
        queue.push({
          type: group.type,
          time: group.start + group.interval * i,
          angle: angleFor(group, i, base)
        });
      }
    }

    queue.sort(function (a, b) {
      return a.time - b.time;
    });
    return queue;
  }

  function angleFor(group, index, base) {
    var step = group.step == null ? 0.5 : group.step;
    if (group.pattern === "sweep") {
      return M.normalizeAngle(base + index * step);
    }
    if (group.pattern === "mirror") {
      return M.normalizeAngle(base + Math.floor(index / 2) * step + (index % 2 ? Math.PI : 0));
    }
    if (group.pattern === "fan") {
      var spread = group.spread || 1.5;
      var t = group.count <= 1 ? 0.5 : index / (group.count - 1);
      return M.normalizeAngle(base - spread * 0.5 + spread * t);
    }
    return Math.random() * CONFIG.TAU;
  }

  window.RadialWaveManager = WaveManager;
  window.RadialWaveDefs = WAVE_DEFS;
}());
