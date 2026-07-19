# AGENTS.md

## Project Overview

Space Invaders game built with React 19, TypeScript, Vite, and Tailwind CSS v4. The game uses Canvas 2D rendering with procedural pixel art (no sprite sheets).

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # TypeScript check + Vite build (produces single HTML file)
npm run test       # Vitest run
npm run preview    # Preview production build
npx eslint .       # Lint code (no npm script, run directly)
```

## Architecture

**React + Canvas hybrid**: React handles the shell (UI overlay, state), but all game rendering is Canvas 2D via `src/game/engine.ts`.

**System-based game architecture** in `src/game/`:
- `engine.ts` — Main game loop, orchestrates systems
- `system/` — Individual systems (collision, physics, rendering, input, level, state)
- `config.ts` — All game constants (canvas size, speeds, colors, sprites)
- `types.ts` — Type definitions
- `renderer-utils.ts` — Drawing helpers (sprite rendering, pixel art)

**Entry points:**
- `src/main.tsx` → `src/App.tsx` → `src/game/engine.ts`
- Canvas is 800×640 fixed resolution, scaled responsively

## Key Conventions

- **Single-file build**: `vite-plugin-singlefile` bundles everything into one HTML file
- **Procedural graphics**: All sprites drawn via Canvas API (see `SPRITES`, `SPRITES_2` in `config.ts`)
- **Co-located tests**: `*.test.ts` files next to source (Vitest)
- **Tailwind v4**: Uses `@tailwindcss/vite` plugin, not PostCSS. Config is in CSS (`src/index.css`)
- **Strict TypeScript**: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` enabled

## Testing

Tests use Vitest with `describe`/`it`/`expect`. Mock `localStorage` for leaderboard tests. Game state mocks follow the pattern in `src/game/system/collision-system.test.ts`.

Run a single test: `npx vitest run src/game/engine.test.ts`

## Build Output

`npm run build` produces `dist/index.html` (single file with inlined JS/CSS). This is the deployable artifact.

## Graphics Improvements

See `GRAPHICS_IMPROVEMENT_PLAN.md` (gitignored) for phased visual polish roadmap. Current implementation uses pure Canvas 2D with ~12-color palette.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (uses `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (one `CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.
