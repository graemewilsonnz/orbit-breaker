# Orbit Breaker Playtests

## M0 foundation parity pass

Date: 2026-07-11<br> Build: M0 foundation

### Scope

- Confirm the title, start, pause/resume, game-over, victory, and instant-restart routes.
- Confirm Left/A and Right/D movement, Space/Z fire, Shift/X dash, and B/C bomb controls.
- Confirm all eight authored waves, six enemy types, three pickups, and the mothership remain
  available.
- Compare two runs with the same seed and input sequence for identical gameplay outcomes.

### Automated evidence

- Unit coverage protects geometry, fixed-step timing, seeded random generation, input edges, and
  content validation.
- Deterministic scenarios protect spawn ordering, lifecycle routes, and seeded replay parity.
- Browser smoke coverage exercises the required state routes and reports page or console errors.

### Manual result

Passed in the in-app Chromium browser against both the Vite development server and the production
preview:

- Title and active-wave presentation rendered correctly at the logical 960x720 canvas size.
- The development panel exposed the seed, wave/boss scenarios, invulnerability, time scale,
  spawning, hitboxes, event log, and performance counters.
- The production build exposed no debug panel or debug hook.
- No browser console errors or warnings were reported.

No deliberate gameplay or balance changes are included in M0.

### Follow-up boundary

Movement feel, hit feedback, threat readability, and first-minute tuning belong to M1 and are
intentionally not changed here.

## M1 golden first minute pass

Date: 2026-07-18<br> Build: M1 golden first minute

### Scope

- Exercise movement, reversal, tap/held fire, buffered dash, and pause/resume from five fresh
  starts.
- Review the player, projectiles, Drifters, centre-spawn warnings, dash readiness, hit feedback, and
  pickups for immediate visual separation.
- Play Waves 1 and 2 as a sweep-to-crossing-lines teaching sequence without an in-wave tutorial.
- Verify accuracy, damage attribution, first-action timing, wave timing, and terminal summaries.
- Compare deterministic control and spawn outcomes at simulated 30, 60, and 120 Hz displays.
- Sample update and render cost throughout the opening and an accelerated later-run stress pass.

### Automated evidence

- Vitest covers the M1 control constants, immediate reversal, tap fire, exact fire cadence, dash
  buffering/expiry, run metrics, damage attribution, wave timing, the rebuilt opening waves, and
  pause input during transition states.
- A fixed-clock scenario produces the same deterministic state at 30, 60, and 120 Hz while moving,
  reversing, firing, dashing, pausing, resuming, and spawning the opening wave.
- The Chromium flow performs movement, immediate reversal, tap and held fire, immediate and buffered
  dash, pause/resume, and an attributable contact hit on each of five fresh starts, then verifies
  the run-summary values and terminal route.
- The full local gate passes: typecheck, lint, 85 unit/scenario tests, production build, formatting,
  and four Chromium browser tests.

### Manual result

Passed in the in-app Chromium browser at the 960x720 logical presentation size:

- The cyan player silhouette, yellow inward shot, orange Drifter, hostile-shot treatment, dash arc,
  and pickup shapes remain visually distinct against the layered arena.
- The centre telegraph shows an enemy-coloured lane, contracting marker, centre pulse, and outward
  direction before each spawn becomes active.
- A complete fire tap and dash registered on the same control pass; the debug summary recorded first
  move, shot, and dash at the same simulation time.
- The first observed damage was attributable to Drifter contact and remained identified as
  `enemy-contact` / `COLLISION` in the debug and game-over summaries.
- The game-over summary fit cleanly and showed accuracy, hits/shots, damage source, total time,
  Waves 1-2 timings, and first-action timings without clipping.
- The browser reported no console warnings or errors.

Performance samples held at 60.0-60.1 fps. Smoothed update cost was 0.04-0.09 ms and render cost was
0.49-0.73 ms, including an accelerated later-run sample. This leaves substantial headroom inside the
16.67 ms frame budget on the current development machine.

### M1 result

The Golden first minute checkpoint is playable and passes its local engineering, input, readability,
refresh-rate, summary, and performance gates. Broader enemy grammar, all-wave pacing, and full-run
presentation remain intentionally assigned to M2-M5.

## M2 threat readability and enemy grammar pass

Date: 2026-07-19<br> Build: M2 threat readability and enemy grammar

### Scope

- Inspect all six enemies without relying on colour: silhouette, movement, spawn identity, warning,
  and tactical role.
- Exercise Mine arming and danger radius, Shooter aim/wind-up/recovery, Hunter tracking and
  committed lunge, and Shield Carrier range/link behavior.
- Verify shot, bomb, contact, escape, and transition resolutions remain separate and idempotent.
- Verify required wave enemies are accounted for while debug spawns and boss adds remain excluded.
- Exercise Flawless, Full Clear, and Perfect derivation, scoring, overlay, and debug summaries.
- Re-run repository and runtime checks after an unexpected forced PC reboot.

### Automated evidence

- Vitest covers all eight required wave-outcome regressions, including absorbed contacts, bomb-only
  clears, transition cleanup, duplicate resolution, next-wave reset, exact bonus award/withholding,
  a dash-compatible Perfect, and real shot-collision and outer-escape paths.
- Deterministic enemy scenarios cover all six spawn identities and motion signatures, Mine, Shooter,
  and Hunter warning windows, Shield Carrier protection/removal, and the bombed-Shooter same-step
  regression.
- The full engineering gate passes: strict typecheck, lint, 124 unit/scenario tests across 16 files,
  and the production build.
- Four Chromium browser flows pass, including five fresh-start input/damage passes. The buffered
  dash setup freezes simulation and sets an exact debug cooldown, eliminating wall-clock sampling
  races.
- Formatting passes across the repository.
- Git integrity, the dependency tree, lockfile, source tree, and development/preview logs showed no
  corruption or partial writes after the reboot.

### Manual result

Passed in the in-app Chromium browser at the 960x720 logical presentation size:

- Drifter diamonds, Spiral Diver pinwheels, Mine stars, Shooter turrets, Hunter arrows, and Shield
  Carrier hexagons remained identifiable by shape and motion.
- Mine arming exposed a restrained pink danger circle before activation; multiple Mines stayed
  readable without filling the arena with overlapping collision decoration.
- Shooter wind-up showed its committed radial lane and recovery state before another shot could
  fire.
- Hunters tracked only to their lock radius, then showed a committed lane that could be sidestepped.
- Shield Carrier ranges used dashed circles; protected targets had a direct transfer line and aura,
  making the carrier-target relationship and priority clear.
- A no-damage wave with nine escapes displayed Flawless as achieved and Full Clear and Perfect as
  missed. The wave-clear summary and debug panel report required, destroyed, bomb-kill, breach, and
  escape counts alongside the same outcome flags.
- The title, active-wave HUD, threat warnings, and outcome overlay fit without clipping.
- The browser reported no console warnings or errors.

Observed performance held at approximately 60 fps. Smoothed update cost was 0.02-0.09 ms and render
cost was 0.47-0.58 ms in the inspected M2 scenarios, leaving substantial 60 fps headroom.

### M2 result

The Threat readability and enemy grammar checkpoint is playable and passes its lifecycle,
fair-warning, enemy-identity, outcome, summary, reliability, and presentation gates. Eight-wave
rhythm, score-value tuning, and power-curve decisions remain intentionally assigned to M3.
