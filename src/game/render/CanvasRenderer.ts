import { CONFIG } from "../config";
import { clamp, polarToCartesian, type Point } from "../core/geometry";
import type { RandomSource } from "../core/rng";
import type {
  ReadonlyBossState,
  ReadonlyEnemyState,
  ReadonlyGameState,
  ReadonlyPlayerState,
  ReadonlyPowerUpState,
  ReadonlyProjectileState,
} from "../state";
import { renderEffects } from "./effects";
import { renderHud, renderOverlay } from "./hud";

const PLAYER_DAMAGE_HITBOX_SCALE = CONFIG.hitboxes.playerDamageScale;
const ENEMY_TARGET_HITBOX_SCALE = CONFIG.hitboxes.enemyTargetScale;
const ENEMY_CONTACT_HITBOX_SCALE = CONFIG.hitboxes.enemyContactScale;
const ENEMY_PROJECTILE_HITBOX_SCALE = CONFIG.hitboxes.enemyProjectileScale;
const SPAWN_TELEGRAPH_SECONDS = 0.78;
const PLAYER_HIT_FLASH_SECONDS = 0.18;

function currentDevicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio;
}

function normalizePixelRatio(pixelRatio: number): number {
  return Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
}

function arenaPosition(angle: number, radius: number): Point {
  return polarToCartesian(angle, radius, CONFIG.arena.centerX, CONFIG.arena.centerY);
}

function easeOutCubic(value: number): number {
  const inverse = 1 - clamp(value, 0, 1);
  return 1 - inverse * inverse * inverse;
}

export class CanvasRenderer {
  readonly canvas: HTMLCanvasElement;

  private readonly context: CanvasRenderingContext2D;
  private readonly presentationRandom: RandomSource;
  private pixelRatio = 1;
  private showHitboxes = false;

  constructor(
    canvas: HTMLCanvasElement,
    presentationRandom: RandomSource,
    devicePixelRatio = currentDevicePixelRatio(),
  ) {
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Orbit Breaker requires a Canvas 2D rendering context");
    }

    this.canvas = canvas;
    this.context = context;
    this.presentationRandom = presentationRandom;
    this.resize(devicePixelRatio);
  }

  resize(devicePixelRatio = currentDevicePixelRatio()): void {
    const pixelRatio = normalizePixelRatio(devicePixelRatio);
    const backingWidth = Math.round(CONFIG.canvas.width * pixelRatio);
    const backingHeight = Math.round(CONFIG.canvas.height * pixelRatio);

    if (this.canvas.width !== backingWidth) {
      this.canvas.width = backingWidth;
    }
    if (this.canvas.height !== backingHeight) {
      this.canvas.height = backingHeight;
    }

    this.pixelRatio = pixelRatio;
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.context.imageSmoothingEnabled = true;
  }

  setShowHitboxes(showHitboxes: boolean): void {
    this.showHitboxes = showHitboxes;
  }

  render(state: ReadonlyGameState): void {
    const context = this.context;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.clearRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

    context.save();
    if (state.shake > 0) {
      const amount = state.shake * 16;
      context.translate(
        this.presentationRandom.range(-amount, amount),
        this.presentationRandom.range(-amount, amount),
      );
    }

    drawBackground(context, state);
    drawSpawnTelegraphs(context, state);

    if (state.boss?.active) {
      drawBoss(context, state.boss);
    }
    for (const powerup of state.powerups) {
      drawPowerUp(context, powerup);
    }
    for (const enemy of state.enemies) {
      drawEnemy(context, enemy);
    }
    for (const projectile of state.playerShots) {
      drawProjectile(context, projectile);
    }
    for (const projectile of state.enemyBullets) {
      drawProjectile(context, projectile);
    }
    renderEffects(context, state.effects);

    if (state.state !== "title") {
      drawPlayer(context, state.player);
    }

    if (this.showHitboxes) {
      drawHitboxes(context, state);
    }
    context.restore();

    renderHud(context, state);
    renderOverlay(context, state);
  }
}

