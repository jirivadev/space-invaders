# Progress Tracker: Space Invaders Fixes

## High Priority (Critical Bugs)

| ID | Item | Files | Status | Notes |
|----|------|-------|--------|-------|
| 1 | Fix level announcement overlay never disappearing | `src/game/engine.ts`, `src/game/system/level-system.ts` | Done | Timer decremented in `_update()` with `Math.max(0, ...)`; tests added. |
| 2 | Fix player bullets not damaging shields | `src/game/system/collision-system.ts` | Done | `checkPlayerBulletShield` now calls `damageShieldRect()`; test added. |
| 3 | Fix malformed player sprite rows | `src/game/config.ts` | Done | Rows 6–7 padded to 9 chars; sprite consistency test added. |

## Medium Priority (Bugs / Logic Issues)

| ID | Item | Files | Status | Notes |
|----|------|-------|--------|-------|
| 4 | Fix misleading test name in `level-system.test.ts` | `src/game/system/level-system.test.ts` | Done | Renamed to clarify that the interval can drop below 80 at high difficulty. |
| 5 | Enforce global particle cap | `src/game/engine.ts`, `src/game/system/physics-system.ts` | Done | Added `enforceParticleCap()` and call it in `updateParticles()` and at the end of `_update()`; tests added. |
| 6 | Rename `GameEngine.addToLeaderboard` to avoid shadowing | `src/game/engine.ts` | Done | Renamed to `submitLeaderboard`; `engine.test.ts` updated. |
| 7 | Fix circular callbacks in `App.tsx` | `src/App.tsx`, `src/game/engine.ts` | Done | Engine now wires its own methods into `InputHandler`; App only passes `onUIChange`. |

## Low Priority (Code Quality / Maintainability)

| ID | Item | Files | Status | Notes |
|----|------|-------|--------|-------|
| 8 | Add `resetGameState` helper for state transition | `src/game/engine.ts`, `src/game/system/state-manager.ts` | Done | Extracted `resetGameState(g)` and used it in `_handleStateTransitions`; test added. |
| 9 | Add comment or refactor bullet-collision loop | `src/game/engine.ts` | Done | Added comment explaining the splice + `i--` pattern. |
| 10 | Fill in empty `README.md` | `README.md` | Done | Added description, controls, install/run/test instructions, and project structure. |

---

**Legend**
- `Pending` — not started
- `In Progress` — currently being worked on
- `Done` — completed and verified

**Total items:** 10 (3 high, 4 medium, 3 low)
