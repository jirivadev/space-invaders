import type { GameState, GameCallbacks } from "../types";
import { GAME_CONFIG } from "../config";

export class InputHandler {
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;
  private handleBlur: () => void;

  constructor(private callbacks: GameCallbacks) {
    this.handleKeyDown = this._onKeyDown.bind(this);
    this.handleKeyUp = this._onKeyUp.bind(this);
    this.handleBlur = this._onBlur.bind(this);
  }

  start() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
  }

  stop() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
  }

  private _onKeyDown(e: KeyboardEvent) {
    const g = this.callbacks.onGetState?.();
    if (!g) return;
    g.keys[e.key] = true;
    if (
      [" ", "ArrowLeft", "ArrowRight", "a", "A", "d", "D", "Enter"].includes(
        e.key
      )
    ) {
      e.preventDefault();
    }

    if (g.status === "nameEntry") {
      this._handleNameEntry(g, e.key);
    }
  }

  private _onKeyUp(e: KeyboardEvent) {
    const g = this.callbacks.onGetState?.();
    if (!g) return;
    g.keys[e.key] = false;
  }

  private _onBlur() {
    const g = this.callbacks.onGetState?.();
    if (g) {
      g.keys = {};
    }
  }

  private _handleNameEntry(g: GameState, key: string) {
    if (key === "Enter") {
      const name = g.pendingName.trim() || "AAA";
      this.callbacks.onAddToLeaderboard?.(name, g.score);
      this.callbacks.onStateChange?.("menu");
    } else if (key === "Backspace") {
      g.pendingName = g.pendingName.slice(0, -1);
    } else if (
      key.length === 1 &&
      g.pendingName.length < GAME_CONFIG.ui.nameEntryMaxChars
    ) {
      g.pendingName += key;
    }
  }

  processInput(g: GameState, dt: number): GameState {
    const moveScale = dt / GAME_CONFIG.canvas.targetDt;

    if (
      g.status === "menu" ||
      g.status === "gameover" ||
      g.status === "nameEntry"
    ) {
      return g;
    }

    // Player movement
    if (g.keys["ArrowLeft"] || g.keys["a"] || g.keys["A"]) {
      g.player.x -= g.player.speed * moveScale;
    }
    if (g.keys["ArrowRight"] || g.keys["d"] || g.keys["D"]) {
      g.player.x += g.player.speed * moveScale;
    }
    g.player.x = Math.max(
      GAME_CONFIG.player.boundaryPadding,
      Math.min(
        GAME_CONFIG.canvas.width -
          g.player.w -
          GAME_CONFIG.player.boundaryPadding,
        g.player.x
      )
    );

    return g;
  }

  checkForShoot(g: GameState): boolean {
    if (g.player.cooldown > 0) return false;
    if (!g.keys[" "]) return false;
    return true;
  }
}
