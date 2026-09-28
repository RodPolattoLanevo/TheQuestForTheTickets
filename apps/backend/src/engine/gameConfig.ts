import { getPrismaClient } from "@hunt/database";
import { DEFAULT_LEVEL_CURVE } from "@hunt/game-engine";
import type { CategoryRule, FeatureFlags, LevelCurveConfig, ReopenPolicy } from "@hunt/shared";

const prisma = getPrismaClient();

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.integrationSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.integrationSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  });
}

export async function getLevelCurve(): Promise<LevelCurveConfig> {
  return getSetting("level_curve", DEFAULT_LEVEL_CURVE);
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  return getSetting("feature_flags", { browserCapture: false, teamEvents: true, soundDefaultOn: false });
}

export async function getReopenPolicy(): Promise<ReopenPolicy> {
  return getSetting("ticket_reopen_policy", "ignore" as ReopenPolicy);
}

export async function getActiveProviderId(): Promise<string> {
  return getSetting("active_provider", "mock");
}

export async function getActiveCategoryRules(): Promise<CategoryRule[]> {
  const rows = await prisma.ticketCategoryRule.findMany({ where: { active: true }, orderBy: { priority: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    fieldSource: r.fieldSource as CategoryRule["fieldSource"],
    fieldKey: r.fieldKey,
    operator: r.operator as CategoryRule["operator"],
    value: JSON.parse(r.value),
    difficulty: r.difficulty,
    xp: r.xp,
    coins: r.coins,
    priority: r.priority,
    active: r.active,
  }));
}
