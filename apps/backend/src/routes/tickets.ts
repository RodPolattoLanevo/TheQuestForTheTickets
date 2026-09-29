import { Router } from "express";
import { z } from "zod";
import { getPrismaClient } from "@hunt/database";
import { requireAuth } from "../auth/middleware.js";
import { mockProvider } from "../providers/registry.js";
import { runSync } from "../engine/sync.js";

const prisma = getPrismaClient();
export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

const simulateSchema = z.object({
  employee: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  group: z.string().optional(),
  status: z.enum(["new", "open", "pending", "hold", "solved", "closed"]).optional(),
  type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Optional so callers (tests, or a demo wanting to show reopen/re-solve behavior) can
  // simulate multiple events against the *same* ticket id instead of always getting a
  // brand-new one - this is what lets the idempotency/reopen-policy logic be exercised.
  externalId: z.string().optional(),
});

/**
 * Spec section 25 (Mock Mode): generates a ticket event and runs it through the exact same
 * ingestRawTickets() pipeline every real provider uses - no separate fake gameplay path.
 * Employees can only simulate for themselves; admins may simulate on behalf of anyone
 * (useful for demos and testing category-rule changes end to end).
 */
ticketsRouter.post("/dev/simulate-ticket", async (req, res) => {
  const parsed = simulateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let employeeExternalId = parsed.data.employee;
  if (req.auth!.role !== "ADMIN" || !employeeExternalId) {
    const self = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.sub } });
    employeeExternalId = self.email;
  }

  mockProvider.simulate({ ...parsed.data, employeeExternalId });
  const syncResult = await runSync("mock");

  // The frontend (Dashboard.tsx) doesn't read this field - it refreshes via GET /api/me
  // right after - so this is intentionally a minimal projection (1 query), not the full
  // buildCharacterSummary() (~6 queries: level curve, equipped items, active combat
  // session, recent transactions). Kept only because the e2e test suite asserts on
  // response.character.xp/coins as a quick sanity check without a second round trip.
  const character = await prisma.character.findUniqueOrThrow({
    where: { userId: req.auth!.sub },
    select: { xp: true, coins: true, level: true },
  });

  res.json({ syncResult, character });
});
