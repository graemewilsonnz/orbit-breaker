import { CONFIG } from "../config";
import { POWER_UP_TYPES, type PowerUpType } from "../content/powerups";
import { normalizeAngle, polarToCartesian, type Point } from "../core/geometry";
import type { AudioCue } from "../core/events";
import type { RandomSource } from "../core/rng";
import type { EffectState, EnemyState, GameState, PowerUpState } from "../state";

type EffectRequest = Omit<EffectState, "active" | "age">;

export interface PowerUpHost {
  readonly state: GameState;
  addEffect(effect: EffectRequest): void;
  addScore(base: number, source?: EnemyState | null, flat?: boolean): void;
  emitAudio(cue: AudioCue): void;
}

export function createPowerUp(
  type: PowerUpType | undefined,
  angle: number,
  radius: number,
  random: RandomSource,
): PowerUpState {
  return {
    type: type ?? random.choose(POWER_UP_TYPES),
    angle: normalizeAngle(angle),
    radius,
    size: CONFIG.powerups.size,
    radialSpeed: CONFIG.powerups.radialSpeed,
    angularVelocity: random.range(-0.28, 0.28),
    spin: 0,
    life: 13,
    active: true,
  };
}

export function updatePowerUp(powerup: PowerUpState, dt: number): void {
  powerup.life -= dt;
  powerup.spin += dt * 4;
  powerup.angle = normalizeAngle(powerup.angle + powerup.angularVelocity * dt);
  powerup.radius += powerup.radialSpeed * dt;

  if (powerup.life <= 0 || powerup.radius > CONFIG.arena.outerKillRadius + 20) {
    powerup.active = false;
  }
}

export function powerUpPosition(powerup: PowerUpState): Point {
  return polarToCartesian(
    powerup.angle,
    powerup.radius,
    CONFIG.arena.centerX,
    CONFIG.arena.centerY,
  );
}

export function applyPowerUp(powerup: PowerUpState, host: PowerUpHost): void {
  const { player } = host.state;

  if (powerup.type === "twin") {
    if (player.weaponLevel < 2) {
      player.weaponLevel = 2;
    } else if (player.weaponLevel < 3) {
      player.weaponLevel = 3;
      player.weaponTimer = CONFIG.powerups.weaponBoostDuration;
    } else {
      player.weaponTimer = CONFIG.powerups.weaponBoostDuration;
      host.addScore(750, null, true);
    }
  } else if (powerup.type === "shield") {
    player.shieldActive = true;
    player.shieldAngle = 0;
  } else {
    player.bombCount = Math.min(CONFIG.player.maxBombs, player.bombCount + 1);
  }

  const position = powerUpPosition(powerup);
  host.addEffect({
    type: "burst",
    x: position.x,
    y: position.y,
    color: getPowerUpColor(powerup.type),
    size: 38,
    duration: 0.34,
  });
  host.emitAudio("powerup");
  powerup.active = false;
}

export interface DropContext {
  readonly weaponLevel: number;
  readonly shieldActive: boolean;
  readonly bombCount: number;
}

export function chooseDropType(random: RandomSource, context?: DropContext): PowerUpType {
  const weights = {
    twin: context?.weaponLevel === 3 ? 0.12 : context?.weaponLevel === 1 ? 0.48 : 0.32,
    shield: context?.shieldActive ? 0.08 : 0.38,
    bomb: context?.bombCount === CONFIG.player.maxBombs ? 0 : 0.3,
  } as const;
  const total = weights.twin + weights.shield + weights.bomb;
  let roll = random.next() * total;
  for (const type of POWER_UP_TYPES) {
    roll -= weights[type];
    if (roll <= 0) {
      return type;
    }
  }
  return "twin";
}

export function getPowerUpColor(type: PowerUpType): string {
  if (type === "shield") {
    return CONFIG.colors.powerShield;
  }
  if (type === "bomb") {
    return CONFIG.colors.powerBomb;
  }
  return CONFIG.colors.powerTwin;
}
