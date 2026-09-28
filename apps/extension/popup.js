import { apiFetch, getStoredToken, setStoredToken, getWebUrl } from "./config.js";

const app = document.getElementById("app");

async function render() {
  const token = await getStoredToken();
  if (!token) return renderLogin();

  try {
    const [me, quests] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/quests").catch(() => [])]);
    renderCharacter(me, quests);
  } catch (err) {
    await setStoredToken(null);
    renderLogin(err.message);
  }
}

function renderLogin(error) {
  app.innerHTML = `
    <h1>⚔ The Hunt for the Tickets</h1>
    ${error ? `<p class="error">${error}</p>` : ""}
    <input id="email" type="email" placeholder="Email" />
    <input id="password" type="password" placeholder="Password" />
    <button id="loginBtn">Sign in</button>
    <p style="font-size:11px;color:#6f6489;text-align:center;">Sign in with your existing account. New accounts are created on the full game website.</p>
  `;
  document.getElementById("loginBtn").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      const res = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      await setStoredToken(res.token);
      render();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function renderCharacter(me, quests) {
  const pct = me.xpForNextLevel > 0 ? Math.min(100, Math.round((me.xpIntoLevel / me.xpForNextLevel) * 100)) : 100;
  const activeQuest = quests.find((q) => !q.completed) ?? quests[0];

  app.innerHTML = `
    <h1>⚔ ${me.user.displayName}</h1>
    <div class="row"><span>Level ${me.level}</span><span>${me.xpIntoLevel} / ${me.xpForNextLevel} XP</span></div>
    <div class="xp-track"><div class="xp-fill" style="width:${pct}%"></div></div>
    <div class="row"><span>Coins</span><span class="coins">${me.coins.toLocaleString()} 🪙</span></div>
    <div class="row"><span>World</span><span>${me.world?.name ?? "-"}</span></div>

    ${
      activeQuest
        ? `<div class="card">
            <strong style="font-size:12px;">Current Quest</strong>
            <div style="font-size:11px;color:#c9c0dd;margin-top:4px;">${activeQuest.name} (${activeQuest.progress}/${JSON.parse(activeQuest.criteria).target})</div>
          </div>`
        : ""
    }

    <div class="card">
      <strong style="font-size:12px;">Recent Rewards</strong>
      ${
        me.recentTransactions
          .slice(0, 4)
          .map((t) => `<div class="ticket-item">${t.ticket ? `Ticket #${t.ticket.externalId}` : t.reason ?? t.source} — +${t.xp} XP / +${t.coins} coins</div>`)
          .join("") || '<div class="ticket-item">No activity yet.</div>'
      }
    </div>

    <button class="secondary" id="previewZendeskBtn">🔍 Preview Tickets On Screen</button>
    <p style="font-size:10px;color:#6f6489;margin:-4px 0 8px;">Reads only the tickets currently visible in your Zendesk tab - not your whole history.</p>
    <div id="syncResults"></div>

    <a class="link" id="openGame" href="#">Open Full Game →</a>
    <button class="secondary" id="logoutBtn">Log out</button>
  `;

  document.getElementById("openGame").addEventListener("click", async (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: await getWebUrl() });
  });
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await setStoredToken(null);
    render();
  });
  document.getElementById("previewZendeskBtn").addEventListener("click", previewZendeskTickets);
}

const errorItem = (msg) => `<div class="ticket-item" style="color:#ff8a5c;">${msg}</div>`;

