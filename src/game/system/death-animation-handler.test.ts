import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processDeathAnimations } from "./death-animation-handler";
import { LevelSystem } from "./level-system";
import { GAME_CONFIG, HIGH_SCORE_KEY } from "../config";
import { createMockState, makeAlien, makeUFO } from "../test-utils/factory";

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

// createExplosionParticles(N) yields N particles plus one "flash" particle
// when N >= 8, and createImpactFlash adds one more flash on player death.
const EXPLOSION_40 = 41; // 40 + flash
const EXPLOSION_50 = 51; // 50 + flash

describe("processDeathAnimations", () => {
  describe("dying aliens", () => {
    const duration = GAME_CONFIG.death.alienDuration;

    it("does nothing before the animation expires", () => {
      const alien = makeAlien({
        type: "squid",
        alive: true,
        dyingAt: 1000,
        pendingScore: 30,
      });
      const g = createMockState({ aliens: [alien], score: 0 });

      processDeathAnimations(g, 1000 + duration - 1); // just under the window

      expect(g.score).toBe(0);
      expect(alien.pendingScore).toBe(30);
      expect(alien.alive).toBe(true);
      expect(alien.dyingAt).toBe(1000);
      expect(g.particles).toHaveLength(0);
    });

    it("pays the deferred score, marks the alien dead, and spawns an explosion", () => {
      const alien = makeAlien({
        type: "squid",
        alive: true,
        dyingAt: 1000,
        pendingScore: 30,
      });
      const g = createMockState({ aliens: [alien], score: 0 });

      processDeathAnimations(g, 1000 + duration + 1);

      expect(g.score).toBe(30);
      expect(alien.pendingScore).toBe(0);
      expect(alien.alive).toBe(false);
      expect(alien.dyingAt).toBe(0);
      expect(g.particles).toHaveLength(EXPLOSION_40);
    });

    it("pays zero when an alien dies without a pendingScore", () => {
      const alien = makeAlien({ alive: true, dyingAt: 1000 });
      const g = createMockState({ aliens: [alien], score: 10 });

      processDeathAnimations(g, 1000 + duration + 1);

      expect(g.score).toBe(10);
      expect(alien.alive).toBe(false);
      expect(alien.dyingAt).toBe(0);
      expect(g.particles).toHaveLength(EXPLOSION_40);
    });

    it("pays out every expired dying alien", () => {
      const squid = makeAlien({
        type: "squid",
        alive: true,
        dyingAt: 1000,
        pendingScore: 30,
      });
      const crab = makeAlien({
        type: "crab",
        alive: true,
        dyingAt: 1000,
        pendingScore: 20,
      });
      const g = createMockState({ aliens: [squid, crab], score: 0 });

      processDeathAnimations(g, 1000 + duration + 1);

      expect(g.score).toBe(50);
      expect(squid.alive).toBe(false);
      expect(crab.alive).toBe(false);
    });
  });

  describe("dying UFO", () => {
    const duration = GAME_CONFIG.death.ufoDuration;

    it("does nothing before the animation expires", () => {
      const ufo = makeUFO({ dyingAt: 1000 });
      const g = createMockState({ ufo });

      processDeathAnimations(g, 1000 + duration - 1);

      expect(g.ufo).toBe(ufo);
      expect(g.particles).toHaveLength(0);
    });

    it("spawns an explosion and removes the UFO after expiry", () => {
      const ufo = makeUFO({ dyingAt: 1000 });
      const g = createMockState({ ufo });

      processDeathAnimations(g, 1000 + duration + 1);

      expect(g.ufo).toBeNull();
      expect(g.particles).toHaveLength(EXPLOSION_40);
    });
  });

  describe("player death", () => {
    const duration = GAME_CONFIG.death.playerDuration;
    let mock: ReturnType<typeof makeMockStorage>;

    beforeEach(() => {
      mock = makeMockStorage();
      vi.stubGlobal("localStorage", mock.api);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("does not trigger game over before the animation expires", () => {
      const g = createMockState({
        status: "playing",
        score: 100,
        highScore: 200,
      });
      g.player.diedAt = 1000;

      processDeathAnimations(g, 1000 + duration - 1);

      expect(g.player.diedAt).toBe(1000);
      expect(g.status).toBe("playing");
      expect(g.particles).toHaveLength(0);
    });

    it("spawns an explosion and transitions to gameover after expiry", () => {
      const g = createMockState({
        status: "playing",
        score: 100,
        highScore: 200,
      });
      g.player.diedAt = 1000;

      processDeathAnimations(g, 1000 + duration + 1);

      expect(g.player.diedAt).toBe(0);
      expect(g.status).toBe("gameover");
      expect(g.screenOpenedAt).toBe(1000 + duration + 1); // stamped by setGameOver with the threaded `now`
      // 50 explosion particles + explosion flash + impact flash = 52
      expect(g.particles).toHaveLength(EXPLOSION_50 + 1);
    });

    it("transitions to nameEntry and persists a new high score", () => {
      const g = createMockState({
        status: "playing",
        score: 500,
        highScore: 200,
      });
      g.player.diedAt = 1000;

      processDeathAnimations(g, 1000 + duration + 1);

      expect(g.player.diedAt).toBe(0);
      expect(g.status).toBe("nameEntry");
      expect(g.highScore).toBe(500);
      expect(mock.store[HIGH_SCORE_KEY]).toBe("500");
    });
  });

  describe("level-clear interaction (R-1 regression)", () => {
    it("pays the final alien's score before the level can complete", () => {
      const levelSystem = new LevelSystem();
      const lastAlien = makeAlien({
        type: "squid",
        alive: true,
        dyingAt: 1000,
        pendingScore: 30,
      });
      const g = createMockState({
        level: 1,
        aliens: [lastAlien],
        aliveAliens: [], // cache already dropped the dying alien
        activeAliens: [lastAlien],
      });

      // The level must wait for the in-flight death animation.
      expect(levelSystem.checkLevelComplete(g)).toBe(false);

      // Death pipeline resolves the kill: score paid, death flags cleared.
      processDeathAnimations(g, 1000 + GAME_CONFIG.death.alienDuration + 1);
      expect(g.score).toBe(30);
      expect(lastAlien.alive).toBe(false);
      expect(lastAlien.dyingAt).toBe(0);

      // Only now may the level complete — the score is retained.
      expect(levelSystem.checkLevelComplete(g)).toBe(true);
      expect(g.level).toBe(2);
      expect(g.aliens.length).toBeGreaterThan(0);
      expect(g.score).toBe(30);
    });
  });
});
