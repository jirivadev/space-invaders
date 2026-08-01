# rendering-and-support.md

Component deep-dive: rendering-system.ts, ui-rendering.ts, rendering-math.ts, renderer-utils.ts, geometry.ts, leaderboard.ts, utils.ts, test-utils/factory.ts, config.ts.

## RenderingSystem (rendering-system.ts, 391 lines)

**Purpose:** All in-game visual rendering onto the 2D canvas. Stateless class; every method takes `(ctx, ...)` and reads `GAME_CONFIG`/`COLORS`/`SPRITES`. Visual math is delegated to pure functions in rendering-math.ts.

**Key methods**

- `clearCanvas(ctx)` (rendering-system.ts:39) — resets `globalAlpha`/`imageSmoothingEnabled`, fills background.
- `drawStars(ctx, stars, now, dimFactor = 1)` (rendering-system.ts:47) — batches per layer: one `beginPath` for circular stars (size ≥ 2) and one for 1px squares, so 3 layers = 6 fill calls regardless of star count; per-layer twinkle alpha from `computeStarTwinkle`; overlay screens dim to 0.5 (engine.ts:291).
- `drawGround` (rendering-system.ts:84) — single 2px line at `groundY`.
- `drawShields` (rendering-system.ts:94) — delegates to `drawShield`.
- `drawAliens(ctx, aliens, frame, now)` (rendering-system.ts:101) — skips dead-and-not-dying; dying aliens render as a white shrinking flash (`computeDeathAnimation`, rendering-system.ts:111-129); live aliens use 2-frame sprite anim via `alienFrame` (SPRITES vs SPRITES_2).
- `drawUFO(ctx, ufo, now)` (rendering-system.ts:139) — same death-flash pattern; else `SPRITES.ufo`.
- `drawPlayer(ctx, player, invulnerableTime, hasShieldAura, now)` (rendering-system.ts:175) — death branch: `t = elapsed/playerDuration`, scale shrinks `(1 - t*0.3)`, alpha `1 - t`, alternating `death1`/`death2` sprites every 75ms, plus fragments from `computePlayerDeathFragments` (rendering-system.ts:186-221). Invulnerability: sine pulse alpha `0.3 + 0.7*|sin(now*0.012)|` (rendering-system.ts:224-227). Thrust flame drawn _behind_ the ship (2-frame flicker, rendering-system.ts:230-241). Shield aura: 6 rotating dots via `computeShieldAuraDots`, only when shield active and not invulnerable (rendering-system.ts:244-261). Ship last.
- `drawPowerUps(ctx, powerUps, now)` (rendering-system.ts:276) — pulsing glow ring (stroke, alpha from `computePowerUpGlowAlpha`), capsule sprite at scale 2, type letter (R/S/B) from `POWER_UP_VISUALS` (rendering-system.ts:30).
- `drawBullets(ctx, bullets)` (rendering-system.ts:315) — trail entries (`computeBulletTrailEntries`, fading/shrinking), double glow rect (alpha 0.25 then 0.4), core, white highlight. Player bullets yellow, alien red.
- `drawParticles(ctx, particles)` (rendering-system.ts:354) — alpha = `life/maxLife`; flash = two concentric white circles; spark = small rect; debris = centered rect; fire = circle + inner white core.

**Test coverage:** **No dedicated test file** (canvas calls are hard to unit-test); the math was deliberately extracted to rendering-math.ts (55 tests) and sprite drawing to renderer-utils.ts. The death-flash skip-render contract ("will be removed in update", rendering-system.ts:117) is the kind of invariant that only engine tests cover loosely.

**Observations:** Clean layering and heavy batching (stars are the standout). Power-up visuals and pickup particles share the centralized `EFFECT_COLORS` palette. The glow color is built by string concat `glowColor + "1)"` producing e.g. `rgba(250, 204, 21, 1)` (rendering-system.ts:321-334) — fragile but works; `drawBullets` uses `fillStyle` strings derived at render time rather than constants.

## UIRenderingSystem (ui-rendering.ts, 254 lines)

**Purpose:** Overlay screens and HUD: score bar, level announcement, menu (animated title + leaderboard), game-over, name entry.

**Key methods**

