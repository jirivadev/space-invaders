# Technical Recommendations — Space Invaders

> Phase 3 deliverable. Date: 2026-07-31
> Prioritized improvement roadmap. Issue details & evidence: `technical-issues.md`.
> Recommendation T-numbers reference `technical-issues.md` (T-1 … T-10).

## Roadmap Overview

| Tier                                          | Items                                                                              | Effort   | Value                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | -------- | --------------------------------------- |
| **Tier 1 — Quick wins (complete)**            | T-1 fix, T-2 fix, T-5 dep cleanup                                                  | complete | Fixes 2 real bugs + removes dead weight |
| **Tier 2 — Correctness & tooling (complete)** | T-3 swept collision, T-6 pre-commit gate, T-8 rendering tests, T-7 `now` threading | complete | Robustness + safety net                 |
| **Tier 3 — Polish (complete)**                | T-4 HUD decision, T-9 colors, T-10 vitest config                                   | complete | Maintainability                         |

---

## Tier 1 — Quick Wins

### ✅ R-1. Fix T-1: level-clear final alien pays 0 points

**Implemented**: `checkLevelComplete` waits for active alien death animations before
replacing the formation, allowing `processDeathAnimations` to pay the deferred score.

Regression coverage in `death-animation-handler.test.ts` verifies the final alien's
score is retained when the level advances.

---

### ✅ R-2. Fix T-2: stale bullet reference after shield hit

**Implemented**: A shield hit returns immediately after removing the bullet, so alien/UFO
checks cannot reuse a stale reference.

Regression coverage verifies a non-last shield hit cannot kill an alien or remove a
different bullet.

---

### ✅ R-3. Remove 7 unused runtime dependencies

Completed. `@types/node` is now a dev dependency and tests/build pass.

---

## Tier 2 — Correctness & Tooling

### ✅ R-4. Resolve bullet tunneling (T-3)

Completed with swept vertical bullet collision: bullets capture their previous position
before movement, and collision checks cover the full path through shields, aliens, UFOs,
and the player. `MAX_DT` remains a frame-time safeguard rather than a correctness fix.

### ✅ R-5. Restore the pre-commit gate (T-6)

Completed with `.husky/pre-commit` running `npx lint-staged`. Staged TypeScript files
also run related Vitest tests through `.lintstagedrc`.

### ✅ R-6. Add direct tests for rendering modules and components (T-8)

Added direct tests for the rendering systems and supporting React components, in addition
to the existing handler coverage:

1. `bullet-collision-handler.test.ts` — collision orchestration, shield/alien/UFO priority, alien-bullet player-hit paths (shields absorb, lives, invulnerability, game-over).
2. `death-animation-handler.test.ts` — deferred score payout, explosion spawn, `setGameOver` after player death, **level-clear interaction (R-1 regression)**.
3. `rendering-system.test.ts` — canvas state cleanup and representative entity/effect rendering.
4. `ui-rendering.test.ts` — HUD, announcements, menu, game-over, and name-entry branches.
5. `src/components/components.test.ts` — ControlsHint and PowerUpBanner markup via static rendering.

### ✅ R-7. Thread `now` through collision paths (T-7)

Implemented by threading the engine's per-frame `now` through collision, death-marking, and screen-transition paths. Collision tests now inject timing directly.

---

## Tier 3 — Polish

### ✅ R-8. Decide the HUD story (T-4)

Implemented the retro route: `UIRenderingSystem.drawHUD` remains the single HUD source of truth and the duplicate `HUD.tsx` component was removed. The `onUIChange` bridge remains for the other React status UI.

### ✅ R-9. Consolidate inline colors (T-9)

Implemented with an `EFFECT_COLORS` palette in `config.ts`; production inline effect colors now reference the centralized palette with zero behavior change.

### ✅ R-10. Add an explicit Vitest config (T-10)

Added a `test` block to `vite.config.ts` documenting the intent:

```ts
test: {
  environment: "node",
  include: ["src/**/*.test.ts"],
}
```

The explicit config documents the testing surface and `npm test` remains green (244 tests across 13 files).

---

## Suggested Fix Order (if implementing)

1. **R-3** (deps) + **R-2** (stale bullet) — 30 min, isolated, low risk.
2. **R-1** (level-clear score) + regression tests — 30 min; highest player-facing value.
3. **R-6** (tests for the two handler modules) — locks in R-1/R-2.
4. **R-5** (hook) + **R-4** (maxDt) — 15 min each.
5. **R-7 / R-8 / R-9 / R-10** — complete.

After each step: `npm run build && npm test`.

---

## What NOT to Do (recommendations against)

- **Do not** introduce an immutable-state library or a full ECS framework — the mutable pipeline is deliberate, performant, and small; the cost/benefit doesn't favor a rewrite.
- **Do not** move game logic into React components or hooks — the framework-free core is what makes the logic testable.
- **Do not** split the single-file build into multi-asset — the whole point is deployable-as-one-HTML.
