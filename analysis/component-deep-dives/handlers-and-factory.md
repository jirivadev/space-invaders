# handlers-and-factory.md

Component deep-dive: bullet-collision-handler.ts, death-animation-handler.ts, entity-factory.ts (src/game/system/).

## bullet-collision-handler.ts (148 lines)

**Purpose:** Orchestrates the frame's bullet-vs-world collisions. Free function `handleBulletCollisions` that iterates bullets in reverse and dispatches to owner-specific helpers, mutating `GameState` directly.

**Key methods**

- `handleBulletCollisions(g, { collisionSystem, physicsSystem })` (bullet-collision-handler.ts:19) — reverse loop over `g.bullets`; player-owned bullets → `handlePlayerBulletCollisions`, alien-owned → `handleAlienBulletCollision` (bullet-collision-handler.ts:26-42). A truthy return means the bullet was consumed and the loop `continue`s.
- `handlePlayerBulletCollisions` (bullet-collision-handler.ts:46) — priority order **shield → alien → UFO**:
  1. **Shield:** `checkPlayerBulletShield`; shake(2, 65); `swapRemove`; then the `if (!g.bullets[i]) return true` guard (bullet-collision-handler.ts:61) — catches the case where the removed bullet was the last array element (swapRemove shortens the array), preventing stale-index access.
  2. **Alien:** `checkBulletAlienCollision`; shake(4, 130); yellow impact flash `#fef08a`; remove bullet; return.
  3. **UFO:** `checkBulletUFOCollision`; remove bullet; return.
     Returns false when no hit — bullet survives to the next frame.
- `handleAlienBulletCollision` (bullet-collision-handler.ts:89) — player hit: with an active shield power-up, only blue particles + flash are spawned and the bullet dies (bullet-collision-handler.ts:99-118). Otherwise: `lives--`, invulnerability set to 2000ms, shake(5, 130), bullet removed; if `lives <= 0` → shake(8, 250) + `player.diedAt = now` (game over is _deferred_ to the death-animation handler); else a 50-particle cyan explosion + red flash at the player (bullet-collision-handler.ts:125-145).

**Logic notes / edge cases**

- Bullet removal always uses `swapRemove`, which can pull an unprocessed (earlier-index) bullet into slot `i`; the guard + reverse iteration make this safe — a swapped-in bullet was already processed this frame.
- Player bullets are removed by the first matching target in priority order; a bullet that hits a shield never also damages the alien behind it.
- Invulnerability is checked inside `checkBulletPlayerCollision`, so alien bullets pass through harmlessly during the 2s post-hit window (but shield particles still spawn only on real hits).

**Test coverage:** **No dedicated test file.** The behaviors are exercised only indirectly via `engine.test.ts` smoke tests and the `CollisionSystem` unit tests. The shield-power-up absorb branch, the lives→death deferral, and the swapRemove guard have no direct tests.

**Observations:** Clear priority structure, but several hardcoded hex colors (bullet-collision-handler.ts:71, 104, 112, 141) instead of `COLORS` — minor drift risk. The `if (!g.bullets[i]) return true` idiom is subtle and would benefit from a comment. This is the highest-risk untested file in the collision pipeline.

## death-animation-handler.ts (75 lines)

**Purpose:** Converts expired `dyingAt` states into explosions, deferred score awards, and the player game-over transition. Called once per frame from the engine (engine.ts:201).

**Key methods**

- `processDeathAnimations(g, now)` (death-animation-handler.ts:11) — runs three sub-processors with `now` = `performance.now()` passed from the engine.
- `processDyingAliens` (death-animation-handler.ts:17) — for each alien with `dyingAt > 0` and elapsed ≥ `death.alienDuration` (150ms): **awards `pendingScore` now** (set earlier by the collision system), marks `alive = false`, resets `dyingAt = 0`, spawns 40 colored explosion particles. Reverse iteration + `alive=false` (not removal) keeps array indices stable.
- `processDyingUFO` (death-animation-handler.ts:38) — after 150ms: 40-particle explosion in `COLORS.ufo`, `ufo = null`.
- `processPlayerDeath` (death-animation-handler.ts:53) — after 300ms: 50-particle cyan explosion + red impact flash, `diedAt = 0`, then `setGameOver(g)` (which routes to `nameEntry` on a new high score).

**Logic notes / edge cases**

