import { useEffect, useState } from "react";
import { api } from "../../api/client";

export function AdminOverview() {
  const [data, setData] = useState<{ users: number; tickets: number; rewardsGranted: number; activeRules: number } | null>(null);

  useEffect(() => {
    api.get("/api/admin/overview").then(setData as any);
  }, []);

  if (!data) return <p className="text-slate-400">Loading...</p>;

  const cards = [
    { label: "Employees + Admins", value: data.users },
    { label: "Tickets Processed", value: data.tickets },
    { label: "Reward Transactions", value: data.rewardsGranted },
    { label: "Active Category Rules", value: data.activeRules },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="panel p-4 text-center">
          <p className="font-display text-2xl text-ember-400">{c.value}</p>
          <p className="mt-1 text-xs text-slate-400">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
