import type { GameState, Bullet, Alien, Player, UFO, Shield, PowerUp } from '../types';

export function createMockState(overrides: Partial<GameState> = {}): GameState {
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

export function makeBullet(overrides: Partial<Bullet> = {}): Bullet {
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

export function makeAlien(overrides: Partial<Alien> = {}): Alien {
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

export function makePlayer(overrides: Partial<Player> = {}): Player {
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

export function makeUFO(overrides: Partial<UFO> = {}): UFO {
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

export function makeShield(overrides: Partial<Shield> = {}): Shield {
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

export function makePowerUp(overrides: Partial<PowerUp> = {}): PowerUp {
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
