# Orbit Breaker - Code Review against Development Plan

**Reviewer:** Gemini 3.6 Flash  
**Audit Date:** July 23, 2026  
**Repository:** Orbit Breaker (`g:\codex\orbit-breaker`)  
**Development Plan Version:** 0.5 (`docs/DEVELOPMENT_PLAN.md`)  
**Current Milestone Status:** M0–M5 Implemented; see the M5 remediation update in Section 7

---

## 1. Executive Summary

This code review evaluates the **Orbit Breaker** codebase against the architecture, quality
standards, feature contracts, and milestone deliverables set forth in `docs/DEVELOPMENT_PLAN.md`.

### Core Findings

1. **Architecture & Engineering Rigor:** Excellent adherence to the design specification. The
   simulation logic in `src/game/Game.ts` is strictly decoupled from DOM, Canvas rendering, and Web
   Audio. Simulation updates run at a fixed 60 Hz step using seeded PRNG (`SeededRng`), ensuring
   100% deterministic replays across display refresh rates (30, 60, 120 Hz).
2. **Automated Verification:** The automated test suite (`vitest run`) is 100% green with **157
   passing unit and scenario tests** across 18 test files. Typechecking (`tsc --noEmit`), linting
   (`eslint`), and production building (`vite build`) all execute cleanly.
3. **Milestone Progression:** Milestones M0 through M4 are fully implemented. Wave pacing, threat
   readability, enemy grammar, scoring bonuses, and the multi-phase Mothership Boss meet their
   defined functional contracts.
4. **Key Items Requiring Attention at Audit Time (resolved in Section 7):**
   - **Player Shot Centre-Crossing Defect (P1):** Shots crossing the centre ring wrap visually to
     the opposite side due to negative radial handling before deactivation.
   - **Disconnected Swept Collision Engine (P2):** `sweptCircleOverlap()` exists in `geometry.ts`
     but is not invoked in collision routines, leaving fast projectiles open to frame-tunneling.
   - **E2E Playwright Timeout (P2):** Browser smoke tests stall waiting for debug window hooks.
   - **Audio Timer Drift (P3):** Synthetic audio cues use `window.setTimeout()` instead of Web Audio
     API native timestamp scheduling.

---

## 2. Milestone Audit & Plan Compliance Matrix

| Milestone                           | Target Scope                                                                                                              | Implementation Status | Plan Compliance Notes                                                                                                                                                       |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :-------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0: Foundation & Parity**         | TS strict mode, Vite, Vitest, 60Hz fixed clock, seeded RNG, decoupled renderer/audio, debug panel.                        | **PASSED**            | Core state architecture matches specified `src/game` structure. Deterministic seed replay verified by tests.                                                                |
| **M1: Golden First Minute**         | Controls, input buffering, hit feedback, telegraphs, Waves 1-2 teaching curve, run metrics summary.                       | **PASSED**            | Tap/held fire, buffered dash, reversal response, and damage attribution operate smoothly. Refresh rate test passes.                                                         |
| **M2: Enemy Grammar**               | 6 enemies (Drifter, Spiral Diver, Shooter, Mine, Hunter, Shield Carrier), warning telegraphs, idempotent enemy lifecycle. | **PASSED**            | `resolveEnemy()` maps resolution types (`shot`, `bomb`, `contact`, `escaped`, `transition`). Full Clear / Flawless / Perfect rules enforced per `M2_WAVE_OUTCOME_NOTES.md`. |
| **M3: Waves & Scoring**             | 8 authored waves, pressure budgets, recovery beats, drop caps, pity drops, anti-stall, multiplier & centre-kill bonuses.  | **PASSED**            | Typed wave definitions in `waves.ts` validated at startup. Score multipliers and early centre-kill rewards verified.                                                        |
| **M4: Mothership Boss**             | 3 phases (Lattice Lock, Radial Crosscurrent, Orbit Collapse), weak gold aperture, cyan safe arcs, add caps.               | **PASSED**            | Boss shield cycle, radial beam warnings, safe arcs, add caps (0/2/4), and idempotent defeat scoring fully covered by deterministic scenarios.                               |
| **M5: Presentation & UX**           | Coherent visual identity, particle budget, audio engine/mixer, responsive presentation, complete state flows.             | **PASSED**            | Mixer and adaptive pulse, settings/persistence, responsive states, interruption handling, local high score, bounded effects, and defect regressions are complete.           |
| **M6: Balance & Release Candidate** | Matrix playtesting, peak profiling, cross-browser verification, final static build packaging.                             | **PLANNED**           | Human balance/comprehension, peak profiling, cross-browser verification, and release packaging remain.                                                                      |

