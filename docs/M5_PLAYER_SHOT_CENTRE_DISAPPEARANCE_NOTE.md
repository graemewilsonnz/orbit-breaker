# M5 Investigation: Player shots crossing the centre

Status: Resolved in M5  
Date: 2026-07-23

## Observation

Player shots do not disappear when they reach the centre of the arena. They remain visible briefly
on the opposite side, which breaks the intended pseudo-3D tube model: the shot should terminate at
the actual centre opening.

## Code trace

- `src/game/systems/player.ts:118-127` creates a player shot at `player.radius - 20` (currently
  radius `260`) with radial speed `-CONFIG.projectiles.playerSpeed` (currently `-520`).
- `src/game/Game.ts:636-647` updates shots, runs collisions, and then removes only shots whose
  `active` flag is false.
- `src/game/systems/weapons.ts:52-62` subtracts radial distance each fixed step, but deactivates
  player shots only after `radius < -24`. There is no centre/tube cutoff at radius `0` or at a
  configured inner radius.
- `src/game/systems/weapons.ts:65-71` converts the signed radius through `polarToCartesian()`. A
  negative radius is rendered as the equivalent positive radius at the opposite angle, so the shot
  visually crosses through the centre instead of disappearing.
- `src/game/render/CanvasRenderer.ts:513-523` draws the projectile head and trail directly from that
  signed radius, making the wrap-through visible.
- `src/game/systems/collision.ts:39-105` continues checking active player shots after movement.
  `src/game/systems/boss.ts:298-305` also accepts a boss shot whenever `radius <= 94`, which
  includes negative-radius shots. This means the issue is potentially gameplay-relevant as well as
  visual, especially during boss fire lanes.

## Diagnosis

The defect is caused by using signed radial distance as both travel state and render position,
combined with a negative off-screen cleanup threshold. At the current speed, a shot fired at radius
`260` reaches radius `0` in about `0.5` seconds, then travels another `24` logical pixels before
cleanup. `polarToCartesian()` maps that interval to the far side of the circle.

Enemy bullets use the opposite radial direction and an outer cleanup threshold, so this specific
centre-crossing behavior is limited to player shots.

## M5 follow-up direction

When this is fixed, player-shot lifecycle should have an explicit inner termination boundary tied to
the centre/tube presentation. The chosen boundary must be checked against the boss aperture and
core-hit rules so normal boss shots can still resolve at the intended `bossHitRadius` before the
projectile is removed. A regression check should confirm that a player shot is inactive at the
centre boundary and never renders or collides on the opposite side.

## Resolution

- `CONFIG.arena.innerKillRadius` now defines the explicit centre boundary.
- `updateProjectile()` clamps inward player shots to that boundary and deactivates them immediately,
  so no negative radius reaches rendering or collision handling.
- Boss shots still resolve at `bossHitRadius` before reaching the centre cutoff.
- `tests/scenarios/m5-projectiles.test.ts` covers centre termination, Cartesian centre position,
  boss-core resolution, swept player-shot and hostile-shot hits, and a swept near miss.
