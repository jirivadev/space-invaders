# Technical Recommendations — Space Invaders

> Phase 3 deliverable. Date: 2026-07-31
> Prioritized improvement roadmap. Issue details & evidence: `technical-issues.md`.
> Recommendation T-numbers reference `technical-issues.md` (T-1 … T-10).

## Roadmap Overview

| Tier                               | Items                                                              | Effort    | Value                                   |
| ---------------------------------- | ------------------------------------------------------------------ | --------- | --------------------------------------- |
| **Tier 1 — Quick wins (do first)** | T-1 fix, T-2 fix, T-5 dep cleanup                                  | ~1-2 h    | Fixes 2 real bugs + removes dead weight |
| **Tier 2 — Correctness & tooling** | T-3 tunneling, T-6 pre-commit gate, T-8 tests, T-7 `now` threading | ~half day | Robustness + safety net                 |
| **Tier 3 — Polish**                | T-4 HUD decision, T-9 colors, T-10 vitest config                   | ~2-3 h    | Maintainability                         |

---

## Tier 1 — Quick Wins

### R-1. Fix T-1: level-clear final alien pays 0 points 🔴

**Bug**: `checkLevelComplete` (engine.ts:170) runs before collisions (engine.ts:186); the last alien's deferred `pendingScore` is lost when the formation is replaced next frame.

**Recommended fix** (Option B — minimal, correct):
In `engine._update`, move `processDeathAnimations(g, now)` **before** `checkLevelComplete`. Verify ordering still satisfies the death pipeline (explosion timing shifts one frame earlier — visually identical).

**Alternative** (Option C — robust, immune to ordering): in `checkLevelComplete`, before replacing `g.aliens`, sweep `g.aliens` and pay out any `pendingScore` + spawn explosions:

```ts
for (const a of g.aliens) {
  if (a.pendingScore) {
    g.score += a.pendingScore;
    g.particles.push(
      ...createExplosionParticles(
        a.x + a.w / 2,
        a.y + a.h / 2,
        COLORS[a.type],
        40
      )
    );
    a.pendingScore = 0;
  }
}
```

**Regression test**: kill the last alien, run 2 frames, assert `score` increased by `ALIEN_POINTS[type]` AND `level` incremented.

---

### R-2. Fix T-2: stale bullet reference after shield hit 🔴

**Bug**: `bullet-collision-handler.ts:61` `if (!g.bullets[i]) return true` checks position, not identity → stale bullet can phantom-kill aliens or wrongly remove a different bullet.

**Fix** — return immediately on shield hit (the bullet is consumed; alien/UFO checks must never follow):

```ts
if (collisionSystem.checkPlayerBulletShield(bullet, s, g)) {
  physicsSystem.triggerShake(2, 65);
  swapRemove(g.bullets, i);
  return true; // ← delete the `if (!g.bullets[i])` guard below
}
```

Delete line 61 entirely (no longer needed).

**Regression test**: 2+ bullets in flight, one hits a shield at non-last index → assert no alien marked dying and the second bullet still present in `g.bullets`.

---

### R-3. Remove 7 unused runtime dependencies 🟡

```bash
npm uninstall @modelcontextprotocol/sdk @modelcontextprotocol/server-filesystem \
  brace-expansion diff glob minimatch zod
npm install -D @types/node    # move from dependencies to devDependencies
```

Verify: `npm test` (209) + `npm run build`. If anything actually imports these later, reinstall.

---

## Tier 2 — Correctness & Tooling

### R-4. Mitigate bullet tunneling (T-3) 🟠

Cheapest effective change: lower `MAX_DT` from 100 → **50 ms** in `config.ts` (halves max bullet step to ~27 px; still > 24 px alien hitbox but the window shrinks dramatically). If you want zero tunneling, add **collision substepping** in `physics-system.updateBullets` + `handleBulletCollisions` (split dt > 16.67 into N steps) or swept segment-rect intersection for bullets. Substepping is the general solution and also fixes player-bullet-through-shield cases.

