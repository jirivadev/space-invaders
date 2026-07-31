interface PowerUpBannerProps {
  rapidFireTime: number;
  shieldTime: number;
}

export default function PowerUpBanner({
  rapidFireTime,
  shieldTime,
}: PowerUpBannerProps) {
  if (rapidFireTime <= 0 && shieldTime <= 0) return null;

  return (
    <div className="flex w-full max-w-4xl justify-center gap-6 px-2 text-sm md:text-base font-semibold">
      {rapidFireTime > 0 && (
        <span className="text-orange-500 animate-pulse">
          ⚡ Rapid Fire: {rapidFireTime}s
        </span>
      )}
      {shieldTime > 0 && (
        <span className="text-blue-400 animate-pulse">
          🛡️ Shield: {shieldTime}s
        </span>
      )}
    </div>
  );
}
