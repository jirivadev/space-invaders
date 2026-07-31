interface HUDProps {
  score: number;
  highScore: number;
  level: number;
  lives: number;
}

export default function HUD({ score, highScore, level, lives }: HUDProps) {
  return (
    <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-2 text-sm text-slate-400 md:text-base">
      <p>
        Score: <span className="text-green-400">{score}</span>
      </p>
      <p>
        High Score: <span className="text-yellow-400">{highScore}</span>
      </p>
      <p>
        Level: <span className="text-blue-400">{level}</span>
      </p>
      <p>
        Lives:{" "}
        <span className="text-red-400">{"❤".repeat(Math.max(0, lives))}</span>
      </p>
    </div>
  );
}
