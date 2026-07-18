import { describe, expect, it } from "vitest";

import {
  accuracyPercent,
  createRunMetrics,
  damageSourceLabel,
  recordDamage,
  recordFirstAction,
  recordWaveTiming,
} from "../../src/game/runMetrics";

describe("M1 run metrics", () => {
  it("records first-action timings once", () => {
    const metrics = createRunMetrics();
    metrics.elapsedSeconds = 0.42;
    recordFirstAction(metrics, "move");
    recordFirstAction(metrics, "fire", 0.78);
    recordFirstAction(metrics, "dash", 4.2);
    recordFirstAction(metrics, "move", 9);

    expect(metrics).toMatchObject({
      firstMoveSeconds: 0.42,
      firstShotSeconds: 0.78,
      firstDashSeconds: 4.2,
    });
  });

  it("summarizes accuracy without dividing by zero", () => {
    const metrics = createRunMetrics();
    expect(accuracyPercent(metrics)).toBe(0);

    metrics.shotsFired = 7;
    metrics.shotsHit = 4;
    expect(accuracyPercent(metrics)).toBe(57);
  });

  it("attributes damage and captures authored wave durations", () => {
    const metrics = createRunMetrics();
    recordDamage(metrics, "enemy-projectile");
    recordDamage(metrics, "enemy-contact");
    recordDamage(metrics, "enemy-projectile");

    metrics.elapsedSeconds = 12.5;
    recordWaveTiming(metrics, 1);
    metrics.elapsedSeconds = 29.25;
    recordWaveTiming(metrics, 2);

    expect(metrics.damageTaken).toBe(3);
    expect(metrics.damageBySource).toEqual({
      "enemy-projectile": 2,
      "enemy-contact": 1,
      "boss-beam": 0,
    });
    expect(metrics.lastDamageSource).toBe("enemy-projectile");
    expect(metrics.lastDamageEnemyType).toBeNull();
    expect(metrics.waveTimings).toEqual([
      { wave: 1, seconds: 12.5 },
      { wave: 2, seconds: 16.75 },
    ]);
    expect(damageSourceLabel("boss-beam")).toBe("BOSS BEAM");
    expect(damageSourceLabel("enemy-contact", "hunter")).toBe("HUNTER BREACH");
    expect(damageSourceLabel("enemy-projectile", "shooter")).toBe("SHOOTER BOLT");
  });
});
