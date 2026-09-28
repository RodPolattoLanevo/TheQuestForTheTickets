import { useEffect, useState } from "react";
import { api } from "../../api/client";

export function AdminAuditLog() {
  const [rewards, setRewards] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [tab, setTab] = useState<"rewards" | "actions">("rewards");

  useEffect(() => {
    api.get("/api/admin/audit-log/rewards").then(setRewards as any);
    api.get("/api/admin/audit-log/admin-actions").then(setActions as any);
  }, []);

  return (
    <div>
      <div className="flex gap-2">
        <button onClick={() => setTab("rewards")} className={`rounded-none border px-3 py-1 text-xs ${tab === "rewards" ? "border-gold-500 text-gold-400" : "border-ink-700 text-slate-400"}`}>
          Reward Transactions
        </button>
        <button onClick={() => setTab("actions")} className={`rounded-none border px-3 py-1 text-xs ${tab === "actions" ? "border-gold-500 text-gold-400" : "border-ink-700 text-slate-400"}`}>
          Admin Actions
        </button>
      </div>

      {tab === "rewards" ? (
        <div className="panel mt-4 max-h-[32rem] divide-y divide-ink-800 overflow-auto">
          {rewards.map((r) => (
            <div key={r.id} className="px-4 py-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-300">{r.user?.displayName ?? r.userId}</span>
                <span className="text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-slate-500">
                {r.source} {r.ticket && `· Ticket #${r.ticket.externalId}`} {r.category && `· ${r.category}`} · {r.reason}
              </p>
              <p className="text-gold-400">
                {r.xp > 0 ? "+" : ""}{r.xp} XP, {r.coins > 0 ? "+" : ""}{r.coins} coins · {r.provider ?? r.actorType} · tx:{r.transactionUid.slice(0, 8)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel mt-4 max-h-[32rem] divide-y divide-ink-800 overflow-auto">
          {actions.map((a) => (
            <div key={a.id} className="px-4 py-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-300">{a.actorUser?.displayName ?? a.actorUserId} · {a.actionType}</span>
                <span className="text-slate-500">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-slate-500 break-all">{a.payload}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
