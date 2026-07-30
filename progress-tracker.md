# Progress Tracker: Space Invaders Fixes

## High Priority (Critical Bugs)

| ID | Item | Files | Status | Notes |
|----|------|-------|--------|-------|
| 1 | Fix level announcement overlay never disappearing | `src/game/engine.ts`, `src/game/system/level-system.ts` | Pending | `levelAnnounceTimer` is set but never decremented; overlay stays forever. |
| 2 | Fix player bullets not damaging shields | `src/game/system/collision-system.ts` | Pending | `checkPlayerBulletShield` spawns particles but never calls `damageShieldRect()`. |
| 3 | Fix malformed player sprite rows | `src/game/config.ts` | Pending | Rows 6–7 of `SPRITES.player` are 8 chars instead of 9, causing uneven rendering. |

## Medium Priority (Bugs / Logic Issues)

| ID | Item | Files | Status | Notes |
|----|------|-------|--------|-------|
| 4 | Fix misleading test name in `level-system.test.ts` | `src/game/system/level-system.test.ts` | Pending | Test asserts `toBeLessThan(80)` but is named as if it enforces a floor of 80. |
| 5 | Enforce global particle cap | `src/game/engine.ts`, `src/game/system/particle-system.ts` | Pending | `maxCount` is only checked in `applyBomb()`; other sources can exceed it. |
| 6 | Rename `GameEngine.addToLeaderboard` to avoid shadowing | `src/game/engine.ts` | Pending | Method has the same name as the imported leaderboard function; rename to `submitLeaderboard`. |
| 7 | Fix circular callbacks in `App.tsx` | `src/App.tsx` | Pending | Callbacks passed to engine just call back into engine methods; simplify wiring. |

## Low Priority (Code Quality / Maintainability)

| ID | Item | Files | Status | Notes |
|----|------|-------|--------|-------|
| 8 | Add `resetGameState` helper for state transition | `src/game/engine.ts`, `src/game/state/state-manager.ts` | Pending | `_handleStateTransitions` resets ~15 fields inline; extract a helper. |
| 9 | Add comment or refactor bullet-collision loop | `src/game/engine.ts` | Pending | `i--` after `splice` is correct but subtle; make intent clearer. |
| 10 | Fill in empty `README.md` | `README.md` | Pending | Add project description, build/test instructions, and run commands. |

---

**Legend**
- `Pending` — not started
- `In Progress` — currently being worked on
- `Done` — completed and verified

**Total items:** 10 (3 high, 4 medium, 3 low)
