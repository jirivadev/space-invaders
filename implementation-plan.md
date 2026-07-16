# Space Invaders — Implementation Plan

**Based on:** [codebase-analysis.md](codebase-analysis.md)  
**Target Date:** TBD  
**Current State:** 🟢 Production-ready core game (Phase 1–2 complete)

---

## Phase 1: Code Quality & Testing (High Priority)

**Goal:** Improve maintainability, reduce technical debt, add safety nets  
**Estimated Effort:** 5–7 days  
**Impact:** High (prevents bugs, enables faster feature development)

### Tasks

#### 1.1 Extract Constants to Config File
**File:** Create `src/game/config.ts`  

**Implementation Steps:**
1. Read `constants.ts` and identify magic numbers
2. Create `GAME_CONFIG` object with grouped values:
   - `player`: speed, cooldowns, invulnerability
   - `alien`: step sizes, sprite scale, power-up chances
   - `bullets`: dimensions, speeds
   - `particles`: max count, ratios, bomb config
3. Refactor `constants.ts` to export `GAME_CONFIG`
4. Update `engine.ts` imports: `import { GAME_CONFIG } from './config'`
5. Replace inlined magic numbers with `GAME_CONFIG.player.speed`, etc.
6. Run `npm run lint:fix` to ensure no deprecated constants

**Lines Changed:** ~50 replacements in `engine.ts`  
**Test Coverage:** 0 (should not break existing tests)

**Success Criteria:**
- All magic numbers replaced with config keys
- `npm run typecheck` passes
- No lint errors

---

#### 1.2 Break Up GameEngine Class
**File:** Refactor `engine.ts` → Create new files  

**Implementation Steps:**

**Create `src/game/systems/InputHandler.ts`:**
```typescript
export class InputHandler {
  private g: GameState;

  constructor(gameState: GameState) {
    this.g = gameState;
  }

  onKeyDown(e: KeyboardEvent): void {
    this.g.keys[e.key] = true;
    // Prevent default for game keys
    // Handle name entry state
    // Handle menu/gameover transitions
  }

  onKeyUp(e: KeyboardEvent): void {
    this.g.keys[e.key] = false;
  }

  onBlur(): void {
    this.g.keys = {};
  }
}
```

**Create `src/game/systems/PhysicsSystem.ts`:**
```typescript
export class PhysicsSystem {
  update(gameState: GameState, dt: number, moveScale: number): void {
    // Star movement
    // Player movement (boundary-checked)
    // UFO movement
    // Power-up falling
    // Particle physics (drag + gravity)
  }
}
```

**Create `src/game/systems/CollisionSystem.ts`:**
```typescript
export class CollisionSystem {
  checkBulletCollisions(gameState: GameState, moveScale: number): void {
    // Bullet ↔ shield
    // Bullet ↔ alien
    // Bullet ↔ UFO
    // Bullet ↔ player
  }

  checkPlayerCollisions(gameState: GameState): void {
    // Alien ↔ shield
    // Alien ↔ ground (game over)
  }

  checkPowerUpCollisions(gameState: GameState): void {
    // Power-up ↔ player (rapidFire, shield, bomb)
  }
}
```

**Create `src/game/systems/LevelSystem.ts`:**
```typescript
export class LevelSystem {
  checkLevelComplete(gameState: GameState): void {
    // If all aliens dead → level up
    // Trigger screen shake
    // Update levelAnnounceTimer
    // Create new alien formation
  }

  getLevelConfig(level: number): LevelConfig {
    // Existing getLevelConfig logic
  }

  createAliens(formation: FormationType, startY: number): Alien[] {
    // Existing createAliens logic
  }
}
```

**Create `src/game/systems/RenderingSystem.ts`:**
```typescript
export class RenderingSystem {
  draw(gameState: GameState, ctx: CanvasRenderingContext2D, now: number): void {
    // Separate draw methods for:
    // - Stars
    // - Shields
    // - Aliens
    // - UFO
    // - Player
    // - Power-ups
    // - Bullets (with trails)
    // - Particles
    // - UI overlays (menu, game over, name entry)
  }
}
```

