import { parse } from "csv-parse/sync";
import type { RawTicket } from "@hunt/shared";
import type { TicketDataProvider } from "./types.js";

export interface CsvRowError {
  row: number;
  message: string;
  raw: Record<string, string>;
}

export interface CsvParseResult {
  valid: RawTicket[];
  invalid: CsvRowError[];
}

// Accepts flexible header naming so a raw Zendesk export or a hand-built sheet both work.
const HEADER_ALIASES: Record<string, string[]> = {
  ticket_id: ["ticket_id", "ticketid", "id", "ticket #", "ticket"],
  employee: ["employee", "assignee", "agent"],
  category: ["category", "type"],
  status: ["status"],
  priority: ["priority"],
  completed_at: ["completed_at", "closed_at", "solved_at", "closed/solved date", "solved date", "closed date"],
};

function findColumn(headerRow: string[], aliases: string[]): string | null {
  const lower = headerRow.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) return headerRow[idx];
  }
  return null;
}

/**
 * Parses a CSV export (spec section 11 Option A / section 26) into normalized RawTickets.
 * Pure/synchronous and side-effect free - the backend import route runs this once for a
 * preview (no DB writes) and again to commit, guaranteeing preview and commit always agree.
 */
export function parseTicketCsv(content: string): CsvParseResult {
  const records: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const valid: RawTicket[] = [];
  const invalid: CsvRowError[] = [];

  if (records.length === 0) {
    return { valid, invalid };
  }

  const headerRow = Object.keys(records[0]);
  const col = {
    ticket_id: findColumn(headerRow, HEADER_ALIASES.ticket_id),
    employee: findColumn(headerRow, HEADER_ALIASES.employee),
    category: findColumn(headerRow, HEADER_ALIASES.category),
    status: findColumn(headerRow, HEADER_ALIASES.status),
    priority: findColumn(headerRow, HEADER_ALIASES.priority),
    completed_at: findColumn(headerRow, HEADER_ALIASES.completed_at),
  };

  records.forEach((raw, index) => {
    const rowNum = index + 2; // +1 for header, +1 for 1-based indexing
    const ticketId = col.ticket_id ? raw[col.ticket_id] : undefined;
    const employee = col.employee ? raw[col.employee] : undefined;
    const status = (col.status ? raw[col.status] : undefined)?.toLowerCase();

    if (!ticketId) {
      invalid.push({ row: rowNum, message: "Missing ticket id", raw });
      return;
    }
    if (!employee) {
      invalid.push({ row: rowNum, message: "Missing employee/assignee", raw });
      return;
    }
    if (!status || !["solved", "closed", "open", "pending", "hold", "new"].includes(status)) {
      invalid.push({ row: rowNum, message: `Missing or unrecognized status: "${status ?? ""}"`, raw });
      return;
    }

    valid.push({
      externalId: ticketId,
      employeeExternalId: employee,
      status: status as RawTicket["status"],
      updatedAt: (col.completed_at ? raw[col.completed_at] : undefined) || new Date().toISOString(),
      fields: {
        category: col.category ? raw[col.category] : undefined,
        priority: (col.priority ? raw[col.priority] : undefined)?.toLowerCase(),
        type: col.category ? raw[col.category] : undefined,
      },
    });
  });

  return { valid, invalid };
}

/**
 * CSVProvider wraps parseTicketCsv behind the TicketDataProvider interface so the sync
 * engine can treat "the admin uploaded a file" the same as any polling provider: load a
 * file once via `loadContent`, then a normal fetchTickets drains it through the pipeline.
 */
export class CSVProvider implements TicketDataProvider {
  readonly id = "csv";
  readonly displayName = "CSV Import";
  private pending: RawTicket[] = [];

  isConfigured(): boolean {
    return true;
  }

  loadContent(content: string): CsvParseResult {
    const result = parseTicketCsv(content);
    this.pending.push(...result.valid);
    return result;
  }

  async fetchTickets(): Promise<{ tickets: RawTicket[]; nextCursor?: string | null }> {
    const tickets = this.pending;
    this.pending = [];
    return { tickets, nextCursor: null };
  }
}
