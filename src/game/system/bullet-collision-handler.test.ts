import { describe, it, expect, beforeEach } from "vitest";
import { handleBulletCollisions } from "./bullet-collision-handler";
import { CollisionSystem } from "./collision-system";
import { PhysicsSystem } from "./physics-system";
import {
  createMockState,
  makeBullet,
  makeAlien,
  makeShield,
} from "../test-utils/factory";

describe("handleBulletCollisions", () => {
  let collisionSystem: CollisionSystem;
  let physicsSystem: PhysicsSystem;

  beforeEach(() => {
    collisionSystem = new CollisionSystem();
    physicsSystem = new PhysicsSystem();
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
});