function drawBackground(context: CanvasRenderingContext2D, state: ReadonlyGameState): void {
  const backdrop = context.createRadialGradient(
    CONFIG.arena.centerX,
    CONFIG.arena.centerY,
    12,
    CONFIG.arena.centerX,
    CONFIG.arena.centerY,
    CONFIG.arena.outerKillRadius + 170,
  );
  backdrop.addColorStop(0, "#111a2c");
  backdrop.addColorStop(0.38, "#080d19");
  backdrop.addColorStop(1, CONFIG.colors.background);
  context.fillStyle = backdrop;
  context.fillRect(-20, -20, CONFIG.canvas.width + 40, CONFIG.canvas.height + 40);

  for (const star of state.stars) {
    const position = arenaPosition(star.angle, star.radius);
    const tailLength = clamp(star.speed * 0.12, 4, 15);
    const tail = arenaPosition(star.angle, Math.max(0, star.radius - tailLength));
    const alpha = clamp(star.radius / CONFIG.arena.playerRadius, 0.12, 0.82);
    context.strokeStyle = `rgba(180, 226, 255, ${alpha})`;
    context.lineWidth = star.size;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(tail.x, tail.y);
    context.lineTo(position.x, position.y);
    context.stroke();
  }

  context.save();
  context.translate(CONFIG.arena.centerX, CONFIG.arena.centerY);

  const centerWell = context.createRadialGradient(0, 0, 0, 0, 0, 88);
  centerWell.addColorStop(0, "rgba(3, 5, 12, 0.98)");
  centerWell.addColorStop(0.48, "rgba(24, 42, 66, 0.34)");
  centerWell.addColorStop(1, "rgba(24, 42, 66, 0)");
  context.fillStyle = centerWell;
  context.beginPath();
  context.arc(0, 0, 88, 0, CONFIG.TAU);
  context.fill();

  context.strokeStyle = CONFIG.colors.guide;
  context.lineWidth = 0.8;
  for (let index = 0; index < 24; index += 1) {
    const angle = (index * CONFIG.TAU) / 24;
    const innerRadius = index % 2 === 0 ? 34 : 52;
    context.beginPath();
    context.moveTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
    context.lineTo(
      Math.cos(angle) * CONFIG.arena.playerRadius,
      Math.sin(angle) * CONFIG.arena.playerRadius,
    );
    context.stroke();
  }

  for (const [index, radius] of CONFIG.arena.guideRings.entries()) {
    context.globalAlpha = 0.56 + index * 0.1;
    context.lineWidth = index === CONFIG.arena.guideRings.length - 1 ? 1.4 : 0.8;
    context.beginPath();
    context.arc(0, 0, radius, 0, CONFIG.TAU);
    context.stroke();
  }
  context.globalAlpha = 1;

  context.strokeStyle = "rgba(77, 224, 255, 0.12)";
  context.lineWidth = 11;
  context.beginPath();
  context.arc(0, 0, CONFIG.arena.playerRadius, 0, CONFIG.TAU);
  context.stroke();

  context.strokeStyle = CONFIG.colors.ring;
  context.lineWidth = 2.5;
  context.beginPath();
  context.arc(0, 0, CONFIG.arena.playerRadius, 0, CONFIG.TAU);
  context.stroke();

  context.strokeStyle = "rgba(190, 238, 255, 0.34)";
  context.lineWidth = 1;
  for (let index = 0; index < 48; index += 1) {
    const angle = (index * CONFIG.TAU) / 48;
    const tickLength = index % 4 === 0 ? 7 : 3;
    context.beginPath();
    context.moveTo(
      Math.cos(angle) * (CONFIG.arena.playerRadius - tickLength),
      Math.sin(angle) * (CONFIG.arena.playerRadius - tickLength),
    );
    context.lineTo(
      Math.cos(angle) * (CONFIG.arena.playerRadius + tickLength),
      Math.sin(angle) * (CONFIG.arena.playerRadius + tickLength),
    );
    context.stroke();
  }

  context.strokeStyle = "rgba(255, 107, 107, 0.08)";
  context.lineWidth = 10;
  context.beginPath();
  context.arc(0, 0, CONFIG.arena.dangerRadius, 0, CONFIG.TAU);
  context.stroke();
  context.strokeStyle = "rgba(255, 107, 107, 0.28)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(0, 0, CONFIG.arena.dangerRadius, 0, CONFIG.TAU);
  context.stroke();
  context.restore();
}

