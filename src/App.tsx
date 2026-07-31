import { useEffect, useRef, useState } from "react";
import { GameEngine } from "./game/engine";
import type { UIState } from "./game/types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./game/config";
import HUD from "./components/HUD";
import PowerUpBanner from "./components/PowerUpBanner";
import ControlsHint from "./components/ControlsHint";

const initialUI: UIState = {
  score: 0,
  highScore: 0,
  lives: 3,
  level: 1,
  status: "menu",
  rapidFireTime: 0,
  shieldTime: 0,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ui, setUi] = useState<UIState>(initialUI);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GameEngine(canvas, { onUIChange: setUi });
    engine.start();
    return () => {
      engine.stop();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-4 text-white">
      <h1 className="text-2xl font-bold tracking-widest text-green-400 md:text-3xl">
        SPACE INVADERS
      </h1>
      <div
        className="relative w-full max-w-4xl"
        style={{ maxHeight: "calc(100vh - 200px)" }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="mx-auto rounded border-4 border-slate-800 bg-black shadow-2xl"
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "calc(100vh - 200px)",
            width: "auto",
            height: "auto",
            aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
          }}
        />
      </div>
      <HUD
        score={ui.score}
        highScore={ui.highScore}
        level={ui.level}
        lives={ui.lives}
      />
      <PowerUpBanner
        rapidFireTime={ui.rapidFireTime}
        shieldTime={ui.shieldTime}
      />
      <ControlsHint />
    </div>
  );
}