### R-5. Restore the pre-commit gate (T-6) 🟡

AGENTS.md documents `prettier` + `npm run test` on commit; reality is prettier only, with **no hook installed**.

```bash
npx husky init                      # creates .husky/pre-commit
# .husky/pre-commit:
#   npx lint-staged
# .lintstagedrc:
#   { "*": "prettier --ignore-unknown --write", "*.{ts,tsx}": "npm test -- --run" }
```

Now AGENTS.md becomes truthful and commits get a test gate.

### R-6. Add direct tests for untested modules (T-8) 🟡

Highest value first (both are logic-heavy and were the source of the real bugs):

1. `bullet-collision-handler.test.ts` — collision orchestration, shield/alien/UFO priority, alien-bullet player-hit paths (shields absorb, lives, invulnerability, game-over).
2. `death-animation-handler.test.ts` — deferred score payout, explosion spawn, `setGameOver` after player death, **level-clear interaction (R-1 regression)**.
3. `rendering-system.test.ts` / `ui-rendering.test.ts` — smoke tests via the mock-2D-context pattern from `engine.test.ts` (assert draw calls, no throws).
4. Components (`HUD`, `PowerUpBanner`, `ControlsHint`) — trivial; only add if you adopt a DOM test setup.

### R-7. Thread `now` through collision paths (T-7) ⚪

Replace direct `performance.now()` calls in `collision-system.ts:32,46,61`, `bullet-collision-handler.ts:127`, `state-manager.ts:99,112,122` with a `now` parameter passed from the engine (which already computes it once per frame). Makes collision tests deterministic without fakes.

---

## Tier 3 — Polish

### R-8. Decide the HUD story (T-4) 🟡

Pick one source of truth:

- **Retro route**: keep canvas `UIRenderingSystem.drawHUD`, delete `HUD.tsx` (and its `onUIChange` usage stays for score persistence only). Game looks self-contained.
- **Accessibility route**: keep DOM `HUD.tsx`, remove `drawHUD` from `ui-rendering.ts`. DOM text is selectable/readable.
- **Both (documented)**: add a comment noting intentional duplication; add a test asserting both receive the same values.

Recommendation: **remove the DOM HUD** — canvas is the game's identity; fewer moving parts.

### R-9. Consolidate inline colors (T-9) ⚪

Add an `EFFECT_COLORS` (or extend `COLORS`) in `config.ts` for: ground line `#334155`, thrust `#f97316`/`#facc15`, shield aura `#3b82f6`, impact flashes (`#fef08a`, `#fca5a5`, `#93c5fd`), bullet glows, death flash `#ffffff`. Mechanical find-replace; zero behavior change.

### R-10. Add an explicit Vitest config (T-10) ⚪

Add a `test` block to `vite.config.ts` (or a `vitest.config.ts`) documenting the intent:

```ts
test: {
  environment: "node",
  include: ["src/**/*.test.ts"],
}
```

Explicit config survives dependency upgrades and documents the testing surface. Verify `npm test` still green.

---

## Suggested Fix Order (if implementing)

1. **R-3** (deps) + **R-2** (stale bullet) — 30 min, isolated, low risk.
2. **R-1** (level-clear score) + regression tests — 30 min; highest player-facing value.
3. **R-6** (tests for the two handler modules) — locks in R-1/R-2.
4. **R-5** (hook) + **R-4** (maxDt) — 15 min each.
5. **R-7 / R-8 / R-9 / R-10** — as convenient; no runtime risk.

After each step: `npm run build && npm test`.

---

## What NOT to Do (recommendations against)

- **Do not** introduce an immutable-state library or a full ECS framework — the mutable pipeline is deliberate, performant, and small; the cost/benefit doesn't favor a rewrite.
- **Do not** move game logic into React components or hooks — the framework-free core is what makes the logic testable.
- **Do not** split the single-file build into multi-asset — the whole point is deployable-as-one-HTML.