function drawSpawnTelegraphs(context: CanvasRenderingContext2D, state: ReadonlyGameState): void {
  if (state.state === "title" || state.wave.definition === null) {
    return;
  }

  const upcoming = state.wave.queue.filter((spawn) => {
    const timeUntilSpawn = spawn.time - state.wave.elapsed;
    return timeUntilSpawn >= 0 && timeUntilSpawn <= SPAWN_TELEGRAPH_SECONDS;
  });
  if (upcoming.length === 0) {
    return;
  }

  context.save();
  context.translate(CONFIG.arena.centerX, CONFIG.arena.centerY);
  context.globalCompositeOperation = "lighter";

  for (const spawn of upcoming) {
    const timeUntilSpawn = Math.max(0, spawn.time - state.wave.elapsed);
    const readiness = 1 - timeUntilSpawn / SPAWN_TELEGRAPH_SECONDS;
    const markerRadius = CONFIG.arena.enemySpawnRadius + 58 * (1 - easeOutCubic(readiness));
    const laneWidth = 0.055 + readiness * 0.045;
    const color = enemyTypeColor(spawn.type);

    context.save();
    context.rotate(spawn.angle);

    context.fillStyle = color;
    context.globalAlpha = 0.035 + readiness * 0.1;
    context.beginPath();
    context.moveTo(CONFIG.arena.enemySpawnRadius - 5, 0);
    context.arc(0, 0, 92, -laneWidth, laneWidth);
    context.closePath();
    context.fill();

    context.strokeStyle = color;
    context.globalAlpha = 0.2 + readiness * 0.68;
    context.lineWidth = 1.2 + readiness * 1.8;
    context.setLineDash([3, 6]);
    context.lineDashOffset = timeUntilSpawn * -24;
    context.beginPath();
    context.moveTo(CONFIG.arena.enemySpawnRadius + 3, 0);
    context.lineTo(92, 0);
    context.stroke();
    context.setLineDash([]);

    context.globalAlpha = 0.5 + readiness * 0.5;
    context.fillStyle = "rgba(5, 7, 13, 0.92)";
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(markerRadius, 0, 4 + readiness * 2.5, 0, CONFIG.TAU);
    context.fill();
    context.stroke();

    const bracketRadius = 82;
    const bracketSize = 5 + readiness * 3;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(bracketRadius - bracketSize, -bracketSize);
    context.lineTo(bracketRadius, 0);
    context.lineTo(bracketRadius - bracketSize, bracketSize);
    context.stroke();
    context.restore();
  }

  const strongestReadiness = Math.max(
    ...upcoming.map(
      (spawn) => 1 - Math.max(0, spawn.time - state.wave.elapsed) / SPAWN_TELEGRAPH_SECONDS,
    ),
  );
  context.globalAlpha = 0.24 + strongestReadiness * 0.62;
  context.strokeStyle = CONFIG.colors.warning;
  context.lineWidth = 1.5 + strongestReadiness;
  context.beginPath();
  context.arc(
    0,
    0,
    CONFIG.arena.enemySpawnRadius + 5 + (1 - strongestReadiness) * 8,
    0,
    CONFIG.TAU,
  );
  context.stroke();
  context.restore();
}

