# Space Invaders

A browser-based Space Invaders clone built with **React**, **TypeScript**, and the **HTML5 Canvas API**.

![Space Invaders](https://img.shields.io/badge/space-invaders-green)

## Features

- Classic arcade shooter gameplay
- Multiple alien formations and increasing difficulty
- Power-ups: rapid fire, shield, and bomb
- UFO bonus encounters
- Persistent high score and leaderboard using `localStorage`
- Particle effects, screen shake, and retro sprite rendering

## Controls

| Action     | Keys           |
| ---------- | -------------- |
| Move left  | `←` or `A`     |
| Move right | `→` or `D`     |
| Shoot      | `SPACE`        |
| Enter name | Type + `Enter` |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or later recommended)
- npm (comes with Node.js)

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Open the URL shown in your terminal (usually `http://localhost:5173/`).

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## Testing

This project uses [Vitest](https://vitest.dev/) for unit tests.

```bash
# Run all tests once
npm test

# Run tests in watch mode during development
npx vitest
```

## Project Structure

Single-page **React 19 + TypeScript** app. Game engine runs on **HTML5 Canvas** (no DOM rendering for gameplay). All logic lives in `src/game/`.

```
src/
├── App.tsx              # React shell, creates canvas + GameEngine
├── game/
│   ├── engine.ts        # Game loop, update/draw orchestration
│   ├── config.ts        # All tunable constants + sprite patterns
│   ├── types.ts         # Shared type definitions
│   ├── geometry.ts      # rectsOverlap, hexToRgb (pure)
│   ├── rendering-math.ts  # Canvas-independent animation math (pure)
│   ├── renderer-utils.ts  # drawSprite, drawShield helpers
│   ├── leaderboard.ts    # localStorage-backed leaderboard
│   ├── test-utils/factory.ts  # createMockState, makeBullet, etc.
│   └── system/          # Game systems (one class each)
│       ├── bullet-collision-handler.ts
│       ├── collision-system.ts
│       ├── death-animation-handler.ts
│       ├── entity-factory.ts
│       ├── input-handler.ts
│       ├── level-system.ts
│       ├── physics-system.ts
│       ├── rendering-system.ts
│       ├── state-manager.ts
│       └── ui-rendering.ts
```

## Architecture

- **GameState is a single mutable object** mutated in-place by all systems. No immutability pattern — `engine._update()` calls systems in order.
- **Pure math functions** (`rendering-math.ts`, `geometry.ts`) have no side effects and no Canvas dependency — easy to unit test.
- **Canvas rendering** (`rendering-system.ts`, `ui-rendering.ts`) is pure display; all logic decisions happen in `_update()` before `_draw()`.
- **Tests mock browser APIs**: localStorage, requestAnimationFrame, and a minimal Canvas 2D context. See `engine.test.ts` for the pattern.
- **Leaderboard** uses `localStorage` with a single `JSON` blob per key. `addToLeaderboard` updates existing names rather than creating duplicate entries.
- **Sprite patterns** are 2D character arrays in `config.ts`. Each row must be the same width — uneven rows silently misrender.

## Build Quirks

- **`vite-plugin-singlefile`**: production build inlines everything (CSS, JS) into a single HTML file. `cssCodeSplit: false`.
- **Tailwind v4** via `@tailwindcss/vite` plugin — no `tailwind.config`. Import `@import "tailwindcss"` in CSS.
- **TypeScript**: `verbatimModuleSyntax` is on — use `import type` for type-only imports.
- **No API endpoints** — purely client-side.
- **Vitest configuration** lives in `vite.config.ts` and explicitly includes `src/**/*.test.ts`.

## License

MIT
