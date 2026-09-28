import type { RawTicket } from "@hunt/shared";
import { ProviderNotConfiguredError, type TicketDataProvider } from "./types.js";

export interface ZendeskApiConfig {
  subdomain?: string;
  /** OAuth access token (Bearer) - obtained via the OAuth flow. Prefer this once it's wired up. */
  accessToken?: string;
  /** Simpler alternative to OAuth: an agent/admin-generated API token, used as Basic auth with `email`. */
  apiToken?: string;
  /** The Zendesk account email paired with `apiToken` (e.g. "you@company.com/token" is built from this). */
  apiTokenEmail?: string;
}

interface ZendeskUser {
  id: number;
  email: string | null;
  name: string;
}

interface ZendeskGroup {
  id: number;
  name: string;
}

/**
 * Real Zendesk REST API integration. Requires either an OAuth access token or a simpler
 * API token (Admin Center -> Apps and integrations -> Zendesk API -> enable token access,
 * then Settings -> "Add API token"; no OAuth app registration needed for that path) - see
 * ZENDESK_INTEGRATION.md. Does nothing until credentials are present, so the rest of the
 * app works identically whether or not the team has been granted Zendesk API access
 * (spec section 2 / 35).
 *
 * Scopes requested: read-only (`tickets:read`, `users:read`) - the game never needs to
 * write back to Zendesk.
 */
export class ZendeskApiProvider implements TicketDataProvider {
  readonly id = "zendesk-api";
  readonly displayName = "Zendesk API";

  constructor(private config: ZendeskApiConfig) {}

  isConfigured(): boolean {
    if (!this.config.subdomain) return false;
    return Boolean(this.config.accessToken) || Boolean(this.config.apiToken && this.config.apiTokenEmail);
  }

  private authHeader(): string {
    if (this.config.accessToken) return `Bearer ${this.config.accessToken}`;
    const basic = Buffer.from(`${this.config.apiTokenEmail}/token:${this.config.apiToken}`).toString("base64");
    return `Basic ${basic}`;
  }

  async fetchTickets(params: { cursor?: string | null }): Promise<{ tickets: RawTicket[]; nextCursor?: string | null }> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.id);
    }

    const base = `https://${this.config.subdomain}.zendesk.com/api/v2`;
    // Incremental export endpoint: cheap, cursor-based, exactly what we want for a
    // recurring sync that must never re-download the whole ticket history. `include`
    // side-loads the group/assignee records referenced by this page of tickets, in the
    // same response - no extra round trips needed to resolve group_id -> group name or
    // assignee_id -> assignee email.
    const url = params.cursor
      ? `${base}/incremental/tickets/cursor.json?cursor=${encodeURIComponent(params.cursor)}&include=users,groups`
      : `${base}/incremental/tickets/cursor.json?start_time=0&include=users,groups`;

    const res = await fetch(url, { headers: { Authorization: this.authHeader() } });
    if (!res.ok) {
      throw new Error(`Zendesk API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      tickets: Array<Record<string, unknown>>;
      users?: ZendeskUser[];
      groups?: ZendeskGroup[];
      end_of_stream: boolean;
      after_cursor: string;
    };

    const usersById = new Map((data.users ?? []).map((u) => [u.id, u]));
    const groupsById = new Map((data.groups ?? []).map((g) => [g.id, g]));

    const tickets: RawTicket[] = data.tickets
      .filter((t) => t.status === "solved" || t.status === "closed")
      .map((t) => this.toRawTicket(t, usersById, groupsById));

    return { tickets, nextCursor: data.after_cursor };
  }

  private toRawTicket(t: Record<string, unknown>, usersById: Map<number, ZendeskUser>, groupsById: Map<number, ZendeskGroup>): RawTicket {
    const assignee = usersById.get(Number(t.assignee_id));
    const group = groupsById.get(Number(t.group_id));

    return {
      externalId: String(t.id),
      // Prefer the assignee's email - that's what resolveEmployee() in the reward pipeline
      // matches against. Falls back to the raw numeric id only if the user wasn't
      // side-loaded (e.g. an inactive/deleted agent), in which case a matching User needs
      // its zendeskUserId field set instead.
      employeeExternalId: assignee?.email ?? String(t.assignee_id ?? ""),
      status: (t.status as RawTicket["status"]) ?? "solved",
      updatedAt: String(t.updated_at ?? new Date().toISOString()),
      fields: {
        type: t.type,
        priority: t.priority,
        tags: t.tags,
        // Human-readable group name (e.g. "BR Support LVL1") - this is what Admin ->
        // Category Rules matches on for fieldSource "group", not the raw group_id.
        group: group?.name ?? null,
        form_id: t.ticket_form_id,
        custom_fields: t.custom_fields,
      },
    };
  }
}
