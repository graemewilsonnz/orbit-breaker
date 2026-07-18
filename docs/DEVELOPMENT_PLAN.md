# Orbit Breaker Development Plan

Status: In execution — M1 implemented<br> Plan version: 0.2<br> Date: 2026-07-18

## 1. Outcome

Turn the existing Orbit Breaker proof of concept into a polished, original, desktop-first radial
arcade shooter without losing time to a game-engine rewrite, premature content, or infrastructure
that does not improve iteration speed.

The release target is a complete 3-7 minute run in which the player:

1. Understands orbit, firing, and danger within 10 seconds.
2. Learns six readable enemy behaviours across eight escalating waves.
3. Makes meaningful use of dash, weapon, shield, and bomb mechanics.
4. Defeats a multi-phase central mothership boss.
5. Immediately wants to improve score or complete a cleaner run.

The central design test is simple: controlling the circumference must remain the most interesting
decision in every wave and boss phase.

## 2. Product Contract

### Release scope

- Single-screen Canvas 2D arcade game.
- Keyboard-first desktop controls.
- Pure ring movement plus a short circumferential dash.
- Inward firing with clear projectile and hit feedback.
- Six enemies: Drifter, Spiral Diver, Shooter, Mine, Hunter, Shield Carrier.
- Eight authored waves and one three-phase boss.
- Twin Shot, Orbit Shield, and Panic Bomb power-ups.
- Score, multiplier, centre-kill bonus, perfect-wave bonus, and local high score.
- Title, pause, wave clear, game over, victory, settings, and instant restart.
- Procedural or locally bundled audio with separate music and effects controls.
- Responsive presentation at a fixed logical aspect ratio.
- Static production build with no backend dependency.

### Explicitly deferred

- Story, campaign map, shops, inventory, unlock trees, and multiple ships.
- Mobile or touch controls.
- Online accounts and leaderboards.
- Multiplayer.
- Detailed sprite production or a move to WebGL.
- Dynamic difficulty that changes invisibly during a run.
- Additional bosses until the first boss is genuinely good.

### Release success criteria

| Area          | Required result                                                                           |
| ------------- | ----------------------------------------------------------------------------------------- |
| Comprehension | A new player moves and fires correctly within 10 seconds without reading a manual.        |
| Feel          | Movement is immediate and smooth; firing never appears to drop an input.                  |
| Fairness      | Every damaging threat is visually attributable and avoidable when first telegraphed.      |
| Rhythm        | Waves have distinct pressure shapes, short recovery beats, and no accidental dead time.   |
| Power         | Every pickup changes a decision or survival option, not only the amount of visual noise.  |
| Performance   | Stable 60 fps at 960x720 logical resolution on current desktop Chrome, Edge, and Firefox. |
| Reliability   | No uncaught errors, stuck game states, impossible waves, or restart-only recovery paths.  |
| Replay        | Score, centre kills, perfect waves, and high score create a clear reason for another run. |
| Originality   | Theme, naming, silhouettes, patterns, audio, and presentation are original to this game.  |

## 3. Current Baseline

The existing prototype is useful and should be evolved, not discarded.

### What is already present

- Approximately 2,500 lines of working vanilla JavaScript.
- Responsive 960x720 Canvas shell.
- Player movement, inward fire, dash, shield, bombs, lives, and scoring.
- Six enemy types, eight data-authored waves, and a central mothership boss.
- Three power-ups, procedural Web Audio effects, HUD, overlays, and state flow.
- Central tuning values in `src/config.js`.

### What currently limits fast, safe iteration

