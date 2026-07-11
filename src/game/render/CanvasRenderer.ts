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

const PLAYER_HITBOX_SCALE = 0.72;
const ENEMY_HITBOX_SCALE = 0.82;

function currentDevicePixelRatio(): number {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio;
}

function normalizePixelRatio(pixelRatio: number): number {
  return Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
}

function arenaPosition(angle: number, radius: number): Point {
  return polarToCartesian(angle, radius, CONFIG.arena.centerX, CONFIG.arena.centerY);
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
  context.fillStyle = CONFIG.colors.background;
  context.fillRect(-20, -20, CONFIG.canvas.width + 40, CONFIG.canvas.height + 40);

  for (const star of state.stars) {
    const position = arenaPosition(star.angle, star.radius);
    const tail = arenaPosition(star.angle, Math.max(0, star.radius - 8));
    const alpha = clamp(star.radius / 280, 0.15, 0.9);
    context.strokeStyle = `rgba(180, 226, 255, ${alpha})`;
    context.lineWidth = star.size;
    context.beginPath();
    context.moveTo(tail.x, tail.y);
    context.lineTo(position.x, position.y);
    context.stroke();
  }

  context.save();
  context.translate(CONFIG.arena.centerX, CONFIG.arena.centerY);
  context.strokeStyle = CONFIG.colors.guide;
  context.lineWidth = 1;
  for (let index = 0; index < 24; index += 1) {
    const angle = (index * CONFIG.TAU) / 24;
    context.beginPath();
    context.moveTo(Math.cos(angle) * 34, Math.sin(angle) * 34);
    context.lineTo(
      Math.cos(angle) * CONFIG.arena.playerRadius,
      Math.sin(angle) * CONFIG.arena.playerRadius,
    );
    context.stroke();
  }

  for (const radius of CONFIG.arena.guideRings) {
    context.beginPath();
    context.arc(0, 0, radius, 0, CONFIG.TAU);
    context.stroke();
  }

  context.strokeStyle = CONFIG.colors.ring;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, 0, CONFIG.arena.playerRadius, 0, CONFIG.TAU);
  context.stroke();

  context.strokeStyle = "rgba(255, 107, 107, 0.18)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, CONFIG.arena.dangerRadius, 0, CONFIG.TAU);
  context.stroke();
  context.restore();
}

function drawPlayer(context: CanvasRenderingContext2D, player: ReadonlyPlayerState): void {
  const position = arenaPosition(player.angle, player.radius);
  const flicker =
    player.invulnerabilityTimer > 0 && Math.floor(player.invulnerabilityTimer * 18) % 2 === 0;
  if (flicker) {
    return;
  }

  context.save();
  context.translate(position.x, position.y);
  context.rotate(player.angle + Math.PI);
  context.shadowColor = CONFIG.colors.player;
  context.shadowBlur = 16;

  context.fillStyle =
    player.dashInvulnerabilityTimer > 0 ? CONFIG.colors.playerAccent : CONFIG.colors.player;
  context.strokeStyle = "#eaffff";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(18, 0);
  context.lineTo(-11, -10);
  context.lineTo(-7, 0);
  context.lineTo(-11, 10);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = CONFIG.colors.playerAccent;
  context.beginPath();
  context.moveTo(-13, -5);
  context.lineTo(-21, 0);
  context.lineTo(-13, 5);
  context.closePath();
  context.fill();
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

function drawProjectile(
  context: CanvasRenderingContext2D,
  projectile: ReadonlyProjectileState,
): void {
  const head = arenaPosition(projectile.angle, projectile.radius);
  const tailRadius = projectile.radius - Math.sign(projectile.radialSpeed || 1) * 13;
  const tail = arenaPosition(projectile.angle, tailRadius);

  context.save();
  context.globalAlpha = projectile.owner === "player" ? 0.95 : 0.88;
  context.strokeStyle = projectile.color;
  context.fillStyle = projectile.color;
  context.lineWidth = projectile.owner === "player" ? 3 : 4;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(tail.x, tail.y);
  context.lineTo(head.x, head.y);
  context.stroke();
  context.beginPath();
  context.arc(head.x, head.y, projectile.size, 0, CONFIG.TAU);
  context.fill();
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

function enemyColor(enemy: ReadonlyEnemyState): string {
  if (enemy.hitFlash > 0) {
    return "#ffffff";
  }

  switch (enemy.type) {
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

function drawEnemy(context: CanvasRenderingContext2D, enemy: ReadonlyEnemyState): void {
  const position = arenaPosition(enemy.angle, enemy.radius);
  const color = enemyColor(enemy);

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
    context.fillStyle = color;
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

  for (const beam of boss.beams) {
    const alpha = beam.active ? 0.84 : 0.28 + Math.sin(beam.timer * 28) * 0.08;
    const width = beam.active ? 23 : 12;
    context.save();
    context.translate(CONFIG.arena.centerX, CONFIG.arena.centerY);
    context.rotate(beam.angle);
    context.strokeStyle = beam.active ? CONFIG.colors.beam : CONFIG.colors.warning;
    context.lineWidth = width;
    context.globalAlpha = alpha;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(18, 0);
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
  context.setLineDash([4, 3]);

  if (state.state !== "title") {
    const playerPosition = arenaPosition(state.player.angle, state.player.radius);
    drawHitboxCircle(
      context,
      playerPosition,
      state.player.size * PLAYER_HITBOX_SCALE,
      CONFIG.colors.player,
    );
  }

  for (const enemy of state.enemies) {
    const position = arenaPosition(enemy.angle, enemy.radius);
    drawHitboxCircle(context, position, enemy.size * ENEMY_HITBOX_SCALE, CONFIG.colors.enemyBullet);
    if (enemy.type === "shield" && enemy.shieldRadius !== undefined) {
      drawHitboxCircle(context, position, enemy.shieldRadius, CONFIG.colors.shield);
    }
  }

  for (const projectile of [...state.playerShots, ...state.enemyBullets]) {
    drawHitboxCircle(
      context,
      arenaPosition(projectile.angle, projectile.radius),
      projectile.size,
      projectile.color,
    );
  }

  for (const powerup of state.powerups) {
    drawHitboxCircle(
      context,
      arenaPosition(powerup.angle, powerup.radius),
      powerup.size,
      powerUpColor(powerup),
    );
  }

  if (state.boss?.active) {
    drawHitboxCircle(
      context,
      { x: CONFIG.arena.centerX, y: CONFIG.arena.centerY },
      CONFIG.arena.bossHitRadius,
      CONFIG.colors.boss,
    );
  }

  context.restore();
}

function drawHitboxCircle(
  context: CanvasRenderingContext2D,
  position: Point,
  radius: number,
  color: string,
): void {
  context.strokeStyle = color;
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, CONFIG.TAU);
  context.stroke();
}
