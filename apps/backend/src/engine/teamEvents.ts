import { getPrismaClient } from "@hunt/database";
import { getFeatureFlags } from "./gameConfig.js";

const prisma = getPrismaClient();

/**
 * Adds a user's contribution to whatever team event is currently active (spec section 30:
 * "Kill the Dragon" style collaborative boss). Every completed ticket contributes damage -
 * this keeps the data model ready even though the first UI is intentionally simple.
 */
export async function addTeamEventDamage(userId: string, amount: number) {
  if (amount <= 0) return;
  const flags = await getFeatureFlags();
  if (!flags.teamEvents) return;

  const now = new Date();
  const event = await prisma.teamEvent.findFirst({
    where: { active: true, startDate: { lte: now }, endDate: { gte: now } },
  });
  if (!event) return;

  await prisma.$transaction([
    prisma.teamEventContribution.create({ data: { teamEventId: event.id, userId, damage: amount } }),
    prisma.teamEvent.update({
      where: { id: event.id },
      data: { currentDamage: { increment: amount } },
    }),
  ]);
}
