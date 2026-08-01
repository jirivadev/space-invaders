import type { GameState } from "../types";
import { GAME_CONFIG, COLORS, EFFECT_COLORS } from "../config";
import { createExplosionParticles, createImpactFlash } from "./entity-factory";
import { setGameOver } from "./state-manager";

/**
 * Process all death animations for a single frame.
 *
 * Converts expired dying states into explosions, score, and game-over transitions.
 */
export function processDeathAnimations(g: GameState, now: number): void {
  processDyingAliens(g, now);
  processDyingUFO(g, now);
  processPlayerDeath(g, now);
}

function processDyingAliens(g: GameState, now: number): void {
  const duration = GAME_CONFIG.death.alienDuration;
  for (let i = g.aliens.length - 1; i >= 0; i--) {
    const a = g.aliens[i];
    if (a.dyingAt <= 0 || now - a.dyingAt < duration) continue;

    g.score += a.pendingScore ?? 0;
    a.pendingScore = 0;
    a.alive = false;
    a.dyingAt = 0;
    g.particles.push(
      ...createExplosionParticles(
        a.x + a.w / 2,
        a.y + a.h / 2,
        COLORS[a.type],
        40
      )
    );
  }
}

function processDyingUFO(g: GameState, now: number): void {
  if (!g.ufo || g.ufo.dyingAt === 0) return;
  if (now - g.ufo.dyingAt < GAME_CONFIG.death.ufoDuration) return;

  g.particles.push(
    ...createExplosionParticles(
      g.ufo.x + g.ufo.w / 2,
      g.ufo.y + g.ufo.h / 2,
      COLORS.ufo,
      40
    )
  );
  g.ufo = null;
}

function processPlayerDeath(g: GameState, now: number): void {
  if (g.player.diedAt === 0) return;
  if (now - g.player.diedAt < GAME_CONFIG.death.playerDuration) return;

  g.particles.push(
    ...createExplosionParticles(
      g.player.x + g.player.w / 2,
      g.player.y + g.player.h / 2,
      EFFECT_COLORS.playerExplosion,
      50
    )
  );
  g.particles.push(
    createImpactFlash(
      g.player.x + g.player.w / 2,
      g.player.y + g.player.h / 2,
      EFFECT_COLORS.impactPlayer,
      14
    )
  );
  g.player.diedAt = 0;
  setGameOver(g, now);
}
