import crypto from "node:crypto";
import type { RawTicket } from "@hunt/shared";
import type { TicketDataProvider } from "./types.js";

export interface ZendeskWebhookPayload {
  ticket_id: string | number;
  assignee_email?: string;
  assignee_id?: string | number;
  status: string;
  priority?: string;
  type?: string;
  tags?: string[];
  /** The group's human-readable name (Zendesk trigger placeholder `{{ticket.group.name}}`), e.g. "BR Support LVL1" - not the numeric group_id. */
  group_name?: string;
  updated_at?: string;
  event_id?: string; // unique per trigger firing, used for dedupe
}

/**
 * Push-based provider (spec section 11 Option C). Does not implement fetchTickets -
 * a Zendesk trigger posts to POST /api/webhooks/zendesk on every "ticket solved" event,
 * and the route calls `ZendeskWebhookProvider.toRawTicket` then feeds the result into the
 * exact same ingestRawTickets() pipeline every other provider uses.
 */
export class ZendeskWebhookProvider implements TicketDataProvider {
  readonly id = "zendesk-webhook";
  readonly displayName = "Zendesk Webhook (Trigger)";

  constructor(private sharedSecret?: string) {}

  isConfigured(): boolean {
    return Boolean(this.sharedSecret);
  }

  /** Zendesk triggers can be configured to send a custom header carrying this shared secret. */
  verifySignature(providedSecret: string | undefined): boolean {
    if (!this.sharedSecret) return false;
    if (!providedSecret) return false;
    const a = Buffer.from(providedSecret);
    const b = Buffer.from(this.sharedSecret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  toRawTicket(payload: ZendeskWebhookPayload): RawTicket {
    return {
      externalId: String(payload.ticket_id),
      employeeExternalId: String(payload.assignee_email ?? payload.assignee_id ?? ""),
      status: (payload.status as RawTicket["status"]) ?? "solved",
      updatedAt: payload.updated_at ?? new Date().toISOString(),
      eventId: payload.event_id,
      fields: {
        priority: payload.priority,
        type: payload.type,
        tags: payload.tags ?? [],
        // Matches Admin -> Category Rules' fieldSource "group" (a name, e.g. "BR Support
        // LVL1" or "BR Emergency"), not a numeric group_id.
        group: payload.group_name,
      },
    };
  }

  // This provider is push-only; the sync engine never polls it.
  async fetchTickets(): Promise<{ tickets: RawTicket[]; nextCursor?: string | null }> {
    return { tickets: [], nextCursor: null };
  }
}
