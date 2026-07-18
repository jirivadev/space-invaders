import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameStateManager, setGameOver } from './state-manager';
import { HIGH_SCORE_KEY, LEADERBOARD_KEY } from '../config';
import type { GameState } from '../types';

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
    ...overrides,
  };
}

function makeMockStorage() {
  const store: Record<string, string> = {};
  return {
    store,
    api: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: () => null,
    },
  };
}

describe('state-manager', () => {
  let mock: ReturnType<typeof makeMockStorage>;

  beforeEach(() => {
    mock = makeMockStorage();
    vi.stubGlobal('localStorage', mock.api);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('setGameOver', () => {
    it('transitions to "gameover" when score <= highScore', () => {
      const g = createMockState({ score: 100, highScore: 200 });
      setGameOver(g);
      expect(g.status).toBe('gameover');
      expect(g.highScore).toBe(200);
    });

    it('saves new high score and transitions to "nameEntry" when score > highScore', () => {
      const g = createMockState({ score: 500, highScore: 200 });
      setGameOver(g);
      expect(g.status).toBe('nameEntry');
      expect(g.highScore).toBe(500);
      expect(g.pendingName).toBe('');
      expect(mock.store[HIGH_SCORE_KEY]).toBe('500');
    });

    it('persists high score to localStorage on new-high-score path', () => {
      const g = createMockState({ score: 999, highScore: 0 });
      setGameOver(g);
      expect(mock.store[HIGH_SCORE_KEY]).toBe('999');
    });

    it('is a no-op when status is already "gameover"', () => {
      const g = createMockState({ status: 'gameover', score: 1000, highScore: 0 });
      setGameOver(g);
      expect(g.status).toBe('gameover');
      expect(g.highScore).toBe(0);
      expect(mock.store[HIGH_SCORE_KEY]).toBeUndefined();
    });

    it('is a no-op when status is "nameEntry" (regression: prevents re-entry)', () => {
      const g = createMockState({ status: 'nameEntry', score: 1000, highScore: 0 });
      setGameOver(g);
      expect(g.status).toBe('nameEntry');
      expect(g.highScore).toBe(0);
      expect(mock.store[HIGH_SCORE_KEY]).toBeUndefined();
    });

    it('skips save when saveHighScore=false but still transitions', () => {
      const g = createMockState({ score: 500, highScore: 200 });
      setGameOver(g, false);
      expect(g.status).toBe('gameover');
      expect(g.highScore).toBe(200);
      expect(mock.store[HIGH_SCORE_KEY]).toBeUndefined();
    });

    it('does not throw when localStorage.setItem fails (quota exceeded)', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); },
      });
      const g = createMockState({ score: 500, highScore: 200 });
      expect(() => setGameOver(g)).not.toThrow();
      // status still transitions to nameEntry even though the save failed
      expect(g.status).toBe('nameEntry');
    });
  });

  describe('GameStateManager.createInitialState', () => {
    it('populates leaderboardCache from localStorage', () => {
      mock.store[LEADERBOARD_KEY] = JSON.stringify([
        { name: 'AAA', score: 100, date: 1 },
        { name: 'BBB', score: 50, date: 2 },
      ]);
      const mgr = new GameStateManager();
      const g = mgr.createInitialState();
      expect(g.leaderboardCache).toHaveLength(2);
      expect(g.leaderboardCache[0].name).toBe('AAA');
    });

    it('reads high score from localStorage', () => {
      mock.store[HIGH_SCORE_KEY] = '7777';
      const mgr = new GameStateManager();
      const g = mgr.createInitialState();
      expect(g.highScore).toBe(7777);
    });

    it('falls back to 0 when localStorage value is not a finite number', () => {
      mock.store[HIGH_SCORE_KEY] = 'not-a-number';
      const mgr = new GameStateManager();
      const g = mgr.createInitialState();
      expect(g.highScore).toBe(0);
    });

    it('applies passed score, lives, and status', () => {
      const mgr = new GameStateManager();
      const g = mgr.createInitialState(123, 2, 'gameover');
      expect(g.score).toBe(123);
      expect(g.lives).toBe(2);
      expect(g.status).toBe('gameover');
    });

    it('uses default values when no arguments provided', () => {
      const mgr = new GameStateManager();
      const g = mgr.createInitialState();
      expect(g.score).toBe(0);
      expect(g.lives).toBe(3);
      expect(g.status).toBe('menu');
    });

    it('initializes GameState.initialized to false', () => {
      const mgr = new GameStateManager();
      const g = mgr.createInitialState();
      expect(g.initialized).toBe(false);
    });

    it('creates 4 shields at SHIELD_POSITIONS', () => {
      const mgr = new GameStateManager();
      const g = mgr.createInitialState();
      expect(g.shields).toHaveLength(4);
    });
  });

  describe('GameStateManager.setPlaying', () => {
    it('flips status to "playing" and clears levelAnnounceTimer', () => {
      const mgr = new GameStateManager();
      const g = createMockState({ status: 'menu', levelAnnounceTimer: 999 });
      mgr.setPlaying(g);
      expect(g.status).toBe('playing');
      expect(g.levelAnnounceTimer).toBe(0);
    });
  });

  describe('GameStateManager.setMenu', () => {
    it('flips status to "menu" and clears the UFO', () => {
      const mgr = new GameStateManager();
      const g = createMockState({
        status: 'gameover',
        ufo: { x: 0, y: 0, w: 48, h: 24, dx: 2.5 },
        levelAnnounceTimer: 500,
      });
      mgr.setMenu(g);
      expect(g.status).toBe('menu');
      expect(g.ufo).toBeNull();
      expect(g.levelAnnounceTimer).toBe(0);
    });
  });
});
