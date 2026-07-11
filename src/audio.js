(function () {
  "use strict";

  var AudioContextCtor = window.AudioContext || window.webkitAudioContext;

  function createAudio() {
    var ctx = null;
    var enabled = Boolean(AudioContextCtor);

    function init() {
      if (!enabled) {
        return;
      }
      if (!ctx) {
        ctx = new AudioContextCtor();
      }
      if (ctx.state === "suspended") {
        ctx.resume();
      }
    }

    function tone(freq, duration, type, volume, slide) {
      if (!enabled || !ctx) {
        return;
      }

      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, now);
      if (slide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + duration);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume || 0.04, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    function noise(duration, volume) {
      if (!enabled || !ctx) {
        return;
      }

      var bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }

      var src = ctx.createBufferSource();
      var filter = ctx.createBiquadFilter();
      var gain = ctx.createGain();
      filter.type = "bandpass";
      filter.frequency.value = 900;
      gain.gain.value = volume || 0.05;
      src.buffer = buffer;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    }

    function play(name) {
      if (!enabled || !ctx) {
        return;
      }

      switch (name) {
        case "fire":
          tone(660, 0.055, "square", 0.025, -230);
          break;
        case "enemyHit":
          tone(220, 0.055, "triangle", 0.035, -80);
          break;
        case "enemyDestroyed":
          tone(150, 0.09, "sawtooth", 0.045, -85);
          noise(0.07, 0.025);
          break;
        case "playerHit":
          tone(95, 0.18, "sawtooth", 0.06, -42);
          noise(0.16, 0.04);
          break;
        case "powerup":
          tone(520, 0.08, "sine", 0.04, 260);
          window.setTimeout(function () {
            tone(820, 0.08, "sine", 0.035, 120);
          }, 60);
          break;
        case "waveClear":
          tone(420, 0.12, "triangle", 0.04, 180);
          window.setTimeout(function () {
            tone(660, 0.12, "triangle", 0.04, 160);
          }, 90);
          break;
        case "bossWarning":
          tone(180, 0.2, "sawtooth", 0.045, 65);
          break;
        case "gameOver":
          tone(190, 0.25, "sawtooth", 0.05, -80);
          window.setTimeout(function () {
            tone(120, 0.28, "sawtooth", 0.05, -50);
          }, 150);
          break;
        case "dash":
          tone(360, 0.06, "triangle", 0.025, 240);
          break;
        case "bomb":
          tone(90, 0.22, "sawtooth", 0.06, 120);
          noise(0.22, 0.055);
          break;
        default:
          break;
      }
    }

    return {
      init: init,
      play: play
    };
  }

  window.RadialAudio = createAudio;
}());
