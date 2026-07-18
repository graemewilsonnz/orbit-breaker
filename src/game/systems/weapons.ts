import { CONFIG } from "../config";
import { normalizeAngle, polarToCartesian } from "../core/geometry";
import type { CartesianPosition, EnemyState, ProjectileOwner, ProjectileState } from "../state";
import type { EnemyType } from "../content/enemies";

export interface ProjectileOptions {
  readonly owner: ProjectileOwner;
  readonly angle: number;
  readonly radius: number;
  readonly radialSpeed: number;
  readonly angularVelocity?: number;
  readonly size?: number;
  readonly damage?: number;
  readonly pierce?: number;
  readonly color?: string;
  readonly sourceEnemyType?: EnemyType | null;
}

/** Creates the same plain projectile state as the original Projectile constructor. */
export function createProjectile(options: ProjectileOptions): ProjectileState {
  return {
    owner: options.owner,
    angle: normalizeAngle(options.angle),
    radius: options.radius,
    radialSpeed: options.radialSpeed,
    angularVelocity: options.angularVelocity || 0,
    size: options.size || CONFIG.projectiles.playerSize,
    damage: options.damage || 1,
    pierce: options.pierce || 0,
    color: options.color || CONFIG.colors.playerBullet,
    active: true,
    age: 0,
    hitRegistered: false,
    sourceEnemyType: options.sourceEnemyType ?? null,
  };
}

export function createShooterProjectile(
  enemy: Pick<EnemyState, "angle" | "radius" | "size">,
): ProjectileState {
  return createProjectile({
    owner: "enemy",
    angle: enemy.angle,
    radius: enemy.radius + enemy.size,
    radialSpeed: CONFIG.projectiles.enemySpeed,
    size: CONFIG.projectiles.enemySize,
    color: CONFIG.colors.enemyBullet,
    sourceEnemyType: "shooter",
  });
}

export function updateProjectile(projectile: ProjectileState, dt: number): void {
  projectile.age += dt;
  projectile.angle = normalizeAngle(projectile.angle + projectile.angularVelocity * dt);
  projectile.radius += projectile.radialSpeed * dt;

  if (projectile.owner === "player" && projectile.radius < -24) {
    projectile.active = false;
  }
  if (projectile.owner === "enemy" && projectile.radius > CONFIG.arena.outerKillRadius + 52) {
    projectile.active = false;
  }
}

export function projectilePosition(projectile: ProjectileState): CartesianPosition {
  return polarToCartesian(
    projectile.angle,
    projectile.radius,
    CONFIG.arena.centerX,
    CONFIG.arena.centerY,
  );
}
