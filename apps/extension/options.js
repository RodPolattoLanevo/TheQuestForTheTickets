import { DEFAULT_API_URL, DEFAULT_WEB_URL } from "./config.js";

const DEFAULT_EXCLUDED_REQUESTERS = ["Emergency Sacoa", "NAKIVO Backup & Replication"];

const apiInput = document.getElementById("apiUrl");
const webInput = document.getElementById("webUrl");
const excludedInput = document.getElementById("excludedRequesters");
const status = document.getElementById("status");

chrome.storage.local.get(["apiUrlOverride", "webUrlOverride", "excludedRequesters"]).then(({ apiUrlOverride, webUrlOverride, excludedRequesters }) => {
  apiInput.value = apiUrlOverride ?? DEFAULT_API_URL;
  webInput.value = webUrlOverride ?? DEFAULT_WEB_URL;
  excludedInput.value = (Array.isArray(excludedRequesters) ? excludedRequesters : DEFAULT_EXCLUDED_REQUESTERS).join("\n");
});

document.getElementById("save").addEventListener("click", async () => {
  const excludedRequesters = excludedInput.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  await chrome.storage.local.set({ apiUrlOverride: apiInput.value, webUrlOverride: webInput.value, excludedRequesters });
  status.textContent = "Saved. Reload any open Zendesk tabs to apply.";
});
