import { Router } from "express";
import { getPrismaClient } from "@hunt/database";
import { requireAuth } from "../auth/middleware.js";

const prisma = getPrismaClient();
export const worldsRouter = Router();
worldsRouter.use(requireAuth);

worldsRouter.get("/", async (req, res) => {
  const [worlds, character] = await Promise.all([
    prisma.world.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: { monsters: { orderBy: [{ isBoss: "asc" }, { isElite: "asc" }, { level: "asc" }] }, stages: { orderBy: { order: "asc" } } },
    }),
    prisma.character.findUniqueOrThrow({ where: { userId: req.auth!.sub } }),
  ]);

  const victories = await prisma.combatSession.findMany({ where: { characterId: character.id, status: "VICTORY" }, select: { monsterId: true } });
  const defeatedIds = new Set(victories.map((v) => v.monsterId));

  res.json(
    worlds.map((w) => ({
      ...w,
      isCurrent: w.id === character.currentWorldId,
      unlocked: character.xp >= w.xpRequirement,
      liberationPct: Math.min(100, Math.round((w.liberationCurrent / w.liberationTarget) * 100)),
      monsters: w.monsters.map((m) => ({ ...m, defeated: defeatedIds.has(m.id) })),
    }))
  );
});

/**
 * "Deploy" to a region (Helldivers-style manual region selection): the player picks any
 * region they've unlocked by XP, overriding whatever world auto-advance last set. Their
 * personal monster queue for that region resumes (or starts) right where it left off -
 * see engine/encounters.ts getOrCreateActiveSession, which is keyed off currentWorldId.
 */
worldsRouter.post("/:id/deploy", async (req, res) => {
  const world = await prisma.world.findUnique({ where: { id: req.params.id } });
  if (!world || !world.active) return res.status(404).json({ error: "Region not found" });

  const character = await prisma.character.findUniqueOrThrow({ where: { userId: req.auth!.sub } });
  if (character.xp < world.xpRequirement) {
    return res.status(403).json({ error: `Requires ${world.xpRequirement.toLocaleString()} XP to deploy here` });
  }

  const stage = await prisma.stage.findFirst({ where: { worldId: world.id }, orderBy: { order: "asc" } });
  await prisma.character.update({ where: { id: character.id }, data: { currentWorldId: world.id, currentStageId: stage?.id ?? null } });

  res.json({ ok: true });
});