| Current condition                                                    | Development consequence                                     |
| -------------------------------------------------------------------- | ----------------------------------------------------------- |
| Globals and ordered script tags                                      | Renames and dependency changes are fragile.                 |
| `game.js` owns most orchestration and collision logic                | New mechanics increase coupling and regression risk.        |
| Simulation, rendering, audio, and random generation are interleaved  | Behaviour cannot be tested or replayed deterministically.   |
| Variable-step simulation                                             | Behaviour can differ across refresh rates and frame stalls. |
| `Math.random()` throughout gameplay                                  | Bugs and balance cases cannot be reproduced from a seed.    |
| No package scripts, type checks, linting, tests, or production build | Every change depends on manual verification.                |
| No debug controls or run metrics                                     | Tuning is slower and relies on memory rather than evidence. |
| Fixed backing resolution without device-pixel-ratio handling         | The canvas can appear soft on high-density displays.        |
| Empty `.git` directory but no valid Git repository                   | There is no trustworthy baseline or rollback history yet.   |

The first implementation milestone must preserve current behaviour while creating a foundation for
fast experiments. It must not combine the tooling migration with major gameplay changes.

## 4. Technical Direction

### Stack

- Canvas 2D remains the renderer.
- TypeScript in strict mode for gameplay and tooling confidence.
- Vite for a fast development server and static production builds.
- Vitest for geometry, rules, content validation, and simulation scenarios.
- Playwright for browser smoke tests, input flows, and screenshot checks.
- ESLint and Prettier for consistent source and early error detection.
- GitHub Actions only after a remote repository exists; the same checks run locally first.
- No runtime framework and no third-party game engine.

Development will use `localhost`. Production will be a static `dist/` build. If double-clicking a
local `index.html` remains a hard requirement, add a standalone bundle target without weakening the
main module architecture.

### Architecture

Use a small state-and-systems design, not a general-purpose entity-component framework. Plain typed
objects hold state; systems update them in a documented order; rendering reads state but does not
change it.

```text
src/
  app/
    bootstrap.ts
  game/
    Game.ts
    state.ts
    config.ts
    core/
      clock.ts
      events.ts
      geometry.ts
      rng.ts
    systems/
      input.ts
      player.ts
      weapons.ts
      enemies.ts
      spawning.ts
      collision.ts
      scoring.ts
      lifecycle.ts
    content/
      enemies.ts
      waves.ts
      boss.ts
      powerups.ts
    render/
      CanvasRenderer.ts
      effects.ts
      hud.ts
    audio/
      AudioEngine.ts
  styles/
    main.css
tests/
  unit/
  scenarios/
  browser/
docs/
  DEVELOPMENT_PLAN.md
  PLAYTESTS.md
public/
  audio/
```

### Core engineering rules

1. Run gameplay at a fixed 60 Hz step; render with `requestAnimationFrame()`.
2. Inject a seeded random source into all gameplay systems.
3. Keep the renderer read-only with respect to simulation state.
4. Emit typed gameplay events for audio, particles, shake, UI notices, and metrics.
5. Store enemy, wave, boss, and pickup tuning as typed content data.
6. Validate content at startup and in tests so invalid waves fail visibly.
7. Use small forgiving hitboxes and swept checks where fast motion could skip a hit.
8. Add pooling only if profiling shows garbage collection is a real problem.
9. Keep a stable logical resolution and scale the backing canvas for device pixel ratio.
10. Every milestone ends with a playable build, passing checks, and a short playtest note.

### System update order

```text
Input snapshot
  -> player intent and cooldowns
  -> wave and boss spawning
  -> entity movement and attacks
  -> projectile movement
  -> shield relationships
  -> collisions and damage
  -> scoring, drops, and state transitions
  -> cleanup
  -> presentation events
  -> render
```

This order will be explicit and covered by scenario tests. That prevents subtle one-frame
differences from changing whether a player is hit, a wave clears, or a boss phase awards points.

## 5. Development Workflow

### Standard commands after foundation work

| Command              | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Start the local game and live reload changes.   |
| `npm run build`      | Produce the static release build.               |
| `npm run preview`    | Run the production build locally.               |
| `npm run test`       | Run unit and deterministic scenario tests.      |
| `npm run test:watch` | Run focused tests while tuning a system.        |
| `npm run test:e2e`   | Run browser input and state-flow checks.        |
| `npm run lint`       | Check source quality rules.                     |
| `npm run typecheck`  | Check strict TypeScript contracts.              |
| `npm run check`      | Run typecheck, lint, tests, and build together. |

