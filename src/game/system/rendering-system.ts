import { GAME_CONFIG, COLORS, STAR_LAYERS, SPRITES, SPRITES_2 } from '../config';
import type { Shield, Alien, UFO, Player, Star, Bullet, Particle, PowerUp, PowerUpType, LeaderboardEntry } from '../types';
import { drawPlayer, drawSprite, drawShield } from '../renderer-utils';

const POWER_UP_VISUALS: Record<PowerUpType, { color: string; label: string }> = {
  rapidFire: { color: '#f97316', label: 'R' },
  shield: { color: '#3b82f6', label: 'S' },
  bomb: { color: '#ef4444', label: 'B' },
};

export class RenderingSystem {
  // Clear canvas with background color
  clearCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
  }

  // Draw starfield with twinkling effect
  drawStars(ctx: CanvasRenderingContext2D, stars: Star[], now: number, dimFactor: number = 1): void {
    ctx.globalAlpha = 1;
    for (const s of stars) {
      const config = STAR_LAYERS[s.layer - 1];
      const twinkle = config.minAlpha + (config.maxAlpha - config.minAlpha) * (0.5 + 0.5 * Math.sin(now * 0.003 + s.twinkleOffset));
      ctx.globalAlpha = twinkle * dimFactor;
      ctx.fillStyle = COLORS.star;
      if (s.size >= 2) {
        ctx.beginPath();
        ctx.arc(s.x + s.size / 2, s.y + s.size / 2, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(s.x, s.y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Draw ground line
  drawGround(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = '#334155';
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
  drawAliens(ctx: CanvasRenderingContext2D, aliens: Alien[], frame: number, now: number): void {
    for (const a of aliens) {
      if (!a.alive && a.dyingAt === 0) continue;

      // Dying alien: white shrinking flash
      if (a.dyingAt > 0) {
        const deathElapsed = now - a.dyingAt;
        const deathDuration = 150;
        if (deathElapsed >= deathDuration) continue; // will be removed in update
        const t = deathElapsed / deathDuration;
        const flashScale = 1 - t;
        const flashAlpha = 1 - t;
        ctx.globalAlpha = flashAlpha;
        ctx.fillStyle = '#ffffff';
        const flashW = a.w * flashScale;
        const flashH = a.h * flashScale;
        ctx.fillRect(a.x + (a.w - flashW) / 2, a.y + (a.h - flashH) / 2, flashW, flashH);
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
    if (ufo.dyingAt > 0) {
      const deathElapsed = now - ufo.dyingAt;
      const deathDuration = 150;
      if (deathElapsed >= deathDuration) return;
      const t = deathElapsed / deathDuration;
      const flashScale = 1 - t;
      const flashAlpha = 1 - t;
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = '#ffffff';
      const flashW = ufo.w * flashScale;
      const flashH = ufo.h * flashScale;
      ctx.fillRect(ufo.x + (ufo.w - flashW) / 2, ufo.y + (ufo.h - flashH) / 2, flashW, flashH);
      ctx.globalAlpha = 1;
      return;
    }

    drawSprite(ctx, SPRITES.ufo, ufo.x, ufo.y, GAME_CONFIG.alien.spriteScale, COLORS.ufo);
  }

  // Draw player (with invulnerability fade effect and optional shield aura)
  drawPlayer(ctx: CanvasRenderingContext2D, player: Player, invulnerableTime: number, hasShieldAura: boolean, now: number): void {
    const centerX = player.x + player.w / 2;
    const centerY = player.y + player.h / 2;

    // Death animation: shattering sprite
    if (player.diedAt > 0) {
      const deathElapsed = now - player.diedAt;
      const deathDuration = 300;
      if (deathElapsed < deathDuration) {
        const t = deathElapsed / deathDuration;
        const deathScale = GAME_CONFIG.player.drawScale * (1 - t * 0.3);
        const deathAlpha = 1 - t;
        ctx.globalAlpha = deathAlpha;

        // Alternating death sprites for shattering effect
        const deathPattern = Math.floor(deathElapsed / 75) % 2 === 0 ? SPRITES.death1 : SPRITES.death2;
        const deathW = deathPattern[0].length * deathScale;
        const deathH = deathPattern.length * deathScale;
        drawSprite(ctx, deathPattern, centerX - deathW / 2, centerY - deathH / 2, deathScale, COLORS.player);

        // Drift fragments outward
        const fragmentCount = 4;
        for (let i = 0; i < fragmentCount; i++) {
          const angle = (i / fragmentCount) * Math.PI * 2 + t * 0.5;
          const dist = t * 30;
          const fx = centerX + Math.cos(angle) * dist;
          const fy = centerY + Math.sin(angle) * dist;
          ctx.globalAlpha = deathAlpha * 0.7;
          ctx.fillStyle = COLORS.player;
          ctx.fillRect(fx - 2, fy - 2, 4, 4);
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
    const thrustPattern = Math.floor(now / 100) % 2 === 0 ? SPRITES.thrust1 : SPRITES.thrust2;
    const thrustScale = GAME_CONFIG.player.drawScale;
    const thrustW = thrustPattern[0].length * thrustScale;
    drawSprite(ctx, thrustPattern, centerX - thrustW / 2, player.y + player.h, thrustScale, '#f97316');

    // Shield aura — shimmering energy ring with 6 dots
    if (hasShieldAura && invulnerableTime <= 0) {
      ctx.save();
      const auraRadius = Math.max(player.w, player.h) * 0.75;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + now * 0.003;
        const dotX = centerX + Math.cos(angle) * auraRadius;
        const dotY = centerY + Math.sin(angle) * auraRadius;
        const dotAlpha = 0.3 + 0.5 * Math.abs(Math.sin(now * 0.005 + i * 1.1));
        ctx.globalAlpha = dotAlpha;
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw the ship
    drawPlayer(ctx, player);
    ctx.globalAlpha = 1;
  }

  // Draw power-ups with sprite, vertical bob, and pulsing glow ring
  drawPowerUps(ctx: CanvasRenderingContext2D, powerUps: PowerUp[], now: number): void {
    for (const p of powerUps) {
      const { color, label } = POWER_UP_VISUALS[p.type];
      const spriteScale = 2;
      const spawnPhase = p.spawnedAt * 0.001;

      const centerX = p.x + p.w / 2;
      const centerY = p.y + p.h / 2;

      // Pulsing glow ring — subtle, radius ~1.3x sprite
      const glowRadius = Math.max(p.w, p.h) * 0.65;
      const glowAlpha = 0.3 + 0.4 * Math.abs(Math.sin(now * 0.004 + spawnPhase));
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
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, centerX, centerY);
      ctx.restore();
    }
  }

  // Draw bullets with trail and glow effects
  drawBullets(ctx: CanvasRenderingContext2D, bullets: Bullet[]): void {
    ctx.save();
    for (const b of bullets) {
      const bulletColor = b.owner === 'player' ? COLORS.playerBullet : COLORS.alienBullet;
      const glowColor = b.owner === 'player' ? 'rgba(250, 204, 21, ' : 'rgba(248, 113, 113, ';

      // Draw trail
      for (let t = 0; t < b.trail.length; t++) {
        const entry = b.trail[t];
        const trailAlpha = (t / b.trail.length) * 0.35;
        ctx.globalAlpha = trailAlpha;
        const trailShrink = Math.max(1, b.w * (0.3 + 0.7 * (t / b.trail.length)));
        ctx.fillStyle = bulletColor;
        ctx.fillRect(
          entry.x + (b.w - trailShrink) / 2,
          entry.y,
          trailShrink,
          b.h
        );
      }
      ctx.globalAlpha = 1;

      // Draw glow
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = glowColor + '1)';
      ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      ctx.globalAlpha = 0.4;
      ctx.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);

      // Draw bullet core
      ctx.globalAlpha = 1;
      ctx.fillStyle = bulletColor;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Draw highlight
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffffff';
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

      if (p.type === 'flash') {
        const flashSize = p.size * (0.5 + 0.5 * alpha);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, flashSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, flashSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else if (p.type === 'debris') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }
  }

  // Draw HUD (heads-up display)
  drawHUD(ctx: CanvasRenderingContext2D, score: number, highScore: number, lives: number, level: number): void {
    ctx.fillStyle = COLORS.text;
    ctx.font = '18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${score.toString().padStart(5, '0')}`, 20, 28);
    ctx.fillText(`LEVEL ${level}`, 20, 50);
    ctx.textAlign = 'center';
    ctx.fillText(`HIGH ${highScore.toString().padStart(5, '0')}`, GAME_CONFIG.canvas.width / 2, 28);
    ctx.textAlign = 'right';
    ctx.fillText(`LIVES ${lives}`, GAME_CONFIG.canvas.width - 20, 28);
  }

  // Draw level announcement overlay
  drawLevelAnnouncement(ctx: CanvasRenderingContext2D, level: number, timer: number): void {
    if (timer <= 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px monospace';
    ctx.fillText(`LEVEL ${level}`, GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2);
  }

  // Draw menu screen with animated title, player ship, and blinking prompt
  drawMenu(ctx: CanvasRenderingContext2D, leaderboard: LeaderboardEntry[], now: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    const centerX = GAME_CONFIG.canvas.width / 2;

    // --- Animated title with shimmer sweep ---
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    const titleText = 'SPACE INVADERS';
    const titleY = 120;

    // Base title
    ctx.fillStyle = '#4ade80';
    ctx.fillText(titleText, centerX, titleY);

    // Shimmer highlight — diagonal translucent band sweeping across the text
    ctx.save();
    const textWidth = ctx.measureText(titleText).width;
    const sweepPos = ((now * 0.12) % (textWidth + 200)) - 100;
    const bandWidth = 80;
    ctx.beginPath();
    ctx.moveTo(centerX - textWidth / 2 + sweepPos - bandWidth / 2, titleY - 50);
    ctx.lineTo(centerX - textWidth / 2 + sweepPos + bandWidth / 2, titleY - 50);
    ctx.lineTo(centerX - textWidth / 2 + sweepPos + bandWidth / 2 + 20, titleY + 10);
    ctx.lineTo(centerX - textWidth / 2 + sweepPos - bandWidth / 2 + 20, titleY + 10);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText(titleText, centerX, titleY);
    ctx.restore();

    // --- Player ship below title ---
    const playerSpriteScale = 3;
    const playerW = SPRITES.player[0].length * playerSpriteScale;
    const playerH = SPRITES.player.length * playerSpriteScale;
    const playerDrawX = centerX - playerW / 2;
    const playerDrawY = 155;
    drawSprite(ctx, SPRITES.player, playerDrawX, playerDrawY, playerSpriteScale, COLORS.player);

    // Thrust flicker
    if (Math.sin(now * 0.02) > 0) {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(centerX - 3, playerDrawY + playerH, 6, 4);
    }

    // --- Blinking "Press SPACE" prompt ---
    const blinkAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.003));
    ctx.globalAlpha = blinkAlpha;
    ctx.fillStyle = COLORS.text;
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to start', centerX, 220);
    ctx.globalAlpha = 1;

    // Controls hint
    ctx.font = 'bold 16px monospace';
    ctx.fillText('← → or A D to move   SPACE to shoot', centerX, 250);

    if (leaderboard.length > 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = COLORS.player;
      ctx.fillText('--- HIGH SCORES ---', centerX, 300);
      ctx.font = '16px monospace';
      const maxLen = Math.max(...leaderboard.map((e) => e.name.length), 3);
      for (let i = 0; i < leaderboard.length; i++) {
        ctx.fillStyle = i === 0 ? '#facc15' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : COLORS.text;
        ctx.fillText(
          `${(i + 1).toString().padStart(2, ' ')}. ${leaderboard[i].name.padEnd(maxLen)}  ${leaderboard[i].score.toString().padStart(6, '0')}`,
          centerX,
          330 + i * 24
        );
      }
    }
  }

  // Draw game over screen with fade-in overlay, scale-up score, and blinking prompt
  drawGameOver(ctx: CanvasRenderingContext2D, score: number, now: number, screenOpenedAt: number): void {
    const elapsed = now - screenOpenedAt;

    // Overlay fades in from 0 → 0.75 over ~400ms
    const overlayAlpha = Math.min(0.75, (elapsed / 400) * 0.75);
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    ctx.textAlign = 'center';
    const centerX = GAME_CONFIG.canvas.width / 2;

    // "GAME OVER" title
    ctx.fillStyle = COLORS.ufo;
    ctx.font = 'bold 48px monospace';
    ctx.fillText('GAME OVER', centerX, GAME_CONFIG.canvas.height / 2 - 20);

    // Final score with scale-up animation (starts at 1.3×, settles to 1.0× over ~300ms)
    const scaleProgress = Math.min(1, elapsed / 300);
    const scoreScale = 1.3 - 0.3 * scaleProgress;
    ctx.save();
    ctx.translate(centerX, GAME_CONFIG.canvas.height / 2 + 30);
    ctx.scale(scoreScale, scoreScale);
    ctx.fillStyle = COLORS.text;
    ctx.font = '22px monospace';
    ctx.fillText(`FINAL SCORE ${score}`, 0, 0);
    ctx.restore();

    // Blinking "Press SPACE to continue"
    const blinkAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.003));
    ctx.globalAlpha = blinkAlpha;
    ctx.fillStyle = COLORS.text;
    ctx.font = '18px monospace';
    ctx.fillText('Press SPACE to continue', centerX, GAME_CONFIG.canvas.height / 2 + 70);
    ctx.globalAlpha = 1;
  }

  // Draw name entry screen with fade-in overlay and blinking caret
  drawNameEntry(ctx: CanvasRenderingContext2D, pendingName: string, score: number, now: number, screenOpenedAt: number): void {
    const elapsed = now - screenOpenedAt;

    // Overlay fades in from 0 → 0.85 over ~400ms
    const overlayAlpha = Math.min(0.85, (elapsed / 400) * 0.85);
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.player;
    ctx.font = 'bold 28px monospace';
    ctx.fillText('NEW HIGH SCORE!', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 80);
    ctx.fillStyle = COLORS.text;
    ctx.font = '20px monospace';
    ctx.fillText(`Score: ${score}`, GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 40);
    ctx.font = '16px monospace';
    ctx.fillText('Enter your name:', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 + 5);

    const inputW = GAME_CONFIG.canvas.width * 0.3;
    const inputH = GAME_CONFIG.canvas.height * 0.05;
    const inputX = GAME_CONFIG.canvas.width / 2 - inputW / 2;
    const inputY = GAME_CONFIG.canvas.height / 2 + 20;
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 2;
    ctx.strokeRect(inputX, inputY, inputW, inputH);
    ctx.font = '22px monospace';
    ctx.fillStyle = COLORS.player;
    const caretAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.004));
    ctx.globalAlpha = caretAlpha;
    ctx.fillText(pendingName + '|', GAME_CONFIG.canvas.width / 2, inputY + 26);
    ctx.globalAlpha = 1;

    ctx.font = '14px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Press ENTER to save   BACKSPACE to delete', GAME_CONFIG.canvas.width / 2, inputY + 65);
  }
}