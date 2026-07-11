(function () {
  "use strict";

  window.addEventListener("load", function () {
    var canvas = document.getElementById("gameCanvas");
    var game = new window.RadialGame(canvas);
    var last = performance.now();

    function loop(now) {
      var dt = Math.min(0.033, (now - last) / 1000 || 0);
      last = now;
      game.frame(dt);
      window.requestAnimationFrame(loop);
    }

    window.requestAnimationFrame(loop);
  });
}());
