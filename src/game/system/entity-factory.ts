import type {
  Alien, Shield, Particle, Star, UFO, PowerUp, PowerUpType, FormationType
} from '../types';
import { GAME_CONFIG, STAR_LAYERS, SPRITES } from '../config';
import { hexToRgb } from '../geometry';

// ========== Entity Creation ==========

export function createShield(x: number, y: number): Shield {
  const cols = GAME_CONFIG.shield.cols;
  const rows = GAME_CONFIG.shield.rows;
  const pixelSize = GAME_CONFIG.shield.pixelSize;
  const pixels: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      let alive = true;
      // Create arch shapes
      if (r >= 10 && c >= 8 && c < 16) alive = false;
      if (r >= 13 && c >= 6 && c < 18) alive = false;
      row.push(alive);
    }
    pixels.push(row);
  }
  return { x, y, cols, rows, pixelSize, pixels };
}

export function createAliens(formation: FormationType = 'grid', startY: number = 80): Alien[] {
  const scale = GAME_CONFIG.alien.spriteScale;
  const rowTypes: ('squid' | 'crab' | 'octopus')[] = ['squid', 'crab', 'crab', 'octopus', 'octopus', 'octopus'];
  const aliens: Alien[] = [];

  switch (formation) {
    case 'staggered': {
      const cols = 11, rows = 5, spacingX = 48, spacingY = 40, startX = 80;
      for (let r = 0; r < rows; r++) {
        const type = rowTypes[r];
        const pattern = SPRITES[type];
        const w = pattern[0].length * scale;
        const h = pattern.length * scale;
        const offsetX = r % 2 === 0 ? 0 : spacingX / 2;
        for (let c = 0; c < cols; c++) {
          aliens.push({ x: startX + c * spacingX + offsetX, y: startY + r * spacingY, w, h, type, alive: true });
        }
      }
      break;
    }
    case 'diamond': {
      const diamondCols = [5, 3, 1, 3, 5];
      const rows = 5, spacingX = 48, spacingY = 40;
      const maxCols = Math.max(...diamondCols);
      const formationCenterX = maxCols - 1;
      const startX = (GAME_CONFIG.canvas.width - formationCenterX * spacingX) / 2;
      for (let r = 0; r < rows; r++) {
        const type = rowTypes[r];
        const pattern = SPRITES[type];
        const w = pattern[0].length * scale;
        const h = pattern.length * scale;
        const count = diamondCols[r];
        const rowStartX = startX + ((maxCols - count) * spacingX) / 2;
        for (let c = 0; c < count; c++) {
          aliens.push({ x: rowStartX + c * spacingX, y: startY + r * spacingY, w, h, type, alive: true });
        }
      }
      break;
    }
    case 'compact': {
      const cols = 8, rows = 4, spacingX = 36, spacingY = 32, startX = 120;
      for (let r = 0; r < rows; r++) {
        const type = rowTypes[r];
        const pattern = SPRITES[type];
        const w = pattern[0].length * scale;
        const h = pattern.length * scale;
        for (let c = 0; c < cols; c++) {
          aliens.push({ x: startX + c * spacingX, y: startY + r * spacingY, w, h, type, alive: true });
        }
      }
      break;
    }
    case 'wide': {
      const cols = 13, rows = 6, spacingX = 40, spacingY = 35, startX = 65;
      for (let r = 0; r < rows; r++) {
        const type = rowTypes[r];
        const pattern = SPRITES[type];
        const w = pattern[0].length * scale;
        const h = pattern.length * scale;
        for (let c = 0; c < cols; c++) {
          aliens.push({ x: startX + c * spacingX, y: startY + r * spacingY, w, h, type, alive: true });
        }
      }
      break;
    }
    default: {
      const cols = 11, rows = 5, spacingX = 48, spacingY = 40, startX = 80;
      for (let r = 0; r < rows; r++) {
        const type = rowTypes[r];
        const pattern = SPRITES[type];
        const w = pattern[0].length * scale;
        const h = pattern.length * scale;
        for (let c = 0; c < cols; c++) {
          aliens.push({ x: startX + c * spacingX, y: startY + r * spacingY, w, h, type, alive: true });
        }
      }
      break;
    }
  }
  return aliens;
}

