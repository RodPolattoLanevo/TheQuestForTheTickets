import { Router } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPrismaClient } from "@hunt/database";
import { resolveTicketReward, computeLevelProgress, totalXpForLevel } from "@hunt/game-engine";
import { parseTicketCsv } from "@hunt/providers";
import { requireAuth, requireAdmin } from "../auth/middleware.js";
import { grantReward } from "../engine/rewards.js";
import { runSync } from "../engine/sync.js";
import { ingestRawTickets } from "../engine/rewardPipeline.js";
import { getActiveCategoryRules, getFeatureFlags, getLevelCurve, getReopenPolicy, setSetting } from "../engine/gameConfig.js";
import { listProviders } from "../providers/registry.js";
import { assignStartingWorldIfNeeded } from "../engine/character.js";

const prisma = getPrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

async function logAdminAction(actorUserId: string, actionType: string, payload: unknown, targetUserId?: string) {
  await prisma.adminAction.create({
    data: { actorUserId, actionType, payload: JSON.stringify(payload), targetUserId },
  });
}

// --- Overview / setup status -------------------------------------------------------------

adminRouter.get("/overview", async (_req, res) => {
  const [users, tickets, rewardsGranted, activeRules] = await Promise.all([
    prisma.user.count(),
    prisma.ticket.count(),
    prisma.rewardTransaction.count(),
    prisma.ticketCategoryRule.count({ where: { active: true } }),
  ]);
  res.json({ users, tickets, rewardsGranted, activeRules });
});

adminRouter.get("/setup-status", async (_req, res) => {
  const [employeeCount, adminCount, rulesConfigured] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.ticketCategoryRule.count({ where: { active: true } }),
  ]);
  res.json({ employeeCount, adminCount, rulesConfigured, activeProvider: await setSettingRead("active_provider", "mock") });
});

async function setSettingRead<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.integrationSetting.findUnique({ where: { key } });
  return row ? (JSON.parse(row.value) as T) : fallback;
}

// --- Users --------------------------------------------------------------------------------

adminRouter.get("/users", async (_req, res) => {
  const curve = await getLevelCurve();
  const users = await prisma.user.findMany({ include: { character: true }, orderBy: { createdAt: "asc" } });
  res.json(users.map(({ passwordHash, ...u }) => ({ ...u, character: u.character ? { ...u.character, level: computeLevelProgress(u.character.xp, curve).level } : null })));
});

const correctionSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().optional(),
  zendeskUserId: z.string().trim().max(100).nullable().optional(),
  xp: z.number().int().min(0).max(2147483647).optional(),
  coins: z.number().int().min(0).max(2147483647).optional(),
  level: z.number().int().min(1).max(1000).optional(),
  reason: z.string().trim().min(1).max(500),
}).refine((v) => !(v.xp !== undefined && v.level !== undefined), { message: "Informe XP ou nível, não os dois." })
  .refine((v) => Object.keys(v).some((key) => key !== "reason"), { message: "Informe uma correção." });

adminRouter.put("/users/:id", async (req, res) => {
  const parsed = correctionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Correção inválida", details: parsed.error.flatten() });
  const input = parsed.data;
  const curve = await getLevelCurve();
  let targetXp = input.xp;
  if (input.level !== undefined) {
    try { targetXp = totalXpForLevel(input.level, curve); }
    catch { return res.status(400).json({ error: "Este nível excede o limite de XP permitido." }); }
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: req.params.id }, include: { character: true } });
      if (!user) return null;
      const character = user.character;
      if (!character) throw new Error("User has no character");
      const xp = targetXp ?? character.xp;
      const coins = input.coins ?? character.coins;
      const level = computeLevelProgress(xp, curve).level;
      const updated = await tx.user.update({ where: { id: user.id }, data: {
        displayName: input.displayName, email: input.email,
        zendeskUserId: input.zendeskUserId === "" ? null : input.zendeskUserId,
      } });
      await tx.character.update({ where: { id: character.id }, data: { xp, coins, level } });
      const xpDelta = xp - character.xp;
      const coinsDelta = coins - character.coins;
      // Split mixed adjustments so the reward ledger retains its existing source semantics.
      for (const positive of [true, false]) {
        const dx = positive ? Math.max(0, xpDelta) : Math.min(0, xpDelta);
        const dc = positive ? Math.max(0, coinsDelta) : Math.min(0, coinsDelta);
        if (dx || dc) await tx.rewardTransaction.create({ data: {
          userId: user.id, source: positive ? "ADMIN_GRANT" : "ADMIN_REMOVE",
          xp: dx, coins: dc, reason: input.reason, actorType: "ADMIN", actorUserId: req.auth!.sub,
        } });
      }
      await tx.adminAction.create({ data: {
        actorUserId: req.auth!.sub, targetUserId: user.id, actionType: "correct_user",
        payload: JSON.stringify({ reason: input.reason,
          before: { displayName: user.displayName, email: user.email, zendeskUserId: user.zendeskUserId, xp: character.xp, coins: character.coins, level: computeLevelProgress(character.xp, curve).level },
          after: { displayName: updated.displayName, email: updated.email, zendeskUserId: updated.zendeskUserId, xp, coins, level },
        }),
      } });
      return { ok: true, xp, coins, level };
    }, { isolationLevel: "Serializable" });
    if (!result) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(result);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") return res.status(409).json({ error: "Email já cadastrado." });
    if (code === "P2034") return res.status(409).json({ error: "O progresso mudou durante a correção. Atualize e tente novamente." });
    throw err;
  }
});

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(["EMPLOYEE", "ADMIN"]).default("EMPLOYEE"),
  temporaryPassword: z.string().min(6),
});

