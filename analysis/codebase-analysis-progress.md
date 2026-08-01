# Codebase Analysis Progress — Space Invaders

> Live tracking file. Any new chat should read THIS file first, then continue with the next phase.

## Workflow Instructions (for continuation chats)

**To continue**: start the next session with:

> _"Continue codebase analysis - please read `analysis/codebase-analysis-progress.md` to understand where we left off, then proceed with the next phase."_

**Methodology** (from the original mission):

- **Max 3 phases** — one phase per confirmation step, to avoid context overload
- **Phase 1** Discovery & Architecture: project structure, tech stack, architecture mapping
- **Phase 2** Component Analysis: deep dive into key components, patterns, technical debt
- **Phase 3** Documentation & Recommendations: comprehensive guides + prioritized improvements
- After each phase: update this file, then ask the user for confirmation to proceed

**Analysis guidelines** (technical only):

- Technical + actionable + concise, developer-focused
- No business decisions, cost estimates, hiring, or project management advice
- All analysis based on actual code examination
- Save everything as searchable markdown under `analysis/`

## Project Context

- **Project**: Space Invaders — browser arcade clone
- **Root**: `/home/jiriva/Desktop/space-invaders`
- **Stack**: React 19 + TypeScript 5.9 (strict) + Vite 6 + Tailwind v4 + Vitest 3
- **Rendering**: HTML5 Canvas 2D (all gameplay + screens)
- **Deployment**: single-file static HTML via `vite-plugin-singlefile`
- **Persistence**: `localStorage` (leaderboard + high score)
- **Analysis date**: 2026-07-31

## Verification Baseline (must stay true)

- ✅ `npm run build` — typecheck (tsc) + Vite bundle succeeds
- ✅ `npm test` — **209 tests / 8 files, all passing**
- ✅ Test files: `rendering-math.test.ts` (55), `physics-system.test.ts` (33), `entity-factory.test.ts` (26), `input-handler.test.ts` (23), `engine.test.ts` (21), `collision-system.test.ts` (19), `state-manager.test.ts` (18), `level-system.test.ts` (14)

## Completed Phases

### ✅ Phase 3: Documentation & Recommendations — COMPLETE

**Deliverables written:**

1. `analysis/comprehensive-codebase-guide.md` — system overview + ASCII diagram, end-to-end game flow, module reference table, GameState field reference, 19-step frame pipeline, collision & death pipeline, GAME_CONFIG tuning guide, persistence internals, known issues
2. `analysis/developer-onboarding-guide.md` — setup, mental model, "I want to change X → edit Y" map, feature-add recipe, levels/formations guide, testing conventions, gotchas, debugging tips, quality bar
3. `analysis/technical-recommendations.md` — prioritized roadmap R-1..R-10 (quick wins: R-1 level-clear score fix, R-2 stale bullet fix, R-3 dep cleanup; Tier 2: tunneling/pre-commit gate/tests/now-threading; Tier 3: HUD decision/colors/vitest config) + "what NOT to do"

**Analysis complete — all 3 phases done.**

- Final deliverables: 8 docs in `analysis/` + 4 in `analysis/component-deep-dives/`
- 2 real bugs identified (T-1 every-level score loss, T-2 stale bullet ref), with recommended fixes + regression test specs
- Baseline: 209 tests passing, build clean

### ✅ Phase 2: Component Analysis — COMPLETE

**Deliverables written:**

1. `analysis/code-patterns-identified.md` — 13 recurring conventions (mutable-state pipeline, reverse-iter + swapRemove, callback injection, pure math layer, sprite grids, moveScale, deferred death, per-frame caches, try/catch persistence, diffed UI bridge, config centralization, test factories, test style)
2. `analysis/component-deep-dives/` — 4 files (engine-and-state.md, gameplay-systems.md, handlers-and-factory.md, rendering-and-support.md) written by @igris, line-verified, test counts confirmed
3. `analysis/technical-issues.md` — 10 issues with severity + fixes

**Key findings (T-1 and T-2 are REAL BUGS):**

