export type GameStatus = 'menu' | 'playing' | 'gameover' | 'nameEntry';

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: number;
}

export type FormationType = 'grid' | 'staggered' | 'diamond' | 'compact' | 'wide';

export interface LevelConfig {
  formation: FormationType;
  speedMultiplier: number;
  shootIntervalMultiplier: number;
  enemyBulletSpeed: number;
  startY: number;
}

export interface Alien {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'squid' | 'crab' | 'octopus';
  alive: boolean;
  dyingAt: number;
}

export interface Bullet {
  x: number;
  y: number;
  w: number;
  h: number;
  dy: number;
  owner: 'player' | 'alien';
  trail: Array<{ x: number; y: number }>;
}

export interface Shield {
  x: number;
  y: number;
  cols: number;
  rows: number;
  pixelSize: number;
  pixels: boolean[][];
}

export interface UFO {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dyingAt: number;
}

export type ParticleType = 'spark' | 'debris' | 'fire' | 'flash';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: ParticleType;
}

export interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  cooldown: number;
  invulnerable: number;
  diedAt: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  layer: 1 | 2 | 3;
  twinkleOffset: number;
}

export type PowerUpType = 'rapidFire' | 'shield' | 'bomb';

export interface PowerUp {
  x: number;
  y: number;
  w: number;
  h: number;
  dy: number;
  type: PowerUpType;
  spawnedAt: number;
}

export interface GameState {
  status: GameStatus;
  score: number;
  highScore: number;
  level: number;
  levelAnnounceTimer: number;
  lives: number;
  aliens: Alien[];
  bullets: Bullet[];
  shields: Shield[];
  ufo: UFO | null;
  particles: Particle[];
  player: Player;
  keys: Record<string, boolean>;
  alienDir: number;
  alienStepTimer: number;
  alienFrame: number;
  alienMoveDown: boolean;
  ufoTimer: number;
  alienShootTimer: number;
  stars: Star[];
  powerUps: PowerUp[];
  activePowerUps: {
    rapidFire: number;
    shield: number;
  };
  pendingName: string;
  lastTime: number;
  initialized: boolean;
  leaderboardCache: LeaderboardEntry[];
  screenOpenedAt: number;
}

export interface UIState {
  score: number;
  highScore: number;
  lives: number;
  status: GameStatus;
  rapidFireTime: number;
  shieldTime: number;
}

export interface GameCallbacks {
  onUIChange: (ui: UIState) => void;
  onGetState?: () => GameState;
  onAddToLeaderboard?: (name: string, score: number) => void;
  onStateChange?: (status: GameStatus) => void;
}
