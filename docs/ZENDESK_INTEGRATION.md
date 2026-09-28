# Zendesk Integration

There are two independent ways to connect real Zendesk data, plus a browser-side
fallback. None of them are required to use the platform - see the README.

## Option 1: Zendesk API, polling (recommended)

Implementation: `packages/providers/src/zendeskApiProvider.ts`.

Two ways to authenticate - pick whichever is easier to get:

**API token (easiest - no OAuth app, no admin approval flow beyond enabling the feature):**

1. Zendesk Admin Center → Apps and integrations → APIs → Zendesk API → enable
   "Token access", then "Add API token" (this can be done by anyone with Zendesk admin
   rights; the token itself can belong to any agent account, it doesn't have to be a
   dedicated service account, though that's tidier long-term).
2. Set in `.env`:
   ```
   ZENDESK_SUBDOMAIN=yourcompany        # the part before .zendesk.com
   ZENDESK_API_TOKEN=the-generated-token
   ZENDESK_API_TOKEN_EMAIL=whoever-generated-it@yourcompany.com
   ```

**OAuth (more setup, only worth it if API tokens are disallowed by policy):**

1. Admin Center → Apps and integrations → APIs → Zendesk API → OAuth Clients. Redirect
   URL: the value you'll set for `ZENDESK_OAUTH_REDIRECT_URI`.
2. Request read-only scopes only: `tickets:read`, `users:read`.
3. The authorization-code exchange endpoint isn't wired up yet (see Security notes below)
   - for now, obtain an access token manually (e.g. via Zendesk's OAuth playground/a
     one-off script) and set `ZENDESK_OAUTH_ACCESS_TOKEN` directly. `accessToken` takes
     priority over the API-token fields if both are set.

Either way: set `active_provider` to `zendesk-api` in Admin → Providers & Sync, then click
"Sync now". The provider calls Zendesk's incremental ticket export endpoint
(`/api/v2/incremental/tickets/cursor.json?include=users,groups`), which is cursor-based -
the sync engine stores that cursor in `SyncState` so subsequent syncs never re-download
the full ticket history (spec section 27). The `include=users,groups` side-loads each
ticket's assignee email and group *name* in the same response, which is what makes
employee matching and category rules below work without any extra Zendesk calls.

### Mapping Zendesk fields to game categories

Admin → Category Rules lets you map any of `type` / `group` / `form` / `tags` /
`priority` / `custom_field` (by key) / `status` to a difficulty + XP + coin reward. The
seeded defaults match on `group` - e.g. a rule with `fieldSource: group`,
`operator: equals`, `value: "BR Support LVL1"` - since ticket group is usually the
clearest real-world signal for team/tier (see the table of seeded rules in
`ADMIN_GUIDE.md`). Swap in `priority`, `type`, or anything else that better matches how
your Zendesk is actually organized.

## Option 2: Zendesk Webhook (push), no polling

Implementation: `packages/providers/src/zendeskWebhookProvider.ts`,
`apps/backend/src/routes/webhooks.ts`.

Use this if you can create a Zendesk Trigger but don't want to grant this app general API
access.

1. Set `ZENDESK_WEBHOOK_SECRET` in `.env` to a random string.
2. In Zendesk Admin Center → Webhooks, create a webhook pointing at
   `https://<your-backend>/api/webhooks/zendesk`, with a custom header
   `x-webhook-secret: <the same secret>`.
3. Create a Trigger: "Ticket status changes to Solved" → "Notify active webhook", with a
   JSON body like:
   ```json
   {
     "ticket_id": "{{ticket.id}}",
     "status": "{{ticket.status}}",
     "assignee_email": "{{ticket.assignee.email}}",
     "priority": "{{ticket.priority}}",
     "type": "{{ticket.ticket_type}}",
     "tags": "{{ticket.tags}}",
     "group_name": "{{ticket.group.name}}",
     "updated_at": "{{ticket.updated_at}}",
     "event_id": "{{ticket.id}}-{{ticket.updated_at}}"
   }
   ```
   `group_name` uses Zendesk's own `{{ticket.group.name}}` placeholder, so it's already the
   human-readable group (e.g. "BR Support LVL1") that Category Rules match on - no ID
   lookup needed on either side.
4. Requests without a matching `x-webhook-secret` are rejected with 401. Malformed bodies
   are rejected with 400 before touching the database. Duplicate/retried deliveries are
   naturally absorbed by the same idempotent reward pipeline every provider uses - no
   special-casing needed.

## Option 3: Browser Capture (no Zendesk admin access needed)

Implementation: `packages/providers/src/browserCaptureProvider.ts`,
`apps/backend/src/routes/browserCapture.ts`,
`apps/extension/zendeskContent.js` + `apps/extension/popup.js` + `apps/extension/background.js`.

For teams that don't have (or don't want to deal with) Zendesk admin/API-token access.
Reads **only the ticket rows currently rendered on screen** in whatever list/search view
the agent has open - not a separate query against Zendesk's API. An earlier version of this
called Zendesk's Search API with a broad `assignee:me` filter; that pulled in hundreds of
tickets well beyond what the agent was actually looking at (years of history, automated
monitoring tickets), so it was replaced with this scoped-to-the-screen approach on purpose.
"What you see is what can be synced" - no independently-constructed query to get wrong.

