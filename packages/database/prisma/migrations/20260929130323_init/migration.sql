-- CreateIndex
CREATE INDEX "combat_sessions_characterId_status_idx" ON "combat_sessions"("characterId", "status");

-- CreateIndex
CREATE INDEX "monsters_isBoss_idx" ON "monsters"("isBoss");

-- CreateIndex
CREATE INDEX "reward_transactions_userId_idx" ON "reward_transactions"("userId");
