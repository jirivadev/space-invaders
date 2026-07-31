import {
  GAME_CONFIG,
  COLORS,
  STAR_LAYERS,
  SPRITES,
  SPRITES_2,
} from "../config";
import type {
  Shield,
  Alien,
  UFO,
  Player,
  Star,
  Bullet,
  Particle,
  PowerUp,
  PowerUpType,
} from "../types";
import { drawSprite, drawShield } from "../renderer-utils";
import {
  computeDeathAnimation,
  computeStarTwinkle,
  computePlayerDeathFragments,
  computeBulletTrailEntries,
  computeShieldAuraDots,
  computeAnimationFrameIndex,
  computePowerUpGlowAlpha,
} from "../rendering-math";

const POWER_UP_VISUALS: Record<PowerUpType, { color: string; label: string }> =
  {
    rapidFire: { color: "#f97316", label: "R" },
    shield: { color: "#3b82f6", label: "S" },
    bomb: { color: "#ef4444", label: "B" },
  };

export class RenderingSystem {
  // Clear canvas with background color
  clearCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
  }

  // Draw starfield with twinkling effect (batched by layer to reduce draw calls)
  drawStars(
    ctx: CanvasRenderingContext2D,
    stars: Star[],
    now: number,
    dimFactor: number = 1
  ): void {
    ctx.fillStyle = COLORS.star;
    for (let layerIdx = 0; layerIdx < STAR_LAYERS.length; layerIdx++) {
      const config = STAR_LAYERS[layerIdx];
      const twinkle = computeStarTwinkle(
        now,
        layerIdx,
        config.minAlpha,
        config.maxAlpha
      );
      ctx.globalAlpha = twinkle * dimFactor;

      // Batch circular stars for this layer
      ctx.beginPath();
      for (const s of stars) {
        if (s.layer - 1 !== layerIdx || s.size < 2) continue;
        ctx.arc(s.x + s.size / 2, s.y + s.size / 2, s.size / 2, 0, Math.PI * 2);
      }
      ctx.fill();

      // Batch square stars for this layer
      ctx.beginPath();
      for (const s of stars) {
        if (s.layer - 1 !== layerIdx || s.size >= 2) continue;
        ctx.rect(s.x, s.y, 1, 1);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Draw ground line
  drawGround(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GAME_CONFIG.canvas.groundY);
    ctx.lineTo(GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.groundY);
    ctx.stroke();
  }

  // Draw shields
  drawShields(ctx: CanvasRenderingContext2D, shields: Shield[]): void {
    for (const s of shields) {
      drawShield(ctx, s);
    }
  }

  // Draw aliens with animation frames
  drawAliens(
    ctx: CanvasRenderingContext2D,
    aliens: Alien[],
    frame: number,
    now: number
  ): void {
    for (const a of aliens) {
      if (!a.alive && a.dyingAt === 0) continue;

      // Dying alien: white shrinking flash
      const deathAnim = computeDeathAnimation(
        a.dyingAt,
        now,
        GAME_CONFIG.death.alienDuration
      );
      if (deathAnim) {
        if (deathAnim.isComplete) continue; // will be removed in update
        ctx.globalAlpha = deathAnim.flashAlpha;
        ctx.fillStyle = "#ffffff";
        const flashW = a.w * deathAnim.flashScale;
        const flashH = a.h * deathAnim.flashScale;
        ctx.fillRect(
          a.x + (a.w - flashW) / 2,
          a.y + (a.h - flashH) / 2,
          flashW,
          flashH
        );
        ctx.globalAlpha = 1;
        continue;
      }

      const color = COLORS[a.type];
      const pattern = frame === 0 ? SPRITES[a.type] : SPRITES_2[a.type];
      drawSprite(ctx, pattern, a.x, a.y, GAME_CONFIG.alien.spriteScale, color);
    }
  }

  // Draw UFO
  drawUFO(ctx: CanvasRenderingContext2D, ufo: UFO | null, now: number): void {
    if (!ufo) return;

    // Dying UFO: white shrinking flash
    const deathAnim = computeDeathAnimation(
      ufo.dyingAt,
      now,
      GAME_CONFIG.death.ufoDuration
    );
    if (deathAnim) {
      if (deathAnim.isComplete) return;
      ctx.globalAlpha = deathAnim.flashAlpha;
      ctx.fillStyle = "#ffffff";
      const flashW = ufo.w * deathAnim.flashScale;
      const flashH = ufo.h * deathAnim.flashScale;
      ctx.fillRect(
        ufo.x + (ufo.w - flashW) / 2,
        ufo.y + (ufo.h - flashH) / 2,
        flashW,
        flashH
      );
      ctx.globalAlpha = 1;
      return;
    }

    drawSprite(
      ctx,
      SPRITES.ufo,
      ufo.x,
      ufo.y,
      GAME_CONFIG.alien.spriteScale,
      COLORS.ufo
    );
  }

  // Draw player (with invulnerability fade effect and optional shield aura)
  drawPlayer(
    ctx: CanvasRenderingContext2D,
    player: Player,
    invulnerableTime: number,
    hasShieldAura: boolean,
    now: number
  ): void {
    const centerX = player.x + player.w / 2;
    const centerY = player.y + player.h / 2;

    // Death animation: shattering sprite
    if (player.diedAt > 0) {
      const deathElapsed = now - player.diedAt;
      if (deathElapsed < GAME_CONFIG.death.playerDuration) {
        const t = deathElapsed / GAME_CONFIG.death.playerDuration;
        const deathScale = GAME_CONFIG.player.drawScale * (1 - t * 0.3);
        const deathAlpha = 1 - t;
        ctx.globalAlpha = deathAlpha;

        // Alternating death sprites for shattering effect
        const deathFrame = computeAnimationFrameIndex(deathElapsed, 75, 2);
        const deathPattern = deathFrame === 0 ? SPRITES.death1 : SPRITES.death2;
        const deathW = deathPattern[0].length * deathScale;
        const deathH = deathPattern.length * deathScale;
        drawSprite(
          ctx,
          deathPattern,
          centerX - deathW / 2,
          centerY - deathH / 2,
          deathScale,
          COLORS.player
        );

        // Drift fragments outward
        const fragments = computePlayerDeathFragments(centerX, centerY, t);
        for (const frag of fragments) {
          ctx.globalAlpha = deathAlpha * 0.7;
          ctx.fillStyle = COLORS.player;
          ctx.fillRect(frag.x - 2, frag.y - 2, 4, 4);
        }

        ctx.globalAlpha = 1;
        return;
      }
      // Death animation finished — will be handled in engine update
      return;
    }

    // Invulnerability fade (smooth sine pulse)
    if (invulnerableTime > 0) {
      const pulseAlpha = 0.3 + 0.7 * Math.abs(Math.sin(now * 0.012));
      ctx.globalAlpha = pulseAlpha;
    }

    // Thrust flame (drawn BEFORE ship so it appears behind)
    const thrustFrame = computeAnimationFrameIndex(now, 100, 2);
    const thrustPattern = thrustFrame === 0 ? SPRITES.thrust1 : SPRITES.thrust2;
    const thrustScale = GAME_CONFIG.player.drawScale;
    const thrustW = thrustPattern[0].length * thrustScale;
    drawSprite(
      ctx,
      thrustPattern,
      centerX - thrustW / 2,
      player.y + player.h,
      thrustScale,
      "#f97316"
    );

    // Shield aura — shimmering energy ring with 6 dots
    if (hasShieldAura && invulnerableTime <= 0) {
      ctx.save();
      const dots = computeShieldAuraDots(
        centerX,
        centerY,
        player.w,
        player.h,
        now
      );
      for (const dot of dots) {
        ctx.globalAlpha = dot.alpha;
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw the ship
    drawSprite(
      ctx,
      SPRITES.player,
      player.x,
      player.y,
      GAME_CONFIG.player.drawScale,
      COLORS.player
    );
    ctx.globalAlpha = 1;
  }

  // Draw power-ups with sprite, vertical bob, and pulsing glow ring
  drawPowerUps(
    ctx: CanvasRenderingContext2D,
    powerUps: PowerUp[],
    now: number
  ): void {
    for (const p of powerUps) {
      const { color, label } = POWER_UP_VISUALS[p.type];
      const spriteScale = 2;

      const centerX = p.x + p.w / 2;
      const centerY = p.y + p.h / 2;

      // Pulsing glow ring — subtle, radius ~1.3x sprite
      const glowRadius = Math.max(p.w, p.h) * 0.65;
      const glowAlpha = computePowerUpGlowAlpha(now, p.spawnedAt);
      ctx.save();
      ctx.globalAlpha = glowAlpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Draw capsule sprite
      drawSprite(ctx, SPRITES.powerUp, p.x, p.y, spriteScale, color);

      // Type letter inside the sprite
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, centerX, centerY);
      ctx.restore();
    }
  }

  // Draw bullets with trail and glow effects
  drawBullets(ctx: CanvasRenderingContext2D, bullets: Bullet[]): void {
    ctx.save();
    for (const b of bullets) {
      const bulletColor =
        b.owner === "player" ? COLORS.playerBullet : COLORS.alienBullet;
      const glowColor =
        b.owner === "player" ? "rgba(250, 204, 21, " : "rgba(248, 113, 113, ";

      // Draw trail
      const trailEntries = computeBulletTrailEntries(b.trail, b.w, b.h);
      for (const entry of trailEntries) {
        ctx.globalAlpha = entry.alpha;
        ctx.fillStyle = bulletColor;
        ctx.fillRect(entry.x, entry.y, entry.w, entry.h);
      }
      ctx.globalAlpha = 1;

      // Draw glow
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = glowColor + "1)";
      ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      ctx.globalAlpha = 0.4;
      ctx.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);

      // Draw bullet core
      ctx.globalAlpha = 1;
      ctx.fillStyle = bulletColor;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Draw highlight
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // Draw particles
  drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;

      if (p.type === "flash") {
        const flashSize = p.size * (0.5 + 0.5 * alpha);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, flashSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, flashSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "spark") {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else if (p.type === "debris") {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }
  }
}
