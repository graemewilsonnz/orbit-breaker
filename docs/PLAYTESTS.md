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

## M3 waves, scoring, and power curve pass

Date: 2026-07-22<br> Build: M3 waves, scoring, and power curve

### Scope

- Replace implicit wave pacing with typed identity, pressure-budget, target-duration, and recovery
  contracts for all eight waves.
- Re-author each spawn timeline into distinct movements with a real no-spawn recovery beat.
- Surface centre-kill value, multiplier growth, and multiplier loss at the moment of the decision.
- Replace flat drops with per-wave chances, a ten-kill pity rule, helpful weighted selection, and
  per-wave/active-drop ceilings.
- Expire missed inter-wave pickups and resolve overdue enemies as escapes so neither can stall the
  route to the boss.
- Exercise every wave in seeded invincible-idle and deterministic full-clear flows.

### Automated evidence

- Content validation ties every declared pressure budget to the authored enemy cost and validates
  target-duration and non-overlapping recovery contracts.
- Spawn-queue fixtures pin 138 events across the eight re-authored timelines and preserve seeded
  angle generation.
- Nineteen M3 scenarios cover the three-to-five-minute pacing envelope, all eight idle routes, all
  eight full-clear routes, centre-kill value, multiplier feedback, pity drops, and pickup caps.
- The full Vitest suite passes with 144 tests across 17 files.

### Manual verification boundary

Engineering and browser gates are recorded by the commands run for this checkpoint. A human balance
pass should still record three complete normal runs from Wave 1 before M3 review acceptance; the
automated flows prove completion and rules, not final subjective difficulty.

### M3 result

The Waves, scoring, and power curve checkpoint is implemented and deterministic. The run now has
eight recognisable pressure shapes, explicit recovery, visible score risk/reward, bounded power
growth, and anti-stall routes. Boss encounter design remains assigned to M4.

## M4 mothership boss verification

Date: 2026-07-23<br> Build: M4 mothership boss

### Scope

- Exercise the three authored phases: Lattice Lock, Radial Crosscurrent, and Orbit Collapse.
- Verify the guarded, warned-opening, vulnerable-aperture, and shield-recovery cycle, including
  distinct blocked-shot and core-hit feedback.
- Verify radial beam warnings expose cyan safe arcs before activation, damage only within the
  forgiving lethal lanes, and preserve an explicit recovery interval between volleys.
- Verify Phase 1 remains add-free, Phase 2 caps Drifters at two, and Phase 3 caps combined Drifter
  and Spiral Diver pressure at four without spawning adds during beams or weak windows.
- Verify phase transitions suspend attacks, clear boss-origin hazards, record phase durations, and
  award each phase bonus once.
- Verify bombs cancel active beam pressure, apply bounded boss damage, and cannot skip a phase
  boundary or duplicate final defeat scoring.
- Inspect the boss-specific warning, block, hit, weak-open, beam-fire, phase, and defeat audio cues;
  restrained pulse/shake feedback; HUD notices; debug state; and victory timing summary.

### Automated evidence

- Boss content validation requires exactly three descending health phases, minimum aperture and beam
  warning windows, non-overlapping beams with a minimum safe-arc width, and internally consistent
  add caps and timing.
- Deterministic boss scenarios cover shield blocks, weak-aperture hits, beam warning and damage
  timing, safe arcs, capped adds, clean phase changes, phase timing, score awards, bombs, defeat,
  and the victory route. Seeded replay remains stable across independent presentation randomness,
  and pause freezes boss, beam, and run timers.
- The pinned fixed-step level-one controller reached victory in 81.02 seconds, with phase times of
  18.82, 26.87, and 35.33 seconds, one life remaining, no pickups, and no bombs. Boss-add drops are
  suppressed in this fixture so the unpowered 60-90 second result is isolated from loadout luck;
  subjective player competence and encounter feel still require playtesting.
- Existing state-route and damage-attribution scenarios continue to exercise boss-beam damage and
  terminal victory integration with the expanded boss state.
- The full Vitest suite passes with 157 tests across 18 files.

### Manual visual inspection

Passed in the in-app Chromium browser:

- The opening and vulnerable gold aperture states were visually distinct, and the HUD phase and
  shield-state text remained readable.
