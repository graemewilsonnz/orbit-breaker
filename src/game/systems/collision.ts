import { CONFIG } from "../config";
import { circlesOverlap, distance, polarDistance } from "../core/geometry";
import type { EnemyState } from "../state";
import { damageEnemy, enemyPosition, handleBossShot } from "./enemies";
import type { SimulationHost } from "./host";
import { playerPosition, takePlayerHit } from "./player";
import { applyPowerUp, powerUpPosition, type PowerUpHost } from "./powerups";
import { projectilePosition } from "./weapons";

export interface CollisionHost extends SimulationHost, PowerUpHost {
  registerKill(enemy: EnemyState, allowDrop: boolean): void;
}

export function updateShieldLinks(host: CollisionHost): void {
  const carriers = host.state.enemies.filter((enemy) => enemy.active && enemy.type === "shield");

  for (const enemy of host.state.enemies) {
    enemy.shielded = false;
    if (!enemy.active || enemy.type === "shield") {
      continue;
    }

    for (const carrier of carriers) {
      const shieldRadius = carrier.shieldRadius ?? 0;
      if (polarDistance(enemy, carrier) <= shieldRadius) {
        enemy.shielded = true;
        break;
      }
    }
  }
}

export function handleCollisions(host: CollisionHost): void {
  handleShotEnemyCollisions(host);
  handleShotBossCollisions(host);
  handlePlayerDangerCollisions(host);
  handlePowerUpCollisions(host);
}

export function handleShotEnemyCollisions(host: CollisionHost): void {
  for (const shot of host.state.playerShots) {
    if (!shot.active) {
      continue;
    }

    const shotPosition = projectilePosition(shot);
    for (const enemy of host.state.enemies) {
      if (!enemy.active) {
        continue;
      }

      const position = enemyPosition(enemy);
      const hit = distance(shotPosition, position) <= shot.size + enemy.size * 0.82;
      if (!hit) {
        continue;
      }

      if (enemy.shielded && enemy.type !== "shield") {
        shot.active = false;
        enemy.hitFlash = 0.12;
        host.addEffect({
          type: "burst",
          x: position.x,
          y: position.y,
          color: CONFIG.colors.shield,
          size: 24,
          duration: 0.16,
        });
        host.emitAudio("enemyHit");
        break;
      }

      if (damageEnemy(enemy, shot.damage)) {
        enemy.active = false;
        host.registerKill(enemy, true);
      } else {
        host.emitAudio("enemyHit");
      }

      if (shot.pierce > 0) {
        shot.pierce -= 1;
      } else {
        shot.active = false;
        break;
      }
    }
  }
}

export function handleShotBossCollisions(host: CollisionHost): void {
  const { boss } = host.state;
  if (boss === null || !boss.active) {
    return;
  }

  for (const shot of host.state.playerShots) {
    if (shot.active) {
      handleBossShot(boss, shot, host);
    }
  }
}

export function handlePlayerDangerCollisions(host: CollisionHost): void {
  const playerPoint = playerPosition(host.state.player);
  const playerCircle = {
    x: playerPoint.x,
    y: playerPoint.y,
    radius: host.state.player.size * 0.72,
  };

  for (const bullet of host.state.enemyBullets) {
    if (!bullet.active) {
      continue;
    }
    const point = projectilePosition(bullet);
    if (
      circlesOverlap(playerCircle, {
        x: point.x,
        y: point.y,
        radius: bullet.size * 0.9,
      })
    ) {
      bullet.active = false;
      takePlayerHit(host.state.player, host);
    }
  }

  for (const enemy of host.state.enemies) {
    if (!enemy.active) {
      continue;
    }
    const point = enemyPosition(enemy);
    if (
      circlesOverlap(playerCircle, {
        x: point.x,
        y: point.y,
        radius: enemy.size * 0.66,
      })
    ) {
      enemy.active = false;
      takePlayerHit(host.state.player, host);
      host.addEffect({
        type: "burst",
        x: point.x,
        y: point.y,
        color: enemy.hitFlash > 0 ? "#ffffff" : CONFIG.colors[enemy.type],
        size: enemy.size * 2.6,
        duration: 0.22,
      });
    }
  }
}

export function handlePowerUpCollisions(host: CollisionHost): void {
  const playerPoint = playerPosition(host.state.player);
  for (const powerup of host.state.powerups) {
    if (!powerup.active) {
      continue;
    }
    const point = powerUpPosition(powerup);
    if (distance(playerPoint, point) <= host.state.player.size + powerup.size + 6) {
      applyPowerUp(powerup, host);
    }
  }
  host.state.powerups = host.state.powerups.filter((powerup) => powerup.active);
}