### Git discipline

- Initialize a real repository before migration work.
- Preserve the current prototype as the baseline commit and tag.
- Keep one focused commit for each completed plan item.
- Do not mix mechanical TypeScript conversion with feel or balance changes.
- Record material tuning changes and their playtest result.

### Rapid iteration loop

1. Start from a named seed and target wave.
2. Change one primary variable or pattern at a time.
3. Run focused automated tests.
4. Play the affected 30-90 second slice at least three times.
5. Record outcome and keep, revise, or revert the change.
6. Run the whole game before closing a milestone.

A development-only panel should provide seed, wave select, invulnerability, time scale, enemy spawn,
hitbox display, event log, and performance counters. It must be excluded from the release UI.

## 6. Milestones

Each milestone is a review checkpoint, not a long hidden build phase. The game must remain
launchable at the end of every checkpoint.

### M0 - Foundation and behaviour parity

Goal: make the existing prototype safe to change without intentionally altering its gameplay.

Work:

- Initialize Git and capture the current prototype as a baseline.
- Add Node project metadata, Vite, strict TypeScript, formatting, linting, and tests.
- Port the current files to imports and typed modules in small, reviewable steps.
- Add a fixed-step clock, seeded RNG, typed game states, and typed gameplay events.
- Separate simulation from Canvas drawing and Web Audio side effects.
- Add content validation and a minimal debug panel.
- Add browser smoke tests for title, start, pause, restart, and victory/game-over routes.

Gate:

- `npm run check` passes from a clean checkout.
- Current controls and all current content remain playable.
- A supplied seed produces the same spawn order and outcomes on repeated runs.
- A production build starts with no console errors.

### M1 - Golden first minute

Goal: make the first minute represent the intended final quality before scaling polish across the
rest of the game.

Work:

- Tune turn speed, reversal response, fire cadence, dash distance, and cooldown.
- Add input buffering where it prevents missed dash or pause actions.
- Improve depth cues, player silhouette, projectile travel, recoil, hit flash, and kill feedback.
- Add clear centre-spawn telegraphs and fair player/enemy hitboxes.
- Rebuild Waves 1 and 2 as a teaching sequence with no explanatory overlay required.
- Add a compact post-run/debug summary for accuracy, damage source, and timings.

Gate:

- Five fresh starts in a row have no missed inputs or ambiguous first damage.
- The player can identify movement, fire, dash status, enemy shots, and pickups at a glance.
- Behaviour remains consistent at 30, 60, and 120 Hz display refresh rates.
- The first minute holds 60 fps with generous headroom.

### M2 - Threat readability and enemy grammar

Goal: make all six enemy types distinct, fair, and strategically meaningful.

Work:

- Give every enemy a unique silhouette, motion signature, sound cue, and attack question.
- Add pre-spawn, attack, and danger-radius telegraphs where needed.
- Tune Shield Carrier links and target priority so protection is obvious.
- Ensure Hunters pressure movement without creating unavoidable tracking.
- Ensure Mines claim arcs without becoming visual or collision clutter.
- Give Shooters readable aim, wind-up, projectile speed, and recovery timing.
- Add deterministic scenario tests for each enemy and collision edge cases.

Gate:

- A player can name the threat behaviour from silhouette and motion alone.
- No enemy can damage the player before its minimum warning window completes.
- Automated scenarios cover spawn, movement, attack, damage, death, and cleanup.
- A death summary can always identify the damaging source.

### M3 - Waves, scoring, and power curve

Goal: create an eight-wave run with deliberate rhythm and real score decisions.

Work:

