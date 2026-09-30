import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";

interface ManagedUser {
  id: string;
  displayName: string;
  email: string;
  zendeskUserId?: string | null;
  character: { xp: number; coins: number; level: number } | null;
}
const field = "w-full rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm";

export function UserCorrections({ users, onUpdated }: { users: ManagedUser[]; onUpdated: () => Promise<void> }) {
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState({ displayName: "", email: "", zendeskUserId: "" });
  const [mode, setMode] = useState("grant");
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);
  const [level, setLevel] = useState(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = users.find((u) => u.id === userId);
  const visible = users.filter((u) => `${u.displayName} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => {
    if (!selected) return;
    setProfile({ displayName: selected.displayName, email: selected.email, zendeskUserId: selected.zendeskUserId ?? "" });
    setLevel(selected.character?.level ?? 1);
    if (mode === "set") { setXp(selected.character?.xp ?? 0); setCoins(selected.character?.coins ?? 0); }
  }, [selected, mode]);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      push({ tone: "reward", title: "Alteração salva", subtitle: selected?.displayName });
      await onUpdated();
    } catch (err) {
      push({ tone: "error", title: "Não foi possível salvar", subtitle: err instanceof Error ? err.message : "Erro inesperado" });
    } finally { setBusy(false); }
  }
  function saveProfile(e: FormEvent) {
    e.preventDefault();
    void perform(() => api.put(`/api/admin/users/${userId}`, { ...profile, reason }));
  }
  function adjust(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const description = mode === "level" ? `definir nível ${level}` : `${mode === "grant" ? "adicionar" : mode === "remove" ? "remover" : "definir saldo de"} ${xp} XP e ${coins} moedas`;
    if (!window.confirm(`${selected.displayName}: ${description}?\nMotivo: ${reason}`)) return;
    void perform(() => mode === "grant" || mode === "remove"
      ? api.post(`/api/admin/${mode}`, { userId, xp, coins, reason })
      : api.put(`/api/admin/users/${userId}`, { ...(mode === "level" ? { level } : { xp, coins }), reason }));
  }
  function reset(full: boolean) {
    if (!selected || !reason.trim()) return;
    const detail = full ? "Zerar XP e moedas, reiniciar atributos e remover inventário, combates, conquistas e missões." : "Zerar XP e voltar ao nível 1, preservando moedas, itens, combates e conquistas.";
    if (!window.confirm(`${selected.displayName}: ${detail}\nO histórico de tickets permanece.\nMotivo: ${reason}\nConfirmar?`)) return;
    void perform(() => full ? api.post("/api/admin/reset-character", { userId, reason }) : api.put(`/api/admin/users/${userId}`, { level: 1, reason }));
  }
  return <section className="panel p-5">
    <h2 className="font-display text-lg text-gold-400">Administrar usuários</h2>
    <p className="mt-1 text-sm text-slate-400">Corrija cadastros, conceda XP e ajuste o progresso. Cada alteração fica registrada na auditoria.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <input aria-label="Buscar usuário" className={field} placeholder="Buscar por nome ou email" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Usuário a administrar" disabled={busy} className={field} value={userId} onChange={(e) => { setUserId(e.target.value); setReason(""); setMode("grant"); setXp(0); setCoins(0); }}>
        <option value="">Selecione um usuário</option>
        {selected && !visible.some((u) => u.id === selected.id) && <option value={selected.id}>{selected.displayName} ({selected.email})</option>}
        {visible.map((u) => <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>)}
      </select>
    </div>
    {selected && <>
      {selected.character && <p className="mt-4 text-gold-400">Nível {selected.character.level} · {selected.character.xp} XP · {selected.character.coins} moedas</p>}
      <label className="mt-4 block text-sm text-slate-400">Motivo da alteração (obrigatório)<textarea maxLength={500} className={`${field} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explique a correção para o histórico" /></label>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="flex flex-col gap-3">
          <h3 className="font-display text-sm text-ember-400">Corrigir cadastro</h3>
          <label className="text-xs text-slate-400">Nome<input required maxLength={100} className={field} value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} /></label>
          <label className="text-xs text-slate-400">Email<input required type="email" className={field} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
          <label className="text-xs text-slate-400">ID no Zendesk<input maxLength={100} className={field} value={profile.zendeskUserId} onChange={(e) => setProfile({ ...profile, zendeskUserId: e.target.value })} /></label>
          <button className="btn-secondary" disabled={busy || !reason.trim()}>Salvar cadastro</button>
        </form>
        {selected.character && <form onSubmit={adjust} className="flex flex-col gap-3">
          <h3 className="font-display text-sm text-ember-400">XP, nível e moedas</h3>
          <label className="text-xs text-slate-400">Ação<select className={field} value={mode} onChange={(e) => { setMode(e.target.value); setXp(0); setCoins(0); }}><option value="grant">Adicionar XP / moedas</option><option value="remove">Remover XP / moedas</option><option value="set">Definir saldos exatos</option><option value="level">Definir nível</option></select></label>
          {mode === "level" ? <label className="text-xs text-slate-400">Nível desejado<input required type="number" min={1} max={1000} step={1} className={field} value={level} onChange={(e) => setLevel(Number(e.target.value))} /><span>O XP será ajustado para o início desse nível pela curva atual.</span></label> : <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">XP<input required type="number" min={0} max={2147483647} step={1} className={field} value={xp} onChange={(e) => setXp(Number(e.target.value))} /></label>
            <label className="text-xs text-slate-400">Moedas<input required type="number" min={0} max={2147483647} step={1} className={field} value={coins} onChange={(e) => setCoins(Number(e.target.value))} /></label>
          </div>}
          <button className="btn-primary" disabled={busy || !reason.trim() || ((mode === "grant" || mode === "remove") && !xp && !coins)}>{busy ? "Salvando..." : "Aplicar ajuste"}</button>
        </form>}
      </div>
      {selected.character && <div className="mt-6 border-t border-ink-700 pt-4">
        <p className="mb-3 text-xs text-slate-400">Reiniciar nível preserva moedas e itens. Reiniciar o personagem remove também seu inventário, combates, conquistas e missões. Tickets e liberação coletiva permanecem.</p>
        <div className="flex flex-wrap gap-3"><button className="btn-secondary" disabled={busy || !reason.trim()} onClick={() => reset(false)}>Reiniciar nível</button><button className="btn-secondary text-red-400" disabled={busy || !reason.trim()} onClick={() => reset(true)}>Reiniciar personagem completo</button></div>
      </div>}
    </>}
  </section>;
}
