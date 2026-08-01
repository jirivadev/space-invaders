import type { GameState, Bullet } from "../types";
import { GAME_CONFIG, EFFECT_COLORS } from "../config";
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
  { collisionSystem, physicsSystem }: BulletCollisionDependencies,
  now: number
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
          physicsSystem,
          now
        )
      )
        continue;
    } else {
      if (
        handleAlienBulletCollision(
          g,
          i,
          bullet,
          collisionSystem,
          physicsSystem,
          now
        )
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
  physicsSystem: PhysicsSystem,
  now: number
): boolean {
  // Check shield damage — a shield hit consumes the bullet; the alien/UFO
  // checks below must never run with this (now removed) bullet reference,
  // otherwise swapRemove may have moved another bullet into slot i and the
  // stale reference could phantom-kill aliens or delete an already-processed
  // bullet (regression T-2).
  for (const s of g.shields) {
    if (collisionSystem.checkPlayerBulletShield(bullet, s, g)) {
      physicsSystem.triggerShake(2, 65);
      swapRemove(g.bullets, i);
      return true;
    }
  }

  // Check alien collision
  for (const a of g.aliens) {
    if (collisionSystem.checkBulletAlienCollision(bullet, a, g, now)) {
      physicsSystem.triggerShake(4, 130);
      g.particles.push(
        createImpactFlash(
          bullet.x + bullet.w / 2,
          bullet.y + bullet.h / 2,
          EFFECT_COLORS.impactAlien,
          12
        )
      );
      swapRemove(g.bullets, i);
      return true;
    }
  }

  // Check UFO collision
  if (g.ufo && collisionSystem.checkBulletUFOCollision(bullet, g.ufo, g, now)) {
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
  physicsSystem: PhysicsSystem,
  now: number
): boolean {
  if (!collisionSystem.checkBulletPlayerCollision(bullet, g.player))
    return false;

  if (g.activePowerUps.shield > 0) {
    g.particles.push(
      ...createExplosionParticles(
        bullet.x + bullet.w / 2,
        bullet.y + bullet.h / 2,
        EFFECT_COLORS.shieldAura,
        8
      )
    );
    g.particles.push(
      createImpactFlash(
        bullet.x + bullet.w / 2,
        bullet.y + bullet.h / 2,
        EFFECT_COLORS.impactShieldAbsorb,
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
    g.player.diedAt = now;
  } else {
    g.particles.push(
      ...createExplosionParticles(
        g.player.x + g.player.w / 2,
        g.player.y + g.player.h / 2,
        EFFECT_COLORS.playerExplosion,
        50
      )
    );
    g.particles.push(
      createImpactFlash(
        bullet.x + bullet.w / 2,
        bullet.y + bullet.h / 2,
        EFFECT_COLORS.impactPlayer,
        14
      )
    );
  }

  return true;
}
