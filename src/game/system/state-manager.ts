import type { GameState, GameStatus } from "../types";
import { GAME_CONFIG, HIGH_SCORE_KEY, SHIELD_POSITIONS } from "../config";
import { createStars, createShield, createAliens } from "./entity-factory";
import { getLeaderboard } from "../leaderboard";
import { getLevelConfig } from "./level-system";

/** Reset mutable gameplay state for a fresh run (keeps high score). */
export function resetGameState(g: GameState): void {
  g.score = 0;
  g.lives = 3;
  g.level = 1;
  g.shields = SHIELD_POSITIONS.map((x: number) =>
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
}

// Module-level cache for high score (avoid repeated localStorage reads)
let _cachedHighScore: number | null = null;

function readCachedHighScore(): number {
  if (_cachedHighScore === null) {
    try {
      const saved = Number(localStorage.getItem(HIGH_SCORE_KEY) || "0");
      _cachedHighScore = Number.isFinite(saved) ? saved : 0;
    } catch {
      _cachedHighScore = 0;
    }
  }
  return _cachedHighScore;
}

/** Reset the cached high score (used by tests). */
export function resetHighScoreCache(): void {
  _cachedHighScore = null;
}

export function createInitialState(
  score: number = 0,
  lives: number = 3,
  status: GameStatus = "menu"
): GameState {
  return {
    status,
    score,
    highScore: readCachedHighScore(),
    level: 1,
    levelAnnounceTimer: 0,
    lives,
    aliens: createAliens(getLevelConfig(1).formation, getLevelConfig(1).startY),
    bullets: [],
    shields: SHIELD_POSITIONS.map((x: number) =>
      createShield(x, GAME_CONFIG.shield.y)
    ),
    ufo: null,
    particles: [],
    player: {
      x: GAME_CONFIG.canvas.width / 2 - GAME_CONFIG.player.width / 2,
      y: GAME_CONFIG.canvas.groundY - GAME_CONFIG.player.yOffset,
      w: GAME_CONFIG.player.width,
      h: GAME_CONFIG.player.height,
      speed: GAME_CONFIG.player.speed,
      cooldown: 0,
      invulnerable: 0,
      diedAt: 0,
    },
    keys: {},
    alienDir: 1,
    alienStepTimer: 0,
    alienFrame: 0,
    alienMoveDown: false,
    ufoTimer: 0,
    alienShootTimer: 0,
    stars: createStars(),
    powerUps: [],
    activePowerUps: {
      rapidFire: 0,
      shield: 0,
    },
    pendingName: "",
    lastTime: 0,
    initialized: false,
    leaderboardCache: getLeaderboard(),
    screenOpenedAt: performance.now(),
  };
}

export function setPlaying(g: GameState): void {
  g.status = "playing";
  g.levelAnnounceTimer = 0;
}

export function setMenu(g: GameState): void {
  g.status = "menu";
  g.levelAnnounceTimer = 0;
  g.ufo = null;
  g.screenOpenedAt = performance.now();
}

export function setGameOver(g: GameState, saveHighScore: boolean = true) {
  if (g.status !== "playing") return;
  g.screenOpenedAt = performance.now();
  const isNewHighScore = saveHighScore && g.score > g.highScore;
  if (isNewHighScore) {
    g.highScore = g.score;
    _cachedHighScore = g.highScore;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(g.highScore));
    } catch {
      // localStorage may be unavailable (quota exceeded, private browsing)
    }
    g.pendingName = "";
    g.status = "nameEntry";
  } else {
    g.status = "gameover";
  }
}