adminRouter.post("/users", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(parsed.data.temporaryPassword, 10);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      role: parsed.data.role,
      passwordHash,
      character: { create: { stats: { create: {} } } },
    },
  });
  const character = await prisma.character.findUniqueOrThrow({ where: { userId: user.id } });
  await assignStartingWorldIfNeeded(character.id);

  await logAdminAction(req.auth!.sub, "create_user", { email: user.email }, user.id);
  res.status(201).json({ id: user.id, email: user.email, displayName: user.displayName, role: user.role });
});

// --- Category rules (reward rule engine) ---------------------------------------------------

adminRouter.get("/category-rules", async (_req, res) => {
  res.json(await getActiveCategoryRules());
  });

adminRouter.get("/category-rules/all", async (_req, res) => {
  const rules = await prisma.ticketCategoryRule.findMany({ orderBy: { priority: "asc" } });
  // `value` is stored JSON-encoded (it can be a string, number or array) - parse it here
  // so the client always works with the real value, matching what /category-rules (active
  // only) already returns. Otherwise an edit-without-changing-value round trip would
  // double-JSON-encode it on save.
  res.json(rules.map((r) => ({ ...r, value: JSON.parse(r.value) })));
});

const ruleSchema = z.object({
  name: z.string().min(1),
  fieldSource: z.enum(["type", "group", "form", "tags", "priority", "custom_field", "status"]),
  fieldKey: z.string().nullable().optional(),
  operator: z.enum(["equals", "contains", "in", "gte", "lte"]),
  value: z.unknown(),
  difficulty: z.string().min(1),
  xp: z.number().int().min(0),
  coins: z.number().int().min(0),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
});

adminRouter.post("/category-rules", async (req, res) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const rule = await prisma.ticketCategoryRule.create({
    data: { ...parsed.data, value: JSON.stringify(parsed.data.value) },
  });
  await logAdminAction(req.auth!.sub, "create_category_rule", rule);
  res.status(201).json(rule);
});

adminRouter.put("/category-rules/:id", async (req, res) => {
  const parsed = ruleSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data: Record<string, unknown> = { ...parsed.data };
  if ("value" in data) data.value = JSON.stringify(data.value);
  const rule = await prisma.ticketCategoryRule.update({ where: { id: req.params.id }, data });
  await logAdminAction(req.auth!.sub, "update_category_rule", rule);
  res.json(rule);
});

adminRouter.delete("/category-rules/:id", async (req, res) => {
  await prisma.ticketCategoryRule.delete({ where: { id: req.params.id } });
  await logAdminAction(req.auth!.sub, "delete_category_rule", { id: req.params.id });
  res.status(204).end();
});

adminRouter.post("/category-rules/preview", async (req, res) => {
  const rules = await getActiveCategoryRules();
  const ticket = { externalId: "preview", employeeExternalId: "preview", status: "solved" as const, updatedAt: new Date().toISOString(), fields: req.body.fields ?? {} };
  res.json(resolveTicketReward(ticket, rules));
});

// --- Level curve / feature flags / reopen policy / leaderboard settings --------------------

