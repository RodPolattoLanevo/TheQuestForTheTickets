import type { RawTicket } from "@hunt/shared";
import { ProviderNotConfiguredError, type TicketDataProvider } from "./types.js";

export interface GoogleSheetsConfig {
  spreadsheetId?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  /** Sheet range holding the ticket rows, e.g. "Tickets!A2:E" */
  range?: string;
}

/**
 * Fallback provider (spec section 11 Option B) for teams that can share a spreadsheet but
 * not grant Zendesk API access. Expects columns: Ticket ID | Employee | Category | Status |
 * Completion Date - same shape as the CSV importer, just fetched from Sheets on an interval
 * instead of uploaded by hand.
 *
 * Requires the `googleapis` package and real service-account credentials to actually call
 * the Sheets API; left as a documented stub here (see GOOGLE_SHEETS_INTEGRATION.md) so the
 * provider architecture is complete without pulling in credentials that don't exist yet.
 */
export class GoogleSheetsProvider implements TicketDataProvider {
  readonly id = "google-sheets";
  readonly displayName = "Google Sheets";

  constructor(private config: GoogleSheetsConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.spreadsheetId && this.config.serviceAccountEmail && this.config.serviceAccountPrivateKey);
  }

  async fetchTickets(): Promise<{ tickets: RawTicket[]; nextCursor?: string | null }> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError(this.id);
    }
    throw new Error(
      "GoogleSheetsProvider is scaffolded but not wired to the Sheets API yet. " +
        "Install `googleapis`, authenticate with the service account, read `config.range`, " +
        "and map each row through the same column logic as parseTicketCsv(). " +
        "See GOOGLE_SHEETS_INTEGRATION.md."
    );
  }
}
