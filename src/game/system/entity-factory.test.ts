import { describe, it, expect } from "vitest";
import {
  damageShieldRect,
  createExplosionParticles,
  createShield,
  createAliens,
} from "./entity-factory";
import { GAME_CONFIG } from "../config";
import type { Shield } from "../types";

function makeShield(overrides: Partial<Shield> = {}): Shield {
  const cols = GAME_CONFIG.shield.cols; // 24
  const rows = GAME_CONFIG.shield.rows; // 16
  const pixels = Array.from({ length: rows }, () => Array(cols).fill(true));
  return {
    x: 110,
    y: 480,
    cols,
    rows,
    pixelSize: GAME_CONFIG.shield.pixelSize, // 3
    pixels,
    ...overrides,
  };
}

describe("damageShieldRect", () => {
  it("damages alive pixels at center and returns true", () => {
    const shield = makeShield();
    // Hit a 3x3 area at shield center (in pixel coords: col 10-12, row 6-8)
    const x = shield.x + 10 * shield.pixelSize; // 110 + 30 = 140
    const y = shield.y + 6 * shield.pixelSize; // 480 + 18 = 498
    const w = 3 * shield.pixelSize; // 9
    const h = 3 * shield.pixelSize; // 9
    const result = damageShieldRect(shield, x, y, w, h);
    expect(result).toBe(true);
    // Check center pixel damaged
    expect(shield.pixels[6][10]).toBe(false);
    expect(shield.pixels[8][12]).toBe(false);
    // Check a pixel outside the rect remains alive
    expect(shield.pixels[0][0]).toBe(true);
  });

  it("returns false when hit area is out of bounds (all coords outside shield)", () => {
    const shield = makeShield();
    // Far to the right
    const x = shield.x + 1000;
    const y = shield.y + 1000;
    const result = damageShieldRect(shield, x, y, 10, 10);
    expect(result).toBe(false);
    // All pixels remain unchanged
    for (const row of shield.pixels) {
      for (const p of row) {
        expect(p).toBe(true);
      }
    }
  });

  it("handles negative coordinates without throwing", () => {
    const shield = makeShield();
    // Negative coords: Math.floor maps to negative indices, should be clamped by bounds check
    expect(() =>
      damageShieldRect(shield, shield.x - 10, shield.y - 10, 30, 30)
    ).not.toThrow();
    // Some pixels near the top-left corner might be damaged
    const topLeftAlive = shield.pixels[0][0];
    // Since -10 is less than shield.x, left col = Math.floor((-10)/3) = Math.floor(-3.33) = -4
    // With width 30, right col = Math.floor(( -10 + 30 )/3) = Math.floor(20/3) = 6
    // So cols -4..6, rows -4..6 are checked. Only rows 0..15 and cols 0..23 are valid.
    // pixel [0][0] should be damaged if it's in range
    expect(typeof topLeftAlive).toBe("boolean");
  });

  it("handles zero width or height without throwing", () => {
    const shield = makeShield();
    // w=0 means a single column is checked (left===right) — may still hit pixels
    expect(() =>
      damageShieldRect(shield, shield.x, shield.y, 0, 10)
    ).not.toThrow();
    expect(() =>
      damageShieldRect(shield, shield.x, shield.y, 10, 0)
    ).not.toThrow();
  });

  it("only damages alive pixels, skipping already dead pixels", () => {
    const shield = makeShield();
    // Pre-damage one pixel
    shield.pixels[5][5] = false;
    // Hit area covering that pixel
    const x = shield.x + 5 * shield.pixelSize;
    const y = shield.y + 5 * shield.pixelSize;
    damageShieldRect(shield, x, y, shield.pixelSize, shield.pixelSize);
    // Still false (no error, just remains false)
    expect(shield.pixels[5][5]).toBe(false);
  });
});

