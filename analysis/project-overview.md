# Project Overview: Space Invaders

> Phase 1 deliverable — Discovery & Architecture. Date: 2026-07-31

## What This Is

A browser-based **Space Invaders clone** — single-page React 19 + TypeScript app where the entire game runs on the **HTML5 Canvas API**. React handles only the page shell and supporting status UI; all gameplay logic, rendering, and screen overlays (menu, game over, name entry) are canvas-drawn.

- **Purpose**: Classic arcade shooter gameplay
- **Deployment target**: Static single-file HTML (no backend, no API, no build-time assets)
- **Persistence**: `localStorage` only (high score + leaderboard)

## Tech Stack

| Layer        | Technology                 | Notes                                                                                                    |
| ------------ | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| UI framework | **React 19**               | Page shell, power-up banner, controls hint                                                               |
| Language     | **TypeScript 5.9**         | `strict`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax` (type-only imports must use `import type`) |
| Build tool   | **Vite 6**                 | `@vitejs/plugin-react`, `@tailwindcss/vite`                                                              |
| Bundle       | **vite-plugin-singlefile** | Inlines all JS/CSS into one `dist/index.html` (~241 KB, 75 KB gzip)                                      |
| Styling      | **Tailwind CSS v4**        | CSS-first config (`@import "tailwindcss"`), no `tailwind.config` file                                    |
| Rendering    | **HTML5 Canvas 2D**        | All game entities, sprites (pixel grids), particles, screen overlays                                     |
| Testing      | **Vitest 3**               | 244 tests across 13 test files — all passing                                                             |
| Lint/format  | **ESLint + Prettier**      | `eslint-config-prettier`, react-hooks, react-refresh plugins                                             |
| Git hooks    | **Husky + lint-staged**    | Pre-commit: prettier → tests                                                                             |

## Project Structure

```
space-invaders/
├── index.html                  # Vite entry
├── vite.config.ts              # react + tailwind + singlefile plugins
├── tsconfig.json               # strict, bundler resolution, noEmit
├── eslint.config.js            # flat config
├── .prettierrc / .lintstagedrc
├── AGENTS.md / EXAMPLES.md     # contributor behavioral guidelines
├── src/
│   ├── main.tsx                # Entry: React root + ErrorBoundary + global handlers
│   ├── App.tsx                 # Canvas mount, GameEngine lifecycle, UI state bridge
│   ├── index.css               # Tailwind import + minimal body styles
│   ├── components/             # DOM UI (not canvas)
│   │   ├── PowerUpBanner.tsx   # Rapid Fire / Shield countdowns
│   │   └── ControlsHint.tsx    # Key legend
│   └── game/                   # ALL gameplay logic (framework-free)
│       ├── engine.ts           # GameEngine: loop orchestration, system wiring
│       ├── config.ts           # Every tunable constant + sprite patterns + colors
│       ├── types.ts            # Shared types: GameState, entities, callbacks
│       ├── geometry.ts         # Pure: rectsOverlap, hexToRgb
│       ├── rendering-math.ts   # Pure: all animation math (canvas-free, tested)
│       ├── renderer-utils.ts   # drawSprite, drawShield canvas helpers
│       ├── leaderboard.ts      # localStorage-backed leaderboard (dedupe by name)
│       ├── utils.ts            # swapRemove (O(1) unordered removal)
│       ├── test-utils/factory.ts  # createMockState + entity builders
│       └── system/             # Systems & handlers (one concern per file)
│           ├── state-manager.ts        # createInitialState, reset, status setters
│           ├── input-handler.ts        # Keyboard → keys map, movement, name entry
│           ├── physics-system.ts       # Bullets, particles, UFO, power-ups, shake
│           ├── collision-system.ts     # Collision predicates + effects
│           ├── level-system.ts         # Level configs, alien movement, shooting
│           ├── entity-factory.ts       # Formation/entity/particle creation
│           ├── bullet-collision-handler.ts  # Per-frame collision orchestration
│           ├── death-animation-handler.ts   # Delayed death → score/explosion
│           ├── rendering-system.ts     # Entity drawing (sprites, trails, glow)
│           └── ui-rendering.ts         # HUD, menu, game-over, name-entry screens
└── dist/index.html             # Production single-file bundle
```

## Commands

| Action                          | Command                 |
| ------------------------------- | ----------------------- |
| Dev server                      | `npm run dev`           |
| Full build (typecheck → bundle) | `npm run build`         |
| Preview prod build              | `npm run preview`       |
| Run all tests                   | `npm test` (vitest run) |
| Tests in watch mode             | `npx vitest`            |

## Key Characteristics

- **~25 source files, ~2,900 lines of code** — small, readable, single-responsibility files
- **Zero runtime dependencies beyond React** — unused legacy runtime dependencies were removed from `package.json`
- **No backend**: everything is client-side; deploy `dist/index.html` anywhere
- **Framework-free game core**: `src/game/` has no React imports — the engine talks to React through callbacks
- **Full test coverage on pure logic**; canvas rendering and the game loop itself are exercised via mocked 2D context (see `engine.test.ts` pattern)