- Replace ad hoc wave timings with typed patterns and explicit pressure budgets.
- Author and tune eight waves that introduce, test, combine, and master enemy grammar.
- Preserve centre-kill, chain, perfect-wave, and unused-resource bonuses.
- Make multiplier gain/loss and centre-kill value immediately legible.
- Tune Twin Shot, Orbit Shield, and Panic Bomb drop rules and power ceilings.
- Add anti-stall handling for escaped enemies, late pickups, and empty wave states.
- Add wave-select and seed-based regression scenarios.

Gate:

- Normal runs reach the boss in roughly 3-5 minutes.
- Each wave has a recognisable identity and at least one recovery beat.
- No wave depends on a lucky power-up to be survivable.
- Aggressive centre kills are observably more valuable than rim clean-up.
- All eight waves complete in automated idle, invincible, and normal-flow scenarios.

### M4 - Mothership boss

Goal: deliver a boss that tests circular positioning rather than acting as a large stationary health
bar.

Work:

- Formalize three phases with shield openings, radial beam warnings, and add pressure.
- Make safe arcs readable before damage becomes active.
- Add clean phase transitions, attack recovery, hit confirmation, and score awards.
- Ensure the boss is beatable without upgrades but rewards retained resources.
- Add boss-specific audio layers and restrained camera/effect emphasis.
- Add deterministic tests for blocked shots, weak windows, beams, phase changes, and defeat.

Gate:

- A first-time player understands why a shot was blocked and where to move next.
- All lethal attacks provide a fair, tested warning period.
- The encounter lasts approximately 60-90 seconds for a competent unpowered player.
- Boss defeat cannot double-award score or leave the game in a stuck state.

### M5 - Presentation, audio, and complete UX

Goal: make the game feel authored and complete without sacrificing clarity.

Work:

- Establish a coherent original visual identity, colour hierarchy, and effect budget.
- Add layered star/tunnel motion, trails, particles, subtle impact freeze, and restrained shake.
- Build an audio mixer with master, music, and effects controls.
- Add a simple adaptive electronic pulse that rises with wave and boss pressure.
- Polish title, HUD, pause, transitions, game over, victory, settings, and local high score.
- Add fullscreen handling, blur auto-pause, mute persistence, reduced shake, and high-DPI rendering.
- Check text fit and composition across common 16:9, 16:10, and 4:3 desktop windows.

Gate:

- Player, hostile bullets, pickups, and warnings remain distinct at peak intensity.
- Audio starts only after interaction, resumes correctly, and can be fully muted.
- No overlay hides active danger or leaves input in an unclear state.
- Screenshots at target viewports show no clipping, softness, or incoherent overlap.

### M6 - Balance, QA, and release candidate

Goal: produce a stable build suitable for repeated external playtesting and release.

Work:

- Run a seeded playtest matrix across every wave, boss phase, and power state.
- Tune with measured outcomes rather than increasing enemy speed by default.
- Profile update, render, allocation, and audio behaviour at peak object counts.
- Run Chromium and Firefox browser suites and manually check Edge.
- Test tab hiding, lost focus, resize, audio suspension, rapid restart, and long sessions.
- Add README instructions, control reference, attribution, licence, and deployment notes.
- Produce the static build and optional standalone package if approved.

Gate:

- `npm run check` and browser tests pass from a clean checkout.
- No known P0 or P1 defects remain.
- Ten complete seeded runs finish without a crash, stuck state, or invalid transition.
- Frame time remains within the 60 fps budget during the busiest authored encounter.
- A short external playtest confirms comprehension, fairness, and replay intent.

## 7. Testing Strategy

### Unit tests

- Angle normalization, shortest rotation, polar conversion, and collision boundaries.
- Fixed-step clock and frame-stall handling.
- Seeded RNG reproducibility.
- Cooldowns, invulnerability, dash, weapon levels, shields, and bombs.
- Score multipliers, centre bonuses, perfect waves, and boss phase awards.
- Wave schema validation and event ordering.

### Deterministic scenarios