---

## 3. Detailed Bug & Defect Analysis

### 🐛 Bug 1 (P1 - Gameplay & Visual): Player Shot Centre-Crossing (Negative Radial Coordinates)

- **Files Affected:** `src/game/systems/weapons.ts` (L57–59), `src/game/render/CanvasRenderer.ts`
  (L513–523), `src/game/systems/collision.ts`
- **Description:** `updateProjectile()` deactivates player shots only when
  `projectile.radius < -24`. `polarToCartesian(angle, radius)` maps negative radii by inverting the
  angle by 180°. As a result, a shot travelling inward towards centre (`radius = 0`) crosses zero
  and travels up to 24 logical units on the _opposite side_ of the ring before deactivating.
- **Consequences:**
  - **Visual:** Projectiles visibly "pop out" on the far side of the central aperture, violating the
    pseudo-3D tube aesthetic.
  - **Gameplay:** Phantom collisions can occur on enemies or the boss core positioned on the
    opposite side of the arena.
- **Recommended Remediation:** Set an explicit inner termination boundary in `updateProjectile()`:
  ```typescript
  if (projectile.owner === "player" && projectile.radius <= CONFIG.arena.innerKillRadius) {
    projectile.active = false;
  }
  ```

---

### 🐛 Bug 2 (P2 - Collision Physics): Swept Collision Engine Helper Unused

- **Files Affected:** `src/game/core/geometry.ts` (L58–83), `src/game/systems/collision.ts`
  (L39–160)
- **Description:** `geometry.ts` defines `sweptCircleOverlap()` to satisfy Engineering Rule #7 ("Use
  small forgiving hitboxes and swept checks where fast motion could skip a hit"). However,
  `collision.ts` only performs static point-distance checks (`distance()`, `circlesOverlap()`) based
  on the current frame position.
- **Consequences:** High-speed projectiles (`playerSpeed = 520`) or fast enemy dashes moving between
  60 Hz frames can pass completely through an enemy or player hitbox without triggering a collision
  ("bullet tunneling").
- **Recommended Remediation:** Integrate `sweptCircleOverlap(startPos, endPos, targetCircle)` into
  `handleShotEnemyCollisions` and `handlePlayerDangerCollisions` for fast-moving projectiles.

---

### 🐛 Bug 3 (P2 - Tooling & E2E): Playwright E2E Smoke Test Timeout

- **Files Affected:** `tests/browser/smoke.spec.ts` (L352–354)
- **Description:** Executing `npm run test:e2e` results in test timeouts waiting for
  `window.__ORBIT_DEBUG__` on the loading shell.
- **Consequences:** Automated browser smoke test gates cannot verify state-route transitions or
  console error freedom in headless test runs.
- **Recommended Remediation:** Ensure the development/preview bootstrap exposes the window debug
  reference unconditionally when running under Playwright e2e test environments.

---

## 4. Code Quality, Architecture & Performance Review

### 💡 Suggestion 1: Web Audio Native Scheduling vs. `window.setTimeout`

- **File:** `src/game/audio/AudioEngine.ts` (L113, L117, L148)
- **Issue:** Multi-tone sound effects (e.g. `powerup`, `waveClear`, `gameOver`) use
  `window.setTimeout()` to schedule delayed audio frequencies.
- **Impact:** Main-thread timers in JavaScript can stutter or drift when the CPU is under load or
  when the browser tab is backgrounded.
