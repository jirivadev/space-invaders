/**
 * Game Constants
 * 
 * @deprecated Use GAME_CONFIG from {@link ./config.ts} instead.
 * This file is kept for backward compatibility only.
 * 
 * @see src/game/config.ts for recommended usage
 */

import { GAME_CONFIG } from './config';

// Individual constants for backward compatibility
export const CANVAS_WIDTH = GAME_CONFIG.canvas.width;
export const CANVAS_HEIGHT = GAME_CONFIG.canvas.height;
export const GROUND_Y = GAME_CONFIG.canvas.groundY;
export const TARGET_FPS = GAME_CONFIG.canvas.targetFPS;
export const TARGET_DT = GAME_CONFIG.canvas.targetDt;
export const MAX_DT = GAME_CONFIG.canvas.maxDt;

// Shield
export const SHIELD_COLS = GAME_CONFIG.shield.cols;
export const SHIELD_ROWS = GAME_CONFIG.shield.rows;
export const SHIELD_PIXEL_SIZE = GAME_CONFIG.shield.pixelSize;
export const SHIELD_Y = GAME_CONFIG.shield.y;

// Player
export const PLAYER_WIDTH = GAME_CONFIG.player.width;
export const PLAYER_HEIGHT = GAME_CONFIG.player.height;
export const PLAYER_SPEED = GAME_CONFIG.player.speed;
export const PLAYER_Y_OFFSET = GAME_CONFIG.player.yOffset;
export const PLAYER_BOUNDARY_PADDING = GAME_CONFIG.player.boundaryPadding;
export const PLAYER_DRAW_SCALE = GAME_CONFIG.player.drawScale;

// Bullets
export const PLAYER_BULLET_WIDTH = GAME_CONFIG.bullet.playerWidth;
export const PLAYER_BULLET_HEIGHT = GAME_CONFIG.bullet.playerHeight;
export const PLAYER_BULLET_SPEED = GAME_CONFIG.bullet.playerSpeed;
export const ALIEN_BULLET_WIDTH = GAME_CONFIG.bullet.alienWidth;
export const ALIEN_BULLET_HEIGHT = GAME_CONFIG.bullet.alienHeight;

// Aliens & UFO
export const ALIEN_STEP_X = GAME_CONFIG.alien.stepX;
export const ALIEN_STEP_DOWN = GAME_CONFIG.alien.stepDown;
export const ALIEN_SPRITE_SCALE = GAME_CONFIG.alien.spriteScale;
export const ALIEN_SPACING_X = GAME_CONFIG.alien.spacingX;
export const ALIEN_SPACING_Y = GAME_CONFIG.alien.spacingY;

export const UFO_Y = GAME_CONFIG.ufo.y;
export const UFO_SPEED = GAME_CONFIG.ufo.speed;

// Leaderboard
export const LEADERBOARD_KEY = GAME_CONFIG.leaderboard.key;
export const HIGH_SCORE_KEY = GAME_CONFIG.leaderboard.highScoreKey;
export const MAX_LEADERBOARD_ENTRIES = GAME_CONFIG.leaderboard.maxEntries;
export const PLAYER_NAME_MAX_LENGTH = GAME_CONFIG.leaderboard.playerNameMaxLength;

// Timer
export const UFO_TIMER_MIN = GAME_CONFIG.ufo.timerMin;
export const UFO_TIMER_RANGE = GAME_CONFIG.ufo.timerRange;

// Cooldowns (milliseconds)
export const PLAYER_SHOOT_COOLDOWN = GAME_CONFIG.player.shootCooldown;
export const RAPID_FIRE_COOLDOWN = GAME_CONFIG.player.rapidFireCooldown;

// Particles
export const BOMB_PARTICLES_PER_ALIEN = GAME_CONFIG.particle.bombParticlesPerAlien;
export const MAX_PARTICLES = GAME_CONFIG.particle.maxCount;

// Shield positions
export const SHIELD_POSITIONS = GAME_CONFIG.shield.positions;

/**
 * Complete game configuration object
 * @see GAME_CONFIG
 */
export { GAME_CONFIG };

/**
 * Colors defined for game entities
 */
export const COLORS = {
  bg: '#050505',
  player: '#4ade80',
  playerBullet: '#facc15',
  alienBullet: '#f87171',
  squid: '#67e8f9',
  crab: '#f0abfc',
  octopus: '#86efac',
  ufo: '#f87171',
  shield: '#4ade80',
  text: '#ffffff',
  star: '#94a3b8',
  // Accessor for star layers (dynamic config)
  get starLayers() {
    return STAR_LAYERS;
  },
} as const;

/**
 * Star layer configurations
 */
export interface StarLayerConfig {
  count: number;
  minSize: number;
  maxSize: number;
  speed: number;
  minAlpha: number;
  maxAlpha: number;
}

export const STAR_LAYERS: StarLayerConfig[] = [
  { count: 50, minSize: 1, maxSize: 1, speed: 0.3, minAlpha: 0.2, maxAlpha: 0.5 },
  { count: 30, minSize: 1, maxSize: 2, speed: 0.8, minAlpha: 0.4, maxAlpha: 0.7 },
  { count: 15, minSize: 2, maxSize: 3, speed: 1.5, minAlpha: 0.6, maxAlpha: 1.0 },
];

/**
 * Sprite patterns for aliens
 */
export const SPRITES: Record<string, string[]> = {
  squid: [
    '---xx---',
    '--xxxx--',
    '-xxxxxx-',
    '-xx-xx--',
    '-xxxxxx-',
    '--x--x--',
    '-x----x-',
    '--------',
  ],
  crab: [
    '--x---x--',
    '---x-x---',
    '--xxxxx--',
    '-xxxxxxx-',
    'xxxxxxxx-',
    'xxx-xxx--',
    'x-x-x-x--',
    '---x-x---',
  ],
  octopus: [
    '--xxxxxx--',
    '-xxxxxxxx-',
    'xxxxxxxxxx',
    'xxxxxxxxxx',
    'xxxxxxxxxx',
    'xxx-xxx-xxx',
    'xx-x---x-xx',
    '---x---x---',
  ],
  ufo: [
    '-----xxxxxx-----',
    '---xxxxxxxxxx---',
    '--xxxxxxxxxxxx--',
    '-xxxxxxxxxxxxxx-',
    '-xxxxxxxxxxxxxx-',
    'xx-xxxxxxxxxx-xx',
    'x---xxxxxxxx---x',
    '-----xxxxxx-----',
  ],
};

/**
 * Alternating sprite patterns for alien animation
 */
export const SPRITES_2: Record<string, string[]> = {
  squid: [
    '--------',
    '---xx---',
    '---xx---',
    '--xxxx--',
    '--x--x--',
    '-x----x-',
    '--------',
    '--------',
  ],
  crab: [
    '---------',
    '---------',
    '--xxxxx--',
    '-xxxxxxx-',
    '-xxxxxxx-',
    'x-xxxxx-x',
    '--x---x--',
    '---------',
  ],
  octopus: [
    '----------',
    '----------',
    '--xxxxxx--',
    '-xxxxxxxx-',
    '-xxxxxxxx-',
    'xxxxxxxxxx',
    'xxx-xxx-xxx',
    '---x---x---',
  ],
};