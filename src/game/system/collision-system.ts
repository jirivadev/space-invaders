import type {
  GameState,
  Bullet,
  Shield,
  Alien,
  Player,
  PowerUp,
  UFO,
} from "../types";
import { COLORS, EFFECT_COLORS, ALIEN_POINTS, GAME_CONFIG } from "../config";
import { rectsOverlap } from "../geometry";
import {
  createExplosionParticles,
  createImpactFlash,
  damageShieldRect,
} from "./entity-factory";

function getSweptBulletRect(bullet: Bullet): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const previousY = Number.isFinite(bullet.previousY)
    ? bullet.previousY
    : bullet.y;
  return {
    x: bullet.x,
    y: Math.min(previousY, bullet.y),
    w: bullet.w,
    h: bullet.h + Math.abs(bullet.y - previousY),
  };
}

export class CollisionSystem {
  checkBulletPlayerCollision(bullet: Bullet, player: Player): boolean {
    if (player.invulnerable > 0) return false;
    return rectsOverlap(getSweptBulletRect(bullet), player);
  }

  checkBulletAlienCollision(
    bullet: Bullet,
    alien: Alien,
    state: GameState,
    now: number
  ): boolean {
    if (!alien.alive || alien.dyingAt > 0) return false;
    if (!rectsOverlap(getSweptBulletRect(bullet), alien)) return false;

    alien.dyingAt = now;
    alien.pendingScore = ALIEN_POINTS[alien.type];

    // Chance to spawn power-up
    if (Math.random() < GAME_CONFIG.powerUp.spawnChance) {
      const types = ["rapidFire", "shield", "bomb"] as const;
      const type = types[Math.floor(Math.random() * types.length)];
      state.powerUps.push({
        x: alien.x + alien.w / 2 - 10,
        y: alien.y + alien.h / 2 - 10,
        w: 20,
        h: 20,
        dy: GAME_CONFIG.powerUp.fallSpeed,
        type,
        spawnedAt: now,
      });
    }
    return true;
  }

  checkBulletUFOCollision(
    bullet: Bullet,
    ufo: UFO,
    state: GameState,
    now: number
  ): boolean {
    if (!ufo || ufo.dyingAt > 0) return false;
    if (!rectsOverlap(getSweptBulletRect(bullet), ufo)) return false;

    const points =
      GAME_CONFIG.ufo.points[
        Math.floor(Math.random() * GAME_CONFIG.ufo.points.length)
      ];
    state.score += points;
    ufo.dyingAt = now;
    state.powerUps = []; // Clear power-ups for UFO kill
    return true;
  }

  checkPlayerBulletShield(
    bullet: Bullet,
    shield: Shield,
    state: GameState
  ): boolean {
    const shieldRect = {
      x: shield.x,
      y: shield.y,
      w: shield.cols * shield.pixelSize,
      h: shield.rows * shield.pixelSize,
    };
    if (!rectsOverlap(getSweptBulletRect(bullet), shieldRect)) return false;

    damageShieldRect(shield, bullet.x, bullet.y, bullet.w, bullet.h);

    if (state.particles.length < GAME_CONFIG.particle.maxCount) {
      state.particles.push(
        ...createExplosionParticles(
          bullet.x + bullet.w / 2,
          bullet.y + bullet.h / 2,
          COLORS.shield,
          4
        )
      );
      state.particles.push(
        createImpactFlash(
          bullet.x + bullet.w / 2,
          bullet.y + bullet.h / 2,
          EFFECT_COLORS.impactShield,
          10
        )
      );
    }
    return true;
  }

  checkPowerUpCollision(powerUp: PowerUp, player: Player): boolean {
    return rectsOverlap(powerUp, player);
  }
}