- `drawHUD(ctx, score, highScore, lives, level)` (ui-rendering.ts:15) — SCORE left, LEVEL second row, HIGH center, LIVES right; 18px monospace; zero-padded via `formatPaddedScore`.
- `drawLevelAnnouncement(ctx, level, timer)` (ui-rendering.ts:38) — dark overlay + bold 48px "LEVEL n" while `timer > 0` (2000ms).
- `drawMenu(ctx, leaderboard, now)` (ui-rendering.ts:57) — 0.7 overlay; "SPACE INVADERS" title with a diagonal shimmer band swept across via `computeShimmerSweep` + clip (ui-rendering.ts:78-90); player ship sprite at scale 3 with thrust flicker (ui-rendering.ts:92-111); blinking "Press SPACE to start" (`computeBlinkAlpha`); controls hint; leaderboard with gold/silver/bronze row colors and padded name/score columns (ui-rendering.ts:126-147).
- `drawGameOver(ctx, score, now, screenOpenedAt)` (ui-rendering.ts:151) — overlay fades 0→0.75 over 400ms (`computeFadeInAlpha`); "GAME OVER" in ufo red; final score scales 1.3→1.0 over 300ms (`computeScaleUpAnimation`); blinking continue prompt.
- `drawNameEntry(ctx, pendingName, score, now, screenOpenedAt)` (ui-rendering.ts:196) — fade to 0.85; "NEW HIGH SCORE!"; score; input box (30% width × 5% height); name + blinking caret (ui-rendering.ts:241-243); hint text.

**Test coverage:** `rendering-system.test.ts` and `ui-rendering.test.ts` cover representative canvas drawing branches and state cleanup. Pure math remains covered in rendering-math.ts.

**Observations:** Good separation — the only timings/animation inputs come from rendering-math. Title, medal, and thrust colors use the centralized `COLORS`/`EFFECT_COLORS` palettes. `drawMenu` and `drawGameOver` call `ctx.measureText`/`fillText` repeatedly per frame — trivial cost, not cached.

## rendering-math.ts (243 lines) — pure animation math

Side-effect-free helpers extracted from the renderers. All deterministic given inputs (no clock reads).

| Function (line)                                                               | Behavior                                                                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `computeDeathAnimation(dyingAt, now, duration)` (:21)                         | `null` if `dyingAt <= 0`; `isComplete` once `elapsed >= duration`; else linear `t`, `flashScale = flashAlpha = 1 - t`. |
| `computeStarTwinkle(now, offset, minA, maxA)` (:45)                           | `min + (max-min) * 0.5*(1 + sin(now*0.003 + offset))`.                                                                 |
| `computePlayerDeathFragments(centerX, centerY, t, count=4, maxDist=30)` (:60) | Rotating fragments at `t * maxDist`, angle rotates with `t`.                                                           |
| `computeBulletTrailEntries(trail, w, h)` (:91)                                | `r = i/length`; width `max(1, w*(0.3+0.7r))`; alpha `r*0.35` (older = fainter/smaller).                                |
| `computeShimmerSweep(now, textWidth, speed=.12, pad=200, band=80)` (:117)     | `((now*speed) % (textWidth+pad)) - pad/2`, wrapping.                                                                   |
| `computeBlinkAlpha(now, speed=.003, min=.4, max=1)` (:131)                    | `min + (max-min)*                                                                                                      | sin(now*speed) | `.  |
| `computeFadeInAlpha(elapsed, dur=400, max=.75)` (:143)                        | `min(max, elapsed/dur * max)`.                                                                                         |
| `computeScaleUpAnimation(elapsed, dur=300, start=1.3, end=1)` (:160)          | Clamped linear interpolation.                                                                                          |
| `computeShieldAuraDots(cx, cy, w, h, now, count=6)` (:180)                    | Rotating ring of `count` dots, per-dot alpha phase.                                                                    |
| `computeAnimationFrameIndex(now, interval, count=2)` (:203)                   | `floor(now/interval) % count`.                                                                                         |
| `computePowerUpGlowAlpha(now, spawnedAt, speed=.004, min=.3, max=.7)` (:214)  | Spawn-time phase offset.                                                                                               |
| `formatPaddedScore(score, digits=5)` (:231)                                   | `padStart`.                                                                                                            |
| `computeThrustFlicker(now, speed=.02)` (:238)                                 | `sin(now*speed) > 0`.                                                                                                  |

