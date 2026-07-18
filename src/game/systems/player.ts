import { CONFIG } from "../config";
import { normalizeAngle, polarToCartesian } from "../core/geometry";
import type { DamageSource } from "../runMetrics";
import type { CartesianPosition, PlayerState } from "../state";
import type { InputSnapshot } from "./input";
import type { SimulationHost } from "./host";
import { createProjectile } from "./weapons";

export function createPlayerState(): PlayerState {
  return {
    angle: -Math.PI / 2,
    radius: CONFIG.arena.playerRadius,
    rotationSpeed: CONFIG.player.rotationSpeed,
    fireCooldown: 0,
    dashCooldown: 0,
    dashBufferTimer: 0,
    lives: CONFIG.player.lives,
    invulnerabilityTimer: 0,
    dashInvulnerabilityTimer: 0,
    weaponLevel: 1,
    weaponTimer: 0,
    shieldActive: false,
    shieldAngle: 0,
    bombCount: CONFIG.player.startingBombs,
    score: 0,
    multiplier: 1,
    lastMoveDirection: 1,
    flashTimer: 0,
    size: CONFIG.player.size,
  };
}

/** Mutates an existing player object so references held by the game remain valid. */
export function resetPlayer(player: PlayerState): PlayerState {
  Object.assign(player, createPlayerState());
  return player;
}

export function updatePlayer(
  player: PlayerState,
  dt: number,
  input: InputSnapshot,
  host: SimulationHost,
): void {
  const movingLeft = input.isDown("left");
  const movingRight = input.isDown("right");
  const moveDirection: -1 | 0 | 1 = movingLeft === movingRight ? 0 : movingLeft ? -1 : 1;

  if (moveDirection !== 0) {
    player.lastMoveDirection = moveDirection;
    player.angle = normalizeAngle(player.angle + moveDirection * player.rotationSpeed * dt);
  }

  player.fireCooldown = tickTimer(player.fireCooldown, dt);
  player.dashCooldown = tickTimer(player.dashCooldown, dt);
  const bufferedDashRequested = player.dashBufferTimer > 0;
  player.dashBufferTimer = tickTimer(player.dashBufferTimer, dt);
  player.invulnerabilityTimer = tickTimer(player.invulnerabilityTimer, dt);
  player.dashInvulnerabilityTimer = tickTimer(player.dashInvulnerabilityTimer, dt);
  player.flashTimer = tickTimer(player.flashTimer, dt);
  player.shieldAngle = normalizeAngle(player.shieldAngle + dt * 4.2);

  if (player.weaponTimer > 0) {
    player.weaponTimer -= dt;
    if (player.weaponTimer <= 0 && player.weaponLevel > 2) {
      player.weaponLevel = 2;
    }
  }

  if (input.wasPressed("dash")) {
    if (!dashPlayer(player, host)) {
      player.dashBufferTimer = CONFIG.player.dashInputBuffer;
    }
  } else if (bufferedDashRequested && dashPlayer(player, host)) {
    player.dashBufferTimer = 0;
  }
  if (input.isActive("fire")) {
    firePlayer(player, host);
  }
  if (input.wasPressed("bomb")) {
    host.activateBomb();
  }
}

export function dashPlayer(player: PlayerState, host: SimulationHost): boolean {
  if (player.dashCooldown > 0) {
    return false;
  }

  player.angle = normalizeAngle(
    player.angle + player.lastMoveDirection * CONFIG.player.dashDistance,
  );
  player.dashCooldown = CONFIG.player.dashCooldown;
  player.dashInvulnerabilityTimer = CONFIG.player.dashInvulnerability;
  host.addEffect({
    type: "ring",
    angle: player.angle,
    radius: player.radius,
    color: CONFIG.colors.player,
    size: 42,
    duration: 0.18,
  });
  host.emitAudio("dash");
  return true;
}

export function firePlayer(player: PlayerState, host: SimulationHost): boolean {
  if (player.fireCooldown > 0) {
    return false;
  }

  const offsets =
    player.weaponLevel >= 2 ? [-CONFIG.projectiles.twinOffset, CONFIG.projectiles.twinOffset] : [0];
  const pierce = player.weaponLevel >= 3 ? 1 : 0;

  for (const offset of offsets) {
    host.state.playerShots.push(
      createProjectile({
        owner: "player",
        angle: player.angle + offset,
        radius: player.radius - 20,
        radialSpeed: -CONFIG.projectiles.playerSpeed,
        size: CONFIG.projectiles.playerSize,
        pierce,
        color: CONFIG.colors.playerBullet,
      }),
    );
  }

  player.fireCooldown = CONFIG.player.fireCooldown;
  host.emitAudio("fire");
  return true;
}

export function isPlayerVulnerable(player: PlayerState): boolean {
  return player.invulnerabilityTimer <= 0 && player.dashInvulnerabilityTimer <= 0;
}

/** Returns true only when a life was removed, matching the prototype. */
export function takePlayerHit(
  player: PlayerState,
  host: SimulationHost,
  source: DamageSource,
): boolean {
  if (!isPlayerVulnerable(player)) {
    return false;
  }

  if (player.shieldActive) {
    player.shieldActive = false;
    player.invulnerabilityTimer = 0.35;
    host.clearNearbyEnemyBullets(115);
    host.addEffect({
      type: "burst",
      angle: player.angle,
      radius: player.radius,
      color: CONFIG.colors.powerShield,
      size: 62,
      duration: 0.28,
    });
    host.emitAudio("playerHit");
    return false;
  }

  player.lives -= 1;
  player.invulnerabilityTimer = CONFIG.player.invulnerabilityAfterHit;
  player.flashTimer = CONFIG.player.invulnerabilityAfterHit;
  host.onPlayerDamaged(source);
  return true;
}

export function playerPosition(player: PlayerState): CartesianPosition {
  return polarToCartesian(player.angle, player.radius, CONFIG.arena.centerX, CONFIG.arena.centerY);
}

function tickTimer(timer: number, dt: number): number {
  const next = timer - dt;
  return next <= 1e-9 ? 0 : next;
}
