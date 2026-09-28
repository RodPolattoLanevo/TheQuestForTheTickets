import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export function AdminSettings() {
  const { push } = useToast();
  const [levelCurve, setLevelCurve] = useState({ baseXp: 100, growth: 1.18 });
  const [flags, setFlags] = useState({ browserCapture: false, teamEvents: true, soundDefaultOn: false });
  const [reopenPolicy, setReopenPolicy] = useState("ignore");
  const [leaderboard, setLeaderboard] = useState({ visible: true, useDisplayNames: true });

  useEffect(() => {
    api.get<typeof levelCurve>("/api/admin/level-curve").then(setLevelCurve);
    api.get<typeof flags>("/api/admin/feature-flags").then(setFlags);
    api.get<{ policy: string }>("/api/admin/reopen-policy").then((r) => setReopenPolicy(r.policy));
    api.get<typeof leaderboard>("/api/admin/leaderboard-settings").then(setLeaderboard);
  }, []);

  async function save<T>(path: string, body: T, label: string) {
    try {
      await api.put(path, body);
      push({ tone: "reward", title: `${label} saved` });
    } catch (err) {
      push({ tone: "error", title: "Save failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="panel p-4">
        <h3 className="font-display text-sm text-ember-400">Level Curve</h3>
        <p className="mt-1 text-xs text-slate-500">XP for level N = baseXp × growth^(N-1)</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input type="number" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={levelCurve.baseXp} onChange={(e) => setLevelCurve({ ...levelCurve, baseXp: Number(e.target.value) })} />
          <input type="number" step="0.01" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={levelCurve.growth} onChange={(e) => setLevelCurve({ ...levelCurve, growth: Number(e.target.value) })} />
        </div>
        <button className="btn-secondary mt-3" onClick={() => save("/api/admin/level-curve", levelCurve, "Level curve")}>Save</button>
      </div>

      <div className="panel p-4">
        <h3 className="font-display text-sm text-ember-400">Reopen Policy</h3>
        <p className="mt-1 text-xs text-slate-500">What happens when a solved ticket is reopened and solved again.</p>
        <select className="mt-3 w-full rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={reopenPolicy} onChange={(e) => setReopenPolicy(e.target.value)}>
          <option value="ignore">Ignore (no reward, default - prevents farming)</option>
          <option value="new_completion">Treat as a new completion</option>
          <option value="manual_review">Flag for manual review</option>
        </select>
        <button className="btn-secondary mt-3" onClick={() => save("/api/admin/reopen-policy", { policy: reopenPolicy }, "Reopen policy")}>Save</button>
      </div>

      <div className="panel p-4">
        <h3 className="font-display text-sm text-ember-400">Feature Flags</h3>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {(Object.keys(flags) as (keyof typeof flags)[]).map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={flags[key]} onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })} />
              {key}
            </label>
          ))}
        </div>
        <button className="btn-secondary mt-3" onClick={() => save("/api/admin/feature-flags", flags, "Feature flags")}>Save</button>
      </div>

      <div className="panel p-4">
        <h3 className="font-display text-sm text-ember-400">Leaderboard Visibility</h3>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={leaderboard.visible} onChange={(e) => setLeaderboard({ ...leaderboard, visible: e.target.checked })} />
            Visible to employees
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={leaderboard.useDisplayNames} onChange={(e) => setLeaderboard({ ...leaderboard, useDisplayNames: e.target.checked })} />
            Use display names (not legal names)
          </label>
        </div>
        <button className="btn-secondary mt-3" onClick={() => save("/api/admin/leaderboard-settings", leaderboard, "Leaderboard settings")}>Save</button>
      </div>
    </div>
  );
}
