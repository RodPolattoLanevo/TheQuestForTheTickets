import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";

interface ShopItem {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  price: number;
  owned: boolean;
  unlocked: boolean;
  canAfford: boolean;
}

const CATEGORIES = ["WEAPON", "ARMOR", "HELMET", "ACCESSORY", "PET", "MOUNT", "EFFECT", "EMOTE", "TITLE", "BACKGROUND"];

const CATEGORY_TO_SLOT: Record<string, string> = {
  ARMOR: "armor",
  WEAPON: "weapon",
  HELMET: "accessory",
  ACCESSORY: "accessory",
  PET: "pet",
  TITLE: "title",
  EFFECT: "aura",
  MOUNT: "mount",
  BACKGROUND: "background",
};

export function Shop() {
  const { push } = useToast();
  const [data, setData] = useState<{ coins: number; level: number; items: ShopItem[] } | null>(null);
  const [equipped, setEquipped] = useState<Record<string, { id?: string } | null>>({});
  const [filter, setFilter] = useState<string>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [shop, me] = await Promise.all([api.get<{ coins: number; level: number; items: ShopItem[] }>("/api/shop"), api.get<any>("/api/me")]);
    setData(shop);
    setEquipped(me.equipped ?? {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function purchase(item: ShopItem) {
    setBusyId(item.id);
    try {
      await api.post("/api/shop/purchase", { itemId: item.id });
      push({ tone: "reward", title: "Item Purchased!", subtitle: item.name });
      await load();
    } catch (err) {
      push({ tone: "error", title: "Purchase failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEquip(item: ShopItem) {
    const slot = CATEGORY_TO_SLOT[item.category];
    if (!slot) return;
    const isEquipped = equipped[slot]?.id === item.id;
    setBusyId(item.id);
    try {
      await api.post("/api/me/equip", { slot, itemId: isEquipped ? null : item.id });
      push({ tone: "reward", title: isEquipped ? "Unequipped" : "Equipped!", subtitle: item.name });
      await load();
    } catch (err) {
      push({ tone: "error", title: "Equip failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <div className="p-8 text-center text-slate-400">Loading the shop...</div>;

  const items = filter === "ALL" ? data.items : data.items.filter((i) => i.category === filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-gold-400">Cosmetic Shop</h1>
          <p className="text-sm text-slate-400">Level {data.level} · {data.coins.toLocaleString()} 🪙 available</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["ALL", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-none border px-3 py-1 text-xs ${filter === c ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-700 text-slate-400 hover:bg-ink-800"}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="panel flex flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm text-gold-400">{item.name}</h3>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">{item.rarity}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{item.description}</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gold-400">{item.price.toLocaleString()} 🪙</span>
              {item.owned ? (
                CATEGORY_TO_SLOT[item.category] ? (
                  <button className="btn-secondary !px-3 !py-1 text-xs" disabled={busyId === item.id} onClick={() => toggleEquip(item)}>
                    {equipped[CATEGORY_TO_SLOT[item.category]]?.id === item.id ? "Unequip" : "Equip"}
                  </button>
                ) : (
                  <span className="rounded-none bg-green-500/20 px-3 py-1 text-xs text-green-400">Owned</span>
                )
              ) : !item.unlocked ? (
                <span className="rounded-none bg-ink-700 px-3 py-1 text-xs text-slate-400">Locked</span>
              ) : (
                <button className="btn-secondary !px-3 !py-1 text-xs" disabled={!item.canAfford || busyId === item.id} onClick={() => purchase(item)}>
                  {busyId === item.id ? "..." : item.canAfford ? "Buy" : "Not enough coins"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
