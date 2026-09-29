import { getPrismaClient } from "@hunt/database";
import { computeLevelProgress } from "@hunt/game-engine";
import { getLevelCurve } from "./gameConfig.js";
import { getOrCreateActiveSession } from "./encounters.js";
import { maxHpForLevel } from "./character.js";

const prisma = getPrismaClient();

const EQUIPPED_FIELDS = [
  ["equippedArmorId", "armor"],
  ["equippedWeaponId", "weapon"],
  ["equippedAccessoryId", "accessory"],
  ["equippedPetId", "pet"],
  ["equippedTitleId", "title"],
  ["equippedAuraId", "aura"],
  ["equippedMountId", "mount"],
  ["equippedBackgroundId", "background"],
] as const;

export async function buildCharacterSummary(userId: string) {
  const character = await prisma.character.findUniqueOrThrow({
    where: { userId },
    include: { stats: true, currentWorld: true, currentStage: true, user: true },
  });

  const curve = await getLevelCurve();
  const progress = computeLevelProgress(character.xp, curve);

  const equippedIds = EQUIPPED_FIELDS.map(([field]) => character[field]).filter((v): v is string => Boolean(v));
  const equippedItems = equippedIds.length
    ? await prisma.item.findMany({ where: { id: { in: equippedIds } } })
    : [];
  const itemById = new Map(equippedItems.map((i) => [i.id, i]));
  const equipped = Object.fromEntries(
    EQUIPPED_FIELDS.map(([field, slot]) => [slot, character[field] ? itemById.get(character[field]!) ?? null : null])
  );

  const session = await getOrCreateActiveSession(character.id, character.currentWorldId);

  const recentTransactions = await prisma.rewardTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { ticket: true },
  });

  return {
    user: { id: character.user.id, email: character.user.email, displayName: character.user.displayName, role: character.user.role },
    level: progress.level,
    xp: character.xp,
    xpIntoLevel: progress.xpIntoLevel,
    xpForNextLevel: progress.xpForNextLevel,
    coins: character.coins,
    world: character.currentWorld
      ? {
          ...character.currentWorld,
          liberationPct: Math.min(100, Math.round((character.currentWorld.liberationCurrent / character.currentWorld.liberationTarget) * 100)),
        }
      : null,
    stage: character.currentStage,
    stats: character.stats,
    maxHp: character.stats ? maxHpForLevel(progress.level, character.stats.defense) : maxHpForLevel(progress.level, 0),
    equipped,
    combat: session
      ? {
          sessionId: session.id,
          monster: session.monster,
          monsterHp: session.monsterHp,
          monsterMaxHp: session.monsterMaxHp,
        }
      : null,
    recentTransactions,
  };
}