**Currently configured for**: `https://sacoa.zendesk.com` (see `apps/extension/manifest.json`
`content_scripts`/`host_permissions`). To point this at a different subdomain, change both
of those entries to match and reload the unpacked extension.

How it works, end to end:

1. The agent clicks **"🔍 Preview Tickets On Screen"** in the extension popup, with a
   Zendesk ticket list/search tab open. This is a deliberate, explicit action - nothing
   runs automatically in the background.
2. The popup messages `zendeskContent.js` (running in that Zendesk tab), which parses the
   *page's own rendered text* (`document.body.innerText`) for ticket rows: a status word
   ("Solved"/"Closed"/...), the ticket id ("#122295"), and a data row ending in
   ...Requester, Assignee, Group (Zendesk's own tab-separated column layout - the exact
   number of date columns before those three doesn't matter, they're read from the *end*
   of the row). It never calls Zendesk's API and never touches DOM selectors/class names,
   specifically so it keeps working across minor Zendesk UI changes, though it will still
   need updating if Zendesk reorders or removes the Requester/Assignee/Group columns.
3. The content script filters out known automated/system requesters (see below), then
   returns the list to the popup. **Nothing has been submitted yet** - the popup shows
   every ticket it found so the agent can review it.
4. Only after the agent clicks the separate **"⚠️ Submit N ticket(s) for reward"** button
   (with a confirmation dialog) does the popup message the background service worker,
   which POSTs to `POST /api/browser-capture/ingest`, authenticated with the agent's own
   login token for *this* app (from `chrome.storage.local`, set at popup login - never
   sent to or readable by the Zendesk page).
5. The backend route **ignores any employee identity in the request body** and always
   attributes captured tickets to the caller's own authenticated account (spec section 21
   - never trust the client for who a reward belongs to). It's gated behind the
   `browserCapture` feature flag (Admin -> Game Settings -> Feature Flags) and otherwise
   behaves exactly like every other provider: same idempotent `ingestRawTickets()`
   pipeline, same dedupe-by-`(provider, externalId)` guarantees, same combat/achievement
   side effects.

### Excluding automated/system tickets

Real Zendesk instances usually have tickets that are technically "assigned to me" and
"solved" but aren't actual work - automated monitoring alerts (backup job notifications,
uptime alarms) that a trigger auto-creates and auto-solves against a bot/system requester
account. Those shouldn't earn XP, and might well show up in whatever view is on screen.

`zendeskContent.js` filters scraped rows by requester name against an excluded-requesters
list (case-insensitive), before anything reaches the popup - default: `Emergency Sacoa`,
`NAKIVO Backup & Replication`. Edit this list any time from the extension's **Options**
page (right-click the extension icon -> Options), one name per line - no code change or
extension reload needed, just reload any open Zendesk tabs afterward.

Enable it: Admin -> Game Settings -> Feature Flags -> check "browserCapture" (already
enabled on this deployment). Then load the extension (`docs/../README.md` "Chrome
extension" section) and open a Zendesk ticket list while logged into both the extension
and Zendesk.

Because it's a manual, on-demand action scoped to one screen at a time, this is a light
supplement to - not a replacement for - Option 1 (a real polling/webhook connection),
which is the only path that keeps working continuously without anyone opening Zendesk and
clicking anything. If/when API access becomes available, switch `active_provider` to
`zendesk-api` in Admin -> Providers & Sync for the reliable always-on version.

## Field mapping reference

| Game category source | Zendesk field |
|---|---|
| `type` | Ticket type (question/incident/problem/task) |
| `group` | Assigned group's name (e.g. "BR Support LVL1") - the default seeded rules use this |
| `form` | Ticket form |
| `tags` | Ticket tags |
| `priority` | Ticket priority (low/normal/high/urgent) |
| `custom_field` | Any custom ticket field, by field key |
| `status` | Ticket status |

Configure these under Admin → Category Rules; changes apply to the next synced/simulated
ticket immediately, with no deploy.
