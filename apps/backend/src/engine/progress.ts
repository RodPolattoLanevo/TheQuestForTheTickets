import { getPrismaClient } from "@hunt/database";
import { evaluateCriteria, type Criteria } from "@hunt/game-engine";
import { computeLifetimeStats, computePeriodStats } from "./stats.js";
import { grantReward } from "./rewards.js";

const prisma = getPrismaClient();

/**
 * Re-evaluates every active Achievement against a user's lifetime stats and unlocks
 * (+ grants reward for) any that just became satisfied. Achievements auto-unlock - no
 * claim step, since they're a permanent record of what the agent has done.
 */
export async function refreshAchievements(userId: string) {
  const stats = await computeLifetimeStats(userId);
  const achievements = await prisma.achievement.findMany({ where: { active: true } });
  const existing = await prisma.userAchievement.findMany({ where: { userId } });
  const existingByAchievement = new Map(existing.map((e) => [e.achievementId, e]));

  const unlocked: { key: string; name: string; xpReward: number; coinsReward: number }[] = [];

  for (const achievement of achievements) {
    const current = existingByAchievement.get(achievement.id);
    if (current?.unlockedAt) continue;

    const criteria = JSON.parse(achievement.criteria) as Criteria;
    const { progress, complete } = evaluateCriteria(criteria, stats);

    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
      update: { progress, unlockedAt: complete ? new Date() : undefined },
      create: { userId, achievementId: achievement.id, progress, unlockedAt: complete ? new Date() : undefined },
    });

    if (complete) {
      if (achievement.xpReward > 0 || achievement.coinsReward > 0) {
        await grantReward({
          userId,
          source: "ACHIEVEMENT",
          xp: achievement.xpReward,
          coins: achievement.coinsReward,
          reason: `Achievement unlocked: ${achievement.name}`,
        });
      }
      unlocked.push({ key: achievement.key, name: achievement.name, xpReward: achievement.xpReward, coinsReward: achievement.coinsReward });
    }
  }

  return unlocked;
}

/**
 * Recomputes progress for every quest whose period currently covers "now". Quests are
 * marked `completed` here but rewards are granted separately via POST /api/quests/:id/claim -
 * that's a real button in the UI, not just a status flag.
 */
export async function refreshQuests(userId: string) {
  const now = new Date();
  const quests = await prisma.quest.findMany({
    where: { active: true, periodStart: { lte: now }, periodEnd: { gte: now } },
  });

  const updated = [];
  for (const quest of quests) {
    const stats = await computePeriodStats(userId, quest.periodStart, quest.periodEnd);
    const criteria = JSON.parse(quest.criteria) as Criteria;
    const { progress, complete } = evaluateCriteria(criteria, stats);

    const row = await prisma.userQuest.upsert({
      where: { userId_questId: { userId, questId: quest.id } },
      update: { progress, completed: complete },
      create: { userId, questId: quest.id, progress, completed: complete },
    });
    updated.push({ quest, userQuest: row });
  }
  return updated;
}

export async function refreshProgressForUser(userId: string) {
  const [unlockedAchievements, updatedQuests] = await Promise.all([refreshAchievements(userId), refreshQuests(userId)]);
  return { unlockedAchievements, updatedQuests };
}
