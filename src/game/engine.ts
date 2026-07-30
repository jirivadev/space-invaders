import type { GameState, GameStatus, GameCallbacks } from "./types";
import { GAME_CONFIG, STAR_LAYERS, COLORS, SHIELD_POSITIONS } from "./config";
import { InputHandler } from "./system/input-handler";
import { CollisionSystem } from "./system/collision-system";
import { PhysicsSystem } from "./system/physics-system";
import { LevelSystem, getLevelConfig } from "./system/level-system";
import { RenderingSystem } from "./system/rendering-system";
import {
  createInitialState,
  setPlaying,
  setMenu,
} from "./system/state-manager";
import { getLeaderboard, addToLeaderboard } from "./leaderboard";
import {
  createExplosionParticles,
  createImpactFlash,
  createAliens,
  createShield,
} from "./system/entity-factory";
import { setGameOver } from "./system/state-manager";

export class GameEngine {
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number = 0;
  private _boundFrame: FrameRequestCallback;
  private callbacks: GameCallbacks;

  // System instances
  private inputHandler: InputHandler;
  private collisionSystem: CollisionSystem;
  private physicsSystem: PhysicsSystem;
  private levelSystem: LevelSystem;
  private renderingSystem: RenderingSystem;

  private lastUI: {
    score: number;
    highScore: number;
    lives: number;
    status: string;
    level: number;
    rapidFireTime: number;
    shieldTime: number;
  } | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) {
      throw new Error(
        "Failed to get 2D canvas context — canvas may be unsupported"
      );
    }
    this._boundFrame = this._frame.bind(this);

    // Initialize systems
    this.inputHandler = new InputHandler({
      onUIChange: callbacks.onUIChange,
      onGetState: () => this.g!,
      onAddToLeaderboard: (name, score) => this.submitLeaderboard(name, score),
      onStateChange: (status) => this.setStatus(status),
    });
    this.collisionSystem = new CollisionSystem();
    this.physicsSystem = new PhysicsSystem();
    this.levelSystem = new LevelSystem();
    this.renderingSystem = new RenderingSystem();
  }

  start() {
    this.g = createInitialState(0, 3, "menu");
    this.inputHandler.start();
    this.rafId = requestAnimationFrame(this._boundFrame);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.inputHandler.stop();
  }

  // Called by InputHandler via onAddToLeaderboard callback
  submitLeaderboard(name: string, score: number): void {
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
    try {
      this._update();
      this._draw();
    } catch (err) {
      console.error("Game loop error:", err);
    }
    this.rafId = requestAnimationFrame(this._boundFrame);
  }

  private _update(): void {
    const g = this.g;
    if (!g) return;

    // Time management
    const now = performance.now();
    const rawDt = g.initialized
      ? now - g.lastTime
      : GAME_CONFIG.canvas.targetDt;
    const dt = Math.min(GAME_CONFIG.canvas.maxDt, rawDt);
    g.lastTime = now;
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
    if (g.status !== "playing") return;

    // Update timers and power-ups
    this.physicsSystem.updateCooldowns(g, dt);
    this.physicsSystem.updatePlayerInvulnerability(g, dt);
    this.physicsSystem.updateShake(dt);

    // UFO logic
    this.physicsSystem.updateUFO(g, dt);

    // Input processing
    this.inputHandler.processInput(g, dt);

    // Check for shoot
    if (this.inputHandler.checkForShoot(g)) {
      this.physicsSystem.spawnPlayerBullet(g);
      g.player.cooldown =
        g.activePowerUps.rapidFire > 0
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
    this._handleBulletCollisions(g);

    // Power-up collision
    this._handlePowerUpCollisions(g);

    // Check if aliens reached player
    this.levelSystem.checkAlienReachedPlayer(g);

    // Update particles
    this.physicsSystem.updateParticles(g, moveScale);

    // Process dying aliens — spawn explosion after flash duration
    this._processDyingAliens(g, now);

    // Process dying UFO — spawn explosion after flash duration
    this._processDyingUFO(g, now);

    // Process player death — spawn explosion after death animation
    this._processPlayerDeath(g, now);

    this._notifyUI();
  }

  private _handleBulletCollisions(g: GameState): void {
    for (let i = g.bullets.length - 1; i >= 0; i--) {
      const b = g.bullets[i];

      // Check shield damage
      if (b.owner === "player") {
        for (const s of g.shields) {
          if (this.collisionSystem.checkPlayerBulletShield(b, s, g)) {
            this.physicsSystem.triggerShake(2, 65);
            g.bullets.splice(i, 1);
            break;
          }
        }
        if (!g.bullets[i]) continue;
      }

      // Check alien collision
      if (b.owner === "player") {
        for (const a of g.aliens) {
          if (this.collisionSystem.checkBulletAlienCollision(b, a, g)) {
            this.physicsSystem.triggerShake(4, 130);
            g.particles.push(
              createImpactFlash(b.x + b.w / 2, b.y + b.h / 2, "#fef08a", 12)
            );
            g.bullets.splice(i, 1);
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
      if (b.owner === "alien") {
        if (this.collisionSystem.checkBulletPlayerCollision(b, g.player)) {
          if (g.activePowerUps.shield > 0) {
            g.particles.push(
              ...createExplosionParticles(
                b.x + b.w / 2,
                b.y + b.h / 2,
                "#3b82f6",
                8
              )
            );
            g.particles.push(
              createImpactFlash(b.x + b.w / 2, b.y + b.h / 2, "#93c5fd", 10)
            );
            g.bullets.splice(i, 1);
            continue;
          }
          g.lives--;
          g.player.invulnerable = 2000;
          this.physicsSystem.triggerShake(5, 130);
          g.bullets.splice(i, 1);

          if (g.lives <= 0) {
            this.physicsSystem.triggerShake(8, 250);
            g.player.diedAt = performance.now();
          } else {
            // Non-lethal hit: spawn hit particles immediately
            g.particles.push(
              ...createExplosionParticles(
                g.player.x + g.player.w / 2,
                g.player.y + g.player.h / 2,
                "#67e8f9",
                50
              )
            );
            g.particles.push(
              createImpactFlash(b.x + b.w / 2, b.y + b.h / 2, "#fca5a5", 14)
            );
          }
          continue;
        }
      }
    }
  }

  private _handlePowerUpCollisions(g: GameState): void {
    for (let i = g.powerUps.length - 1; i >= 0; i--) {
      const p = g.powerUps[i];
      if (this.collisionSystem.checkPowerUpCollision(p, g.player)) {
        if (p.type === "rapidFire") {
          g.activePowerUps.rapidFire = 8000;
        } else if (p.type === "shield") {
          g.activePowerUps.shield = 8000;
        } else if (p.type === "bomb") {
          this.physicsSystem.applyBomb(g);
        }
        const pColor =
          p.type === "rapidFire"
            ? "#f97316"
            : p.type === "shield"
              ? "#3b82f6"
              : "#ef4444";
        g.particles.push(
          ...createExplosionParticles(p.x + p.w / 2, p.y + p.h / 2, pColor, 10)
        );
        g.powerUps.splice(i, 1);
      }
    }
  }

  private _processDyingAliens(g: GameState, now: number): void {
    for (let i = g.aliens.length - 1; i >= 0; i--) {
      const a = g.aliens[i];
      if (a.dyingAt > 0 && now - a.dyingAt >= GAME_CONFIG.death.alienDuration) {
        g.score += a.pendingScore ?? 0;
        a.pendingScore = 0;
        a.alive = false;
        a.dyingAt = 0;
        g.particles.push(
          ...createExplosionParticles(
            a.x + a.w / 2,
            a.y + a.h / 2,
            COLORS[a.type],
            40
          )
        );
      }
    }
  }

  private _processDyingUFO(g: GameState, now: number): void {
    if (!g.ufo || g.ufo.dyingAt === 0) return;
    if (now - g.ufo.dyingAt >= GAME_CONFIG.death.ufoDuration) {
      g.particles.push(
        ...createExplosionParticles(
          g.ufo!.x + g.ufo!.w / 2,
          g.ufo!.y + g.ufo!.h / 2,
          COLORS.ufo,
          40
        )
      );
      g.ufo = null;
    }
  }

  private _processPlayerDeath(g: GameState, now: number): void {
    if (g.player.diedAt === 0) return;
    if (now - g.player.diedAt >= GAME_CONFIG.death.playerDuration) {
      // Spawn death explosion particles
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
          g.player.x + g.player.w / 2,
          g.player.y + g.player.h / 2,
          "#fca5a5",
          14
        )
      );
      g.player.diedAt = 0;
      // Now transition to game over
      setGameOver(g);
    }
  }

  private _handleStateTransitions(g: GameState): void {
    switch (g.status) {
      case "menu":
        // Check for spacebar to start
        if (g.keys[" "]) {
          g.keys[" "] = false;
          // Reset game state for new game
          g.score = 0;
          g.lives = 3;
          g.level = 1;
          g.shields = SHIELD_POSITIONS.map((x) =>
            createShield(x, GAME_CONFIG.shield.y)
          );
          g.bullets = [];
          g.particles = [];
          g.powerUps = [];
          g.activePowerUps = { rapidFire: 0, shield: 0 };
          g.player.cooldown = 0;
          g.player.invulnerable = 0;
          g.player.diedAt = 0;
          g.alienDir = 1;
          g.alienStepTimer = 0;
          g.alienMoveDown = false;
          setPlaying(g);
          const cfg = getLevelConfig(g.level);
          g.aliens = createAliens(cfg.formation, cfg.startY);
          g.ufoTimer =
            GAME_CONFIG.ufo.timerMin +
            Math.random() * GAME_CONFIG.ufo.timerRange;
        }
        break;

      case "gameover":
        // Check for spacebar to return to menu
        if (g.keys[" "]) {
          g.keys[" "] = false;
          setMenu(g);
        }
        break;

      case "nameEntry":
        // Already handled by input handler
        break;
    }
  }

  private _draw(): void {
    const g = this.g;
    if (!g) return;
    const ctx = this.ctx;
    if (!ctx) return;

    const now = performance.now();

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
    const isOverlay =
      g.status === "menu" ||
      g.status === "gameover" ||
      g.status === "nameEntry";
    this.renderingSystem.drawStars(ctx, g.stars, now, isOverlay ? 0.5 : 1);
    this.renderingSystem.drawGround(ctx);
    this.renderingSystem.drawShields(ctx, g.shields);
    this.renderingSystem.drawAliens(ctx, g.aliens, g.alienFrame, now);
    this.renderingSystem.drawUFO(ctx, g.ufo, now);
    this.renderingSystem.drawPlayer(
      ctx,
      g.player,
      g.player.invulnerable,
      g.activePowerUps.shield > 0,
      now
    );
    this.renderingSystem.drawPowerUps(ctx, g.powerUps, now);
    this.renderingSystem.drawBullets(ctx, g.bullets);
    this.renderingSystem.drawParticles(ctx, g.particles);
    this.renderingSystem.drawHUD(ctx, g.score, g.highScore, g.lives, g.level);
    this.renderingSystem.drawLevelAnnouncement(
      ctx,
      g.level,
      g.levelAnnounceTimer
    );

    // Draw screens based on status
    if (g.status === "menu") {
      this.renderingSystem.drawMenu(ctx, g.leaderboardCache, now);
    } else if (g.status === "gameover") {
      this.renderingSystem.drawGameOver(ctx, g.score, now, g.screenOpenedAt);
    } else if (g.status === "nameEntry") {
      this.renderingSystem.drawNameEntry(
        ctx,
        g.pendingName,
        g.score,
        now,
        g.screenOpenedAt
      );
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
      level: g.level,
      rapidFireTime: Math.ceil(g.activePowerUps.rapidFire / 1000),
      shieldTime: Math.ceil(g.activePowerUps.shield / 1000),
    };
    const prev = this.lastUI;
    if (
      !prev ||
      prev.score !== ui.score ||
      prev.highScore !== ui.highScore ||
      prev.lives !== ui.lives ||
      prev.status !== ui.status ||
      prev.level !== ui.level ||
      prev.rapidFireTime !== ui.rapidFireTime ||
      prev.shieldTime !== ui.shieldTime
    ) {
      this.lastUI = ui;
      this.callbacks.onUIChange(ui);
    }
  }
}