**Test coverage:** `rendering-math.test.ts` — **55 tests**, one suite per function covering ranges, midpoints, clamping, and custom params (e.g., death-animation 6, twinkle 3, trail 7, blink 4, frame-index 5). This is the best-tested module in the codebase.

## renderer-utils.ts (46 lines)

- `drawSprite(ctx, pattern, x, y, scale, color)` (renderer-utils.ts:6) — per-pixel `fillRect` over the string pattern; shared by aliens, player, UFO, power-ups, menu ship.
- `drawShield(ctx, shield)` (renderer-utils.ts:25) — row sweep that merges consecutive alive pixels into one `rect` per run (fewer path segments).

**Test coverage:** none (visual helpers). Note: `drawSprite`'s `fillStyle = color` is set once per call, and `drawShield` batches runs — both are already decently optimized for the entity counts involved.

## geometry.ts (21 lines)

- `rectsOverlap(a, b)` (geometry.ts:3) — strict AABB (no touching-edge overlap). Used by every collision path.
- `hexToRgb(hex)` (geometry.ts:12) — regex parse, `[255,255,255]` fallback on bad input.

**Test coverage:** no dedicated file; `rectsOverlap` (2 tests) and `hexToRgb` (1) live inside `engine.test.ts` describes (engine.test.ts:9-27).

## leaderboard.ts (40 lines)

- `getLeaderboard()` (leaderboard.ts:6) — localStorage read + JSON parse in try/catch; sorts desc; slices to 10 entries.
- `addToLeaderboard(name, score)` (leaderboard.ts:19) — trims name; updates an existing entry **only if the new score beats it** (keeps best score, refreshes date, leaderboard.ts:22-27), else pushes; re-sorts and persists (try/catch for quota).

**Test coverage:** no dedicated file; `getLeaderboard` (4 tests: empty/corrupt/throw/sort) and `addToLeaderboard` (4 tests: add/sort/trim/setItem-error) live in `engine.test.ts` (engine.test.ts:44-176).

## utils.ts (6 lines)

- `swapRemove(array, index)` (utils.ts:6) — O(1) unordered removal: swap with last, pop; bounds-guarded, returns the swapped-in element. The de-facto removal primitive across physics, collision, and engine code. Tested indirectly everywhere; no direct unit tests.

## test-utils/factory.ts (131 lines)

- `createMockState(overrides)` (factory.ts:11) — full default `GameState` (empty aliens/shields/bullets, player at 100/500, all timers 0) with overrides applied last; recomputes `aliveAliens`/`activeAliens` from overridden aliens. Note: `overrides.shields` is NOT fed into the default the way aliens are (shields: [] unless provided).
- `makeBullet` / `makeAlien` / `makePlayer` / `makeUFO` / `makeShield` / `makePowerUp` (factory.ts:56-131) — spread-override builders matching the types in types.ts.

## config.ts (356 lines)

Single source of truth. Notable values: canvas 800×640, `targetDt` 16.67ms, `maxDt` 50ms, groundY 600; shields 24×16 @ 3px, y 480; player 27×21 @ speed 5, cooldown 333ms / rapidFire 120ms; alien step 8 / drop 20, spriteScale 3; UFO y 35, speed 2.5, timer 10-25s, points [50,100,150,300]; power-up duration 8000ms, spawn chance 0.1, fall 2; particle cap 500; death durations alien/UFO 150ms, player 300ms; hit invulnerability 2000ms; level announce 2000ms. `GAME_CONFIG` is `as const` (deeply readonly), `SPRITES`/`SPRITES_2` hold the pixel-art string matrices, `STAR_LAYERS` drives the starfield, `COLORS` is a `satisfies Colors` interface. **Test coverage:** exercised by every other suite via config imports; no dedicated config tests.

## Cross-cutting observations

- Test totals: **244 tests / 13 files, all passing** (`npm test`). Coverage is concentrated in pure logic (rendering-math 55, physics 33, entity-factory 26), with direct rendering-system, UI-rendering, and supporting component coverage now added.
- Rendering design favors O(1) batching (stars) and minimal state (globalAlpha resets) over per-entity save/restore — a consistent, low-risk pattern.
- String-concatenated colors and duplicated color constants are the most common smell; a single `COLORS`-keyed palette or a shared `POWER_UP_VISUALS` module would remove it.
