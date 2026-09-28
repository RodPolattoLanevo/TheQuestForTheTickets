import { Router } from "express";
import { z } from "zod";
import { getPrismaClient } from "@hunt/database";
import type { RawTicket, TicketStatus } from "@hunt/shared";
import { requireAuth } from "../auth/middleware.js";
import { getFeatureFlags } from "../engine/gameConfig.js";
import { ingestRawTickets } from "../engine/rewardPipeline.js";

const prisma = getPrismaClient();
export const browserCaptureRouter = Router();
browserCaptureRouter.use(requireAuth);

const VALID_STATUSES = new Set<TicketStatus>(["new", "open", "pending", "hold", "solved", "closed"]);

const ticketSchema = z.object({
  ticketId: z.union([z.string(), z.number()]),
  status: z.string(),
  priority: z.string().optional(),
  type: z.string().optional(),
  group: z.string().optional(),
  updatedAt: z.string().optional(),
});

const bodySchema = z.object({ tickets: z.array(ticketSchema).max(200) });

/**
 * Ingestion endpoint for the Chrome extension's Zendesk content script (spec section 11
 * Option D - see packages/providers/src/browserCaptureProvider.ts for the full design
 * rationale). The employee identity is always the caller's own authenticated account -
 * never trust the client for who a ticket belongs to (spec section 21).
 */
browserCaptureRouter.post("/ingest", async (req, res) => {
  const flags = await getFeatureFlags();
  if (!flags.browserCapture) {
    return res.status(403).json({ error: "Browser capture is disabled. Enable it in Admin -> Game Settings -> Feature Flags." });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const self = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.sub } });

  const raw: RawTicket[] = [];
  for (const t of parsed.data.tickets) {
    const status = t.status.toLowerCase();
    if (!VALID_STATUSES.has(status as TicketStatus)) continue;
    raw.push({
      externalId: String(t.ticketId),
      employeeExternalId: self.email,
      status: status as TicketStatus,
      updatedAt: t.updatedAt ?? new Date().toISOString(),
      fields: { priority: t.priority, type: t.type, group: t.group, source: "browser-capture" },
    });
  }

  const result = await ingestRawTickets("browser-capture", raw);
  res.json(result);
});