adminRouter.get("/level-curve", async (_req, res) => res.json(await getLevelCurve()));
adminRouter.put("/level-curve", async (req, res) => {
  const schema = z.object({ baseXp: z.number().positive(), growth: z.number().gte(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setSetting("level_curve", parsed.data);
  await logAdminAction(req.auth!.sub, "update_level_curve", parsed.data);
  res.json(parsed.data);
});

adminRouter.get("/feature-flags", async (_req, res) => res.json(await getFeatureFlags()));
adminRouter.put("/feature-flags", async (req, res) => {
  const schema = z.object({ browserCapture: z.boolean(), teamEvents: z.boolean(), soundDefaultOn: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setSetting("feature_flags", parsed.data);
  await logAdminAction(req.auth!.sub, "update_feature_flags", parsed.data);
  res.json(parsed.data);
});

adminRouter.get("/reopen-policy", async (_req, res) => res.json({ policy: await getReopenPolicy() }));
adminRouter.put("/reopen-policy", async (req, res) => {
  const schema = z.object({ policy: z.enum(["ignore", "new_completion", "manual_review"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setSetting("ticket_reopen_policy", parsed.data.policy);
  await logAdminAction(req.auth!.sub, "update_reopen_policy", parsed.data);
  res.json(parsed.data);
});

adminRouter.get("/leaderboard-settings", async (_req, res) => {
  res.json(await setSettingRead("leaderboard_settings", { visible: true, useDisplayNames: true }));
});
adminRouter.put("/leaderboard-settings", async (req, res) => {
  const schema = z.object({ visible: z.boolean(), useDisplayNames: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setSetting("leaderboard_settings", parsed.data);
  res.json(parsed.data);
});

// --- Monsters / items (content configuration) -----------------------------------------------

adminRouter.get("/monsters", async (_req, res) => res.json(await prisma.monster.findMany({ include: { world: true } })));
adminRouter.put("/monsters/:id", async (req, res) => {
  const schema = z.object({
    hp: z.number().int().positive().optional(),
    attack: z.number().int().positive().optional(),
    defense: z.number().int().min(0).optional(),
    xpReward: z.number().int().min(0).optional(),
    coinReward: z.number().int().min(0).optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    image: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const monster = await prisma.monster.update({ where: { id: req.params.id }, data: parsed.data });
  await logAdminAction(req.auth!.sub, "update_monster", monster);
  res.json(monster);
});

adminRouter.get("/items", async (_req, res) => res.json(await prisma.item.findMany()));
adminRouter.put("/items/:id", async (req, res) => {
  const schema = z.object({
    price: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    unlockRequirement: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await prisma.item.update({ where: { id: req.params.id }, data: parsed.data });
  await logAdminAction(req.auth!.sub, "update_item", item);
  res.json(item);
});

adminRouter.get("/achievements", async (_req, res) => res.json(await prisma.achievement.findMany()));
adminRouter.get("/quests", async (_req, res) => res.json(await prisma.quest.findMany({ orderBy: { periodStart: "desc" } })));
adminRouter.get("/worlds", async (_req, res) => res.json(await prisma.world.findMany({ orderBy: { order: "asc" } })));

// --- Providers / sync -----------------------------------------------------------------------

adminRouter.get("/providers", async (_req, res) => {
  const active = await setSettingRead("active_provider", "mock");
  res.json(listProviders().map((p) => ({ id: p.id, displayName: p.displayName, configured: p.isConfigured(), active: p.id === active })));
});

adminRouter.put("/providers/active", async (req, res) => {
  const schema = z.object({ provider: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await setSetting("active_provider", parsed.data.provider);
  await logAdminAction(req.auth!.sub, "set_active_provider", parsed.data);
  res.json(parsed.data);
});

adminRouter.get("/sync-state", async (_req, res) => res.json(await prisma.syncState.findMany()));

adminRouter.post("/sync", async (req, res) => {
  const schema = z.object({ provider: z.string(), full: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = await runSync(parsed.data.provider, { full: parsed.data.full });
    await logAdminAction(req.auth!.sub, "sync", result);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- CSV import -------------------------------------------------------------------------------

adminRouter.post("/csv-import/preview", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded (field name: file)" });
  const content = req.file.buffer.toString("utf-8");
  const parsedCsv = parseTicketCsv(content);
  const rules = await getActiveCategoryRules();
  const preview = parsedCsv.valid.map((t) => ({ ticket: t, reward: resolveTicketReward(t, rules) }));
  res.json({ valid: preview, invalid: parsedCsv.invalid, totalRows: parsedCsv.valid.length + parsedCsv.invalid.length });
});

adminRouter.post("/csv-import/commit", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded (field name: file)" });
  const content = req.file.buffer.toString("utf-8");
  const parsedCsv = parseTicketCsv(content);
  const result = await ingestRawTickets("csv", parsedCsv.valid);
  await logAdminAction(req.auth!.sub, "csv_import", { ...result, invalidRows: parsedCsv.invalid.length });
  res.json({ ...result, invalidRows: parsedCsv.invalid });
});

// --- Grant / remove / reset ---------------------------------------------------------------

const grantSchema = z.object({ userId: z.string(), xp: z.number().int().min(0).default(0), coins: z.number().int().min(0).default(0), reason: z.string().optional() });

adminRouter.post("/grant", async (req, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const reward = await grantReward({
    userId: parsed.data.userId,
    source: "ADMIN_GRANT",
    xp: parsed.data.xp,
    coins: parsed.data.coins,
    reason: parsed.data.reason,
    actorType: "ADMIN",
    actorUserId: req.auth!.sub,
  });
  await logAdminAction(req.auth!.sub, "grant", parsed.data, parsed.data.userId);
  res.json(reward);
});

adminRouter.post("/remove", async (req, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const reward = await grantReward({
    userId: parsed.data.userId,
    source: "ADMIN_REMOVE",
    xp: -parsed.data.xp,
    coins: -parsed.data.coins,
    reason: parsed.data.reason,
    actorType: "ADMIN",
    actorUserId: req.auth!.sub,
  });
  await logAdminAction(req.auth!.sub, "remove", parsed.data, parsed.data.userId);
  res.json(reward);
});

adminRouter.post("/reset-character", async (req, res) => {
  const schema = z.object({ userId: z.string(), reason: z.string().trim().max(500).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const character = await prisma.character.findUniqueOrThrow({ where: { userId: parsed.data.userId } });
  await prisma.$transaction([
    prisma.rewardTransaction.create({ data: {
      userId: parsed.data.userId, source: "ADMIN_REMOVE", xp: -character.xp, coins: -character.coins,
      reason: parsed.data.reason ?? "Character reset", actorType: "ADMIN", actorUserId: req.auth!.sub,
    } }),
    prisma.inventoryItem.deleteMany({ where: { characterId: character.id } }),
    prisma.combatSession.deleteMany({ where: { characterId: character.id } }),
    prisma.character.update({
      where: { id: character.id },
      data: {
        xp: 0,
        coins: 0,
        level: 1,
        currentWorldId: null,
        currentStageId: null,
        equippedArmorId: null,
        equippedWeaponId: null,
        equippedAccessoryId: null,
        equippedPetId: null,
        equippedTitleId: null,
        equippedAuraId: null,
        equippedMountId: null,
        equippedBackgroundId: null,
      },
    }),
    prisma.characterStats.update({ where: { characterId: character.id }, data: { strength: 5, defense: 5, agility: 5, magic: 5, luck: 5, unspentPoints: 0 } }),
    prisma.userAchievement.deleteMany({ where: { userId: parsed.data.userId } }),
    prisma.userQuest.deleteMany({ where: { userId: parsed.data.userId } }),
  ]);

  // Re-seed the starting world so the reset character isn't stranded with no world assigned.
  const firstWorld = await prisma.world.findFirst({ orderBy: { order: "asc" } });
  if (firstWorld) {
    const firstStage = await prisma.stage.findFirst({ where: { worldId: firstWorld.id }, orderBy: { order: "asc" } });
    await prisma.character.update({ where: { id: character.id }, data: { currentWorldId: firstWorld.id, currentStageId: firstStage?.id } });
  }

  await logAdminAction(req.auth!.sub, "reset_character", { reason: parsed.data.reason, before: { xp: character.xp, coins: character.coins, level: character.level }, after: { xp: 0, coins: 0, level: 1 } }, parsed.data.userId);
  res.json({ ok: true });
});

// --- Audit log ------------------------------------------------------------------------------

adminRouter.get("/audit-log/rewards", async (req, res) => {
  const take = Math.min(200, Number(req.query.limit ?? 100));
  const rewards = await prisma.rewardTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { displayName: true, email: true } }, ticket: true, actorUser: { select: { displayName: true } } },
  });
  res.json(rewards);
});

adminRouter.get("/audit-log/admin-actions", async (req, res) => {
  const take = Math.min(200, Number(req.query.limit ?? 100));
  const actions = await prisma.adminAction.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { actorUser: { select: { displayName: true } } },
  });
  res.json(actions);
});

// --- Team events ------------------------------------------------------------------------------

const teamEventSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  targetDamage: z.number().int().positive(),
  startDate: z.string(),
  endDate: z.string(),
});

adminRouter.post("/team-events", async (req, res) => {
  const parsed = teamEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const event = await prisma.teamEvent.create({
    data: { ...parsed.data, startDate: new Date(parsed.data.startDate), endDate: new Date(parsed.data.endDate) },
  });
  await logAdminAction(req.auth!.sub, "create_team_event", event);
  res.status(201).json(event);
});
