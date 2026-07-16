import type { GameState, GameCallbacks } from '../types';
import { COLORS } from '../config';
import {
  rectsOverlap,
  createExplosionParticles,
  createImpactFlash
} from './entity-factory';

export class CollisionSystem {
  checkBulletShieldCollision(bullet: any, shields: any[]): boolean {
    for (const shield of shields) {
      const shieldRect = { x: shield.x, y: shield.y, w: shield.cols * shield.pixelSize, h: shield.rows * shield.pixelSize };
      if (!rectsOverlap(bullet, shieldRect)) return false;

      if (rectsOverlap(bullet, shieldRect)) {
        return true;
      }
    }
    return false;
  }

  checkBulletPlayerCollision(bullet: any, player: any): boolean {
    if (player.invulnerable > 0) return false;
    return rectsOverlap(bullet, player);
  }

  checkBulletAlienCollision(bullet: any, alien: any, state: GameState): boolean {
    if (!alien.alive) return false;
    if (!rectsOverlap(bullet, alien)) return false;

    alien.alive = false;
    const points = alien.type === 'squid' ? 30 : alien.type === 'crab' ? 20 : 10;
    state.score += points;
    state.particles.push(...createExplosionParticles(alien.x + alien.w / 2, alien.y + alien.h / 2, COLORS[alien.type], 40));

    // Chance to spawn power-up
    if (Math.random() < 0.1) {
      const types = ['rapidFire', 'shield', 'bomb'] as const;
      const type = types[Math.floor(Math.random() * types.length)];
      state.powerUps.push({
        x: alien.x + alien.w / 2 - 10,
        y: alien.y + alien.h / 2 - 10,
        w: 20,
        h: 20,
        dy: 2,
        type,
      });
    }
    return true;
  }

  checkBulletUFOCollision(bullet: any, ufo: any, state: GameState): boolean {
    if (!ufo) return false;
    if (!rectsOverlap(bullet, ufo)) return false;

    const points = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
    state.score += points;
    state.particles.push(...createExplosionParticles(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, COLORS.ufo, 40));
    state.powerUps = []; // Clear power-ups for UFO kill
    return true;
  }

  checkPlayerBulletShield(bullet: any, shield: any, state: GameState): boolean {
    const shieldRect = { x: shield.x, y: shield.y, w: shield.cols * shield.pixelSize, h: shield.rows * shield.pixelSize };
    if (!rectsOverlap(bullet, shieldRect)) return false;

    if (rectsOverlap(bullet, shieldRect)) {
      state.particles.push(...createExplosionParticles(bullet.x + bullet.w / 2, bullet.y + bullet.h / 2, COLORS.shield, 4));
      state.particles.push(createImpactFlash(bullet.x + bullet.w / 2, bullet.y + bullet.h / 2, '#86efac', 10));
      return true;
    }
    return false;
  }

  checkPlayerAlienCollision(alien: any, player: any, state: GameState): boolean {
    if (!alien.alive) return false;
    return rectsOverlap(alien, player);
  }

  checkPowerUpCollision(powerUp: any, player: any): boolean {
    return rectsOverlap(powerUp, player);
  }

  applyPowerUps(state: GameState): void {
    if (state.activePowerUps.rapidFire > 0) {
      state.activePowerUps.rapidFire = Math.max(0, state.activePowerUps.rapidFire - 1);
    }
    if (state.activePowerUps.shield > 0) {
      state.activePowerUps.shield = Math.max(0, state.activePowerUps.shield - 1);
    }
  }
}