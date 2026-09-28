import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/globalSetup.js";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: "./test/globalSetup.ts",
    env: {
      DATABASE_URL: testDatabaseUrl(),
      DIRECT_URL: testDatabaseUrl(),
      AUTH_JWT_SECRET: "test-secret-not-for-production",
    },
    testTimeout: 30000,
    fileParallelism: false,
  },
});
