import { describe, it, expect, vi, beforeEach } from "vitest";
import { LevelSystem } from "./level-system";
import { GAME_CONFIG } from "../config";
import { createMockState, makeAlien } from "../test-utils/factory";

describe("LevelSystem", () => {
  let system: LevelSystem;

  beforeEach(() => {
    system = new LevelSystem();
  });

  describe("getAlienStepInterval", () => {
    it("returns correct interval when all aliens are alive", () => {
      const aliens = Array.from({ length: 5 }, () =>
        makeAlien({ alive: true })
      );
      const g = createMockState({ level: 1, aliens });
      const interval = system.getAlienStepInterval(g);
      // total = 5, alive = 5, speedFactor = (5/5)^1.6 = 1^1.6 = 1
      // stepInterval = Math.max(80, 700 / (1 + 1)) / 1.0 = 350
      expect(interval).toBe(350);
    });

    it("clamps to 80 when few aliens remain", () => {
      const aliens = [
        makeAlien({ alive: true }),
        makeAlien({ alive: false }),
        makeAlien({ alive: false }),
        makeAlien({ alive: false }),
        makeAlien({ alive: false }),
      ];
      const g = createMockState({ level: 1, aliens });
      const interval = system.getAlienStepInterval(g);
      // total = 5, alive = 1, speedFactor = (5/1)^1.6 = 5^1.6 ≈ 12.01
      // stepInterval = Math.max(80, 700 / (1 + 12.01)) / 1.0 = Math.max(80, 53.77) = 80
      expect(interval).toBe(80);
    });

    it("handles zero alive aliens (Math.max(1, 0) guard)", () => {
      const aliens = [makeAlien({ alive: false })];
      const g = createMockState({ level: 1, aliens });
      const interval = system.getAlienStepInterval(g);
      // total = 1, alive = 0 -> Math.max(1, 0) = 1, speedFactor = (1/1)^1.6 = 1
      // stepInterval = Math.max(80, 700 / 2) / 1.0 = 350
      expect(interval).toBe(350);
    });

    it("allows interval to drop below 80 at higher difficulty levels", () => {
      // Create a situation where the formula would produce < 80
      const aliens = Array.from({ length: 55 }, (_, i) =>
        makeAlien({ alive: i === 0, x: 100 + i * 10 })
      );
      const g = createMockState({ level: 10, aliens });
      const interval = system.getAlienStepInterval(g);
      // Should be clamped to at least 80 / speedMultiplier
      // level 10: speedMultiplier = Math.min(4, 2.0 + 5 * 0.3) = 3.5
      // total = 55, alive = 1, factor = (55/1)^1.6 ≈ 55^1.6 ≈ 602.5
      // base = Math.max(80, 700 / (1+602.5)) = Math.max(80, 1.16) = 80
      // interval = 80 / 3.5 ≈ 22.86
      expect(interval).toBeLessThan(80);
      expect(interval).toBeGreaterThan(0);
    });
  });

  describe("checkLevelComplete", () => {
    it("returns false when some aliens are alive", () => {
      const aliens = [makeAlien({ alive: true }), makeAlien({ alive: true })];
      const g = createMockState({ aliens });
      expect(system.checkLevelComplete(g)).toBe(false);
    });

    it("returns true when all aliens are dead and increments level", () => {
      const aliens = [makeAlien({ alive: false }), makeAlien({ alive: false })];
      const g = createMockState({ level: 1, aliens });
      const result = system.checkLevelComplete(g);
      expect(result).toBe(true);
      expect(g.level).toBe(2);
      expect(g.aliens.length).toBeGreaterThan(0);
      expect(g.alienDir).toBe(1);
      expect(g.ufoTimer).toBe(2000);
      expect(g.levelAnnounceTimer).toBe(2000);
    });

    // Regression T-1: the last alien of a level is dropped from aliveAliens the
    // moment it starts dying, but its score is only paid out when the death
    // animation completes. Level completion must wait for that payout, or the
    // final kill of every level awards 0 points.
    it("does not complete the level while an alien is still dying", () => {
      const aliens = [makeAlien({ alive: true, dyingAt: 500, pendingScore: 30 })];
      const g = createMockState({
        level: 1,
        aliens,
        aliveAliens: [], // cache already dropped the dying alien
        activeAliens: aliens,
      });
      const result = system.checkLevelComplete(g);
      expect(result).toBe(false);
      expect(g.level).toBe(1);
    });
  });

  describe("checkAlienReachedPlayer", () => {
    it("does not change status when no aliens are near the ground", () => {
      const aliens = [makeAlien({ y: 100 })]; // groundY = 600, so y+h = 124
      const g = createMockState({ status: "playing", aliens });
      system.checkAlienReachedPlayer(g);
      expect(g.status).toBe("playing");
    });

    it("sets status to gameover when an alien reaches the ground", () => {
      const groundY = GAME_CONFIG.canvas.groundY; // 600
      const aliens = [makeAlien({ y: groundY - 10, h: 20 })]; // y+h = 610 > 600
      const g = createMockState({ status: "playing", aliens });
      system.checkAlienReachedPlayer(g);
      expect(g.status).toBe("gameover");
    });
  });

  describe("spawnAlienBullet", () => {
    it("does not add a bullet when there are no aliens", () => {
      const g = createMockState({ aliens: [] });
      system.spawnAlienBullet(g);
      expect(g.bullets.length).toBe(0);
    });

    it("adds exactly one alien bullet when aliens exist", () => {
      const aliens = [makeAlien({ x: 100, y: 100, alive: true })];
      const g = createMockState({ level: 1, aliens });
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      system.spawnAlienBullet(g);
      expect(g.bullets.length).toBe(1);
      expect(g.bullets[0].owner).toBe("alien");
      vi.restoreAllMocks();
    });
  });

  describe("updateAlienShootingTimer", () => {
    it("decrements alienShootTimer by dt", () => {
      const aliens = [makeAlien({ alive: true }), makeAlien({ alive: true })];
      const g = createMockState({ level: 1, aliens, alienShootTimer: 1000 });
      system.updateAlienShootingTimer(g, 100);
      expect(g.alienShootTimer).toBe(900);
    });

    it("resets timer to shootInterval when it reaches 0", () => {
      const aliens = [makeAlien({ alive: true }), makeAlien({ alive: true })];
      const g = createMockState({ level: 1, aliens, alienShootTimer: 50 });
      // dt = 100, so timer goes 50 - 100 = -50, triggers reset
      system.updateAlienShootingTimer(g, 100);
      // After reset, timer should be > 0
      expect(g.alienShootTimer).toBeGreaterThan(0);
    });

    it("sets timer to 0 when no aliens are alive", () => {
      const aliens = [makeAlien({ alive: false })];
      const g = createMockState({ aliens, alienShootTimer: 500 });
      system.updateAlienShootingTimer(g, 100);
      expect(g.alienShootTimer).toBe(0);
    });

    // Regression: the engine used to also decrement g.alienShootTimer at
    // engine.ts:104 in addition to this method, which halved the effective
    // shoot interval. This test pins updateAlienShootingTimer as the sole
    // owner of the decrement.
    it("decrements by exactly dt (regression for engine double-decrement)", () => {
      const aliens = Array.from({ length: 10 }, () =>
        makeAlien({ alive: true })
      );
      const g = createMockState({ level: 1, aliens, alienShootTimer: 1000 });
      system.updateAlienShootingTimer(g, 50);
      expect(g.alienShootTimer).toBe(950);
    });
  });
});
