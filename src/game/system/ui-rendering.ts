import { GAME_CONFIG, COLORS, SPRITES } from "../config";
import type { LeaderboardEntry } from "../types";
import { drawSprite } from "../renderer-utils";
import {
  computeShimmerSweep,
  computeBlinkAlpha,
  computeFadeInAlpha,
  computeScaleUpAnimation,
  computeThrustFlicker,
  formatPaddedScore,
} from "../rendering-math";

export class UIRenderingSystem {
  // Draw HUD (heads-up display)
  drawHUD(
    ctx: CanvasRenderingContext2D,
    score: number,
    highScore: number,
    lives: number,
    level: number
  ): void {
    ctx.fillStyle = COLORS.text;
    ctx.font = "18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE ${formatPaddedScore(score)}`, 20, 28);
    ctx.fillText(`LEVEL ${level}`, 20, 50);
    ctx.textAlign = "center";
    ctx.fillText(
      `HIGH ${formatPaddedScore(highScore)}`,
      GAME_CONFIG.canvas.width / 2,
      28
    );
    ctx.textAlign = "right";
    ctx.fillText(`LIVES ${lives}`, GAME_CONFIG.canvas.width - 20, 28);
  }

  // Draw level announcement overlay
  drawLevelAnnouncement(
    ctx: CanvasRenderingContext2D,
    level: number,
    timer: number
  ): void {
    if (timer <= 0) return;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center";
    ctx.font = "bold 48px monospace";
    ctx.fillText(
      `LEVEL ${level}`,
      GAME_CONFIG.canvas.width / 2,
      GAME_CONFIG.canvas.height / 2
    );
  }

  // Draw menu screen with animated title, player ship, and blinking prompt
  drawMenu(
    ctx: CanvasRenderingContext2D,
    leaderboard: LeaderboardEntry[],
    now: number
  ): void {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    const centerX = GAME_CONFIG.canvas.width / 2;

    // --- Animated title with shimmer sweep ---
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    const titleText = "SPACE INVADERS";
    const titleY = 120;

    // Base title
    ctx.fillStyle = "#4ade80";
    ctx.fillText(titleText, centerX, titleY);

    // Shimmer highlight — diagonal translucent band sweeping across the text
    ctx.save();
    const textWidth = ctx.measureText(titleText).width;
    const { sweepPos, bandWidth: bw } = computeShimmerSweep(now, textWidth);
    ctx.beginPath();
    ctx.moveTo(centerX - textWidth / 2 + sweepPos - bw / 2, titleY - 50);
    ctx.lineTo(centerX - textWidth / 2 + sweepPos + bw / 2, titleY - 50);
    ctx.lineTo(centerX - textWidth / 2 + sweepPos + bw / 2 + 20, titleY + 10);
    ctx.lineTo(centerX - textWidth / 2 + sweepPos - bw / 2 + 20, titleY + 10);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillText(titleText, centerX, titleY);
    ctx.restore();

    // --- Player ship below title ---
    const playerSpriteScale = 3;
    const playerW = SPRITES.player[0].length * playerSpriteScale;
    const playerH = SPRITES.player.length * playerSpriteScale;
    const playerDrawX = centerX - playerW / 2;
    const playerDrawY = 155;
    drawSprite(
      ctx,
      SPRITES.player,
      playerDrawX,
      playerDrawY,
      playerSpriteScale,
      COLORS.player
    );

    // Thrust flicker
    if (computeThrustFlicker(now)) {
      ctx.fillStyle = "#facc15";
      ctx.fillRect(centerX - 3, playerDrawY + playerH, 6, 4);
    }

    // --- Blinking "Press SPACE" prompt ---
    const blinkAlpha = computeBlinkAlpha(now);
    ctx.globalAlpha = blinkAlpha;
    ctx.fillStyle = COLORS.text;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Press SPACE to start", centerX, 220);
    ctx.globalAlpha = 1;

    // Controls hint
    ctx.font = "bold 16px monospace";
    ctx.fillText("← → or A D to move   SPACE to shoot", centerX, 250);

    if (leaderboard.length > 0) {
      ctx.font = "bold 18px monospace";
      ctx.fillStyle = COLORS.player;
      ctx.fillText("--- HIGH SCORES ---", centerX, 300);
      ctx.font = "16px monospace";
      const maxLen = Math.max(...leaderboard.map((e) => e.name.length), 3);
      for (let i = 0; i < leaderboard.length; i++) {
        ctx.fillStyle =
          i === 0
            ? "#facc15"
            : i === 1
              ? "#94a3b8"
              : i === 2
                ? "#d97706"
                : COLORS.text;
        ctx.fillText(
          `${(i + 1).toString().padStart(2, " ")}. ${leaderboard[i].name.padEnd(maxLen)}  ${formatPaddedScore(leaderboard[i].score, 6)}`,
          centerX,
          330 + i * 24
        );
      }
    }
  }

