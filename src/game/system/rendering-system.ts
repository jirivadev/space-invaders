import { GAME_CONFIG, COLORS, STAR_LAYERS, SPRITES } from '../config';
import { drawPlayer, drawSprite, drawShield } from './entity-factory';

export class RenderingSystem {
  private shakeX: number = 0;
  private shakeY: number = 0;
  private isShaking: boolean = false;

  updateShake(intensity: number): void {
    if (intensity > 0) {
      this.shakeX = (Math.random() - 0.5) * 2 * intensity;
      this.shakeY = (Math.random() - 0.5) * 2 * intensity;
      this.isShaking = true;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.isShaking = false;
    }
  }

  // Get current shake offset if active
  getShakeOffset(): { x: number; y: number; active: boolean } {
    return { x: this.shakeX, y: this.shakeY, active: this.isShaking };
  }

  // Clear canvas with background color
  clearCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
  }

  // Draw starfield with twinkling effect
  drawStars(ctx: CanvasRenderingContext2D, stars: any[], now: number): void {
    ctx.globalAlpha = 1;
    for (const s of stars) {
      const config = STAR_LAYERS[s.layer - 1];
      const twinkle = config.minAlpha + (config.maxAlpha - config.minAlpha) * (0.5 + 0.5 * Math.sin(now * 0.003 + s.twinkleOffset));
      ctx.globalAlpha = twinkle;
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
  drawShields(ctx: CanvasRenderingContext2D, shields: any[]): void {
    for (const s of shields) {
      drawShield(ctx, s);
    }
  }

  // Draw aliens with animation frames
  drawAliens(ctx: CanvasRenderingContext2D, aliens: any[], frame: number): void {
    for (const a of aliens) {
      if (!a.alive) continue;
      const color = COLORS[a.type];
      const pattern = frame === 0 ? SPRITES.squid : SPRITES.crab;
      drawSprite(ctx, pattern, a.x, a.y, GAME_CONFIG.alien.spriteScale, color);
    }
  }

  // Draw UFO
  drawUFO(ctx: CanvasRenderingContext2D, ufo: any | null): void {
    if (!ufo) return;
    drawSprite(ctx, SPRITES.ufo, ufo.x, ufo.y, GAME_CONFIG.alien.spriteScale, COLORS.ufo);
  }

  // Draw player (with invulnerability blink effect)
  drawPlayer(ctx: CanvasRenderingContext2D, player: any, invulnerableTime: number, activePowerUp: boolean): void {
    const playerBlink = invulnerableTime > 0 && Math.floor(Date.now() / GAME_CONFIG.ui.invulnerabilityBlinkInterval) % 2 === 0;
    if (activePowerUp && !playerBlink) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const centerX = player.x + player.w / 2;
      const centerY = player.y + player.h / 2;
      const radius = Math.max(player.w, player.h) * 0.9;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (!playerBlink) {
      drawPlayer(ctx, player);
    }
  }

  // Draw power-ups
  drawPowerUps(ctx: CanvasRenderingContext2D, powerUps: any[]): void {
    for (const p of powerUps) {
      let color = '#ffffff';
      let label = '?';
      if (p.type === 'rapidFire') {
        color = '#f97316';
        label = 'R';
      } else if (p.type === 'shield') {
        color = '#3b82f6';
        label = 'S';
      } else if (p.type === 'bomb') {
        color = '#ef4444';
        label = 'B';
      }
      ctx.fillStyle = color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#000000';
      ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
      ctx.fillStyle = color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.x + p.w / 2, p.y + p.h / 2 + 4);
    }
  }

  // Draw bullets with trail and glow effects
  drawBullets(ctx: CanvasRenderingContext2D, bullets: any[]): void {
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
  }

  // Draw particles
  drawParticles(ctx: CanvasRenderingContext2D, particles: any[]): void {
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

  // Draw menu screen
  drawMenu(ctx: CanvasRenderingContext2D, leaderboard: any[], pendingName: string): void {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('SPACE INVADERS', GAME_CONFIG.canvas.width / 2, 140);
    ctx.font = '20px monospace';
    ctx.fillText('Press SPACE to start', GAME_CONFIG.canvas.width / 2, 190);
    ctx.font = 'bold 16px monospace';
    ctx.fillText('← → or A D to move   SPACE to shoot', GAME_CONFIG.canvas.width / 2, 220);

    if (leaderboard.length > 0) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = COLORS.player;
      ctx.fillText('--- HIGH SCORES ---', GAME_CONFIG.canvas.width / 2, 280);
      ctx.font = '16px monospace';
      const maxLen = Math.max(...leaderboard.map((e) => e.name.length), 3);
      for (let i = 0; i < leaderboard.length; i++) {
        ctx.fillStyle = i === 0 ? '#facc15' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : COLORS.text;
        ctx.fillText(
          `${(i + 1).toString().padStart(2, ' ')}. ${leaderboard[i].name.padEnd(maxLen)}  ${leaderboard[i].score.toString().padStart(6, '0')}`,
          GAME_CONFIG.canvas.width / 2,
          310 + i * 24
        );
      }
    }
  }

  // Draw game over screen
  drawGameOver(ctx: CanvasRenderingContext2D, score: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
    ctx.fillStyle = COLORS.ufo;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('GAME OVER', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 - 20);
    ctx.fillStyle = COLORS.text;
    ctx.font = '22px monospace';
    ctx.fillText(`FINAL SCORE ${score}`, GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 + 30);
    ctx.font = '18px monospace';
    ctx.fillText('Press SPACE to continue', GAME_CONFIG.canvas.width / 2, GAME_CONFIG.canvas.height / 2 + 70);
  }

  // Draw name entry screen
  drawNameEntry(ctx: CanvasRenderingContext2D, pendingName: string, score: number): void {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
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
    const blink = Math.floor(Date.now() / GAME_CONFIG.ui.invulnerabilityBlinkInterval) % 2 === 0;
    ctx.fillText(pendingName + (blink ? '|' : ''), GAME_CONFIG.canvas.width / 2, inputY + 26);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Press ENTER to save   BACKSPACE to delete', GAME_CONFIG.canvas.width / 2, inputY + 65);
  }
}