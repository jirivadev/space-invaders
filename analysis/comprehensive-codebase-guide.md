# Comprehensive Codebase Guide — Space Invaders

> Phase 3 deliverable. Date: 2026-07-31
> Complete system reference. Companion docs: `project-overview.md`, `architecture-analysis.md`, `code-patterns-identified.md`, `technical-issues.md`, `component-deep-dives/`.

## 1. System Overview

A browser Space Invaders clone: **React 19 + TypeScript** provides the page shell, while **all gameplay runs on a single HTML5 canvas** driven by a framework-free game core in `src/game/`. The core uses a **mutable `GameState` + system-class pipeline** — no ECS library, no immutability. React and the engine communicate only through a diffed `onUIChange` callback, so the DOM re-renders at most when values change (never at 60 FPS).

```
┌─────────────────────────────── REACT SHELL ───────────────────────────────┐
│ main.tsx (StrictMode + ErrorBoundary) ─► App.tsx                           │
│   │  mounts <canvas>, creates GameEngine(canvas, { onUIChange: setUi })   │
│   │  useEffect → engine.start()   cleanup → engine.stop()                 │
│   ▼                                                                        │
│   PowerUpBanner.tsx · ControlsHint.tsx   (supporting DOM UI)                │
└────────────────────────────────────────────────────────────────────────────┘
                                    ▲ onUIChange (diffed UIState)
┌─────────────────────────────── GAME CORE (framework-free) ───────────────┐
│ GameEngine (engine.ts)                                                    │
│   rAF loop:  _update() ── 18-step pipeline mutating `g`                   │
│              _draw()   ── RenderingSystem + UIRenderingSystem on canvas   │
│   systems: input-handler · physics-system · collision-system · level-     │
│            system · state-manager · bullet-collision-handler · death-     │
│            animation-handler · entity-factory                              │
│   pure:    geometry.ts · rendering-math.ts · renderer-utils.ts            │
│   data:    types.ts · config.ts · leaderboard.ts · utils.ts               │
└────────────────────────────────────────────────────────────────────────────┘
```

## 2. End-to-End Game Flow

1. **Boot**: `main.tsx` installs global `window.onerror`/`onunhandledrejection` handlers + an `ErrorBoundary`, renders `<App/>` in `StrictMode`.
2. **Mount**: `App.tsx` effect (empty deps) creates `GameEngine` with `onUIChange: setUi`; `start()` calls `createInitialState(0, 3, "menu")` (reads high score + leaderboard from `localStorage`), starts the `InputHandler`, and launches `requestAnimationFrame`.
3. **Menu state**: every frame `_handleStateTransitions` (engine.ts:237) checks `g.keys[" "]`. On Space → `resetGameState` (score=0, lives=3, level=1, shields rebuilt), `setPlaying`, spawns level-1 aliens (`createAliens("grid", 80)`), seeds the UFO timer.
4. **Frame loop** (`_update`, engine.ts:111): dt computed & clamped (`maxDt` 50 ms), `moveScale = dt/16.67`. Stars scroll. **Gameplay runs only when `status === "playing"`** — overlays freeze the action.
5. **Combat loop**: `processInput` moves/clamps the player → `checkForShoot` spawns player bullets on cooldown → bullets integrate (trail + off-screen cull) → aliens step/shoot → UFO spawns/moves → collisions processed (`handleBulletCollisions`) → power-up pickups → death animations → particles.
6. **Kills**: player bullet ↔ alien/UFO/shield/player handled in `bullet-collision-handler.ts` + `collision-system.ts`. Hits mark `dyingAt` + `pendingScore`; score lands ~150 ms later via `death-animation-handler.ts` (deferred so the death flash shows first).
7. **Level clear**: `checkLevelComplete` (level-system.ts:58) waits for in-flight alien death animations, then fires when `aliveAliens.length === 0` → level++, new formation, announce timer, UFO timer reset. Levels 5+ scale deterministically and cycle 5 formations.
8. **Game over**: player hit with 0 lives → death animation → `setGameOver`. If score beats high score → **nameEntry** screen (type name ≤8 chars, Enter submits with "AAA" fallback → `addToLeaderboard` → menu). Otherwise → **gameover** screen; Space returns to menu.
9. **UI notify**: `_notifyUI` (engine.ts:330) diffs against `lastUI`; only changed values call `onUIChange` → React updates the supporting status UI.

