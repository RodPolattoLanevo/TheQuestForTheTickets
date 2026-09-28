import { Router } from "express";
import { z } from "zod";
import { getPrismaClient } from "@hunt/database";
import { computeLevelProgress } from "@hunt/game-engine";
import { requireAuth } from "../auth/middleware.js";
import { grantReward } from "../engine/rewards.js";
import { getLevelCurve } from "../engine/gameConfig.js";
import { refreshProgressForUser } from "../engine/progress.js";

const prisma = getPrismaClient();
export const shopRouter = Router();
shopRouter.use(requireAuth);

shopRouter.get("/", async (req, res) => {
  const character = await prisma.character.findUniqueOrThrow({ where: { userId: req.auth!.sub } });
  const curve = await getLevelCurve();
  const level = computeLevelProgress(character.xp, curve).level;

  const [items, owned] = await Promise.all([
    prisma.item.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { price: "asc" }] }),
    prisma.inventoryItem.findMany({ where: { characterId: character.id }, select: { itemId: true } }),
  ]);
  const ownedIds = new Set(owned.map((o) => o.itemId));

  const catalog = items.map((item) => {
    const requirement = item.unlockRequirement ? (JSON.parse(item.unlockRequirement) as { minLevel?: number }) : null;
    const meetsRequirement = !requirement?.minLevel || level >= requirement.minLevel;
    return {
      ...item,
      owned: ownedIds.has(item.id),
      unlocked: meetsRequirement,
      canAfford: character.coins >= item.price,
    };
  });

  res.json({ coins: character.coins, level, items: catalog });
});

const purchaseSchema = z.object({ itemId: z.string() });

shopRouter.post("/purchase", async (req, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { itemId } = parsed.data;
  const userId = req.auth!.sub;

  const character = await prisma.character.findUniqueOrThrow({ where: { userId } });
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item || !item.active) return res.status(404).json({ error: "Item not found" });

  const already = await prisma.inventoryItem.findUnique({ where: { characterId_itemId: { characterId: character.id, itemId } } });
  if (already) return res.status(409).json({ error: "You already own this item" });

  const curve = await getLevelCurve();
  const level = computeLevelProgress(character.xp, curve).level;
  const requirement = item.unlockRequirement ? (JSON.parse(item.unlockRequirement) as { minLevel?: number }) : null;
  if (requirement?.minLevel && level < requirement.minLevel) {
    return res.status(403).json({ error: `Requires level ${requirement.minLevel}` });
  }

  if (character.coins < item.price) {
    return res.status(402).json({ error: "Not enough coins" });
  }

  await prisma.$transaction([
    prisma.inventoryItem.create({ data: { characterId: character.id, itemId, source: "shop" } }),
  ]);
  await grantReward({ userId, source: "SHOP_PURCHASE", coins: -item.price, reason: `Purchased ${item.name}` });

  const { unlockedAchievements } = await refreshProgressForUser(userId);

  res.status(201).json({ purchased: item, unlockedAchievements });
});