function drawPlayer(context: CanvasRenderingContext2D, player: ReadonlyPlayerState): void {
  const position = arenaPosition(player.angle, player.radius);
  const flicker =
    player.invulnerabilityTimer > 0 && Math.floor(player.invulnerabilityTimer * 18) % 2 === 0;
  const firePulse = clamp(player.fireCooldown / CONFIG.player.fireCooldown, 0, 1);
  const recoil = firePulse * 4.5;
  const hitAge = Math.max(0, CONFIG.player.invulnerabilityAfterHit - player.flashTimer);
  const hitFlash = player.flashTimer > 0 ? clamp(1 - hitAge / PLAYER_HIT_FLASH_SECONDS, 0, 1) : 0;

  drawDashReadiness(context, position, player);

  if (hitFlash > 0) {
    context.save();
    context.globalAlpha = hitFlash * 0.82;
    context.strokeStyle = CONFIG.colors.enemyBullet;
    context.fillStyle = "rgba(255, 255, 255, 0.18)";
    context.shadowColor = CONFIG.colors.enemyBullet;
    context.shadowBlur = 24;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(position.x, position.y, 22 + (1 - hitFlash) * 28, 0, CONFIG.TAU);
    context.fill();
    context.stroke();
    context.restore();
  }

  context.save();
  context.translate(position.x, position.y);
  context.rotate(player.angle + Math.PI);
  context.translate(-recoil, 0);
  context.globalAlpha = flicker ? 0.36 : 1;
  context.shadowColor = CONFIG.colors.player;
  context.shadowBlur = 18;

  context.strokeStyle = "rgba(5, 7, 13, 0.94)";
  context.lineWidth = 7;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(20, 0);
  context.lineTo(-8, -13);
  context.lineTo(-5, -5);
  context.lineTo(-17, -8);
  context.lineTo(-11, 0);
  context.lineTo(-17, 8);
  context.lineTo(-5, 5);
  context.lineTo(-8, 13);
  context.closePath();
  context.stroke();

  context.fillStyle =
    player.dashInvulnerabilityTimer > 0 ? CONFIG.colors.playerAccent : CONFIG.colors.player;
  context.strokeStyle = "#eaffff";
  context.lineWidth = 1.8;
  context.beginPath();
  context.moveTo(20, 0);
  context.lineTo(-8, -13);
  context.lineTo(-5, -5);
  context.lineTo(-17, -8);
  context.lineTo(-11, 0);
  context.lineTo(-17, 8);
  context.lineTo(-5, 5);
  context.lineTo(-8, 13);
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowBlur = 5;
  context.fillStyle = "rgba(5, 7, 13, 0.84)";
  context.beginPath();
  context.moveTo(10, 0);
  context.lineTo(-4, -4.5);
  context.lineTo(-1, 0);
  context.lineTo(-4, 4.5);
  context.closePath();
  context.fill();

  context.fillStyle = CONFIG.colors.playerAccent;
  context.beginPath();
  context.moveTo(-12, -4.5);
  context.lineTo(-21 - firePulse * 10, 0);
  context.lineTo(-12, 4.5);
  context.closePath();
  context.fill();

  if (firePulse > 0) {
    context.globalAlpha *= 0.3 + firePulse * 0.7;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(-16, -2.2);
    context.lineTo(-25 - firePulse * 12, 0);
    context.lineTo(-16, 2.2);
    context.closePath();
    context.fill();
  }
  context.restore();

  if (player.shieldActive) {
    const shieldPosition = {
      x: position.x + Math.cos(player.shieldAngle) * CONFIG.player.shieldOrbitRadius,
      y: position.y + Math.sin(player.shieldAngle) * CONFIG.player.shieldOrbitRadius,
    };
    context.save();
    context.strokeStyle = CONFIG.colors.powerShield;
    context.fillStyle = "rgba(97, 232, 255, 0.18)";
    context.shadowColor = CONFIG.colors.powerShield;
    context.shadowBlur = 14;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(position.x, position.y, CONFIG.player.shieldOrbitRadius, 0, CONFIG.TAU);
    context.stroke();
    context.beginPath();
    context.arc(shieldPosition.x, shieldPosition.y, 8, 0, CONFIG.TAU);
    context.fill();
    context.stroke();
    context.restore();
  }
}

function drawDashReadiness(
  context: CanvasRenderingContext2D,
  position: Point,
  player: ReadonlyPlayerState,
): void {
  const ready = 1 - clamp(player.dashCooldown / CONFIG.player.dashCooldown, 0, 1);
  const radius = 25;
  context.save();
  context.translate(position.x, position.y);
  context.rotate(player.angle + Math.PI);
  context.shadowBlur = 0;
  context.lineCap = "round";
  context.strokeStyle = "rgba(143, 168, 186, 0.2)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(0, 0, radius, -0.72, 0.72);
  context.stroke();

  if (ready > 0) {
    context.strokeStyle = ready >= 0.999 ? CONFIG.colors.playerAccent : CONFIG.colors.player;
    context.globalAlpha = ready >= 0.999 ? 0.82 : 0.52;
    context.lineWidth = ready >= 0.999 ? 2.4 : 1.8;
    context.beginPath();
    context.arc(0, 0, radius, -0.72, -0.72 + 1.44 * ready);
    context.stroke();
  }
  context.restore();
}