## 3. Module Reference

| File                                 | Purpose                                                                                                                                        | Key exports                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/main.tsx`                       | React entry, global error handlers, ErrorBoundary                                                                                              | —                                                                                                          |
| `src/App.tsx`                        | Canvas mount, engine lifecycle, UI bridge                                                                                                      | `App`                                                                                                      |
| `src/components/PowerUpBanner.tsx`   | DOM rapid-fire/shield countdowns (null when idle)                                                                                              | `PowerUpBanner`                                                                                            |
| `src/components/ControlsHint.tsx`    | Key legend                                                                                                                                     | `ControlsHint`                                                                                             |
| `src/game/engine.ts`                 | Orchestrator: rAF loop, `_update` pipeline, `_draw`, `_notifyUI`, state transitions                                                            | `GameEngine`                                                                                               |
| `src/game/config.ts`                 | All constants: `GAME_CONFIG`, `CANVAS_*`, `COLORS`, `SPRITES`/`SPRITES_2`, `STAR_LAYERS`, `SHIELD_POSITIONS`, `ALIEN_POINTS`                   | config + sprites                                                                                           |
| `src/game/types.ts`                  | `GameState`, entities (`Alien`, `Bullet`, `Shield`, `UFO`, `Particle`, `Player`, `Star`, `PowerUp`), `UIState`, `GameCallbacks`, `LevelConfig` | types                                                                                                      |
| `src/game/geometry.ts`               | `rectsOverlap`, `hexToRgb` (pure)                                                                                                              | —                                                                                                          |
| `src/game/rendering-math.ts`         | 13 pure `compute*` animation functions + `formatPaddedScore` (canvas-free)                                                                     | —                                                                                                          |
| `src/game/renderer-utils.ts`         | `drawSprite` (char-grid → pixels), `drawShield` (batched rect runs)                                                                            | —                                                                                                          |
| `src/game/leaderboard.ts`            | localStorage top-10, dedupe-by-name-keep-best                                                                                                  | `getLeaderboard`, `addToLeaderboard`                                                                       |
| `src/game/utils.ts`                  | `swapRemove` (O(1) unordered removal)                                                                                                          | —                                                                                                          |
| `src/game/test-utils/factory.ts`     | `createMockState` + `make*` entity builders                                                                                                    | —                                                                                                          |
| `system/state-manager.ts`            | State lifecycle: create/reset/status setters, high-score cache, `refreshAlienCaches`                                                           | `createInitialState`, `resetGameState`, `setPlaying/Menu/GameOver`, `refreshAlienCaches`                   |
| `system/input-handler.ts`            | Keyboard → `g.keys`, name-entry capture, player movement + clamping, blur resets keys                                                          | `InputHandler`                                                                                             |
| `system/physics-system.ts`           | Bullet/particle/power-up integration, UFO spawn+move, screen shake, cooldowns, shield-vs-alien damage, bomb, invulnerability                   | `PhysicsSystem`                                                                                            |
| `system/collision-system.ts`         | Collision predicates + immediate effects (dying marks, power-up drops, shield erosion, UFO points)                                             | `CollisionSystem`                                                                                          |
| `system/level-system.ts`             | `getLevelConfig`, alien step movement + edge reversal, bottom-row shooting, level-complete                                                     | `LevelSystem`, `getLevelConfig`                                                                            |
| `system/entity-factory.ts`           | Formation grids (5 shapes), shields (arch mask), stars (3 layers), UFO, explosion/impact particles, `damageShieldRect`                         | `createAliens`, `createShield`, `createStars`, `createUFO`, `createExplosionParticles`, `damageShieldRect` |
| `system/bullet-collision-handler.ts` | Per-frame collision orchestration (shield→alien→UFO for player bullets; shield/lives for alien bullets)                                        | `handleBulletCollisions`                                                                                   |
| `system/death-animation-handler.ts`  | Deferred death processing: score, explosions, game-over                                                                                        | `processDeathAnimations`                                                                                   |
| `system/rendering-system.ts`         | Draws stars/ground/shields/aliens/UFO/player/power-ups/bullets/particles                                                                       | `RenderingSystem`                                                                                          |
| `system/ui-rendering.ts`             | Canvas HUD, level announcement, menu, game-over, name-entry screens                                                                            | `UIRenderingSystem`                                                                                        |

## 4. GameState Reference (`types.ts`)

| Group       | Field                                                       | Meaning                                                                     |
| ----------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| Flow        | `status`                                                    | `"menu" \| "playing" \| "gameover" \| "nameEntry"`                          |
| Scoring     | `score`, `highScore`                                        | Current / best (high score cached module-side)                              |
| Progression | `level`, `levelAnnounceTimer`                               | Current level + "LEVEL N" overlay countdown                                 |
| Player      | `player`                                                    | `{x,y,w,h,speed,cooldown,invulnerable,diedAt}`                              |
| Enemies     | `aliens`, `aliveAliens`, `activeAliens`                     | All / alive-not-dying / alive (incl. dying) — **caches, refresh per frame** |
| Projectiles | `bullets`                                                   | `{x,y,w,h,dy,owner,trail}`                                                  |
| Defenses    | `shields`                                                   | 4 arch-shaped pixel grids (`pixels: boolean[][]`)                           |
| Bonus       | `ufo`, `ufoTimer`                                           | UFO entity + spawn countdown                                                |
| Effects     | `particles`, `powerUps`, `activePowerUps`                   | Explosions/debris; falling pickups; `{rapidFire, shield}` ms timers         |
| Aliens      | `alienDir`, `alienStepTimer`, `alienFrame`, `alienMoveDown` | Formation state machine                                                     |
| Input       | `keys`                                                      | `Record<string, boolean>`; cleared on window blur                           |
| World       | `stars`                                                     | Parallax layers 1-3                                                         |
| Persistence | `leaderboardCache`                                          | Snapshot shown on menu                                                      |
| Timing      | `lastTime`, `initialized`, `screenOpenedAt`                 | dt calc, first-frame guard, overlay anims                                   |

## 5. The Frame Pipeline (`engine._update`, engine.ts:111-210)

1. Compute `now`, `dt` (clamped to 50 ms), `moveScale`
2. Scroll starfield (per-layer speed × moveScale)
3. `_handleStateTransitions` — menu/gameover Space handling
4. **Early return** unless `status === "playing"`
5. `refreshAlienCaches(g)` — rebuild `aliveAliens`/`activeAliens`
6. Cooldowns, invulnerability, screen shake, level-announce timer
7. `updateUFO` — spawn/move/despawn + timer roll
8. `processInput` — movement + boundary clamp
9. `checkForShoot` → `spawnPlayerBullet` (+ rapid-fire cooldown)
10. `updateBullets` — integrate trail + cull off-screen
11. `checkLevelComplete` — waits for active death animations before advancing
12. `moveAliens` + `updateAlienShootingTimer` + `updatePowerUps`
13. `spawnAlienBullet` when timer expires (bottom-row shooter)
14. `damageShieldsWithAliens`
15. `handleBulletCollisions` — the main combat resolution
16. `_handlePowerUpCollisions` — pickup → rapidFire/shield/bomb
17. `checkAlienReachedPlayer` → game over
18. `updateParticles` + `processDeathAnimations` + `enforceParticleCap`
19. `refreshAlienCaches` (again) + `_notifyUI`

`_draw` (engine.ts:268) renders: clear → shake translate → stars(dimmed on overlays) → ground → shields → aliens → UFO → player → power-ups → bullets → particles → canvas HUD → announcement → status screen.

## 6. Collision & Death Pipeline

- **Player bullet** (priority order): shields → aliens → UFO. First hit consumes the bullet. Shield hits erode `pixels` via `damageShieldRect` + spawn particles; alien hits set `dyingAt`/`pendingScore` and may drop a power-up (10%); UFO hits award random points from `[50,100,150,300]` and **clear all falling power-ups**.
- **Alien bullet**: player hit → shield aura absorbs (particles only) → else `lives--`, invulnerability 2 s, shake; at 0 lives sets `player.diedAt` for the death animation.
- **Deferred resolution** (`death-animation-handler.ts`): after `alienDuration` (150 ms) a dying alien pays `pendingScore`, spawns a 40-particle explosion, and `alive=false`. Player death pays after 300 ms then `setGameOver`.
- **T-1 resolved**: `checkLevelComplete` waits for active alien death animations, allowing `processDyingAliens` to award the final alien's deferred score before the next formation is created.

## 7. Configuration Guide (`config.ts`)

All tuning is centralized. `GAME_CONFIG` sections:

| Section    | Controls                                            | "Make it harder" example                        |
| ---------- | --------------------------------------------------- | ----------------------------------------------- |
| `canvas`   | 800×640, `targetDt` 16.67, `maxDt` 50               | swept bullet collision prevents tunneling (T-3) |
| `shield`   | 24×16 px grid ×3 px, y=480, 4 positions             | fewer positions → weaker defense                |
| `player`   | speed 5, cooldown 333 ms, invuln 2 s                | raise `shootCooldown`                           |
| `bullet`   | player −9 px/f, alien +4..                          | faster alien bullets via levels                 |
| `alien`    | step 8/20 px, spriteScale 3                         | bigger `stepX` → faster advance                 |
| `ufo`      | speed 2.5, 10–25 s timer, points `[50,100,150,300]` | shorter `timerRange`                            |
| `powerUp`  | duration 8 s, spawn 10%, fall 2                     | lower `spawnChance`                             |
| `particle` | bomb 2/alien, cap 500, decay 60                     | raise cap (perf risk)                           |
| `gameplay` | invuln, announce 2 s, level-clear UFO 2 s           | —                                               |
| `death`    | alien/UFO 150 ms, player 300 ms                     | —                                               |

**Sprite editing**: alien/player/UFO/power-up art are `SPRITES`/`SPRITES_2` char grids — each row must be same width (uneven rows silently misrender). Alien animation alternates frame 0 / frame 1.

## 8. Persistence & Leaderboard

- Keys: `space-invaders-leaderboard` (top-10 JSON), `space-invaders-highscore` (number string).
- `addToLeaderboard(name, score)`: trims name; **updates an existing entry's score if higher** (no duplicates); sorts desc; slices 10; try/catch on write.
- High score is read once into a module cache (`state-manager.ts` `_cachedHighScore`); written only when beaten in `setGameOver`. Single-tab game → cache staleness is acceptable.
- All storage access is try/catch-wrapped — private browsing / quota failures degrade silently.

## 9. Known Issues & Gotchas (summary)

| ID   | Issue                                                          | Impact   |
| ---- | -------------------------------------------------------------- | -------- |
| T-1  | Level-clear final alien pays 0 points                          | Resolved |
| T-2  | Stale bullet ref after shield hit → phantom kills / lost shots | Resolved |
| T-3  | Bullet tunneling at low FPS (swept bullet path)                | Resolved |
| T-4  | HUD drawn twice (canvas + DOM)                                 | Resolved |
| T-5  | 7 unused runtime deps                                          | Resolved |
| T-6  | No pre-commit test gate (AGENTS.md inaccurate)                 | Resolved |
| T-7  | `performance.now()` mixed with injected `now`                  | Resolved |
| T-8  | Rendering modules + components lack direct tests               | Resolved |
| T-9  | Inline hex colors outside `COLORS`                             | Resolved |
| T-10 | No explicit vitest config                                      | Resolved |

Full details + fixes: `technical-issues.md`.
