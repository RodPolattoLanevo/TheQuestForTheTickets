import type { RawTicket, TicketStatus } from "@hunt/shared";
import type { TicketDataProvider } from "./types.js";

export interface SimulateTicketInput {
  employeeExternalId: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  /** Zendesk group name (e.g. "BR Support LVL1", "BR Emergency") - what the default seeded category rules match on. */
  group?: string;
  status?: TicketStatus;
  externalId?: string;
  tags?: string[];
  type?: string;
}

/**
 * In-memory provider used for development and demos, and by the `/dev/simulate-ticket`
 * endpoint (spec section 25). Tickets queued here flow through the exact same
 * fetchTickets -> reward pipeline as every other provider - there is no separate
 * "fake" gameplay path.
 */
export class MockProvider implements TicketDataProvider {
  readonly id = "mock";
  readonly displayName = "Mock / Simulated Tickets";
  private queue: RawTicket[] = [];
  private counter = 1;

  isConfigured(): boolean {
    return true;
  }

  simulate(input: SimulateTicketInput): RawTicket {
    const externalId = input.externalId ?? `MOCK-${Date.now()}-${this.counter++}`;
    const ticket: RawTicket = {
      externalId,
      employeeExternalId: input.employeeExternalId,
      status: input.status ?? "solved",
      updatedAt: new Date().toISOString(),
      fields: {
        priority: input.priority ?? "normal",
        type: input.type ?? "question",
        category: input.category ?? "General",
        group: input.group,
        tags: input.tags ?? [],
      },
    };
    this.queue.push(ticket);
    return ticket;
  }

  async fetchTickets(): Promise<{ tickets: RawTicket[]; nextCursor?: string | null }> {
    const tickets = this.queue;
    this.queue = [];
    return { tickets, nextCursor: null };
  }
}
