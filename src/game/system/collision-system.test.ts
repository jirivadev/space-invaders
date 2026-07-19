import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollisionSystem } from './collision-system';
import type { GameState, Bullet, Alien, Player, UFO, Shield, PowerUp } from '../types';

function createMockState(overrides: Partial<GameState> = {}): GameState {
  return {
    status: 'playing',
    score: 0,
    highScore: 0,
    level: 1,
    levelAnnounceTimer: 0,
    lives: 3,
    aliens: [],
    bullets: [],
    shields: [],
    ufo: null,
    particles: [],
    player: {
      x: 100,
      y: 500,
      w: 27,
      h: 21,
      speed: 5,
      cooldown: 0,
      invulnerable: 0,
      diedAt: 0,
    },
    keys: {},
    alienDir: 1,
    alienStepTimer: 0,
    alienFrame: 0,
    alienMoveDown: false,
    ufoTimer: 0,
    alienShootTimer: 0,
    stars: [],
    powerUps: [],
    activePowerUps: { rapidFire: 0, shield: 0 },
    pendingName: '',
    lastTime: 0,
    initialized: false,
    leaderboardCache: [],
    screenOpenedAt: 0,
    ...overrides,
  };
}

function makeBullet(overrides: Partial<Bullet> = {}): Bullet {
  return {
    x: 100,
    y: 200,
    w: 4,
    h: 12,
    dy: -9,
    owner: 'player',
    trail: [],
    ...overrides,
  };
}

function makeAlien(overrides: Partial<Alien> = {}): Alien {
  return {
    x: 100,
    y: 100,
    w: 27,
    h: 24,
    type: 'squid',
    alive: true,
    dyingAt: 0,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    x: 100,
    y: 500,
    w: 27,
    h: 21,
    speed: 5,
    cooldown: 0,
    invulnerable: 0,
    diedAt: 0,
    ...overrides,
  };
}

function makeUFO(overrides: Partial<UFO> = {}): UFO {
  return {
    x: 200,
    y: 35,
    w: 48,
    h: 24,
    dx: 2.5,
    dyingAt: 0,
    ...overrides,
  };
}

function makeShield(overrides: Partial<Shield> = {}): Shield {
  return {
    x: 110,
    y: 480,
    cols: 24,
    rows: 16,
    pixelSize: 3,
    pixels: Array.from({ length: 16 }, () => Array(24).fill(true)),
    ...overrides,
  };
}

function makePowerUp(overrides: Partial<PowerUp> = {}): PowerUp {
  return {
    x: 100,
    y: 200,
    w: 20,
    h: 20,
    dy: 2,
    type: 'rapidFire',
    spawnedAt: 0,
    ...overrides,
  };
}

