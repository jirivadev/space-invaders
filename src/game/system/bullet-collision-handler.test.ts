import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleBulletCollisions } from "./bullet-collision-handler";
import { CollisionSystem } from "./collision-system";
import { PhysicsSystem } from "./physics-system";
import { GAME_CONFIG } from "../config";
import {
  createMockState,
  makeBullet,
  makeAlien,
  makeShield,
  makeUFO,
  makePlayer,
  makePowerUp,
} from "../test-utils/factory";

describe("handleBulletCollisions", () => {
  let collisionSystem: CollisionSystem;
  let physicsSystem: PhysicsSystem;
  let now: number;

  beforeEach(() => {
    now = 1000;
    // Deterministic clock: collision-system stamps dyingAt and the player's
    // diedAt from performance.now(), so pin it for exact assertions.
    vi.spyOn(performance, "now").mockImplementation(() => now);
    collisionSystem = new CollisionSystem();
    physicsSystem = new PhysicsSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("player bullets vs shields", () => {
    // Regression T-2: after a shield hit at a non-last index, swapRemove moves
    // the already-processed last bullet into slot i. The old `if (!g.bullets[i])`
    // guard checked position, not identity, so the removed bullet's stale
    // reference could still phantom-kill aliens and delete a different bullet.
    it("shield hit at non-last index: consumes only that bullet — no phantom alien kill, other bullets survive", () => {
      // Shield band: x 110..182, y 480..528 (24 cols × 3, 16 rows × 3)
      const shield = makeShield({ x: 110, y: 480 });
      // Alien descended to shield depth (y 460..484) so a stale bullet
      // resting at the shield would overlap it.
      const alien = makeAlien({ x: 130, y: 460 });

      // Iteration order is end → start: C is processed first, then B, then A.
      const bulletA = makeBullet({ x: 700, y: 50, owner: "player" }); // harmless
      const bulletB = makeBullet({ x: 130, y: 470, owner: "player" }); // inside shield; also overlaps the alien rect
      const bulletC = makeBullet({ x: 710, y: 80, owner: "player" }); // harmless (last index → swapped into B's slot)

      const g = createMockState({
        bullets: [bulletA, bulletB, bulletC],
        aliens: [alien],
        aliveAliens: [alien],
        activeAliens: [alien],
        shields: [shield],
      });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      // The shield-spent bullet must never reach the alien
      expect(alien.dyingAt).toBe(0);
      expect(alien.pendingScore).toBeUndefined();

      // Only B was consumed; A and C are intact
      expect(g.bullets).toHaveLength(2);
      expect(g.bullets).toContain(bulletA);
      expect(g.bullets).toContain(bulletC);
    });

    it("removes a player bullet that hits a shield", () => {
      const shield = makeShield({ x: 110, y: 480 });
      const bullet = makeBullet({ x: 130, y: 470, owner: "player" });
      const g = createMockState({ bullets: [bullet], shields: [shield] });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(g.bullets).toHaveLength(0);
    });
  });

  describe("player bullets vs aliens and UFO", () => {
    it("leaves a bullet in flight when it collides with nothing", () => {
      const bullet = makeBullet({ x: 700, y: 50, owner: "player" });
      const g = createMockState({ bullets: [bullet] });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(g.bullets).toHaveLength(1);
      expect(g.particles).toHaveLength(0);
      expect(physicsSystem.getShakeIntensity()).toBe(0);
    });

    it("marks an alien as dying, spawns an impact flash, and consumes the bullet", () => {
      const alien = makeAlien({ x: 100, y: 100, type: "squid" });
      const bullet = makeBullet({ x: 100, y: 100, owner: "player" });
      vi.spyOn(Math, "random").mockReturnValue(0.5); // no power-up spawn
      const g = createMockState({ bullets: [bullet], aliens: [alien] });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(g.bullets).toHaveLength(0);
      expect(alien.dyingAt).toBe(now);
      expect(alien.pendingScore).toBe(30); // squid
      expect(alien.alive).toBe(true); // resolved later by death animations
      expect(physicsSystem.getShakeIntensity()).toBe(4);
      expect(g.particles).toHaveLength(1);
      expect(g.particles[0]).toMatchObject({
        color: "#fef08a",
        size: 12,
        type: "flash",
      });
    });

    it("hits the UFO: awards points, starts the UFO death, consumes the bullet", () => {
      const ufo = makeUFO({ x: 200, y: 35 });
      const bullet = makeBullet({ x: 200, y: 35, owner: "player" });
      vi.spyOn(Math, "random").mockReturnValue(0); // points index 0 = 50
      const g = createMockState({
        bullets: [bullet],
        ufo,
        powerUps: [makePowerUp()],
      });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(g.bullets).toHaveLength(0);
      expect(ufo.dyingAt).toBe(now);
      expect(g.score).toBe(50);
      expect(g.powerUps).toHaveLength(0); // UFO kill clears power-ups
      expect(g.particles).toHaveLength(0);
    });

    it("prefers the alien over the UFO when a bullet overlaps both (priority)", () => {
      const alien = makeAlien({ x: 100, y: 100, type: "squid" }); // y 100..124
      const ufo = makeUFO({ x: 90, y: 90 }); // x 90..138, y 90..114
      const bullet = makeBullet({ x: 100, y: 105, owner: "player" }); // overlaps both
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const g = createMockState({ bullets: [bullet], aliens: [alien], ufo });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(alien.dyingAt).toBe(now);
      expect(ufo.dyingAt).toBe(0); // UFO check never reached
      expect(g.score).toBe(0);
      expect(g.bullets).toHaveLength(0);
    });
  });

  describe("alien bullets vs player", () => {
    function alienBulletAt(
      x: number,
      y: number
    ): ReturnType<typeof makeBullet> {
      return makeBullet({ x, y, dy: 5, owner: "alien" });
    }

    it("leaves an alien bullet in flight when it misses the player", () => {
      const bullet = alienBulletAt(0, 0);
      const g = createMockState({ bullets: [bullet] });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(g.bullets).toHaveLength(1);
      expect(g.lives).toBe(3);
      expect(physicsSystem.getShakeIntensity()).toBe(0);
    });

    it("does not hit an invulnerable player", () => {
      const bullet = alienBulletAt(100, 500); // overlaps the player rect
      const player = makePlayer({ x: 100, y: 500, invulnerable: 500 });
      const g = createMockState({ bullets: [bullet], player });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(g.bullets).toHaveLength(1);
      expect(g.lives).toBe(3);
      expect(g.player.invulnerable).toBe(500);
    });

    it("absorbs the bullet with an active shield: no lives lost, particles spawned", () => {
      const bullet = alienBulletAt(100, 500);
      const g = createMockState({
        bullets: [bullet],
        activePowerUps: { rapidFire: 0, shield: 1000 },
      });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(g.bullets).toHaveLength(0);
      expect(g.lives).toBe(3);
      expect(g.player.invulnerable).toBe(0);
      expect(g.player.diedAt).toBe(0);
      // 8 explosion particles + explosion flash + impact flash = 10
      expect(g.particles).toHaveLength(10);
      expect(physicsSystem.getShakeIntensity()).toBe(0);
    });

    it("decrements lives and grants invulnerability on a non-final hit", () => {
      const bullet = alienBulletAt(100, 500);
      const g = createMockState({ lives: 3, bullets: [bullet] });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(g.bullets).toHaveLength(0);
      expect(g.lives).toBe(2);
      expect(g.player.invulnerable).toBe(
        GAME_CONFIG.gameplay.playerHitInvulnerability
      );
      expect(g.player.diedAt).toBe(0);
      // 50 explosion particles + explosion flash + impact flash = 52
      expect(g.particles).toHaveLength(52);
      expect(physicsSystem.getShakeIntensity()).toBe(5);
    });

    it("sets diedAt on the final hit: no particles, heavier shake", () => {
      const bullet = alienBulletAt(100, 500);
      const g = createMockState({ lives: 1, bullets: [bullet] });

      handleBulletCollisions(g, { collisionSystem, physicsSystem });

      expect(g.bullets).toHaveLength(0);
      expect(g.lives).toBe(0);
      expect(g.player.invulnerable).toBe(
        GAME_CONFIG.gameplay.playerHitInvulnerability
      );
      expect(g.player.diedAt).toBe(now);
      expect(g.particles).toHaveLength(0);
      expect(physicsSystem.getShakeIntensity()).toBe(8);
    });
  });
});
