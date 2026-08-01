# Technical Issues — Space Invaders

> Phase 2 deliverable. Date: 2026-07-31
> Sources: full source review + agent verification sweeps + test baseline (244 passing).

Priority key: 🔴 High (fix first) · 🟠 Medium · 🟡 Low · ⚪ Informational

---

## ✅ T-1: Final alien kill of every level awards 0 points (RESOLVED)

**Severity**: 3/5 — previously user-visible, reproduced on **every level clear**.
**Files**: `src/game/engine.ts` (frame order), `src/game/system/level-system.ts:58-75`, `src/game/system/death-animation-handler.ts:17-36`, `src/game/system/collision-system.ts:32-33`

**Root cause** — frame-order race in `_update()`:

1. `checkLevelComplete` runs at engine.ts:170, _before_ `handleBulletCollisions` (engine.ts:186). The last alien is still alive → level not cleared.
2. `handleBulletCollisions` kills the last alien: `dyingAt` + `pendingScore` set, but score is **deferred** until the 150 ms death animation completes (death-animation-handler.ts:21-24).
3. End-of-frame `refreshAlienCaches` (engine.ts:207) drops the dying alien from `aliveAliens`.
4. Next frame: `checkLevelComplete` sees `aliveAliens.length === 0` → replaces `g.aliens` with the new formation (level-system.ts:63-66), **discarding the dying alien, its `pendingScore`, and its explosion** before `processDyingAliens` ever runs.

**Impact**: The final alien of each level contributes no points and shows no death flash. `ALIEN_POINTS` (30/20/10) is only awarded via this deferred path (verified: no alternate awarding path exists) — so the loss is permanent.

**Resolution**: `LevelSystem.checkLevelComplete` now waits while any alien has an active
`dyingAt` timestamp. `processDeathAnimations` pays the deferred score and clears the
animation before the formation is replaced. Regression coverage verifies the final
alien's score is retained during level clear.

---

## ✅ T-2: Stale bullet reference after shield collision (RESOLVED)

**Severity**: 3/5 — situational but real; wrong gameplay outcomes.
**Files**: `src/game/system/bullet-collision-handler.ts:54-61`, `src/game/utils.ts:6-12`

**Root cause**: In `handlePlayerBulletCollisions`, after a shield collision:

```ts
swapRemove(g.bullets, i);   // line 57
break;
}
if (!g.bullets[i]) return true;  // line 61 — only catches "i was last index"
```

The guard checks **position**, not identity. When `i` is not the last index, `swapRemove` has moved the already-processed last bullet into slot `i` → guard passes → the alien loop (line 64) runs with the **stale removed bullet**. Consequences:

- **Phantom alien kill**: a shield-spent bullet can still kill an alien that descended to shield depth (y ≈ 440-480, late-level), with a free 10% power-up roll.
- **Wrongful bullet removal**: the follow-up `swapRemove(g.bullets, i)` (line 75) silently deletes a _different_, already-processed bullet that was swapped in — player shots visibly vanish.

**Reachability**: needs ≥2 bullets in flight (rapid-fire makes this the norm) + aliens near shield line. No crash, no array corruption.

**Resolution**: The shield branch now returns immediately after `swapRemove`, so alien/UFO
checks never run with the removed bullet reference. Regression coverage verifies that a
non-last shield hit leaves the other bullets intact and cannot kill an alien.

---

## ✅ T-3: Bullet tunneling at low FPS / background tab (RESOLVED)

**Severity**: 3/5 — conditional (devices dropping below ~20 FPS).
**Files**: `src/game/config.ts:33` (`MAX_DT = 50`), `src/game/engine.ts:120`, `src/game/physics-system.ts:76-89`

**Root cause**: Before mitigation, `dt` was clamped to 100 ms → `moveScale` up to 6×.
A player bullet (12 px tall, -9 px/frame) could move **~54 px in one frame**.

**Resolution**: Bullets now capture `previousY` before movement. Collision checks use a
vertically swept bullet rectangle for shields, aliens, UFOs, and the player, preserving
the existing strict rectangle-overlap semantics and collision priority. `MAX_DT` remains
as a frame-time safeguard, but collision correctness no longer depends on its value.

**Regression coverage**: Focused tests cover fast passes through each collision target and
the strict edge-overlap behavior.

---

## ✅ T-4: HUD rendered twice (RESOLVED)

