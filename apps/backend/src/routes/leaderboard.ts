import { Router } from "express";
import { getPrismaClient } from "@hunt/database";
import { requireAuth } from "../auth/middleware.js";

const prisma = getPrismaClient();
export const leaderboardRouter = Router();
leaderboardRouter.use(requireAuth);

type Period = "today" | "week" | "month" | "season" | "all";

async function getRange(period: Period): Promise<{ start: Date; end: Date } | null> {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end: now };
  }
  if (period === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start, end: now };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  }
  if (period === "season") {
    const season = await prisma.season.findFirst({ where: { active: true } });
    if (!season) return { start: now, end: now }; // no active season = empty leaderboard
    return { start: season.startDate, end: season.endDate };
  }
  return null; // all-time
}

leaderboardRouter.get("/", async (req, res) => {
  const period = (req.query.period as Period) ?? "week";
  const settingsRow = await prisma.integrationSetting.findUnique({ where: { key: "leaderboard_settings" } });
  const settings = settingsRow ? JSON.parse(settingsRow.value) : { visible: true };

  if (!settings.visible && req.auth!.role !== "ADMIN") {
    return res.json({ visible: false, period, entries: [] });
  }

  const range = await getRange(period);

  const characters = await prisma.character.findMany({
    include: { user: true },
  });

  const entries = await Promise.all(
    characters.map(async (character) => {
      const where = range ? { userId: character.userId, createdAt: { gte: range.start, lte: range.end } } : { userId: character.userId };
      const [ticketAgg, bossesDefeated] = await Promise.all([
        prisma.rewardTransaction.aggregate({ where: { ...where, source: "ZENDESK_TICKET" }, _sum: { xp: true }, _count: true }),
        prisma.combatSession.count({
          where: {
            characterId: character.id,
            status: "VICTORY",
            monster: { isBoss: true },
            ...(range ? { completedAt: { gte: range.start, lte: range.end } } : {}),
          },
        }),
      ]);
      const xpAgg = range
        ? await prisma.rewardTransaction.aggregate({ where, _sum: { xp: true } })
        : { _sum: { xp: character.xp } };

      return {
        userId: character.userId,
        displayName: character.user.displayName,
        level: character.level,
        xpInPeriod: xpAgg._sum.xp ?? 0,
        ticketsCompleted: ticketAgg._count,
        bossesDefeated,
      };
    })
  );

  entries.sort((a, b) => b.xpInPeriod - a.xpInPeriod);

  res.json({
    visible: true,
    period,
    entries: entries.map((e, i) => ({ rank: i + 1, ...e })),
  });
});
