import { Router } from "express";
import { getPrismaClient } from "@hunt/database";
import { requireAuth } from "../auth/middleware.js";
import { refreshAchievements } from "../engine/progress.js";

const prisma = getPrismaClient();
export const achievementsRouter = Router();
achievementsRouter.use(requireAuth);

achievementsRouter.get("/", async (req, res) => {
  await refreshAchievements(req.auth!.sub);
  const [achievements, userAchievements] = await Promise.all([
    prisma.achievement.findMany({ where: { active: true } }),
    prisma.userAchievement.findMany({ where: { userId: req.auth!.sub } }),
  ]);
  const progressById = new Map(userAchievements.map((u) => [u.achievementId, u]));

  res.json(
    achievements.map((a) => ({
      ...a,
      progress: progressById.get(a.id)?.progress ?? 0,
      unlockedAt: progressById.get(a.id)?.unlockedAt ?? null,
    }))
  );
});
