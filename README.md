# Orbit Breaker

Orbit Breaker is a desktop-first radial Canvas 2D arcade shooter. The player moves around a fixed
outer orbit, fires inward, survives eight waves, and defeats a three-phase mothership.

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
- Enter: start or restart

The full implementation plan is in `docs/DEVELOPMENT_PLAN.md`; milestone verification notes are in
`docs/PLAYTESTS.md`.
