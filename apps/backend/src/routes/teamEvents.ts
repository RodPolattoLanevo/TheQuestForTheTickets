import { Router } from "express";
import { getPrismaClient } from "@hunt/database";
import { requireAuth } from "../auth/middleware.js";

const prisma = getPrismaClient();
export const teamEventsRouter = Router();
teamEventsRouter.use(requireAuth);

teamEventsRouter.get("/active", async (req, res) => {
  const now = new Date();
  const event = await prisma.teamEvent.findFirst({ where: { active: true, startDate: { lte: now }, endDate: { gte: now } } });
  if (!event) return res.json(null);

  const topContributors = await prisma.teamEventContribution.groupBy({
    by: ["userId"],
    where: { teamEventId: event.id },
    _sum: { damage: true },
    orderBy: { _sum: { damage: "desc" } },
    take: 5,
  });
  const users = await prisma.user.findMany({ where: { id: { in: topContributors.map((c) => c.userId) } } });
  const nameById = new Map(users.map((u) => [u.id, u.displayName]));

  res.json({
    ...event,
    topContributors: topContributors.map((c) => ({ displayName: nameById.get(c.userId), damage: c._sum.damage ?? 0 })),
  });
});
