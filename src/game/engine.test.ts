import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rectsOverlap, hexToRgb } from './geometry';
import { getLeaderboard, addToLeaderboard } from './leaderboard';
import { LEADERBOARD_KEY, HIGH_SCORE_KEY } from './config';
import { COLORS, GAME_CONFIG, SPRITES } from './config';
import { GameEngine } from './engine';
import type { UIState } from './types';

describe('rectsOverlap', () => {
  it('detects overlapping rectangles', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 5, y: 5, w: 10, h: 10 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('detects non-overlapping rectangles', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 20, y: 20, w: 10, h: 10 };
    expect(rectsOverlap(a, b)).toBe(false);
  });
});

describe('hexToRgb', () => {
  it('converts hex to RGB tuple', () => {
    expect(hexToRgb('#4ade80')).toEqual([74, 222, 128]);
  });
});

describe('constants', () => {
  it('COLORS are defined', () => {
    expect(COLORS.bg).toBeDefined();
    expect(COLORS.player).toBeDefined();
  });

  it('SPRITES.player rows have consistent width', () => {
    const playerSprite = SPRITES.player;
    const firstRowLength = playerSprite[0].length;
    for (const row of playerSprite) {
      expect(row.length).toBe(firstRowLength);
    }
  });
});

describe('getLeaderboard', () => {
  let mockStore: Record<string, string>;

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, value: string) => { mockStore[key] = value; },
      removeItem: (key: string) => { delete mockStore[key]; },
      clear: () => { Object.keys(mockStore).forEach((k) => delete mockStore[k]); },
      get length() { return Object.keys(mockStore).length; },
      key: () => null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty array when localStorage is empty', () => {
    expect(getLeaderboard()).toEqual([]);
  });

  it('returns entries sorted by score descending', () => {
    const data = [
      { name: 'Player1', score: 500, date: 1000 },
      { name: 'Player2', score: 1500, date: 2000 },
      { name: 'Player3', score: 100, date: 3000 },
    ];
    mockStore[LEADERBOARD_KEY] = JSON.stringify(data);

    const result = getLeaderboard();
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Player2');
    expect(result[0].score).toBe(1500);
    expect(result[1].name).toBe('Player1');
    expect(result[1].score).toBe(500);
    expect(result[2].name).toBe('Player3');
    expect(result[2].score).toBe(100);
  });

  it('handles corrupt JSON data and returns empty array', () => {
    mockStore[LEADERBOARD_KEY] = 'invalid json!!!';
    expect(getLeaderboard()).toEqual([]);
  });

  it('handles localStorage.getItem throwing an error', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('localStorage unavailable'); },
    });
    expect(getLeaderboard()).toEqual([]);
  });
});

describe('addToLeaderboard', () => {
  let mockStore: Record<string, string>;

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, value: string) => { mockStore[key] = value; },
      removeItem: (key: string) => { delete mockStore[key]; },
      clear: () => { Object.keys(mockStore).forEach((k) => delete mockStore[k]); },
      get length() { return Object.keys(mockStore).length; },
      key: () => null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds entry and getLeaderboard returns it', () => {
    addToLeaderboard('TestPlayer', 1000);
    const lb = getLeaderboard();
    expect(lb).toHaveLength(1);
    expect(lb[0].name).toBe('TestPlayer');
    expect(lb[0].score).toBe(1000);
    expect(lb[0]).toHaveProperty('date');
    expect(typeof lb[0].date).toBe('number');
  });

  it('sorts entries by score descending when adding', () => {
    addToLeaderboard('PlayerLow', 100);
    addToLeaderboard('PlayerHigh', 9999);
    addToLeaderboard('PlayerMid', 500);

    const lb = getLeaderboard();
    expect(lb).toHaveLength(3);
    expect(lb[0].name).toBe('PlayerHigh');
    expect(lb[0].score).toBe(9999);
    expect(lb[1].name).toBe('PlayerMid');
    expect(lb[1].score).toBe(500);
    expect(lb[2].name).toBe('PlayerLow');
    expect(lb[2].score).toBe(100);
  });

  it('trims whitespace from name', () => {
    addToLeaderboard('  Spaced Name  ', 500);
    const lb = getLeaderboard();
    expect(lb[0].name).toBe('Spaced Name');
  });

  it('handles localStorage.setItem error (quota exceeded) without throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
    });
    expect(() => addToLeaderboard('Test', 500)).not.toThrow();
  });
});

