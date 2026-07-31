import type { GameState, Bullet } from "../types";
import { GAME_CONFIG } from "../config";
import type { CollisionSystem } from "./collision-system";
import type { PhysicsSystem } from "./physics-system";
import { createExplosionParticles, createImpactFlash } from "./entity-factory";
import { swapRemove } from "../utils";

export interface BulletCollisionDependencies {
  collisionSystem: CollisionSystem;
  physicsSystem: PhysicsSystem;
}

/**
 * Process all bullet collisions for a single frame.
 *
 * Iterates bullets in reverse and applies shield, alien, UFO, and player
 * collisions. Mutates game state directly.
 */
export function handleBulletCollisions(
  g: GameState,
  { collisionSystem, physicsSystem }: BulletCollisionDependencies
): void {
  for (let i = g.bullets.length - 1; i >= 0; i--) {
    const bullet = g.bullets[i];

    if (bullet.owner === "player") {
      if (
        handlePlayerBulletCollisions(
          g,
          i,
          bullet,
          collisionSystem,
          physicsSystem
        )
      )
        continue;
    } else {
      if (
        handleAlienBulletCollision(g, i, bullet, collisionSystem, physicsSystem)
      )
        continue;
    }
  }
}

function handlePlayerBulletCollisions(
  g: GameState,
  i: number,
  bullet: Bullet,
  collisionSystem: CollisionSystem,
  physicsSystem: PhysicsSystem
): boolean {
  // Check shield damage
  for (const s of g.shields) {
    if (collisionSystem.checkPlayerBulletShield(bullet, s, g)) {
      physicsSystem.triggerShake(2, 65);
      swapRemove(g.bullets, i);
      break;
    }
  }
  if (!g.bullets[i]) return true;

  // Check alien collision
  for (const a of g.aliens) {
    if (collisionSystem.checkBulletAlienCollision(bullet, a, g)) {
      physicsSystem.triggerShake(4, 130);
      g.particles.push(
        createImpactFlash(
          bullet.x + bullet.w / 2,
          bullet.y + bullet.h / 2,
          "#fef08a",
          12
        )
      );
      swapRemove(g.bullets, i);
      return true;
    }
  }

  // Check UFO collision
  if (g.ufo && collisionSystem.checkBulletUFOCollision(bullet, g.ufo, g)) {
    swapRemove(g.bullets, i);
    return true;
  }

  return false;
}

function handleAlienBulletCollision(
  g: GameState,
  i: number,
  bullet: Bullet,
  collisionSystem: CollisionSystem,
  physicsSystem: PhysicsSystem
): boolean {
  if (!collisionSystem.checkBulletPlayerCollision(bullet, g.player))
    return false;

  if (g.activePowerUps.shield > 0) {
    g.particles.push(
      ...createExplosionParticles(
        bullet.x + bullet.w / 2,
        bullet.y + bullet.h / 2,
        "#3b82f6",
        8
      )
    );
    g.particles.push(
      createImpactFlash(
        bullet.x + bullet.w / 2,
        bullet.y + bullet.h / 2,
        "#93c5fd",
        10
      )
    );
    swapRemove(g.bullets, i);
    return true;
  }

  g.lives--;
  g.player.invulnerable = GAME_CONFIG.gameplay.playerHitInvulnerability;
  physicsSystem.triggerShake(5, 130);
  swapRemove(g.bullets, i);

  if (g.lives <= 0) {
    physicsSystem.triggerShake(8, 250);
    g.player.diedAt = performance.now();
  } else {
    g.particles.push(
      ...createExplosionParticles(
        g.player.x + g.player.w / 2,
        g.player.y + g.player.h / 2,
        "#67e8f9",
        50
      )
    );
    g.particles.push(
      createImpactFlash(
        bullet.x + bullet.w / 2,
        bullet.y + bullet.h / 2,
        "#fca5a5",
        14
      )
    );
  }

  return true;
}
