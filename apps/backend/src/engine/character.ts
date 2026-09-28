import { getPrismaClient } from "@hunt/database";
import { deriveCombatPower, type CombatStats } from "@hunt/game-engine";

const prisma = getPrismaClient();

const EQUIPPED_ITEM_FIELDS = [
  "equippedArmorId",
  "equippedWeaponId",
  "equippedAccessoryId",
  "equippedPetId",
  "equippedTitleId",
  "equippedAuraId",
  "equippedMountId",
  "equippedBackgroundId",
] as const;

/** Sums statBonuses JSON across every equipped (gameplay-affecting) item. */
export async function getEquipmentBonus(characterId: string): Promise<Partial<CombatStats>> {
  const character = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
  const itemIds = EQUIPPED_ITEM_FIELDS.map((f) => character[f]).filter((v): v is string => Boolean(v));
  if (itemIds.length === 0) return {};

  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });
  const bonus: Partial<CombatStats> = {};
  for (const item of items) {
    if (!item.statBonuses) continue;
    const parsed = JSON.parse(item.statBonuses) as Partial<CombatStats>;
    for (const [key, value] of Object.entries(parsed)) {
      bonus[key as keyof CombatStats] = (bonus[key as keyof CombatStats] ?? 0) + (value ?? 0);
    }
  }
  return bonus;
}

export function maxHpForLevel(level: number, defense: number): number {
  return 100 + level * 10 + defense * 5;
}

/** New characters start in the lowest-order active World, if one has been configured yet. */
export async function assignStartingWorldIfNeeded(characterId: string): Promise<void> {
  const character = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
  if (character.currentWorldId) return;

  const firstWorld = await prisma.world.findFirst({ where: { active: true }, orderBy: { order: "asc" } });
  if (!firstWorld) return;

  const firstStage = await prisma.stage.findFirst({ where: { worldId: firstWorld.id }, orderBy: { order: "asc" } });
  await prisma.character.update({ where: { id: characterId }, data: { currentWorldId: firstWorld.id, currentStageId: firstStage?.id } });
}

export async function getCombatPowerForCharacter(characterId: string) {
  const stats = await prisma.characterStats.findUniqueOrThrow({ where: { characterId } });
  const bonus = await getEquipmentBonus(characterId);
  const power = deriveCombatPower(
    { strength: stats.strength, defense: stats.defense, agility: stats.agility, magic: stats.magic, luck: stats.luck },
    bonus
  );
  return { power, stats, bonus };
}
