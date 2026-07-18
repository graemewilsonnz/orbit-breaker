import { CONFIG } from "./config";
import type { EnemyType } from "./content/enemies";
import { POWER_UP_TYPES, type PowerUpType } from "./content/powerups";
import {
  GameplayEventQueue,
  type AudioCue,
  type EventUnion,
  type GameplayEventMap,
} from "./core/events";
import { distance } from "./core/geometry";
import { SeededRng, SystemRng, type RandomSeed, type RandomSource } from "./core/rng";
import {
  accuracyPercent,
  createRunMetrics,
  recordDamage,
  recordFirstAction,
  recordWaveTiming,
  type DamageSource,
  type ReadonlyRunMetrics,
} from "./runMetrics";
import {
  asReadonlyGameState,
  type EffectState,
  type EnemyState,
  type EnemyResolution,
  type GameState,
  type GameStateId,
  type PausableGameStateId,
  type ProjectileState,
  type ReadonlyGameState,
  type StarState,
} from "./state";
import {
  handleCollisions,
  handlePowerUpCollisions,
  updateShieldLinks,
  type CollisionHost,
} from "./systems/collision";
import { createBoss, createEnemy, enemyColor, updateBoss, updateEnemy } from "./systems/enemies";
import type { EffectRequest, EnemyOverrides } from "./systems/host";
import type { InputSnapshot } from "./systems/input";
import { createPlayerState, playerPosition, resetPlayer, updatePlayer } from "./systems/player";
import { chooseDropType, createPowerUp, updatePowerUp } from "./systems/powerups";
import { startWave, updateWave } from "./systems/spawning";
import { projectilePosition, updateProjectile } from "./systems/weapons";
import {
  createWaveStats,
  deriveWaveOutcome,
  type WaveOutcome,
  type WaveStats,
} from "./waveOutcomes";

export const DEFAULT_RUN_SEED = "orbit-breaker-m2";

export interface GameOptions {
  readonly seed?: RandomSeed;
  readonly presentationRandom?: RandomSource;
}

export interface GameSnapshot {
  readonly state: GameStateId;
  readonly pausedFrom: PausableGameStateId;
  readonly seed: RandomSeed;
  readonly currentWave: number;
  readonly waveReached: number;
  readonly score: number;
  readonly lives: number;
  readonly multiplier: number;
  readonly bombs: number;
  readonly weaponLevel: number;
  readonly playerAngle: number;
  readonly enemies: number;
  readonly playerShots: number;
  readonly enemyBullets: number;
  readonly powerups: number;
  readonly bossHealth: number | null;
  readonly bossPhase: number | null;
  readonly pendingSpawns: number;
  readonly waveElapsed: number;
  readonly dashCooldown: number;
  readonly waveStats: Readonly<WaveStats>;
  readonly lastWaveOutcome: Readonly<WaveOutcome> | null;
  readonly run: RunSummarySnapshot;
}

export interface RunSummarySnapshot extends ReadonlyRunMetrics {
  readonly accuracyPercent: number;
}

type GameplayEvent = EventUnion<GameplayEventMap>;

/**
 * Deterministic simulation orchestrator. It owns no DOM, Canvas, or Web Audio
 * objects; presentation adapters consume its readonly state and typed events.
 */
export class Game implements CollisionHost {
  readonly state: GameState;
  readonly events = new GameplayEventQueue();

  private runSeed: RandomSeed;
  private gameplayRandom: SeededRng;
  private readonly presentationRandom: RandomSource;
  private debugInvulnerable = false;

  constructor(options: GameOptions = {}) {
    this.runSeed = options.seed ?? DEFAULT_RUN_SEED;
    this.gameplayRandom = new SeededRng(this.runSeed);
    this.presentationRandom = options.presentationRandom ?? new SystemRng();
    this.state = createInitialState(this.presentationRandom);
    this.emitUiNotice("title");
  }

  get rng(): RandomSource {
    return this.gameplayRandom;
  }

  get seed(): RandomSeed {
    return this.runSeed;
  }

  view(): ReadonlyGameState {
    return asReadonlyGameState(this.state);
  }

  drainEvents(): GameplayEvent[] {
    return this.events.drain();
  }