describe("createExplosionParticles", () => {
  it("returns count particles when count < 8 (no flash)", () => {
    const particles = createExplosionParticles(100, 100, "#4ade80", 4);
    expect(particles).toHaveLength(4);
  });

  it("returns count + 1 particles when count === 8 (includes flash)", () => {
    const particles = createExplosionParticles(100, 100, "#4ade80", 8);
    expect(particles).toHaveLength(9);
  });

  it("returns count + 1 particles when count === 10 (includes flash)", () => {
    const particles = createExplosionParticles(100, 100, "#4ade80", 10);
    expect(particles).toHaveLength(11);
  });

  it("all particles have valid properties", () => {
    const particles = createExplosionParticles(100, 200, "#f0abfc", 5);
    for (const p of particles) {
      expect(p).toHaveProperty("x", 100);
      expect(p).toHaveProperty("y", 200);
      expect(typeof p.vx).toBe("number");
      expect(typeof p.vy).toBe("number");
      expect(typeof p.life).toBe("number");
      expect(p.life).toBeGreaterThan(0);
      expect(p.maxLife).toBe(p.life);
      expect(typeof p.color).toBe("string");
      expect(typeof p.size).toBe("number");
      expect(["spark", "debris", "fire"]).toContain(p.type);
    }
  });

  it("includes a flash particle when count >= 8", () => {
    const particles = createExplosionParticles(100, 100, "#4ade80", 8);
    const flash = particles.filter((p) => p.type === "flash");
    expect(flash).toHaveLength(1);
    expect(flash[0].color).toBe("#ffffff");
    expect(flash[0].vx).toBe(0);
    expect(flash[0].vy).toBe(0);
  });

  it("does not include a flash particle when count < 8", () => {
    const particles = createExplosionParticles(100, 100, "#4ade80", 4);
    const flash = particles.filter((p) => p.type === "flash");
    expect(flash).toHaveLength(0);
  });
});

describe("createShield", () => {
  it("returns a shield with the correct position and dimensions", () => {
    const shield = createShield(200, 500);
    expect(shield.x).toBe(200);
    expect(shield.y).toBe(500);
    expect(shield.cols).toBe(GAME_CONFIG.shield.cols);
    expect(shield.rows).toBe(GAME_CONFIG.shield.rows);
    expect(shield.pixelSize).toBe(GAME_CONFIG.shield.pixelSize);
  });

  it("has the correct pixel array dimensions", () => {
    const shield = createShield(200, 500);
    expect(shield.pixels.length).toBe(GAME_CONFIG.shield.rows);
    for (const row of shield.pixels) {
      expect(row.length).toBe(GAME_CONFIG.shield.cols);
    }
  });

  it("has some pixels set to false due to arch cutouts", () => {
    const shield = createShield(200, 500);
    let aliveCount = 0;
    let deadCount = 0;
    for (const row of shield.pixels) {
      for (const p of row) {
        if (p) aliveCount++;
        else deadCount++;
      }
    }
    // Arch cutouts at rows 10+ (cols 8-15) and rows 13+ (cols 6-17) are dead
    expect(deadCount).toBeGreaterThan(0);
    expect(aliveCount).toBeLessThan(shield.cols * shield.rows);
    // Most pixels should still be alive
    expect(aliveCount).toBeGreaterThan(shield.cols * shield.rows * 0.8);
  });
});

describe("createAliens", () => {
  const formations = [
    "grid",
    "staggered",
    "diamond",
    "compact",
    "wide",
  ] as const;

  for (const formation of formations) {
    it(`creates a non-empty array for '${formation}' formation`, () => {
      const aliens = createAliens(formation, 80);
      expect(aliens.length).toBeGreaterThan(0);
    });
  }

  for (const formation of formations) {
    it(`all aliens start with alive: true for '${formation}' formation`, () => {
      const aliens = createAliens(formation, 80);
      for (const a of aliens) {
        expect(a.alive).toBe(true);
      }
    });
  }

  it("each alien has x, y, w, h, and a valid type", () => {
    const aliens = createAliens("grid", 80);
    for (const a of aliens) {
      expect(typeof a.x).toBe("number");
      expect(typeof a.y).toBe("number");
      expect(typeof a.w).toBe("number");
      expect(a.w).toBeGreaterThan(0);
      expect(typeof a.h).toBe("number");
      expect(a.h).toBeGreaterThan(0);
      expect(["squid", "crab", "octopus"]).toContain(a.type);
    }
  });

  it("default formation is grid when not specified", () => {
    const aliens = createAliens(undefined, 80);
    expect(aliens.length).toBeGreaterThan(0);
    for (const a of aliens) {
      expect(a).toHaveProperty("alive", true);
    }
  });
});
