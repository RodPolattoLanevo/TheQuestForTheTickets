import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { XpBar } from "../components/XpBar";
import { DungeonScreen, DungeonHudCell } from "../components/DungeonScreen";
import { CharacterPanel, type Appearance } from "../components/CharacterPanel";

interface CharacterSummary {
  user: { displayName: string };
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  coins: number;
  world: { name: string; theme: string | null; liberationPct: number } | null;
  stage: { name: string } | null;
  stats: { strength: number; defense: number; agility: number; magic: number; luck: number } | null;
  maxHp: number;
  equipped: Record<string, { name: string } | null>;
  appearance: Appearance;
  combat: { monster: { name: string; isBoss: boolean; isElite: boolean; image: string | null }; monsterHp: number; monsterMaxHp: number } | null;
  recentTransactions: Array<{ id: string; xp: number; coins: number; category: string | null; source: string; reason: string | null; createdAt: string; ticket: { externalId: string } | null }>;
}

const LEFT_TABS = [
  { key: "overview", label: "Visão Geral" },
  { key: "character", label: "Personagem" },
] as const;

// Matches the real Zendesk Groups this team uses - see Admin -> Category Rules, and
// ZENDESK_INTEGRATION.md for how a live sync resolves group_id to these names.
const GROUPS = ["BR Support LVL1", "BR Support LVL2", "BR Support LVL3", "BR Emergency"] as const;

