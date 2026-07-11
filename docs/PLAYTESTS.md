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
