import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";

interface Quest {
  id: string;
  name: string;
  description: string;
  type: "DAILY" | "WEEKLY";
  criteria: string;
  xpReward: number;
  coinsReward: number;
  progress: number;
  completed: boolean;
  claimedAt: string | null;
  periodEnd: string;
}

export function Quests() {
  const { push } = useToast();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setQuests(await api.get<Quest[]>("/api/quests"));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(quest: Quest) {
    setBusyId(quest.id);
    try {
      const res = await api.post<any>(`/api/quests/${quest.id}/claim`);
      push({ tone: "reward", title: "Quest Reward Claimed!", subtitle: `+${res.reward.xp} XP · +${res.reward.coins} Coins` });
      await load();
    } catch (err) {
      push({ tone: "error", title: "Claim failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Loading quests...</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl text-gold-400">Quests</h1>
      <p className="mt-1 text-sm text-slate-400">Daily and weekly objectives, configured by your Game Master.</p>

      <div className="mt-6 flex flex-col gap-3">
        {quests.length === 0 && <p className="text-sm text-slate-500">No active quests right now.</p>}
        {quests.map((q) => {
          const target = JSON.parse(q.criteria).target as number;
          const pct = Math.min(100, Math.round((q.progress / target) * 100));
          return (
            <div key={q.id} className="panel flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2">
                  <span className="rounded-none bg-ink-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">{q.type}</span>
                  <h3 className="font-display text-sm text-gold-400">{q.name}</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">{q.description}</p>
                <div className="xp-bar-track mt-2 !h-2 max-w-xs">
                  <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {q.progress} / {target} · +{q.xpReward} XP · +{q.coinsReward} Coins
                </p>
              </div>
              <div>
                {q.claimedAt ? (
                  <span className="rounded-none bg-green-500/20 px-3 py-1 text-xs text-green-400">Claimed</span>
                ) : (
                  <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={!q.completed || busyId === q.id} onClick={() => claim(q)}>
                    {q.completed ? "Claim reward" : "In progress"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