  step(dt: number, input: InputSnapshot): void {
    if (!Number.isFinite(dt) || dt <= 0) {
      throw new RangeError("Game.step dt must be a positive finite number");
    }

    this.updateStars(dt);

    if (this.state.state === "title") {
      if (input.wasPressed("enter")) {
        this.startRun();
      }
      return;
    }

    if (this.state.state === "gameOver" || this.state.state === "victory") {
      this.updateEffects(dt);
      if (input.wasPressed("enter")) {
        this.startRun();
      }
      return;
    }

    if (this.state.state === "paused") {
      if (input.wasPressed("pause")) {
        this.transitionTo(this.state.pausedFrom);
      }
      return;
    }

    if (input.wasPressed("pause")) {
      this.state.pausedFrom = this.state.state;
      this.transitionTo("paused");
      return;
    }

    if (this.state.state === "waveClear") {
      this.state.runMetrics.elapsedSeconds += dt;
      this.state.stateTimer -= dt;
      this.updatePowerUps(dt);
      this.handlePowerUpCollisionsOnly();
      this.updateEffects(dt);
      if (this.state.stateTimer <= 0) {
        this.afterWaveClear();
      }
      return;
    }

    if (this.state.state === "bossIntro") {
      this.state.runMetrics.elapsedSeconds += dt;
      this.state.stateTimer -= dt;
      this.updatePowerUps(dt);
      this.handlePowerUpCollisionsOnly();
      this.updateEffects(dt);
      if (this.state.stateTimer <= 0) {
        this.state.boss = createBoss();
        this.transitionTo("playing");
      }
      return;
    }

    this.state.runMetrics.elapsedSeconds += dt;
    this.updatePlaying(dt, input);
  }

  startRun(): void {
    this.startAtWave(1);
  }

  startAtWave(waveNumber: number): void {
    this.gameplayRandom = new SeededRng(this.runSeed);
    resetPlayer(this.state.player);
    this.resolveAllEnemies("transition");
    this.state.enemies = [];
    this.state.playerShots = [];
    this.state.enemyBullets = [];
    this.state.powerups = [];
    this.state.effects = [];
    this.state.boss = null;
    this.state.currentWave = waveNumber;
    this.state.waveReached = waveNumber;
    this.state.killStreak = 0;
    this.state.waveStats = createWaveStats();
    this.state.lastWaveOutcome = null;
    this.state.shake = 0;
    this.state.stateTimer = 0;
    this.state.pausedFrom = "playing";
    this.state.runMetrics = createRunMetrics();
    startWave(this.state.wave, waveNumber, this.gameplayRandom);
    this.transitionTo("playing");
    this.events.emit("metric", {
      name: "run-started",
      value: 1,
      tags: { seed: String(this.runSeed), wave: waveNumber },
    });
  }

  startBossScenario(): void {
    this.startAtWave(8);
    this.state.wave.queue = [];
    this.state.enemies = [];
    this.state.boss = createBoss();
    this.state.currentWave = 8;
    this.state.waveReached = 8;
  }

  setRunSeed(seed: RandomSeed, restart = false): void {
    this.runSeed = seed;
    this.gameplayRandom = new SeededRng(seed);
    if (restart) {
      this.startRun();
    }
  }

  setDebugInvulnerable(enabled: boolean): void {
    this.debugInvulnerable = enabled;
    if (!enabled) {
      this.state.player.dashInvulnerabilityTimer = 0;
    }
  }

  isDebugInvulnerable(): boolean {
    return this.debugInvulnerable;
  }

