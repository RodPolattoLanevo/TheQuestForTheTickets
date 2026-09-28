import type { RawTicket } from "@hunt/shared";
import type { TicketDataProvider } from "./types.js";

export interface BrowserCaptureEvent {
  ticketId: string;
  employeeEmail: string;
  status: string;
  priority?: string;
  type?: string;
  /** Group name (e.g. "BR Support LVL1") - what Category Rules match on for fieldSource "group". */
  group?: string;
  capturedAt: string;
}

/**
 * Fallback for teams without Zendesk admin/API-token access (spec section 11 Option D).
 * The Chrome extension's content script (`apps/extension/zendeskContent.js`) runs on the
 * team's own Zendesk domain and calls Zendesk's own REST API - same-origin, using the
 * agent's existing logged-in session cookie, no separate credential ever configured on our
 * side - to read `assignee:me` tickets, then posts a BrowserCaptureEvent per ticket to
 * `POST /api/browser-capture/ingest`.
 *
 * Hard rules, enforced by the extension and re-checked here:
 *  - Never a separate login/credential to Zendesk - only the agent's own already-open
 *    session, scoped by Zendesk itself to what that agent can already see.
 *  - The backend route ignores whatever employee identity the client claims and always
 *    attributes tickets to the caller's own authenticated account (spec section 21) - one
 *    agent can never submit tickets on another agent's behalf.
 *  - Gated behind FEATURE_BROWSER_CAPTURE (default OFF - a team must opt in).
 *  - Treated as advisory input, not an authoritative event stream: same idempotent
 *    ingestRawTickets() pipeline, same dedupe-by-(provider, externalId) guarantees.
 */
export class BrowserCaptureProvider implements TicketDataProvider {
  readonly id = "browser-capture";
  readonly displayName = "Browser Capture (fallback, feature-flagged)";

  constructor(private featureEnabled: boolean) {}

  isConfigured(): boolean {
    return this.featureEnabled;
  }

  toRawTicket(event: BrowserCaptureEvent): RawTicket {
    return {
      externalId: event.ticketId,
      employeeExternalId: event.employeeEmail,
      status: (event.status as RawTicket["status"]) ?? "solved",
      updatedAt: event.capturedAt,
      fields: { priority: event.priority, type: event.type, group: event.group, source: "browser-capture" },
    };
  }

  // Push-only, same as the webhook provider - ingestion happens via a dedicated endpoint.
  async fetchTickets(): Promise<{ tickets: RawTicket[]; nextCursor?: string | null }> {
    return { tickets: [], nextCursor: null };
  }
}
