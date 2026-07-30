# Code Review: Space Invaders

**Reviewed:** 2026-07-30

Overall this is a solid, well-structured React + Canvas game. The system separation is clean, rendering math is nicely isolated, and tests are co-located. Below are findings grouped by severity.

## Critical Bugs

### 1. Level announcement overlay never disappears
**Files:** `src/game/engine.ts`, `src/game/system/level-system.ts`

`LevelSystem.checkLevelComplete()` sets `g.levelAnnounceTimer = 2000`, but nothing ever decrements it. `RenderingSystem.drawLevelAnnouncement()` draws the overlay and "LEVEL N" text every frame forever.

**Fix:** Decrement the timer in the update loop, e.g. `g.levelAnnounceTimer = Math.max(0, g.levelAnnounceTimer - dt)`.

### 2. Player bullets do not damage shields
**File:** `src/game/system/collision-system.ts` (`checkPlayerBulletShield`)

The function checks overlap and spawns particles, but never calls `damageShieldRect()`. The engine removes the bullet on collision, but shield pixels remain intact.

**Fix:** Add `damageShieldRect(s, b.x, b.y, b.w, b.h)` inside the collision branch.

### 3. Player sprite has malformed rows
**File:** `src/game/config.ts` (`SPRITES.player`)

Rows 1–5 are 9 characters wide, but rows 6 (`'x-xxx-x-'`) and 7 (`'x-x-x-x-'`) are only 8 characters. `drawSprite()` draws each row by its length, so the bottom rows render one pixel narrower.

**Fix:** Pad the shorter rows to 9 characters (`'x-xxx-x--'`, `'x-x-x-x--'`).

## Bugs / Logic Issues

### 4. Misleading test name in `level-system.test.ts`
```ts
it('enforces floor of 80 at higher difficulty levels', () => {
  // ...
  expect(interval).toBeLessThan(80); // actually asserts it CAN go below 80
});
```
The real floor is `80 / speedMultiplier`, not 80. Rename the test or adjust the assertion.

### 5. Misleading indentation in `physics-system.ts`
**File:** `src/game/system/physics-system.ts` lines 61–64

```ts
if (g.ufo.x > GAME_CONFIG.canvas.width + 50 || g.ufo.x + g.ufo.w < -50) {
  g.ufo = null;
g.ufoTimer = GAME_CONFIG.ufo.timerMin + Math.random() * GAME_CONFIG.ufo.timerRange;
}
```
The `g.ufoTimer` line is inside the `if` block but indented incorrectly. Re-indent for readability.

### 6. Global particle cap is not enforced
`GAME_CONFIG.particle.maxCount` is only applied inside `applyBomb()`. Other particle sources (bullet impacts, alien/player deaths) can exceed the limit and cause frame drops.

**Fix:** Enforce `maxCount` in a central location, such as `updateParticles()`.

### 7. `GameEngine` method shadows imported function
**File:** `src/game/engine.ts`

```ts
addToLeaderboard(name: string, score: number): void {
  addToLeaderboard(name, score); // same name as imported leaderboard function
}
```
This works but is confusing. Rename the method (e.g. `submitLeaderboard`).

## Code Quality & Maintainability

### 8. Circular callbacks in `App.tsx`
```ts
const engine = new GameEngine(canvas, {
  onUIChange: setUi,
  onAddToLeaderboard: (name, score) => engineRef.current?.addToLeaderboard(name, score),
  onStateChange: (status) => engineRef.current?.setStatus(status),
});
```
The engine receives callbacks that just call back into the engine. Let `InputHandler` invoke engine methods directly, or make the engine's public methods the entry points.

### 9. `InputHandler` captures `this.g!` before initialization
**File:** `src/game/engine.ts` constructor

`onGetState: () => this.g!` is bound while `this.g` is still `null`. It works because `start()` initializes `g` before `inputHandler.start()`, but the design is fragile. Consider a null-safe getter or passing state later.

### 10. `processInput` returns `GameState` unnecessarily
**File:** `src/game/system/input-handler.ts`

Callers mutate `g` in place. Change the return type to `void`.

### 11. Bullet-collision loop is subtle
**File:** `src/game/engine.ts` `_handleBulletCollisions()`

```ts
if (!g.bullets[i]) continue;
```
After `splice(i, 1)`, the loop's `i--` makes this correct, but it is non-obvious. Add a comment or refactor to a filter-style approach.

### 12. Inline state reset in `_handleStateTransitions`
The menu-to-playing transition resets ~15 fields inline. Extract this into a `resetGameState(g)` helper in `state-manager.ts`.

### 13. `README.md` is empty
Add build/test instructions and a brief project description.

## Architecture & Design

### 14. `rendering-system.ts` is large
At 467 lines it handles almost all drawing. Consider splitting into smaller renderers (e.g. `AlienRenderer`, `HUDRenderer`) as the game grows.

### 15. Leaderboard update behavior
`addToLeaderboard()` updates an existing name's score rather than creating a duplicate entry. This is a design choice; document it if intentional.

## Testing

### 16. Missing tests for critical bugs
- `levelAnnounceTimer` decrement and expiration
- Player bullet damaging shield pixels
- Player sprite row consistency
- Particle count not exceeding `maxCount`

### 17. `engine.test.ts` dead code
Line 177 writes to a global `__rAF_callback` that is never read.

### 18. Good coverage exists for
- Input handling (movement, boundaries, name entry, blur)
- Leaderboard sorting and error handling
- State transitions
- Rendering math

## Recommended Fix Order

1. Fix level announcement overlay (#1)
2. Fix player bullets not damaging shields (#2)
3. Fix malformed player sprite (#3)
4. Rename `addToLeaderboard` and simplify `App.tsx` callbacks (#7, #8)
5. Add `resetGameState` helper and refactor bullet-collision loop (#11, #12)
6. Fix misleading test name and add missing tests (#4, #16)
7. Enforce global particle cap (#6)
8. Fill in `README.md` (#13)
