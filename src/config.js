(function () {
  "use strict";

  var TAU = Math.PI * 2;

  window.RadialConfig = {
    canvas: {
      width: 960,
      height: 720
    },

    arena: {
      centerX: 480,
      centerY: 360,
      playerRadius: 280,
      enemySpawnRadius: 20,
      dangerRadius: 240,
      outerKillRadius: 330,
      bossHitRadius: 94,
      guideRings: [90, 160, 240, 280]
    },

    player: {
      size: 16,
      lives: 3,
      rotationSpeed: 3.2,
      fireCooldown: 0.18,
      dashCooldown: 1.2,
      dashDistance: 0.65,
      dashInvulnerability: 0.15,
      invulnerabilityAfterHit: 1.5,
      maxBombs: 3,
      startingBombs: 1,
      shieldOrbitRadius: 26
    },

    projectiles: {
      playerSpeed: 520,
      enemySpeed: 175,
      playerSize: 4,
      enemySize: 5,
      twinOffset: 0.045
    },

    enemies: {
      drifter: {
        health: 1,
        radialSpeed: [55, 75],
        size: 13,
        score: 100
      },
      spiral: {
        health: 1,
        radialSpeed: [50, 70],
        angularVelocity: [0.8, 1.3],
        size: 13,
        score: 150
      },
      mine: {
        health: 2,
        radialSpeed: [25, 40],
        size: 20,
        score: 200
      },
      shooter: {
        health: 2,
        radialSpeed: 45,
        fireRadius: [150, 210],
        fireCooldown: [1.5, 2.5],
        size: 16,
        score: 250
      },
      hunter: {
        health: 1,
        radialSpeed: [70, 90],
        turnRate: [0.7, 1.0],
        size: 15,
        score: 300
      },
      shield: {
        health: 4,
        radialSpeed: [35, 50],
        shieldRadius: 80,
        size: 20,
        score: 500
      }
    },

    boss: {
      health: 80,
      rotationSpeed: 0.8,
      phase2Threshold: 55,
      phase3Threshold: 25,
      score: 5000,
      coreRadius: 58,
      panelRadius: 72,
      panelWidth: 0.55,
      warningTime: 0.95,
      beamTime: 0.52
    },

    scoring: {
      earlyKillRadius: 130,
      earlyKillBonus: 0.5,
      perfectWaveBonus: 1000,
      bossPhaseBonus: 1000,
      unusedBombVictoryBonus: 500,
      killsPerMultiplier: 5,
      maxMultiplier: 5
    },

    powerups: {
      baseDropChance: 0.08,
      thirdWaveDropChance: 0.16,
      size: 14,
      radialSpeed: 34,
      weaponBoostDuration: 18
    },

    colors: {
      background: "#05070d",
      text: "#ecf8ff",
      mutedText: "#8fa8ba",
      ring: "rgba(119, 174, 199, 0.42)",
      guide: "rgba(119, 174, 199, 0.15)",
      player: "#4de0ff",
      playerAccent: "#f9f871",
      playerBullet: "#f9f871",
      enemyBullet: "#ff6b6b",
      drifter: "#ffb84d",
      spiral: "#d98cff",
      mine: "#ff5d88",
      shooter: "#69e89f",
      hunter: "#ff7f50",
      shield: "#7ad7ff",
      shieldAura: "rgba(110, 210, 255, 0.28)",
      boss: "#f05b78",
      bossCore: "#ffd166",
      warning: "rgba(255, 206, 84, 0.34)",
      beam: "rgba(255, 77, 109, 0.74)",
      powerTwin: "#f9f871",
      powerShield: "#61e8ff",
      powerBomb: "#ff9f43"
    },

    TAU: TAU
  };
}());
