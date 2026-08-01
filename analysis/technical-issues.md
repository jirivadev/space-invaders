# Technical Issues — Space Invaders

> Phase 2 deliverable. Date: 2026-07-31
> Sources: full source review + agent verification sweeps + test baseline (209 passing).

Priority key: 🔴 High (fix first) · 🟠 Medium · 🟡 Low · ⚪ Informational

---

## 🔴 T-1: Final alien kill of every level awards 0 points (REAL BUG)

**Severity**: 3/5 — user-visible, reproduces on **every level clear**.
**Files**: `src/game/engine.ts` (frame order), `src/game/system/level-system.ts:58-75`, `src/game/system/death-animation-handler.ts:17-36`, `src/game/system/collision-system.ts:32-33`

**Root cause** — frame-order race in `_update()`:

1. `checkLevelComplete` runs at engine.ts:170, _before_ `handleBulletCollisions` (engine.ts:186). The last alien is still alive → level not cleared.
2. `handleBulletCollisions` kills the last alien: `dyingAt` + `pendingScore` set, but score is **deferred** until the 150 ms death animation completes (death-animation-handler.ts:21-24).
3. End-of-frame `refreshAlienCaches` (engine.ts:207) drops the dying alien from `aliveAliens`.
4. Next frame: `checkLevelComplete` sees `aliveAliens.length === 0` → replaces `g.aliens` with the new formation (level-system.ts:63-66), **discarding the dying alien, its `pendingScore`, and its explosion** before `processDyingAliens` ever runs.

**Impact**: The final alien of each level contributes no points and shows no death flash. `ALIEN_POINTS` (30/20/10) is only awarded via this deferred path (verified: no alternate awarding path exists) — so the loss is permanent.

**Fix options** (pick one):

- **A (minimal)**: In `checkLevelComplete`, also treat aliens with `dyingAt > 0` as cleared — e.g. guard with `g.aliveAliens.length === 0 && g.aliens.every(a => !a.alive || a.dyingAt > 0)`… (still discards pendingScore).
- **B (correct)**: Reorder `_update()`: run `processDeathAnimations` **before** `checkLevelComplete` so pending scores/explosions land first.
- **C (robust)**: In `checkLevelComplete`, before replacing `g.aliens`, award any pending scores (`for a of g.aliens: g.score += a.pendingScore ?? 0`) and emit explosions — make level-complete immune to the death pipeline.

**Test**: add a regression test — kill last alien, run one frame, assert score increases and level increments.

---

## 🔴 T-2: Stale bullet reference after shield collision (REAL BUG, latent)

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

**Fix**: `return true` immediately inside the shield loop after `swapRemove` (shield hit consumes the bullet; alien/UFO checks must never follow). Delete line 61 guard. **Add a regression test**: shield hit at non-last index with 2+ bullets → no alien marked dying, both remaining bullets intact.

---

## 🟠 T-3: Bullet tunneling at low FPS / background tab

**Severity**: 3/5 — conditional (devices dropping below ~20 FPS).
**Files**: `src/game/config.ts:32` (`MAX_DT = 100`), `src/game/engine.ts:120`, `src/game/physics-system.ts:76-89`

**Root cause**: `dt` is clamped to 100 ms → `moveScale` up to 6×. A player bullet (12 px tall, -9 px/frame) can move **~54 px in one frame** — more than 2× an alien hitbox (24 px tall). Bullets can pass entirely through aliens, shields (3 px pixels), and the player (21 px tall). Tab in background → rAF throttled → guaranteed tunneling.

**Mitigations** (pick pragmatic set):

- Reduce `MAX_DT` to ~50 ms (caps step at ~27 px — still > alien, but halves the window) — simplest, barely noticeable.
- Add collision **substepping**: split large `dt` into N steps where step ≤ bullet height / 2.
- Swept collision (segment-rect intersect) for bullets vs aliens/player — more code.

**Note**: The engine already normalizes speed via `moveScale`, so physics remains correct at any `dt`; only _collision sampling_ is the weak point.

---

## 🟡 T-4: HUD rendered twice (canvas + React DOM)

**Severity**: 2/5 — maintainability + divergence risk.
**Files**: `src/game/system/ui-rendering.ts:15-35` (`drawHUD`), `src/components/HUD.tsx`

**Observation**: `UIRenderingSystem.drawHUD` draws SCORE/LEVEL/HIGH/LIVES on canvas; `HUD.tsx` renders the same four values in DOM (fed via `onUIChange`). Both update during play. They can drift if only one is updated.

**Options**:

- Keep canvas HUD as source of truth and remove the DOM HUD (fully retro look; DOM already unused for gameplay).
- Keep the DOM HUD (better accessibility/readability) and drop `drawHUD` from `ui-rendering.ts`.
- If both are kept intentionally, add a comment + a test asserting both receive the same `UIState`.

---

## 🟡 T-5: Unused runtime dependencies in package.json

**Severity**: 2/5 — hygiene; ~7 packages never imported.
**Files**: `package.json:14-23`

