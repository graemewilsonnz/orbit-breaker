# M2 Wave Outcome and Perfect-Bonus Notes

Audit date: 2026-07-18  
Status: design and implementation note; M1 gameplay is unchanged

## Decision

Use separate wave outcomes:

| Outcome              | Condition                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Wave Clear           | The player survives and the wave reaches its normal completion condition.                 |
| No-Damage / Flawless | The player takes no life damage during the wave.                                          |
| Full Clear           | Every required enemy is destroyed; no required enemy escapes or breaches the player ring. |
| Perfect Wave         | Wave Clear + No-Damage + Full Clear + no bomb used.                                       |

Bomb kills count as destroyed for Full Clear, but using a bomb disqualifies Perfect. Dash remains
fully allowed. A shield absorption does not count as player damage, but an enemy removed by that
contact is still a breach rather than a kill, so it prevents Full Clear and Perfect.

These outcomes may award independently. If Perfect also adds score on top of Flawless and Full
Clear, make that stacking explicit in the scoring configuration and result presentation.

## Current-code audit

The reported bug is present:

- `GameState.perfectWave` is a single boolean. It starts as `true` and is reset to `true` for each
  wave.
- Only `Game.onPlayerDamaged()` sets it to `false`.
- `Game.completeWave()` awards `perfectWaveBonus` whenever that boolean remains true. It does not
  check spawned, destroyed, escaped, breached, or bomb-use counts.
- `updateEnemy()` marks an enemy inactive after it crosses the outer kill radius. `Game.cleanup()`
  then removes it without recording an escape or invalidating Perfect.
- Contact collision marks an enemy inactive whether or not the hit removes a life. If dash
  invulnerability, post-hit invulnerability, or a shield prevents damage, the enemy disappears and
  Perfect can remain true.
- `activateBomb()` marks all active enemies inactive and calls `registerKill()` for each one. Bomb
  kills are therefore mixed into the normal destroyed count, and bomb use does not disqualify
  Perfect.
- Normal wave completion is not timer-only: it waits until the spawn queue is empty, the active
  enemy count is zero, and the 0.8-second completion delay expires. That completion rule can remain,
  but it must not determine bonus eligibility.
- The HUD exposes only `PERFECT WAVE +1000` or `REGROUP`; there are no separate Wave Clear,
  Flawless, or Full Clear results.
- No automated test currently exercises Perfect eligibility or distinguishes enemy-removal reasons.

The underlying issue is that `enemy.active = false` serves both as a lifecycle transition and as the
only cleanup signal. Once cleanup filters the enemy out, the reason it left play is lost.

## M2 implementation shape

Introduce per-wave statistics that reset in `startWave()`:

```ts
interface WaveStats {
  requiredEnemiesSpawned: number;
  enemiesDestroyed: number;
  enemiesKilledByBomb: number;
  enemiesBreached: number;
  enemiesEscaped: number;
  playerDamaged: boolean;
  bombUsed: boolean;
}
```

`enemiesDestroyed` should include all genuine destructions, with `enemiesKilledByBomb` as a subset.
This preserves the rule that bomb kills allow Full Clear while still supporting the no-bomb Perfect
condition. Alternatively, store normal and bomb destructions separately and derive their sum.

Give spawned enemies an origin or eligibility flag so only authored, required wave enemies affect
these counts. Debug spawns, boss adds, and any future ambient hazards must not accidentally alter a
normal wave result.

Centralize enemy removal behind an idempotent resolution operation instead of assigning
`active = false` throughout the game:

```ts
type EnemyResolution = "shot" | "bomb" | "contact" | "escaped" | "transition";

resolveEnemy(enemy, resolution);
```

The resolver should mark the enemy resolved exactly once, update wave statistics when the enemy is
required, emit the relevant metric/effect, and then let cleanup remove resolved entities. Suggested
mapping:

| Resolution               | Destroyed | Breached/Escaped |              Disqualifies Perfect |
| ------------------------ | --------: | ---------------: | --------------------------------: |
| Shot                     |       Yes |               No |                                No |
| Bomb                     |       Yes |               No |           Yes, through `bombUsed` |
| Contact                  |        No |         Breached |    Yes, through failed Full Clear |
| Outer boundary           |        No |          Escaped |    Yes, through failed Full Clear |
| Transition/debug cleanup |        No |               No | No; excluded from wave accounting |

Derive outcomes at wave completion rather than maintaining a mutable `perfectWave` flag:

```ts
const survived = player.lives > 0;
const noDamage = !waveStats.playerDamaged;
const fullClear =
  waveStats.enemiesDestroyed === waveStats.requiredEnemiesSpawned &&
  waveStats.enemiesBreached === 0 &&
  waveStats.enemiesEscaped === 0;
const perfect = survived && noDamage && fullClear && !waveStats.bombUsed;
```

Keep the existing 0.8-second empty-wave delay for pacing. Award and display Wave Clear, Flawless,
Full Clear, and Perfect separately after the outcome is derived.

## Required regression scenarios

1. All required enemies destroyed by normal fire, no damage, no bomb: all four outcomes pass.
2. One enemy escapes: Wave Clear and Flawless may pass; Full Clear and Perfect fail.
3. One enemy hits and damages the player: Wave Clear may pass; Flawless, Full Clear, and Perfect
   fail.
4. A dashing, shielded, or temporarily invulnerable player absorbs contact: Flawless passes, but
   Full Clear and Perfect fail because the enemy breached rather than being destroyed.
5. A bomb destroys every enemy without player damage: Wave Clear, Flawless, and Full Clear pass;
   Perfect fails; bomb kills are visible as a subset of destroyed enemies.
6. Transition or debug cleanup does not increment kills, escapes, or breaches.
7. Resolving the same enemy twice cannot double-count a kill or escape.
8. Wave statistics reset between waves and appear accurately in debug and wave-clear summaries.

M2 should establish the trustworthy enemy lifecycle and test coverage. M3 can then tune the score
values, stacking, and full-run presentation without building on ambiguous removal accounting.
