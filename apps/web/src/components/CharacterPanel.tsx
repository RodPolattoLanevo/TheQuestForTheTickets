import { useState } from "react";
import { api } from "../api/client";

export interface Appearance {
  head: string | null;
  hair: string | null;
  face: string | null;
  body: string | null;
  torso: string | null;
  hands: string | null;
  pants: string | null;
  boots: string | null;
}

const HAIR_OPTIONS = [
  { key: "blonde-long", label: "Loiro Longo", image: "/character/hair-blonde-long.webp" },
  { key: "brown-braids", label: "Tranças Castanhas", image: "/character/hair-brown-braids.webp" },
  { key: "auburn-wild", label: "Ruivo Selvagem", image: "/character/hair-auburn-wild.webp" },
  { key: "blue-wild", label: "Azul Selvagem", image: "/character/hair-blue-wild.webp" },
  { key: "purple-curls", label: "Cachos Roxos", image: "/character/hair-purple-curls.webp" },
] as const;

// Slots prepared for a future update - the fields/endpoint already exist end-to-end,
// but there are no selectable presets for them yet.
const RESERVED_SLOTS = [
  { key: "torso", label: "Torso" },
  { key: "hands", label: "Mãos" },
  { key: "pants", label: "Calças" },
  { key: "boots", label: "Botas" },
] as const;

function hairImageForKey(key: string | null) {
  return HAIR_OPTIONS.find((h) => h.key === key)?.image ?? null;
}

export function CharacterPanel({ appearance, onChange }: { appearance: Appearance; onChange: (appearance: Appearance) => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const hairImage = hairImageForKey(appearance.hair);

  async function selectHair(key: string) {
    const nextKey = appearance.hair === key ? null : key;
    setSaving(key);
    try {
      const summary = await api.post<{ appearance: Appearance }>("/api/me/appearance", { hair: nextKey });
      onChange(summary.appearance);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
      <div className="panel relative mx-auto aspect-[2/3] w-full max-w-[220px] overflow-hidden bg-ink-950">
        <img src="/character/body-base.webp" alt="Personagem" className="absolute inset-0 h-full w-full object-contain" />
        {hairImage && (
          <img
            src={hairImage}
            alt=""
            className="pointer-events-none absolute left-1/2 top-[2%] w-[52%] -translate-x-1/2 object-contain"
          />
        )}
      </div>

      <div>
        <div className="ornate-divider">
          <span className="font-display text-xs uppercase tracking-wide text-gold-400">Cabelo</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {HAIR_OPTIONS.map((h) => (
            <button
              key={h.key}
              type="button"
              disabled={saving !== null}
              onClick={() => selectHair(h.key)}
              className={`panel relative flex flex-col items-center gap-1 p-2 transition disabled:cursor-wait disabled:opacity-60 ${
                appearance.hair === h.key ? "!border-gold-400 shadow-glow" : ""
              }`}
              title={h.label}
            >
              <img src={h.image} alt={h.label} className="aspect-square w-full object-contain" />
              <span className="text-center text-[9px] leading-tight text-slate-400">{h.label}</span>
            </button>
          ))}
        </div>

        <div className="ornate-divider mt-6">
          <span className="font-display text-xs uppercase tracking-wide text-gold-400">Em Breve</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RESERVED_SLOTS.map((slot) => (
            <div
              key={slot.key}
              className="panel flex flex-col items-center justify-center gap-1 py-4 text-center opacity-50"
            >
              <span className="text-lg">🔒</span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{slot.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
