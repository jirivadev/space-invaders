import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/engine';
import type { UIState } from './game/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './game/config';

const initialUI: UIState = {
  score: 0, highScore: 0, lives: 3, level: 1,
  status: 'menu', rapidFireTime: 0, shieldTime: 0,
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
      <h1 className="text-2xl font-bold tracking-widest text-green-400 md:text-3xl">SPACE INVADERS</h1>
      <div className="relative w-full max-w-4xl" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="mx-auto rounded border-4 border-slate-800 bg-black shadow-2xl"
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 200px)',
            width: 'auto',
            height: 'auto',
            aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
          }}
        />
      </div>
      <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-2 text-sm text-slate-400 md:text-base">
        <p>Score: <span className="text-green-400">{ui.score}</span></p>
        <p>High Score: <span className="text-yellow-400">{ui.highScore}</span></p>
        <p>Level: <span className="text-blue-400">{ui.level}</span></p>
        <p>Lives: <span className="text-red-400">{'❤'.repeat(Math.max(0, ui.lives))}</span></p>
      </div>
      {(ui.rapidFireTime > 0 || ui.shieldTime > 0) && (
        <div className="flex w-full max-w-4xl justify-center gap-6 px-2 text-sm md:text-base font-semibold">
          {ui.rapidFireTime > 0 && (
            <span className="text-orange-500 animate-pulse">⚡ Rapid Fire: {ui.rapidFireTime}s</span>
          )}
          {ui.shieldTime > 0 && (
            <span className="text-blue-400 animate-pulse">🛡️ Shield: {ui.shieldTime}s</span>
          )}
        </div>
      )}
      <p className="text-xs text-slate-500">Move: ← → or A D • Shoot: SPACE</p>
    </div>
  );
}