  // Draw game over screen with fade-in overlay, scale-up score, and blinking prompt
  drawGameOver(
    ctx: CanvasRenderingContext2D,
    score: number,
    now: number,
    screenOpenedAt: number
  ): void {
    const elapsed = now - screenOpenedAt;

    // Overlay fades in from 0 → 0.75 over ~400ms
    const overlayAlpha = computeFadeInAlpha(elapsed);
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    ctx.textAlign = "center";
    const centerX = GAME_CONFIG.canvas.width / 2;

    // "GAME OVER" title
    ctx.fillStyle = COLORS.ufo;
    ctx.font = "bold 48px monospace";
    ctx.fillText("GAME OVER", centerX, GAME_CONFIG.canvas.height / 2 - 20);

    // Final score with scale-up animation (starts at 1.3×, settles to 1.0× over ~300ms)
    const { scale: scoreScale } = computeScaleUpAnimation(elapsed);
    ctx.save();
    ctx.translate(centerX, GAME_CONFIG.canvas.height / 2 + 30);
    ctx.scale(scoreScale, scoreScale);
    ctx.fillStyle = COLORS.text;
    ctx.font = "22px monospace";
    ctx.fillText(`FINAL SCORE ${score}`, 0, 0);
    ctx.restore();

    // Blinking "Press SPACE to continue"
    const blinkAlpha = computeBlinkAlpha(now);
    ctx.globalAlpha = blinkAlpha;
    ctx.fillStyle = COLORS.text;
    ctx.font = "18px monospace";
    ctx.fillText(
      "Press SPACE to continue",
      centerX,
      GAME_CONFIG.canvas.height / 2 + 70
    );
    ctx.globalAlpha = 1;
  }

  // Draw name entry screen with fade-in overlay and blinking caret
  drawNameEntry(
    ctx: CanvasRenderingContext2D,
    pendingName: string,
    score: number,
    now: number,
    screenOpenedAt: number
  ): void {
    const elapsed = now - screenOpenedAt;

    // Overlay fades in from 0 → 0.85 over ~400ms
    const overlayAlpha = computeFadeInAlpha(elapsed, 400, 0.85);
    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.player;
    ctx.font = "bold 28px monospace";
    ctx.fillText(
      "NEW HIGH SCORE!",
      GAME_CONFIG.canvas.width / 2,
      GAME_CONFIG.canvas.height / 2 - 80
    );
    ctx.fillStyle = COLORS.text;
    ctx.font = "20px monospace";
    ctx.fillText(
      `Score: ${score}`,
      GAME_CONFIG.canvas.width / 2,
      GAME_CONFIG.canvas.height / 2 - 40
    );
    ctx.font = "16px monospace";
    ctx.fillText(
      "Enter your name:",
      GAME_CONFIG.canvas.width / 2,
      GAME_CONFIG.canvas.height / 2 + 5
    );

    const inputW = GAME_CONFIG.canvas.width * 0.3;
    const inputH = GAME_CONFIG.canvas.height * 0.05;
    const inputX = GAME_CONFIG.canvas.width / 2 - inputW / 2;
    const inputY = GAME_CONFIG.canvas.height / 2 + 20;
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 2;
    ctx.strokeRect(inputX, inputY, inputW, inputH);
    ctx.font = "22px monospace";
    ctx.fillStyle = COLORS.player;
    const caretAlpha = computeBlinkAlpha(now, 0.004);
    ctx.globalAlpha = caretAlpha;
    ctx.fillText(pendingName + "|", GAME_CONFIG.canvas.width / 2, inputY + 26);
    ctx.globalAlpha = 1;

    ctx.font = "14px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      "Press ENTER to save   BACKSPACE to delete",
      GAME_CONFIG.canvas.width / 2,
      inputY + 65
    );
  }
}
