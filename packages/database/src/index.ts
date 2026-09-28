import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../generated/client/index.js";

export * from "../generated/client/index.js";

// SQLite has no native enum support in Prisma, so schema.prisma models these as plain
// String columns (see the comment at the top of schema.prisma). These union types give
// the rest of the app the same compile-time safety a real Prisma enum would.
export type Role = "EMPLOYEE" | "ADMIN";
export type ItemCategory = "WEAPON" | "ARMOR" | "HELMET" | "PET" | "MOUNT" | "EFFECT" | "EMOTE" | "TITLE" | "BACKGROUND" | "ACCESSORY";
export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type CombatStatus = "IN_PROGRESS" | "VICTORY" | "DEFEAT";
export type RewardSource = "ZENDESK_TICKET" | "COMBAT" | "QUEST" | "ACHIEVEMENT" | "ADMIN_GRANT" | "ADMIN_REMOVE" | "TEAM_EVENT" | "SHOP_PURCHASE";
export type ActorType = "SYSTEM" | "ADMIN" | "PLAYER";
export type QuestType = "DAILY" | "WEEKLY";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Prisma's CLI (migrate/db push, run with cwd = packages/database) resolves a relative
 * `file:` SQLite URL relative to schema.prisma's folder (packages/database/prisma), but
 * PrismaClient at runtime resolves it relative to process.cwd() of whatever app imported
 * it (apps/backend, or this package's own seed script) - a well-known Prisma gotcha. This
 * makes every consumer agree on the same on-disk file regardless of where it's run from.
 */
function resolveDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || !raw.startsWith("file:")) return raw; // non-SQLite (e.g. postgresql://) - pass through untouched
  const relativePath = raw.slice("file:".length);
  if (path.isAbsolute(relativePath)) return raw;
  return `file:${path.resolve(__dirname, "../prisma", relativePath)}`;
}

let prisma: PrismaClient | undefined;

/** Singleton Prisma client. Avoids exhausting SQLite/Postgres connections across hot reloads. */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const url = resolveDatasourceUrl();
    prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
  }
  return prisma;
}
