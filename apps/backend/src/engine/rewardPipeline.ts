import { getPrismaClient } from "@hunt/database";
import { resolveTicketReward } from "@hunt/game-engine";
import type { ProviderSyncResult, RawTicket } from "@hunt/shared";
import { getActiveCategoryRules, getReopenPolicy } from "./gameConfig.js";
import { grantReward } from "./rewards.js";
import { refreshProgressForUser } from "./progress.js";
import { addTeamEventDamage } from "./teamEvents.js";
import { resolveTicketCombat } from "./ticketCombat.js";

const prisma = getPrismaClient();

const SOLVED_STATUSES = new Set(["solved", "closed"]);

async function resolveEmployee(externalId: string): Promise<string | null> {
  const needle = externalId.trim();
  if (!needle) return null;

  const byZendeskId = await prisma.user.findFirst({ where: { zendeskUserId: needle } });
  if (byZendeskId) return byZendeskId.id;

  const byEmail = await prisma.user.findFirst({ where: { email: { equals: needle, mode: "insensitive" } } });
  if (byEmail) return byEmail.id;

  const byDisplayName = await prisma.user.findFirst({ where: { displayName: { equals: needle, mode: "insensitive" } } });
  if (byDisplayName) return byDisplayName.id;

  return null;
}

/**
 * The single ingestion path every TicketDataProvider funnels through. Idempotent by
 * design (spec section 10):
 *   - Tickets are keyed by (provider, externalId); re-syncing an already-solved ticket
 *     with no status change is a no-op.
 *   - A ticket that goes Solved -> Open -> Solved again is governed by the configurable
 *     reopen policy (ignore / new_completion / manual_review), defaulting to "ignore" to
 *     block farming.
 *   - Every transition is recorded as a TicketEvent for audit purposes even when no
 *     reward is granted, so disputes are debuggable.
 */
export async function ingestRawTickets(provider: string, rawTickets: RawTicket[]): Promise<ProviderSyncResult> {
  const result: ProviderSyncResult = {
    provider,
    ticketsSeen: 0,
    eventsCreated: 0,
    rewardsGranted: 0,
    errors: [],
    combatOutcomes: [],
    unlockedAchievements: [],
  };
  const [rules, reopenPolicy] = await Promise.all([getActiveCategoryRules(), getReopenPolicy()]);

  for (const raw of rawTickets) {
    result.ticketsSeen += 1;
    try {
      await processTicket(raw, provider, rules, reopenPolicy, result);
    } catch (err) {
      result.errors.push(`${raw.externalId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

async function processTicket(
  raw: RawTicket,
  provider: string,
  rules: Awaited<ReturnType<typeof getActiveCategoryRules>>,
  reopenPolicy: Awaited<ReturnType<typeof getReopenPolicy>>,
  result: ProviderSyncResult
) {
  const existing = await prisma.ticket.findUnique({ where: { provider_externalId: { provider, externalId: raw.externalId } } });
  const previousStatus = existing?.status ?? null;
  const userId = existing?.userId ?? (await resolveEmployee(raw.employeeExternalId));

  const ticket = await prisma.ticket.upsert({
    where: { provider_externalId: { provider, externalId: raw.externalId } },
    update: {
      status: raw.status,
      lastSeenAt: new Date(),
      rawFields: JSON.stringify(raw.fields),
      userId: userId ?? existing?.userId,
      employeeExternalId: raw.employeeExternalId,
    },
    create: {
      provider,
      externalId: raw.externalId,
      employeeExternalId: raw.employeeExternalId,
      userId: userId ?? undefined,
      status: raw.status,
      category: (raw.fields.category as string) ?? null,
      rawFields: JSON.stringify(raw.fields),
    },
  });

  const isNowSolved = SOLVED_STATUSES.has(raw.status);
  const wasSolved = previousStatus ? SOLVED_STATUSES.has(previousStatus) : false;

  // No relevant transition (e.g. open->open resync, or solved->solved resync): nothing to
  // do UNLESS this ticket was solved but still has no matched employee - keep retrying
  // employee resolution on every sync rather than permanently giving up just because an
  // admin hadn't linked the account yet at the time it first synced.
  const pendingEmployeeResolution = isNowSolved && !ticket.userId && ticket.solvedCount === 0;
  if (isNowSolved === wasSolved && !pendingEmployeeResolution) return;

  if (!isNowSolved && wasSolved) {
    // Solved -> reopened. Record it, but never reward it.
    await createEvent(ticket.id, raw.eventId, "reopened", true, "reopened_no_reward");
    result.eventsCreated += 1;
    return;
  }

  // Now solved and wasn't before: this is a completion.
  const isRepeatCompletion = ticket.solvedCount > 0;
  let skippedReason: string | undefined;

  if (isRepeatCompletion) {
    if (reopenPolicy === "ignore") skippedReason = "reopen_policy_ignore";
    else if (reopenPolicy === "manual_review") skippedReason = "pending_manual_review";
    // "new_completion" falls through and rewards normally.
  }

  if (skippedReason) {
    await createEvent(ticket.id, raw.eventId, "solved", true, skippedReason);
    result.eventsCreated += 1;
    return;
  }

  if (!ticket.userId) {
    await createEvent(ticket.id, raw.eventId, "solved", true, "unresolved_employee");
    result.eventsCreated += 1;
    result.errors.push(`${raw.externalId}: no matching user for employee identifier "${raw.employeeExternalId}"`);
    return;
  }

  const reward = resolveTicketReward(raw, rules);
  const event = await createEvent(ticket.id, raw.eventId, "solved", true, null, true);
  result.eventsCreated += 1;

  // Independent of each other - granting the ticket's XP/coins doesn't need to wait on the
  // solvedCount bump, or vice versa.
  await Promise.all([
    grantReward({
      userId: ticket.userId,
      source: "ZENDESK_TICKET",
      xp: reward.xp,
      coins: reward.coins,
      ticketId: ticket.id,
      eventId: event.id,
      category: reward.difficulty,
      provider,
      reason: `Ticket ${raw.externalId} (${reward.difficulty})`,
    }),
    prisma.ticket.update({ where: { id: ticket.id }, data: { solvedCount: { increment: 1 } } }),
  ]);
  result.rewardsGranted += 1;

  // There is no manual "Attack" button - closing this ticket IS the attack. Resolved before
  // refreshProgressForUser() below so boss/monster-kill achievements and quests see it.
  const combatOutcome = await resolveTicketCombat(ticket.userId, raw.externalId);
  result.combatOutcomes.push(combatOutcome);

  // Team-event damage and achievement/quest progress don't depend on each other either.
  const [, { unlockedAchievements }] = await Promise.all([
    addTeamEventDamage(ticket.userId, reward.xp),
    refreshProgressForUser(ticket.userId),
  ]);
  result.unlockedAchievements.push(...unlockedAchievements);
}

async function createEvent(
  ticketId: string,
  externalEventId: string | undefined,
  eventType: string,
  processed: boolean,
  skippedReason: string | null,
  rewardGranted = false
) {
  // externalEventId is only guaranteed unique when the source provides one (webhooks).
  // For poll-based providers we synthesize one so re-processing the same sync batch twice
  // (e.g. a retried request) can't double-create events for the same transition.
  const key = externalEventId ?? `${eventType}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  return prisma.ticketEvent.create({
    data: { ticketId, externalEventId: key, eventType, processed, rewardGranted, skippedReason: skippedReason ?? undefined },
  });
}
