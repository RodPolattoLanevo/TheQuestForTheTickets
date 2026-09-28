import { getPrismaClient } from "@hunt/database";
import type { ProviderSyncResult } from "@hunt/shared";
import { getProvider } from "../providers/registry.js";
import { ingestRawTickets } from "./rewardPipeline.js";

const prisma = getPrismaClient();

/**
 * Runs one sync cycle for a provider: pulls tickets since its last checkpoint (or from
 * scratch when `full` is set), feeds them through the shared idempotent reward pipeline,
 * and persists the new cursor so the next run is incremental. Never re-downloads/replays
 * the whole ticket history unless a full sync is explicitly requested (spec section 27).
 */
export async function runSync(providerId: string, options: { full?: boolean } = {}): Promise<ProviderSyncResult> {
  const provider = getProvider(providerId);
  const state = await prisma.syncState.upsert({
    where: { provider: providerId },
    update: {},
    create: { provider: providerId, lastStatus: "never_run" },
  });

  const cursor = options.full ? null : state.cursor;

  try {
    const { tickets, nextCursor } = await provider.fetchTickets({ cursor });
    const result = await ingestRawTickets(providerId, tickets);

    await prisma.syncState.update({
      where: { provider: providerId },
      data: {
        cursor: nextCursor ?? state.cursor,
        lastRunAt: new Date(),
        lastStatus: result.errors.length > 0 ? "completed_with_errors" : "success",
        lastError: result.errors.length > 0 ? result.errors.join("; ") : null,
        recordsSeen: { increment: result.ticketsSeen },
      },
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.syncState.update({
      where: { provider: providerId },
      data: { lastRunAt: new Date(), lastStatus: "error", lastError: message },
    });
    throw err;
  }
}

let scheduledTimer: NodeJS.Timeout | null = null;

/** Scheduled sync (spec section 27). Manual sync via the Admin panel calls runSync() directly. */
export function startScheduledSync(providerId: string, intervalMinutes: number) {
  if (scheduledTimer) clearInterval(scheduledTimer);
  if (intervalMinutes <= 0) return;
  scheduledTimer = setInterval(() => {
    runSync(providerId).catch((err) => console.error(`[sync] scheduled run failed for ${providerId}:`, err));
  }, intervalMinutes * 60 * 1000);
}
