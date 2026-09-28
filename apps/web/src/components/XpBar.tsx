export function XpBar({ level, xpIntoLevel, xpForNextLevel }: { level: number; xpIntoLevel: number; xpForNextLevel: number }) {
  const pct = xpForNextLevel > 0 ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
        <span className="font-display tracking-wide text-gold-400">LEVEL {level}</span>
        <span>
          {xpIntoLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP
        </span>
      </div>
      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
