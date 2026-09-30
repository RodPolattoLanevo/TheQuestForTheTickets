import { useState } from "react";
import { AdminOverview } from "./admin/AdminOverview";
import { AdminUsers } from "./admin/AdminUsers";
import { AdminCategoryRules } from "./admin/AdminCategoryRules";
import { AdminCsvImport } from "./admin/AdminCsvImport";
import { AdminProvidersSync } from "./admin/AdminProvidersSync";
import { AdminGrants } from "./admin/AdminGrants";
import { AdminAuditLog } from "./admin/AdminAuditLog";
import { AdminSettings } from "./admin/AdminSettings";

const TABS = [
  { key: "overview", label: "Overview", Component: AdminOverview },
  { key: "users", label: "Administrar usuários", Component: AdminUsers },
  { key: "rules", label: "Category Rules", Component: AdminCategoryRules },
  { key: "csv", label: "CSV Import", Component: AdminCsvImport },
  { key: "sync", label: "Providers & Sync", Component: AdminProvidersSync },
  { key: "grants", label: "Grant / Remove / Reset", Component: AdminGrants },
  { key: "settings", label: "Game Settings", Component: AdminSettings },
  { key: "audit", label: "Audit Log", Component: AdminAuditLog },
] as const;

export function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const Active = TABS.find((t) => t.key === tab)!.Component;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl text-ember-400">Admin Panel</h1>
      <p className="mt-1 text-sm text-slate-400">Game Master controls - every change here affects live gameplay immediately.</p>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-ink-700 pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-none border px-3 py-1 text-xs ${tab === t.key ? "border-ember-500 bg-ember-500/10 text-ember-400" : "border-ink-700 text-slate-400 hover:bg-ink-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <Active />
      </div>
    </div>
  );
}