- Every enemy from spawn through escape or destruction.
- Every power-up from drop through collection and expiry.
- Player damage from enemy, projectile, and boss beam.
- All wave starts, completion conditions, and transitions.
- Boss shield block, weak opening, every phase boundary, defeat, and victory.
- Rapid restart and pause/resume at sensitive state boundaries.

### Browser tests

- Load, start, movement, firing, dash, bomb, pause, resume, and restart.
- Canvas is non-blank and correctly fitted at target viewports.
- No console errors or unhandled promise rejections.
- Audio-unlock path does not block play when audio is unavailable.
- Screenshot checks for title, active wave, boss, pause, game over, and victory.

Automated tests protect rules and state flow. Human playtests remain the authority for feel,
readability, rhythm, and fun.

## 8. Playtest Scorecard

Record at least the following for meaningful iteration passes:

| Metric                                | Why it matters                                     |
| ------------------------------------- | -------------------------------------------------- |
| Time to first movement and first shot | Tests the 10-second comprehension goal.            |
| Wave clear time                       | Reveals stalls and pacing spikes.                  |
| Damage source and warning time        | Finds unfair or unclear threats.                   |
| Accuracy and centre-kill ratio        | Shows whether inward aiming and risk scoring work. |
| Dash uses and successful escapes      | Shows whether dash is understood and valuable.     |
| Pickup collected, missed, and wasted  | Shows whether rewards are readable and reachable.  |
| Multiplier peak and loss cause        | Shows whether score play is legible.               |
| Boss phase duration and damage source | Identifies phase imbalance.                        |
| Frame time and peak entity count      | Prevents polish from degrading responsiveness.     |
| Immediate replay choice               | Best lightweight signal for arcade replay value.   |

Do not add network telemetry for the MVP. Generate a local debug summary and use short written
playtest notes until there is a real distribution need.

## 9. Priority Backlog

### P0 - Required for the high-quality MVP

- Tooling, typed modules, fixed-step simulation, seeded runs, and debug controls.
- Movement, shooting, dash, collision fairness, and clear feedback.
- Six enemies, eight waves, three power-ups, score systems, and one boss.
- Audio controls, pause/restart, high score, responsive high-DPI rendering.
- Automated rule, scenario, build, and browser checks.

### P1 - Add only after the release gates pass

- Gamepad support.
- A dedicated bonus wave.
- Replay or ghost data using seeded input capture.
- Additional accessibility colour presets.
- Installable PWA packaging.

### P2 - Separate future product decisions

- Campaign progression and unlocks.
- Additional ships, weapons, bosses, and sectors.
- Online leaderboards or accounts.
- Mobile controls.

## 10. Main Risks and Controls

| Risk                                            | Control                                                    |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Tooling migration breaks the playable prototype | Make M0 parity-only and preserve a tagged baseline.        |
| More effects make threats unreadable            | Define presentation layers and a peak effect budget.       |
| Random runs hide regressions                    | Use seeded RNG and scenario entry points.                  |
| Difficulty becomes speed inflation              | Increase pattern interaction and pressure budgets first.   |
| Boss work expands indefinitely                  | Ship one boss with fixed phase and duration gates.         |
| Tuning becomes subjective churn                 | Change one variable, use named seeds, and record outcomes. |
| Scope expands before the core is fun            | Enforce the deferred list until M6 passes.                 |

## 11. Review Decisions

Approval of this plan also approves these defaults:

1. Keep Canvas 2D and avoid a game engine.
2. Adopt TypeScript, Vite, Vitest, Playwright, ESLint, and Prettier.
3. Develop through a local server and ship a static build.
4. Treat a double-click standalone build as optional unless explicitly required.
5. Preserve the current prototype through a parity-first migration.
6. Target keyboard desktop play and defer mobile, backend, and campaign work.
7. Use seven review checkpoints, including foundation, each ending in a playable and tested build.

M0 and M1 are now implemented. Further gameplay expansion begins with M2 after the M1 checkpoint is
reviewed and accepted.