- Score deferral is deliberate: the death flash plays (~150ms) before points land, matching classic pacing. UFO score, by contrast, is added immediately at collision time (collision-system.ts:60).
- `setGameOver` is guarded (`status !== "playing"` returns), so overlapping death signals (alien reaches ground + player dies same frame) cannot double-transition.
- Dying aliens remain in `g.aliens` with `alive === true` until expiry; the rendering system shows them as white shrinking flashes via `computeDeathAnimation` (rendering-system.ts:111-129), and the caches exclude them via `dyingAt === 0` checks (state-manager.ts:116).

**Test coverage:** **No dedicated test file.** `pendingScore` timing, explosion counts, and the player-death → `setGameOver` transition are only covered transitively by engine-level smoke tests.

**Observations:** Compact and correct. `now` as a parameter (rather than reading `performance.now()` internally) is test-friendly, but no tests exploit it yet. The "explosion then setGameOver" sequencing means the game-over screen appears the same frame the player explosion spawns — visually the explosion can be hidden by the overlay fade-in (acceptable, arguably intended).

## entity-factory.ts (313 lines)

**Purpose:** Pure entity constructors: formation grids, shields (pixel masks), starfields, UFOs, particle bursts, and shield damage.

**Key methods**

- `createFormationGrid(rows, colsOrFn, spacingX, spacingY, rowStartX, offsetX, rowTypes, startY, scale)` (entity-factory.ts:14) — generic grid builder; supports per-row column counts and per-row x-offsets (the hooks that make staggered/diamond formations possible). Sprite size derived from the pattern dimensions × scale.
- `createShield(x, y)` (entity-factory.ts:48) — 24×16 boolean pixel grid; arch cutouts hardcoded: rows ≥ 10 with cols 8-15 dead, rows ≥ 13 with cols 6-17 dead (entity-factory.ts:58-59).
- `createAliens(formation = "grid", startY = 80)` (entity-factory.ts:67) — five formations, all sharing rowTypes `[squid, crab, crab, octopus, octopus, octopus]` (entity-factory.ts:72-79):
  - **grid** (default): 5 rows × 11 cols, spacing 48/40, x0=80 (entity-factory.ts:141-151).
  - **staggered**: 11 cols, even rows offset +24 (spacingX/2) (entity-factory.ts:83-95).
  - **diamond**: cols [5,3,1,3,5], x-centered via `baseX = (width - 4*48)/2` (entity-factory.ts:97-112).
  - **compact**: 4 × 8, spacing 36/32, x0=120 (entity-factory.ts:114-125).
  - **wide**: 6 × 13, spacing 40/35, x0=65 (entity-factory.ts:127-138).
- `createStars()` (entity-factory.ts:156) — 3 parallax layers (50/30/15 stars) from `STAR_LAYERS`; random position/size/phase.
- `createUFO()` (entity-factory.ts:175) — from `SPRITES.ufo`; spawns at `x = -w` (left edge); direction/speed set by physics-system.
- `createExplosionParticles(x, y, color, count)` (entity-factory.ts:190) — stochastic mix via random `t`: 20% **spark** (brightened color, size 1, fast, short-lived), 30% **debris** (darkened 0.45×, size 3-5, slow, long-lived), 50% **fire** (base color, mid params) (entity-factory.ts:209-227). Appends one white `flash` particle when `count >= 8`, radius `15 + sqrt(count)*4` (entity-factory.ts:242-255).
- `createImpactFlash(x, y, color, size)` (entity-factory.ts:260) — single static flash, life 60.
- `damageShieldRect(shield, x, y, w, h)` (entity-factory.ts:279) — converts a world-space rect to clamped shield-pixel coordinates, clears alive pixels, returns whether anything was hit. Out-of-bounds and zero-size rects are handled by the clamp + bounds check (entity-factory.ts:286-295).

**Test coverage:** `entity-factory.test.ts` — **26 tests** (5×5 = 10 generated for formations via the `for...of` loop at entity-factory.test.ts:190-204, plus direct tests): `damageShieldRect` center/out-of-bounds/negative-coords/zero-size/only-alive (27-84), particle counts + flash threshold at count 8 and 10 (103-111), particle property validity (113-127), flash inclusion rules (129-142), `createShield` dims/arch cutouts (146-178), `createAliens` non-empty + alive per formation (191-204), field validity + default-formation (206-225).

**Observations:** Well-factored and the best-covered of the three. `createStars` and particle bursts are non-deterministic (fine for visuals, awkward for snapshot tests — tests wisely assert structure, not positions). The arch cutout coordinates are magic numbers with a clarifying test comment. `createFormationGrid`'s 8-parameter signature is the main complexity cost, but it cleanly unifies five formations.
