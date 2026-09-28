import {
  BrowserCaptureProvider,
  CSVProvider,
  GoogleSheetsProvider,
  MockProvider,
  ZendeskApiProvider,
  ZendeskWebhookProvider,
  type TicketDataProvider,
} from "@hunt/providers";
import { config } from "../config.js";

// Singletons: MockProvider/CSVProvider hold an in-memory queue that must survive across
// requests within one process (simulate now, sync later).
export const mockProvider = new MockProvider();
export const csvProvider = new CSVProvider();
export const zendeskApiProvider = new ZendeskApiProvider({
  subdomain: config.zendesk.subdomain,
  accessToken: config.zendesk.oauthAccessToken, // populated post-OAuth; see routes/integrations.ts (not wired up yet)
  apiToken: config.zendesk.apiToken,
  apiTokenEmail: config.zendesk.apiTokenEmail,
});
export const zendeskWebhookProvider = new ZendeskWebhookProvider(config.zendesk.webhookSecret);
export const googleSheetsProvider = new GoogleSheetsProvider(config.googleSheets);
export const browserCaptureProvider = new BrowserCaptureProvider(config.featureFlags.browserCapture);

const registry: Record<string, TicketDataProvider> = {
  mock: mockProvider,
  csv: csvProvider,
  "zendesk-api": zendeskApiProvider,
  "zendesk-webhook": zendeskWebhookProvider,
  "google-sheets": googleSheetsProvider,
  "browser-capture": browserCaptureProvider,
};

export function getProvider(id: string): TicketDataProvider {
  const provider = registry[id];
  if (!provider) throw new Error(`Unknown provider "${id}"`);
  return provider;
}

export function listProviders(): TicketDataProvider[] {
  return Object.values(registry);
}
