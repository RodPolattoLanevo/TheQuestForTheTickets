// Vercel serverless entrypoint. Deliberately NOT src/server.ts: that file calls
// app.listen() and starts an in-process setInterval sync loop, neither of which make
// sense in a short-lived serverless function - Vercel just needs the Express app itself,
// which it can invoke directly as a (req, res) handler. See docs/DEPLOYMENT.md for how
// scheduled sync is (or isn't) handled in this deployment mode.
import { createApp } from "../src/app.js";

export default createApp();
