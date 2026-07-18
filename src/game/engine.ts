import type { GameState, GameStatus, GameCallbacks } from './types';
import { GAME_CONFIG, STAR_LAYERS } from './config';
import { InputHandler } from './system/input-handler';
import { CollisionSystem } from './system/collision-system';
import { PhysicsSystem } from './system/physics-system';
import { LevelSystem } from './system/level-system';
import { RenderingSystem } from './system/rendering-system';
import { GameStateManager } from './system/state-manager';
import { getLeaderboard, addToLeaderboard } from './leaderboard';
import { createExplosionParticles, createImpactFlash } from './system/entity-factory';
import { setGameOver } from './system/state-manager';

export class GameEngine {
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId = 0;
  private callbacks: GameCallbacks;

  // System instances
  private inputHandler: InputHandler;
  private collisionSystem: CollisionSystem;
  private physicsSystem: PhysicsSystem;
  private levelSystem: LevelSystem;
  private renderingSystem: RenderingSystem;
  private stateManager: GameStateManager;

  private lastUI: { score: number; lives: number; status: string; rapidFireTime: number; shieldTime: number } | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    this.ctx = canvas.getContext('2d');
    
    // Initialize systems
    this.inputHandler = new InputHandler({ ...callbacks, onGetState: () => this.g! });
    this.collisionSystem = new CollisionSystem();
    this.physicsSystem = new PhysicsSystem();
    this.levelSystem = new LevelSystem();
    this.renderingSystem = new RenderingSystem();
    this.stateManager = new GameStateManager();
  }

  start() {
    this.g = this.stateManager.createInitialState(0, 3, 'menu');
    this.inputHandler.start();
    this.rafId = requestAnimationFrame(this._frame.bind(this));
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    this.inputHandler.stop();
  }

  // Called by InputHandler via onAddToLeaderboard callback
  addToLeaderboard(name: string, score: number): void {
    addToLeaderboard(name, score);
    if (this.g) {
      this.g.leaderboardCache = getLeaderboard();
    }
  }

  // Called by InputHandler via onStateChange callback
  setStatus(status: GameStatus): void {
    if (this.g) {
      this.g.status = status;
    }
  }

  private g: GameState | null = null;

  private _frame() {
    this._update();
    this._draw();
    this.rafId = requestAnimationFrame(this._frame.bind(this));
  }

  private _update(): void {
    const g = this.g;
    if (!g) return;

    // Time management
    const rawDt = g.initialized ? Date.now() - g.lastTime : GAME_CONFIG.canvas.targetDt;
    const dt = Math.min(GAME_CONFIG.canvas.maxDt, rawDt);
    g.lastTime = Date.now();
    g.initialized = true;

    const moveScale = dt / GAME_CONFIG.canvas.targetDt;

    // Update stars
    for (const s of g.stars) {
      const config = STAR_LAYERS[s.layer - 1];
      s.y += config.speed * moveScale;
      if (s.y > GAME_CONFIG.canvas.height) {
        s.y = -s.size;
        s.x = Math.random() * GAME_CONFIG.canvas.width;
      }
    }

    // State transitions
    this._handleStateTransitions(g);

    // Only update gameplay when playing
    if (g.status !== 'playing') return;

    // Update timers and power-ups
    this.physicsSystem.updateCooldowns(g, dt);
    this.physicsSystem.updatePlayerInvulnerability(g, dt);
    this.collisionSystem.applyPowerUps(g, dt);
    this.physicsSystem.updateShake(dt);

    // UFO logic
    this.physicsSystem.updateUFO(g, dt);

    // Input processing
    this.inputHandler.processInput(g, dt);
    
    // Check for shoot
    if (this.inputHandler.checkForShoot(g)) {
      this.physicsSystem.spawnPlayerBullet(g);
      g.player.cooldown = g.activePowerUps.rapidFire > 0 
        ? GAME_CONFIG.player.rapidFireCooldown 
        : GAME_CONFIG.player.shootCooldown;
    }

    // Update bullets
    this.physicsSystem.updateBullets(g, moveScale);

    // Level progression
    this.levelSystem.checkLevelComplete(g);

    // Alien movement
    this.levelSystem.moveAliens(g, dt);
    this.levelSystem.updateAlienShootingTimer(g, dt);
    this.physicsSystem.updatePowerUps(g, moveScale);

    // Spawn alien bullets
    if (g.alienShootTimer <= 0) {
      this.levelSystem.spawnAlienBullet(g);
    }

    // Shield damage from aliens
    this.physicsSystem.damageShieldsWithAliens(g);

    // Collision detection - Bullets vs Game Objects
    for (let i = g.bullets.length - 1; i >= 0; i--) {
      const b = g.bullets[i];

      // Check shield damage
      if (b.owner === 'player') {
        for (const s of g.shields) {
          if (this.collisionSystem.checkPlayerBulletShield(b, s, g)) {
            this.physicsSystem.triggerShake( 2, 65);
            g.bullets.splice(i, 1);
            break;
          }
        }
        if (!g.bullets[i]) continue;
      }

      // Check alien collision
      if (b.owner === 'player') {
        for (const a of g.aliens) {
          if (this.collisionSystem.checkBulletAlienCollision(b, a, g)) {
            this.physicsSystem.triggerShake( 4, 130);
            g.particles.push(createImpactFlash(b.x + b.w / 2, b.y + b.h / 2, '#fef08a', 12));
            break;
          }
        }
        // Check UFO collision
        if (g.ufo) {
          if (this.collisionSystem.checkBulletUFOCollision(b, g.ufo, g)) {
            g.bullets.splice(i, 1);
            continue;
          }
        }
        continue;
      }

      // Check player collision
      if (b.owner === 'alien') {
        if (this.collisionSystem.checkBulletPlayerCollision(b, g.player)) {
          if (g.activePowerUps.shield > 0) {
            g.particles.push(...createExplosionParticles(b.x + b.w / 2, b.y + b.h / 2, '#3b82f6', 8));
            g.particles.push(createImpactFlash(b.x + b.w / 2, b.y + b.h / 2, '#93c5fd', 10));
            g.bullets.splice(i, 1);
            continue;
          }
          g.lives--;
          g.player.invulnerable = 2000;
          g.particles.push(...createExplosionParticles(g.player.x + g.player.w / 2, g.player.y + g.player.h / 2, '#67e8f9', 50));
          g.particles.push(createImpactFlash(b.x + b.w / 2, b.y + b.h / 2, '#fca5a5', 14));
          this.physicsSystem.triggerShake( 5, 130);
          g.bullets.splice(i, 1);

          if (g.lives <= 0) {
            this.physicsSystem.triggerShake( 8, 250);
            setGameOver(g);
          }
          continue;
        }
      }
    }

    // Power-up collision
    for (let i = g.powerUps.length - 1; i >= 0; i--) {
      const p = g.powerUps[i];
      if (this.collisionSystem.checkPowerUpCollision(p, g.player)) {
        if (p.type === 'rapidFire') {
          g.activePowerUps.rapidFire = 8000;
        } else if (p.type === 'shield') {
          g.activePowerUps.shield = 8000;
        } else if (p.type === 'bomb') {
          this.physicsSystem.applyBomb(g);
        }
        const pColor = p.type === 'rapidFire' ? '#f97316' : p.type === 'shield' ? '#3b82f6' : '#ef4444';
        g.particles.push(...createExplosionParticles(p.x + p.w / 2, p.y + p.h / 2, pColor, 10));
        g.powerUps.splice(i, 1);
      }
    }

    // Check if aliens reached player
    this.levelSystem.checkAlienReachedPlayer(g);

    // Update particles
    this.physicsSystem.updateParticles(g, moveScale);

    this._notifyUI();
  }

  private _handleStateTransitions(g: GameState): void {
    switch (g.status) {
      case 'menu':
        // Check for spacebar to start
        if (g.keys[' '] || g.keys['Spacebar']) {
          this.stateManager.setPlaying(g);
          g.ufoTimer = GAME_CONFIG.ufo.timerMin + Math.random() * GAME_CONFIG.ufo.timerRange;
        }
        break;

      case 'gameover':
        // Check for spacebar to return to menu
        if (g.keys[' '] || g.keys['Spacebar']) {
          this.stateManager.setMenu(g);
        }
        break;

      case 'nameEntry':
        // Already handled by input handler
        break;
    }
  }

  private _draw(): void {
    const g = this.g;
    if (!g) return;
    const ctx = this.ctx;
    if (!ctx) return;

    // Clear and apply shake
    this.renderingSystem.clearCanvas(ctx);
    const shakeX = this.physicsSystem.getShakeX();
    const shakeY = this.physicsSystem.getShakeY();
    const shakeActive = shakeX !== 0 || shakeY !== 0;
    if (shakeActive) {
      ctx.save();
      ctx.translate(shakeX, shakeY);
    }

    // Draw game elements
    this.renderingSystem.drawStars(ctx, g.stars, Date.now());
    this.renderingSystem.drawGround(ctx);
    this.renderingSystem.drawShields(ctx, g.shields);
    this.renderingSystem.drawAliens(ctx, g.aliens, g.alienFrame);
    this.renderingSystem.drawUFO(ctx, g.ufo);
    this.renderingSystem.drawPlayer(ctx, g.player, g.player.invulnerable, g.activePowerUps.shield > 0);
    this.renderingSystem.drawPowerUps(ctx, g.powerUps);
    this.renderingSystem.drawBullets(ctx, g.bullets);
    this.renderingSystem.drawParticles(ctx, g.particles);
    this.renderingSystem.drawHUD(ctx, g.score, g.highScore, g.lives, g.level);
    this.renderingSystem.drawLevelAnnouncement(ctx, g.level, g.levelAnnounceTimer);

    // Draw screens based on status
    if (g.status === 'menu') {
      this.renderingSystem.drawMenu(ctx, g.leaderboardCache);
    } else if (g.status === 'gameover') {
      this.renderingSystem.drawGameOver(ctx, g.score);
    } else if (g.status === 'nameEntry') {
      this.renderingSystem.drawNameEntry(ctx, g.pendingName, g.score);
    }

    // Restore from shake
    if (shakeActive) {
      ctx.restore();
    }
  }

  private _notifyUI() {
    const g = this.g;
    if (!g) return;
    const ui = {
      score: g.score,
      highScore: g.highScore,
      lives: g.lives,
      status: g.status,
      rapidFireTime: Math.ceil(g.activePowerUps.rapidFire / 1000),
      shieldTime: Math.ceil(g.activePowerUps.shield / 1000),
    };
    const prev = this.lastUI;
    if (
      !prev ||
      prev.score !== ui.score ||
      prev.lives !== ui.lives ||
      prev.status !== ui.status ||
      prev.rapidFireTime !== ui.rapidFireTime ||
      prev.shieldTime !== ui.shieldTime
    ) {
      this.lastUI = ui;
      this.callbacks.onUIChange(ui);
    }
  }
}