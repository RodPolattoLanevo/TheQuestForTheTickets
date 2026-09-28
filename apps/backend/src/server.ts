import { createApp } from "./app.js";
import { config } from "./config.js";
import { startScheduledSync } from "./engine/sync.js";

const app = createApp();

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
  startScheduledSync(config.ticketProvider, config.syncIntervalMinutes);
});
