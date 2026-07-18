import { describe, it, expect, vi, afterEach } from 'vitest';
import { InputHandler } from './input-handler';
import { GAME_CONFIG } from '../config';
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

function makeKeyEvent(key: string): KeyboardEvent {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent;
}

interface HandlerSetup {
  handler: InputHandler;
  handlers: Record<string, (...args: unknown[]) => void>;
  onAddToLeaderboard: ReturnType<typeof vi.fn>;
  onStateChange: ReturnType<typeof vi.fn>;
  stop: () => void;
}

function setupHandler(g: GameState): HandlerSetup {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const addEventListener = vi.fn((event: string, cb: unknown) => {
    handlers[event] = cb as (...args: unknown[]) => void;
  });
  const removeEventListener = vi.fn();
  vi.stubGlobal('window', { addEventListener, removeEventListener });

  const onAddToLeaderboard = vi.fn();
  const onStateChange = vi.fn();
  const onUIChange = vi.fn();
  const onGetState = vi.fn(() => g);
  const handler = new InputHandler({ onUIChange, onGetState, onAddToLeaderboard, onStateChange });
  handler.start();

  return {
    handler,
    handlers,
    onAddToLeaderboard,
    onStateChange,
    stop: () => {
      handler.stop();
      vi.unstubAllGlobals();
    },
  };
}