function drawProjectile(
  context: CanvasRenderingContext2D,
  projectile: ReadonlyProjectileState,
): void {
  const head = arenaPosition(projectile.angle, projectile.radius);
  const isPlayerShot = projectile.owner === "player";
  const travelDirection = Math.sign(projectile.radialSpeed || 1);
  const trailLength = isPlayerShot ? 23 : 15;
  const tailRadius = projectile.radius - travelDirection * trailLength;
  const tail = arenaPosition(projectile.angle, tailRadius);
  const pulse = 1 + Math.sin(projectile.age * 24) * 0.1;

  context.save();
  context.lineCap = "round";

  context.globalAlpha = isPlayerShot ? 0.42 : 0.34;
  context.strokeStyle = projectile.color;
  context.lineWidth = isPlayerShot ? 7 : 8;
  context.beginPath();
  context.moveTo(tail.x, tail.y);
  context.lineTo(head.x, head.y);
  context.stroke();

  context.globalAlpha = isPlayerShot ? 0.98 : 0.94;
  context.strokeStyle = isPlayerShot ? "#ffffff" : projectile.color;
  context.lineWidth = isPlayerShot ? 2 : 3;
  context.beginPath();
  context.moveTo(tail.x, tail.y);
  context.lineTo(head.x, head.y);
  context.stroke();

  context.translate(head.x, head.y);
  context.rotate(projectile.angle + (travelDirection < 0 ? Math.PI : 0));
  context.shadowColor = projectile.color;
  context.shadowBlur = isPlayerShot ? 13 : 18;

  if (isPlayerShot) {
    const size = projectile.size * 1.15;
    context.fillStyle = projectile.color;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.25;
    context.beginPath();
    context.moveTo(size * 1.7, 0);
    context.lineTo(-size * 0.65, -size * 0.72);
    context.lineTo(-size * 0.2, 0);
    context.lineTo(-size * 0.65, size * 0.72);
    context.closePath();
    context.fill();
    context.stroke();
  } else {
    const size = projectile.size * pulse;
    context.fillStyle = "rgba(70, 8, 18, 0.92)";
    context.strokeStyle = projectile.color;
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(0, 0, size + 1.5, 0, CONFIG.TAU);
    context.fill();
    context.stroke();
    context.fillStyle = "#ffffff";
    context.globalAlpha = 0.9;
    context.beginPath();
    context.arc(0, 0, Math.max(1.5, projectile.size * 0.34), 0, CONFIG.TAU);
    context.fill();
  }
  context.restore();
}

function powerUpColor(powerup: ReadonlyPowerUpState): string {
  if (powerup.type === "shield") {
    return CONFIG.colors.powerShield;
  }
  if (powerup.type === "bomb") {
    return CONFIG.colors.powerBomb;
  }
  return CONFIG.colors.powerTwin;
}

function drawPowerUp(context: CanvasRenderingContext2D, powerup: ReadonlyPowerUpState): void {
  const position = arenaPosition(powerup.angle, powerup.radius);
  const color = powerUpColor(powerup);

  context.save();
  context.translate(position.x, position.y);
  context.rotate(powerup.spin);
  context.globalAlpha = clamp(powerup.life, 0.35, 1);
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.strokeStyle = color;
  context.fillStyle = "rgba(5, 7, 13, 0.7)";
  context.lineWidth = 2.5;

  if (powerup.type === "shield") {
    context.beginPath();
    context.arc(0, 0, powerup.size, 0, CONFIG.TAU);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(0, 0, powerup.size * 0.54, -0.9, Math.PI + 0.9);
    context.stroke();
  } else if (powerup.type === "bomb") {
    context.beginPath();
    context.moveTo(0, -powerup.size);
    context.lineTo(powerup.size, 0);
    context.lineTo(0, powerup.size);
    context.lineTo(-powerup.size, 0);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 4, 0, CONFIG.TAU);
    context.fillStyle = color;
    context.fill();
  } else {
    context.beginPath();
    context.rect(
      -powerup.size * 0.72,
      -powerup.size * 0.72,
      powerup.size * 1.44,
      powerup.size * 1.44,
    );
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(-7, -2);
    context.lineTo(-1, -8);
    context.lineTo(7, 8);
    context.moveTo(0, -8);
    context.lineTo(7, -8);
    context.lineTo(7, -1);
    context.stroke();
  }

  context.restore();
}

