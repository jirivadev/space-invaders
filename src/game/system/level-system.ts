import type { GameState, FormationType, LevelConfig } from '../types';
import { GAME_CONFIG } from '../config';
import { createAliens, rectsOverlap, createExplosionParticles, createImpactFlash, setGameOver } from './entity-factory';

// Level configuration manager
function getLevelConfig(level: number): LevelConfig {
  if (level <= 4) {
    const configs: LevelConfig[] = [
      { formation: 'grid', speedMultiplier: 1.0, shootIntervalMultiplier: 1.0, enemyBulletSpeed: 4, startY: 80 },
      { formation: 'staggered', speedMultiplier: 1.2, shootIntervalMultiplier: 0.9, enemyBulletSpeed: 5, startY: 90 },
      { formation: 'diamond', speedMultiplier: 1.5, shootIntervalMultiplier: 0.8, enemyBulletSpeed: 6, startY: 100 },
      { formation: 'compact', speedMultiplier: 1.8, shootIntervalMultiplier: 0.7, enemyBulletSpeed: 7, startY: 110 },
    ];
    return configs[level - 1];
  }
  const formations: FormationType[] = ['grid', 'staggered', 'diamond', 'compact', 'wide'];
  return {
    formation: formations[(level - 1) % 5],
    speedMultiplier: Math.min(4, 2.0 + (level - 5) * 0.3),
    shootIntervalMultiplier: Math.max(0.4, 1.0 - (level - 1) * 0.1),
    enemyBulletSpeed: Math.min(12, 4 + (level - 1) * 1.5),
    startY: Math.min(200, 80 + (level - 1) * 15),
  };
}

export class LevelSystem {
  checkLevelComplete(g: GameState): boolean {
    const aliveAliens = g.aliens.filter((a) => a.alive);
    if (aliveAliens.length === 0) {
      g.level++;
      g.levelAnnounceTimer = 2000;
      const config = getLevelConfig(g.level);
      g.aliens = createAliens(config.formation, config.startY);
      g.alienDir = 1;
      g.alienStepTimer = 0;
      g.alienShootTimer = 0;
      g.alienFrame = 0;
      g.ufoTimer = 2000;
      return true;
    }
    return false;
  }

  // Calculate alien movement interval based on speed factors
  getAlienStepInterval(g: GameState): number {
    const levelConfig = getLevelConfig(g.level);
    const aliveAliens = g.aliens.filter((a) => a.alive);
    const totalAliens = g.aliens.length;
    const speedFactor = Math.pow(totalAliens / Math.max(1, aliveAliens.length), 1.6);
    const stepInterval = Math.max(80, 700 / (1 + speedFactor)) / levelConfig.speedMultiplier;
    return stepInterval;
  }

  // Process alien movement in response to edge collision
  moveAliens(g: GameState, now: number): void {
    const levelConfig = getLevelConfig(g.level);
    const stepInterval = this.getAlienStepInterval(g);

    g.alienStepTimer += now;
    if (g.alienStepTimer >= stepInterval) {
      g.alienStepTimer = 0;
      g.alienFrame = g.alienFrame === 0 ? 1 : 0;

      let hitEdge = false;
      const moveX = GAME_CONFIG.alien.stepX * g.alienDir;

      // Drop down if hitting edge
      if (g.alienMoveDown) {
        for (const a of g.aliens) {
          if (a.alive) a.y += GAME_CONFIG.alien.stepDown;
        }
        g.alienMoveDown = false;
      }

      // Move all aliens
      for (const a of g.aliens) {
        if (!a.alive) continue;
        a.x += moveX;
        if (a.x <= 15 || a.x + a.w >= GAME_CONFIG.canvas.width - 15) {
          hitEdge = true;
        }
      }

      // Handle edge collision
      if (hitEdge) {
        g.alienDir *= -1;
        g.alienMoveDown = true;
      }
    }
  }

  // Check for alien reaching player
  checkAlienReachedPlayer(g: GameState): void {
    const aliveAliens = g.aliens.filter((a) => a.alive);
    for (const a of aliveAliens) {
      if (a.y + a.h >= GAME_CONFIG.canvas.groundY) {
        setGameOver(g);
        break;
      }
    }
  }

  // Alien bullet spawning logic
  spawnAlienBullet(g: GameState): void {
    const aliveAliens = g.aliens.filter((a) => a.alive);
    if (aliveAliens.length === 0) return;

    const levelConfig = getLevelConfig(g.level);
    const columns = new Map<number, Alien[]>();
    for (const a of aliveAliens) {
      const col = Math.round(a.x / 10);
      const alienGroup = columns.get(col) ?? [];
      alienGroup.push(a);
      columns.set(col, alienGroup);
    }

    // Find bottom aliens in each column
    const bottomAliens: Alien[] = [];
    for (const [, group] of columns) {
      let lowest = group[0];
      for (const a of group) {
        if (a.y > lowest.y) lowest = a;
      }
      bottomAliens.push(lowest);
    }

    // Randomly select shooter
    if (bottomAliens.length > 0) {
      const shooter = bottomAliens[Math.floor(Math.random() * bottomAliens.length)];
      const alienBulletX = shooter.x + shooter.w / 2 - GAME_CONFIG.bullet.alienWidth / 2;
      const alienBulletY = shooter.y + shooter.h;
      g.bullets.push({
        x: alienBulletX,
        y: alienBulletY,
        w: GAME_CONFIG.bullet.alienWidth,
        h: GAME_CONFIG.bullet.alienHeight,
        dy: levelConfig.enemyBulletSpeed + Math.random() * 2,
        owner: 'alien',
        trail: [{ x: alienBulletX, y: alienBulletY }],
      });
    }
  }

  // Alien shooting timer management
  updateAlienShootingTimer(g: GameState, now: number): void {
    const aliveAliens = g.aliens.filter((a) => a.alive);
    if (aliveAliens.length === 0) {
      g.alienShootTimer = 0;
      return;
    }

    const levelConfig = getLevelConfig(g.level);
    const shootInterval = Math.max(200, aliveAliens.length * 25) * levelConfig.shootIntervalMultiplier;

    g.alienShootTimer -= now;
    if (g.alienShootTimer <= 0) {
      g.alienShootTimer = shootInterval;
    }
  }

  // Reset level state when advancing
  resetLevelState(g: GameState): void {
    const config = getLevelConfig(g.level);
    g.aliens = createAliens(config.formation, config.startY);
    g.alienDir = 1;
    g.alienStepTimer = 0;
    g.alienShootTimer = 0;
    g.alienFrame = 0;
    g.levelAnnounceTimer = 0;
  }

  // Initialize level for new game
  initializeLevel(g: GameState): void {
    const config = getLevelConfig(g.level);
    g.aliens = createAliens(config.formation, config.startY);
    g.alienDir = 1;
    g.alienStepTimer = 0;
    g.alienShootTimer = 0;
    g.alienFrame = 0;
    g.levelAnnounceTimer = 2000;
  }

  // Start playing state
  startPlayingState(g: GameState): void {
    const levelConfig = getLevelConfig(g.level);
    g.aliens = createAliens(levelConfig.formation, levelConfig.startY);
    g.alienDir = 1;
    g.alienStepTimer = 0;
    g.alienShootTimer = 0;
    g.alienFrame = 0;
    g.levelAnnounceTimer = 2000;
  }
}