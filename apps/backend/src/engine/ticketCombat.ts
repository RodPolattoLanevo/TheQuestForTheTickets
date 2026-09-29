import { getPrismaClient } from "@hunt/database";
import { resolveCombatRound, computeLevelProgress } from "@hunt/game-engine";
import type { TicketCombatOutcome } from "@hunt/shared";
import { getOrCreateActiveSession, advanceWorldIfCleared } from "./encounters.js";
import { getCombatPowerForCharacter, maxHpForLevel } from "./character.js";
import { grantReward } from "./rewards.js";
import { getLevelCurve } from "./gameConfig.js";

const prisma = getPrismaClient();

/**
 * Helldivers-style shared "region liberation" meter: everyone deployed to a region
 * contributes to the SAME pool just by landing hits there, independent of their own
 * personal monster queue. Not capped server-side (a few contributions can land past the
 * target in a race) - callers only ever display min(100, current/target*100), so a little
 * overshoot is harmless and avoids a read-then-write race for something purely cosmetic.
 */
async function contributeToRegionLiberation(worldId: string, amount: number): Promise<number> {
  const world = await prisma.world.update({
    where: { id: worldId },
    data: { liberationCurrent: { increment: amount } },
  });
  return Math.min(100, Math.round((world.liberationCurrent / world.liberationTarget) * 100));
}

/**
 * There is no manual "Attack" button (spec section 7, and per product decision: every
 * monster - not just bosses - only takes damage this way). Every ticket that grants a
 * reward lands exactly one combat round against the character's current monster: stats
 * and equipped gear still matter (they decide how much damage a closed ticket deals), but
 * the only way to actually swing at something is to do the real work. Called once per
 * granted ZENDESK_TICKET reward, right after grantReward() in the reward pipeline.
 *
 * That same hit also counts toward the character's current region's shared liberation
 * meter (see contributeToRegionLiberation above) - personal monster progress and communal
 * region progress move together, off the same action.
 */
export async function resolveTicketCombat(userId: string, ticketExternalId: string): Promise<TicketCombatOutcome> {
  const character = await prisma.character.findUniqueOrThrow({ where: { userId }, include: { stats: true } });
  const session = await getOrCreateActiveSession(character.id, character.currentWorldId);
  if (!session) return { ticketExternalId, attacked: false };

  const [{ power }, curve] = await Promise.all([getCombatPowerForCharacter(character, character.stats!), getLevelCurve()]);
  const level = computeLevelProgress(character.xp, curve).level;
  const playerMaxHp = maxHpForLevel(level, character.stats!.defense);

  const outcome = resolveCombatRound(power, playerMaxHp, {
    hp: session.monsterHp,
    attack: session.monster.attack,
    defense: session.monster.defense,
  });

  const regionLiberationPct = character.currentWorldId
    ? await contributeToRegionLiberation(character.currentWorldId, outcome.playerDamageDealt)
    : undefined;

  if (!outcome.victory) {
    await prisma.combatSession.update({ where: { id: session.id }, data: { monsterHp: outcome.monsterHpRemaining } });
    return {
      ticketExternalId,
      attacked: true,
      monsterName: session.monster.name,
      damageDealt: outcome.playerDamageDealt,
      isCritical: outcome.playerCritical,
      monsterDefeated: false,
      monsterHpRemaining: outcome.monsterHpRemaining,
      regionLiberationPct,
    };
  }

  const monster = session.monster;
  await prisma.combatSession.update({
    where: { id: session.id },
    data: { monsterHp: 0, status: "VICTORY", completedAt: new Date() },
  });

  // Luck grants a chance at bonus coins on top of the monster's base drop - the "loot" moment.
  const bonusCoins = Math.random() < power.rewardBonus ? Math.round(monster.coinReward * 0.5) : 0;

  const reward = await grantReward(
    {
      userId,
      source: "COMBAT",
      xp: monster.xpReward,
      coins: monster.coinReward + bonusCoins,
      reason: `Defeated ${monster.name}${monster.isBoss ? " (Boss)" : ""} by closing ticket ${ticketExternalId}`,
    },
    curve
  );

  await advanceWorldIfCleared(character.id, character.currentWorldId!);

  return {
    ticketExternalId,
    attacked: true,
    monsterName: monster.name,
    damageDealt: outcome.playerDamageDealt,
    isCritical: outcome.playerCritical,
    monsterDefeated: true,
    monsterHpRemaining: 0,
    bossDefeated: monster.isBoss,
    leveledUp: reward.leveledUp,
    levelBefore: reward.levelBefore,
    levelAfter: reward.levelAfter,
    regionLiberationPct,
  };
}
