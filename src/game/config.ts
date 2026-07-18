/**
 * Game Configuration
 * 
 * Centralized configuration for all game constants.
 * Extracted from constants.ts to reduce magic numbers in engine.ts.
 * 
 * @see src/game/constants.ts for original definitions
 */

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 640;
export const GROUND_Y = 600;
export const TARGET_FPS = 60;
export const TARGET_DT = 1000 / TARGET_FPS;
export const MAX_DT = 100;

/**
 * Shield configuration
 */
export const SHIELD_COLS = 24;
export const SHIELD_ROWS = 16;
export const SHIELD_PIXEL_SIZE = 3;
export const SHIELD_Y = 480;

/**
 * Player configuration
 */
export const PLAYER_WIDTH = 27;
export const PLAYER_HEIGHT = 21;
export const PLAYER_SPEED = 5;
export const PLAYER_Y_OFFSET = 28;
export const PLAYER_BOUNDARY_PADDING = 10;
export const PLAYER_DRAW_SCALE = 3;

/**
 * Bullet configuration
 */
export const PLAYER_BULLET_WIDTH = 4;
export const PLAYER_BULLET_HEIGHT = 12;
export const PLAYER_BULLET_SPEED = -9;
export const ALIEN_BULLET_WIDTH = 4;
export const ALIEN_BULLET_HEIGHT = 10;

/**
 * Alien configuration
 */
export const ALIEN_STEP_X = 8;
export const ALIEN_STEP_DOWN = 20;
export const ALIEN_SPRITE_SCALE = 3;
export const ALIEN_SPACING_X = 3;
export const ALIEN_SPACING_Y = 3;

/**
 * UFO configuration
 */
export const UFO_Y = 35;
export const UFO_SPEED = 2.5;

/**
 * Leaderboard configuration
 */
export const LEADERBOARD_KEY = 'space-invaders-leaderboard';
export const HIGH_SCORE_KEY = 'space-invaders-highscore';
export const MAX_LEADERBOARD_ENTRIES = 10;
export const PLAYER_NAME_MAX_LENGTH = 8;

/**
 * Timer configurations
 */
export const UFO_TIMER_MIN = 10000;
export const UFO_TIMER_RANGE = 15000;

/**
 * Cooldown configurations (in milliseconds)
 */
export const PLAYER_SHOOT_COOLDOWN = 333;
export const RAPID_FIRE_COOLDOWN = 120;

/**
 * Particle configuration
 */
export const BOMB_PARTICLES_PER_ALIEN = 2;
export const MAX_PARTICLES = 500;
export const PARTICLE_LIFE_DECAY_PER_FRAME = 60;

/**
 * Shield positions (X coordinates for 4 shields)
 */
export const SHIELD_POSITIONS = [110, 290, 470, 650];

/**
 * Complete game configuration object
 * Use this for organizing all tunable game parameters
 */
export const GAME_CONFIG = {
  // Canvas & Resolution
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    groundY: GROUND_Y,
    targetFPS: TARGET_FPS,
    targetDt: TARGET_DT,
    maxDt: MAX_DT,
  },

  // Shield Configuration
  shield: {
    cols: SHIELD_COLS,
    rows: SHIELD_ROWS,
    pixelSize: SHIELD_PIXEL_SIZE,
    y: SHIELD_Y,
    positions: SHIELD_POSITIONS,
  },

  // Player Configuration
  player: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speed: PLAYER_SPEED,
    yOffset: PLAYER_Y_OFFSET,
    boundaryPadding: PLAYER_BOUNDARY_PADDING,
    drawScale: PLAYER_DRAW_SCALE,
    shootCooldown: PLAYER_SHOOT_COOLDOWN,
    rapidFireCooldown: RAPID_FIRE_COOLDOWN,
  },

  // Bullet Configuration
  bullet: {
    playerWidth: PLAYER_BULLET_WIDTH,
    playerHeight: PLAYER_BULLET_HEIGHT,
    playerSpeed: PLAYER_BULLET_SPEED,
    alienWidth: ALIEN_BULLET_WIDTH,
    alienHeight: ALIEN_BULLET_HEIGHT,
  },

  // Alien Configuration
  alien: {
    stepX: ALIEN_STEP_X,
    stepDown: ALIEN_STEP_DOWN,
    spriteScale: ALIEN_SPRITE_SCALE,
    spacingX: ALIEN_SPACING_X,
    spacingY: ALIEN_SPACING_Y,
  },

  // UFO Configuration
  ufo: {
    y: UFO_Y,
    speed: UFO_SPEED,
    timerMin: UFO_TIMER_MIN,
    timerRange: UFO_TIMER_RANGE,
  },

  // Leaderboard Configuration
  leaderboard: {
    key: LEADERBOARD_KEY,
    highScoreKey: HIGH_SCORE_KEY,
    maxEntries: MAX_LEADERBOARD_ENTRIES,
    playerNameMaxLength: PLAYER_NAME_MAX_LENGTH,
  },

  // Particle Configuration
  particle: {
    bombParticlesPerAlien: BOMB_PARTICLES_PER_ALIEN,
    maxCount: MAX_PARTICLES,
    lifeDecayPerFrame: PARTICLE_LIFE_DECAY_PER_FRAME,
  },

  // UI & Display
  ui: {
    invulnerabilityBlinkInterval: 80,  // milliseconds
    nameEntryMaxChars: PLAYER_NAME_MAX_LENGTH,
  },
} as const;

/**
 * Color palette interface for game entities
 */
export interface Colors {
  readonly bg: string;
  readonly player: string;
  readonly playerBullet: string;
  readonly alienBullet: string;
  readonly squid: string;
  readonly crab: string;
  readonly octopus: string;
  readonly ufo: string;
  readonly shield: string;
  readonly text: string;
  readonly star: string;
}

/**
 * Game colors
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
} as const satisfies Colors;

/**
 * Star layer configurations
 */
export const STAR_LAYERS = [
  { count: 50, minSize: 1, maxSize: 1, speed: 0.3, minAlpha: 0.2, maxAlpha: 0.5 },
  { count: 30, minSize: 1, maxSize: 2, speed: 0.8, minAlpha: 0.4, maxAlpha: 0.7 },
  { count: 15, minSize: 2, maxSize: 3, speed: 1.5, minAlpha: 0.6, maxAlpha: 1.0 },
] as const;

/**
 * Sprite patterns for aliens
 */
export const SPRITES = {
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
} as const;

/**
 * Alternating sprite patterns for alien animation
 */
export const SPRITES_2 = {
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