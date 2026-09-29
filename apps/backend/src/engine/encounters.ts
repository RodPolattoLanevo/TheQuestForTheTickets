import { getPrismaClient } from "@hunt/database";

const prisma = getPrismaClient();

/**
 * Picks the next monster a character should face in their current world: normal monsters
 * first, elites next, boss last, skipping anything already defeated (VICTORY session on
 * record). Returns null once the whole world is cleared.
 */
export async function selectNextMonster(worldId: string, characterId: string) {
  const [monsters, victories] = await Promise.all([
    prisma.monster.findMany({ where: { worldId }, orderBy: [{ isBoss: "asc" }, { isElite: "asc" }, { level: "asc" }] }),
    prisma.combatSession.findMany({ where: { characterId, status: "VICTORY" }, select: { monsterId: true } }),
  ]);
  const defeated = new Set(victories.map((v) => v.monsterId));
  return monsters.find((m) => !defeated.has(m.id)) ?? null;
}

/**
 * Ensures the character has an IN_PROGRESS combat session in their current world, creating
 * one against the next undefeated monster if needed. Returns null if the world has no more
 * monsters left to fight (fully cleared). Takes `currentWorldId` directly rather than
 * re-fetching the Character row - every caller already has it in scope from its own query.
 */
export async function getOrCreateActiveSession(characterId: string, currentWorldId: string | null) {
  if (!currentWorldId) return null;

  const existing = await prisma.combatSession.findFirst({
    where: { characterId, status: "IN_PROGRESS" },
    include: { monster: true },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return existing;

  const monster = await selectNextMonster(currentWorldId, characterId);
  if (!monster) return null;

  const session = await prisma.combatSession.create({
    data: { characterId, monsterId: monster.id, monsterHp: monster.hp, monsterMaxHp: monster.hp },
    include: { monster: true },
  });
  return session;
}

/**
 * After a boss falls, moves the character on to the next world (if any). Takes
 * `currentWorldId` directly, same reasoning as getOrCreateActiveSession above.
 */
export async function advanceWorldIfCleared(characterId: string, currentWorldId: string) {
  const remaining = await selectNextMonster(currentWorldId, characterId);
  if (remaining) return; // world not cleared yet

  const currentWorld = await prisma.world.findUniqueOrThrow({ where: { id: currentWorldId } });
  const nextWorld = await prisma.world.findFirst({ where: { order: { gt: currentWorld.order }, active: true }, orderBy: { order: "asc" } });
  if (!nextWorld) return; // no more content yet - stays in the final world

  const nextStage = await prisma.stage.findFirst({ where: { worldId: nextWorld.id }, orderBy: { order: "asc" } });
  await prisma.character.update({
    where: { id: characterId },
    data: { currentWorldId: nextWorld.id, currentStageId: nextStage?.id ?? null },
  });
}
