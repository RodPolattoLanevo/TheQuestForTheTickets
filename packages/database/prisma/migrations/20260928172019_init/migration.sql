-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "zendeskUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "currentWorldId" TEXT,
    "currentStageId" TEXT,
    "equippedHead" TEXT,
    "equippedHair" TEXT,
    "equippedFace" TEXT,
    "equippedBody" TEXT,
    "equippedArmorId" TEXT,
    "equippedWeaponId" TEXT,
    "equippedAccessoryId" TEXT,
    "equippedPetId" TEXT,
    "equippedTitleId" TEXT,
    "equippedAuraId" TEXT,
    "equippedMountId" TEXT,
    "equippedBackgroundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_stats" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "strength" INTEGER NOT NULL DEFAULT 5,
    "defense" INTEGER NOT NULL DEFAULT 5,
    "agility" INTEGER NOT NULL DEFAULT 5,
    "magic" INTEGER NOT NULL DEFAULT 5,
    "luck" INTEGER NOT NULL DEFAULT 5,
    "unspentPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "character_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "price" INTEGER NOT NULL DEFAULT 0,
    "unlockRequirement" TEXT,
    "previewImage" TEXT,
    "isGameplayUpgrade" BOOLEAN NOT NULL DEFAULT false,
    "statBonuses" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'shop',

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worlds" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "xpRequirement" INTEGER NOT NULL DEFAULT 0,
    "theme" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "liberationCurrent" INTEGER NOT NULL DEFAULT 0,
    "liberationTarget" INTEGER NOT NULL DEFAULT 2000,

    CONSTRAINT "worlds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monsters" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "hp" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "coinReward" INTEGER NOT NULL,
    "image" TEXT,
    "rarity" TEXT NOT NULL DEFAULT 'COMMON',
    "specialAbility" TEXT,
    "worldId" TEXT NOT NULL,
    "isElite" BOOLEAN NOT NULL DEFAULT false,
    "isBoss" BOOLEAN NOT NULL DEFAULT false,
    "unlockRequirement" TEXT,

    CONSTRAINT "monsters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combat_sessions" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "monsterHp" INTEGER NOT NULL,
    "monsterMaxHp" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "combat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "employeeExternalId" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL,
    "category" TEXT,
    "rawFields" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_events" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "externalEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
    "skippedReason" TEXT,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_category_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldSource" TEXT NOT NULL,
    "fieldKey" TEXT,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_category_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_transactions" (
    "id" TEXT NOT NULL,
    "transactionUid" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ticketId" TEXT,
    "eventId" TEXT,
    "category" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "provider" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "coinsReward" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "coinsReward" INTEGER NOT NULL DEFAULT 0,
    "itemRewardId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "user_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetUserId" TEXT,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_state" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cursor" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "recordsSeen" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_events" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetDamage" INTEGER NOT NULL,
    "currentDamage" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "team_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_event_contributions" (
    "id" TEXT NOT NULL,
    "teamEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "damage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_event_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_zendeskUserId_key" ON "users"("zendeskUserId");

-- CreateIndex
CREATE UNIQUE INDEX "characters_userId_key" ON "characters"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "character_stats_characterId_key" ON "character_stats"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "items_key_key" ON "items"("key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_characterId_itemId_key" ON "inventory_items"("characterId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "worlds_key_key" ON "worlds"("key");

-- CreateIndex
CREATE UNIQUE INDEX "stages_worldId_key_key" ON "stages"("worldId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "monsters_key_key" ON "monsters"("key");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_provider_externalId_key" ON "tickets"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_events_ticketId_externalEventId_key" ON "ticket_events"("ticketId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "reward_transactions_transactionUid_key" ON "reward_transactions"("transactionUid");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "user_quests_userId_questId_key" ON "user_quests"("userId", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_settings_key_key" ON "integration_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sync_state_provider_key" ON "sync_state"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_key_key" ON "seasons"("key");

-- CreateIndex
CREATE UNIQUE INDEX "team_events_key_key" ON "team_events"("key");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_currentWorldId_fkey" FOREIGN KEY ("currentWorldId") REFERENCES "worlds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combat_sessions" ADD CONSTRAINT "combat_sessions_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combat_sessions" ADD CONSTRAINT "combat_sessions_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_transactions" ADD CONSTRAINT "reward_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_transactions" ADD CONSTRAINT "reward_transactions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_transactions" ADD CONSTRAINT "reward_transactions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_questId_fkey" FOREIGN KEY ("questId") REFERENCES "quests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_event_contributions" ADD CONSTRAINT "team_event_contributions_teamEventId_fkey" FOREIGN KEY ("teamEventId") REFERENCES "team_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_event_contributions" ADD CONSTRAINT "team_event_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