- **Recommendation:** Replace `window.setTimeout` calls with native Web Audio scheduling using the
  existing `delaySeconds` parameter in `this.tone(..., delaySeconds)`.

---

### 💡 Suggestion 2: Automated Unpowered / Non-Invincible Full-Run Scenario

- **File:** `tests/scenarios/m3-wave-progression.test.ts`
- **Issue:** M3 scenario tests evaluate wave progression by setting `debugInvulnerable = true`.
- **Impact:** While this tests spawn queue consumption, it does not test normal player survival,
  live pickups, damage resets, and uncheated wave transitions.
- **Recommendation:** Add a deterministic scenario test where a bot controller executes standard
  inputs to complete waves 1–8 in normal survival mode.

---

### 💡 Suggestion 3: Memory Allocation & Garbage Collection Optimization

- **File:** `src/game/Game.ts` (L680, L701–708)
- **Observation:** Arrays like `this.state.enemies`, `this.state.playerShots`, and
  `this.state.effects` are filtered in-place every frame
  (`this.state.enemies = this.state.enemies.filter(...)`).
- **Impact:** Allocating array instances 60 times per second triggers periodic garbage collection
  (GC) sweeps. While current desktop frame times are ~0.7ms (well below 16.67ms), mobile or
  constrained embedded browsers could experience occasional micro-stutter.
- **Recommendation:** Consider in-place array compaction (`swap and pop` or index pointers) if
  profiling during M6 reveals GC frame spikes.

---

## 5. Verification & Test Suite Execution Summary

The project was validated using the standard tooling suite. All automated commands returned clean
success:

```bash
> npm run check

> orbit-breaker@0.1.0 typecheck
> tsc --noEmit (PASSED - 0 errors)

> orbit-breaker@0.1.0 lint
> eslint . (PASSED - 0 warnings)

> orbit-breaker@0.1.0 test
> vitest run (PASSED - 157/157 tests passed across 18 files)

> orbit-breaker@0.1.0 build
> vite build (PASSED - Static bundle built in 718ms: dist/assets/index-CSKa1ELe.js ~99.8kB)
```

---

## 6. Conclusion & Action Items

The codebase for **Orbit Breaker** is exceptionally well-structured, maintainable, and aligned with
`docs/DEVELOPMENT_PLAN.md`. The implementation of M0–M4 provides a solid foundation for final
release.

### Priority Action Items for M5 Completion:

1. **Fix Player Shot Centre Cutoff:** Cap `projectile.radius` at `>= 0` in
   `src/game/systems/weapons.ts`.
2. **Connect Swept Collisions:** Hook `sweptCircleOverlap()` into projectile collision checks in
   `src/game/systems/collision.ts`.
3. **Refactor Audio Scheduling:** Replace `setTimeout` in `AudioEngine.ts` with native Web Audio
   timestamps.
4. **Fix Playwright Debug Hook:** Resolve `window.__ORBIT_DEBUG__` availability in
   `tests/browser/smoke.spec.ts`.
5. **Conduct Human Balance Passes:** Record 3 unpowered boss playtests to confirm the 60–90 second
   encounter target.

---

## 7. M5 Remediation Update

Implementation date: July 23, 2026

| Review item                     | Disposition                                                                                                       |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------- |
| Player shot centre cutoff       | Fixed with an explicit clamped centre boundary and boss-path regression coverage.                                 |
| Swept projectile collision      | Connected for player and hostile projectile paths, with between-step hit and near-miss scenarios.                 |
| Audio timer drift               | Fixed; layered cues and adaptive music use native Web Audio scheduling through separate mixer buses.              |
| Playwright debug timeout        | Fixed through an isolated strict-port server and early development-hook installation; all six routes pass.        |
| Normal non-invincible wave flow | Added; an ordinary-input deterministic controller reaches the boss through all eight waves with lives remaining.  |
| Memory compaction suggestion    | Intentionally deferred to M6 profiling, as recommended; current measured frame cost remains well within budget.   |
| Three human boss attempts       | Still open as a human balance/comprehension check; the deterministic unpowered 81.02-second result remains green. |
