import type { GameState, FormationType, LevelConfig, Alien } from "../types";
import { GAME_CONFIG } from "../config";
import { createAliens } from "./entity-factory";
import { setGameOver } from "./state-manager";

// Level configuration manager
export function getLevelConfig(level: number): LevelConfig {
  if (level <= 4) {
    const configs: LevelConfig[] = [
      {
        formation: "grid",
        speedMultiplier: 1.0,
        shootIntervalMultiplier: 1.0,
        enemyBulletSpeed: 4,
        startY: 80,
      },
      {
        formation: "staggered",
        speedMultiplier: 1.2,
        shootIntervalMultiplier: 0.9,
        enemyBulletSpeed: 5,
        startY: 90,
      },
      {
        formation: "diamond",
        speedMultiplier: 1.5,
        shootIntervalMultiplier: 0.8,
        enemyBulletSpeed: 6,
        startY: 100,
      },
      {
        formation: "compact",
        speedMultiplier: 1.8,
        shootIntervalMultiplier: 0.7,
        enemyBulletSpeed: 7,
        startY: 110,
      },
    ];
    return configs[level - 1];
  }
  const formations: FormationType[] = [
    "grid",
    "staggered",
    "diamond",
    "compact",
    "wide",
  ];
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
    if (g.aliveAliens.length === 0) {
      g.level++;
      g.levelAnnounceTimer = GAME_CONFIG.gameplay.levelAnnounceDuration;
      const config = getLevelConfig(g.level);
      const newAliens = createAliens(config.formation, config.startY);
      g.aliens = newAliens;
      g.aliveAliens = newAliens.filter((a) => a.alive && a.dyingAt === 0);
      g.activeAliens = newAliens.filter((a) => a.alive);
      g.alienDir = 1;
      g.alienStepTimer = 0;
      g.alienShootTimer = 0;
      g.alienFrame = 0;
      g.ufoTimer = GAME_CONFIG.gameplay.levelCompleteUFOTimer;
      return true;
    }
    return false;
  }

  // Calculate alien movement interval based on speed factors
  getAlienStepInterval(g: GameState): number {
    const levelConfig = getLevelConfig(g.level);
    const totalAliens = g.aliens.length;
    const rawFactor = Math.pow(
      totalAliens / Math.max(1, g.activeAliens.length),
      1.6
    );
    const speedFactor = Math.min(rawFactor, 8);
    const stepInterval =
      Math.max(80, 700 / (1 + speedFactor)) / levelConfig.speedMultiplier;
    return stepInterval;
  }

  // Process alien movement in response to edge collision
  moveAliens(g: GameState, dt: number): void {
    const stepInterval = this.getAlienStepInterval(g);

    g.alienStepTimer += dt;
    if (g.alienStepTimer >= stepInterval) {
      g.alienStepTimer = 0;
      g.alienFrame = g.alienFrame === 0 ? 1 : 0;

      let hitEdge = false;
      const moveX = GAME_CONFIG.alien.stepX * g.alienDir;

      // Drop down if hitting edge
      if (g.alienMoveDown) {
        for (const a of g.activeAliens) {
          a.y += GAME_CONFIG.alien.stepDown;
        }
        g.alienMoveDown = false;
      }

      // Move all aliens
      for (const a of g.activeAliens) {
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
    for (const a of g.aliveAliens) {
      if (a.y + a.h >= GAME_CONFIG.canvas.groundY) {
        setGameOver(g);
        break;
      }
    }
  }

  // Alien bullet spawning logic
  spawnAlienBullet(g: GameState): void {
    if (g.aliveAliens.length === 0) return;

    const levelConfig = getLevelConfig(g.level);
    const columns = new Map<number, Alien[]>();
    for (const a of g.aliveAliens) {
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
      const shooter =
        bottomAliens[Math.floor(Math.random() * bottomAliens.length)];
      const alienBulletX =
        shooter.x + shooter.w / 2 - GAME_CONFIG.bullet.alienWidth / 2;
      const alienBulletY = shooter.y + shooter.h;
      g.bullets.push({
        x: alienBulletX,
        y: alienBulletY,
        w: GAME_CONFIG.bullet.alienWidth,
        h: GAME_CONFIG.bullet.alienHeight,
        dy: levelConfig.enemyBulletSpeed + Math.random() * 2,
        owner: "alien",
        trail: [{ x: alienBulletX, y: alienBulletY }],
      });
    }
  }

  // Alien shooting timer management
  updateAlienShootingTimer(g: GameState, dt: number): void {
    if (g.aliveAliens.length === 0) {
      g.alienShootTimer = 0;
      return;
    }

    const levelConfig = getLevelConfig(g.level);
    const shootInterval =
      Math.max(200, g.aliveAliens.length * 25) *
      levelConfig.shootIntervalMultiplier;

    g.alienShootTimer -= dt;
    if (g.alienShootTimer <= 0) {
      g.alienShootTimer = shootInterval;
    }
  }
}
