/**
 * Mars Colony Threats, Enemy AI, Plasma Defense & Module Damage/Repair Simulation
 * Pure TypeScript simulation shared by Solo & 3-Player Co-op.
 */

import { BuildingKey, ColonyState } from './marsColonyLogic';
import { groundHeightAt } from './marsPhysics';

export type EnemyKind = 'crawler' | 'drone' | 'brute';

export interface MarsEnemy {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  attackCooldown: number;
  hitFlashTimer: number;
  targetBuilding: BuildingKey | null;
}

export interface PlasmaBolt {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  life: number;
  fromTurret: boolean;
}

export interface EnemyRewardDrop {
  enemyId: string;
  kind: EnemyKind;
  x: number;
  z: number;
  regolith: number;
  ice: number;
  biomass: number;
}

export const BUILDING_COORDS: Record<BuildingKey, { x: number; z: number; label: string }> = {
  moxie: { x: -7, z: 4, label: 'MOXIE O2' },
  solarPanels: { x: 8, z: 4, label: 'Matriz Solar' },
  waterExtractor: { x: 14, z: -10, label: 'Extrator de Água' },
  autoMiner: { x: 18, z: 7, label: 'Sonda Mineradora' },
  researchLab: { x: -12, z: -6, label: 'Laboratório' },
  defenseTurret: { x: 10, z: -2, label: 'Torre Laser' },
  bioDome: { x: 0, z: -19, label: 'Biodomo' },
  habitat: { x: -11, z: 12, label: 'Habitat' },
  commsArray: { x: 12, z: 14, label: 'Antena Orbital' },
  geothermalPlant: { x: -20, z: -4, label: 'Usina Geotérmica' },
  terraformer: { x: -14, z: -18, label: 'Terraformador' },
};

export function createEnemy(
  kind: EnemyKind,
  x: number,
  z: number,
  seedId: string
): MarsEnemy {
  const gy = groundHeightAt(x, z);
  if (kind === 'drone') {
    return {
      id: seedId,
      kind,
      x,
      y: gy + 1.5,
      z,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 80,
      maxHp: 80,
      speed: 4.8,
      radius: 0.8,
      attackCooldown: 0.8,
      hitFlashTimer: 0,
      targetBuilding: null,
    };
  }
  if (kind === 'brute') {
    return {
      id: seedId,
      kind,
      x,
      y: gy,
      z,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 165,
      maxHp: 165,
      speed: 2.9,
      radius: 1.15,
      attackCooldown: 1.0,
      hitFlashTimer: 0,
      targetBuilding: null,
    };
  }
  return {
    id: seedId,
    kind: 'crawler',
    x,
    y: gy,
    z,
    vx: 0,
    vz: 0,
    yaw: 0,
    hp: 55,
    maxHp: 55,
    speed: 4.1,
    radius: 0.72,
    attackCooldown: 0.8,
    hitFlashTimer: 0,
    targetBuilding: null,
  };
}

