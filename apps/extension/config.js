// Defaults for local development. Override per-install via the extension's Options page
// (stored in chrome.storage.local as apiUrlOverride/webUrlOverride) - useful once this is
// pointed at a real deployed backend instead of localhost.
export const DEFAULT_API_URL = "https://the-hunt-for-the-tickets-backend.vercel.app";
export const DEFAULT_WEB_URL = "https://the-hunt-for-the-tickets.vercel.app";

export async function getApiUrl() {
  const { apiUrlOverride } = await chrome.storage.local.get("apiUrlOverride");
  return apiUrlOverride || DEFAULT_API_URL;
}

export async function getWebUrl() {
  const { webUrlOverride } = await chrome.storage.local.get("webUrlOverride");
  return webUrlOverride || DEFAULT_WEB_URL;
}

export async function getStoredToken() {
  const { token } = await chrome.storage.local.get("token");
  return token ?? null;
}

export async function setStoredToken(token) {
  if (token) await chrome.storage.local.set({ token });
  else await chrome.storage.local.remove("token");
}

export async function apiFetch(path, options = {}) {
  const [apiUrl, token] = await Promise.all([getApiUrl(), getStoredToken()]);
  const headers = { ...(options.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${apiUrl}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}
