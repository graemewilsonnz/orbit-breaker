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
