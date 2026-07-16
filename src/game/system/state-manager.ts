import type { GameState, GameStatus } from '../types';
import { GAME_CONFIG } from '../config';
import {
  SHIELD_POSITIONS,
  HIGH_SCORE_KEY,
  MAX_LEADERBOARD_ENTRIES,
  LEADERBOARD_KEY,
  createStars,
  createShield,
  getLeaderboard
} from './entity-factory';

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
      shields: SHIELD_POSITIONS.map((x) => createShield(x, GAME_CONFIG.shield.y)),
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
      shakeIntensity: 0,
      shakeDuration: 0,
      lastTime: 0,
      leaderboardCache: getLeaderboard(),
    };
  }

  // Create playing state
  createPlayingState(score: number = 0, lives: number = 3): GameState {
    return this.createInitialState(score, lives, 'playing');
  }

  // Create game over state
  createGameOverState(score: number = 0, lives: number = 3): GameState {
    return this.createInitialState(score, lives, 'gameover');
  }

  // Create name entry state (for high score)
  createNameEntryState(score: number): GameState {
    const state = this.createInitialState(score, 3, 'nameEntry');
    state.pendingName = '';
    return state;
  }

  // Reset current state with new score/lives
  resetCurrentState(g: GameState, score: number, lives: number, status: GameStatus): GameState {
    return this.createInitialState(score, lives, status);
  }

  // Get current state reference
  getCurrentState(g: GameState): GameState {
    return g;
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
  }

  // Set state to game over
  setGameOver(g: GameState, saveHighScore: boolean = true): void {
    if (g.status === 'gameover') return;
    g.status = 'gameover';
    if (saveHighScore && g.score > g.highScore) {
      g.highScore = g.score;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(g.highScore));
      } catch {
        // localStorage may be unavailable
      }
    }
  }

  // Set state to name entry
  setNameEntry(g: GameState): void {
    g.status = 'nameEntry';
  }

  // Store leaderboard for menu display
  setLeaderboardCache(g: GameState, entries: any[]): void {
    g.leaderboardCache = entries;
  }
}