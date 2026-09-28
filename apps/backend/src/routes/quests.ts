import { Router } from "express";
import { getPrismaClient } from "@hunt/database";
import { requireAuth } from "../auth/middleware.js";
import { refreshQuests } from "../engine/progress.js";
import { grantReward } from "../engine/rewards.js";

const prisma = getPrismaClient();
export const questsRouter = Router();
questsRouter.use(requireAuth);

questsRouter.get("/", async (req, res) => {
  const updated = await refreshQuests(req.auth!.sub);
  res.json(updated.map(({ quest, userQuest }) => ({ ...quest, progress: userQuest.progress, completed: userQuest.completed, claimedAt: userQuest.claimedAt })));
});

questsRouter.post("/:questId/claim", async (req, res) => {
  const userId = req.auth!.sub;
  const { questId } = req.params;

  const userQuest = await prisma.userQuest.findUnique({ where: { userId_questId: { userId, questId } }, include: { quest: true } });
  if (!userQuest) return res.status(404).json({ error: "Quest not found for this user" });
  if (!userQuest.completed) return res.status(400).json({ error: "Quest is not complete yet" });
  if (userQuest.claimedAt) return res.status(409).json({ error: "Quest reward already claimed" });

  const reward = await grantReward({
    userId,
    source: "QUEST",
    xp: userQuest.quest.xpReward,
    coins: userQuest.quest.coinsReward,
    reason: `Quest completed: ${userQuest.quest.name}`,
  });

  if (userQuest.quest.itemRewardId) {
    await prisma.inventoryItem
      .create({ data: { characterId: (await prisma.character.findUniqueOrThrow({ where: { userId } })).id, itemId: userQuest.quest.itemRewardId, source: "quest" } })
      .catch(() => undefined); // already owned - ignore
  }

  await prisma.userQuest.update({ where: { userId_questId: { userId, questId } }, data: { claimedAt: new Date() } });

  res.json({ reward });
});
