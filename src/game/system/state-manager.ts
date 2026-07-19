import type { GameState, GameStatus } from '../types';
import { GAME_CONFIG, HIGH_SCORE_KEY, SHIELD_POSITIONS } from '../config';
import { createStars, createShield } from './entity-factory';
import { getLeaderboard } from '../leaderboard';

export class GameStateManager {
  // Create initial game state
  createInitialState(score: number = 0, lives: number = 3, status: GameStatus = 'menu'): GameState {
    const savedHigh = Number(localStorage.getItem(HIGH_SCORE_KEY) || '0');
    return {
      status,
      score,
      highScore: Number.isFinite(savedHigh) ? savedHigh : 0,
      level: 1,
      levelAnnounceTimer: 0,
      lives,
      aliens: [],
      bullets: [],
      shields: SHIELD_POSITIONS.map((x: number) => createShield(x, GAME_CONFIG.shield.y)),
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
      pendingName: '',
      lastTime: 0,
      initialized: false,
      leaderboardCache: getLeaderboard(),
      screenOpenedAt: performance.now(),
    };
  }

  // Set state to playing
  setPlaying(g: GameState): void {
    g.status = 'playing';
    g.levelAnnounceTimer = 0;
  }

  // Set state to menu
  setMenu(g: GameState): void {
    g.status = 'menu';
    g.levelAnnounceTimer = 0;
    g.ufo = null;
    g.screenOpenedAt = performance.now();
  }

}

export function setGameOver(g: GameState, saveHighScore: boolean = true) {
  if (g.status === 'gameover' || g.status === 'nameEntry') return;
  g.screenOpenedAt = performance.now();
  const isNewHighScore = saveHighScore && g.score > g.highScore;
  if (isNewHighScore) {
    g.highScore = g.score;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(g.highScore));
    } catch {
      // localStorage may be unavailable (quota exceeded, private browsing)
    }
    g.pendingName = '';
    g.status = 'nameEntry';
  } else {
    g.status = 'gameover';
  }
}