import type { GameState, GameStatus, GameCallbacks } from "./types";
import { GAME_CONFIG, STAR_LAYERS, EFFECT_COLORS } from "./config";
import { InputHandler } from "./system/input-handler";
import { CollisionSystem } from "./system/collision-system";
import { PhysicsSystem } from "./system/physics-system";
import { LevelSystem, getLevelConfig } from "./system/level-system";
import { RenderingSystem } from "./system/rendering-system";
import { UIRenderingSystem } from "./system/ui-rendering";
import { handleBulletCollisions } from "./system/bullet-collision-handler";
import {
  createInitialState,
  setPlaying,
  setMenu,
  resetGameState,
  refreshAlienCaches,
} from "./system/state-manager";
import { getLeaderboard, addToLeaderboard } from "./leaderboard";
import { swapRemove } from "./utils";
import {
  createExplosionParticles,
  createAliens,
} from "./system/entity-factory";
import { processDeathAnimations } from "./system/death-animation-handler";

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
  private uiRendering: UIRenderingSystem;

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
    this.uiRendering = new UIRenderingSystem();
  }

  start() {
    this.g = createInitialState(0, 3, "menu", performance.now());
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
    this._handleStateTransitions(g, now);

    // Only update gameplay when playing
    if (g.status !== "playing") return;

    // Refresh cached alien arrays after state transitions may have recreated them
    refreshAlienCaches(g);

    // Update timers and power-ups
    this.physicsSystem.updateCooldowns(g, dt);
    this.physicsSystem.updatePlayerInvulnerability(g, dt);
    this.physicsSystem.updateShake(dt);
    g.levelAnnounceTimer = Math.max(0, g.levelAnnounceTimer - dt);

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
    this.physicsSystem.damageShieldsWithAliens(g, now);

    // Collision detection - Bullets vs Game Objects
    handleBulletCollisions(
      g,
      {
        collisionSystem: this.collisionSystem,
        physicsSystem: this.physicsSystem,
      },
      now
    );

    // Power-up collision
    this._handlePowerUpCollisions(g);

    // Check if aliens reached player
    this.levelSystem.checkAlienReachedPlayer(g, now);

    // Update particles
    this.physicsSystem.updateParticles(g, moveScale);

    // Process all death animations (aliens, UFO, player)
    processDeathAnimations(g, now);

    // Enforce global particle cap after all particle sources
    this.physicsSystem.enforceParticleCap(g);

    // Refresh cached alien arrays for next frame
    refreshAlienCaches(g);

    this._notifyUI();
  }

  private _handlePowerUpCollisions(g: GameState): void {
    for (let i = g.powerUps.length - 1; i >= 0; i--) {
      const p = g.powerUps[i];
      if (this.collisionSystem.checkPowerUpCollision(p, g.player)) {
        if (p.type === "rapidFire") {
          g.activePowerUps.rapidFire = GAME_CONFIG.powerUp.duration;
        } else if (p.type === "shield") {
          g.activePowerUps.shield = GAME_CONFIG.powerUp.duration;
        } else if (p.type === "bomb") {
          this.physicsSystem.applyBomb(g);
        }
        const pColor =
          p.type === "rapidFire"
            ? EFFECT_COLORS.rapidFire
            : p.type === "shield"
              ? EFFECT_COLORS.shieldAura
              : EFFECT_COLORS.bomb;
        g.particles.push(
          ...createExplosionParticles(p.x + p.w / 2, p.y + p.h / 2, pColor, 10)
        );
        swapRemove(g.powerUps, i);
      }
    }
  }

  private _handleStateTransitions(g: GameState, now: number): void {
    switch (g.status) {
      case "menu":
        // Check for spacebar to start
        if (g.keys[" "]) {
          g.keys[" "] = false;
          // Reset game state for new game
          resetGameState(g);
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
          setMenu(g, now);
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
    this.uiRendering.drawHUD(ctx, g.score, g.highScore, g.lives, g.level);
    this.uiRendering.drawLevelAnnouncement(ctx, g.level, g.levelAnnounceTimer);

    // Draw screens based on status
    if (g.status === "menu") {
      this.uiRendering.drawMenu(ctx, g.leaderboardCache, now);
    } else if (g.status === "gameover") {
      this.uiRendering.drawGameOver(ctx, g.score, now, g.screenOpenedAt);
    } else if (g.status === "nameEntry") {
      this.uiRendering.drawNameEntry(
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
