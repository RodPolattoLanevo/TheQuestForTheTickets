import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Entry {
  rank: number;
  userId: string;
  displayName: string;
  level: number;
  xpInPeriod: number;
  ticketsCompleted: number;
  bossesDefeated: number;
}

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "season", label: "Season" },
  { value: "all", label: "All Time" },
];

export function Leaderboard() {
  const [period, setPeriod] = useState("week");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<{ visible: boolean; entries: Entry[] }>(`/api/leaderboard?period=${period}`).then((data) => {
      setEntries(data.entries);
      setVisible(data.visible);
      setLoading(false);
    });
  }, [period]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-2xl text-gold-400">Leaderboard</h1>

      <div className="mt-4 flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-none border px-3 py-1 text-xs ${period === p.value ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-700 text-slate-400 hover:bg-ink-800"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-slate-400">Loading...</p>
      ) : !visible ? (
        <p className="mt-6 text-slate-400">The leaderboard is currently hidden by your Game Master.</p>
      ) : (
        <div className="panel mt-6 divide-y divide-ink-700">
          {entries.length === 0 && <p className="p-4 text-sm text-slate-500">No activity in this period yet.</p>}
          {entries.map((e) => (
            <div key={e.userId} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`w-6 text-center font-display ${e.rank <= 3 ? "text-gold-400" : "text-slate-500"}`}>{e.rank}</span>
                <div>
                  <p className="font-medium text-slate-200">{e.displayName}</p>
                  <p className="text-xs text-slate-500">
                    Level {e.level} · {e.ticketsCompleted} tickets · {e.bossesDefeated} bosses
                  </p>
                </div>
              </div>
              <span className="font-display text-gold-400">{e.xpInPeriod.toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
