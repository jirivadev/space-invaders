import { COLORS } from "./config";
import type { Shield } from "./types";

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
      if (row[c] === "x") {
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }
}

export function drawShield(ctx: CanvasRenderingContext2D, shield: Shield) {
  ctx.fillStyle = COLORS.shield;
  ctx.beginPath();
  for (let r = 0; r < shield.rows; r++) {
    let c = 0;
    while (c < shield.cols) {
      if (shield.pixels[r][c]) {
        const start = c;
        while (c < shield.cols && shield.pixels[r][c]) c++;
        ctx.rect(
          shield.x + start * shield.pixelSize,
          shield.y + r * shield.pixelSize,
          (c - start) * shield.pixelSize,
          shield.pixelSize
        );
      } else {
        c++;
      }
    }
  }
  ctx.fill();
}