describe('GameEngine smoke', () => {
  let mockStore: Record<string, string>;
  let mockCtx: Record<string, unknown>;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    mockStore = {};
    mockStore[HIGH_SCORE_KEY] = '0';
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, value: string) => { mockStore[key] = value; },
      removeItem: (key: string) => { delete mockStore[key]; },
      clear: () => { Object.keys(mockStore).forEach((k) => delete mockStore[k]); },
      get length() { return Object.keys(mockStore).length; },
      key: () => null,
    });

    // Stub rAF/cAF for the engine's game loop
    let capturedCallback: ((timestamp: number) => void) | null = null;
    const _rAF: typeof requestAnimationFrame = (cb) => {
      capturedCallback = cb as (timestamp: number) => void;
      return 1;
    };
    const _cAF: typeof cancelAnimationFrame = () => { capturedCallback = null; };
    vi.stubGlobal('requestAnimationFrame', _rAF);
    vi.stubGlobal('cancelAnimationFrame', _cAF);

    // Persist captured callback so tests can invoke the frame loop
    (globalThis as unknown as Record<string, unknown>).__rAF_callback = capturedCallback;

    // Stub window for InputHandler (which calls window.addEventListener / removeEventListener)
    vi.stubGlobal('window', Object.assign(
      typeof window !== 'undefined' ? window : {},
      { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    ));

    // Minimal mock 2D context
    mockCtx = {
      fillRect: vi.fn(),
      rect: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      arc: vi.fn(),
      measureText: vi.fn(() => ({ width: 0 })),
      set fillStyle(_v: string) { /* noop */ },
      set strokeStyle(_v: string) { /* noop */ },
      set lineWidth(_v: number) { /* noop */ },
      set globalAlpha(_v: number) { /* noop */ },
      set font(_v: string) { /* noop */ },
      set textAlign(_v: string) { /* noop */ },
      set textBaseline(_v: string) { /* noop */ },
      set globalCompositeOperation(_v: string) { /* noop */ },
      set imageSmoothingEnabled(_v: boolean) { /* noop */ },
      get fillStyle() { return '#000'; },
      get strokeStyle() { return '#000'; },
      get lineWidth() { return 1; },
      get globalAlpha() { return 1; },
      get font() { return ''; },
      get textAlign() { return 'left'; },
      get textBaseline() { return 'alphabetic'; },
      get globalCompositeOperation() { return 'source-over'; },
      get imageSmoothingEnabled() { return false; },
    };
    canvas = { getContext: () => mockCtx, width: 800, height: 640 } as unknown as HTMLCanvasElement;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('constructs without throwing', () => {
    expect(() => new GameEngine(canvas, { onUIChange: vi.fn() })).not.toThrow();
  });

  it('start and stop do not throw', () => {
    const engine = new GameEngine(canvas, { onUIChange: vi.fn() });
    expect(() => {
      engine.start();
      engine.stop();
    }).not.toThrow();
  });

  it('calls onUIChange after transitioning to playing and running a frame', () => {
    const onUIChange = vi.fn();
    const engine = new GameEngine(canvas, { onUIChange });
    engine.start();

    // Invoke one frame (status is 'menu', _notifyUI not called in menu)
    const engineAny = engine as unknown as { _frame(): void; g: Record<string, unknown> | null };
    engineAny._frame();
    expect(onUIChange).not.toHaveBeenCalled();

    // Transition to playing
    engine.setStatus('playing');

    // Invoke another frame — _notifyUI is called when status === 'playing'
    engineAny._frame();
    expect(onUIChange).toHaveBeenCalledTimes(1);
    const uiArg = onUIChange.mock.calls[0][0] as UIState;
    expect(uiArg).toHaveProperty('score');
    expect(uiArg).toHaveProperty('highScore');
    expect(uiArg).toHaveProperty('lives');
    expect(uiArg).toHaveProperty('status');
    expect(uiArg).toHaveProperty('rapidFireTime');
    expect(uiArg).toHaveProperty('shieldTime');

    engine.stop();
  });

  it('setStatus updates the state to playing and onUIChange reflects it', () => {
    const onUIChange = vi.fn();
    const engine = new GameEngine(canvas, { onUIChange });
    engine.start();
    engine.setStatus('playing');

    const engineAny = engine as unknown as { _frame(): void };
    engineAny._frame();
    expect(onUIChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'playing' })
    );

    engine.stop();
  });

  it('submitLeaderboard writes through to localStorage', () => {
    const engine = new GameEngine(canvas, { onUIChange: vi.fn() });
    engine.start();

    engine.submitLeaderboard('TestPlayer', 5000);
    const stored = mockStore[GAME_CONFIG.leaderboard.key];
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'TestPlayer', score: 5000 })])
    );

    engine.stop();
  });

  it('_handleStateTransitions is reachable via status changes', () => {
    const onUIChange = vi.fn();
    const engine = new GameEngine(canvas, { onUIChange });
    engine.start();

    // Start in 'menu', invoke frame — no crash
    const engineAny = engine as unknown as { _frame(): void; g: { status: string; keys: Record<string, boolean> } };
    engineAny._frame();

    expect(engineAny.g).toBeDefined();
    expect(engineAny.g.status).toBe('menu');

    // Simulate pressing space by setting the key — _handleStateTransitions checks g.keys[' ']
    engineAny.g.keys[' '] = true;
    engineAny._frame();
    expect(engineAny.g.status).toBe('playing');

    engine.stop();
  });
});