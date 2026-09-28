import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  xpReward: number;
  coinsReward: number;
  progress: number;
  unlockedAt: string | null;
  criteria: string;
}

export function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Achievement[]>("/api/achievements").then((data) => {
      setAchievements(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading achievements...</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl text-gold-400">Achievements</h1>
      <p className="mt-1 text-sm text-slate-400">
        {achievements.filter((a) => a.unlockedAt).length} / {achievements.length} unlocked
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {achievements.map((a) => {
          const target = JSON.parse(a.criteria).target as number;
          const pct = Math.min(100, Math.round((a.progress / target) * 100));
          return (
            <div key={a.id} className={`panel p-4 ${a.unlockedAt ? "border-gold-500/60" : "opacity-80"}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm text-gold-400">{a.unlockedAt ? "✓ " : ""}{a.name}</h3>
                {a.unlockedAt && <span className="text-[10px] text-slate-500">{new Date(a.unlockedAt).toLocaleDateString()}</span>}
              </div>
              <p className="mt-1 text-xs text-slate-400">{a.description}</p>
              <div className="xp-bar-track mt-3 !h-2">
                <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {a.progress} / {target}
                {(a.xpReward > 0 || a.coinsReward > 0) && (
                  <span className="ml-2 text-gold-400">
                    {a.xpReward > 0 && `+${a.xpReward} XP `}
                    {a.coinsReward > 0 && `+${a.coinsReward} Coins`}
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
