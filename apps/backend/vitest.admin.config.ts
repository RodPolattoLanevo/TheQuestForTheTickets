import { defineConfig } from "vitest/config";

// Database-free endpoint tests; never runs the destructive integration-suite setup.
export default defineConfig({ test: { environment: "node", include: ["test/adminUsers.test.ts", "test/adminRewards.test.ts"] } });
