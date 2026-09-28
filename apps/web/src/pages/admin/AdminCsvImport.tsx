import { useState } from "react";
import { api, ApiError } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export function AdminCsvImport() {
  const { push } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function doPreview() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setPreview(await api.postForm("/api/admin/csv-import/preview", form));
    } catch (err) {
      push({ tone: "error", title: "Preview failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  async function doCommit() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.postForm("/api/admin/csv-import/commit", form);
      setResult(res);
      push({ tone: "reward", title: "CSV imported", subtitle: `${(res as any).rewardsGranted} rewards granted` });
    } catch (err) {
      push({ tone: "error", title: "Import failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-5">
      <h3 className="font-display text-sm text-ember-400">CSV Import</h3>
      <p className="mt-1 text-xs text-slate-500">
        Expected columns: ticket_id, employee (email or display name), category, status, completed_at. Preview before committing.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setResult(null); }} className="text-sm" />
        <button className="btn-secondary" disabled={!file || busy} onClick={doPreview}>Preview</button>
        <button className="btn-primary" disabled={!preview || busy} onClick={doCommit}>Confirm Import</button>
      </div>

      {preview && (
        <div className="mt-5">
          <p className="text-sm text-slate-300">
            {preview.valid.length} valid rows, {preview.invalid.length} invalid rows (of {preview.totalRows} total)
          </p>
          <div className="mt-2 max-h-64 overflow-auto rounded-none border border-ink-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-800 text-slate-400">
                <tr>
                  <th className="px-2 py-1">Ticket</th>
                  <th className="px-2 py-1">Employee</th>
                  <th className="px-2 py-1">Reward</th>
                </tr>
              </thead>
              <tbody>
                {preview.valid.map((p: any) => (
                  <tr key={p.ticket.externalId} className="border-t border-ink-800">
                    <td className="px-2 py-1">{p.ticket.externalId}</td>
                    <td className="px-2 py-1">{p.ticket.employeeExternalId}</td>
                    <td className="px-2 py-1 text-gold-400">+{p.reward.xp} XP / +{p.reward.coins} coins ({p.reward.difficulty})</td>
                  </tr>
                ))}
                {preview.invalid.map((row: any) => (
                  <tr key={row.row} className="border-t border-ink-800 text-red-400">
                    <td className="px-2 py-1" colSpan={3}>Row {row.row}: {row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <p className="mt-4 text-sm text-slate-300">
          Imported: {result.ticketsSeen} tickets seen, {result.rewardsGranted} rewards granted, {result.errors.length} errors.
        </p>
      )}
    </div>
  );
}
