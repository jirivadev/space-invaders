import type {
  GameState,
  Bullet,
  Shield,
  Alien,
  Player,
  PowerUp,
  UFO,
} from "../types";
import { COLORS, ALIEN_POINTS, GAME_CONFIG } from "../config";
import { rectsOverlap } from "../geometry";
import { createExplosionParticles, createImpactFlash } from "./entity-factory";

export class CollisionSystem {
  checkBulletPlayerCollision(bullet: Bullet, player: Player): boolean {
    if (player.invulnerable > 0) return false;
    return rectsOverlap(bullet, player);
  }

  checkBulletAlienCollision(
    bullet: Bullet,
    alien: Alien,
    state: GameState
  ): boolean {
    if (!alien.alive || alien.dyingAt > 0) return false;
    if (!rectsOverlap(bullet, alien)) return false;

    alien.dyingAt = performance.now();
    alien.pendingScore = ALIEN_POINTS[alien.type];

    // Chance to spawn power-up
    if (Math.random() < 0.1) {
      const types = ["rapidFire", "shield", "bomb"] as const;
      const type = types[Math.floor(Math.random() * types.length)];
      state.powerUps.push({
        x: alien.x + alien.w / 2 - 10,
        y: alien.y + alien.h / 2 - 10,
        w: 20,
        h: 20,
        dy: 2,
        type,
        spawnedAt: performance.now(),
      });
    }
    return true;
  }

  checkBulletUFOCollision(bullet: Bullet, ufo: UFO, state: GameState): boolean {
    if (!ufo || ufo.dyingAt > 0) return false;
    if (!rectsOverlap(bullet, ufo)) return false;

    const points = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
    state.score += points;
    ufo.dyingAt = performance.now();
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
    if (!rectsOverlap(bullet, shieldRect)) return false;

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
          "#86efac",
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
