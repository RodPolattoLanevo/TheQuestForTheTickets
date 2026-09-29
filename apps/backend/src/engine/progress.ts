import { getPrismaClient } from "@hunt/database";
import { evaluateCriteria, type Criteria } from "@hunt/game-engine";
import { computeLifetimeStats, computePeriodStats } from "./stats.js";
import { grantReward } from "./rewards.js";

const prisma = getPrismaClient();

/**
 * Re-evaluates every active Achievement against a user's lifetime stats and unlocks
 * (+ grants reward for) any that just became satisfied. Achievements auto-unlock - no
 * claim step, since they're a permanent record of what the agent has done.
 *
 * Every achievement is checked against the SAME `stats` snapshot (computed once, up front),
 * so each iteration is independent of every other - safe to evaluate them all concurrently
 * instead of one full DB round trip at a time.
 */
export async function refreshAchievements(userId: string) {
  const [stats, achievements, existing] = await Promise.all([
    computeLifetimeStats(userId),
    prisma.achievement.findMany({ where: { active: true } }),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);
  const existingByAchievement = new Map(existing.map((e) => [e.achievementId, e]));

  const results = await Promise.all(
    achievements.map(async (achievement) => {
      const current = existingByAchievement.get(achievement.id);
      if (current?.unlockedAt) return null;

      const criteria = JSON.parse(achievement.criteria) as Criteria;
      const { progress, complete } = evaluateCriteria(criteria, stats);

      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
        update: { progress, unlockedAt: complete ? new Date() : undefined },
        create: { userId, achievementId: achievement.id, progress, unlockedAt: complete ? new Date() : undefined },
      });

      if (!complete) return null;

      if (achievement.xpReward > 0 || achievement.coinsReward > 0) {
        await grantReward({
          userId,
          source: "ACHIEVEMENT",
          xp: achievement.xpReward,
          coins: achievement.coinsReward,
          reason: `Achievement unlocked: ${achievement.name}`,
        });
      }
      return { key: achievement.key, name: achievement.name, xpReward: achievement.xpReward, coinsReward: achievement.coinsReward };
    })
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * Recomputes progress for every quest whose period currently covers "now". Quests are
 * marked `completed` here but rewards are granted separately via POST /api/quests/:id/claim -
 * that's a real button in the UI, not just a status flag.
 *
 * Each quest has its own period window, so each needs its own computePeriodStats() call, but
 * the quests themselves don't depend on one another - evaluated concurrently rather than one
 * full round trip (stats + upsert) at a time.
 */
export async function refreshQuests(userId: string) {
  const now = new Date();
  const quests = await prisma.quest.findMany({
    where: { active: true, periodStart: { lte: now }, periodEnd: { gte: now } },
  });

  const updated = await Promise.all(
    quests.map(async (quest) => {
      const stats = await computePeriodStats(userId, quest.periodStart, quest.periodEnd);
      const criteria = JSON.parse(quest.criteria) as Criteria;
      const { progress, complete } = evaluateCriteria(criteria, stats);

      const row = await prisma.userQuest.upsert({
        where: { userId_questId: { userId, questId: quest.id } },
        update: { progress, completed: complete },
        create: { userId, questId: quest.id, progress, completed: complete },
      });
      return { quest, userQuest: row };
    })
  );
  return updated;
}

export async function refreshProgressForUser(userId: string) {
  const [unlockedAchievements, updatedQuests] = await Promise.all([refreshAchievements(userId), refreshQuests(userId)]);
  return { unlockedAchievements, updatedQuests };
}
