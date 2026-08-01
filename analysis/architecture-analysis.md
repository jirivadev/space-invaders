# Architecture Analysis: Space Invaders

> Phase 1 deliverable — Discovery & Architecture. Date: 2026-07-31

## 1. System Architecture Overview

The app is a **two-layer architecture** split cleanly between React (shell) and an ECS-inspired game core (canvas):

```
┌─────────────────────────────── REACT LAYER ───────────────────────────────┐
│ main.tsx → ErrorBoundary → App.tsx                                        │
│   │                                                                        │
│   │  <canvas ref>                    onUIChange(ui) → setUi (diffed)      │
│   ▼                                                                        │
│   GameEngine (src/game/engine.ts)  ────── callback bridge ──► HUD / PowerUpBanner
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴────────────────┐
                    │      GAME CORE (framework-free)│
                    │  Single mutable `GameState` g   │
                    ▼                               ▼
        ┌────────────────────────┐    ┌────────────────────────┐
        │   _update() — logic    │    │   _draw() — rendering   │
        │  Systems mutate `g`    │    │  RenderingSystem +      │
        │  in a fixed order      │    │  UIRenderingSystem      │
        └────────────────────────┘    └────────────────────────┘
```

**Pattern classification**: _ECS-flavored system-based architecture_. There is no formal ECS library — entities are plain data objects (`Alien`, `Bullet`, `Particle`...), state is one mutable root object (`GameState`), and behavior lives in **system classes** that operate on it. It is best described as a **mutable-state + system pipeline** design.

## 2. The Game Loop (`engine.ts`)

`GameEngine` is the orchestrator. It owns the `requestAnimationFrame` loop and wires systems together.

**Per-frame pipeline (`_frame` → `_update` + `_draw`) — fixed system order matters:**

1. **Time management** — `dt` computed from `performance.now()`, clamped to `maxDt` (100 ms); `moveScale = dt / 16.67ms` normalizes movement to 60 FPS
2. **Stars update** — parallax starfield scrolls by layer speed
3. **State transitions** — menu/gameover Space-to-start handlers
4. **Early return** if status ≠ `"playing"` (gameplay frozen on overlays)
5. **Alien caches refresh** — `aliveAliens` / `activeAliens` rebuilt via filter
6. **Timers & power-ups** — cooldowns, invulnerability, screen shake, level announce
7. **UFO spawn/move** (`PhysicsSystem.updateUFO`)
8. **Input** — `processInput` (movement + clamping), `checkForShoot` + bullet spawn
9. **Bullets** — integration + off-screen culling
10. **Level progression** — `checkLevelComplete` (spawns next formation)
11. **Alien movement** — step timer, edge bounce, drop-down, shooting
12. **Power-up falling** + **shield damage from aliens**
13. **Collision phase** — `handleBulletCollisions` (orchestrates CollisionSystem)
14. **Power-up pickup** (`_handlePowerUpCollisions`)
15. **Alien-reached-player check** → game over
16. **Particles** — physics integration, cap enforced (500)
17. **Death animations** — `processDeathAnimations` (deferred score/explosions)
18. **Cache refresh + UI notify**

`_draw()` renders in layers: clear → shake transform → stars → ground → shields → aliens → UFO → player → power-ups → bullets → particles → canvas HUD → status screens (menu/gameover/nameEntry).

## 3. State Management

**Design**: _Single mutable object, mutated in place by systems._ Deliberate — documented in README ("No immutability pattern").

- `GameState` (types.ts) holds everything: entities, timers, status, keys, caches, leaderboard cache
- `state-manager.ts` provides lifecycle: `createInitialState`, `resetGameState` (keeps high score), `setPlaying`, `setMenu`, `setGameOver` (routes to `nameEntry` on new high score), `refreshAlienCaches`
- **High score** read once into a module-level cache (`_cachedHighScore`) to avoid repeated `localStorage` reads; `resetHighScoreCache()` exists for tests
- **React bridge**: `_notifyUI()` builds a flat `UIState` and only calls `onUIChange` when a value actually changed (memoized diff against `lastUI`) — prevents React re-renders at 60 FPS
- **Alien caches** (`aliveAliens`, `activeAliens`) are derived arrays refreshed every frame — O(n) filters but avoid repeated `alive` checks in hot loops (alien movement, shooting, collision)

## 4. System Responsibilities & Dependencies

