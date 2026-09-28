import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

interface Rule {
  id: string;
  name: string;
  fieldSource: string;
  fieldKey: string | null;
  operator: string;
  value: unknown;
  difficulty: string;
  xp: number;
  coins: number;
  priority: number;
  active: boolean;
}

const emptyForm = { name: "", fieldSource: "priority", fieldKey: "", operator: "equals", value: "", difficulty: "medium", xp: 50, coins: 25, priority: 10, active: true };

export function AdminCategoryRules() {
  const { push } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => setRules(await api.get<Rule[]>("/api/admin/category-rules/all")), []);
  useEffect(() => {
    load();
  }, [load]);

  function edit(rule: Rule) {
    setEditingId(rule.id);
    setForm({ ...rule, fieldKey: rule.fieldKey ?? "", value: String(rule.value) } as any);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, xp: Number(form.xp), coins: Number(form.coins), priority: Number(form.priority) };
    try {
      if (editingId) {
        await api.put(`/api/admin/category-rules/${editingId}`, payload);
        push({ tone: "reward", title: "Rule updated", subtitle: form.name });
      } else {
        await api.post("/api/admin/category-rules", payload);
        push({ tone: "reward", title: "Rule created", subtitle: form.name });
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      push({ tone: "error", title: "Save failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    }
  }

  async function remove(id: string) {
    await api.delete(`/api/admin/category-rules/${id}`);
    await load();
  }

  async function toggleActive(rule: Rule) {
    await api.put(`/api/admin/category-rules/${rule.id}`, { active: !rule.active });
    await load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={save} className="panel flex flex-col gap-2 p-4">
        <h3 className="font-display text-sm text-ember-400">{editingId ? "Edit Rule" : "New Reward Rule"}</h3>
        <input required placeholder="Name (e.g. Critical)" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <select className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.fieldSource} onChange={(e) => setForm({ ...form, fieldSource: e.target.value })}>
            {["priority", "type", "group", "form", "tags", "custom_field", "status"].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })}>
            {["equals", "contains", "in", "gte", "lte"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        {form.fieldSource === "custom_field" && (
          <input placeholder="Custom field key" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.fieldKey} onChange={(e) => setForm({ ...form, fieldKey: e.target.value })} />
        )}
        <input required placeholder="Match value (e.g. urgent)" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.value as string} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        <input required placeholder="Difficulty label" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <input type="number" placeholder="XP" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.xp} onChange={(e) => setForm({ ...form, xp: Number(e.target.value) })} />
          <input type="number" placeholder="Coins" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.coins} onChange={(e) => setForm({ ...form, coins: Number(e.target.value) })} />
          <input type="number" placeholder="Priority" className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1">{editingId ? "Save changes" : "Create rule"}</button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="panel lg:col-span-2 divide-y divide-ink-700">
        {rules
          .sort((a, b) => a.priority - b.priority)
          .map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-200">
                  {r.name} <span className="ml-1 text-xs text-slate-500">({r.difficulty})</span>
                  {!r.active && <span className="ml-2 rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-slate-400">inactive</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {r.fieldSource} {r.operator} "{String(r.value)}" → +{r.xp} XP, +{r.coins} coins (priority {r.priority})
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => toggleActive(r)}>{r.active ? "Disable" : "Enable"}</button>
                <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => edit(r)}>Edit</button>
                <button className="btn-secondary !px-2 !py-1 text-xs text-red-400" onClick={() => remove(r.id)}>Delete</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