**Severity**: 2/5 — maintainability + divergence risk.
**Files**: `src/game/system/ui-rendering.ts:15-35` (`drawHUD`), `src/App.tsx`

**Observation**: The canvas HUD previously duplicated the score, level, high score, and lives shown by a React DOM component. Both updated during play and could drift.

**Options**:

**Resolution**: The duplicate React DOM HUD was removed. `UIRenderingSystem.drawHUD` is now the single source of truth, while `onUIChange` continues to drive the remaining React status UI.

---

## ✅ T-5: Unused runtime dependencies in package.json (RESOLVED)

**Severity**: 2/5 — hygiene; ~7 packages never imported.
**Files**: `package.json:14-23`

Confirmed **zero imports in `src/`** for: `@modelcontextprotocol/sdk`, `@modelcontextprotocol/server-filesystem`, `brace-expansion`, `diff`, `glob`, `minimatch`, `zod`. The two MCP packages look like leftover experiment deps. Also: `@types/node` sits in `dependencies` (should be `devDependencies`).

**Resolution**: The seven unused runtime dependencies were removed and `@types/node`
was moved to `devDependencies`. The dependency tree, tests, and production build were
verified afterward.

---

## ✅ T-6: AGENTS.md documents a pre-commit test gate that does not exist (RESOLVED)

**Severity**: 2/5 — docs vs. reality mismatch.
**Files**: `AGENTS.md`, `.lintstagedrc`, `.husky/pre-commit`

**Resolution**: `.husky/pre-commit` runs `npx lint-staged`; `.lintstagedrc` formats
staged files and runs related Vitest tests for staged TypeScript files. `AGENTS.md`
documents this current behavior.

---

## ✅ T-7: `performance.now()` used inconsistently (RESOLVED)

**Severity**: 1/5 — testability & consistency.
**Files**: `engine.ts` computes the frame timestamp; collision, death, and state-transition systems receive it as `now`.

The engine's per-frame `now` is now threaded through collision, death-marking, and screen-transition paths, making timing deterministic without clock fakes.

---

## ✅ T-8: Missing direct tests for rendering modules and components (RESOLVED)

**Severity**: 2/5 — coverage gap.
**Files**: `rendering-system.ts`, `ui-rendering.ts`, and the React status components.

**Resolution**: Direct tests now cover the rendering systems' canvas behavior and the
ControlsHint/PowerUpBanner markup using static server rendering, with no new dependencies.

---

## ✅ T-9: Inline color strings vs. COLORS palette (RESOLVED)

**Severity**: 1/5 — DRY.
**Files**: `rendering-system.ts` (ground `#334155`, thrust `#f97310` region, shield aura `#3b82f6`, death flash `#ffffff`, glow colors), `ui-rendering.ts`, `bullet-collision-handler.ts`

Inline effect colors are now centralized in `EFFECT_COLORS` alongside the base `COLORS` palette.

---

## ✅ T-10: No Vitest config file (RESOLVED)

**Severity**: 1/5 — discoverability.
**Resolution**: `vite.config.ts` now explicitly sets the Node test environment and includes `src/**/*.test.ts`, documenting the intended test surface.

---

## Summary

| ID   | Issue                                                        | Severity | Type     |
| ---- | ------------------------------------------------------------ | -------- | -------- |
| T-1  | Level-clear kill awards 0 points (every level)               | ✅       | Resolved |
| T-2  | Stale bullet ref after shield hit → phantom kills/lost shots | ✅       | Resolved |
| T-3  | Bullet tunneling at low FPS (maxDt=50ms)                     | ✅       | Resolved |
| T-4  | HUD duplicated canvas+DOM                                    | ✅       | Resolved |
| T-5  | 7 unused runtime deps                                        | ✅       | Resolved |
| T-6  | Missing pre-commit test gate (docs lie)                      | ✅       | Resolved |
| T-7  | Inconsistent `performance.now()`                             | ✅       | Resolved |
| T-8  | Untested rendering modules                                   | ✅       | Resolved |
| T-9  | Inline colors vs. COLORS palette                             | ✅       | Resolved |
| T-10 | No explicit Vitest config                                    | ✅       | Resolved |

**Verified healthy**: StrictMode double-mount (no leaks), high-score cache (fine single-tab), keys-map growth (bounded), localStorage error handling (all try/catch), zero TODO/FIXME/debug leftovers, no stale backup files, dist properly gitignored.
