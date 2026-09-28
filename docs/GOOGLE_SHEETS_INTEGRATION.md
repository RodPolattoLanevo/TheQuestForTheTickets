# Google Sheets Integration

Fallback provider for teams that can share a spreadsheet but can't grant Zendesk API
access or create a trigger. Implementation:
`packages/providers/src/googleSheetsProvider.ts`.

## Sheet format

Same shape as [CSV import](CSV_IMPORT.md) - one row per completed ticket:

| Ticket ID | Employee | Category | Status | Completion Date |
|---|---|---|---|---|
| 1001 | john@company.com | Technical | Solved | 2026-09-25T08:30:00 |

## Setup

1. Create a Google Cloud service account with the Sheets API enabled.
2. Share the spreadsheet with the service account's email (view access is enough).
3. Set in `.env`:
   ```
   GOOGLE_SHEETS_SPREADSHEET_ID=...
   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   (Keep the literal `\n` sequences in the private key when pasting into `.env` - the app
   reads it as a raw string.)

## Current status

`GoogleSheetsProvider.isConfigured()` correctly reports whether credentials are present,
and it's wired into the same provider registry, sync engine, and Admin → Providers tab as
every other provider (pick it as the active provider, trigger a sync). The actual Sheets
API call (`fetchTickets`) is intentionally left as a clear, documented stub rather than
adding a `googleapis` dependency and real service-account credentials that don't exist in
this environment yet:

```ts
// packages/providers/src/googleSheetsProvider.ts
async fetchTickets() {
  if (!this.isConfigured()) throw new ProviderNotConfiguredError(this.id);
  throw new Error("GoogleSheetsProvider is scaffolded but not wired to the Sheets API yet...");
}
```

To finish it: install `googleapis`, authenticate with
`google.auth.JWT(serviceAccountEmail, undefined, privateKey, ["https://www.googleapis.com/auth/spreadsheets.readonly"])`,
call `sheets.spreadsheets.values.get({ spreadsheetId, range })`, and map each row through
the same column-detection logic already written and tested in
`packages/providers/src/csvProvider.ts` (`parseTicketCsv`) - the row shape is identical,
so that function can likely be reused almost as-is against an array of arrays instead of
a CSV string.
