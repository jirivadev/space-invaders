/**
 * Pure rendering math functions extracted from RenderingSystem.
 * No Canvas dependency — all functions are side-effect free.
 */

export interface DeathAnimation {
  /** Normalized progress [0, 1] where 0 = just started, 1 = about to complete */
  t: number;
  /** Scale factor (1 at start, shrinking toward 0) */
  flashScale: number;
  /** Alpha (1 at start, fading toward 0) */
  flashAlpha: number;
  /** True when deathElapsed >= duration (animation finished) */
  isComplete: boolean;
}

/**
 * Compute death animation parameters for aliens and UFOs.
 * Returns null when dyingAt is 0 (not dying).
 */
export function computeDeathAnimation(
  dyingAt: number,
  now: number,
  duration: number
): DeathAnimation | null {
  if (dyingAt <= 0) return null;

  const deathElapsed = now - dyingAt;
  if (deathElapsed >= duration) {
    return { t: 1, flashScale: 0, flashAlpha: 0, isComplete: true };
  }

  const t = deathElapsed / duration;
  return {
    t,
    flashScale: 1 - t,
    flashAlpha: 1 - t,
    isComplete: false,
  };
}

/**
 * Compute star twinkle alpha using sine wave.
 */
export function computeStarTwinkle(
  now: number,
  twinkleOffset: number,
  minAlpha: number,
  maxAlpha: number
): number {
  return (
    minAlpha +
    (maxAlpha - minAlpha) * (0.5 + 0.5 * Math.sin(now * 0.003 + twinkleOffset))
  );
}

/**
 * Compute player death fragment positions.
 */
export function computePlayerDeathFragments(
  centerX: number,
  centerY: number,
  t: number,
  fragmentCount: number = 4,
  maxDist: number = 30
): Array<{ x: number; y: number }> {
  const fragments: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < fragmentCount; i++) {
    const angle = (i / fragmentCount) * Math.PI * 2 + t * 0.5;
    const dist = t * maxDist;
    fragments.push({
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
    });
  }
  return fragments;
}

export interface BulletTrailEntry {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
}

/**
 * Compute bullet trail entries with shrinking width and fading alpha.
 * Uses i/trail.length ratio (0-indexed), matching original rendering.
 */
export function computeBulletTrailEntries(
  trail: Array<{ x: number; y: number }>,
  bulletW: number,
  bulletH: number
): BulletTrailEntry[] {
  return trail.map((entry, i) => {
    const r = i / trail.length;
    const w = Math.max(1, bulletW * (0.3 + 0.7 * r));
    return {
      x: entry.x + (bulletW - w) / 2,
      y: entry.y,
      w,
      h: bulletH,
      alpha: r * 0.35,
    };
  });
}

export interface ShimmerSweep {
  sweepPos: number;
  bandWidth: number;
}

/**
 * Compute shimmer sweep position for title text animation.
 */
export function computeShimmerSweep(
  now: number,
  textWidth: number,
  speed: number = 0.12,
  padding: number = 200,
  bandWidth: number = 80
): ShimmerSweep {
  const sweepPos = ((now * speed) % (textWidth + padding)) - padding / 2;
  return { sweepPos, bandWidth };
}

/**
 * Compute blink alpha for pulsing UI elements.
 */
export function computeBlinkAlpha(
  now: number,
  speed: number = 0.003,
  minAlpha: number = 0.4,
  maxAlpha: number = 1.0
): number {
  return minAlpha + (maxAlpha - minAlpha) * Math.abs(Math.sin(now * speed));
}

/**
 * Compute fade-in alpha for screen transitions.
 */
export function computeFadeInAlpha(
  elapsed: number,
  duration: number = 400,
  maxAlpha: number = 0.75
): number {
  return Math.min(maxAlpha, (elapsed / duration) * maxAlpha);
}

export interface ScaleUpAnimation {
  progress: number;
  scale: number;
}

/**
 * Compute scale-up animation (e.g. game-over score).
 * Starts at startScale and interpolates to endScale over duration.
 */
export function computeScaleUpAnimation(
  elapsed: number,
  duration: number = 300,
  startScale: number = 1.3,
  endScale: number = 1.0
): ScaleUpAnimation {
  const progress = Math.min(1, elapsed / duration);
  const scale = startScale + (endScale - startScale) * progress;
  return { progress, scale };
}

export interface ShieldAuraDot {
  x: number;
  y: number;
  alpha: number;
}

/**
 * Compute shield aura dot positions around the player.
 */
export function computeShieldAuraDots(
  centerX: number,
  centerY: number,
  playerW: number,
  playerH: number,
  now: number,
  dotCount: number = 6
): ShieldAuraDot[] {
  const auraRadius = Math.max(playerW, playerH) * 0.75;
  const dots: ShieldAuraDot[] = [];
  for (let i = 0; i < dotCount; i++) {
    const angle = (i / dotCount) * Math.PI * 2 + now * 0.003;
    const dotX = centerX + Math.cos(angle) * auraRadius;
    const dotY = centerY + Math.sin(angle) * auraRadius;
    const dotAlpha = 0.3 + 0.5 * Math.abs(Math.sin(now * 0.005 + i * 1.1));
    dots.push({ x: dotX, y: dotY, alpha: dotAlpha });
  }
  return dots;
}

/**
 * Compute animation frame index from time and interval.
 */
export function computeAnimationFrameIndex(
  now: number,
  interval: number,
  frameCount: number = 2
): number {
  return Math.floor(now / interval) % frameCount;
}

/**
 * Compute power-up glow alpha with phase offset from spawn time.
 */
export function computePowerUpGlowAlpha(
  now: number,
  spawnedAt: number,
  speed: number = 0.004,
  minAlpha: number = 0.3,
  maxAlpha: number = 0.7
): number {
  const spawnPhase = spawnedAt * 0.001;
  return (
    minAlpha +
    (maxAlpha - minAlpha) * Math.abs(Math.sin(now * speed + spawnPhase))
  );
}

/**
 * Format a score with zero-padding.
 */
export function formatPaddedScore(score: number, digits: number = 5): string {
  return score.toString().padStart(digits, "0");
}

/**
 * Compute thrust flicker boolean from time.
 */
export function computeThrustFlicker(
  now: number,
  speed: number = 0.02
): boolean {
  return Math.sin(now * speed) > 0;
}