| File                          | Type      | Responsibility                                                                                                                                                                       | Key Dependencies                              |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `input-handler.ts`            | Class     | Keyboard → `g.keys`; name-entry text capture; player movement + boundary clamp                                                                                                       | `GAME_CONFIG`, callbacks                      |
| `physics-system.ts`           | Class     | Bullet/power-up/particle integration; UFO spawn logic; screen shake; cooldowns; shield-vs-alien damage; bomb power-up; game-over on ground breach                                    | `entity-factory`, `state-manager`, `geometry` |
| `collision-system.ts`         | Class     | Collision _predicates + immediate effects_: bullet↔alien (marks dying, may drop power-up), bullet↔UFO (random points), bullet↔shield (erodes pixels), bullet↔player, power-up pickup | `entity-factory`, `geometry`                  |
| `level-system.ts`             | Class     | Level configs (deterministic after L4), alien step movement + edge reversal, bottom-row alien shooting, level-complete respawn                                                       | `entity-factory`, `state-manager`             |
| `bullet-collision-handler.ts` | Function  | Per-frame collision _orchestration_ (reverse iteration, shield→alien→UFO priority; player hit → shield/lives/invulnerability)                                                        | `CollisionSystem`, `PhysicsSystem`            |
| `death-animation-handler.ts`  | Function  | Deferred death processing: after duration, apply score, spawn explosions, trigger game over                                                                                          | `entity-factory`, `state-manager`             |
| `entity-factory.ts`           | Functions | Pure-ish creation: formations (`grid/staggered/diamond/compact/wide`), shields (arch-shaped pixel masks), stars (3 layers), UFO, explosion/impact particles, `damageShieldRect`      | `GAME_CONFIG`, `SPRITES`                      |
| `state-manager.ts`            | Functions | State lifecycle & high-score persistence                                                                                                                                             | `entity-factory`, `leaderboard`               |
| `rendering-system.ts`         | Class     | Draws all entities; batched star paths; death-flash shrink; player invulnerability pulse; bullet trails + glow                                                                       | `renderer-utils`, `rendering-math`            |
| `ui-rendering.ts`             | Class     | Canvas-drawn HUD, level announcement, menu (shimmer title + leaderboard), game-over, name entry                                                                                      | `rendering-math`, `renderer-utils`            |

**Dependency direction**: handlers/classes → state-manager/entity-factory/geometry → config/types. Pure modules (`geometry.ts`, `rendering-math.ts`) depend on nothing — this is what makes them trivially testable.

## 5. Rendering Design

- **Sprite system**: 2D character arrays (`"x"` = filled pixel) in `config.ts` (`SPRITES`, `SPRITES_2` for alien animation frames). `drawSprite()` iterates rows/cols with a scale factor — pixel-art look with `imageSmoothingEnabled = false`
- **Two rendering entry points**: `RenderingSystem` (entities) and `UIRenderingSystem` (HUD + screens) — the "extract canvas screens" refactor split these (see git history)
- **Pure animation math** lives in `rendering-math.ts` (12 functions: twinkle, blink, fade-in, scale-up, shimmer sweep, death anim, trail entries, shield aura, frame index, glow, thrust flicker, score padding) — fully unit-tested (55 tests)
- **Performance techniques**: batched `beginPath()` per star layer, particle cap (500), batched shield `rect()` runs, single canvas (no offscreen layers)

## 6. Data Flow: React ↔ Engine

```
App.tsx (useEffect, mount-once)
  └─ new GameEngine(canvas, { onUIChange: setUi })   ← callback injection
       └─ engine.start()  → createInitialState + rAF loop
App.tsx (cleanup)
  └─ engine.stop()  → cancelAnimationFrame + inputHandler.stop()  (listener cleanup)
```

- React **never touches game state** — it receives derived `UIState` snapshots
- Engine **never touches the DOM** (except canvas + keyboard listeners) — it sends `onUIChange`
- HUD data is rendered **twice**: once on canvas (`ui-rendering.drawHUD`) and once in DOM (`HUD.tsx`). The React HUD is decorative duplicates of the canvas HUD.

## 7. Persistence

`leaderboard.ts` — two `localStorage` keys (`space-invaders-leaderboard`, `space-invaders-highscore`), all reads/writes wrapped in `try/catch` (private browsing / quota safety). `addToLeaderboard` **updates existing name entries** (keeps best score) rather than appending duplicates; list capped at 10, sorted descending.

## 8. Key Design Decisions (from code + git history)

1. **Systems extracted over time**: collision + death logic pulled out of the engine into dedicated files; canvas screens extracted into `UIRenderingSystem`; React HUD split into components (recent refactors)
2. **Mutable state over immutability** — explicit, pragmatic choice for a 60 FPS game; avoids GC pressure
3. **Frame-rate independent physics** via `moveScale` (dt normalization)
4. **O(1) array removal** via `swapRemove` + reverse iteration — order-unstable but deliberate
5. **Deferred death scoring** (`dyingAt` timestamps) so score/explosions land _after_ the death flash animation
6. **Single-file bundle** (`vite-plugin-singlefile`) — deployable as one HTML file
7. **Formation-based levels**: 5 named formations cycle after level 4 with clamped scaling formulas
8. **Sprite rows must be equal width** — uneven rows silently misrender (README warning; `engine.test.ts` asserts player sprite consistency)

## 9. Potential Concerns (Phase 2 candidates)

- **Canvas HUD + React HUD duplication** — same stats rendered in two places (divergence risk)
- **React StrictMode double-mount** — effect creates/destroys engine twice in dev; works, but worth confirming no listener leaks
- **`package.json` legacy deps** — `@modelcontextprotocol/*`, `brace-expansion`, `diff`, `glob`, `minimatch`, `zod` appear unused by `src/` (candidate cleanup)
- **Single `keys` object grows** with any pressed key; cleared on blur (already handled)
- **`performance.now()` in collision/system code** — engine passes `now` into death handler but collision system calls `performance.now()` directly (minor inconsistency)
- **No collision with `dt` substeps** — bullets can tunnel through thin objects at high `dt` (mitigated by `maxDt` clamp)
