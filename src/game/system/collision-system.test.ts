import { describe, it, expect, vi, beforeEach } from "vitest";
import { CollisionSystem } from "./collision-system";
import {
  createMockState,
  makeBullet,
  makeAlien,
  makePlayer,
  makeUFO,
  makeShield,
  makePowerUp,
} from "../test-utils/factory";
import type { UFO } from "../types";

describe("CollisionSystem", () => {
  let system: CollisionSystem;

  beforeEach(() => {
    system = new CollisionSystem();
  });

  describe("checkBulletAlienCollision", () => {
    it("detects a fast vertical pass while preserving strict overlap", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 80, previousY: 130 });
      const alien = makeAlien({ x: 100, y: 100 });

      expect(system.checkBulletAlienCollision(bullet, alien, state, 1000)).toBe(
        true
      );

      const edgeBullet = makeBullet({ x: 100, y: 88, previousY: 88 });
      const edgeAlien = makeAlien({ x: 100, y: 100 });
      expect(
        system.checkBulletAlienCollision(edgeBullet, edgeAlien, state, 1000)
      ).toBe(false);
    });

    it("returns false for a dead alien", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, alive: false });
      expect(system.checkBulletAlienCollision(bullet, alien, state, 1000)).toBe(
        false
      );
    });

    it("returns false when bullet and alien do not overlap", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 0, y: 0 });
      const alien = makeAlien({ x: 500, y: 500 });
      expect(system.checkBulletAlienCollision(bullet, alien, state, 1000)).toBe(
        false
      );
    });

    it("hits a squid: pendingScore = 30, alien starts dying, no particles yet", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: "squid" });
      const result = system.checkBulletAlienCollision(
        bullet,
        alien,
        state,
        1000
      );
      expect(result).toBe(true);
      expect(alien.alive).toBe(true); // still alive during death animation
      expect(alien.dyingAt).toBeGreaterThan(0);
      expect(alien.pendingScore).toBe(30);
      expect(state.score).toBe(0); // score deferred to death animation completion
      expect(state.particles.length).toBe(0); // particles spawned later by engine
    });

    it("hits a crab: pendingScore = 20", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: "crab" });
      system.checkBulletAlienCollision(bullet, alien, state, 1000);
      expect(alien.pendingScore).toBe(20);
    });

    it("hits an octopus: pendingScore = 10", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: "octopus" });
      system.checkBulletAlienCollision(bullet, alien, state, 1000);
      expect(alien.pendingScore).toBe(10);
    });

    it("can spawn a power-up (random < 0.1)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.05);
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: "squid" });
      system.checkBulletAlienCollision(bullet, alien, state, 1000);
      expect(state.powerUps.length).toBe(1);
      expect(state.powerUps[0]).toHaveProperty("type");
      expect(["rapidFire", "shield", "bomb"]).toContain(state.powerUps[0].type);
      vi.restoreAllMocks();
    });

    it("does not spawn a power-up when random >= 0.1", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const state = createMockState();
      const bullet = makeBullet({ x: 100, y: 100 });
      const alien = makeAlien({ x: 100, y: 100, type: "squid" });
      system.checkBulletAlienCollision(bullet, alien, state, 1000);
      expect(state.powerUps.length).toBe(0);
      vi.restoreAllMocks();
    });

    it("spawns at least one power-up over many runs (~10% chance)", () => {
      const bullet = makeBullet({ x: 100, y: 100 });
      let spawned = 0;
      for (let i = 0; i < 200; i++) {
        const alien = makeAlien({ x: 100, y: 100, type: "squid" });
        const s = createMockState();
        // Reset particles count each iteration by creating a fresh state
        if (system.checkBulletAlienCollision(bullet, alien, s, 1000)) {
          if (s.powerUps.length > 0) spawned++;
        }
      }
      expect(spawned).toBeGreaterThan(0);
    });
  });

  describe("checkBulletPlayerCollision", () => {
    it("detects a fast downward pass through the player", () => {
      const bullet = makeBullet({
        x: 100,
        y: 510,
        previousY: 450,
        dy: 9,
        owner: "alien",
      });
      const player = makePlayer({ x: 100, y: 500 });
      expect(system.checkBulletPlayerCollision(bullet, player)).toBe(true);
    });

    it("returns false when player is invulnerable", () => {
      const bullet = makeBullet({ x: 100, y: 500 });
      const player = makePlayer({ x: 100, y: 500, invulnerable: 100 });
      expect(system.checkBulletPlayerCollision(bullet, player)).toBe(false);
    });

    it("returns false when bullet and player do not overlap", () => {
      const bullet = makeBullet({ x: 0, y: 0 });
      const player = makePlayer({ x: 500, y: 500 });
      expect(system.checkBulletPlayerCollision(bullet, player)).toBe(false);
    });

    it("returns true when bullet overlaps player", () => {
      const bullet = makeBullet({ x: 100, y: 500 });
      const player = makePlayer({ x: 100, y: 500 });
      expect(system.checkBulletPlayerCollision(bullet, player)).toBe(true);
    });
  });

  describe("checkBulletUFOCollision", () => {
    it("detects a fast upward pass through the UFO", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 200, y: 20, previousY: 60 });
      const ufo = makeUFO({ x: 200, y: 35 });
      expect(system.checkBulletUFOCollision(bullet, ufo, state, 1000)).toBe(
        true
      );
    });

    it("returns false when ufo is null", () => {
      const state = createMockState();
      const bullet = makeBullet();
      const ufo = null as unknown as UFO;
      expect(system.checkBulletUFOCollision(bullet, ufo, state, 1000)).toBe(
        false
      );
    });

    it("returns false when bullet and ufo do not overlap", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 0, y: 0 });
      const ufo = makeUFO({ x: 500, y: 500 });
      expect(system.checkBulletUFOCollision(bullet, ufo, state, 1000)).toBe(
        false
      );
    });

    it("hits UFO: score increased, UFO starts dying, powerUps cleared", () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // deterministic points index 0 = 50
      const state = createMockState({
        powerUps: [makePowerUp(), makePowerUp()],
      });
      const bullet = makeBullet({ x: 200, y: 35 });
      const ufo = makeUFO({ x: 200, y: 35 });
      const result = system.checkBulletUFOCollision(bullet, ufo, state, 1000);
      expect(result).toBe(true);
      expect(state.score).toBe(50);
      expect(ufo.dyingAt).toBeGreaterThan(0);
      expect(state.particles.length).toBe(0); // particles spawned later by engine
      expect(state.powerUps).toHaveLength(0);
      vi.restoreAllMocks();
    });
  });

  describe("checkPlayerBulletShield", () => {
    it("detects a fast pass through the shield", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 120, y: 450, previousY: 550 });
      const shield = makeShield({ x: 110, y: 480 });
      expect(system.checkPlayerBulletShield(bullet, shield, state)).toBe(true);
    });

    it("returns false when bullet does not overlap shield rect", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 0, y: 0 });
      const shield = makeShield({ x: 500, y: 500 });
      expect(system.checkPlayerBulletShield(bullet, shield, state)).toBe(false);
    });

    it("returns true on overlap and adds particles", () => {
      const state = createMockState();
      // Shield at (110, 480), 24 cols * 3 = 72 wide, 16 rows * 3 = 48 tall
      const bullet = makeBullet({ x: 120, y: 490 });
      const shield = makeShield({ x: 110, y: 480 });
      const result = system.checkPlayerBulletShield(bullet, shield, state);
      expect(result).toBe(true);
      expect(state.particles.length).toBeGreaterThan(0);
    });

    it("damages shield pixels in the bullet rect", () => {
      const state = createMockState();
      const bullet = makeBullet({ x: 120, y: 490, w: 4, h: 12 });
      const shield = makeShield({
        x: 110,
        y: 480,
        cols: 24,
        rows: 16,
        pixelSize: 3,
      });
      const beforeAliveCount = shield.pixels.flat().filter(Boolean).length;
      system.checkPlayerBulletShield(bullet, shield, state);
      const afterAliveCount = shield.pixels.flat().filter(Boolean).length;
      expect(afterAliveCount).toBeLessThan(beforeAliveCount);
    });
  });

  describe("checkPowerUpCollision", () => {
    it("returns false when no overlap", () => {
      const powerUp = makePowerUp({ x: 0, y: 0 });
      const player = makePlayer({ x: 500, y: 500 });
      expect(system.checkPowerUpCollision(powerUp, player)).toBe(false);
    });

    it("returns true on overlap", () => {
      const powerUp = makePowerUp({ x: 100, y: 500 });
      const player = makePlayer({ x: 100, y: 500 });
      expect(system.checkPowerUpCollision(powerUp, player)).toBe(true);
    });
  });
});