export function createStars(): Star[] {
  const stars: Star[] = [];
  for (let layerIdx = 0; layerIdx < STAR_LAYERS.length; layerIdx++) {
    const config = STAR_LAYERS[layerIdx];
    for (let i = 0; i < config.count; i++) {
      const size = config.minSize + Math.random() * (config.maxSize - config.minSize);
      stars.push({
        x: Math.random() * GAME_CONFIG.canvas.width,
        y: Math.random() * GAME_CONFIG.canvas.height,
        size: Math.round(size),
        layer: (layerIdx + 1) as 1 | 2 | 3,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
  }
  return stars;
}

export function createUFO(): UFO {
  const pattern = SPRITES.ufo;
  const scale = GAME_CONFIG.alien.spriteScale;
  const w = pattern[0].length * scale;
  const h = pattern.length * scale;
  return {
    x: -w,
    y: GAME_CONFIG.ufo.y,
    w,
    h,
    dx: GAME_CONFIG.ufo.speed,
  };
}

export function createPowerUp(x: number, y: number, type: PowerUpType): PowerUp {
  return {
    x, y, w: 20, h: 20, dy: 2, type
  };
}

export function createExplosionParticles(x: number, y: number, color: string, count: number): Particle[] {
  const particles: Particle[] = [];
  const [r, g, b] = hexToRgb(color);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const t = Math.random();

    let pType: Particle['type'];
    let pColor: string;
    let pSize: number;
    let pSpeed: number;
    let pLife: number;

    if (t < 0.2) {
      pType = 'spark';
      pColor = `rgb(${Math.min(255, r + 120)}, ${Math.min(255, g + 120)}, ${Math.min(255, b + 120)})`;
      pSize = 1;
      pSpeed = 3 + Math.random() * 5;
      pLife = 120 + Math.random() * 180;
    } else if (t < 0.5) {
      pType = 'debris';
      pColor = `rgb(${Math.floor(r * 0.45)}, ${Math.floor(g * 0.45)}, ${Math.floor(b * 0.45)})`;
      pSize = 3 + Math.floor(Math.random() * 3);
      pSpeed = 1 + Math.random() * 2;
      pLife = 500 + Math.random() * 400;
    } else {
      pType = 'fire';
      pColor = color;
      pSize = 1 + Math.floor(Math.random() * 3);
      pSpeed = 1.5 + Math.random() * 3;
      pLife = 200 + Math.random() * 300;
    }

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * pSpeed,
      vy: Math.sin(angle) * pSpeed,
      life: pLife,
      maxLife: pLife,
      color: pColor,
      size: pSize,
      type: pType,
    });
  }

  if (count >= 8) {
    const flashRadius = 15 + Math.sqrt(count) * 4;
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 80,
      maxLife: 80,
      color: '#ffffff',
      size: flashRadius,
      type: 'flash',
    });
  }

  return particles;
}

export function createImpactFlash(x: number, y: number, color: string, size: number): Particle {
  return {
    x, y, vx: 0, vy: 0,
    life: 60, maxLife: 60,
    color, size, type: 'flash',
  };
}

export function damageShieldRect(shield: Shield, x: number, y: number, w: number, h: number): boolean {
  const left = Math.floor((x - shield.x) / shield.pixelSize);
  const right = Math.floor((x + w - shield.x) / shield.pixelSize);
  const top = Math.floor((y - shield.y) / shield.pixelSize);
  const bottom = Math.floor((y + h - shield.y) / shield.pixelSize);

  let hit = false;
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (r >= 0 && r < shield.rows && c >= 0 && c < shield.cols && shield.pixels[r][c]) {
        shield.pixels[r][c] = false;
        hit = true;
      }
    }
  }
  return hit;
}

