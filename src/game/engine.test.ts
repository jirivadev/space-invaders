import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rectsOverlap, hexToRgb, getLeaderboard, addToLeaderboard } from './system/entity-factory';
import { LEADERBOARD_KEY } from './constants';

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
    const { COLORS } = require('./config');
    expect(COLORS.bg).toBeDefined();
    expect(COLORS.player).toBeDefined();
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