describe('InputHandler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('name-entry flow (private _handleNameEntry via keydown)', () => {
    it('appends printable keys to pendingName when status is "nameEntry"', () => {
      const g = createMockState({ status: 'nameEntry' });
      const { handlers, stop } = setupHandler(g);
      handlers.keydown(makeKeyEvent('A'));
      handlers.keydown(makeKeyEvent('B'));
      handlers.keydown(makeKeyEvent('C'));
      expect(g.pendingName).toBe('ABC');
      stop();
    });

    it('truncates pendingName on Backspace', () => {
      const g = createMockState({ status: 'nameEntry', pendingName: 'ABC' });
      const { handlers, stop } = setupHandler(g);
      handlers.keydown(makeKeyEvent('Backspace'));
      expect(g.pendingName).toBe('AB');
      stop();
    });

    it('Backspace on empty pendingName is a no-op', () => {
      const g = createMockState({ status: 'nameEntry', pendingName: '' });
      const { handlers, stop } = setupHandler(g);
      handlers.keydown(makeKeyEvent('Backspace'));
      expect(g.pendingName).toBe('');
      stop();
    });

    it(`caps pendingName at nameEntryMaxChars (${GAME_CONFIG.ui.nameEntryMaxChars})`, () => {
      const g = createMockState({ status: 'nameEntry' });
      const { handlers, stop } = setupHandler(g);
      for (let i = 0; i < GAME_CONFIG.ui.nameEntryMaxChars + 4; i++) {
        handlers.keydown(makeKeyEvent(String.fromCharCode(65 + (i % 26))));
      }
      expect(g.pendingName.length).toBe(GAME_CONFIG.ui.nameEntryMaxChars);
      stop();
    });

    it('on Enter: calls onAddToLeaderboard with trimmed name and transitions to "menu"', () => {
      const g = createMockState({ status: 'nameEntry', pendingName: 'AAA', score: 1000 });
      const { handlers, onAddToLeaderboard, onStateChange, stop } = setupHandler(g);
      handlers.keydown(makeKeyEvent('Enter'));
      expect(onAddToLeaderboard).toHaveBeenCalledWith('AAA', 1000);
      expect(onStateChange).toHaveBeenCalledWith('menu');
      stop();
    });

    it('on Enter: uses "AAA" fallback when name is empty', () => {
      const g = createMockState({ status: 'nameEntry', pendingName: '', score: 500 });
      const { handlers, onAddToLeaderboard, stop } = setupHandler(g);
      handlers.keydown(makeKeyEvent('Enter'));
      expect(onAddToLeaderboard).toHaveBeenCalledWith('AAA', 500);
      stop();
    });

    it('on Enter: uses "AAA" fallback when name is whitespace only', () => {
      const g = createMockState({ status: 'nameEntry', pendingName: '   ', score: 500 });
      const { handlers, onAddToLeaderboard, stop } = setupHandler(g);
      handlers.keydown(makeKeyEvent('Enter'));
      expect(onAddToLeaderboard).toHaveBeenCalledWith('AAA', 500);
      stop();
    });

    it('on Enter: trims whitespace before sending to leaderboard', () => {
      const g = createMockState({ status: 'nameEntry', pendingName: '  Hi  ', score: 100 });
      const { handlers, onAddToLeaderboard, stop } = setupHandler(g);
      handlers.keydown(makeKeyEvent('Enter'));
      expect(onAddToLeaderboard).toHaveBeenCalledWith('Hi', 100);
      stop();
    });

    it('preventDefault is called for Enter during name-entry', () => {
      const g = createMockState({ status: 'nameEntry' });
      const { handlers, stop } = setupHandler(g);
      const e = makeKeyEvent('Enter');
      handlers.keydown(e);
      expect(e.preventDefault).toHaveBeenCalled();
      stop();
    });
  });

  describe('non-name-entry: key state capture', () => {
    it('records pressed keys into g.keys', () => {
      const g = createMockState({ status: 'playing' });
      const { handlers, stop } = setupHandler(g);
      handlers.keydown(makeKeyEvent('ArrowLeft'));
      expect(g.keys['ArrowLeft']).toBe(true);
      stop();
    });

    it('does not enter name-entry flow when status is "playing"', () => {
      const g = createMockState({ status: 'playing' });
      const { handlers, onAddToLeaderboard, stop } = setupHandler(g);
      handlers.keydown(makeKeyEvent('A'));
      expect(g.pendingName).toBe('');
      expect(onAddToLeaderboard).not.toHaveBeenCalled();
      stop();
    });
  });

  describe('processInput', () => {
    it('moves player left when ArrowLeft is held', () => {
      const g = createMockState({
        status: 'playing',
        keys: { ArrowLeft: true },
        player: { x: 400, y: 500, w: 27, h: 21, speed: 5, cooldown: 0, invulnerable: 0 },
      });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      handler.processInput(g, 16);
      expect(g.player.x).toBeLessThan(400);
    });

    it('moves player right when ArrowRight is held', () => {
      const g = createMockState({
        status: 'playing',
        keys: { ArrowRight: true },
        player: { x: 400, y: 500, w: 27, h: 21, speed: 5, cooldown: 0, invulnerable: 0 },
      });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      handler.processInput(g, 16);
      expect(g.player.x).toBeGreaterThan(400);
    });

    it('clamps player.x to left boundary (boundaryPadding)', () => {
      const g = createMockState({
        status: 'playing',
        keys: { ArrowLeft: true },
        player: { x: GAME_CONFIG.player.boundaryPadding + 1, y: 500, w: 27, h: 21, speed: 5, cooldown: 0, invulnerable: 0 },
      });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      handler.processInput(g, 16);
      expect(g.player.x).toBe(GAME_CONFIG.player.boundaryPadding);
    });

    it('clamps player.x to right boundary (canvas width - w - padding)', () => {
      const g = createMockState({
        status: 'playing',
        keys: { ArrowRight: true },
        player: { x: GAME_CONFIG.canvas.width - 27 - GAME_CONFIG.player.boundaryPadding - 1, y: 500, w: 27, h: 21, speed: 5, cooldown: 0, invulnerable: 0 },
      });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      handler.processInput(g, 16);
      expect(g.player.x).toBe(GAME_CONFIG.canvas.width - 27 - GAME_CONFIG.player.boundaryPadding);
    });

    it('does not move the player when status is "menu"', () => {
      const g = createMockState({
        status: 'menu',
        keys: { ArrowLeft: true },
        player: { x: 400, y: 500, w: 27, h: 21, speed: 5, cooldown: 0, invulnerable: 0 },
      });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      handler.processInput(g, 16);
      expect(g.player.x).toBe(400);
    });

    it('does not move the player when status is "nameEntry"', () => {
      const g = createMockState({
        status: 'nameEntry',
        keys: { ArrowLeft: true },
        player: { x: 400, y: 500, w: 27, h: 21, speed: 5, cooldown: 0, invulnerable: 0 },
      });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      handler.processInput(g, 16);
      expect(g.player.x).toBe(400);
    });
  });

  describe('checkForShoot', () => {
    it('returns true when cooldown is 0 and Space is held', () => {
      const g = createMockState({ keys: { ' ': true } });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      expect(handler.checkForShoot(g)).toBe(true);
    });

    it('returns true when cooldown is 0 and Spacebar is held', () => {
      const g = createMockState({ keys: { Spacebar: true } });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      expect(handler.checkForShoot(g)).toBe(true);
    });

    it('returns false when cooldown is active', () => {
      const g = createMockState({ keys: { ' ': true }, player: { x: 0, y: 0, w: 27, h: 21, speed: 5, cooldown: 100, invulnerable: 0 } });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      expect(handler.checkForShoot(g)).toBe(false);
    });

    it('returns false when no shoot key is held', () => {
      const g = createMockState({ keys: {} });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      expect(handler.checkForShoot(g)).toBe(false);
    });
  });

  describe('start / stop', () => {
    it('registers listeners on start', () => {
      const addEventListener = vi.fn();
      vi.stubGlobal('window', { addEventListener, removeEventListener: vi.fn() });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      handler.start();
      expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
      expect(addEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    it('removes listeners on stop', () => {
      const addEventListener = vi.fn();
      const removeEventListener = vi.fn();
      vi.stubGlobal('window', { addEventListener, removeEventListener });
      const handler = new InputHandler({ onUIChange: vi.fn() });
      handler.start();
      handler.stop();
      expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
      expect(removeEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
    });
  });

  describe('blur handling', () => {
    it('clears g.keys on window blur to avoid stuck-key state', () => {
      const g = createMockState({ status: 'playing', keys: { ArrowLeft: true, ' ': true } });
      const { handlers, stop } = setupHandler(g);
      handlers.blur();
      expect(g.keys).toEqual({});
      stop();
    });
  });
});
