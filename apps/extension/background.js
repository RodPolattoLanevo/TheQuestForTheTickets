import { apiFetch, getStoredToken } from "./config.js";

const ALARM_NAME = "hunt-poll";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) pollAndNotify();
});

// Sent by the popup (popup.js submitZendeskTickets) after the agent has explicitly
// reviewed and confirmed a previewed ticket list - never automatically. This worker holds
// the app's own login token (content scripts/the Zendesk page never see it) and isn't
// bound by Zendesk's CSP, so it's the one place that can actually reach our backend.
// Always responds with the ingest result (or an { error } object) so the popup can show it.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ZENDESK_CAPTURE" && Array.isArray(message.tickets)) {
    handleZendeskCapture(message.tickets).then(sendResponse);
    return true; // keep the message channel open for the async response above
  }
});

async function handleZendeskCapture(tickets) {
  const token = await getStoredToken();
  if (!token) return { error: "Not logged in to the extension - open the popup and sign in first." };

  try {
    const result = await apiFetch("/api/browser-capture/ingest", { method: "POST", body: JSON.stringify({ tickets }) });
    if (result.rewardsGranted > 0) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Zendesk sync complete",
        message: `${result.rewardsGranted} ticket${result.rewardsGranted === 1 ? "" : "s"} rewarded.`,
      });
    }
    await pollAndNotify(); // refresh the badge / catch any level-up right away
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[The Hunt for the Tickets] browser-capture ingest failed:", err);
    return { error: message };
  }
}

async function pollAndNotify() {
  const token = await getStoredToken();
  if (!token) return;

  try {
    const me = await apiFetch("/api/me");
    const { lastKnown } = await chrome.storage.local.get("lastKnown");

    chrome.action.setBadgeText({ text: String(me.level) });
    chrome.action.setBadgeBackgroundColor({ color: "#b8841c" });

    if (lastKnown && me.level > lastKnown.level) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "LEVEL UP!",
        message: `You reached level ${me.level}!`,
      });
    } else if (lastKnown && me.xp > lastKnown.xp) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Ticket Complete!",
        message: `+${me.xp - lastKnown.xp} XP earned.`,
      });
    }

    await chrome.storage.local.set({ lastKnown: { level: me.level, xp: me.xp, coins: me.coins } });
  } catch {
    // Silently ignore - the popup will surface auth/network errors when opened.
  }
}
