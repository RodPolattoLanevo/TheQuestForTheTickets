# CSV Import

The most Zendesk-access-free way to get real ticket history into the game: export a
report from Zendesk (or build one by hand) and upload it from Admin → CSV Import.

## Expected columns

Flexible header matching (case-insensitive, common aliases accepted):

| Required | Column | Accepted header names |
|---|---|---|
| Yes | Ticket ID | `ticket_id`, `ticketid`, `id`, `ticket #`, `ticket` |
| Yes | Employee | `employee`, `assignee`, `agent` (matched against a User's email, then display name) |
| Yes | Status | `status` (must be one of new/open/pending/hold/solved/closed) |
| No | Category | `category`, `type` |
| No | Priority | `priority` |
| No | Completion date | `completed_at`, `closed_at`, `solved_at`, `closed/solved date`, `solved date`, `closed date` |

Example:

```csv
ticket_id,employee,category,status,completed_at
1001,john@company.com,Technical,Solved,2026-09-25T08:30:00
1002,mary@company.com,Billing,Solved,2026-09-25T08:35:00
```

## Import flow

1. Admin → CSV Import → choose file → **Preview**. This parses and validates the file
   (`parseTicketCsv` in `packages/providers/src/csvProvider.ts`) without writing anything
   to the database - it shows valid rows with their computed reward (using your current
   Category Rules) and invalid rows with the reason they were rejected.
2. Review, then **Confirm Import**. This re-parses the same file and runs every valid row
   through `ingestRawTickets("csv", ...)` - the identical reward pipeline used by every
   other provider, including idempotency: re-importing the same file twice does not
   double-reward already-solved tickets (matched by ticket ID).
3. The result shows tickets seen, rewards granted, and any errors (e.g. an employee
   identifier that didn't match any user - fix the CSV or create that employee's account
   first, then re-import; already-processed rows are skipped automatically).

## Employee matching

The `employee` column is matched against, in order: an exact `zendeskUserId`, then case-
insensitive email, then case-insensitive display name. Rows that can't be matched are
recorded (so the ticket exists for later reconciliation) but no reward is granted until
an admin resolves the identity (e.g. by creating the employee's account with a matching
email) and re-syncs.
