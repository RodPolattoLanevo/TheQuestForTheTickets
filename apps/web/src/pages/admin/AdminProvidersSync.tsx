import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

interface Provider {
  id: string;
  displayName: string;
  configured: boolean;
  active: boolean;
}

interface SyncState {
  provider: string;
  cursor: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  recordsSeen: number;
}

export function AdminProvidersSync() {
  const { push } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [states, setStates] = useState<SyncState[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([api.get<Provider[]>("/api/admin/providers"), api.get<SyncState[]>("/api/admin/sync-state")]);
    setProviders(p);
    setStates(s);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setActive(id: string) {
    await api.put("/api/admin/providers/active", { provider: id });
    push({ tone: "reward", title: "Active provider changed", subtitle: id });
    await load();
  }

  async function sync(id: string, full = false) {
    setBusy(id);
    try {
      const res = await api.post<any>("/api/admin/sync", { provider: id, full });
      push({ tone: "reward", title: "Sync complete", subtitle: `${res.rewardsGranted} rewards granted from ${res.ticketsSeen} tickets` });
      await load();
    } catch (err) {
      push({ tone: "error", title: "Sync failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="panel divide-y divide-ink-700">
        {providers.map((p) => {
          const state = states.find((s) => s.provider === p.id);
          return (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-slate-200">
                  {p.displayName} {p.active && <span className="ml-1 rounded bg-gold-500/20 px-1.5 py-0.5 text-[10px] text-gold-400">ACTIVE</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {p.configured ? "Configured" : "Not configured"}
                  {state?.lastRunAt && ` · last run ${new Date(state.lastRunAt).toLocaleString()} (${state.lastStatus})`}
                </p>
                {state?.lastError && <p className="text-xs text-red-400">{state.lastError}</p>}
              </div>
              <div className="flex gap-2">
                {!p.active && (
                  <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setActive(p.id)}>
                    Make active
                  </button>
                )}
                <button className="btn-secondary !px-2 !py-1 text-xs" disabled={busy === p.id} onClick={() => sync(p.id)}>
                  {busy === p.id ? "Syncing..." : "Sync now"}
                </button>
                <button className="btn-secondary !px-2 !py-1 text-xs" disabled={busy === p.id} onClick={() => sync(p.id, true)}>
                  Full sync
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        mock and csv are always available. zendesk-api / zendesk-webhook / google-sheets require environment configuration - see
        ZENDESK_INTEGRATION.md and GOOGLE_SHEETS_INTEGRATION.md.
      </p>
    </div>
  );
}
