import { Router } from "express";
import { z } from "zod";
import { zendeskWebhookProvider } from "../providers/registry.js";
import { ingestRawTickets } from "../engine/rewardPipeline.js";

export const webhooksRouter = Router();

const payloadSchema = z.object({
  ticket_id: z.union([z.string(), z.number()]),
  status: z.string(),
  assignee_email: z.string().optional(),
  assignee_id: z.union([z.string(), z.number()]).optional(),
  priority: z.string().optional(),
  type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  group_name: z.string().optional(),
  updated_at: z.string().optional(),
  event_id: z.string().optional(),
});

/**
 * Spec section 11 Option C: a Zendesk trigger posts here whenever a ticket is solved.
 * Requests must carry the shared secret configured in ZENDESK_WEBHOOK_SECRET (as a custom
 * trigger header) - anything else is rejected outright. Malformed bodies are rejected
 * before touching the database; duplicates are naturally absorbed by the idempotent
 * reward pipeline (same (provider, ticket_id) + status-transition logic as every other
 * provider), so a Zendesk retry can never double-reward an agent.
 */
webhooksRouter.post("/zendesk", async (req, res) => {
  if (!zendeskWebhookProvider.isConfigured()) {
    return res.status(503).json({ error: "Zendesk webhook provider is not configured (ZENDESK_WEBHOOK_SECRET unset)" });
  }
  const signature = req.header("x-webhook-secret");
  if (!zendeskWebhookProvider.verifySignature(signature)) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Malformed webhook payload", details: parsed.error.flatten() });
  }

  const raw = zendeskWebhookProvider.toRawTicket(parsed.data);
  const result = await ingestRawTickets("zendesk-webhook", [raw]);
  res.status(200).json(result);
});