  setDebugDashCooldown(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > CONFIG.player.dashCooldown) {
      throw new RangeError(
        `Debug dash cooldown must be between 0 and ${CONFIG.player.dashCooldown}`,
      );
    }
    this.state.player.dashCooldown = seconds;
  }

  forceState(state: "gameOver" | "victory"): void {
    if (state === "gameOver") {
      this.state.player.lives = 0;
      this.gameOver();
    } else {
      this.defeatBoss();
    }
  }

  emitAudio(cue: AudioCue): void {
    this.events.emit("audio", { cue });
  }

  addEffect(effect: EffectRequest): void {
    const stateEffect: EffectState = {
      ...effect,
      age: 0,
      active: true,
    };
    this.state.effects.push(stateEffect);

    const position =
      effect.x !== undefined && effect.y !== undefined
        ? { coordinateSpace: "cartesian" as const, x: effect.x, y: effect.y }
        : {
            coordinateSpace: "polar" as const,
            angle: effect.angle ?? 0,
            radius: effect.radius ?? 0,
          };
    this.events.emit("effect", {
      kind: effect.type,
      position,
      color: effect.color,
      size: effect.size,
      durationSeconds: effect.duration,
    });
  }

  setShake(intensity: number): void {
    this.state.shake = Math.max(this.state.shake, intensity);
    this.events.emit("camera-shake", {
      intensity,
      durationSeconds: intensity,
    });
  }

  spawnEnemy(type: EnemyType, angle: number, overrides?: EnemyOverrides): void {
    const enemy = createEnemy(type, angle, this.gameplayRandom, overrides);
    this.state.enemies.push(enemy);
    if (enemy.origin === "wave") {
      this.state.waveStats.requiredEnemiesSpawned += 1;
    }
    this.events.emit("metric", {
      name: "enemy-spawned",
      value: 1,
      tags: { origin: enemy.origin, type, wave: this.state.currentWave },
    });
    this.emitAudio(enemySignalCue(type));
  }

  spawnPowerUp(type: PowerUpType, angle = this.state.player.angle): void {
    this.state.powerups.push(
      createPowerUp(type, angle, this.state.player.radius - 20, this.gameplayRandom),
    );
  }

  addScore(base: number, source: EnemyState | null = null, flat = false): void {
    let amount = base;
    if (source !== null && source.radius <= CONFIG.scoring.earlyKillRadius) {
      amount += Math.round(base * CONFIG.scoring.earlyKillBonus);
    }
    if (!flat) {
      amount *= this.state.player.multiplier;
    }
    this.state.player.score += Math.round(amount);
  }

  resolveEnemy(enemy: EnemyState, resolution: EnemyResolution): boolean {
    if (!enemy.active || enemy.resolution !== null) {
      return false;
    }

    enemy.active = false;
    enemy.resolution = resolution;

    if (enemy.origin === "wave") {
      switch (resolution) {
        case "shot":
          this.state.waveStats.enemiesDestroyed += 1;
          break;
        case "bomb":
          this.state.waveStats.enemiesDestroyed += 1;
          this.state.waveStats.enemiesKilledByBomb += 1;
          break;
        case "contact":
          this.state.waveStats.enemiesBreached += 1;
          break;
        case "escaped":
          this.state.waveStats.enemiesEscaped += 1;
          break;
        case "transition":
          break;
      }
    }

    if (resolution === "shot" || resolution === "bomb") {
      this.registerKill(enemy, resolution === "shot");
    }
    if (enemy.type === "shield") {
      updateShieldLinks(this);
    }
    this.events.emit("metric", {
      name: "enemy-resolved",
      value: 1,
      tags: { origin: enemy.origin, resolution, type: enemy.type, wave: this.state.currentWave },
    });
    return true;
  }

  private registerKill(enemy: EnemyState, allowDrop: boolean): void {
    this.state.runMetrics.enemiesDestroyed += 1;
    this.addScore(enemy.score, enemy, false);
    this.state.killStreak += 1;
    this.state.player.multiplier = Math.min(
      CONFIG.scoring.maxMultiplier,
      1 + Math.floor(this.state.killStreak / CONFIG.scoring.killsPerMultiplier),
    );
    this.addEffect({
      type: "burst",
      angle: enemy.angle,
      radius: enemy.radius,
      color: enemyColor(enemy),
      size: enemy.size * 3.2,
      duration: 0.28,
    });
    this.emitAudio("enemyDestroyed");
    this.events.emit("metric", {
      name: "enemy-destroyed",
      value: 1,
      tags: { type: enemy.type, wave: this.state.currentWave },
    });

    if (allowDrop) {
      this.maybeDropPowerUp(enemy);
    }
  }

  activateBomb(): void {
    if (this.state.player.bombCount <= 0 || this.state.state !== "playing") {
      return;
    }

    this.state.player.bombCount -= 1;
    if (this.state.boss === null) {
      this.state.waveStats.bombUsed = true;
    }
    for (const enemy of this.state.enemies) {
      this.resolveEnemy(enemy, "bomb");
    }
    this.state.enemyBullets = [];

    if (this.state.boss?.active) {
      this.state.boss.health -= 5;
      this.state.boss.hitFlash = 0.1;
      if (this.state.boss.health <= 0) {
        this.state.boss.active = false;
        this.defeatBoss();
      }
    }

    const position = playerPosition(this.state.player);
    this.addEffect({
      type: "bomb",
      x: position.x,
      y: position.y,
      color: CONFIG.colors.powerBomb,
      size: 360,
      duration: 0.48,
    });
    this.setShake(0.22);
    this.emitAudio("bomb");
  }

  clearNearbyEnemyBullets(radius: number): void {
    const playerPoint = playerPosition(this.state.player);
    for (const bullet of this.state.enemyBullets) {
      if (distance(playerPoint, projectilePosition(bullet)) <= radius) {
        bullet.active = false;
      }
    }
  }

  onPlayerDamaged(source: DamageSource, enemyType: EnemyType | null = null): void {
    recordDamage(this.state.runMetrics, source, enemyType);
    if (this.state.boss === null) {
      this.state.waveStats.playerDamaged = true;
    }
    this.state.killStreak = 0;
    this.state.player.multiplier = 1;
    this.clearNearbyEnemyBullets(125);
    this.addEffect({
      type: "burst",
      angle: this.state.player.angle,
      radius: this.state.player.radius,
      color: CONFIG.colors.enemyBullet,
      size: 68,
      duration: 0.32,
    });
    this.setShake(0.26);
    this.emitAudio("playerHit");
  }

  registerShotHit(projectile: ProjectileState): void {
    if (projectile.hitRegistered) {
      return;
    }
    projectile.hitRegistered = true;
    this.state.runMetrics.shotsHit += 1;
  }

  defeatBoss(): void {
    if (this.state.state === "victory") {
      return;
    }
    this.addScore(CONFIG.boss.score, null, true);
    if (this.state.player.bombCount > 0) {
      this.addScore(
        this.state.player.bombCount * CONFIG.scoring.unusedBombVictoryBonus,
        null,
        true,
      );
    }
    this.state.stateTimer = 0;
    this.state.enemyBullets = [];
    this.resolveAllEnemies("transition");
    this.state.powerups = [];
    this.addEffect({
      type: "bossPulse",
      x: CONFIG.arena.centerX,
      y: CONFIG.arena.centerY,
      color: CONFIG.colors.playerAccent,
      size: 260,
      duration: 0.9,
    });
    this.setShake(0.35);
    this.emitAudio("waveClear");
    this.transitionTo("victory");
  }

  snapshot(): GameSnapshot {
    return {
      state: this.state.state,
      pausedFrom: this.state.pausedFrom,
      seed: this.runSeed,
      currentWave: this.state.currentWave,
      waveReached: this.state.waveReached,
      score: this.state.player.score,
      lives: this.state.player.lives,
      multiplier: this.state.player.multiplier,
      bombs: this.state.player.bombCount,
      weaponLevel: this.state.player.weaponLevel,
      playerAngle: this.state.player.angle,
      enemies: this.state.enemies.length,
      playerShots: this.state.playerShots.length,
      enemyBullets: this.state.enemyBullets.length,
      powerups: this.state.powerups.length,
      bossHealth: this.state.boss?.health ?? null,
      bossPhase: this.state.boss?.phase ?? null,
      pendingSpawns: this.state.wave.queue.length,
      waveElapsed: this.state.wave.elapsed,
      dashCooldown: this.state.player.dashCooldown,
      waveStats: { ...this.state.waveStats },
      lastWaveOutcome:
        this.state.lastWaveOutcome === null ? null : { ...this.state.lastWaveOutcome },
      run: createRunSummary(this.state.runMetrics),
    };
  }

  deterministicState(): string {
    return JSON.stringify({
      summary: this.snapshot(),
      random: this.gameplayRandom.snapshot(),
      player: this.state.player,
      wave: this.state.wave,
      enemies: this.state.enemies,
      playerShots: this.state.playerShots,
      enemyBullets: this.state.enemyBullets,
      powerups: this.state.powerups,
      boss: this.state.boss,
      killStreak: this.state.killStreak,
      waveStats: this.state.waveStats,
      lastWaveOutcome: this.state.lastWaveOutcome,
      runMetrics: this.state.runMetrics,
    });
  }

  private updatePlaying(dt: number, input: InputSnapshot): void {
    const shotsBefore = this.state.playerShots.length;
    const dashCooldownBefore = this.state.player.dashCooldown;
    const moving = input.isDown("left") !== input.isDown("right");
    updatePlayer(this.state.player, dt, input, this);
    const shotsFired = this.state.playerShots.length - shotsBefore;
    if (moving) {
      recordFirstAction(this.state.runMetrics, "move");
    }
    if (shotsFired > 0) {
      this.state.runMetrics.shotsFired += shotsFired;
      recordFirstAction(this.state.runMetrics, "fire");
    }
    if (this.state.player.dashCooldown > dashCooldownBefore) {
      recordFirstAction(this.state.runMetrics, "dash");
    }
    if (this.debugInvulnerable) {
      this.state.player.dashInvulnerabilityTimer = Math.max(
        this.state.player.dashInvulnerabilityTimer,
        0.1,
      );
    }

    for (const enemy of this.state.enemies) {
      updateEnemy(enemy, dt, this);
    }
    if (this.state.boss !== null) {
      updateBoss(this.state.boss, dt, this);
    }
    if (this.state.player.lives <= 0) {
      this.gameOver();
      return;
    }
    for (const projectile of this.state.playerShots) {
      updateProjectile(projectile, dt);
    }
    for (const projectile of this.state.enemyBullets) {
      updateProjectile(projectile, dt);
    }

    this.updatePowerUps(dt);
    updateShieldLinks(this);
    handleCollisions(this);
    this.updateEffects(dt);
    this.cleanup();

    if (this.state.player.lives <= 0 && this.state.state === "playing") {
      this.gameOver();
      return;
    }

    if (this.state.state === "playing") {
      updateWave(this.state.wave, dt, {
        bossActive: this.state.boss !== null,
        enemyCount: this.state.enemies.length,
        spawnEnemy: (type, angle) => this.spawnEnemy(type, angle, { origin: "wave" }),
        completeWave: () => this.completeWave(),
      });
    }
  }

  private updatePowerUps(dt: number): void {
    for (const powerup of this.state.powerups) {
      updatePowerUp(powerup, dt);
    }
  }

  private updateEffects(dt: number): void {
    for (const effect of this.state.effects) {
      effect.age += dt;
      effect.active = effect.age < effect.duration;
    }
    this.state.effects = this.state.effects.filter((effect) => effect.active);
    this.state.shake = Math.max(0, this.state.shake - dt);
  }

  private updateStars(dt: number): void {
    for (const star of this.state.stars) {
      star.radius += star.speed * dt;
      if (star.radius > CONFIG.arena.outerKillRadius + 80) {
        star.angle = this.presentationRandom.next() * CONFIG.TAU;
        star.radius = this.presentationRandom.range(0, 18);
        star.speed = this.presentationRandom.range(18, 86);
        star.size = this.presentationRandom.range(0.7, 2.2);
      }
    }
  }

  private handlePowerUpCollisionsOnly(): void {
    handlePowerUpCollisions(this);
  }

  private cleanup(): void {
    this.state.enemies = this.state.enemies.filter((enemy) => enemy.active);
    this.state.playerShots = this.state.playerShots.filter((shot) => shot.active);
    this.state.enemyBullets = this.state.enemyBullets.filter((shot) => shot.active);
    this.state.powerups = this.state.powerups.filter((powerup) => powerup.active);
    if (this.state.boss !== null && !this.state.boss.active && this.state.state !== "victory") {
      this.state.boss = null;
    }
  }

  private completeWave(): void {
    if (this.state.state !== "playing" || this.state.boss !== null) {
      return;
    }

    const outcome = deriveWaveOutcome(this.state.waveStats, this.state.player.lives > 0);
    this.state.lastWaveOutcome = outcome;
    recordWaveTiming(this.state.runMetrics, this.state.currentWave);
    if (outcome.perfect) {
      this.addScore(CONFIG.scoring.perfectWaveBonus, null, true);
    }
    this.events.emit("metric", {
      name: "wave-outcome",
      value: outcome.perfect ? 1 : 0,
      tags: {
        bombUsed: this.state.waveStats.bombUsed,
        fullClear: outcome.fullClear,
        noDamage: outcome.noDamage,
        perfect: outcome.perfect,
        wave: this.state.currentWave,
      },
    });
    if (this.state.currentWave === 8) {
      this.spawnPreBossDrops();
    }
    this.state.stateTimer = 1.7;
    this.emitAudio("waveClear");
    this.transitionTo("waveClear");
  }

  private afterWaveClear(): void {
    if (this.state.currentWave >= 8) {
      this.state.stateTimer = 2.15;
      this.emitAudio("bossWarning");
      this.transitionTo("bossIntro");
      return;
    }

    this.state.currentWave += 1;
    this.state.waveReached = Math.max(this.state.waveReached, this.state.currentWave);
    this.state.waveStats = createWaveStats();
    startWave(this.state.wave, this.state.currentWave, this.gameplayRandom);
    this.state.runMetrics.waveStartedSeconds = this.state.runMetrics.elapsedSeconds;
    this.transitionTo("playing");
  }

  private spawnPreBossDrops(): void {
    for (let index = 0; index < POWER_UP_TYPES.length; index += 1) {
      const type = POWER_UP_TYPES[index];
      if (type !== undefined) {
        this.state.powerups.push(
          createPowerUp(
            type,
            this.state.player.angle + (index - 1) * 0.12,
            this.state.player.radius - 20,
            this.gameplayRandom,
          ),
        );
      }
    }
  }

  private maybeDropPowerUp(enemy: EnemyState): void {
    const chance =
      this.state.currentWave % 3 === 0
        ? CONFIG.powerups.thirdWaveDropChance
        : CONFIG.powerups.baseDropChance;
    if (this.gameplayRandom.chance(chance)) {
      this.state.powerups.push(
        createPowerUp(
          chooseDropType(this.gameplayRandom),
          enemy.angle,
          Math.max(42, enemy.radius),
          this.gameplayRandom,
        ),
      );
    }
  }

  private gameOver(): void {
    this.state.stateTimer = 0;
    this.resolveAllEnemies("transition");
    this.state.enemyBullets = [];
    this.emitAudio("gameOver");
    this.transitionTo("gameOver");
  }

  private transitionTo(state: GameStateId): void {
    if (
      state === "waveClear" ||
      state === "bossIntro" ||
      state === "gameOver" ||
      state === "victory"
    ) {
      this.state.player.dashBufferTimer = 0;
    }
    this.state.state = state;
    const notices: Partial<Record<GameStateId, Parameters<Game["emitUiNotice"]>[0]>> = {
      title: "title",
      waveClear: "wave-clear",
      bossIntro: "boss-intro",
      paused: "paused",
      gameOver: "game-over",
      victory: "victory",
    };
    const notice = notices[state];
    if (notice !== undefined) {
      this.emitUiNotice(notice);
    }
  }

  private emitUiNotice(kind: GameplayEventMap["ui-notice"]["kind"]): void {
    this.events.emit("ui-notice", { kind });
  }

  private resolveAllEnemies(resolution: EnemyResolution): void {
    for (const enemy of this.state.enemies) {
      this.resolveEnemy(enemy, resolution);
    }
    this.state.enemies = this.state.enemies.filter((enemy) => enemy.active);
  }
}

