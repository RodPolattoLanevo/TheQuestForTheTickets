import express from "express";
import cors from "cors";
import "express-async-errors"; // lets thrown/rejected errors in async route handlers reach the error middleware below
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { ticketsRouter } from "./routes/tickets.js";
import { combatRouter } from "./routes/combat.js";
import { shopRouter } from "./routes/shop.js";
import { achievementsRouter } from "./routes/achievements.js";
import { questsRouter } from "./routes/quests.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { worldsRouter } from "./routes/worlds.js";
import { teamEventsRouter } from "./routes/teamEvents.js";
import { adminRouter } from "./routes/admin.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { browserCaptureRouter } from "./routes/browserCapture.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.webOrigin === "*" ? true : config.webOrigin.split(","), credentials: true }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true, env: config.nodeEnv }));

  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api", ticketsRouter); // exposes /api/dev/simulate-ticket
  app.use("/api/combat", combatRouter);
  app.use("/api/shop", shopRouter);
  app.use("/api/achievements", achievementsRouter);
  app.use("/api/quests", questsRouter);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/worlds", worldsRouter);
  app.use("/api/team-events", teamEventsRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/webhooks", webhooksRouter);
  app.use("/api/browser-capture", browserCaptureRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
