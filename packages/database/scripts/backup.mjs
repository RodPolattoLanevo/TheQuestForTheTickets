// Logical JSON backup of every table, in dependency order (parents before children) so a
// restore could replay this same file top-to-bottom without FK violations. Not a substitute
// for a real pg_dump/Supabase snapshot, but doesn't require the pg_dump binary (not
// installed here) - just the Prisma client already generated for this project - and is
// enough to recover from a bad migration or a bad application-code bug during development.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPrismaClient } from "../src/index.js";

const prisma = getPrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parents before children, matching schema.prisma's FK relationships.
const MODELS = [
  "user",
  "character",
  "characterStats",
  "item",
  "inventoryItem",
  "world",
  "stage",
  "monster",
  "combatSession",
  "ticket",
  "ticketEvent",
  "ticketCategoryRule",
  "rewardTransaction",
  "achievement",
  "userAchievement",
  "quest",
  "userQuest",
  "adminAction",
  "integrationSetting",
  "syncState",
  "season",
  "teamEvent",
  "teamEventContribution",
];

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(__dirname, "../backups");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `backup-${timestamp}.json`);

  const dump = {};
  let totalRows = 0;
  for (const model of MODELS) {
    const rows = await prisma[model].findMany();
    dump[model] = rows;
    totalRows += rows.length;
    console.log(`  ${model}: ${rows.length} row(s)`);
  }

  writeFileSync(outFile, JSON.stringify(dump, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2));
  console.log(`\nBackup complete - ${totalRows} total rows written to ${outFile}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
