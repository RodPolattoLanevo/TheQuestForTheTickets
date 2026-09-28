// Runs on the team's Zendesk domain (see manifest.json "matches"). Reads ONLY the ticket
// rows currently rendered on screen - whatever list/search/view the agent has open right
// now - by parsing the page's own rendered text. It does NOT call Zendesk's API and does
// NOT construct its own search query, on purpose: an earlier version used the Search API
// with a broad `assignee:me` query, which pulled in tickets well beyond what the agent was
// actually looking at (hundreds of historical/automated ones). Reading the visible table
// instead means "what you see is what gets synced" - no separate query to get wrong.
//
// Never touches Zendesk credentials or session - it only reads text that's already
// rendered in the agent's own, already-authorized tab. See
// packages/providers/src/browserCaptureProvider.ts for the full design rationale and
// docs/ZENDESK_INTEGRATION.md "Option 3" for how this fits into the bigger picture.

const LOG_PREFIX = "[The Hunt for the Tickets]";
const STATUSES = new Set(["new", "open", "pending", "hold", "solved", "closed"]);

// Requesters whose tickets never count as real work - automated monitoring/alert accounts
// (backup job notifications, duplicate "Emergency" system tickets, etc), matched case-
// insensitively. Editable from the extension's Options page (stored under
// "excludedRequesters") without touching this file - these two are just the starting
// defaults, still applied as a safety net even though this now only reads what's on screen.
const DEFAULT_EXCLUDED_REQUESTERS = ["Emergency Sacoa", "NAKIVO Backup & Replication"];

async function getExcludedRequesters() {
  const { excludedRequesters } = await chrome.storage.local.get("excludedRequesters");
  const list = Array.isArray(excludedRequesters) ? excludedRequesters : DEFAULT_EXCLUDED_REQUESTERS;
  return new Set(list.map((s) => s.trim().toLowerCase()).filter(Boolean));
}

/**
 * Parses ticket rows out of the page's rendered text. Zendesk's ticket list/search table
 * renders each row as: a status word ("Solved"/"Closed"/...), then the ticket id
 * ("#122295"), then the subject, then a tab-separated line of columns ending in
 * ...Requester, Assignee, Group (however many date columns precede those three stays
 * consistent, so they're addressed from the *end* of the row, not a fixed column count).
 * This is text-pattern matching, not a CSS-selector scrape, specifically so it keeps
 * working across minor markup changes - though it will still need updating if Zendesk
 * changes the table's column order or drops one of Requester/Assignee/Group.
 */
function scrapeVisibleTickets() {
  const lines = document.body.innerText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tickets = [];
  const seenIds = new Set();

  for (let i = 0; i < lines.length; i++) {
    const idMatch = lines[i].match(/^#(\d+)$/);
    if (!idMatch) continue;
    const ticketId = idMatch[1];
    if (seenIds.has(ticketId)) continue;

    let status = null;
    for (let k = i - 1; k >= Math.max(0, i - 3) && !status; k--) {
      if (STATUSES.has(lines[k].toLowerCase())) status = lines[k].toLowerCase();
    }
    if (!status) continue; // no recognizable status nearby - not a ticket row we understand

    let group;
    let requester;
    for (let k = i + 1; k <= Math.min(lines.length - 1, i + 5); k++) {
      const cols = lines[k]
        .split("\t")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cols.length >= 3) {
        group = cols[cols.length - 1]; // last column
        requester = cols[cols.length - 3]; // Requester is always 2 before Group, Assignee 1 before
        break;
      }
    }

    seenIds.add(ticketId);
    tickets.push({ ticketId, status, group, requester });
  }

  return tickets;
}

// Triggered from the extension popup's "Preview Zendesk Tickets" button. Read-only - it
// never submits anything for reward by itself. The popup shows what was found and only
// submits it to the backend after an explicit second click + confirmation.
async function runManualPreview() {
  try {
    const excludedSet = await getExcludedRequesters();
    const all = scrapeVisibleTickets();
    const tickets = all.filter((t) => {
      const name = t.requester?.toLowerCase();
      return !(name && excludedSet.has(name));
    });
    console.info(`${LOG_PREFIX} found ${tickets.length} ticket(s) on screen (${all.length - tickets.length} excluded):`, tickets);
    return { tickets };
  } catch (err) {
    console.warn(`${LOG_PREFIX} preview failed:`, err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CAPTURE_NOW") {
    runManualPreview().then(sendResponse);
    return true; // keep the message channel open for the async response above
  }
});
