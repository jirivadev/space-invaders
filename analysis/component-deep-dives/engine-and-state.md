# engine-and-state.md

Component deep-dive: `GameEngine` (src/game/engine.ts) and `state-manager.ts` (src/game/system/state-manager.ts).

## GameEngine — orchestrator (engine.ts, 357 lines)

**Purpose:** Owns the `requestAnimationFrame` loop, the `GameState` instance, and the six system instances (input, collision, physics, level, rendering, UI rendering). Coordinates the per-frame update pipeline and draw layering, and bridges game state to React via a diffed `onUIChange` callback.

**Lifecycle**

- `constructor(canvas, callbacks)` (engine.ts:49) — grabs a 2D context, throws if unsupported (engine.ts:52-56), binds `_frame`, constructs all systems. Injects callbacks into `InputHandler` (engine.ts:60-65): `onUIChange`, `onGetState` (returns `this.g!`), `onAddToLeaderboard` → `submitLeaderboard`, `onStateChange` → `setStatus`.
- `start()` (engine.ts:73) — `createInitialState(0, 3, "menu")`, `inputHandler.start()`, starts rAF.
- `stop()` (engine.ts:79) — cancels rAF, removes window listeners. Called by React on unmount (App.tsx:28-30).
- `submitLeaderboard(name, score)` (engine.ts:85) — persists via `addToLeaderboard`, refreshes `g.leaderboardCache`.
- `setStatus(status)` (engine.ts:93) — directly overwrites `g.status` (used by name-entry flow).

**Loop**

- `_frame()` (engine.ts:101) — wraps `_update()` + `_draw()` in try/catch (`console.error` on failure, loop keeps running), then re-schedules rAF.

**`_update()` pipeline (engine.ts:111)** — 18 steps, in order:

1. Time: `dt = min(maxDt, now - lastTime)`, first frame uses `targetDt` (engine.ts:117-120); `moveScale = dt / targetDt` for frame-rate independence.
2. Scroll stars per layer speed (engine.ts:127-134), wrap to top with random x.
3. `_handleStateTransitions` (engine.ts:237) — menu: Space → `resetGameState` + `setPlaying` + spawn level-1 aliens + random `ufoTimer`; gameover: Space → `setMenu`. Consumes the space key to avoid re-trigger.
4. Early return when `status !== "playing"` (engine.ts:140) — HUD/menus still draw.
5. `refreshAlienCaches` (engine.ts:143) — rebuilds `aliveAliens`/`activeAliens` after transitions.
6. Cooldowns, invulnerability, screen shake, `levelAnnounceTimer` (engine.ts:146-149).
7. `updateUFO` (engine.ts:152).
8. `processInput` → movement + clamping (engine.ts:155).
9. `checkForShoot` → `spawnPlayerBullet`, cooldown = rapidFire or normal (engine.ts:158-164).
10. `updateBullets` (engine.ts:167).
11. `checkLevelComplete` (engine.ts:170).
12. `moveAliens` + `updateAlienShootingTimer` + `updatePowerUps` (engine.ts:173-175).
13. `spawnAlienBullet` when `alienShootTimer <= 0` (engine.ts:178-180).
14. `damageShieldsWithAliens` (engine.ts:183).
15. `handleBulletCollisions` (engine.ts:186) — the central collision pass.
16. `_handlePowerUpCollisions` (engine.ts:212) — reverse-iterates `powerUps`, applies rapidFire/shield/bomb effects, spawns explosion particles, `swapRemove`. (Duplicates the color mapping from `POWER_UP_VISUALS` in rendering-system.ts:30.)
17. `checkAlienReachedPlayer` + `updateParticles` + `processDeathAnimations` (engine.ts:195-201).
18. `enforceParticleCap` + `refreshAlienCaches` + `_notifyUI` (engine.ts:204-209).

**`_draw()` layering (engine.ts:268)** — clear → shake translate → stars (dimmed 0.5 on overlay screens, engine.ts:291) → ground → shields → aliens → UFO → player → power-ups → bullets → particles → HUD → level announcement → status screen (menu/gameover/nameEntry) → restore.

**UI bridge — `_notifyUI()` (engine.ts:330)** — builds a `UIState` snapshot (score/highScore/lives/status/level + ceil'd power-up seconds), compares field-by-field against `lastUI`, and only calls `onUIChange` on change. Keeps React re-renders minimal (power-up timer updates ≤ 1/sec).

## state-manager.ts (137 lines)

**Purpose:** Pure state-factory/mutation helpers. No class — free functions over the mutable `GameState`.

**Key functions**

- `createInitialState(score=0, lives=3, status="menu", now)` (state-manager.ts:47) — builds the full state: level-1 aliens from `getLevelConfig(1)`, 4 shields at `SHIELD_POSITIONS`, centered player, `leaderboardCache` from `getLeaderboard()`, and `screenOpenedAt = now`.
- `resetGameState(g)` (state-manager.ts:8) — resets mutable gameplay fields for a fresh run (score/lives/level/shields/bullets/particles/power-ups/player timers/alien movement); keeps high score and the player object identity.
- `setPlaying` (state-manager.ts:103) / `setMenu` (state-manager.ts:108) — status flips; `setMenu` also nulls the UFO and stamps `screenOpenedAt` (drives fade-in animations).
- `refreshAlienCaches(g)` (state-manager.ts:115) — `aliveAliens = alive && dyingAt === 0`; `activeAliens = alive`. Callers must remember to invoke after any kill/respawn (engine calls it twice per frame).
- `setGameOver(g, saveHighScore=true)` (state-manager.ts:120) — guarded no-op unless `status === "playing"` (state-manager.ts:121, prevents re-entry). New high score → writes `localStorage` (try/catch) + routes to `"nameEntry"`; otherwise `"gameover"`.

**High-score module cache** — `_cachedHighScore` (state-manager.ts:28) avoids repeated localStorage reads; `readCachedHighScore` guards `Number.isFinite` and catches quota/private-browsing errors; `resetHighScoreCache()` (state-manager.ts:43) exists purely for tests.

## Test coverage

- `engine.test.ts` — **22 tests** (all pass). Includes geometry + leaderboard describes (see rendering-and-support.md). Smoke tests: construction (engine.test.ts:313), start/stop (317), `onUIChange` firing after menu→playing transition (325), `setStatus`/`submitLeaderboard` wire-through (355/370), `levelAnnounceTimer` decrement/expiry (387/405), state-transition reachability (423).
- `state-manager.test.ts` — **18 tests**: `setGameOver` branches incl. no-op guards on `gameover`/`nameEntry` (50-104), high-score persistence + quota-failure tolerance (66/104), `createInitialState` defaults/shields/leaderboardCache (118-160), `resetGameState` keeps high score (235).

## Observations

- Single mutable `GameState` passed everywhere is simple and fast, but ordering bugs are possible: `refreshAlienCaches` must run after state transitions AND after death processing (engine.ts:143, 207) or collision/level checks read stale caches.
- `_handlePowerUpCollisions` lives in the engine rather than a system (asymmetric with `handleBulletCollisions`), and duplicates power-up color logic (engine.ts:223-228 vs rendering-system.ts:30-35) — a DRY smell.
- `_frame` catches errors and keeps looping — resilient, but a persistent bug spams `console.error` every frame with no backoff.
- `setStatus` overwrites `g.status` directly without guards, so any caller can force invalid transitions; only `InputHandler` uses it today.
- Swap-based removal (`swapRemove`) reorders arrays; safe here since iteration is always reverse-and-skip and no index-based lookups persist.
