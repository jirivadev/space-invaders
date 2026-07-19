import { GAME_CONFIG, COLORS } from './config';
import type { Player, Shield } from './types';

// ========== Rendering Helpers ==========

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  pattern: readonly string[],
  x: number,
  y: number,
  scale: number,
  color: string
) {
  ctx.fillStyle = color;
  for (let r = 0; r < pattern.length; r++) {
    const row = pattern[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'x') {
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, player: Player) {
  const pattern = [
    '----x----',
    '---xxx---',
    '--xxxxx--',
    'xxxxxxxxx',
    'xxxxxxxxx',
    'x-xxx-x-',
    'x-x-x-x-',
  ];
  drawSprite(ctx, pattern, player.x, player.y, GAME_CONFIG.player.drawScale, COLORS.player);
}

export function drawShield(ctx: CanvasRenderingContext2D, shield: Shield) {
  ctx.fillStyle = COLORS.shield;
  for (let r = 0; r < shield.rows; r++) {
    for (let c = 0; c < shield.cols; c++) {
      if (shield.pixels[r][c]) {
        ctx.fillRect(
          shield.x + c * shield.pixelSize,
          shield.y + r * shield.pixelSize,
          shield.pixelSize,
          shield.pixelSize
        );
      }
    }
  }
}