function enemyTypeColor(type: ReadonlyEnemyState["type"]): string {
  switch (type) {
    case "drifter":
      return CONFIG.colors.drifter;
    case "spiral":
      return CONFIG.colors.spiral;
    case "mine":
      return CONFIG.colors.mine;
    case "shooter":
      return CONFIG.colors.shooter;
    case "hunter":
      return CONFIG.colors.hunter;
    case "shield":
      return CONFIG.colors.shield;
  }
}

function enemyColor(enemy: ReadonlyEnemyState): string {
  return enemy.hitFlash > 0 ? "#ffffff" : enemyTypeColor(enemy.type);
}

function drawEnemy(context: CanvasRenderingContext2D, enemy: ReadonlyEnemyState): void {
  const position = arenaPosition(enemy.angle, enemy.radius);
  const wake = arenaPosition(enemy.angle, Math.max(0, enemy.radius - 22));
  const baseColor = enemyTypeColor(enemy.type);
  const color = enemyColor(enemy);

  context.save();
  context.globalAlpha = clamp(enemy.radius / CONFIG.arena.playerRadius, 0.16, 0.44);
  context.strokeStyle = baseColor;
  context.lineWidth = Math.max(2, enemy.size * 0.24);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(wake.x, wake.y);
  context.lineTo(position.x, position.y);
  context.stroke();
  context.restore();

  if (enemy.hitFlash > 0) {
    const strength = clamp(enemy.hitFlash / 0.12, 0, 1);
    context.save();
    context.globalAlpha = 0.25 + strength * 0.62;
    context.strokeStyle = "#ffffff";
    context.shadowColor = baseColor;
    context.shadowBlur = 20;
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(position.x, position.y, enemy.size * (1.1 + (1 - strength) * 0.72), 0, CONFIG.TAU);
    context.stroke();
    context.restore();
  }

  context.save();
  context.translate(position.x, position.y);
  context.rotate(enemy.angle + Math.PI / 2);
  context.shadowColor = color;
  context.shadowBlur = 12;

  if (enemy.shielded && enemy.type !== "shield") {
    context.strokeStyle = CONFIG.colors.shieldAura;
    context.lineWidth = 5;
    context.beginPath();
    context.arc(0, 0, enemy.size + 7, 0, CONFIG.TAU);
    context.stroke();
  }

  context.fillStyle = color;
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 1.5;

  switch (enemy.type) {
    case "drifter":
      drawPolygon(context, 4, enemy.size, Math.PI / 4);
      break;
    case "spiral":
      drawSpiral(context, enemy.size, enemy.age);
      break;
    case "mine":
      drawMine(context, enemy.size, enemy.age);
      break;
    case "shooter":
      drawShooter(context, enemy.size);
      break;
    case "hunter":
      drawHunter(context, enemy.size);
      break;
    case "shield":
      drawShieldCarrier(context, enemy.size, enemy.age);
      break;
  }

  if (enemy.health > 1 || enemy.health < enemy.maxHealth) {
    context.shadowBlur = 0;
    context.fillStyle = "rgba(0, 0, 0, 0.48)";
    context.fillRect(-enemy.size, enemy.size + 7, enemy.size * 2, 3);
    context.fillStyle = baseColor;
    context.fillRect(
      -enemy.size,
      enemy.size + 7,
      enemy.size * 2 * Math.max(0, enemy.health / enemy.maxHealth),
      3,
    );
  }

  context.restore();
}

function drawPolygon(
  context: CanvasRenderingContext2D,
  sides: number,
  radius: number,
  rotation: number,
): void {
  context.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index * CONFIG.TAU) / sides;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.fill();
  context.stroke();
}

function drawSpiral(context: CanvasRenderingContext2D, size: number, age: number): void {
  context.beginPath();
  context.moveTo(0, -size);
  context.lineTo(size * 0.9, size * 0.8);
  context.lineTo(0, size * 0.42);
  context.lineTo(-size * 0.9, size * 0.8);
  context.closePath();
  context.fill();
  context.stroke();
  context.rotate(age * 4);
  context.strokeStyle = "rgba(255, 255, 255, 0.7)";
  context.beginPath();
  context.arc(0, 0, size * 0.55, 0.4, Math.PI * 1.55);
  context.stroke();
}

