import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialState,
  setPlaying,
  setMenu,
  setGameOver,
  resetHighScoreCache,
  resetGameState,
} from "./state-manager";
import { HIGH_SCORE_KEY, LEADERBOARD_KEY } from "../config";
import { createMockState } from "../test-utils/factory";

function makeMockStorage() {
  const store: Record<string, string> = {};
  return {
    store,
    api: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
      get length() {
        return Object.keys(store).length;
      },
      key: () => null,
    },
  };
}

describe("state-manager", () => {
  let mock: ReturnType<typeof makeMockStorage>;
  const NOW = 1000;

  beforeEach(() => {
    resetHighScoreCache();
    mock = makeMockStorage();
    vi.stubGlobal("localStorage", mock.api);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("setGameOver", () => {
    it('transitions to "gameover" when score <= highScore', () => {
      const g = createMockState({ score: 100, highScore: 200 });
      setGameOver(g, NOW);
      expect(g.status).toBe("gameover");
      expect(g.highScore).toBe(200);
    });

    it('saves new high score and transitions to "nameEntry" when score > highScore', () => {
      const g = createMockState({ score: 500, highScore: 200 });
      setGameOver(g, NOW);
      expect(g.status).toBe("nameEntry");
      expect(g.highScore).toBe(500);
      expect(g.pendingName).toBe("");
      expect(mock.store[HIGH_SCORE_KEY]).toBe("500");
    });

    it("persists high score to localStorage on new-high-score path", () => {
      const g = createMockState({ score: 999, highScore: 0 });
      setGameOver(g, NOW);
      expect(mock.store[HIGH_SCORE_KEY]).toBe("999");
    });

    it('is a no-op when status is already "gameover"', () => {
      const g = createMockState({
        status: "gameover",
        score: 1000,
        highScore: 0,
      });
      setGameOver(g, NOW);
      expect(g.status).toBe("gameover");
      expect(g.highScore).toBe(0);
      expect(mock.store[HIGH_SCORE_KEY]).toBeUndefined();
    });

    it('is a no-op when status is "nameEntry" (regression: prevents re-entry)', () => {
      const g = createMockState({
        status: "nameEntry",
        score: 1000,
        highScore: 0,
      });
      setGameOver(g, NOW);
      expect(g.status).toBe("nameEntry");
      expect(g.highScore).toBe(0);
      expect(mock.store[HIGH_SCORE_KEY]).toBeUndefined();
    });

    it("skips save when saveHighScore=false but still transitions", () => {
      const g = createMockState({ score: 500, highScore: 200 });
      setGameOver(g, NOW, false);
      expect(g.status).toBe("gameover");
      expect(g.highScore).toBe(200);
      expect(mock.store[HIGH_SCORE_KEY]).toBeUndefined();
    });

    it("does not throw when localStorage.setItem fails (quota exceeded)", () => {
      vi.stubGlobal("localStorage", {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      });
      const g = createMockState({ score: 500, highScore: 200 });
      expect(() => setGameOver(g, NOW)).not.toThrow();
      // status still transitions to nameEntry even though the save failed
      expect(g.status).toBe("nameEntry");
    });
  });

  describe("createInitialState", () => {
    it("populates leaderboardCache from localStorage", () => {
      mock.store[LEADERBOARD_KEY] = JSON.stringify([
        { name: "AAA", score: 100, date: 1 },
        { name: "BBB", score: 50, date: 2 },
      ]);
      const g = createInitialState(0, 3, "menu", NOW);
      expect(g.leaderboardCache).toHaveLength(2);
      expect(g.leaderboardCache[0].name).toBe("AAA");
    });

    it("reads high score from localStorage", () => {
      mock.store[HIGH_SCORE_KEY] = "7777";
      const g = createInitialState(0, 3, "menu", NOW);
      expect(g.highScore).toBe(7777);
    });

    it("falls back to 0 when localStorage value is not a finite number", () => {
      mock.store[HIGH_SCORE_KEY] = "not-a-number";
      const g = createInitialState(0, 3, "menu", NOW);
      expect(g.highScore).toBe(0);
    });

    it("applies passed score, lives, and status", () => {
      const g = createInitialState(123, 2, "gameover", NOW);
      expect(g.score).toBe(123);
      expect(g.lives).toBe(2);
      expect(g.status).toBe("gameover");
    });

    it("uses default values when no arguments provided", () => {
      const g = createInitialState(0, 3, "menu", NOW);
      expect(g.score).toBe(0);
      expect(g.lives).toBe(3);
      expect(g.status).toBe("menu");
    });

    it("initializes GameState.initialized to false", () => {
      const g = createInitialState(0, 3, "menu", NOW);
      expect(g.initialized).toBe(false);
    });

    it("creates 4 shields at SHIELD_POSITIONS", () => {
      const g = createInitialState(0, 3, "menu", NOW);
      expect(g.shields).toHaveLength(4);
    });
  });

  describe("setPlaying", () => {
    it('flips status to "playing" and clears levelAnnounceTimer', () => {
      const g = createMockState({ status: "menu", levelAnnounceTimer: 999 });
      setPlaying(g);
      expect(g.status).toBe("playing");
      expect(g.levelAnnounceTimer).toBe(0);
    });
  });

  describe("setMenu", () => {
    it('flips status to "menu" and clears the UFO', () => {
      const g = createMockState({
        status: "gameover",
        ufo: { x: 0, y: 0, w: 48, h: 24, dx: 2.5, dyingAt: 0 },
        levelAnnounceTimer: 500,
      });
      setMenu(g, NOW);
      expect(g.status).toBe("menu");
      expect(g.ufo).toBeNull();
      expect(g.levelAnnounceTimer).toBe(0);
    });
  });

  describe("resetGameState", () => {
    it("resets score, lives, level, and gameplay collections", () => {
      const g = createMockState({
        score: 999,
        lives: 1,
        level: 5,
        bullets: [
          {
            x: 0,
            y: 0,
            previousY: 0,
            w: 4,
            h: 12,
            dy: -9,
            owner: "player",
            trail: [],
          },
        ],
        particles: [
          {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            life: 100,
            maxLife: 100,
            color: "#fff",
            size: 1,
            type: "spark" as const,
          },
        ],
        powerUps: [
          {
            x: 0,
            y: 0,
            w: 20,
            h: 20,
            dy: 2,
            type: "rapidFire" as const,
            spawnedAt: 0,
          },
        ],
        activePowerUps: { rapidFire: 100, shield: 100 },
      });
      resetGameState(g);
      expect(g.score).toBe(0);
      expect(g.lives).toBe(3);
      expect(g.level).toBe(1);
      expect(g.bullets).toHaveLength(0);
      expect(g.particles).toHaveLength(0);
      expect(g.powerUps).toHaveLength(0);
      expect(g.activePowerUps).toEqual({ rapidFire: 0, shield: 0 });
      expect(g.shields).toHaveLength(4);
    });

    it("keeps high score intact", () => {
      const g = createMockState({ highScore: 1234 });
      resetGameState(g);
      expect(g.highScore).toBe(1234);
    });
  });
});