function createInitialState(presentationRandom: RandomSource): GameState {
  return {
    state: "title",
    pausedFrom: "playing",
    stateTimer: 0,
    player: createPlayerState(),
    wave: {
      waveNumber: 1,
      definition: null,
      queue: [],
      elapsed: 0,
      completeDelay: 0,
    },
    enemies: [],
    playerShots: [],
    enemyBullets: [],
    powerups: [],
    effects: [],
    stars: createStars(presentationRandom),
    boss: null,
    currentWave: 1,
    waveReached: 1,
    killStreak: 0,
    waveStats: createWaveStats(),
    lastWaveOutcome: null,
    shake: 0,
    runMetrics: createRunMetrics(),
  };
}

function createStars(random: RandomSource): StarState[] {
  return Array.from({ length: 150 }, () => ({
    angle: random.next() * CONFIG.TAU,
    radius: random.next() * (CONFIG.arena.outerKillRadius + 50),
    speed: random.range(18, 86),
    size: random.range(0.7, 2.2),
  }));
}

function createRunSummary(metrics: ReadonlyRunMetrics): RunSummarySnapshot {
  return {
    ...metrics,
    damageBySource: { ...metrics.damageBySource },
    waveTimings: metrics.waveTimings.map((timing) => ({ ...timing })),
    accuracyPercent: accuracyPercent(metrics),
  };
}

function enemySignalCue(type: EnemyType): AudioCue {
  switch (type) {
    case "drifter":
      return "drifterSignal";
    case "spiral":
      return "spiralSignal";
    case "mine":
      return "mineSignal";
    case "shooter":
      return "shooterSignal";
    case "hunter":
      return "hunterSignal";
    case "shield":
      return "shieldSignal";
  }
}