function drawMine(context: CanvasRenderingContext2D, size: number, age: number): void {
  const pulse = 1 + Math.sin(age * 6) * 0.08;
  context.beginPath();
  for (let index = 0; index < 12; index += 1) {
    const radius = index % 2 === 0 ? size * 1.05 * pulse : size * 0.58 * pulse;
    const angle = (index * CONFIG.TAU) / 12;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.fill();
  context.stroke();
}

function drawShooter(context: CanvasRenderingContext2D, size: number): void {
  context.beginPath();
  context.rect(-size * 0.75, -size * 0.75, size * 1.5, size * 1.5);
  context.fill();
  context.stroke();
  context.fillStyle = "rgba(5, 7, 13, 0.72)";
  context.fillRect(-5, -size - 7, 10, size);
  context.strokeRect(-5, -size - 7, 10, size);
}

function drawHunter(context: CanvasRenderingContext2D, size: number): void {
  context.beginPath();
  context.moveTo(0, -size * 1.18);
  context.lineTo(size, size * 0.86);
  context.lineTo(0, size * 0.35);
  context.lineTo(-size, size * 0.86);
  context.closePath();
  context.fill();
  context.stroke();
}

function drawShieldCarrier(context: CanvasRenderingContext2D, size: number, age: number): void {
  drawPolygon(context, 6, size, Math.PI / 6);
  context.strokeStyle = CONFIG.colors.shieldAura;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, size + 7 + Math.sin(age * 3) * 2, 0, CONFIG.TAU);
  context.stroke();
}

function drawBoss(context: CanvasRenderingContext2D, boss: ReadonlyBossState): void {
  drawBossBeams(context, boss);
  drawBossCore(context, boss);
}

function drawBossBeams(context: CanvasRenderingContext2D, boss: ReadonlyBossState): void {
  const length = CONFIG.arena.outerKillRadius + 40;
  const innerRadius = 18;

  for (const beam of boss.beams) {
    const alpha = beam.active ? 0.7 : 0.22 + Math.sin(beam.timer * 28) * 0.05;
    const halfWidth = beam.width * 0.5;
    const color = beam.active ? CONFIG.colors.beam : CONFIG.colors.warning;
    context.save();
    context.translate(CONFIG.arena.centerX, CONFIG.arena.centerY);
    context.rotate(beam.angle);

    context.fillStyle = color;
    context.strokeStyle = color;
    context.globalAlpha = alpha;
    context.beginPath();
    context.moveTo(Math.cos(-halfWidth) * innerRadius, Math.sin(-halfWidth) * innerRadius);
    context.lineTo(Math.cos(-halfWidth) * length, Math.sin(-halfWidth) * length);
    context.arc(0, 0, length, -halfWidth, halfWidth);
    context.lineTo(Math.cos(halfWidth) * innerRadius, Math.sin(halfWidth) * innerRadius);
    context.arc(0, 0, innerRadius, halfWidth, -halfWidth, true);
    context.closePath();
    context.fill();
    context.lineWidth = beam.active ? 2 : 1.5;
    context.stroke();

    context.globalAlpha = beam.active ? 0.92 : 0.52;
    context.lineWidth = beam.active ? 3 : 2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(innerRadius, 0);
    context.lineTo(length, 0);
    context.stroke();
    context.restore();
  }
}

function drawBossCore(context: CanvasRenderingContext2D, boss: ReadonlyBossState): void {
  const flash = boss.hitFlash > 0;

  context.save();
  context.translate(CONFIG.arena.centerX, CONFIG.arena.centerY);
  context.shadowColor = CONFIG.colors.boss;
  context.shadowBlur = 18;

  context.fillStyle = flash ? "#ffffff" : "rgba(240, 91, 120, 0.32)";
  context.beginPath();
  context.arc(0, 0, CONFIG.boss.coreRadius + 10, 0, CONFIG.TAU);
  context.fill();

  context.strokeStyle = CONFIG.colors.boss;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, 0, CONFIG.boss.coreRadius + 9, 0, CONFIG.TAU);
  context.stroke();

  context.fillStyle = flash ? "#ffffff" : CONFIG.colors.bossCore;
  context.beginPath();
  context.arc(0, 0, CONFIG.boss.coreRadius * 0.58, 0, CONFIG.TAU);
  context.fill();

  context.strokeStyle = "rgba(255, 255, 255, 0.78)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, CONFIG.boss.coreRadius * 0.34, 0, CONFIG.TAU);
  context.stroke();

  context.rotate(boss.rotation);
  for (let index = 0; index < 4; index += 1) {
    const start = (index * CONFIG.TAU) / 4 - CONFIG.boss.panelWidth * 0.5;
    const end = (index * CONFIG.TAU) / 4 + CONFIG.boss.panelWidth * 0.5;
    context.strokeStyle = CONFIG.colors.shield;
    context.lineWidth = 13;
    context.lineCap = "round";
    context.beginPath();
    context.arc(0, 0, CONFIG.boss.panelRadius, start, end);
    context.stroke();
    context.strokeStyle = "rgba(255, 255, 255, 0.58)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, CONFIG.boss.panelRadius, start, end);
    context.stroke();
  }

  context.restore();
}

