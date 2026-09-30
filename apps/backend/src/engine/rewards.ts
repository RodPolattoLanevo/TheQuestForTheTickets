import { getPrismaClient, type ActorType, type RewardSource } from "@hunt/database";
import { computeLevelProgress } from "@hunt/game-engine";
import type { LevelCurveConfig } from "@hunt/shared";
import { getLevelCurve } from "./gameConfig.js";

const prisma = getPrismaClient();

export interface GrantRewardInput {
  userId: string;
  source: RewardSource;
  xp?: number;
  coins?: number;
  ticketId?: string | null;
  eventId?: string | null;
  category?: string | null;
  reason?: string | null;
  provider?: string | null;
  actorType?: ActorType;
  actorUserId?: string | null;
}

export interface GrantRewardResult {
  transactionId: string;
  xp: number;
  coins: number;
  totalXp: number;
  totalCoins: number;
  levelBefore: number;
  levelAfter: number;
  leveledUp: boolean;
}

/**
 * The single place XP/coins ever change hands. Every caller - the ticket reward
 * pipeline, combat victories, quest claims, achievement unlocks, and admin grants -
 * goes through here so the audit log (RewardTransaction) is complete and the server
 * stays authoritative for XP/coins (spec section 21: client is never the source of truth).
 *
 * `curve` is optional - pass it when the caller already fetched the level-curve setting for
 * its own use moments earlier (e.g. resolveTicketCombat), to skip re-querying the same
 * IntegrationSetting row.
 */
export async function grantReward(input: GrantRewardInput, curve?: LevelCurveConfig): Promise<GrantRewardResult> {
  const xp = input.xp ?? 0;
  const coins = input.coins ?? 0;
  const resolvedCurve = curve ?? (await getLevelCurve());

  return prisma.$transaction(async (tx) => {
    // Serialize adjustments to this balance, including concurrent ticket rewards.
    await tx.$queryRaw`SELECT "id" FROM "characters" WHERE "userId" = ${input.userId} FOR UPDATE`;
    const character = await tx.character.findUniqueOrThrow({ where: { userId: input.userId } });
    const levelBefore = computeLevelProgress(character.xp, resolvedCurve).level;

    const newXp = Math.max(0, character.xp + xp);
    const newCoins = Math.max(0, character.coins + coins);
    const levelAfter = computeLevelProgress(newXp, resolvedCurve).level;

    await tx.character.update({
      where: { userId: input.userId },
      data: { xp: newXp, coins: newCoins, level: levelAfter },
    });

    const transaction = await tx.rewardTransaction.create({
      data: {
        userId: input.userId,
        source: input.source,
        xp: newXp - character.xp,
        coins: newCoins - character.coins,
        ticketId: input.ticketId ?? undefined,
        eventId: input.eventId ?? undefined,
        category: input.category ?? undefined,
        reason: input.reason ?? undefined,
        provider: input.provider ?? undefined,
        actorType: input.actorType ?? "SYSTEM",
        actorUserId: input.actorUserId ?? undefined,
      },
    });

    return {
      transactionId: transaction.id,
      xp: newXp - character.xp,
      coins: newCoins - character.coins,
      totalXp: newXp,
      totalCoins: newCoins,
      levelBefore,
      levelAfter,
      leveledUp: levelAfter > levelBefore,
    };
  });
}
