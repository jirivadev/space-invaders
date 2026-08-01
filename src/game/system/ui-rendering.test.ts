import { describe, expect, it, vi } from "vitest";
import { GAME_CONFIG } from "../config";
import { UIRenderingSystem } from "./ui-rendering";

function createContext(): CanvasRenderingContext2D {
  return {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    fillRect: () => undefined,
    strokeRect: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    clip: () => undefined,
    fill: () => undefined,
    arc: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    measureText: () => ({ width: 100 }),
    fillText: () => undefined,
  } as unknown as CanvasRenderingContext2D;
}

describe("UIRenderingSystem", () => {
  it("renders padded HUD values with the expected alignment", () => {
    const system = new UIRenderingSystem();
    const ctx = createContext();
    const fillText = vi.fn();
    ctx.fillText = fillText;

    system.drawHUD(ctx, 42, 9001, 3, 2);

    expect(fillText).toHaveBeenCalledWith("SCORE 00042", 20, 28);
    expect(fillText).toHaveBeenCalledWith(
      "HIGH 09001",
      GAME_CONFIG.canvas.width / 2,
      28
    );
    expect(fillText).toHaveBeenCalledWith(
      "LIVES 3",
      GAME_CONFIG.canvas.width - 20,
      28
    );
  });

  it("does not draw a level announcement when its timer has expired", () => {
    const system = new UIRenderingSystem();
    const ctx = createContext();
    const fillRect = vi.fn();
    ctx.fillRect = fillRect;

    system.drawLevelAnnouncement(ctx, 3, 0);

    expect(fillRect).not.toHaveBeenCalled();
  });

  it("draws the game-over prompt and final score", () => {
    const system = new UIRenderingSystem();
    const ctx = createContext();
    const fillText = vi.fn();
    ctx.fillText = fillText;

    system.drawGameOver(ctx, 123, 1000, 900);

    expect(fillText).toHaveBeenCalledWith(
      "GAME OVER",
      GAME_CONFIG.canvas.width / 2,
      GAME_CONFIG.canvas.height / 2 - 20
    );
    expect(fillText).toHaveBeenCalledWith("FINAL SCORE 123", 0, 0);
    expect(fillText).toHaveBeenCalledWith(
      "Press SPACE to continue",
      GAME_CONFIG.canvas.width / 2,
      GAME_CONFIG.canvas.height / 2 + 70
    );
  });
});