- The Phase 1 two-beam warning exposed broad cyan safe arcs before activation. The Phase 3 active
  pattern rendered four distinct beam wedges alongside capped Drifter and Spiral Diver pressure.
- Browser logs reported no warnings or errors during the inspected boss states.

### Manual verification boundary

A complete human balance and first-time comprehension pass has not yet been recorded. Before M4
review acceptance:

- Complete at least three unpowered boss attempts and record total and per-phase durations against
  the 60-90 second target.
- Confirm a first-time player understands the gold weak aperture, blocked-shot feedback, cyan beam
  safe arcs, and phase-transition downtime without debug guidance.
- Complete full-encounter checks for effect restraint, audio separation, frame pacing, overlay fit,
  and production-build console output.

### M4 result

The Mothership boss checkpoint is implemented with three deterministic phases, warned weak and safe
arcs, bounded add pressure, clean transitions, idempotent scoring, dedicated audio feedback, and
observable encounter timing. The key aperture, beam, add-pressure, HUD, and browser-log states pass
targeted visual inspection. Manual unpowered balance and duration runs, first-time comprehension,
and final audio acceptance remain pending.

## M5 presentation, audio, and complete UX verification

Date: 2026-07-23<br> Build: M5 presentation, audio, and complete UX

### Scope

- Unify the radial tunnel, colour hierarchy, trails, effects, impact freeze, and shake budget.
- Add persisted master, adaptive-pulse, and effects levels; full mute; native audio scheduling; and
  pressure-reactive music.
- Polish title, HUD, pause reasons, wave/boss transitions, terminal summaries, settings, and local
  high score.
- Add fullscreen, focus/visibility auto-pause, reduced shake, and target-viewport composition.
- Close the player-shot centre cutoff, swept projectile collision, audio timer, and browser-harness
  defects raised by the M5 preparation notes and Gemini review.
- Add a non-invincible normal-input flow through all eight waves.

### Automated evidence

- Centre-boundary tests prove inward shots clamp and deactivate at radius zero without rendering or
  colliding on the opposite side, while boss-core shots still resolve at the authored hit radius.
- Swept-collision scenarios prove between-endpoint hits for player and hostile shots and retain a
  focused near miss.
- Audio adapter tests prove delayed cue notes use Web Audio timestamps, full mute sets an exact zero
  master gain, and adaptive pulses schedule only during active gameplay.
- Preference tests cover invalid/blocked storage, normalized mixer/accessibility values, and
  high-score persistence.
- A non-invincible controller reaches the boss handoff through all eight waves in 166.65 seconds
  using ordinary movement, fire, dash, bomb, and pickup inputs with lives remaining.
- The full engineering gate passes: strict typecheck, lint, 170 tests across 21 files, and the
  production build.
- Six Chromium routes pass against an isolated strict-port server: title, state routes, M4 visual
  states, five-cycle M1 controls/damage, M5 persistence/focus/viewports, and no-Web-Audio fallback.

### Production visual inspection

Passed in the in-app Chromium browser against the production build:

- The title remained centred and legible at 1366x768 (16:9), with the high score and keyboard
  shortcuts inside the composition.
- Active Wave 1/Wave 2 HUD and threat presentation remained clear at 1440x900 (16:10); player,
  Drifters, telegraphs, star streaks, orbit guides, and quick controls did not overlap incoherently.
- The settings card fit at 1024x768 (4:3) without internal scrolling or clipping. Labels, values,
  toggles, fullscreen action, focus treatment, and the paused-game explanation remained readable.
- The pause overlay left live danger visible beneath a restrained wash and explicitly stated that
  simulation and danger were frozen.
- No production console warnings or errors were reported in the inspected title, active, pause, or
  settings states.

### Manual verification boundary

Three unpowered human boss attempts and first-time-player comprehension remain open from M4. The
automated 81.02-second unpowered controller is still green, but it cannot validate whether a new
person intuitively understands the gold aperture, cyan safe arcs, audio separation, or encounter
feel.

### M5 result

The Presentation, audio, and complete UX checkpoint is implemented. The game now has an authored
visual/audio identity, persistent and accessible runtime settings, safe interruption handling, local
score continuity, responsive high-DPI composition, bounded presentation effects, fixed projectile
lifecycle/collision behavior, and a reliable browser gate.