// Split into two explicit steps on purpose: this one only READS whatever ticket rows are
// currently rendered in the Zendesk tab (no API call, no query of our own construction -
// see zendeskContent.js) and never submits anything for reward by itself. An earlier
// version queried Zendesk's Search API instead and pulled in hundreds of tickets well
// beyond what was actually on screen, including automated/historical ones - this is scoped
// to exactly what you're looking at.
async function previewZendeskTickets() {
  const resultsEl = document.getElementById("syncResults");
  resultsEl.innerHTML = '<div class="ticket-item">Looking for an open Zendesk tab...</div>';

  try {
    const tabs = await chrome.tabs.query({ url: "https://sacoa.zendesk.com/*" });
    if (tabs.length === 0) {
      resultsEl.innerHTML = errorItem("No Zendesk tab open. Open sacoa.zendesk.com in a tab, then try again.");
      return;
    }

    resultsEl.innerHTML = '<div class="ticket-item">Reading the ticket list currently on screen (read-only, nothing submitted yet)...</div>';
    const response = await chrome.tabs.sendMessage(tabs[0].id, { type: "CAPTURE_NOW" });

    if (!response) {
      resultsEl.innerHTML = errorItem("No response from the Zendesk tab - reload that tab (needed once after installing/updating the extension) and try again.");
      return;
    }
    if (response.error) {
      resultsEl.innerHTML = errorItem(`Error reading Zendesk: ${response.error}`);
      return;
    }

    const { tickets } = response;
    if (!tickets || tickets.length === 0) {
      resultsEl.innerHTML = '<div class="ticket-item">Found 0 recognizable ticket rows on screen. Make sure a ticket list/search table is visible in the Zendesk tab.</div>';
      return;
    }

    const list = tickets
      .map(
        (t) =>
          `<div class="ticket-item">#${t.ticketId} — ${t.status}${t.group ? ` — ${t.group}` : " — (no group)"}${
            t.requester ? ` — ${t.requester}` : ""
          }</div>`
      )
      .join("");

    resultsEl.innerHTML = `
      <div class="ticket-item">Found <strong>${tickets.length}</strong> ticket(s). Nothing submitted yet - review the list, then confirm below.</div>
      ${list}
      <button class="secondary" id="submitZendeskBtn" style="margin-top:8px;">⚠️ Submit ${tickets.length} ticket(s) for reward</button>
    `;
    document.getElementById("submitZendeskBtn").addEventListener("click", () => showSubmitConfirmation(tickets));
  } catch (err) {
    resultsEl.innerHTML = errorItem(err.message ?? String(err));
  }
}

// Native window.confirm()/alert() are unreliable inside an extension popup - the popup can
// lose focus and get torn down the moment a native dialog tries to open, silently killing
// everything after it (this is exactly what "click Submit and nothing happens" was). An
// in-page confirmation avoids that entirely.
function showSubmitConfirmation(tickets) {
  const resultsEl = document.getElementById("syncResults");
  resultsEl.innerHTML = `
    <div class="ticket-item" style="color:#f4c95d;">
      Submit ${tickets.length} ticket(s) for reward? If any have never been synced before,
      this grants real XP/coins for all of them right now. This can't be undone (though
      Admin -> Grant/Remove/Reset can fix XP/coins afterward).
    </div>
    <button id="confirmSubmitBtn" style="margin-top:8px;">Yes, submit ${tickets.length} ticket(s)</button>
    <button class="secondary" id="cancelSubmitBtn">Cancel</button>
  `;
  document.getElementById("confirmSubmitBtn").addEventListener("click", () => submitZendeskTickets(tickets));
  document.getElementById("cancelSubmitBtn").addEventListener("click", () => {
    resultsEl.innerHTML = '<div class="ticket-item">Cancelled - nothing submitted.</div>';
  });
}

async function submitZendeskTickets(tickets) {
  const resultsEl = document.getElementById("syncResults");
  resultsEl.innerHTML = '<div class="ticket-item">Submitting...</div>';

  try {
    const syncResult = await chrome.runtime.sendMessage({ type: "ZENDESK_CAPTURE", tickets });
    if (!syncResult) {
      resultsEl.innerHTML = errorItem("No response from the background worker.");
      return;
    }
    if (syncResult.error) {
      resultsEl.innerHTML = errorItem(syncResult.error);
      return;
    }
    // Deliberately NOT calling render() here - it rebuilds the whole popup (including this
    // results panel), which would wipe this message out right after showing it and look
    // exactly like "nothing happened" even on a successful submit.
    resultsEl.innerHTML = `<div class="ticket-item"><strong>${syncResult.rewardsGranted}</strong> new reward(s) granted out of ${syncResult.ticketsSeen} ticket(s) seen.${
      syncResult.errors?.length ? ` ${syncResult.errors.length} error(s) - see backend logs.` : ""
    }</div><div class="ticket-item">Close and reopen the popup (or check the dashboard) to see your updated XP/coins above.</div>`;
  } catch (err) {
    resultsEl.innerHTML = errorItem(err.message ?? String(err));
  }
}

render();
