export interface CombatStats {
  strength: number;
  defense: number;
  agility: number;
  magic: number;
  luck: number;
}

export interface DerivedCombatPower {
  attack: number;
  defense: number;
  critChance: number; // 0..1
  rewardBonus: number; // 0..1, extra chance at bonus loot
}

/**
 * Converts the simple 5-stat RPG sheet (Strength/Defense/Agility/Magic/Luck) into
 * combat numbers. Deliberately simple per spec: "do not turn this into a complicated RPG".
 */
export function deriveCombatPower(stats: CombatStats, equipmentBonus: Partial<CombatStats> = {}): DerivedCombatPower {
  const strength = stats.strength + (equipmentBonus.strength ?? 0);
  const defense = stats.defense + (equipmentBonus.defense ?? 0);
  const agility = stats.agility + (equipmentBonus.agility ?? 0);
  const magic = stats.magic + (equipmentBonus.magic ?? 0);
  const luck = stats.luck + (equipmentBonus.luck ?? 0);

  return {
    attack: strength * 2 + magic,
    defense: defense * 1.5,
    critChance: Math.min(0.5, 0.05 + agility * 0.01),
    rewardBonus: Math.min(0.5, luck * 0.015),
  };
}

export interface AttackResult {
  damage: number;
  isCritical: boolean;
}

/**
 * Resolves a single attack. `rng` is injectable (defaults to Math.random) purely so
 * tests can assert exact outcomes without flakiness.
 */
export function resolveAttack(
  attacker: DerivedCombatPower,
  defenderDefense: number,
  rng: () => number = Math.random
): AttackResult {
  const isCritical = rng() < attacker.critChance;
  const randomFactor = 0.85 + rng() * 0.3; // 0.85 - 1.15
  const rawDamage = Math.max(1, attacker.attack - defenderDefense * 0.5);
  const damage = Math.max(1, Math.round(rawDamage * randomFactor * (isCritical ? 1.5 : 1)));
  return { damage, isCritical };
}

export interface MonsterCombatant {
  hp: number;
  attack: number;
  defense: number;
}

export interface CombatOutcome {
  playerDamageDealt: number;
  monsterDamageDealt: number;
  monsterHpRemaining: number;
  playerHpRemaining: number;
  victory: boolean;
  playerCritical: boolean;
  monsterCritical: boolean;
}

/**
 * Resolves one round (player attacks, then monster counter-attacks if still alive).
 * Combat sessions accumulate rounds until the monster's HP reaches 0 - this keeps
 * a single "Attack" click fast while still letting stats matter over a session.
 */
export function resolveCombatRound(
  player: DerivedCombatPower,
  playerHp: number,
  monster: MonsterCombatant,
  rng: () => number = Math.random
): CombatOutcome {
  const playerAttack = resolveAttack(player, monster.defense, rng);
  const monsterHpRemaining = Math.max(0, monster.hp - playerAttack.damage);
  const victory = monsterHpRemaining <= 0;

  let monsterDamageDealt = 0;
  let monsterCritical = false;
  let playerHpRemaining = playerHp;

  if (!victory) {
    const monsterAttack = resolveAttack(
      { attack: monster.attack, defense: 0, critChance: 0.1, rewardBonus: 0 },
      player.defense,
      rng
    );
    monsterDamageDealt = monsterAttack.damage;
    monsterCritical = monsterAttack.isCritical;
    playerHpRemaining = Math.max(0, playerHp - monsterDamageDealt);
  }

  return {
    playerDamageDealt: playerAttack.damage,
    monsterDamageDealt,
    monsterHpRemaining,
    playerHpRemaining,
    victory,
    playerCritical: playerAttack.isCritical,
    monsterCritical,
  };
}