- 🔴 **T-1 Level-clear score loss (every level)**: `checkLevelComplete` (engine.ts:170) runs BEFORE `handleBulletCollisions` (186); last alien's `pendingScore` is deferred 150ms via death pipeline; end-of-frame `refreshAlienCaches` drops dying alien; next frame `checkLevelComplete` replaces `g.aliens`, discarding the pending score + explosion. Final kill of every level = 0 points.
- 🔴 **T-2 Stale bullet ref**: `if (!g.bullets[i]) return true` checks position not identity — after shield hit at non-last index, stale bullet can phantom-kill descended aliens or wrongly swapRemove an already-processed bullet.
- 🟠 T-3 bullet tunneling at low FPS (maxDt=100ms → 54px step vs 24px alien hitbox)
- 🟡 T-4 HUD canvas+DOM duplication; T-5 7 unused deps (@modelcontextprotocol/*, zod, glob, minimatch, diff, brace-expansion); T-6 AGENTS.md claims pre-commit tests but no .husky/ exists (only prettier in .lintstagedrc)
- ⚪ T-7/T-8/T-9/T-10: perf.now inconsistency, untested modules, inline colors, no vitest config
- **Verified healthy**: StrictMode double-mount OK (no leaks), high-score cache OK, keys map bounded, localStorage fully guarded, zero TODO/debug leftovers, no backup files, dist gitignored
- Test coverage gap: bullet-collision-handler, death-animation-handler, rendering-system, ui-rendering have no direct tests

### ✅ Phase 1: Discovery & Architecture — COMPLETE

**Deliverables written:**

1. `analysis/project-overview.md` — stack, structure, commands, key characteristics
2. `analysis/architecture-analysis.md` — system architecture, game loop pipeline, system responsibilities, data flow, design decisions, potential concerns

**Key findings:**

- ECS-flavored architecture: single mutable `GameState` + system classes + handler functions
- `GameEngine` orchestrates rAF loop: `_update()` (18-step pipeline) → `_draw()` (layered rendering)
- React ↔ engine communication purely via `onUIChange` callback (diffed to prevent 60 FPS re-renders)
- 10 system/handler files under `src/game/system/`; pure math in `geometry.ts` + `rendering-math.ts`
- Sprite-based pixel-art rendering from `SPRITES` char arrays in `config.ts`
- `swapRemove` O(1) removal + reverse iteration; particle cap 500; alien caches per-frame
- Deferred death scoring via `dyingAt` timestamps
- localStorage fully try/catch wrapped; leaderboard dedupes by name

**Potential concerns flagged (Phase 2 candidates):**

1. Canvas HUD (`ui-rendering.drawHUD`) **duplicated** by React DOM HUD (`HUD.tsx`)
2. React StrictMode double-mount — engine create/destroy twice in dev (works, verify no leaks)
3. Unused legacy deps in `package.json`: `@modelcontextprotocol/*`, `brace-expansion`, `diff`, `glob`, `minimatch`, `zod` (not imported by `src/`)
4. `performance.now()` called directly in collision-system (engine passes `now` elsewhere — inconsistent)
5. No `dt` substeps for collision — potential bullet tunneling (mitigated by `maxDt` clamp)

## File Locations

```
analysis/
├── project-overview.md          # ✅ Phase 1
├── architecture-analysis.md     # ✅ Phase 1
├── code-patterns-identified.md  # ✅ Phase 2
├── technical-issues.md          # ✅ Phase 2 (10 issues, T-1/T-2 = real bugs)
├── component-deep-dives/        # ✅ Phase 2
│   ├── engine-and-state.md
│   ├── gameplay-systems.md
│   ├── handlers-and-factory.md
│   └── rendering-and-support.md
├── codebase-analysis-progress.md # ✅ THIS FILE
└── (Phase 3 files go here: comprehensive-codebase-guide.md, technical-recommendations.md, developer-onboarding-guide.md)
```

Related (pre-existing, do NOT confuse):

- `code-analysis-progress.md` (repo root) — artifact of an earlier _cleanup_ session (dead-code removal), unrelated to this documentation effort

## Next Steps

### ✅ Analysis complete — all 3 phases delivered.

**Suggested follow-ups (ask user which to take on):**

1. **Implement bug fixes**: R-1 (level-clear score, engine.ts reorder or pendingScore sweep) + R-2 (stale bullet, return-true fix) with regression tests
2. **Dependency cleanup**: R-3 (remove 7 unused deps, move @types/node to devDeps)
3. **Tooling**: R-5 (restore pre-commit gate: husky + lint-staged tests) — makes AGENTS.md truthful
4. **Test coverage**: R-6 (bullet-collision-handler + death-animation-handler tests)
5. **Robustness**: R-4 (maxDt 100→50 or collision substepping)
6. If the codebase changes significantly, re-run analysis: read this file for methodology + baseline

## Session State

- **Last updated**: 2026-07-31
- **Current phase**: 3 (complete) — **ALL PHASES DONE**
- **Files analyzed**: all source + test + config files (read in full across sessions)
- **Agents used**: @beru (fact/hygiene sweep), @bellion (7 deep concern analyses), @igris (component deep-dives), @shadow-sovereign available for fix review
- **Deliverable inventory** (in `analysis/`): project-overview.md · architecture-analysis.md · code-patterns-identified.md · technical-issues.md · technical-recommendations.md · comprehensive-codebase-guide.md · developer-onboarding-guide.md · component-deep-dives/{engine-and-state,gameplay-systems,handlers-and-factory,rendering-and-support}.md · this file
