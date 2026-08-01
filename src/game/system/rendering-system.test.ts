import { describe, expect, it, vi } from "vitest";
import { GAME_CONFIG, COLORS } from "../config";
import { RenderingSystem } from "./rendering-system";
import { makeBullet, makePowerUp } from "../test-utils/factory";

function createContext(): CanvasRenderingContext2D {
  const stateStack: Array<Record<string, unknown>> = [];
  const ctx = {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillRect: () => undefined,
    strokeRect: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    arc: () => undefined,
    rect: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    fillText: () => undefined,
    save: () => {
      stateStack.push({
        globalAlpha: ctx.globalAlpha,
        fillStyle: ctx.fillStyle,
        strokeStyle: ctx.strokeStyle,
        lineWidth: ctx.lineWidth,
        font: ctx.font,
        textAlign: ctx.textAlign,
        textBaseline: ctx.textBaseline,
      });
    },
    restore: () => {
      const state = stateStack.pop();
      if (state) Object.assign(ctx, state);
    },
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

describe("RenderingSystem", () => {
  it("clears the canvas and restores the base drawing state", () => {
    const system = new RenderingSystem();
    const ctx = createContext();
    ctx.globalAlpha = 0.2;
    ctx.imageSmoothingEnabled = true;

    system.clearCanvas(ctx);

    expect(ctx.globalAlpha).toBe(1);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.fillStyle).toBe(COLORS.bg);
  });

  it("draws power-up and bullet visuals without leaking canvas state", () => {
    const system = new RenderingSystem();
    const ctx = createContext();

    system.drawPowerUps(ctx, [makePowerUp({ spawnedAt: 0 })], 100);
    system.drawBullets(ctx, [makeBullet({ x: 100, y: 100, previousY: 110 })]);

    expect(ctx.globalAlpha).toBe(1);
    expect(ctx.textBaseline).toBe("alphabetic");
  });

  it("draws the ground at the configured playfield boundary", () => {
    const system = new RenderingSystem();
    const ctx = createContext();
    const moveTo = vi.fn();
    const lineTo = vi.fn();
    ctx.moveTo = moveTo;
    ctx.lineTo = lineTo;

    system.drawGround(ctx);

    expect(moveTo).toHaveBeenCalledWith(0, GAME_CONFIG.canvas.groundY);
    expect(lineTo).toHaveBeenCalledWith(
      GAME_CONFIG.canvas.width,
      GAME_CONFIG.canvas.groundY
    );
  });
});
