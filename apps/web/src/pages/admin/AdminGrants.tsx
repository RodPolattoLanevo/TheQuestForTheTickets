import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

interface UserRow {
  id: string;
  displayName: string;
  email: string;
}

export function AdminGrants() {
  const { push } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userId, setUserId] = useState("");
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api.get<UserRow[]>("/api/admin/users");
    setUsers(data);
    if (data[0]) setUserId((u) => u || data[0].id);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(action: "grant" | "remove") {
    setBusy(true);
    try {
      await api.post(`/api/admin/${action}`, { userId, xp, coins, reason: reason || undefined });
      push({ tone: "reward", title: action === "grant" ? "Granted" : "Removed", subtitle: `${xp} XP / ${coins} coins` });
    } catch (err) {
      push({ tone: "error", title: "Action failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  async function resetCharacter() {
    if (!confirm("Reset this character's XP, coins, level, stats and inventory? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api.post("/api/admin/reset-character", { userId });
      push({ tone: "reward", title: "Character reset" });
    } catch (err) {
      push({ tone: "error", title: "Reset failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel max-w-lg p-5">
      <h3 className="font-display text-sm text-ember-400">Grant / Remove / Reset</h3>
      <div className="mt-4 flex flex-col gap-3">
        <select className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" placeholder="XP" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={xp} onChange={(e) => setXp(Number(e.target.value))} />
          <input type="number" placeholder="Coins" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={coins} onChange={(e) => setCoins(Number(e.target.value))} />
        </div>
        <input placeholder="Reason (optional, shown in audit log)" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy} onClick={() => act("grant")}>Grant</button>
          <button className="btn-secondary flex-1" disabled={busy} onClick={() => act("remove")}>Remove</button>
        </div>
        <button className="btn-secondary text-red-400" disabled={busy} onClick={resetCharacter}>Reset Character</button>
      </div>
    </div>
  );
}