Confirmed **zero imports in `src/`** for: `@modelcontextprotocol/sdk`, `@modelcontextprotocol/server-filesystem`, `brace-expansion`, `diff`, `glob`, `minimatch`, `zod`. The two MCP packages look like leftover experiment deps. Also: `@types/node` sits in `dependencies` (should be `devDependencies`).

**Fix**: `npm uninstall @modelcontextprotocol/sdk @modelcontextprotocol/server-filesystem brace-expansion diff glob minimatch zod` and move `@types/node` to devDependencies. Verify with `npm test` + `npm run build` after.

---

## 🟡 T-6: AGENTS.md documents a pre-commit test gate that does not exist

**Severity**: 2/5 — docs vs. reality mismatch.
**Files**: `AGENTS.md` (Commands table), `.lintstagedrc`, repo root (no `.husky/` dir)

**Evidence** (verified): AGENTS.md says _"Pre-commit runs `prettier --write` on staged files then `npm run test`."_ Actual state: `.lintstagedrc` runs **only** Prettier, and **no `.husky/pre-commit` hook exists** (`.husky/` directory absent entirely; husky v9 redirects hooksPath to `.husky/_` but the hook file isn't there). So today commits have **no automated test gate and no lint-staged execution**.

**Options**:

- Recreate the gate: `npx husky init` (or add `.husky/pre-commit` running `npx lint-staged`) and update `.lintstagedrc` to `["*": "prettier --ignore-unknown --write", "*.{ts,tsx}": "npm test -- --run"]` — then AGENTS.md is truthful.
- Or update AGENTS.md to describe reality (formatting only). Either way, docs and hooks must agree.

---

## ⚪ T-7: `performance.now()` used inconsistently

**Severity**: 1/5 — testability & consistency.
**Files**: `engine.ts:116,274` (computes `now` once/frame), `collision-system.ts:32,46,61` + `bullet-collision-handler.ts:127` + `state-manager.ts:99,112,122` (re-query `performance.now()`)

Engine already passes `now` into `processDeathAnimations` but collision/death-marking code re-reads the clock. Within a frame this differs by microseconds (no observable bug) — but it means collision tests can't inject time without fakes. **Minor**: thread `now` through collision paths, or leave as-is with a comment.

---

## ⚪ T-8: Missing direct tests for 4 logic-heavy modules

**Severity**: 2/5 — coverage gap.
**Files (untested)**: `bullet-collision-handler.ts`, `death-animation-handler.ts`, `rendering-system.ts`, `ui-rendering.ts` (plus `src/components/*` — zero tests).

**Recommendation** (aligned with T-1/T-2 fixes): add direct unit tests for `bullet-collision-handler` (the stale-ref bug above) and `death-animation-handler` (pendingScore/level-clear flow). Components are trivial presentational — low priority.

---

## ⚪ T-9: Inline color strings vs. COLORS palette

**Severity**: 1/5 — DRY.
**Files**: `rendering-system.ts` (ground `#334155`, thrust `#f97310` region, shield aura `#3b82f6`, death flash `#ffffff`, glow colors), `ui-rendering.ts`, `bullet-collision-handler.ts`

Several hex colors are hardcoded inline while `COLORS` (config.ts:207-219) holds the palette. Consider adding these to `COLORS`/a dedicated effect palette. Cosmetic; also noted in the deep-dive docs.

---

## ⚪ T-10: No Vitest config file (implicit defaults)

**Severity**: 1/5 — discoverability.
**Evidence**: no `vitest.config.*`, no `test` key in `vite.config.ts`. Tests work via Vitest defaults (`**/*.test.ts`), but adding an explicit `test` block (e.g., `environment: "node"`, include patterns) documents intent and lets future env tweaks land safely.

---

## Summary

| ID   | Issue                                                        | Severity | Type                  |
| ---- | ------------------------------------------------------------ | -------- | --------------------- |
| T-1  | Level-clear kill awards 0 points (every level)               | 🔴 3/5   | Gameplay bug          |
| T-2  | Stale bullet ref after shield hit → phantom kills/lost shots | 🔴 3/5   | Gameplay bug (latent) |
| T-3  | Bullet tunneling at low FPS (maxDt=100ms)                    | 🟠 3/5   | Robustness            |
| T-4  | HUD duplicated canvas+DOM                                    | 🟡 2/5   | Architecture          |
| T-5  | 7 unused runtime deps                                        | 🟡 2/5   | Hygiene               |
| T-6  | Missing pre-commit test gate (docs lie)                      | 🟡 2/5   | Tooling               |
| T-7  | Inconsistent `performance.now()`                             | ⚪ 1/5   | Consistency           |
| T-8  | Untested collision/death/rendering modules                   | 🟡 2/5   | Testing               |
| T-9  | Inline colors vs. COLORS palette                             | ⚪ 1/5   | DRY                   |
| T-10 | No explicit Vitest config                                    | ⚪ 1/5   | Tooling               |

**Verified healthy**: StrictMode double-mount (no leaks), high-score cache (fine single-tab), keys-map growth (bounded), localStorage error handling (all try/catch), zero TODO/FIXME/debug leftovers, no stale backup files, dist properly gitignored.