function drawHitboxes(context: CanvasRenderingContext2D, state: ReadonlyGameState): void {
  context.save();
  context.shadowBlur = 0;
  context.globalAlpha = 0.9;
  context.lineWidth = 1;

  if (state.state !== "title") {
    const playerPosition = arenaPosition(state.player.angle, state.player.radius);
    drawHitboxCircle(
      context,
      playerPosition,
      state.player.size * PLAYER_DAMAGE_HITBOX_SCALE,
      CONFIG.colors.player,
      [4, 3],
    );
    if (state.powerups.length > 0) {
      drawHitboxCircle(context, playerPosition, state.player.size, CONFIG.colors.powerTwin, [1, 3]);
    }
  }

  for (const enemy of state.enemies) {
    const position = arenaPosition(enemy.angle, enemy.radius);
    drawHitboxCircle(
      context,
      position,
      enemy.size * ENEMY_TARGET_HITBOX_SCALE,
      CONFIG.colors.playerBullet,
      [4, 3],
    );
    drawHitboxCircle(
      context,
      position,
      enemy.size * ENEMY_CONTACT_HITBOX_SCALE,
      CONFIG.colors.enemyBullet,
      [1, 3],
    );
    if (enemy.type === "shield" && enemy.shieldRadius !== undefined) {
      drawHitboxCircle(context, position, enemy.shieldRadius, CONFIG.colors.shield, [7, 4]);
    }
  }

  for (const projectile of [...state.playerShots, ...state.enemyBullets]) {
    const hitboxScale = projectile.owner === "enemy" ? ENEMY_PROJECTILE_HITBOX_SCALE : 1;
    drawHitboxCircle(
      context,
      arenaPosition(projectile.angle, projectile.radius),
      projectile.size * hitboxScale,
      projectile.color,
      projectile.owner === "enemy" ? [1, 2] : [3, 2],
    );
  }

  for (const powerup of state.powerups) {
    drawHitboxCircle(
      context,
      arenaPosition(powerup.angle, powerup.radius),
      powerup.size + 6,
      powerUpColor(powerup),
      [1, 3],
    );
  }

  if (state.boss?.active) {
    drawHitboxCircle(
      context,
      { x: CONFIG.arena.centerX, y: CONFIG.arena.centerY },
      CONFIG.arena.bossHitRadius,
      CONFIG.colors.boss,
      [6, 3],
    );
    drawBossBeamHitboxes(context, state.boss);
  }

  context.restore();
}

function drawHitboxCircle(
  context: CanvasRenderingContext2D,
  position: Point,
  radius: number,
  color: string,
  dash: readonly number[],
): void {
  context.strokeStyle = color;
  context.setLineDash(dash);
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, CONFIG.TAU);
  context.stroke();
}

function drawBossBeamHitboxes(context: CanvasRenderingContext2D, boss: ReadonlyBossState): void {
  context.setLineDash([2, 3]);
  context.lineWidth = 1.2;
  for (const beam of boss.beams) {
    if (!beam.active) {
      continue;
    }
    context.strokeStyle = CONFIG.colors.beam;
    context.beginPath();
    context.arc(
      CONFIG.arena.centerX,
      CONFIG.arena.centerY,
      CONFIG.arena.playerRadius,
      beam.angle - beam.width * 0.5,
      beam.angle + beam.width * 0.5,
    );
    context.stroke();
  }
}