**Refactor `GameEngine.ts`:**
1. Import all systems
2. Initialize systems in constructor
3. Call appropriate system in `_update()`:
   ```typescript
   private _update() {
     const now = performance.now();
     const rawDt = this.g.lastTime === 0 ? TARGET_DT : now - this.g.lastTime;
     const dt = Math.min(MAX_DT, rawDt);
     this.g.lastTime = now;

     const moveScale = dt / TARGET_DT;
     this.starsSystem.update(this.g, moveScale);
     this.physicsSystem.update(this.g, dt, moveScale);
     this.collisionSystem.checkBulletCollisions(this.g, moveScale);
     this.collisionSystem.checkPlayerCollisions(this.g);
     this.collisionSystem.checkPowerUpCollisions(this.g);
     this.levelSystem.checkLevelComplete(this.g);
     this._notifyUI();
   }
   ```
4. Call rendering system in `_draw()`:
   ```typescript
   private _draw(now: number) {
     this.renderingSystem.draw(this.g, this.ctx, now);
   }
   ```

**Lines Removed:** ~1,142 → ~200 per file (total ~1,000)  
**Test Coverage:** Need to add integration tests (see 1.3)

**Success Criteria:**
- `engine.ts` reduced from 1,142 to < 300 lines
- Each system file < 250 lines
- `npm run typecheck` passes
- No functionality broken

---

#### 1.3 Add Unit Tests for Core Logic
**File:** Update `engine.test.ts`  

**Implementation Steps:**

**Test Formation Creation:**
```typescript
describe('Formation Creation', () => {
  it('creates grid formation', () => {
    const aliens = createAliens('grid', 80);
    expect(aliens).toHaveLength(55);
    expect(aliens[0].type).toBe('squid');
  });

  it('creates staggered formation', () => {
    const aliens = createAliens('staggered', 90);
    // Assert row pattern logic
  });

  it('creates diamond formation', () => {
    const aliens = createAliens('diamond', 100);
    // Assert diamond shape
  });
});
```

**Test Level Config Lookup:**
```typescript
describe('Level Config', () => {
  it('returns config for level 1', () => {
    const config = getLevelConfig(1);
    expect(config.formation).toBe('grid');
    expect(config.speedMultiplier).toBe(1.0);
  });

  it('scales speed for level 10', () => {
    const config = getLevelConfig(10);
    expect(config.speedMultiplier).toBe(4.0);  // Max speed
  });

  it('cycles formations after level 4', () => {
    const level5 = getLevelConfig(5);
    expect(level5.formation).toBe('grid');

    const level6 = getLevelConfig(6);
    expect(level6.formation).toBe('staggered');
  });
});
```

**Test Collision Detection:**
```typescript
describe('Collision Detection', () => {
  it('detects bullet-alien collision', () => {
    const g = createGameState();
    g.aliens[0].alive = true;
    g.bullets.push({
      x: g.aliens[0].x,
      y: g.aliens[0].y + g.aliens[0].h,
      w: 4, h: 12,
      dy: -9,
      owner: 'player',
      trail: [],
    });

    // Action: update loop
    updateGame(g, 16);

    // Assert: alien killed
    expect(g.aliens[0].alive).toBe(false);
    expect(g.score).toBe(30);
  });

  it('bullet penetrates shield only once', () => {
    const g = createGameState();
    g.shields[0].pixels[10][12] = true;
    g.bullets.push({
      x: g.shields[0].x + 12 * 3,
      y: g.shields[0].y + 10 * 3,
      w: 4, h: 12,
      dy: -9,
      owner: 'player',
      trail: [],
    });

    updateGame(g, 16);

    // Assert: pixel destroyed, bullet removed
    expect(g.shields[0].pixels[10][12]).toBe(false);
    expect(g.bullets).toHaveLength(0);
  });
});
```

**Test Particle System:**
```typescript
describe('Particle System', () => {
  it('spawns spark, debris, fire based on chance', () => {
    const particles = spawnParticles(100, 100, '#4ade80', 8);

    const sparkCount = particles.filter(p => p.type === 'spark').length;
    expect(sparkCount).toBeGreaterThan(0);
    expect(sparkCount).toBeLessThanOrEqual(2);  // ~20% of 8
  });

  it('spawns flash on large explosions', () => {
    const particles = spawnParticles(200, 200, '#fef08a', 15);

    const flashCount = particles.filter(p => p.type === 'flash').length;
    expect(flashCount).toBe(1);
  });
});
```

