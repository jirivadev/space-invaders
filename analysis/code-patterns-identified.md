# Code Patterns Identified — Space Invaders

> Phase 2 deliverable. Date: 2026-07-31

Recurring conventions across the codebase. New code should follow these patterns; deviation should be a conscious decision.

## 1. Mutable State + System Pipeline (ECS-flavored)

- **Pattern**: One mutable `GameState` root object; system classes and handler functions mutate it in place. No immutability, no state libraries.
- **Where**: `engine.ts` `_update()`, all files in `src/game/system/`
- **Rule**: Systems are stateless _with respect to game data_ — they hold only transient internal state (e.g., `PhysicsSystem` shake offsets). All durable state lives on `GameState`.
- **Tradeoff**: Simple + GC-friendly at 60 FPS; requires discipline (systems must not hold stale references to entities removed via `swapRemove`).

## 2. Reverse-Iteration + `swapRemove` for Array Removal

- **Pattern**: Iterate arrays from `length-1` down to `0`; remove elements with `swapRemove(arr, i)` (swap-with-last + pop, O(1)).
- **Where**: `utils.ts`, used in `physics-system.ts`, `bullet-collision-handler.ts`, `engine.ts`, `collision-system.ts`
- **Why**: O(1) removal; reverse iteration keeps indices valid while removing.
- **Caveat**: **Order-unstable** — surviving elements move. Never rely on array order for gameplay logic (e.g., "first bullet" semantics). Also: after `swapRemove`, a local reference to the removed element is stale — do not reuse it for further mutations of the array.

## 3. Callback Injection (No Circular Imports)

- **Pattern**: Classes receive their dependencies as constructor callbacks/objects instead of importing each other. `GameEngine` wires everything in its constructor.
- **Where**: `input-handler.ts` constructor takes `GameCallbacks` (`onUIChange`, `onGetState`, `onAddToLeaderboard`, `onStateChange`); `engine.ts` constructor takes `GameCallbacks`; `handleBulletCollisions` takes a `BulletCollisionDependencies` object.
- **Why**: Keeps system files import-free of each other; enables testing with `vi.fn()` mocks (see `input-handler.test.ts`).

## 4. Pure Math Layer (Canvas-Free Functions)

- **Pattern**: All animation/interpolation math extracted into pure, side-effect-free functions with default parameters for testability.
- **Where**: `rendering-math.ts` (12 exported functions), `geometry.ts`
- **Why**: 55 tests in `rendering-math.test.ts` with zero canvas mocks. Rendering systems just call these to get values.
- **Convention**: Functions named `compute*` (e.g., `computeBlinkAlpha`, `computeShimmerSweep`); parameters defaulted (speed, duration, alpha ranges).

## 5. Sprite Pattern Rendering (Pixel-Art Char Grids)

- **Pattern**: Entities drawn from 2D string arrays in `config.ts` (`SPRITES`, `SPRITES_2`); `"x"` = filled pixel. `drawSprite()` renders with a scale factor; `imageSmoothingEnabled = false` for crisp pixels.
- **Where**: `config.ts` lines 254-356, `renderer-utils.ts` `drawSprite`
- **Rule**: Every row must be the same width — uneven rows silently misrender (verified by test `engine.test.ts` "SPRITES.player rows have consistent width").
- **Animation**: Two-frame alternation via `SPRITES`/`SPRITES_2` + `computeAnimationFrameIndex`.

## 6. Frame-Rate Independence via `moveScale`

- **Pattern**: `dt = min(now - lastTime, maxDt)`; `moveScale = dt / targetDt` (16.67 ms). All per-frame motion multiplies by `moveScale`.
- **Where**: `engine.ts` lines 116-124; consumed by `input-handler.ts`, `physics-system.ts`
- **Why**: Consistent speed at 30/60/120 Hz displays.

## 7. Deferred Death Effects (Timestamp-Based)

- **Pattern**: On hit, entities are marked with `dyingAt = performance.now()` and a `pendingScore`; a death animation plays; the actual score credit + explosion happens later in `processDeathAnimations` after the duration elapses.
- **Where**: `collision-system.ts` (marks dying), `death-animation-handler.ts` (processes), `rendering-system.ts` (draws shrinking white flash)
- **Why**: Score lands _after_ the flash — feels intentional rather than instant + inconsistent.

## 8. Derived Cache Arrays Refreshed Per Frame

- **Pattern**: `aliveAliens` / `activeAliens` maintained as pre-filtered arrays, rebuilt each frame via `refreshAlienCaches(g)`.
- **Where**: `state-manager.ts` `refreshAlienCaches`; called at start + end of `engine._update()`
- **Why**: Avoids repeated `alive && dyingAt === 0` checks in hot loops (movement, shooting, collisions).
- **Caveat**: Stale between refreshes within a frame (see `technical-issues.md` #3).

## 9. `try/catch` Wrapping All Persistence

- **Pattern**: Every `localStorage` read/write wrapped in `try/catch`; failures degrade silently (return `[]` / no-op).
- **Where**: `leaderboard.ts`, `state-manager.ts` (`readCachedHighScore`, `setGameOver`)
- **Why**: Private browsing, quota exceeded, or disabled storage must not crash the game.

## 10. React ↔ Engine Bridge: Diffed Callback Snapshots

- **Pattern**: Engine never imports React. It emits a flat `UIState` snapshot via `onUIChange` **only when values change** (compared against `lastUI`).
- **Where**: `engine.ts` `_notifyUI()` (lines 330-356), `App.tsx` `useState`
- **Why**: Prevents React re-renders at 60 FPS; the DOM only updates on real changes.

## 11. Single-Source Configuration

- **Pattern**: Every tunable value lives in `config.ts` under `GAME_CONFIG` (grouped by concern) or as named constants (`CANVAS_WIDTH`, `COLORS`, `SPRITES`, `STAR_LAYERS`). Systems import config, never hardcode magic numbers.
- **Exception (known)**: A few one-off hex colors appear inline in rendering code (e.g., `"#334155"` ground line, `"#facc15"` thrust, `"#3b82f6"` shield aura) rather than in `COLORS`.

## 12. Test Utilities as Factories

- **Pattern**: `test-utils/factory.ts` exports `createMockState` + entity builders (`makeBullet`, `makeAlien`, `makeUFO`, `makeShield`, `makePowerUp`, `makePlayer`) with sensible defaults + `Partial` overrides.
- **Why**: Tests build realistic states in one line; keeps test files focused on behavior.

## 13. Test Style Conventions

- **Pattern**: `describe` blocks per function/class; `it()` sentences describe behavior in plain English; global stubs (`vi.stubGlobal`) for `localStorage`, `requestAnimationFrame`, `window`, and a minimal mock 2D context.
- **Where**: `engine.test.ts` (the canonical mock setup), `input-handler.test.ts`
- **Convention**: `beforeEach` sets up fresh mocks; `afterEach` calls `vi.unstubAllGlobals()`.