export function Dashboard() {
  const { push } = useToast();
  const [summary, setSummary] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [group, setGroup] = useState<(typeof GROUPS)[number]>(GROUPS[0]);
  const [lastDamage, setLastDamage] = useState<{ amount: number; crit: boolean; regionPct?: number } | null>(null);
  const [leftTab, setLeftTab] = useState<(typeof LEFT_TABS)[number]["key"]>("overview");

  const load = useCallback(async () => {
    const data = await api.get<CharacterSummary>("/api/me");
    setSummary(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSimulate() {
    setSimulating(true);
    setLastDamage(null);
    try {
      const res = await api.post<any>("/api/dev/simulate-ticket", { group });
      const { syncResult } = res;

      if (syncResult.rewardsGranted > 0) {
        push({ tone: "reward", title: "Ticket Complete!", subtitle: group });
      } else {
        push({ tone: "reward", title: "Ticket synced (no new reward)", subtitle: group });
      }

      // Every completed ticket lands exactly one hit on the current monster - there is no
      // separate "Attack" action. Surface whatever that hit did.
      const combat = syncResult.combatOutcomes?.[0];
      if (combat?.attacked) {
        setLastDamage({ amount: combat.damageDealt ?? 0, crit: Boolean(combat.isCritical), regionPct: combat.regionLiberationPct });
        if (combat.monsterDefeated) {
          push({
            tone: combat.bossDefeated ? "boss" : "reward",
            title: combat.bossDefeated ? "BOSS DEFEATED!" : "Monster Defeated!",
            subtitle: combat.monsterName,
          });
          if (combat.leveledUp) {
            push({ tone: "levelup", title: "LEVEL UP!", subtitle: `Level ${combat.levelBefore} → ${combat.levelAfter}` });
          }
        }
      }

      for (const achievement of syncResult.unlockedAchievements ?? []) {
        push({ tone: "reward", title: "Achievement Unlocked!", subtitle: achievement.name });
      }

      await load();
    } catch (err) {
      push({ tone: "error", title: "Simulation failed", subtitle: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setSimulating(false);
    }
  }

  if (loading || !summary) return <div className="p-8 text-center text-slate-400">Loading your character...</div>;

  const hpPct = summary.combat ? Math.max(0, Math.round((summary.combat.monsterHp / summary.combat.monsterMaxHp) * 100)) : 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-3">
      <section className="panel p-6 lg:col-span-2">
        <div className="ornate-divider mb-5">
          <div className="flex gap-1">
            {LEFT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setLeftTab(tab.key)}
                className={`whitespace-nowrap px-3 py-1.5 font-display text-[11px] uppercase tracking-wide transition ${
                  leftTab === tab.key ? "bg-ink-700 text-gold-400" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {leftTab === "character" ? (
          <CharacterPanel appearance={summary.appearance} onChange={(appearance) => setSummary({ ...summary, appearance })} />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl text-gold-400">{summary.user.displayName}</h1>
                <p className="text-sm text-slate-400">
                  {summary.world?.name ?? "No region assigned yet"} {summary.stage ? `· ${summary.stage.name}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="whitespace-nowrap font-display text-lg text-gold-400">🪙 {summary.coins.toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Coins</p>
              </div>
            </div>

            <div className="mt-5">
              <XpBar level={summary.level} xpIntoLevel={summary.xpIntoLevel} xpForNextLevel={summary.xpForNextLevel} />
            </div>

            {summary.world && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
                  <span>Regional Liberation</span>
                  <span className="text-green-400">{summary.world.liberationPct}%</span>
                </div>
                <div className="xp-bar-track mt-1 !h-2.5">
                  <div className="liberation-bar-fill" style={{ width: `${summary.world.liberationPct}%` }} />
                </div>
                <Link to="/world" className="mt-1 inline-block text-[10px] text-gold-400 underline decoration-dotted hover:text-gold-300">
                  View Region Map →
                </Link>
              </div>
            )}

            {summary.stats && (
              <div className="mt-5 grid grid-cols-5 gap-2 text-center text-xs">
                {(["strength", "defense", "agility", "magic", "luck"] as const).map((s) => (
                  <div key={s} className="rounded-none border border-ink-700 bg-ink-800/60 py-2">
                    <p className="text-slate-500 uppercase tracking-wide">{s.slice(0, 3)}</p>
                    <p className="font-display text-gold-400">{summary.stats![s]}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-ink-700 pt-5">
              {summary.combat ? (
                <div>
                  <DungeonScreen
                    theme={summary.world?.theme ?? null}
                    label={`${summary.combat.monster.isBoss ? "👑 " : ""}${summary.combat.monster.isElite ? "⭐ " : ""}${summary.combat.monster.name}`}
                    overlay={
                      summary.combat.monster.image && (
                        <img src={summary.combat.monster.image} alt={summary.combat.monster.name} className="dungeon-screen__monster" />
                      )
                    }
                  >
                    <DungeonHudCell label="Monster HP" value={`${summary.combat.monsterHp} / ${summary.combat.monsterMaxHp}`} grow />
                    <DungeonHudCell
                      label="Threat"
                      value={summary.combat.monster.isBoss ? "Boss" : summary.combat.monster.isElite ? "Elite" : "Normal"}
                    />
                  </DungeonScreen>
                  <div className="xp-bar-track mt-2">
                    <div className="hp-bar-fill" style={{ width: `${hpPct}%` }} />
                  </div>

                  {lastDamage ? (
                    <p className={`mt-2 text-sm ${lastDamage.crit ? "text-ember-400 font-bold" : "text-slate-300"}`}>
                      Your last closed ticket dealt {lastDamage.amount} damage{lastDamage.crit ? " — CRITICAL HIT!" : ""}
                      {lastDamage.regionPct !== undefined && (
                        <span className="ml-1 text-green-400">· Region now {lastDamage.regionPct}% liberated</span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      There's no "Attack" button - every ticket you close lands a hit on this monster automatically.
                      Your stats and gear decide how hard it hits.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No active encounter. You've cleared every world currently configured — check back after a content update!</p>
              )}
            </div>
          </>
        )}
      </section>

      <section className="panel p-6">
        <h2 className="font-display text-lg text-gold-400">Simulate a Ticket</h2>
        <p className="mt-1 text-xs text-slate-500">Dev/demo tool - runs through the real reward pipeline, same as a live Zendesk sync.</p>
        <div className="mt-4 flex flex-col gap-3">
          <select
            className="rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm"
            value={group}
            onChange={(e) => setGroup(e.target.value as typeof group)}
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <button className="btn-secondary" onClick={handleSimulate} disabled={simulating}>
            {simulating ? "Simulating..." : "Complete a Ticket"}
          </button>
        </div>

        <h3 className="mt-6 font-display text-sm text-gold-400">Recent Tickets & Rewards</h3>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {summary.recentTransactions.length === 0 && <li className="text-slate-500">No activity yet - complete a ticket to get started.</li>}
          {summary.recentTransactions.map((t) => (
            <li key={t.id} className="rounded-none border border-ink-700 bg-ink-800/50 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">{t.ticket ? `Ticket #${t.ticket.externalId}` : t.reason ?? t.source}</span>
                <span className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="mt-0.5 flex gap-3 text-xs">
                {t.xp !== 0 && <span className={t.xp > 0 ? "text-gold-400" : "text-red-400"}>{t.xp > 0 ? "+" : ""}{t.xp} XP</span>}
                {t.coins !== 0 && <span className={t.coins > 0 ? "text-gold-400" : "text-red-400"}>{t.coins > 0 ? "+" : ""}{t.coins} Coins</span>}
                {t.category && <span className="text-slate-500">· {t.category}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
