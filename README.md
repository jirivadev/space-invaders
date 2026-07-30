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

| Action | Keys |
|--------|------|
| Move left | `←` or `A` |
| Move right | `→` or `D` |
| Shoot | `SPACE` |
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

```
src/
├── App.tsx                 # React entry component
├── game/
│   ├── engine.ts           # Main game loop and state orchestration
│   ├── config.ts           # Game constants and sprite patterns
│   ├── types.ts            # TypeScript type definitions
│   ├── leaderboard.ts      # localStorage leaderboard helpers
│   ├── rendering-math.ts   # Animation and rendering math utilities
│   ├── renderer-utils.ts   # Sprite drawing helpers
│   └── system/             # Game systems (physics, collisions, input, etc.)
│       ├── collision-system.ts
│       ├── entity-factory.ts
│       ├── input-handler.ts
│       ├── level-system.ts
│       ├── physics-system.ts
│       ├── rendering-system.ts
│       └── state-manager.ts
```

## License

MIT
