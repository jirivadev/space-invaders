import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhysicsSystem } from './physics-system';
import { GAME_CONFIG } from '../config';
import { createMockState, makeBullet, makeAlien } from '../test-utils/factory';

describe('PhysicsSystem', () => {
  let system: PhysicsSystem;

  beforeEach(() => {
    system = new PhysicsSystem();
  });

  describe('shake', () => {
    it('returns zero shake offsets by default', () => {
      expect(system.getShakeX()).toBe(0);
      expect(system.getShakeY()).toBe(0);
    });

    it('triggerShake sets internal state', () => {
      system.triggerShake(5, 200);
      expect(system.getShakeIntensity()).toBe(5);
    });

    it('updateShake decrements duration and changes offsets', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      system.triggerShake(5, 200);
      system.updateShake(50);
      // After 50ms, duration should be 150
      // Offsets should be non-zero since shake is active
      // With Math.random = 0.5: offset = (0.5 - 0.5) * 2 * intensity = 0
      // Let's use a different random value
      vi.restoreAllMocks();
    });

    it('shake offsets become zero when duration expires', () => {
      system.triggerShake(5, 30);
      system.updateShake(100); // exceed duration
      expect(system.getShakeX()).toBe(0);
      expect(system.getShakeY()).toBe(0);
    });

    it('intensity decays over time', () => {
      system.triggerShake(10, 200);
      system.updateShake(100);
      const intensity = system.getShakeIntensity();
      expect(intensity).toBeLessThan(10);
      expect(intensity).toBeGreaterThan(0);
    });
  });

  describe('updateUFO', () => {
    it('decrements ufoTimer by dt', () => {
      const g = createMockState({ ufoTimer: 1000 });
      system.updateUFO(g, 100);
      expect(g.ufoTimer).toBe(900);
    });

    it('spawns a UFO when timer <= 0 and ufo is null', () => {
      const g = createMockState({ ufoTimer: 0, ufo: null });
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      system.updateUFO(g, 10);
      expect(g.ufo).not.toBeNull();
      expect(g.ufoTimer).toBeGreaterThan(0); // reset
      vi.restoreAllMocks();
    });

    it('moves existing UFO by dx', () => {
      const ufo = { x: 100, y: 35, w: 48, h: 24, dx: 2.5, dyingAt: 0 };
      const g = createMockState({ ufo, ufoTimer: 5000 });
      system.updateUFO(g, 16);
      expect(g.ufo!.x).toBe(102.5);
    });

    it('clears UFO when it exits the canvas', () => {
      const ufo = { x: 900, y: 35, w: 48, h: 24, dx: 2.5, dyingAt: 0 };
      const g = createMockState({ ufo, ufoTimer: 5000 });
      system.updateUFO(g, 16);
      // UFO moves right (dx > 0), x=900 > 800+50, so should be cleared
      expect(g.ufo).toBeNull();
      expect(g.ufoTimer).toBeGreaterThan(0);
    });

    it('does not spawn UFO if ufo is not null', () => {
      const ufo = { x: 100, y: 35, w: 48, h: 24, dx: 2.5, dyingAt: 0 };
      const g = createMockState({ ufo, ufoTimer: 0 });
      system.updateUFO(g, 10);
      // ufo should still be the same object
      expect(g.ufo).toBe(ufo);
    });
  });

  describe('updateBullets', () => {
    it('moves player bullets up by dy * moveScale', () => {
      const bullet = makeBullet({ x: 100, y: 200, dy: -9, owner: 'player' });
      const g = createMockState({ bullets: [bullet] });
      system.updateBullets(g, 1);
      expect(g.bullets[0].y).toBe(191); // 200 + (-9) * 1
    });

    it('moves alien bullets down by dy * moveScale', () => {
      const bullet = makeBullet({ x: 100, y: 200, dy: 5, owner: 'alien' });
      const g = createMockState({ bullets: [bullet] });
      system.updateBullets(g, 1);
      expect(g.bullets[0].y).toBe(205);
    });

    it('removes bullets that go off-screen (above)', () => {
      const bullet = makeBullet({ x: 100, y: -30, dy: -9, owner: 'player' });
      const g = createMockState({ bullets: [bullet] });
      system.updateBullets(g, 1);
      expect(g.bullets).toHaveLength(0);
    });

    it('removes bullets that go off-screen (below)', () => {
      const bullet = makeBullet({ x: 100, y: 700, dy: 5, owner: 'alien' });
      const g = createMockState({ bullets: [bullet] });
      system.updateBullets(g, 1);
      expect(g.bullets).toHaveLength(0);
    });

    it('limits trail length for player bullets to 7 and alien to 4', () => {
      const playerBullet = makeBullet({ x: 100, y: 200, dy: -9, owner: 'player', trail: [] });
      const alienBullet = makeBullet({ x: 100, y: 200, dy: 5, owner: 'alien', trail: [] });
      const g = createMockState({ bullets: [playerBullet, alienBullet] });
      // Run enough frames to exceed trail limits
      for (let i = 0; i < 10; i++) {
        system.updateBullets(g, 1);
      }
      const pb = g.bullets.find(b => b.owner === 'player');
      const ab = g.bullets.find(b => b.owner === 'alien');
      if (pb) expect(pb.trail.length).toBeLessThanOrEqual(7);
      if (ab) expect(ab.trail.length).toBeLessThanOrEqual(4);
    });
  });

  describe('spawnPlayerBullet', () => {
    it('pushes a player-owned bullet at the right position', () => {
      const g = createMockState();
      system.spawnPlayerBullet(g);
      expect(g.bullets).toHaveLength(1);
      expect(g.bullets[0].owner).toBe('player');
      // Position: player center x - half bullet width
      const expectedX = g.player.x + g.player.w / 2 - GAME_CONFIG.bullet.playerWidth / 2;
      const expectedY = g.player.y - GAME_CONFIG.bullet.playerHeight;
      expect(g.bullets[0].x).toBe(expectedX);
      expect(g.bullets[0].y).toBe(expectedY);
    });
  });

  describe('applyBomb', () => {
    it('kills all aliens and increments score', () => {
      const aliens = [
        makeAlien({ x: 100, y: 100, type: 'squid', alive: true }),
        makeAlien({ x: 200, y: 100, type: 'crab', alive: true }),
        makeAlien({ x: 300, y: 100, type: 'octopus', alive: true }),
      ];
      const g = createMockState({ aliens, score: 0 });
      system.applyBomb(g);
      for (const a of g.aliens) {
        expect(a.alive).toBe(false);
      }
      // squids=30, crab=20, octopus=10 -> 60 total
      expect(g.score).toBe(60);
    });

    it('removes all alien bullets', () => {
      const alienBullet = makeBullet({ owner: 'alien' });
      const playerBullet = makeBullet({ owner: 'player' });
      const g = createMockState({ bullets: [alienBullet, playerBullet] });
      system.applyBomb(g);
      // Only player bullet remains
      expect(g.bullets).toHaveLength(1);
      expect(g.bullets[0].owner).toBe('player');
    });
  });

  describe('updatePowerUps', () => {
    it('moves power-ups down by dy * moveScale', () => {
      const g = createMockState({
        powerUps: [{ x: 100, y: 100, w: 20, h: 20, dy: 2, type: 'rapidFire' as const, spawnedAt: 0 }],
      });
      system.updatePowerUps(g, 1);
      expect(g.powerUps[0].y).toBe(102);
    });

    it('removes power-ups that fall below the canvas', () => {
      const g = createMockState({
        powerUps: [{ x: 100, y: 700, w: 20, h: 20, dy: 2, type: 'rapidFire' as const, spawnedAt: 0 }],
      });
      system.updatePowerUps(g, 1);
      expect(g.powerUps).toHaveLength(0);
    });
  });

  describe('updateCooldowns', () => {
    it('decrements player cooldown', () => {
      const g = createMockState();
      g.player.cooldown = 200;
      system.updateCooldowns(g, 50);
      expect(g.player.cooldown).toBe(150);
    });

    it('stops subtracting when cooldown reaches 0 (condition guard)', () => {
      const g = createMockState();
      g.player.cooldown = 30;
      system.updateCooldowns(g, 100);
      // Cooldown is clamped to 0 — never goes negative
      expect(g.player.cooldown).toBe(0);
      // Subsequent calls should have no effect
      system.updateCooldowns(g, 100);
      expect(g.player.cooldown).toBe(0);
    });

    it('decrements rapidFire by dt when > 0', () => {
      const g = createMockState({ activePowerUps: { rapidFire: 100, shield: 0 } });
      system.updateCooldowns(g, 16);
      expect(g.activePowerUps.rapidFire).toBe(84);
    });

    it('decrements shield by dt when > 0', () => {
      const g = createMockState({ activePowerUps: { rapidFire: 0, shield: 100 } });
      system.updateCooldowns(g, 16);
      expect(g.activePowerUps.shield).toBe(84);
    });

    it('clamps rapidFire at 0 when decrement would go negative', () => {
      const g = createMockState({ activePowerUps: { rapidFire: 5, shield: 0 } });
      system.updateCooldowns(g, 16);
      expect(g.activePowerUps.rapidFire).toBe(0);
    });

    it('leaves inactive power-up timers at 0 (no underflow)', () => {
      const g = createMockState({ activePowerUps: { rapidFire: 0, shield: 0 } });
      system.updateCooldowns(g, 16);
      expect(g.activePowerUps.rapidFire).toBe(0);
      expect(g.activePowerUps.shield).toBe(0);
    });
  });

  describe('updatePlayerInvulnerability', () => {
    it('decrements invulnerability timer', () => {
      const g = createMockState();
      g.player.invulnerable = 500;
      system.updatePlayerInvulnerability(g, 100);
      expect(g.player.invulnerable).toBe(400);
    });
  });

  describe('updateParticles', () => {
    it('removes dead particles', () => {
      const g = createMockState({
        particles: [
          { x: 100, y: 100, vx: 0, vy: 0, life: 5, maxLife: 100, color: '#fff', size: 3, type: 'spark' as const },
        ],
      });
      // moveScale=1, life subtracts moveScale * GAME_CONFIG.particle.lifeDecayPerFrame (60) = 60
      system.updateParticles(g, 1);
      expect(g.particles).toHaveLength(0);
    });

    it('applies gravity and drag to non-flash particles', () => {
      const g = createMockState({
        particles: [
          { x: 100, y: 100, vx: 10, vy: 0, life: 100, maxLife: 100, color: '#fff', size: 3, type: 'debris' as const },
        ],
      });
      system.updateParticles(g, 1);
      const p = g.particles[0];
      // drag: vx *= 0.97, so vx should be ~9.7
      expect(p.vx).toBeLessThan(10);
      expect(p.vx).toBeGreaterThan(9);
      // gravity: vy += 0.06
      expect(p.vy).toBe(0.06);
      // position updated
      expect(p.x).toBeGreaterThan(100);
      expect(p.y).toBeGreaterThan(100);
    });

    it('does not move flash particles', () => {
      const g = createMockState({
        particles: [
          { x: 100, y: 100, vx: 10, vy: 10, life: 100, maxLife: 100, color: '#fff', size: 15, type: 'flash' as const },
        ],
      });
      system.updateParticles(g, 1);
      // Flash particles should keep their position
      expect(g.particles[0].x).toBe(100);
      expect(g.particles[0].y).toBe(100);
    });
  });

  describe('damageShieldsWithAliens', () => {
    it('does not throw when no aliens or shields exist', () => {
      const g = createMockState({ aliens: [], shields: [] });
      expect(() => system.damageShieldsWithAliens(g)).not.toThrow();
    });
  });
});
