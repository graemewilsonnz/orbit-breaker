# M5 Pre-build Review Notes: M0–M4 Audit

Audit date: 2026-07-23  
Status: M5 engineering follow-ups closed; human balance/comprehension checks remain

## Summary

The M0–M4 implementation is substantially present and the engineering check passes: strict
typecheck, lint, 157 unit/scenario tests, and the production build all passed during this audit. The
existing M1, M2, and M4 playtest records provide useful manual evidence, but several acceptance
checks remain incomplete or are not covered by the current automated scenarios.

## Findings

### 1. M3 has no normal-flow eight-wave scenario

`tests/scenarios/m3-wave-progression.test.ts:24-61` runs every wave in an invincible idle flow and
an invincible forced full-clear flow. It does not run a non-invincible player through ordinary
survival, shooting, damage, escapes, pickups, and wave transitions. The M3 playtest record also
leaves the requested three complete normal runs as a manual verification boundary.

Follow-up: run and record at least three seeded normal runs from Wave 1 through the boss handoff,
including wave durations, damage sources, escapes, power-up dependence, and whether any wave stalls
or becomes unwinnable.

M5 disposition: a deterministic, non-invincible controller now uses ordinary movement, fire, dash,
bomb, and pickup inputs from Wave 1 through the boss handoff. It reaches the boss in 166.65 seconds
with lives remaining, records all eight wave timings, and does not use the invulnerability debug
path. Three human runs remain a balance/playtest task rather than an engineering blocker.

### 2. Swept collision support is not connected to gameplay

`src/game/core/geometry.ts:58-83` provides and unit-tests `sweptCircleOverlap()`, but
`src/game/systems/collision.ts:39-91` checks player shots only at their current position and
`src/game/systems/collision.ts:116-131` checks enemy bullets only at their current position. The
helper has no production call site. A fast projectile or moving target can therefore potentially
cross a hitbox between fixed steps without registering a collision.

Follow-up: create focused near-miss and between-frame-hit scenarios for player shots and enemy
bullets at current tuning, then decide whether swept collision is required for each path. This is
separate from the already documented
[player-shot centre-crossing note](./M5_PLAYER_SHOT_CENTRE_DISAPPEARANCE_NOTE.md).

M5 disposition: swept-circle checks are connected to both projectile paths using each projectile's
previous and current fixed-step positions. Focused tests prove between-endpoint hits for player and
hostile shots plus a hostile near miss. The centre-crossing lifecycle is separately fixed and
covered.

### 3. M4 manual acceptance is still open

The M4 section of `docs/PLAYTESTS.md` records deterministic boss coverage and targeted visual
inspection, but leaves these checks pending: three unpowered human attempts, first-time explanation
of the gold aperture and cyan safe arcs, full audio/effect restraint, frame pacing, overlay fit, and
production-build console output.

Follow-up: complete those checks without debug guidance and record total and per-phase durations,
comprehension issues, audio separation, peak frame timing, and any readability failures.

M5 disposition: the existing 81.02-second unpowered deterministic boss result remains green, and the
production title, active run, pause, settings, aperture, and beam-warning layouts have been
inspected without console errors. Three unpowered human attempts and first-time-player comprehension
remain explicitly open; they cannot be represented by an automated controller.

### 4. Browser smoke verification needs a runtime/harness check

`npm run test:e2e` currently starts, but all five Chromium tests time out in
`tests/browser/smoke.spec.ts:352-354` waiting for `window.__ORBIT_DEBUG__`; no route assertion is
reached. The captured page remains at the loading shell. This may be a reused Vite/browser-session
or environment issue rather than a gameplay failure, but it means the M0 browser gate is not
currently verified by this audit.

Follow-up: reproduce with a fresh supported Chromium/Vite session, capture page and console errors,
then rerun the title, state-route, M1 input, M4 visual, and no-audio smoke tests. Do not accept the
browser gate until the debug runtime is available and all five tests complete.

M5 disposition: Playwright now owns an isolated strict-port Vite server instead of reusing an
unknown process, and the debug hook is installed before the development panel's dynamic import. All
original routes plus the M5 settings, focus-pause, persistence, and viewport route pass: six of six
Chromium tests with no captured page or console errors.

## Stage disposition

| Stage | Review result                                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| M0    | Foundation, deterministic tests, production check, and browser routes pass.                                                   |
| M1    | Input buffering, refresh-rate scenario, hit feedback, content, and run summary present; prior playtest evidence exists.       |
| M2    | Enemy grammar, warning scenarios, lifecycle outcomes, damage attribution, and swept projectile paths pass.                    |
| M3    | Eight authored waves, scoring, power-up caps, anti-stall logic, and a non-invincible normal-input flow pass.                  |
| M4    | Boss phases, beams, transitions, scoring, audio cues, and deterministic tests pass; human acceptance remains.                 |
| M5    | Presentation, mixer/music, complete UX, persistence, focus/fullscreen handling, viewport checks, and defect regressions pass. |
