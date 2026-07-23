# Orbit Breaker

Orbit Breaker is a desktop-first radial Canvas 2D arcade shooter. The player moves around a fixed
outer orbit, fires inward, survives eight waves, and defeats a three-phase mothership.

Current checkpoint: **M5 — Presentation, audio, and complete UX**. The complete eight-wave and
three-phase boss run now has a coherent radial-tunnel presentation, bounded effects and impact
freeze, a pressure-reactive electronic pulse, persistent mixer/accessibility settings, fullscreen,
focus auto-pause, and a local high score. Centre-crossing shots, projectile tunnelling, audio timer
drift, and the browser-test loading-shell failure are fixed and covered by regressions.

## Requirements

- Node.js 22 or newer
- A current desktop browser

## Development

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The game uses a deterministic run seed; pass `?seed=1234` to
reproduce a run. During development, `?debug=1` opens the debug panel.

The development panel includes wave select, seed control, first-action timing, enemy-specific damage
attribution, live wave outcomes, wave timing, boss health and phase state, encounter and phase
timers, transition timing, beam and safe-arc counts, and performance counters for repeatable
regression runs.

## Commands

- `npm run dev` starts the development server.
- `npm run build` creates the static production build in `dist/`.
- `npm run preview` serves that production build locally.
- `npm run test` runs unit and deterministic scenario tests.
- `npm run test:watch` runs Vitest in watch mode.
- `npm run test:e2e` runs browser smoke tests.
- `npm run lint` checks source quality.
- `npm run typecheck` checks strict TypeScript contracts.
- `npm run check` runs typecheck, lint, tests, and the production build.

## Controls

- Left/A and Right/D: rotate
- Space/Z: fire
- Shift/X: dash
- B/C: panic bomb
- P/Escape: pause or resume
- M: mute or restore audio
- F: enter or exit fullscreen
- S: open settings
- Enter: start or restart

The full implementation plan is in `docs/DEVELOPMENT_PLAN.md`; milestone verification notes are in
`docs/PLAYTESTS.md`.