describe('CollisionSystem', () => {
  let system: CollisionSystem;

  beforeEach(() => {
    system = new CollisionSystem();
  });

  describe('checkBulletAlienCollision', () => {
    it('returns false for a dead alien', () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, alive: false });
      expect(system.checkBulletAlienCollision(bullet, alien, state)).toBe(false);
    });

    it('returns false when bullet and alien do not overlap', () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 0, y: 0 });
      const alien = makeAlien({ x: 500, y: 500 });
      expect(system.checkBulletAlienCollision(bullet, alien, state)).toBe(false);
    });

    it('hits a squid: score += 30, alien starts dying, no particles yet', () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: 'squid' });
      const result = system.checkBulletAlienCollision(bullet, alien, state);
      expect(result).toBe(true);
      expect(alien.alive).toBe(true); // still alive during death animation
      expect(alien.dyingAt).toBeGreaterThan(0);
      expect(state.score).toBe(30);
      expect(state.particles.length).toBe(0); // particles spawned later by engine
    });

    it('hits a crab: score += 20', () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: 'crab' });
      system.checkBulletAlienCollision(bullet, alien, state);
      expect(state.score).toBe(20);
    });

    it('hits an octopus: score += 10', () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: 'octopus' });
      system.checkBulletAlienCollision(bullet, alien, state);
      expect(state.score).toBe(10);
    });

    it('can spawn a power-up (random < 0.1)', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.05);
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: 'squid' });
      system.checkBulletAlienCollision(bullet, alien, state);
      expect(state.powerUps.length).toBe(1);
      expect(state.powerUps[0]).toHaveProperty('type');
      expect(['rapidFire', 'shield', 'bomb']).toContain(state.powerUps[0].type);
      vi.restoreAllMocks();
    });

    it('does not spawn a power-up when random >= 0.1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: 'squid' });
      system.checkBulletAlienCollision(bullet, alien, state);
      expect(state.powerUps.length).toBe(0);
      vi.restoreAllMocks();
    });

    it('spawns at least one power-up over many runs (~10% chance)', () => {
      const bullet = makeBullet({ x: 100, y: 100 });
      let spawned = 0;
      for (let i = 0; i < 200; i++) {
        const alien = makeAlien({ x: 100, y: 100, type: 'squid' });
        const s = createMockState();
        // Reset particles count each iteration by creating a fresh state
        if (system.checkBulletAlienCollision(bullet, alien, s)) {
          if (s.powerUps.length > 0) spawned++;
        }
      }
      expect(spawned).toBeGreaterThan(0);
    });
  });

  describe('checkBulletPlayerCollision', () => {
    it('returns false when player is invulnerable', () => {
      const bullet = makeBullet({ x: 100, y: 500 });
      const player = makePlayer({ x: 100, y: 500, invulnerable: 100 });
      expect(system.checkBulletPlayerCollision(bullet, player)).toBe(false);
    });

    it('returns false when bullet and player do not overlap', () => {
      const bullet = makeBullet({ x: 0, y: 0 });
      const player = makePlayer({ x: 500, y: 500 });
      expect(system.checkBulletPlayerCollision(bullet, player)).toBe(false);
    });

    it('returns true when bullet overlaps player', () => {
      const bullet = makeBullet({ x: 100, y: 500 });
      const player = makePlayer({ x: 100, y: 500 });
      expect(system.checkBulletPlayerCollision(bullet, player)).toBe(true);
    });
  });

  describe('checkBulletUFOCollision', () => {
    it('returns false when ufo is null', () => {
      const state = createMockState();
      const bullet = makeBullet();
      const ufo = null as unknown as UFO;
      expect(system.checkBulletUFOCollision(bullet, ufo, state)).toBe(false);
    });

    it('returns false when bullet and ufo do not overlap', () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 0, y: 0 });
      const ufo = makeUFO({ x: 500, y: 500 });
      expect(system.checkBulletUFOCollision(bullet, ufo, state)).toBe(false);
    });

    it('hits UFO: score increased, UFO starts dying, powerUps cleared', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic points index 0 = 50
      const state = createMockState({ powerUps: [makePowerUp(), makePowerUp()] });
      const bullet = makeBullet({ x: 200, y: 35 });
      const ufo = makeUFO({ x: 200, y: 35 });
      const result = system.checkBulletUFOCollision(bullet, ufo, state);
      expect(result).toBe(true);
      expect(state.score).toBe(50);
      expect(ufo.dyingAt).toBeGreaterThan(0);
      expect(state.particles.length).toBe(0); // particles spawned later by engine
      expect(state.powerUps).toHaveLength(0);
      vi.restoreAllMocks();
    });
  });

  describe('checkPlayerBulletShield', () => {
    it('returns false when bullet does not overlap shield rect', () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 0, y: 0 });
      const shield = makeShield({ x: 500, y: 500 });
      expect(system.checkPlayerBulletShield(bullet, shield, state)).toBe(false);
    });

    it('returns true on overlap and adds particles', () => {
      const state = createMockState();
      // Shield at (110, 480), 24 cols * 3 = 72 wide, 16 rows * 3 = 48 tall
      const bullet = makeBullet({ x: 120, y: 490 });
      const shield = makeShield({ x: 110, y: 480 });
      const result = system.checkPlayerBulletShield(bullet, shield, state);
      expect(result).toBe(true);
      expect(state.particles.length).toBeGreaterThan(0);
    });
  });

  describe('checkPowerUpCollision', () => {
    it('returns false when no overlap', () => {
      const powerUp = makePowerUp({ x: 0, y: 0 });
      const player = makePlayer({ x: 500, y: 500 });
      expect(system.checkPowerUpCollision(powerUp, player)).toBe(false);
    });

    it('returns true on overlap', () => {
      const powerUp = makePowerUp({ x: 100, y: 500 });
      const player = makePlayer({ x: 100, y: 500 });
      expect(system.checkPowerUpCollision(powerUp, player)).toBe(true);
    });
  });

  describe('applyPowerUps', () => {
    it('decrements rapidFire by dt when > 0', () => {
      const state = createMockState({ activePowerUps: { rapidFire: 100, shield: 0 } });
      system.applyPowerUps(state, 16);
      expect(state.activePowerUps.rapidFire).toBe(84);
    });

    it('decrements shield by dt when > 0', () => {
      const state = createMockState({ activePowerUps: { rapidFire: 0, shield: 100 } });
      system.applyPowerUps(state, 16);
      expect(state.activePowerUps.shield).toBe(84);
    });

    it('clamps rapidFire at 0 when decrement would go negative', () => {
      const state = createMockState({ activePowerUps: { rapidFire: 5, shield: 0 } });
      system.applyPowerUps(state, 16);
      expect(state.activePowerUps.rapidFire).toBe(0);
    });

    it('leaves inactive timers at 0 (no underflow)', () => {
      const state = createMockState({ activePowerUps: { rapidFire: 0, shield: 0 } });
      system.applyPowerUps(state, 16);
      expect(state.activePowerUps.rapidFire).toBe(0);
      expect(state.activePowerUps.shield).toBe(0);
    });
  });
});
