import type { ProviderSyncResult, RawTicket } from "@hunt/shared";

/**
 * Every integration method (Zendesk API, webhook, CSV, Google Sheets, browser capture,
 * mock) implements this same interface. The sync engine and reward pipeline only ever
 * talk to `TicketDataProvider` - they never know or care which concrete source is active.
 * This is what lets the game run fully on MockProvider/CSVProvider before Zendesk
 * API/admin access is ever granted.
 */
export interface TicketDataProvider {
  readonly id: string;
  readonly displayName: string;
  /** True when this provider has everything it needs (credentials, config) to run. */
  isConfigured(): boolean;
  /**
   * Pulls tickets since `cursor` (incremental) or everything when `cursor` is null/undefined
   * (full sync). Push-based providers (webhook, browser capture) return an empty result here -
   * they ingest via their own endpoint instead, using the same shared reward pipeline.
   */
  fetchTickets(params: { cursor?: string | null }): Promise<{ tickets: RawTicket[]; nextCursor?: string | null }>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(providerId: string) {
    super(`Provider "${providerId}" is not configured. Set the required environment variables or complete setup in the Admin panel.`);
    this.name = "ProviderNotConfiguredError";
  }
}

export function emptySyncResult(provider: string): ProviderSyncResult {
  return { provider, ticketsSeen: 0, eventsCreated: 0, rewardsGranted: 0, errors: [], combatOutcomes: [], unlockedAchievements: [] };
}
