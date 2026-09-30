import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { UserCorrections } from "./UserCorrections";

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: "EMPLOYEE" | "ADMIN";
  character: { level: number; xp: number; coins: number } | null;
}

export function AdminUsers() {
  const { push } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({ email: "", displayName: "", temporaryPassword: "", role: "EMPLOYEE" as const });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setUsers(await api.get<UserRow[]>("/api/admin/users")), []);
  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/admin/users", form);
      push({ tone: "reward", title: "Employee created", subtitle: form.email });
      setForm({ email: "", displayName: "", temporaryPassword: "", role: "EMPLOYEE" });
      await load();
    } catch (err) {
      push({ tone: "error", title: "Failed to create user", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <UserCorrections users={users} onUpdated={load} />
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={createUser} className="panel flex flex-col gap-3 p-4">
        <h3 className="font-display text-sm text-ember-400">Add Employee</h3>
        <input required placeholder="Email" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input required placeholder="Display name" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <input required placeholder="Temporary password" minLength={6} className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} />
        <select className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
          <option value="EMPLOYEE">Employee</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button className="btn-primary" disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
      </form>

      <div className="panel lg:col-span-2 divide-y divide-ink-700">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-200">{u.displayName} {u.role === "ADMIN" && <span className="ml-1 text-[10px] text-ember-400">ADMIN</span>}</p>
              <p className="text-xs text-slate-500">{u.email}</p>
            </div>
            {u.character && (
              <p className="text-xs text-slate-400">
                Lv {u.character.level} · {u.character.xp} XP · {u.character.coins} coins
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