**Test Power-up System:**
```typescript
describe('Power-up System', () => {
  it('drops random type on alien kill', () => {
    const g = createGameState();
    g.aliens[0].alive = true;

    // Spawn bullet, kill alien
    // Assert: powerUp exists in g.powerUps
    expect(g.powerUps.length).toBeGreaterThan(0);
    expect(['rapidFire', 'shield', 'bomb']).toContain(g.powerUps[0].type);
  });

  it('rapid-fire reduces cooldown', () => {
    const g = createGameState();
    g.aliens[0].alive = true;

    // Collect rapid-fire power-up
    g.activePowerUps.rapidFire = 8000;

    // Fire bullet immediately
    const now = performance.now();
    fireBullet(g, now);

    // Assert: cooldown 120ms instead of 333ms
    expect(g.player.cooldown).toBe(120);
  });

  it('bomb destroys all aliens', () => {
    const g = createGameState();
    g.aliens.forEach(a => a.alive = true);

    // Collect bomb
    collectPowerUp(g, g.powerUps[0]);

    // Assert: all aliens dead
    expect(g.aliens.every(a => !a.alive)).toBe(true);
  });
});
```

**Test Screen Shake:**
```typescript
describe('Screen Shake', () => {
  it('decays intensity over time', () => {
    const g = createGameState();
    triggerShake(g, 8, 500);

    // Advance time 500ms
    updateGame(g, 16, 100);  // 6 updates at 100ms
    triggerShake(g, 0, 0);  // Reset shake

    // Assert: intensity reduced
    expect(g.shakeIntensity).toBeLessThan(8);
  });
});
```

**Target Coverage:** 80% of `engine.ts` (not just utilities)  
**Lines of Tests:** Add ~300 lines of tests  
**Test Framework:** Vitest (already configured)

**Success Criteria:**
- All new tests pass
- Coverage report shows ≥ 80% for `engine.ts`
- No regressions in existing tests

---

## Phase 2: Features & UX (Medium Priority)

**Goal:** Improve player experience, make game feel complete  
**Estimated Effort:** 4–6 days  
**Impact:** High (retention, enjoyment, accessibility)

### Tasks

#### 2.1 Implement Audio System
**File:** Create `src/game/audio/AudioManager.ts`

**Implementation Steps:**

**Step 1: Define Sound Assets (Procedural Audio)**
```typescript
// src/game/audio/sounds.ts
export const SHOOT_SOUND = () => {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};
```

**Step 2: Create Audio Manager**
```typescript
// src/game/audio/AudioManager.ts
export class AudioManager {
  private enabled = false;

  enable() {
    this.enabled = true;
  }

  shoot() {
    if (!this.enabled) return;
    SHOOT_SOUND();
  }

  explode(x: number, y: number, color: string) {
    if (!this.enabled) return;
    EXPLODE_SOUND(x, y, color);
  }

  powerUpPickup(type: PowerUpType) {
    if (!this.enabled) return;
    POWERUP_SOUND(type);
  }

  levelUp() {
    if (!this.enabled) return;
    LEVEL_UP_SOUND();
  }
}
```

**Step 3: Integrate with GameEngine**
```typescript
// In GameEngine constructor
import { AudioManager } from './audio/AudioManager';

constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
  this.audio = new AudioManager();
  // ... rest of constructor
}

// In _update(), when killing alien
g.particles.push(...spawnParticles(a.x + a.w / 2, a.y + a.h / 2, COLORS[a.type], 40));
this.audio.explode(a.x, a.y, COLORS[a.type]);

// In _onKeyDown(), when starting game
this.audio.levelUp();

// In CollisionSystem, when collecting power-up
this.audio.powerUpPickup(p.type);
```

**Step 4: Add Mute Toggle UI**
```typescript
// In App.tsx
const [audioEnabled, setAudioEnabled] = useState(false);

useEffect(() => {
  engine.audio.enable();
}, []);

return (
  <button onClick={() => setAudioEnabled(!audioEnabled)}>
    {audioEnabled ? '🔊 On' : '🔇 Off'}
  </button>
);
```

**Sound Effects to Implement:**
- Shoot (2-tone burst, 10% volume)
- Explosion (white noise, 300ms decay)
- Power-up pickup (ascending arpeggio, 5 notes)
- Bomb (descending rumble, 500ms)
- Level up (ascending chord, 3 notes)
- Game over (fading descending tone)

**Browser Requirement:** Must enable audio context on user interaction (first click/key)

**Success Criteria:**
- All 6 sound effects working
- Audio context enabled on first click
- Mute toggle functional
- No audio lag (within 16ms)

---

