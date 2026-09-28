import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../../../packages/database/prisma/schema.prisma");

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

/** Matches TEST_SCHEMA in vitest.config.ts - both derive the same URL independently. */
export function testDatabaseUrl(): string {
  const base = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "DATABASE_URL/DIRECT_URL must point at a real Postgres instance to run backend tests " +
        "- e.g. `docker compose up -d` at the repo root, or a Supabase project. See docs/DEPLOYMENT.md.",
    );
  }
  const url = new URL(base);
  url.searchParams.set("schema", "hunt_test");
  return url.toString();
}

export default function setup() {
  const testUrl = testDatabaseUrl();

  // Isolated Postgres schema, dropped and recreated on every run - never touches dev data.
  // Uses the direct (non-pooled) connection since pgbouncer's transaction-pooling mode
  // (Supabase's default DATABASE_URL) can't run the DDL `db push` issues.
  execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss --force-reset`, {
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
    stdio: "inherit",
  });
}
