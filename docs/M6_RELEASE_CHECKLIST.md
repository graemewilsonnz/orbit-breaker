# M6 Release Candidate Checklist

Date: 2026-07-23<br> Candidate: M6 balance, QA, and release candidate

## Reproducible gate

Run from a clean checkout with a supported Node.js version:

```sh
npm ci
npx playwright install chromium firefox
npm run check:release
```

`npm run check` covers strict TypeScript, ESLint, deterministic/unit tests, and the production Vite
build. `npm run test:e2e` covers the same browser routes in Chromium and Firefox. The optional
standalone package was not approved and is not part of this candidate.

Recorded engineering result:

- strict typecheck, lint, 185 Vitest tests across 23 files, and production build passed;
- 7 Chromium routes passed, including the enforced 16.67 ms peak-pressure CPU frame-work gate;
- 7 Firefox routes passed as functional coverage;
- production title, Wave 1, and settings states rendered without browser warnings or errors.

## Seeded run matrix

The automated M6 matrix uses the fixed 60 Hz simulation and ten named seeds:

| Seed             | Scheduled loadout coverage                     |
| ---------------- | ---------------------------------------------- |
| m6-outer-017     | Baseline, Twin Shot, shield, bombs, full power |
| m6-crossfire-113 | Baseline, Twin Shot, shield, bombs, full power |
| m6-lattice-229   | Baseline, Twin Shot, shield, bombs, full power |
| m6-pulse-347     | Baseline, Twin Shot, shield, bombs, full power |
| m6-aperture-461  | Baseline, Twin Shot, shield, bombs, full power |
| m6-drift-587     | Baseline, Twin Shot, shield, bombs, full power |
| m6-collapse-613  | Baseline, Twin Shot, shield, bombs, full power |
| m6-vector-739    | Baseline, Twin Shot, shield, bombs, full power |
| m6-shield-857    | Baseline, Twin Shot, shield, bombs, full power |
| m6-orbit-983     | Baseline, Twin Shot, shield, bombs, full power |

Every run must visit Waves 1–8, exercise boss phases 1–3, record eight wave timings, retain a live
player, and finish in Victory without an invalid state, stuck transition, unbounded presentation
effect count, or exception. A duplicate run of `m6-aperture-461` must produce the same authoritative
state exactly.

The matrix is a reliability and determinism gate, not a substitute for a person judging difficulty
or feel. Existing normal-input and unpowered-boss controllers continue to cover ordinary survival
and the 60–90 second boss-duration target.

## Runtime stress profile

Development builds retain a rolling 600-frame profile containing:

- update, render, and total main-thread frame-work p95;
- count of sampled frames above the 16.67 ms CPU budget;
- peak authored entity count;
- peak JavaScript heap when the browser exposes it;
- live and peak Web Audio voice pressure plus audio-context state.

The browser M6 route starts the authored Phase 3 encounter, allows maximum add and beam pressure,
fires continuously, and records a fresh four-second profile window. It also checks focus loss, pause
freezing, three viewport resizes, audio suspension diagnostics, and ten rapid terminal restarts.

The frame-budget assertion is enforced in Chromium. Playwright's bundled headless Firefox build
software-renders Canvas on Windows, so its raw headless render timings are not representative; the
same route still validates Firefox state, interruption, resize, and recovery behaviour. A headed,
hardware-accelerated Firefox frame check remains in the manual gate.

## Manual release checks

These items require a person and cannot be accepted by automation:

- Complete ten normal seeded runs rather than controller-assisted reliability runs.
- Complete at least three unpowered boss attempts and record per-phase time and damage cause.
- Confirm first-time comprehension of the gold weak aperture and cyan safe arcs.
- Check current Microsoft Edge manually; its Chromium engine is covered automatically, but the named
  browser check remains a plan requirement.
- Confirm the authored peak encounter stays within budget in headed, hardware-accelerated Firefox.
- Test an actual hidden tab and OS focus switch with audible output on the target machine.
- Run one uninterrupted long wall-clock session and watch for audio drift or heap growth.
- Obtain a short external playtest covering comprehension, fairness, and immediate replay intent.
- Record any P0 or P1 defect found; M6 cannot be accepted while one remains open.

Do not tag the M6 baseline or begin M7 implementation until these human checks are recorded as
passing.