#### 2.2 Add Pause Functionality
**File:** Update `engine.ts`

**Implementation Steps:**

**Step 1: Add `paused` State**
```typescript
// In GameState interface
type GameStatus = 'menu' | 'playing' | 'paused' | 'gameover' | 'nameEntry';
```

**Step 2: Handle ESC Key**
```typescript
// In _onKeyDown()
if (e.key === 'Escape') {
  if (g.status === 'playing') {
    g.status = 'paused';
  } else if (g.status === 'paused') {
    g.status = 'playing';
  }
}
```

**Step 3: Skip Update When Paused**
```typescript
// In _update()
if (g.status === 'paused') {
  return;  // Skip logic updates
}
```

**Step 4: Draw Pause Overlay**
```typescript
// In _draw(), before screen shake
if (g.status === 'paused') {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 48px monospace';
  ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.font = '20px monospace';
  ctx.fillText('Press ESC to Resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
}
```

**Step 5: Add to React UI**
```typescript
// In App.tsx
{ui.status === 'paused' && (
  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
    <h2 className="text-4xl font-bold text-white animate-pulse">PAUSED</h2>
    <p className="text-white text-xl mt-2">Press ESC to Resume</p>
  </div>
)}
```

**Success Criteria:**
- Pressing ESC pauses/resumes game
- Pause overlay displays correctly
- No game updates while paused
- State persists on pause

---

#### 2.3 Implement Touch Controls
**File:** Update `App.tsx`, create `src/game/utils/touchControls.ts`

**Implementation Steps:**

**Step 1: Add Touch Event Listeners**
```typescript
// In App.tsx, useEffect
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();

    if (touch.clientX < rect.left + rect.width / 3) {
      engine.keys['ArrowLeft'] = true;
    } else if (touch.clientX > rect.right - rect.width / 3) {
      engine.keys['ArrowRight'] = true;
    } else {
      engine.keys[' '] = true;  // Shoot
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    engine.keys['ArrowLeft'] = false;
    engine.keys['ArrowRight'] = false;
    engine.keys[' '] = false;
  };

  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

  return () => {
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchend', handleTouchEnd);
  };
}, []);
```

**Step 2: Add Mobile Warning if No Touch**
```typescript
// In App.tsx, if touch not supported
if (!('ontouchstart' in window) && !('ontouchend' in window)) {
  return (
    <div className="text-red-500">
      ⚠️ Desktop-only: Use keyboard to play
    </div>
  );
}
```

**Step 3: Responsive Canvas**
```typescript
// In App.tsx, existing responsive CSS is sufficient
// CSS:
canvas {
  max-width: 100%;
  height: auto;
  aspect-ratio: 800 / 640;
}
```

**Success Criteria:**
- Touch left/right sides moves player
- Center tap shoots
- Works on mobile browsers
- Fallback warning for desktop-only

---

#### 2.4 Add High Score Leaderboard UI
**File:** Update `App.tsx`

**Implementation Steps:**

**Step 1: Create Leaderboard Component**
```typescript
// In App.tsx
export default function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return null;
  }

  const maxScore = entries[0]?.score || 0;

  return (
    <div className="flex flex-col items-center gap-2 mt-4 p-4 bg-slate-900/80 rounded">
      <h3 className="text-xl font-bold text-green-400">HIGH SCORES</h3>
      <div className="w-full max-w-md">
        {entries.map((entry, index) => {
          const isTop3 = index < 3;
          let rankColor = 'text-white';
          if (index === 0) rankColor = 'text-yellow-400';
          if (index === 1) rankColor = 'text-slate-300';
          if (index === 2) rankColor = 'text-orange-400';

          return (
            <div
              key={entry.date}
              className={`flex justify-between items-center p-2 rounded ${isTop3 ? 'bg-slate-800' : ''}`}
            >
              <span className={`font-bold w-8 ${rankColor}`}>#{index + 1}</span>
              <span className={`font-mono w-32 ${isTop3 ? 'text-white' : 'text-slate-400'}`}>
                {entry.name}
              </span>
              <span className="font-mono text-yellow-400 w-20 text-right">{entry.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Update App.tsx to Show Leaderboard**
```typescript
// In App.tsx
const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

useEffect(() => {
  const refresh = () => setLeaderboard(getLeaderboard());
  refresh();

  // Refresh on visibility change (optional)
  window.addEventListener('storage', refresh);
  return () => window.removeEventListener('storage', refresh);
}, []);

