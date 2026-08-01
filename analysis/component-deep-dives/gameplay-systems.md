# gameplay-systems.md

Component deep-dive: input-handler.ts, physics-system.ts, collision-system.ts, level-system.ts (src/game/system/).

## InputHandler (input-handler.ts, 108 lines)

**Purpose:** Global keyboard capture (`window` listeners) → `g.keys`; name-entry capture during `"nameEntry"`; player movement + boundary clamping; shoot predicate. Single class, callback-injected like the engine's other systems.

**Key methods**

- `start()` / `stop()` (input-handler.ts:15, 21) — add/remove `keydown`/`keyup`/`blur` listeners.
- `_onKeyDown` (input-handler.ts:27) — sets `g.keys[e.key] = true`; `preventDefault` for game keys (space, arrows, a/d, Enter) to stop page scroll; routes to `_handleNameEntry` when `status === "nameEntry"`.
- `_onKeyUp` (input-handler.ts:44) — clears the key.
- `_onBlur` (input-handler.ts:50) — resets `g.keys = {}` entirely (stuck-key prevention when the tab loses focus mid-hold).
- `_handleNameEntry` (input-handler.ts:57) — Enter: trims name (falls back to `"AAA"`), fires `onAddToLeaderboard` + `onStateChange("menu")`; Backspace: slices; printable 1-char keys appended while under `nameEntryMaxChars` (8).
- `processInput(g, dt)` (input-handler.ts:72) — early-returns for non-`"playing"` statuses (menus don't move the player, input-handler.ts:75-81); `x -= speed * moveScale` for ArrowLeft/a/A, symmetric right; clamps `x` to `[boundaryPadding, width - w - boundaryPadding]` (input-handler.ts:90-98). Uses `moveScale = dt / targetDt`.
- `checkForShoot(g)` (input-handler.ts:103) — true iff cooldown elapsed AND space held. Cooldown is consumed by the engine (engine.ts:160-163), not here.

**Test coverage:** `input-handler.test.ts` — **23 tests**: name-entry append/Backspace/max-chars/Enter-fallback/trim (57-143), key capture + non-name-entry guard (154-162), movement + boundary clamping both sides (173-233), menu/nameEntry movement lockout (259-279), `checkForShoot` cooldown logic (301-325), listener add/remove (333-355), blur key-clear (378).

**Observations:** Clean, small, well-tested. Names are case-sensitive (no normalization in `_handleNameEntry`). Keys recorded during name entry linger in `g.keys` until blur/start — harmless since `processInput` ignores them, and `resetGameState` doesn't clear `keys` (the consumed space is flipped manually at engine.ts:242).

## PhysicsSystem (physics-system.ts, 205 lines)

**Purpose:** Non-collision motion and timers: bullets, particles (drag + gravity), UFO spawn/move/despawn, power-up fall, screen shake, cooldowns, bomb, alien-vs-shield damage, player invulnerability. Class with its own shake state.

**Key methods**

- `triggerShake(intensity, duration)` (physics-system.ts:18) — takes the **max** of current vs new values (physics-system.ts:19-20); never weakens an active shake.
- `updateShake(dt)` (physics-system.ts:23) — exponential decay `0.9^(dt/targetDt)`; random offsets ±intensity; snaps to zero when duration expires or intensity < 0.1 (physics-system.ts:29-34).
- `updateUFO(g, dt)` (physics-system.ts:54) — counts down `ufoTimer`; spawns at an off-screen edge with random direction (physics-system.ts:57-60); despawns past `width ± 50` and re-arms the timer (physics-system.ts:67-71).
- `updateBullets(g, moveScale)` (physics-system.ts:76) — reverse-iterates; pushes trail point (capped at 7 for player, 4 for alien via `shift`, physics-system.ts:81-84); removes bullets beyond ±20 off-canvas (physics-system.ts:85-87).
- `spawnPlayerBullet(g)` (physics-system.ts:92) — centered on the player, includes the spawn point in the trail.
- `updateParticles(g, moveScale)` (physics-system.ts:108) — caps first, then per particle: `flash` type is static; others get drag `0.97^moveScale` (113), gravity `+0.06*moveScale` (116), motion, life decay `lifeDecayPerFrame` (120), `swapRemove` at death.
- `enforceParticleCap(g)` (physics-system.ts:126) — truncates the array to `maxCount` (500). Called in `updateParticles`, `applyBomb`, and by the engine after death processing.
- `updatePowerUps(g, moveScale)` (physics-system.ts:133) — fall by `dy*moveScale`; remove below canvas + 20.
- `damageShieldsWithAliens(g)` (physics-system.ts:144) — alien bottom reaching `groundY` → `setGameOver` (guarded, so double-invocation from `checkAlienReachedPlayer` is safe); otherwise damage the bottom 4px strip of any overlapping shield (`damageShieldRect(s, a.x, a.y + a.h - 4, a.w, 4)`, physics-system.ts:154).
- `applyBomb(g)` (physics-system.ts:161) — kills **all** alive aliens instantly (score + particles per alien, no death-flash), clears all alien bullets, resets alien movement state, re-caps particles.
- `updatePlayerInvulnerability` / `updateCooldowns` (physics-system.ts:191, 197) — `Math.max(0, t - dt)` clamping, cooldown for player, rapidFire, and shield power-ups.

**Test coverage:** `physics-system.test.ts` — **33 tests**: shake default/trigger/decay/expiry (14-42), UFO timer/spawn/move/despawn/no-respawn (52-83), bullet motion/offscreen-removal/trail caps (93-121), spawnPlayerBullet position (149), bomb kills + bullet clear (164-179), power-up fall/removal (191-209), cooldown clamping incl. no-underflow guards (229-271), invulnerability decrement (282), particle gravity/drag/flash-static/caps (291-387), `damageShieldsWithAliens` empty-state tolerance (410).

**Observations:** Solid and thoroughly tested. `triggerShake`'s max-semantics mean a low-intensity shake during a big one is dropped (intended). Bomb intentionally bypasses the dying/pendingScore pipeline — instant kill, no flash. Particle caps are enforced at every particle source, which is defensive but slightly scattered.

## CollisionSystem (collision-system.ts, 105 lines)

**Purpose:** Collision predicates + hit side-effects. Stateless class; marks `dyingAt` + `pendingScore` (awards are deferred to the death-animation handler).

**Key methods**

- `checkBulletPlayerCollision(bullet, player)` (collision-system.ts:19) — false while `player.invulnerable > 0`.
- `checkBulletAlienCollision(bullet, alien, state)` (collision-system.ts:24) — skips dead/dying aliens; on hit: `dyingAt = now`, `pendingScore = ALIEN_POINTS[type]` (30/20/10), and 10% chance (`powerUp.spawnChance`) to drop a 20×20 power-up at the alien's center (collision-system.ts:36-48).
- `checkBulletUFOCollision(bullet, ufo, state)` (collision-system.ts:52) — random points from `ufo.points` [50, 100, 150, 300]; marks dying; **clears all power-ups** (`state.powerUps = []`, collision-system.ts:62).
- `checkPlayerBulletShield(bullet, shield, state)` (collision-system.ts:66) — bounding-box overlap, `damageShieldRect`, spawns shield-colored particles + white impact flash (cap-guarded, collision-system.ts:81-98).
- `checkPowerUpCollision(powerUp, player)` (collision-system.ts:102) — plain AABB.

**Test coverage:** `collision-system.test.ts` — **19 tests**: dead/overlap/hit + per-type pendingScore (22-61), power-up spawn chance with 10%-rate statistical test (69-91), invulnerability + overlap player collision (107-119), UFO null/miss/hit + power-up clear (127-141), shield damage + particles (159-176), power-up pickup (194-200).

**Observations:** Well-isolated and deterministic except for the RNG. Note the UFO-kill power-up wipe is a _global_ clear (drops everything on the field), not just the UFO's own drops — likely intentional risk/reward but easy to miss. Alien score is deferred via `pendingScore`; UFO score is applied immediately at collision-system.ts:60.

## LevelSystem (level-system.ts, 196 lines)

**Purpose:** Difficulty config, alien formation movement (step/drop/edge-reversal), bottom-row shooter selection, shooting cadence, level-complete respawn.

**Key methods**

- `getLevelConfig(level)` (level-system.ts:7) — levels 1-4 are handcrafted (grid→staggered→diamond→compact with escalating speed/shot-rate/bullet-speed/startY, level-system.ts:9-39). Level ≥ 5 is **deterministic**: formation cycles through 5 types via `(level-1) % 5`, `speedMultiplier = min(4, 2.0 + (level-5)*0.3)`, `shootIntervalMultiplier = max(0.4, 1.0 - (level-1)*0.1)`, `enemyBulletSpeed = min(12, 4 + (level-1)*1.5)`, `startY = min(200, 80 + (level-1)*15)` (level-system.ts:41-54).
- `checkLevelComplete(g)` (level-system.ts:58) — waits for active alien death animations, then when `aliveAliens` is empty: `level++`, announce timer 2000ms, respawn formation, reset movement state, `ufoTimer = 2000` (level-system.ts:71). Returns whether a new level started.
- `getAlienStepInterval(g)` (level-system.ts:78) — speed-up as aliens die: `(total / max(1, active))^1.6` capped at 8, then `max(80, 700 / (1 + factor)) / speedMultiplier`.
- `moveAliens(g, dt)` (level-system.ts:92) — accumulates `alienStepTimer`; on step: toggles `alienFrame` (2-frame anim), applies the pending drop (from a previous edge hit) to all aliens, moves everyone by `stepX * dir`, and flips `dir` + sets `alienMoveDown` when any alien hits `x <= 15 || x + w >= width - 15`. Classic edge-then-drop-on-next-step behavior.
- `checkAlienReachedPlayer(g)` (level-system.ts:128) — any alive alien bottom ≥ `groundY` → `setGameOver`.
- `spawnAlienBullet(g)` (level-system.ts:138) — groups alive aliens into columns via `round(x / 10)`; picks the lowest alien per column; randomly selects one column's shooter; `dy = enemyBulletSpeed + random * 2`.
- `updateAlienShootingTimer(g, dt)` (level-system.ts:180) — interval = `max(200, aliveCount * 25) * shootIntervalMultiplier`; when timer hits 0 the engine fires a bullet (engine.ts:178-180) and the timer resets here.

**Test coverage:** `level-system.test.ts` — **15 tests**: level-complete true/false branches (66-73), alien-reaches-ground gameover (86-94), bullet spawn empty/valid (103-110), shooting timer decrement/reset/no-aliens (121-138), plus regression tests for single-decrement and waiting for death animations. `getLevelConfig` scaling formulas are untested directly.

**Observations:** `getLevelConfig` is deterministic and infinite-level-safe, but `configs[level - 1]` would return `undefined` for `level <= 0` (unreachable — level starts at 1 and only increments). Column bucketing with `round(x/10)` is approximate for wide aliens but visually consistent. Movement and shooting are split across three methods invoked in strict order by the engine — order is load-bearing.
