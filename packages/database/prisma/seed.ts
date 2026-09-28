import bcrypt from "bcryptjs";
import { getPrismaClient } from "../src/index.js";

const prisma = getPrismaClient();

async function main() {
  console.log("Seeding database...");

  // --- Admin + demo employee accounts -------------------------------------
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@sacoa.com.br" },
    update: {},
    create: {
      email: "admin@sacoa.com.br",
      passwordHash: adminPasswordHash,
      displayName: "Game Master",
      role: "ADMIN",
    },
  });

  const demoPasswordHash = await bcrypt.hash("demo123", 10);
  const demo = await prisma.user.upsert({
    where: { email: "demo@sacoa.com.br" },
    update: {},
    create: {
      email: "demo@sacoa.com.br",
      passwordHash: demoPasswordHash,
      displayName: "Demo Agent",
      role: "EMPLOYEE",
    },
  });

  for (const user of [admin, demo]) {
    const existing = await prisma.character.findUnique({ where: { userId: user.id } });
    if (!existing) {
      await prisma.character.create({
        data: {
          userId: user.id,
          stats: { create: {} },
        },
      });
    }
  }

  // --- Worlds (a.k.a. Regions on the map) ------------------------------------
  // liberationTarget scales with difficulty - a rough "how much collective effort
  // this region should take to fully clear" number. Never reset on reseed
  // (liberationCurrent isn't in these defs, so upsert's `update` never touches it).
  const worldDefs = [
    { key: "forgotten-village", name: "The Forgotten Village", description: "A quiet village where every agent's journey begins.", order: 1, xpRequirement: 0, theme: "meadow", liberationTarget: 2000 },
    { key: "cursed-forest", name: "The Cursed Forest", description: "Twisted trees hide tickets that bite back.", order: 2, xpRequirement: 500, theme: "forest", liberationTarget: 4000 },
    { key: "abandoned-mine", name: "The Abandoned Mine", description: "Deep tunnels full of escalations waiting to collapse.", order: 3, xpRequirement: 1500, theme: "cave", liberationTarget: 8000 },
    { key: "wasteland", name: "The Wasteland", description: "A scorched backlog stretching to the horizon.", order: 4, xpRequirement: 3500, theme: "wasteland", liberationTarget: 15000 },
    { key: "dark-fortress", name: "The Dark Fortress", description: "Where the hardest incidents are kept.", order: 5, xpRequirement: 7000, theme: "fortress", liberationTarget: 25000 },
    { key: "dragons-realm", name: "The Dragon's Realm", description: "Only the most legendary agents reach this far.", order: 6, xpRequirement: 12000, theme: "volcano", liberationTarget: 40000 },
  ];

  const worlds: Record<string, string> = {};
  for (const w of worldDefs) {
    const world = await prisma.world.upsert({ where: { key: w.key }, update: w, create: w });
    worlds[w.key] = world.id;

    await prisma.stage.upsert({
      where: { worldId_key: { worldId: world.id, key: "main" } },
      update: {},
      create: { worldId: world.id, key: "main", name: `${w.name} - Main Path`, order: 1 },
    });
  }

  // --- Monsters ---------------------------------------------------------------
  const monsterDefs = [
    { key: "rat-swarm", name: "Rat Swarm", description: "A chittering pile of minor bugs.", level: 1, hp: 80, attack: 8, defense: 2, xpReward: 15, coinReward: 5, rarity: "COMMON", world: "forgotten-village", isElite: false, isBoss: false, specialAbility: null },
    { key: "goblin-scavenger", name: "Goblin Scavenger", description: "Picks through the ticket queue for scraps.", level: 2, hp: 140, attack: 12, defense: 4, xpReward: 25, coinReward: 10, rarity: "COMMON", world: "forgotten-village", isElite: false, isBoss: false, specialAbility: null },
    { key: "village-elder-troll", name: "Village Elder Troll", description: "Boss of the Forgotten Village.", level: 5, hp: 600, attack: 20, defense: 10, xpReward: 150, coinReward: 80, rarity: "RARE", world: "forgotten-village", isElite: false, isBoss: true, specialAbility: "Slam: heavy single-target hit", image: "/monsters/village-elder-troll.png" },
    { key: "cave-spider", name: "Cave Spider", description: "Skitters between unresolved threads.", level: 6, hp: 220, attack: 18, defense: 6, xpReward: 35, coinReward: 15, rarity: "COMMON", world: "cursed-forest", isElite: false, isBoss: false, specialAbility: "Poison: damage over time" },
    { key: "forest-witch", name: "Forest Witch", description: "Curses tickets to reopen themselves.", level: 8, hp: 320, attack: 24, defense: 8, xpReward: 55, coinReward: 25, rarity: "UNCOMMON", world: "cursed-forest", isElite: true, isBoss: false, specialAbility: "Hex: reduces player defense" },
    { key: "corrupted-treant", name: "Corrupted Treant", description: "Boss of the Cursed Forest.", level: 12, hp: 1200, attack: 35, defense: 15, xpReward: 300, coinReward: 150, rarity: "EPIC", world: "cursed-forest", isElite: false, isBoss: true, specialAbility: "Root: skips player's next attack" },
    { key: "skeleton", name: "Skeleton", description: "Rattles through stale backlog items.", level: 10, hp: 260, attack: 22, defense: 10, xpReward: 45, coinReward: 20, rarity: "COMMON", world: "abandoned-mine", isElite: false, isBoss: false, specialAbility: null },
    { key: "orc-raider", name: "Orc Raider", description: "Smashes through SLAs.", level: 13, hp: 400, attack: 30, defense: 14, xpReward: 70, coinReward: 30, rarity: "UNCOMMON", world: "abandoned-mine", isElite: true, isBoss: false, specialAbility: "Rage: attack increases as HP drops" },
    { key: "stone-golem", name: "Stone Golem", description: "Boss of the Abandoned Mine.", level: 18, hp: 2200, attack: 45, defense: 25, xpReward: 500, coinReward: 250, rarity: "EPIC", world: "abandoned-mine", isElite: false, isBoss: true, specialAbility: "Fortify: periodically boosts its own defense" },
    { key: "corrupted-knight", name: "Corrupted Knight", description: "A fallen agent, still fighting.", level: 20, hp: 520, attack: 40, defense: 20, xpReward: 90, coinReward: 45, rarity: "UNCOMMON", world: "wasteland", isElite: true, isBoss: false, specialAbility: "Counter: reflects part of damage taken" },
    { key: "void-beast", name: "Void Beast", description: "Boss of the Wasteland.", level: 25, hp: 3200, attack: 60, defense: 30, xpReward: 800, coinReward: 400, rarity: "EPIC", world: "wasteland", isElite: false, isBoss: true, specialAbility: "Void Pulse: heavy AoE-style hit" },
    { key: "demon", name: "Demon", description: "Guards the Dark Fortress gates.", level: 30, hp: 900, attack: 70, defense: 35, xpReward: 150, coinReward: 75, rarity: "RARE", world: "dark-fortress", isElite: true, isBoss: false, specialAbility: "Hellfire: burns over time" },
    { key: "dragon", name: "Dragon", description: "The final boss of The Dragon's Realm.", level: 40, hp: 8000, attack: 100, defense: 50, xpReward: 2500, coinReward: 1200, rarity: "LEGENDARY", world: "dragons-realm", isElite: false, isBoss: true, specialAbility: "Inferno Breath: massive single hit" },
  ];

  for (const m of monsterDefs) {
    const { world, ...rest } = m;
    await prisma.monster.upsert({
      where: { key: m.key },
      update: { ...rest, worldId: worlds[world] },
      create: { ...rest, worldId: worlds[world] },
    });
  }

  // --- Items / cosmetics --------------------------------------------------
  const itemDefs = [
    { key: "iron-sword", name: "Iron Sword", description: "A dependable starter blade.", category: "WEAPON", rarity: "COMMON", price: 100, statBonuses: JSON.stringify({ strength: 2 }) },
    { key: "golden-sword", name: "Golden Sword", description: "Gleams with the promise of closed tickets.", category: "WEAPON", rarity: "RARE", price: 500, statBonuses: JSON.stringify({ strength: 5 }) },
    { key: "void-sword", name: "Void Sword", description: "Forged from unresolved escalations.", category: "WEAPON", rarity: "LEGENDARY", price: 2500, unlockRequirement: JSON.stringify({ minLevel: 20 }), statBonuses: JSON.stringify({ strength: 12, magic: 4 }) },
    { key: "leather-armor", name: "Leather Armor", description: "Basic protection for new agents.", category: "ARMOR", rarity: "COMMON", price: 80, statBonuses: JSON.stringify({ defense: 2 }) },
    { key: "knight-plate", name: "Knight's Plate", description: "Heavy plating, well-tested in the queue.", category: "ARMOR", rarity: "RARE", price: 450, statBonuses: JSON.stringify({ defense: 6 }) },
    { key: "iron-helm", name: "Iron Helm", description: "Keeps your head in the game.", category: "HELMET", rarity: "COMMON", price: 60, statBonuses: JSON.stringify({ defense: 1 }) },
    { key: "support-pup", name: "Support Pup", description: "A loyal companion that barks at bad tickets.", category: "PET", rarity: "UNCOMMON", price: 300 },
    { key: "phoenix-hatchling", name: "Phoenix Hatchling", description: "Rises from a fully cleared inbox.", category: "PET", rarity: "EPIC", price: 1500, unlockRequirement: JSON.stringify({ minLevel: 15 }) },
    { key: "swift-cart", name: "Swift Cart", description: "A rickety but fast mount.", category: "MOUNT", rarity: "UNCOMMON", price: 400 },
    { key: "flame-aura", name: "Flame Aura", description: "A subtle fiery glow around your character.", category: "EFFECT", rarity: "RARE", price: 600 },
    { key: "confetti-emote", name: "Confetti Burst", description: "Celebrate a closed ticket in style.", category: "EMOTE", rarity: "COMMON", price: 120 },
    { key: "title-ticket-slayer", name: "Title: Ticket Slayer", description: "Display 'Ticket Slayer' under your name.", category: "TITLE", rarity: "UNCOMMON", price: 250 },
    { key: "title-legendary-agent", name: "Title: Legendary Agent", description: "Display 'Legendary Agent' under your name.", category: "TITLE", rarity: "LEGENDARY", price: 0, unlockRequirement: JSON.stringify({ minLevel: 25 }) },
    { key: "sunset-background", name: "Sunset Background", description: "A warm profile background.", category: "BACKGROUND", rarity: "COMMON", price: 150 },
  ];

  for (const i of itemDefs) {
    await prisma.item.upsert({ where: { key: i.key }, update: i, create: i });
  }

  // --- Ticket category reward rules ---------------------------------------
  // Matched against the real support team's Zendesk Groups (see ZENDESK_INTEGRATION.md -
  // ZendeskApiProvider/ZendeskWebhookProvider both resolve the ticket's group_id to its
  // human-readable name before this runs, so `value` below is the group's display name,
  // not a numeric id).
  const ruleDefs = [
    { name: "BR Support LVL1", fieldSource: "group", operator: "equals", value: JSON.stringify("BR Support LVL1"), difficulty: "simple", xp: 25, coins: 10, priority: 10, active: true },
    { name: "BR Support LVL2", fieldSource: "group", operator: "equals", value: JSON.stringify("BR Support LVL2"), difficulty: "medium", xp: 50, coins: 25, priority: 20, active: true },
    { name: "BR Support LVL3", fieldSource: "group", operator: "equals", value: JSON.stringify("BR Support LVL3"), difficulty: "hard", xp: 100, coins: 50, priority: 30, active: true },
    { name: "BR Emergency", fieldSource: "group", operator: "equals", value: JSON.stringify("BR Emergency"), difficulty: "critical", xp: 200, coins: 100, priority: 40, active: true },
    // Best-guess tiers for groups discovered via a live Zendesk sync, based on the group
    // name alone - nothing to base actual effort on yet. Trivially editable (or disable-
    // able) from Admin -> Category Rules; treat these as a starting point, not gospel.
    { name: "BR Guide", fieldSource: "group", operator: "equals", value: JSON.stringify("BR Guide"), difficulty: "simple", xp: 25, coins: 10, priority: 15, active: true },
    { name: "BR Notification", fieldSource: "group", operator: "equals", value: JSON.stringify("BR Notification"), difficulty: "simple", xp: 25, coins: 10, priority: 16, active: true },
    { name: "BR Assistance", fieldSource: "group", operator: "equals", value: JSON.stringify("BR Assistance"), difficulty: "medium", xp: 50, coins: 25, priority: 25, active: true },
    { name: "BR Development", fieldSource: "group", operator: "equals", value: JSON.stringify("BR Development"), difficulty: "hard", xp: 100, coins: 50, priority: 35, active: true },
    // Superseded by the group-based rules above (kept, disabled, for reference/rollback
    // rather than deleted - the Admin -> Category Rules panel can re-enable or edit any of
    // these at any time).
    { name: "Simple", fieldSource: "priority", operator: "equals", value: JSON.stringify("low"), difficulty: "simple", xp: 25, coins: 10, priority: 110, active: false },
    { name: "Medium", fieldSource: "priority", operator: "equals", value: JSON.stringify("normal"), difficulty: "medium", xp: 50, coins: 25, priority: 120, active: false },
    { name: "Hard", fieldSource: "priority", operator: "equals", value: JSON.stringify("high"), difficulty: "hard", xp: 100, coins: 50, priority: 130, active: false },
    { name: "Critical", fieldSource: "priority", operator: "equals", value: JSON.stringify("urgent"), difficulty: "critical", xp: 200, coins: 100, priority: 140, active: false },
  ];
  for (const r of ruleDefs) {
    const existing = await prisma.ticketCategoryRule.findFirst({ where: { name: r.name } });
    if (existing) await prisma.ticketCategoryRule.update({ where: { id: existing.id }, data: r });
    else await prisma.ticketCategoryRule.create({ data: r });
  }

  // --- Achievements ---------------------------------------------------------
  const achievementDefs = [
    { key: "first-blood", name: "First Blood", description: "Complete your first ticket.", criteria: JSON.stringify({ type: "tickets_completed", target: 1 }), xpReward: 10, coinsReward: 5 },
    { key: "ticket-hunter", name: "Ticket Hunter", description: "Complete 10 tickets.", criteria: JSON.stringify({ type: "tickets_completed", target: 10 }), xpReward: 50, coinsReward: 25 },
    { key: "ticket-machine", name: "Ticket Machine", description: "Complete 100 tickets.", criteria: JSON.stringify({ type: "tickets_completed", target: 100 }), xpReward: 300, coinsReward: 150 },
    { key: "boss-slayer", name: "Boss Slayer", description: "Defeat your first boss.", criteria: JSON.stringify({ type: "bosses_defeated", target: 1 }), xpReward: 100, coinsReward: 50 },
    { key: "legendary-agent", name: "Legendary Agent", description: "Reach level 25.", criteria: JSON.stringify({ type: "level_reached", target: 25 }), xpReward: 0, coinsReward: 500 },
    { key: "treasure-hunter", name: "Treasure Hunter", description: "Purchase 10 cosmetic items.", criteria: JSON.stringify({ type: "items_purchased", target: 10 }), xpReward: 40, coinsReward: 20 },
  ];
  for (const a of achievementDefs) {
    await prisma.achievement.upsert({ where: { key: a.key }, update: a, create: a });
  }

  // --- Quests (current week) ------------------------------------------------
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const dayEnd = new Date(weekStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const questDefs = [
    { key: "daily-5-tickets", name: "Daily Grind", description: "Complete 5 tickets today.", type: "DAILY" as const, criteria: JSON.stringify({ type: "tickets_completed", target: 5 }), xpReward: 60, coinsReward: 30, periodStart: weekStart, periodEnd: dayEnd },
    { key: "weekly-500-xp", name: "Steady Progress", description: "Earn 500 XP this week.", type: "WEEKLY" as const, criteria: JSON.stringify({ type: "xp_earned", target: 500 }), xpReward: 100, coinsReward: 50, periodStart: weekStart, periodEnd: weekEnd },
    { key: "weekly-2-monsters", name: "Monster Hunter", description: "Defeat 2 monsters this week.", type: "WEEKLY" as const, criteria: JSON.stringify({ type: "monsters_defeated", target: 2 }), xpReward: 80, coinsReward: 40, periodStart: weekStart, periodEnd: weekEnd },
  ];
  for (const q of questDefs) {
    const existing = await prisma.quest.findFirst({ where: { key: q.key, periodStart: q.periodStart } });
    if (!existing) {
      await prisma.quest.create({ data: q });
    }
  }

  // --- Integration settings / feature flags / level curve --------------------
  const settingDefs: Record<string, unknown> = {
    feature_flags: {
      browserCapture: false,
      teamEvents: true,
      soundDefaultOn: false,
    },
    level_curve: { baseXp: 100, growth: 1.18 },
    ticket_reopen_policy: "ignore",
    active_provider: "mock",
  };
  for (const [key, value] of Object.entries(settingDefs)) {
    await prisma.integrationSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }

  await prisma.syncState.upsert({
    where: { provider: "mock" },
    update: {},
    create: { provider: "mock", lastStatus: "never_run" },
  });

  // Put admin/demo characters into the starting world now that worlds exist.
  const startingWorld = await prisma.world.findFirst({ orderBy: { order: "asc" } });
  if (startingWorld) {
    const startingStage = await prisma.stage.findFirst({ where: { worldId: startingWorld.id }, orderBy: { order: "asc" } });
    for (const user of [admin, demo]) {
      const character = await prisma.character.findUnique({ where: { userId: user.id } });
      if (character && !character.currentWorldId) {
        await prisma.character.update({
          where: { id: character.id },
          data: { currentWorldId: startingWorld.id, currentStageId: startingStage?.id },
        });
      }
    }
  }

  console.log("Seed complete.");
  console.log("Admin login: admin@sacoa.com.br / admin123");
  console.log("Demo login:  demo@sacoa.com.br / demo123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