return (
  <div className="flex flex-col items-center gap-4 ...">
    <h1>SPACE INVADERS</h1>
    <Leaderboard entries={leaderboard} />
    {/* ... rest of App */}
  </div>
);
```

**Step 3: Add Clear Button (Optional)**
```typescript
<button
  onClick={() => {
    if (confirm('Clear all scores?')) {
      localStorage.removeItem(LEADERBOARD_KEY);
      setLeaderboard([]);
    }
  }}
  className="text-xs text-slate-500 hover:text-slate-300"
>
  Clear Scores
</button>
```

**Success Criteria:**
- Top 10 scores display with ranks
- Gold/silver/bronze coloring for top 3
- Auto-refreshes on localStorage changes
- Clear button functional

---

## Phase 3: Polish & Accessibility (Low Priority)

**Goal:** Add UX touches and expand reach  
**Estimated Effort:** 2–3 days  
**Impact:** Medium (retention, user satisfaction)

### Tasks

#### 3.1 Fix Particle Performance
**File:** Update `src/game/systems/PhysicsSystem.ts`

**Implementation Steps:**

**Step 1: Particle Pooling**
```typescript
export class ParticlePool {
  private pool: Particle[] = [];
  private maxSize = MAX_PARTICLES;

  get(): Particle | null {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    if (this.pool.length < this.maxSize) {
      return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '', size: 0, type: 'spark' };
    }
    return null;
  }

  release(particle: Particle): void {
    this.pool.push(particle);
  }
}

// Usage in PhysicsSystem
private particlePool = new ParticlePool();

updateParticles(g: GameState, dt: number): void {
  const moveScale = dt / TARGET_DT;
  const dragFactor = Math.pow(0.97, moveScale);

  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    if (p.type !== 'flash') {
      p.vx *= dragFactor;
      p.vy *= dragFactor;
      p.vy += 0.06 * moveScale;
      p.x += p.vx * moveScale;
      p.y += p.vy * moveScale;
    }
    p.life -= dt;

    if (p.life <= 0) {
      this.particlePool.release(p);
      g.particles.splice(i, 1);
    }
  }
}
```

**Step 2: Spatial Partitioning (Optional)**
```typescript
// Only draw particles on screen
ctx.beginPath();
for (const p of g.particles) {
  if (p.x >= 0 && p.x <= CANVAS_WIDTH && p.y >= 0 && p.y <= CANVAS_HEIGHT) {
    // Draw particle
  }
}
ctx.closePath();
```

**Success Criteria:**
- No measurable performance difference in benchmarks
- GC pressure reduced (profilers show fewer allocations)
- 60 FPS maintained on weak devices

---

#### 3.2 Add README.md Documentation
**File:** Create `README.md`

**Implementation Steps:**

```markdown
# Space Invaders (React + TypeScript + Canvas)

A faithful clone of the classic arcade game, built with modern web technologies.

## Features

- ✅ Classic Space Invaders gameplay (55 aliens, 4 shields, UFO)
- ✅ Progressive difficulty (5 formation types, 12+ levels)
- ✅ Power-ups (rapid fire, shield, bomb)
- ✅ Pixel-level shield destruction
- ✅ Particle effects & screen shake
- ✅ High score leaderboard
- ✅ Responsive design (desktop optimized)

## Quick Start

```bash
# Clone repository
git clone <repo-url>
cd space-invaders-game-development

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Controls

| Key | Action |
|-----|--------|
| ← → or A D | Move left/right |
| SPACE | Shoot |
| ESC | Pause (coming soon) |

## Tech Stack

- **Framework:** React 19
- **Language:** TypeScript 5.9
- **Build Tool:** Vite 7
- **CSS:** Tailwind CSS 4
- **Testing:** Vitest 4

## File Structure

```
src/
├── App.tsx              # React wrapper (65 lines)
├── main.tsx             # React entry point (10 lines)
├── index.css            # Tailwind import + reset
└── game/
    ├── engine.ts        # GameEngine class (1,142 lines)
    ├── types.ts         # TypeScript interfaces (142 lines)
    ├── constants.ts     # Configuration & sprites (153 lines)
    └── engine.test.ts   # Unit tests (143 lines)
