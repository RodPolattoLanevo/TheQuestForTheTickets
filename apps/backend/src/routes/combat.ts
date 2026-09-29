import { Router } from "express";
import { getPrismaClient } from "@hunt/database";
import { requireAuth } from "../auth/middleware.js";
import { getOrCreateActiveSession } from "../engine/encounters.js";

const prisma = getPrismaClient();
export const combatRouter = Router();
combatRouter.use(requireAuth);

/**
 * Read-only: there is no "Attack" action. A character's current monster only takes damage
 * as a side effect of closing tickets (see engine/ticketCombat.ts, invoked from the reward
 * pipeline) - this endpoint just reports the current encounter so the UI can render its
 * HP bar and react to it changing after a ticket completes.
 */
combatRouter.get("/current", async (req, res) => {
  const character = await prisma.character.findUniqueOrThrow({ where: { userId: req.auth!.sub } });
  const session = await getOrCreateActiveSession(character.id, character.currentWorldId);
  if (!session) return res.json({ session: null, worldCleared: true });
  res.json({ session });
});
