import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";

interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  isElite: boolean;
  isBoss: boolean;
  defeated: boolean;
  rarity: string;
  image: string | null;
}

interface World {
  id: string;
  key: string;
  name: string;
  description: string;
  order: number;
  xpRequirement: number;
  theme: string | null;
  isCurrent: boolean;
  unlocked: boolean;
  liberationPct: number;
  monsters: Monster[];
}

const RARITY_COLOR: Record<string, string> = {
  COMMON: "text-slate-300",
  UNCOMMON: "text-green-400",
  RARE: "text-blue-400",
  EPIC: "text-purple-400",
  LEGENDARY: "text-gold-400",
};

const THEME_ICON: Record<string, string> = {
  meadow: "🏘️",
  forest: "🌲",
  cave: "⛏️",
  wasteland: "🏜️",
  fortress: "🏰",
  volcano: "🌋",
};

export function WorldMap() {
  const { push } = useToast();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api.get<World[]>("/api/worlds");
    setWorlds(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function deploy(world: World) {
    if (!world.unlocked || world.isCurrent) return;
    setDeploying(world.id);
    try {
      await api.post(`/api/worlds/${world.id}/deploy`);
      push({ tone: "reward", title: "Deployed!", subtitle: `Now fighting in ${world.name}` });
      await load();
    } catch (err) {
      push({ tone: "error", title: "Deploy failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setDeploying(null);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Loading the region map...</div>;

  const current = worlds.find((w) => w.isCurrent);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="font-display text-2xl text-gold-400">Region Map</h1>
      <p className="mt-1 text-sm text-slate-400">
        Click a region to deploy there. Every ticket you close while deployed pushes that region's shared liberation
        meter - the more agents fighting there, the faster it clears.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {worlds.map((world) => {
          const cleared = world.liberationPct >= 100;
          const icon = (world.theme && THEME_ICON[world.theme]) || "🗺️";
          return (
            <button
              key={world.id}
              onClick={() => deploy(world)}
              disabled={!world.unlocked || world.isCurrent || deploying === world.id}
              className={`panel flex flex-col gap-3 p-4 text-left transition ${
                world.isCurrent ? "border-gold-500 shadow-glow" : world.unlocked ? "hover:brightness-110" : "opacity-60"
              } disabled:cursor-not-allowed`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-3xl [image-rendering:pixelated]">{world.unlocked ? icon : "🔒"}</span>
                <div className="flex flex-col items-end gap-1">
                  {world.isCurrent && <span className="whitespace-nowrap bg-gold-500/20 px-2 py-0.5 text-[9px] uppercase tracking-wide text-gold-400">▶ Deployed</span>}
                  {cleared && <span className="whitespace-nowrap bg-green-500/20 px-2 py-0.5 text-[9px] uppercase tracking-wide text-green-400">Liberated</span>}
                </div>
              </div>

              <div>
                <h2 className="font-display text-xs leading-relaxed text-gold-400">
                  {world.order}. {world.name}
                </h2>
                <p className="mt-1 text-xs text-slate-400">{world.description}</p>
              </div>

              {world.unlocked ? (
                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
                    <span>Liberation</span>
                    <span className="text-green-400">{world.liberationPct}%</span>
                  </div>
                  <div className="xp-bar-track mt-1 !h-3">
                    <div className="liberation-bar-fill" style={{ width: `${world.liberationPct}%` }} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ember-400">🔒 Requires {world.xpRequirement.toLocaleString()} XP</p>
              )}

              <p className="text-[10px] text-slate-500">
                {world.monsters.length} monster{world.monsters.length === 1 ? "" : "s"} · {world.monsters.filter((m) => m.defeated).length} defeated by you
              </p>

              {!world.isCurrent && world.unlocked && (
                <span className="btn-secondary mt-1 justify-center !py-1.5 text-[10px]">{deploying === world.id ? "Deploying..." : "Deploy Here"}</span>
              )}
            </button>
          );
        })}
      </div>

      {current && (
        <div className="panel mt-6 p-5">
          <h2 className="font-display text-sm text-gold-400">
            ▶ Deployed: {current.name}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{current.description}</p>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="uppercase tracking-wide">Regional Liberation</span>
              <span className="text-green-400">{current.liberationPct}%</span>
            </div>
            <div className="xp-bar-track mt-1">
              <div className="liberation-bar-fill" style={{ width: `${current.liberationPct}%` }} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {current.monsters.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 border px-3 py-2 text-xs ${
                  m.defeated ? "border-green-700 bg-green-900/20" : "border-ink-700 bg-ink-800/60"
                }`}
              >
                {m.image && (
                  <img
                    src={m.image}
                    alt={m.name}
                    className={`h-12 w-12 shrink-0 object-contain [image-rendering:pixelated] ${m.defeated ? "grayscale opacity-60" : ""}`}
                  />
                )}
                <div>
                  <p className={`font-medium ${RARITY_COLOR[m.rarity] ?? "text-slate-300"}`}>
                    {m.isBoss && "👑 "}
                    {m.isElite && "⭐ "}
                    {m.name}
                  </p>
                  <p className="text-slate-500">
                    Lv {m.level} · {m.hp} HP {m.defeated && "· ✓ Defeated"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
