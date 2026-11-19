/**
 * Mars Colony Threats, Upgraded Enemy AI (Strafing, Ranged Acid/Plasma, Shockwaves),
 * Weapon Volley Combat (Pistol, Rifle, Shotgun, Piercing Railgun) & Module Repairs.
 */

import { BuildingKey, ColonyState } from './marsColonyLogic';
import { getWeaponDef, WeaponId } from './marsChemistry';
import { groundHeightAt } from './marsPhysics';

export type EnemyKind = 'crawler' | 'drone' | 'brute' | 'stalker';

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
  strafeDir: number; // -1 or 1 for tactical drone/stalker strafing
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
  fromEnemy?: boolean;
  piercing?: boolean;
  weaponId?: WeaponId;
  colorHex?: string;
  hitEnemyIds?: string[];
}

export interface EnemyRewardDrop {
  enemyId: string;
  kind: EnemyKind;
  x: number;
  z: number;
  regolith: number;
  ice: number;
  biomass: number;
  iron: number;
  titanium: number;
  sulfur: number;
}

export const BUILDING_COORDS: Record<BuildingKey, { x: number; z: number; label: string }> = {
  moxie: { x: -7, z: 4, label: 'MOXIE O2' },
  solarPanels: { x: 8, z: 4, label: 'Matriz Solar' },
  waterExtractor: { x: 14, z: -10, label: 'Extrator de Água' },
  autoMiner: { x: 18, z: 7, label: 'Sonda Mineradora' },
  researchLab: { x: -12, z: -6, label: 'Laboratório' },
  defenseTurret: { x: 10, z: -2, label: 'Torre Laser' },
  bioDome: { x: 0, z: -19, label: 'Redoma Biodomo' },
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
  const strafeDir = seedId.charCodeAt(seedId.length - 1) % 2 === 0 ? 1 : -1;

  if (kind === 'drone') {
    return {
      id: seedId,
      kind,
      x,
      y: gy + 1.65,
      z,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 88,
      maxHp: 88,
      speed: 5.1,
      radius: 0.82,
      attackCooldown: 1.1,
      hitFlashTimer: 0,
      strafeDir,
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
      hp: 185,
      maxHp: 185,
      speed: 3.1,
      radius: 1.2,
      attackCooldown: 1.2,
      hitFlashTimer: 0,
      strafeDir,
      targetBuilding: null,
    };
  }
  if (kind === 'stalker') {
    return {
      id: seedId,
      kind,
      x,
      y: gy,
      z,
      vx: 0,
      vz: 0,
      yaw: 0,
      hp: 95,
      maxHp: 95,
      speed: 5.8,
      radius: 0.78,
      attackCooldown: 1.0,
      hitFlashTimer: 0,
      strafeDir,
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
    hp: 60,
    maxHp: 60,
    speed: 4.4,
    radius: 0.75,
    attackCooldown: 0.85,
    hitFlashTimer: 0,
    strafeDir,
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
    colorHex: fromTurret ? '#ef4444' : '#38bdf8',
  };
}

/**
 * Generates 1..4 projectiles based on the astronaut's equipped crafted weapon.
 */
export function createWeaponVolley(params: {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirZ: number;
  weaponId: WeaponId;
  hasPulseMk2: boolean;
  damageMultiplier: number;
}): PlasmaBolt[] {
  const weapon = getWeaponDef(params.weaponId);
  const baseAngle = Math.atan2(params.dirX, params.dirZ);
  const mk2Bonus = params.hasPulseMk2 ? 1.35 : 1.0;
  const dmg = Math.round(weapon.damagePerBolt * mk2Bonus * params.damageMultiplier);
  const count = weapon.boltCount;
  const bolts: PlasmaBolt[] = [];

  for (let i = 0; i < count; i++) {
    const offset =
      count === 1
        ? 0
        : -weapon.spreadRad / 2 + (weapon.spreadRad * i) / (count - 1);
    const angle = baseAngle + offset;
    const vx = Math.sin(angle) * weapon.boltSpeed;
    const vz = Math.cos(angle) * weapon.boltSpeed;
    bolts.push({
      id: `bolt-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      x: params.x,
      y: params.y,
      z: params.z,
      vx,
      vz,
      damage: dmg,
      life: weapon.piercing ? 1.65 : weapon.id === 'ion-shotgun' ? 0.72 : 1.35,
      fromTurret: false,
      piercing: weapon.piercing,
      weaponId: weapon.id,
      colorHex: weapon.boltColorHex,
      hitEnemyIds: [],
    });
  }
  return bolts;
}

function createEnemyProjectile(
  enemy: MarsEnemy,
  targetX: number,
  targetZ: number
): PlasmaBolt {
  const dx = targetX - enemy.x;
  const dz = targetZ - enemy.z;
  const len = Math.hypot(dx, dz) || 1;
  const speed = enemy.kind === 'stalker' ? 16.5 : 14.5;
  return {
    id: `ebolt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    x: enemy.x,
    y: enemy.y + (enemy.kind === 'drone' ? 0.1 : 0.85),
    z: enemy.z,
    vx: (dx / len) * speed,
    vz: (dz / len) * speed,
    damage: enemy.kind === 'stalker' ? 8 : 6,
    life: 1.5,
    fromTurret: false,
    fromEnemy: true,
    colorHex: enemy.kind === 'stalker' ? '#84cc16' : '#fb7185',
  };
}

function chooseTargetCoords(
  enemy: MarsEnemy,
  colonyState: ColonyState,
  playerPos: { x: number; z: number }
): { x: number; z: number; buildingKey: BuildingKey | null } {
  const builtKeys = (Object.keys(colonyState.buildings) as BuildingKey[]).filter(
    (k) => colonyState.buildings[k] && colonyState.buildingHealth[k] > 15
  );

  // Stalkers prefer hunting the astronaut; drones/crawlers engage within 13.5m
  const distPlayer = Math.hypot(playerPos.x - enemy.x, playerPos.z - enemy.z);
  const aggroRange = enemy.kind === 'stalker' ? 22.0 : 13.5;
  if (distPlayer < aggroRange || builtKeys.length === 0) {
    return { x: playerPos.x, z: playerPos.z, buildingKey: null };
  }

  if (
    enemy.targetBuilding &&
    colonyState.buildings[enemy.targetBuilding] &&
    colonyState.buildingHealth[enemy.targetBuilding] > 15
  ) {
    const c = BUILDING_COORDS[enemy.targetBuilding];
    return { x: c.x, z: c.z, buildingKey: enemy.targetBuilding };
  }

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
    const maxRange = hasTurretAI ? 30 : 20;
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
      const ty = groundHeightAt(10, -2, params.colonyState.craters) + 2.6;
      nextBolts.push(
        createPlasmaBolt(10, ty, -2, nearest.x - 10, nearest.z + 2, hasTurretAI, true)
      );
      turretFiredAt = { x: nearest.x, y: nearest.y + 0.8, z: nearest.z };
      nextTurretCooldown = hasTurretAI ? 0.52 : 0.82;
    }
  }

  // 2. Step Player/Turret & Enemy Projectiles
  for (const b of params.bolts) {
    const nb: PlasmaBolt = {
      ...b,
      x: b.x + b.vx * dt,
      z: b.z + b.vz * dt,
      life: b.life - dt,
      hitEnemyIds: b.hitEnemyIds ? [...b.hitEnemyIds] : undefined,
    };
    if (nb.life <= 0) continue;

    if (nb.fromEnemy) {
      // Check collision against astronaut
      const distP = Math.hypot(nb.x - params.playerPos.x, nb.z - params.playerPos.z);
      if (distP <= 0.95) {
        playerO2Damage += nb.damage;
        continue;
      }
      // Check collision against built structures
      let hitBuilding = false;
      for (const k of Object.keys(params.colonyState.buildings) as BuildingKey[]) {
        if (!params.colonyState.buildings[k]) continue;
        const c = BUILDING_COORDS[k];
        if (Math.hypot(nb.x - c.x, nb.z - c.z) <= 1.8) {
          buildingDamage[k] = (buildingDamage[k] || 0) + nb.damage;
          hitBuilding = true;
          break;
        }
      }
      if (!hitBuilding) nextBolts.push(nb);
      continue;
    }

    let consumed = false;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      if (nb.piercing && nb.hitEnemyIds?.includes(enemy.id)) continue;
      const dist = Math.hypot(nb.x - enemy.x, nb.z - enemy.z);
      if (dist <= enemy.radius + 0.5) {
        enemy.hp -= nb.damage;
        enemy.hitFlashTimer = 0.16;
        const bLen = Math.hypot(nb.vx, nb.vz) || 1;
        const knock = nb.weaponId === 'ion-shotgun' ? 0.95 : nb.piercing ? 0.8 : 0.52;
        enemy.x += (nb.vx / bLen) * knock;
        enemy.z += (nb.vz / bLen) * knock;
        if (nb.piercing) {
          nb.hitEnemyIds = [...(nb.hitEnemyIds || []), enemy.id];
        } else {
          consumed = true;
          break;
        }
      }
    }

    if (!consumed) {
      nextBolts.push(nb);
    }
  }

  // 3. Step Alive Enemies with Upgraded Tactical AI
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
        biomass: enemy.kind === 'brute' || enemy.kind === 'stalker' ? 2 : 1,
        iron: enemy.kind === 'brute' ? 3 : enemy.kind === 'drone' ? 2 : 1,
        titanium: enemy.kind === 'brute' ? 2 : enemy.kind === 'stalker' ? 1 : 0,
        sulfur: enemy.kind === 'stalker' ? 2 : enemy.kind === 'crawler' ? 1 : 0,
      });
      continue;
    }

    enemy.hitFlashTimer = Math.max(0, enemy.hitFlashTimer - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

    const target = chooseTargetCoords(enemy, params.colonyState, params.playerPos);
    enemy.targetBuilding = target.buildingKey;

    const dx = target.x - enemy.x;
    const dz = target.z - enemy.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    enemy.yaw = Math.atan2(dirX, dirZ);

    // Tactical ranged strafing for Drones & Stalkers
    if (enemy.kind === 'drone' || enemy.kind === 'stalker') {
      const preferredRange = enemy.kind === 'drone' ? 9.5 : 8.0;
      const strafeX = -dirZ * enemy.strafeDir;
      const strafeZ = dirX * enemy.strafeDir;

      if (dist > preferredRange + 1.5) {
        enemy.vx = (dirX * 0.85 + strafeX * 0.3) * enemy.speed;
        enemy.vz = (dirZ * 0.85 + strafeZ * 0.3) * enemy.speed;
      } else if (dist < preferredRange - 2.0) {
        enemy.vx = (-dirX * 0.45 + strafeX * 0.85) * enemy.speed;
        enemy.vz = (-dirZ * 0.45 + strafeZ * 0.85) * enemy.speed;
      } else {
        enemy.vx = strafeX * enemy.speed * 0.85;
        enemy.vz = strafeZ * enemy.speed * 0.85;
      }
      enemy.x += enemy.vx * dt;
      enemy.z += enemy.vz * dt;

      // Ranged plasma/acid fire
      if (dist <= preferredRange + 5.5 && enemy.attackCooldown <= 0) {
        enemy.attackCooldown = enemy.kind === 'stalker' ? 1.75 : 2.1;
        nextBolts.push(createEnemyProjectile(enemy, target.x, target.z));
      }
    } else {
      // Melee Charger / Flanker AI for Crawlers & Basalt Brutes
      const stopDist = target.buildingKey ? 2.4 : 1.45;
      if (dist > stopDist) {
        const flankFactor = enemy.kind === 'crawler' && dist < 8 ? 0.32 * enemy.strafeDir : 0;
        const moveX = dirX - dirZ * flankFactor;
        const moveZ = dirZ + dirX * flankFactor;
        const mLen = Math.hypot(moveX, moveZ) || 1;
        enemy.vx = (moveX / mLen) * enemy.speed;
        enemy.vz = (moveZ / mLen) * enemy.speed;
        enemy.x += enemy.vx * dt;
        enemy.z += enemy.vz * dt;
      } else {
        enemy.vx = 0;
        enemy.vz = 0;
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = enemy.kind === 'brute' ? 1.65 : 1.25;
          if (target.buildingKey) {
            const dmg = enemy.kind === 'brute' ? 15 : 8;
            buildingDamage[target.buildingKey] = (buildingDamage[target.buildingKey] || 0) + dmg;
          } else {
            playerO2Damage += enemy.kind === 'brute' ? 12 : 6;
          }
        }
      }
    }

    const gy = groundHeightAt(enemy.x, enemy.z, params.colonyState.craters);
    enemy.y = enemy.kind === 'drone' ? gy + 1.6 : gy;

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
