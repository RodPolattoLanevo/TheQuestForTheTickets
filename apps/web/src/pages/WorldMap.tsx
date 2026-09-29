import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { RegionMap } from "../components/RegionMap";

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

      <div className="mt-6">
        <RegionMap
          regions={worlds}
          onDeploy={(regionId) => {
            const world = worlds.find((w) => w.id === regionId);
            if (world) deploy(world);
          }}
          deploying={deploying}
        />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wide text-slate-500">
          <span>⚔ = deployed here now</span>
          <span>🔒 = locked, needs more XP</span>
          <span>Numbered/themed marker = unlocked, click to deploy</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {worlds.map((world) => (
          <div key={world.id} className={`px-3 py-2 text-xs ${world.isCurrent ? "text-gold-400" : world.unlocked ? "text-slate-300" : "text-slate-600"}`}>
            <span className="font-display text-[10px]">{world.order}. {world.name}</span>
            <span className="ml-2 text-slate-500">
              {world.unlocked ? `${world.liberationPct}% liberated` : `🔒 ${world.xpRequirement.toLocaleString()} XP`}
            </span>
          </div>
        ))}
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

          <h3 className="mt-5 font-display text-xs text-gold-400">Monster Roster</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {current.monsters.map((m) => (
              <div
                key={m.id}
                className={`panel flex flex-col items-center gap-1.5 p-3 text-center ${
                  m.isBoss ? "border-ember-500" : ""
                }`}
              >
                <div className="relative flex h-20 w-20 items-center justify-center bg-ink-950">
                  {m.image ? (
                    <img
                      src={m.image}
                      alt={m.name}
                      className={`h-full w-full object-contain [image-rendering:auto] ${m.defeated ? "grayscale opacity-50" : ""}`}
                    />
                  ) : (
                    <span className="text-3xl opacity-40">❓</span>
                  )}
                  {m.defeated && (
                    <span className="absolute inset-0 flex items-center justify-center text-2xl text-green-400">✓</span>
                  )}
                </div>
                <p className={`text-[11px] font-medium leading-tight ${RARITY_COLOR[m.rarity] ?? "text-slate-300"}`}>
                  {m.isBoss && "👑 "}
                  {m.isElite && "⭐ "}
                  {m.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  Lv {m.level} · {m.hp} HP
                </p>
                {m.defeated && <p className="text-[10px] uppercase tracking-wide text-green-400">Defeated</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
