import { describe, it, expect } from "vitest";
import {
  computeDeathAnimation,
  computeStarTwinkle,
  computePlayerDeathFragments,
  computeBulletTrailEntries,
  computeShimmerSweep,
  computeBlinkAlpha,
  computeFadeInAlpha,
  computeScaleUpAnimation,
  computeShieldAuraDots,
  computeAnimationFrameIndex,
  computePowerUpGlowAlpha,
  formatPaddedScore,
  computeThrustFlicker,
} from "./rendering-math";

describe("rendering-math", () => {
  describe("computeDeathAnimation", () => {
    it("returns null when dyingAt is 0", () => {
      expect(computeDeathAnimation(0, 1000, 150)).toBeNull();
    });

    it("returns null when dyingAt is negative", () => {
      expect(computeDeathAnimation(-100, 1000, 150)).toBeNull();
    });

    it("returns isComplete=true when elapsed >= duration", () => {
      const result = computeDeathAnimation(850, 1000, 150);
      expect(result).not.toBeNull();
      expect(result!.isComplete).toBe(true);
      expect(result!.t).toBe(1);
      expect(result!.flashScale).toBe(0);
      expect(result!.flashAlpha).toBe(0);
    });

    it("computes t=0 at start", () => {
      const result = computeDeathAnimation(500, 500, 150);
      expect(result).not.toBeNull();
      expect(result!.t).toBe(0);
      expect(result!.flashScale).toBe(1);
      expect(result!.flashAlpha).toBe(1);
      expect(result!.isComplete).toBe(false);
    });

    it("computes t=0.5 at midpoint", () => {
      const result = computeDeathAnimation(500, 575, 150);
      expect(result).not.toBeNull();
      expect(result!.t).toBeCloseTo(0.5);
      expect(result!.flashScale).toBeCloseTo(0.5);
      expect(result!.flashAlpha).toBeCloseTo(0.5);
    });

    it("clamps t at 1 when elapsed > duration", () => {
      const result = computeDeathAnimation(500, 700, 150);
      expect(result).not.toBeNull();
      expect(result!.isComplete).toBe(true);
      expect(result!.t).toBe(1);
    });
  });

  describe("computeStarTwinkle", () => {
    it("returns value within [minAlpha, maxAlpha] range", () => {
      for (let now = 0; now < 10000; now += 100) {
        const alpha = computeStarTwinkle(now, 0, 0.2, 0.5);
        expect(alpha).toBeGreaterThanOrEqual(0.2);
        expect(alpha).toBeLessThanOrEqual(0.5);
      }
    });

    it("returns midpoint at sin=0 (now=0 with offset 0)", () => {
      const alpha = computeStarTwinkle(0, 0, 0.2, 0.6);
      // sin(0) = 0, so 0.2 + 0.4 * (0.5 + 0) = 0.2 + 0.2 = 0.4
      expect(alpha).toBeCloseTo(0.4);
    });

    it("shifts phase with twinkleOffset", () => {
      const alpha1 = computeStarTwinkle(0, 0, 0, 1);
      const alpha2 = computeStarTwinkle(0, Math.PI / 2, 0, 1);
      expect(alpha1).not.toBeCloseTo(alpha2);
    });
  });

  describe("computePlayerDeathFragments", () => {
    it("returns fragments at center when t=0", () => {
      const frags = computePlayerDeathFragments(400, 320, 0);
      expect(frags).toHaveLength(4);
      for (const f of frags) {
        expect(f.x).toBeCloseTo(400);
        expect(f.y).toBeCloseTo(320);
      }
    });

    it("returns max spread when t=1", () => {
      const frags = computePlayerDeathFragments(400, 320, 1, 4, 30);
      expect(frags).toHaveLength(4);
      // Each fragment should be at maxDist (30) from center
      for (const f of frags) {
        const dx = f.x - 400;
        const dy = f.y - 320;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(30);
      }
    });

    it("returns mid-spread at t=0.5", () => {
      const frags = computePlayerDeathFragments(400, 320, 0.5, 4, 30);
      expect(frags).toHaveLength(4);
      for (const f of frags) {
        const dx = f.x - 400;
        const dy = f.y - 320;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(15); // 0.5 * 30
      }
    });

    it("supports custom fragment count", () => {
      const frags = computePlayerDeathFragments(400, 320, 1, 6, 30);
      expect(frags).toHaveLength(6);
    });
  });

  describe("computeBulletTrailEntries", () => {
    it("returns empty array for empty trail", () => {
      expect(computeBulletTrailEntries([], 4, 12)).toEqual([]);
    });

    it("computes single trail entry", () => {
      const entries = computeBulletTrailEntries([{ x: 100, y: 200 }], 4, 12);
      expect(entries).toHaveLength(1);
      // r = 0/1 = 0, alpha = 0 * 0.35 = 0 (matches original: t=0, alpha=0)
      expect(entries[0].alpha).toBe(0);
      expect(entries[0].w).toBeCloseTo(1.2); // max(1, 4 * (0.3 + 0)) = 1.2
      expect(entries[0].h).toBe(12);
    });

    it("fades earlier entries more", () => {
      const trail = [
        { x: 100, y: 200 },
        { x: 100, y: 210 },
        { x: 100, y: 220 },
      ];
      const entries = computeBulletTrailEntries(trail, 4, 12);
      expect(entries[0].alpha).toBeLessThan(entries[1].alpha);
      expect(entries[1].alpha).toBeLessThan(entries[2].alpha);
    });

    it("scales width from shrink to full", () => {
      const trail = [
        { x: 100, y: 200 },
        { x: 100, y: 210 },
      ];
      const entries = computeBulletTrailEntries(trail, 10, 12);
      expect(entries[0].w).toBeLessThan(entries[1].w);
      // For 2 entries: r[0]=0/2=0, r[1]=1/2=0.5
      // w[0] = max(1, 10*(0.3+0)) = 3, w[1] = max(1, 10*(0.3+0.35)) = 6.5
      expect(entries[0].w).toBeCloseTo(3);
      expect(entries[1].w).toBeCloseTo(6.5);
    });

    it("never produces width less than 1", () => {
      const trail = [{ x: 100, y: 200 }];
      const entries = computeBulletTrailEntries(trail, 1, 12);
      expect(entries[0].w).toBeGreaterThanOrEqual(1);
    });

    it("centers using clamped width", () => {
      // When width is clamped to 1, x-offset should be (bulletW - 1) / 2
      const trail = [{ x: 100, y: 200 }];
      const entries = computeBulletTrailEntries(trail, 4, 12);
      // r = 0/1 = 0, w = max(1, 4 * 0.3) = max(1, 1.2) = 1.2
      // x = 100 + (4 - 1.2) / 2 = 100 + 1.4 = 101.4
      expect(entries[0].x).toBeCloseTo(101.4);
      expect(entries[0].w).toBeCloseTo(1.2);
    });
  });

  describe("computeShimmerSweep", () => {
    it("returns correct bandWidth", () => {
      const result = computeShimmerSweep(0, 400);
      expect(result.bandWidth).toBe(80);
    });

    it("sweeps from negative to positive", () => {
      const r1 = computeShimmerSweep(0, 400);
      const r2 = computeShimmerSweep(1000, 400);
      expect(r2.sweepPos).toBeGreaterThan(r1.sweepPos);
    });

    it("wraps around with modulo", () => {
      const textWidth = 400;
      const padding = 200;
      const total = textWidth + padding; // 600
      const r1 = computeShimmerSweep(0, textWidth, 0.12, padding);
      const r2 = computeShimmerSweep(total / 0.12, textWidth, 0.12, padding); // one full cycle
      expect(r2.sweepPos).toBeCloseTo(r1.sweepPos);
    });

    it("handles textWidth=0", () => {
      const r = computeShimmerSweep(1000, 0);
      expect(typeof r.sweepPos).toBe("number");
      expect(r.bandWidth).toBe(80);
    });
  });

  describe("computeBlinkAlpha", () => {
    it("returns value within [minAlpha, maxAlpha]", () => {
      for (let now = 0; now < 10000; now += 50) {
        const alpha = computeBlinkAlpha(now);
        expect(alpha).toBeGreaterThanOrEqual(0.4);
        expect(alpha).toBeLessThanOrEqual(1.0);
      }
    });

    it("returns minAlpha when sin(now*speed)=0", () => {
      // sin(0) = 0, so |sin| = 0, alpha = 0.4 + 0.6*0 = 0.4
      expect(computeBlinkAlpha(0)).toBeCloseTo(0.4);
    });

    it("returns maxAlpha when |sin(now*speed)|=1", () => {
      // sin(pi/2 / 0.003) should give |sin| = 1
      const now = Math.PI / 2 / 0.003;
      expect(computeBlinkAlpha(now)).toBeCloseTo(1.0);
    });

    it("accepts custom params", () => {
      const alpha = computeBlinkAlpha(0, 0.004, 0.2, 0.8);
      expect(alpha).toBeCloseTo(0.2);
    });
  });

  describe("computeFadeInAlpha", () => {
    it("returns 0 at elapsed=0", () => {
      expect(computeFadeInAlpha(0)).toBe(0);
    });

    it("returns maxAlpha at elapsed >= duration", () => {
      expect(computeFadeInAlpha(400)).toBe(0.75);
      expect(computeFadeInAlpha(500)).toBe(0.75);
    });

    it("returns half maxAlpha at half duration", () => {
      expect(computeFadeInAlpha(200)).toBeCloseTo(0.375);
    });

    it("accepts custom params", () => {
      expect(computeFadeInAlpha(200, 400, 0.85)).toBeCloseTo(0.425);
      expect(computeFadeInAlpha(400, 400, 0.85)).toBe(0.85);
    });
  });

  describe("computeScaleUpAnimation", () => {
    it("returns startScale at elapsed=0", () => {
      const result = computeScaleUpAnimation(0);
      expect(result.progress).toBe(0);
      expect(result.scale).toBe(1.3);
    });

    it("returns endScale at elapsed >= duration", () => {
      const result = computeScaleUpAnimation(300);
      expect(result.progress).toBe(1);
      expect(result.scale).toBe(1.0);
    });

    it("interpolates linearly", () => {
      const result = computeScaleUpAnimation(150);
      expect(result.progress).toBe(0.5);
      expect(result.scale).toBeCloseTo(1.15); // 1.3 + (1.0 - 1.3) * 0.5
    });

    it("clamps progress at 1 for elapsed > duration", () => {
      const result = computeScaleUpAnimation(500);
      expect(result.progress).toBe(1);
      expect(result.scale).toBe(1.0);
    });
  });

  describe("computeShieldAuraDots", () => {
    it("returns correct number of dots", () => {
      const dots = computeShieldAuraDots(400, 300, 27, 21, 1000);
      expect(dots).toHaveLength(6);
    });

    it("dots are at aura radius from center", () => {
      const dots = computeShieldAuraDots(400, 300, 27, 21, 0);
      const auraRadius = Math.max(27, 21) * 0.75; // 20.25
      for (const dot of dots) {
        const dx = dot.x - 400;
        const dy = dot.y - 300;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(auraRadius);
      }
    });

    it("all dot alphas are in valid range", () => {
      const dots = computeShieldAuraDots(400, 300, 27, 21, 5000);
      for (const dot of dots) {
        expect(dot.alpha).toBeGreaterThanOrEqual(0.3);
        expect(dot.alpha).toBeLessThanOrEqual(0.8);
      }
    });

    it("supports custom dot count", () => {
      const dots = computeShieldAuraDots(400, 300, 27, 21, 1000, 8);
      expect(dots).toHaveLength(8);
    });
  });

  describe("computeAnimationFrameIndex", () => {
    it("returns 0 at time 0", () => {
      expect(computeAnimationFrameIndex(0, 100)).toBe(0);
    });

    it("returns 0 in first interval", () => {
      expect(computeAnimationFrameIndex(50, 100)).toBe(0);
    });

    it("returns 1 in second interval", () => {
      expect(computeAnimationFrameIndex(150, 100)).toBe(1);
    });

    it("wraps around at frameCount", () => {
      // floor(200/100) % 2 = 2 % 2 = 0
      expect(computeAnimationFrameIndex(200, 100, 2)).toBe(0);
      // floor(250/100) % 2 = 2 % 2 = 0
      expect(computeAnimationFrameIndex(250, 100, 2)).toBe(0);
      // floor(300/100) % 2 = 3 % 2 = 1
      expect(computeAnimationFrameIndex(300, 100, 2)).toBe(1);
      // floor(350/100) % 2 = 3 % 2 = 1
      expect(computeAnimationFrameIndex(350, 100, 2)).toBe(1);
      // floor(400/100) % 2 = 4 % 2 = 0
      expect(computeAnimationFrameIndex(400, 100, 2)).toBe(0);
    });

    it("supports 3-frame animation", () => {
      expect(computeAnimationFrameIndex(0, 100, 3)).toBe(0);
      expect(computeAnimationFrameIndex(100, 100, 3)).toBe(1);
      expect(computeAnimationFrameIndex(200, 100, 3)).toBe(2);
      expect(computeAnimationFrameIndex(300, 100, 3)).toBe(0);
    });
  });

  describe("computePowerUpGlowAlpha", () => {
    it("returns value in [minAlpha, maxAlpha] range", () => {
      for (let now = 0; now < 10000; now += 100) {
        const alpha = computePowerUpGlowAlpha(now, 500);
        expect(alpha).toBeGreaterThanOrEqual(0.3);
        expect(alpha).toBeLessThanOrEqual(0.7);
      }
    });

    it("phase shifts based on spawnedAt", () => {
      const a1 = computePowerUpGlowAlpha(0, 0);
      const a2 = computePowerUpGlowAlpha(0, 1000);
      // Different spawn times should produce different alphas at same now
      expect(a1).not.toBeCloseTo(a2);
    });
  });

  describe("formatPaddedScore", () => {
    it("pads zero to 5 digits", () => {
      expect(formatPaddedScore(0)).toBe("00000");
    });

    it("pads small number", () => {
      expect(formatPaddedScore(42)).toBe("00042");
    });

    it("does not truncate large number", () => {
      expect(formatPaddedScore(99999)).toBe("99999");
    });

    it("extends beyond default digits", () => {
      expect(formatPaddedScore(123456)).toBe("123456");
    });

    it("accepts custom digit count", () => {
      expect(formatPaddedScore(42, 8)).toBe("00000042");
    });
  });

  describe("computeThrustFlicker", () => {
    it("returns true when sin > 0", () => {
      // sin(pi/2 / 0.02) > 0
      const now = Math.PI / 2 / 0.02;
      expect(computeThrustFlicker(now)).toBe(true);
    });

    it("returns false when sin <= 0", () => {
      // Use a time where sin(now * 0.02) is clearly negative
      // sin(3pi/2) = -1, so now = 3pi/2 / 0.02
      const now = (3 * Math.PI) / 2 / 0.02;
      expect(computeThrustFlicker(now)).toBe(false);
    });

    it("returns false at now=0 (sin(0)=0)", () => {
      expect(computeThrustFlicker(0)).toBe(false);
    });

    it("accepts custom speed", () => {
      const now = Math.PI / 2 / 0.05;
      expect(computeThrustFlicker(now, 0.05)).toBe(true);
    });
  });
});