```

## Building

The project uses `vite-plugin-singlefile` to inline all assets into a single `index.html` file:

```bash
npm run build  # Outputs dist/index.html (single-file)
npm run preview  # Preview production build
```

No external assets are required — all sprites are defined as string arrays.

## License

MIT

## Credits

Based on the classic Space Invaders arcade game by Taito (1978).
```

**Success Criteria:**
- README provides clear quick start
- Tech stack listed
- File structure explained
- All commands documented

---

#### 3.3 Add Commentary to Complex Methods
**File:** Update `engine.ts`

**Implementation Steps:**

Add JSDoc comments to complex methods:
```typescript
/**
 * Main game loop frame
 * Updates game logic, handles collisions, renders frame
 * @param now - Current timestamp from performance.now()
 */
private _frame(now: number) {
  this._update();
  this._draw(now);
  this.rafId = requestAnimationFrame(this.boundFrame);
}

/**
 * Alien formation movement logic
 * Moves aliens horizontally, detects edge collision, moves down on edges
 * Speed scales inversely with alive alien count (faster as group shrinks)
 * @param dt - Delta time in ms (clamped at MAX_DT)
 */
private _updateAlienFormation(dt: number, moveScale: number) {
  // ... implementation
}
```

**Success Criteria:**
- All public methods have JSDoc
- Complex private methods have inline comments
- IDE autocompletion works

---

## Implementation Timeline

### Week 1: Code Quality (Phase 1)
**Mon:**
- [ ] 1.1 Extract constants (4 hours)

**Tue–Thu:**
- [ ] 1.2 Break up GameEngine (8 hours)
  - [ ] Create InputHandler
  - [ ] Create PhysicsSystem
  - [ ] Create CollisionSystem
  - [ ] Create LevelSystem
  - [ ] Create RenderingSystem
  - [ ] Refactor GameEngine

**Fri:**
- [ ] 1.3 Add unit tests (4 hours)
- [ ] Run tests, fix regressions
- [ ] Update progress tracker

**Total:** ~16 hours (2 days)

### Week 2: Features (Phase 2)
**Mon–Tue:**
- [ ] 2.1 Implement audio (6 hours)
  - [ ] Define sounds
  - [ ] Create AudioManager
  - [ ] Integrate with game loop

**Wed:**
- [ ] 2.2 Add pause (2 hours)

**Thu–Fri:**
- [ ] 2.3 Touch controls (4 hours)
- [ ] 2.4 Leaderboard UI (4 hours)

**Total:** ~16 hours (2 days)

### Week 3: Polish (Phase 3)
**Mon–Tue:**
- [ ] 3.1 Particle optimization (3 hours)
- [ ] 3.2 README (2 hours)
- [ ] 3.3 Code comments (2 hours)

**Wed:**
- [ ] Integration testing
- [ ] Bug fixes
- [ ] Final review

**Total:** ~7 hours (1 day)

---

## Testing Checklist

### Manual Testing
- [ ] All game states work (menu → playing → game over → name entry)
- [ ] Keyboard controls responsive
- [ ] Touch controls work on mobile
- [ ] Pause/resume functionality
- [ ] Audio plays at correct times
- [ ] High scores persist/reload
- [ ] Screen shake looks good
- [ ] Particles fade out correctly
- [ ] UFO spawns randomly
- [ ] Power-ups drop and work

### Automated Testing
- [ ] All unit tests pass
- [ ] No new lint errors
- [ ] Type checking clean
- [ ] Test coverage ≥ 80%

### Performance
- [ ] 60 FPS on CPU < 4 cores
- [ ] Memory usage stable (< 50 MB)
- [ ] Load time < 1 second
- [ ] No console errors

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Code coverage | 80% | ~15% |
| Engine file size | < 300 lines | 1,142 lines |
| Test suite size | 500+ lines | 143 lines |
| Build output size | < 500 KB | ~200 KB |
| Test execution time | < 1 second | < 100ms |
| Known bugs | 0 | 3 (no audio, no pause, no touch) |

---

## References

- [Codebase Analysis](codebase-analysis.md) — Full detailed analysis
- [Progress Tracker](codebase-analysis-progress.md) — Session-by-session progress
- [Desktop Commander Guide](C:\Users\JiriVa\.agents\skills\desktop-commander-guide\SKILL.md) — Desktop Commander documentation

---

**Next Steps:**
1. Review this plan with stakeholders
2. Confirm priorities (or adjust based on business needs)
3. Start Phase 1.1 (extract constants)
4. Update progress tracker as tasks complete
5. Celebrate after each phase!