export function createPlasmaBolt(
  x: number,
  y: number,
  z: number,
  dirX: number,
  dirZ: number,
  hasPulseMk2: boolean,
  fromTurret = false,
  damageMultiplier = 1.0
): PlasmaBolt {
  const len = Math.hypot(dirX, dirZ) || 1;
  const speed = fromTurret ? 34 : 26;
  const baseDamage = fromTurret ? 28 : hasPulseMk2 ? 44 : 26;
  return {
    id: `bolt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x,
    y,
    z,
    vx: (dirX / len) * speed,
    vz: (dirZ / len) * speed,
    damage: Math.round(baseDamage * damageMultiplier),
    life: 1.4,
    fromTurret,
  };
}

/**
 * Picks a built colony structure for an enemy to raid, or falls back to attacking the player.
 */
function chooseTargetCoords(
  enemy: MarsEnemy,
  colonyState: ColonyState,
  playerPos: { x: number; z: number }
): { x: number; z: number; buildingKey: BuildingKey | null } {
  const builtKeys = (Object.keys(colonyState.buildings) as BuildingKey[]).filter(
    (k) => colonyState.buildings[k] && colonyState.buildingHealth[k] > 15
  );

  // If player is within 10m, chase player directly
  const distPlayer = Math.hypot(playerPos.x - enemy.x, playerPos.z - enemy.z);
  if (distPlayer < 10.5 || builtKeys.length === 0) {
    return { x: playerPos.x, z: playerPos.z, buildingKey: null };
  }

  // Prefer keeping existing valid targetBuilding
  if (
    enemy.targetBuilding &&
    colonyState.buildings[enemy.targetBuilding] &&
    colonyState.buildingHealth[enemy.targetBuilding] > 15
  ) {
    const c = BUILDING_COORDS[enemy.targetBuilding];
    return { x: c.x, z: c.z, buildingKey: enemy.targetBuilding };
  }

  // Otherwise pick nearest built structure
  let bestKey: BuildingKey | null = null;
  let bestDist = Infinity;
  for (const key of builtKeys) {
    const c = BUILDING_COORDS[key];
    const d = Math.hypot(c.x - enemy.x, c.z - enemy.z);
    if (d < bestDist) {
      bestDist = d;
      bestKey = key;
    }
  }
  if (bestKey) {
    const c = BUILDING_COORDS[bestKey];
    return { x: c.x, z: c.z, buildingKey: bestKey };
  }
  return { x: playerPos.x, z: playerPos.z, buildingKey: null };
}

export interface CombatStepResult {
  enemies: MarsEnemy[];
  bolts: PlasmaBolt[];
  kills: EnemyRewardDrop[];
  playerO2Damage: number;
  buildingDamage: Partial<Record<BuildingKey, number>>;
  turretFiredAt: { x: number; y: number; z: number } | null;
}

export function stepEnemiesAndCombat(params: {
  enemies: MarsEnemy[];
  bolts: PlasmaBolt[];
  colonyState: ColonyState;
  playerPos: { x: number; y: number; z: number };
  turretCooldown: number;
  dt: number;
}): { result: CombatStepResult; nextTurretCooldown: number } {
  const dt = Math.min(params.dt, 0.05);
  const nextBolts: PlasmaBolt[] = [];
  const enemies = params.enemies.map((e) => ({ ...e }));
  const kills: EnemyRewardDrop[] = [];
  const buildingDamage: Partial<Record<BuildingKey, number>> = {};
  let playerO2Damage = 0;
  let turretFiredAt: { x: number; y: number; z: number } | null = null;

  // 1. Automated Defense Turret Logic at (10, -2)
  let nextTurretCooldown = Math.max(0, params.turretCooldown - dt);
  if (
    params.colonyState.buildings.defenseTurret &&
    params.colonyState.buildingHealth.defenseTurret > 20 &&
    nextTurretCooldown <= 0 &&
    enemies.length > 0
  ) {
    const hasTurretAI = params.colonyState.unlockedTechs.includes('tech-turret-ai');
    const maxRange = hasTurretAI ? 28 : 19;
    let nearest: MarsEnemy | null = null;
    let bestD = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - 10, e.z + 2);
      if (d < maxRange && d < bestD) {
        bestD = d;
        nearest = e;
      }
    }
    if (nearest) {
      const ty = groundHeightAt(10, -2) + 2.6;
      nextBolts.push(
        createPlasmaBolt(10, ty, -2, nearest.x - 10, nearest.z + 2, hasTurretAI, true)
      );
      turretFiredAt = { x: nearest.x, y: nearest.y + 0.8, z: nearest.z };
      nextTurretCooldown = hasTurretAI ? 0.55 : 0.85;
    }
  }

  // 2. Step Plasma Bolts & Check Collisions against Enemies
  for (const b of params.bolts) {
    const nb: PlasmaBolt = {
      ...b,
      x: b.x + b.vx * dt,
      z: b.z + b.vz * dt,
      life: b.life - dt,
    };
    if (nb.life <= 0) continue;

    let hitEnemy = false;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const dist = Math.hypot(nb.x - enemy.x, nb.z - enemy.z);
      if (dist <= enemy.radius + 0.45) {
        enemy.hp -= nb.damage;
        enemy.hitFlashTimer = 0.16;
        // Knockback
        const bLen = Math.hypot(nb.vx, nb.vz) || 1;
        enemy.x += (nb.vx / bLen) * 0.55;
        enemy.z += (nb.vz / bLen) * 0.55;
        hitEnemy = true;
        break;
      }
    }

    if (!hitEnemy) {
      nextBolts.push(nb);
    }
  }

  // 3. Step Alive Enemies & Collect Kills
  const survivingEnemies: MarsEnemy[] = [];
  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      kills.push({
        enemyId: enemy.id,
        kind: enemy.kind,
        x: enemy.x,
        z: enemy.z,
        regolith: enemy.kind === 'brute' ? 3 : 1,
        ice: enemy.kind === 'drone' ? 2 : 1,
        biomass: enemy.kind === 'brute' ? 2 : enemy.kind === 'crawler' ? 1 : 0,
      });
      continue;
    }

    enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

    const target = chooseTargetCoords(enemy, params.colonyState, params.playerPos);
    enemy.targetBuilding = target.buildingKey;

    const dx = target.x - enemy.x;
    const dz = target.z - enemy.z;
    const dist = Math.hypot(dx, dz);

    const stopDist = target.buildingKey ? 2.4 : 1.4;
    if (dist > stopDist) {
      const dirX = dx / (dist || 1);
      const dirZ = dz / (dist || 1);
      enemy.vx = dirX * enemy.speed;
      enemy.vz = dirZ * enemy.speed;
      enemy.x += enemy.vx * dt;
      enemy.z += enemy.vz * dt;
      enemy.yaw = Math.atan2(dirX, dirZ);
    } else {
      enemy.vx = 0;
      enemy.vz = 0;
      // Attack target if cooldown ready
      if (enemy.attackCooldown <= 0) {
        enemy.attackCooldown = enemy.kind === 'brute' ? 1.6 : 1.3;
        if (target.buildingKey) {
          const dmg = enemy.kind === 'brute' ? 14 : 8;
          buildingDamage[target.buildingKey] = (buildingDamage[target.buildingKey] || 0) + dmg;
        } else {
          playerO2Damage += enemy.kind === 'brute' ? 10 : 6;
        }
      }
    }

    const gy = groundHeightAt(enemy.x, enemy.z);
    enemy.y = enemy.kind === 'drone' ? gy + 1.45 : gy;

    survivingEnemies.push(enemy);
  }

  return {
    result: {
      enemies: survivingEnemies,
      bolts: nextBolts,
      kills,
      playerO2Damage,
      buildingDamage,
      turretFiredAt,
    },
    nextTurretCooldown,
  };
}

/**
 * Finds nearest damaged built structure within repair range
 */
export function findRepairableBuildingNear(
  playerPos: { x: number; z: number },
  colonyState: ColonyState
): { key: BuildingKey; label: string; health: number; x: number; z: number } | null {
  const keys = Object.keys(colonyState.buildings) as BuildingKey[];
  for (const key of keys) {
    if (!colonyState.buildings[key]) continue;
    const hp = colonyState.buildingHealth[key];
    if (hp >= 100) continue;
    const coord = BUILDING_COORDS[key];
    if (Math.hypot(playerPos.x - coord.x, playerPos.z - coord.z) < 4.2) {
      return { key, label: coord.label, health: hp, x: coord.x, z: coord.z };
    }
  }
  return null;
}
