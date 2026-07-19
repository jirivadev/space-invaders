import type { GameState } from '../types';
import { GAME_CONFIG, COLORS, ALIEN_POINTS } from '../config';
import { rectsOverlap } from '../geometry';
import { createUFO, createExplosionParticles, damageShieldRect } from './entity-factory';
import { setGameOver } from './state-manager';

export class PhysicsSystem {
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;
  private shakeOffsetX: number = 0;
  private shakeOffsetY: number = 0;

  triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
  }

  updateShake(dt: number): void {
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      this.shakeIntensity *= Math.pow(0.9, dt / GAME_CONFIG.canvas.targetDt);
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      if (this.shakeDuration <= 0 || this.shakeIntensity < 0.1) {
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  getShakeIntensity(): number {
    return this.shakeIntensity;
  }

  getShakeX(): number {
    return this.shakeOffsetX;
  }

  getShakeY(): number {
    return this.shakeOffsetY;
  }

  // UFO update logic
  updateUFO(g: GameState, dt: number): void {
    g.ufoTimer -= dt;
    if (!g.ufo && g.ufoTimer <= 0) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      g.ufo = createUFO();
      g.ufo!.dx = dir * Math.abs(g.ufo!.dx);
      g.ufo!.x = dir === 1 ? -g.ufo!.w : GAME_CONFIG.canvas.width;
      g.ufoTimer = GAME_CONFIG.ufo.timerMin + Math.random() * GAME_CONFIG.ufo.timerRange;
    }

    if (g.ufo) {
      g.ufo.x += g.ufo.dx;
      if (g.ufo.x > GAME_CONFIG.canvas.width + 50 || g.ufo.x + g.ufo.w < -50) {
        g.ufo = null;
      g.ufoTimer = GAME_CONFIG.ufo.timerMin + Math.random() * GAME_CONFIG.ufo.timerRange;
      }
    }
  }

  // Bullet update logic
  updateBullets(g: GameState, moveScale: number): void {
    for (let i = g.bullets.length - 1; i >= 0; i--) {
      const b = g.bullets[i];
      b.trail.push({ x: b.x, y: b.y });
      b.y += b.dy * moveScale;
      const maxTrail = b.owner === 'player' ? 7 : 4;
      if (b.trail.length > maxTrail) {
        b.trail.shift();
      }
      if (b.y < -20 || b.y > GAME_CONFIG.canvas.height + 20) {
        g.bullets.splice(i, 1);
      }
    }
  }

  // Player bullet creation
  spawnPlayerBullet(g: GameState): void {
    const playerBulletX = g.player.x + g.player.w / 2 - GAME_CONFIG.bullet.playerWidth / 2;
    const playerBulletY = g.player.y - GAME_CONFIG.bullet.playerHeight;
    g.bullets.push({
      x: playerBulletX,
      y: playerBulletY,
      w: GAME_CONFIG.bullet.playerWidth,
      h: GAME_CONFIG.bullet.playerHeight,
      dy: GAME_CONFIG.bullet.playerSpeed,
      owner: 'player',
      trail: [{ x: playerBulletX, y: playerBulletY }],
    });
  }

  // Particle physics update
  updateParticles(g: GameState, moveScale: number): void {
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const p = g.particles[i];
      if (p.type !== 'flash') {
        const dragFactor = Math.pow(0.97, moveScale);
        p.vx *= dragFactor;
        p.vy *= dragFactor;
        p.vy += 0.06 * moveScale;
        p.x += p.vx * moveScale;
        p.y += p.vy * moveScale;
      }
      p.life -= moveScale * GAME_CONFIG.particle.lifeDecayPerFrame;
      if (p.life <= 0) g.particles.splice(i, 1);
    }
  }

  // Power-up update
  updatePowerUps(g: GameState, moveScale: number): void {
    for (let i = g.powerUps.length - 1; i >= 0; i--) {
      const p = g.powerUps[i];
      p.y += p.dy * moveScale;
      if (p.y > GAME_CONFIG.canvas.height + 20) {
        g.powerUps.splice(i, 1);
        continue;
      }
    }
  }

  // Alien shield damage logic
  damageShieldsWithAliens(g: GameState): void {
    for (const a of g.aliens) {
      if (!a.alive || a.dyingAt > 0) continue;
      if (a.y + a.h >= GAME_CONFIG.canvas.groundY) {
        setGameOver(g);
        break;
      }
      for (const s of g.shields) {
        const sw = s.cols * s.pixelSize;
        const sh = s.rows * s.pixelSize;
        if (rectsOverlap(a, { x: s.x, y: s.y, w: sw, h: sh })) {
          damageShieldRect(s, a.x, a.y + a.h - 4, a.w, 4);
        }
      }
    }
  }

  // Bomb power-up effect
  applyBomb(g: GameState): void {
    for (const alien of g.aliens) {
      if (alien.alive) {
        alien.alive = false;
        const points = ALIEN_POINTS[alien.type];
        g.score += points;
        g.particles.push(...createExplosionParticles(alien.x + alien.w / 2, alien.y + alien.h / 2, COLORS[alien.type], GAME_CONFIG.particle.bombParticlesPerAlien));
      }
    }
    for (let j = g.bullets.length - 1; j >= 0; j--) {
      if (g.bullets[j].owner === 'alien') {
        g.bullets.splice(j, 1);
      }
    }
    g.alienDir = 1;
    g.alienStepTimer = 0;
    g.alienMoveDown = false;
    if (g.particles.length > GAME_CONFIG.particle.maxCount) {
      g.particles.length = GAME_CONFIG.particle.maxCount;
    }
  }

  // Time-based player invulnerability countdown
  updatePlayerInvulnerability(g: GameState, dt: number): void {
    if (g.player.invulnerable > 0) g.player.invulnerable = Math.max(0, g.player.invulnerable - dt);
  }

  // Time-based cooldown countdown
  updateCooldowns(g: GameState, dt: number): void {
    if (g.player.cooldown > 0) g.player.cooldown = Math.max(0, g.player.cooldown - dt);
    if (g.activePowerUps.rapidFire > 0) g.activePowerUps.rapidFire = Math.max(0, g.activePowerUps.rapidFire - dt);
    if (g.activePowerUps.shield > 0) g.activePowerUps.shield = Math.max(0, g.activePowerUps.shield - dt);
  }
}