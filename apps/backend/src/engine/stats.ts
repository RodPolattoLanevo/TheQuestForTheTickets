import { getPrismaClient } from "@hunt/database";
import type { PlayerProgressStats } from "@hunt/game-engine";

const prisma = getPrismaClient();

async function baseLevel(userId: string): Promise<number> {
  const character = await prisma.character.findUnique({ where: { userId } });
  return character?.level ?? 1;
}

/** Lifetime stats, used to evaluate permanent Achievements. */
export async function computeLifetimeStats(userId: string): Promise<PlayerProgressStats> {
  const [ticketsCompleted, bossesDefeated, monstersDefeated, itemsPurchased, level] = await Promise.all([
    prisma.rewardTransaction.count({ where: { userId, source: "ZENDESK_TICKET" } }),
    prisma.combatSession.count({ where: { character: { userId }, status: "VICTORY", monster: { isBoss: true } } }),
    prisma.combatSession.count({ where: { character: { userId }, status: "VICTORY" } }),
    prisma.inventoryItem.count({ where: { character: { userId }, source: "shop" } }),
    baseLevel(userId),
  ]);

  return { ticketsCompleted, bossesDefeated, monstersDefeated, itemsPurchased, level, xpEarnedInPeriod: 0 };
}

/** Stats scoped to a window (e.g. a quest's daily/weekly period), used to evaluate Quests. */
export async function computePeriodStats(userId: string, periodStart: Date, periodEnd: Date): Promise<PlayerProgressStats> {
  const createdAt = { gte: periodStart, lte: periodEnd };
  const [ticketsCompleted, bossesDefeated, monstersDefeated, itemsPurchased, xpAgg, level] = await Promise.all([
    prisma.rewardTransaction.count({ where: { userId, source: "ZENDESK_TICKET", createdAt } }),
    prisma.combatSession.count({ where: { character: { userId }, status: "VICTORY", monster: { isBoss: true }, completedAt: createdAt } }),
    prisma.combatSession.count({ where: { character: { userId }, status: "VICTORY", completedAt: createdAt } }),
    prisma.inventoryItem.count({ where: { character: { userId }, source: "shop", acquiredAt: createdAt } }),
    prisma.rewardTransaction.aggregate({ where: { userId, createdAt }, _sum: { xp: true } }),
    baseLevel(userId),
  ]);

  return {
    ticketsCompleted,
    bossesDefeated,
    monstersDefeated,
    itemsPurchased,
    level,
    xpEarnedInPeriod: xpAgg._sum.xp ?? 0,
  };
}
