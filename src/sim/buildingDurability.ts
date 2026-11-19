/**
 * Per-Building Structural Resistance Tiers, Armor Mitigation,
 * Critical Fire Threshold & Explosion / Forced-Rebuild Destruction Logic.
 * Pure TypeScript module (zero DOM/Three.js dependencies).
 */

import type { AstronautRoleId } from './astronautRoles';
import {
  BuildingKey,
  ColonyState,
  computeHabitability,
  computeStage,
  computeTotalColonyEnergy,
} from './marsColonyLogic';

export type BuildingArmorTier = 'Leve' | 'Média' | 'Reforçada' | 'Blindada';

export type BuildingCondition = 'intact' | 'damaged' | 'critical' | 'destroyed';

export interface BuildingDurabilitySpec {
  key: BuildingKey;
  tier: BuildingArmorTier;
  maxIntegrity: number; // Effective structural HP (higher = endures longer attacks)
  armor: number; // Flat damage mitigation against weak attacks
  fireThresholdPct: number; // <= this % the structure catches fire & smokes
}

export interface BuildingDamageHit {
  rawDamage: number;
  armorPenetration?: number;
}

export const BUILDING_FIRE_THRESHOLD_PCT = 35;

export const BUILDING_DURABILITY_SPECS: Record<BuildingKey, BuildingDurabilitySpec> = {
  solarPanels: {
    key: 'solarPanels',
    tier: 'Leve',
    maxIntegrity: 180,
    armor: 2,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  commsArray: {
    key: 'commsArray',
    tier: 'Leve',
    maxIntegrity: 200,
    armor: 3,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  moxie: {
    key: 'moxie',
    tier: 'Média',
    maxIntegrity: 280,
    armor: 5,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  waterExtractor: {
    key: 'waterExtractor',
    tier: 'Média',
    maxIntegrity: 300,
    armor: 5,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  autoMiner: {
    key: 'autoMiner',
    tier: 'Média',
    maxIntegrity: 320,
    armor: 6,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  researchLab: {
    key: 'researchLab',
    tier: 'Média',
    maxIntegrity: 340,
    armor: 6,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  bioDome: {
    key: 'bioDome',
    tier: 'Média',
    maxIntegrity: 360,
    armor: 6,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  defenseTurret: {
    key: 'defenseTurret',
    tier: 'Reforçada',
    maxIntegrity: 440,
    armor: 9,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  habitat: {
    key: 'habitat',
    tier: 'Reforçada',
    maxIntegrity: 480,
    armor: 10,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  geothermalPlant: {
    key: 'geothermalPlant',
    tier: 'Blindada',
    maxIntegrity: 620,
    armor: 12,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
  terraformer: {
    key: 'terraformer',
    tier: 'Blindada',
    maxIntegrity: 760,
    armor: 14,
    fireThresholdPct: BUILDING_FIRE_THRESHOLD_PCT,
  },
};

export function getBuildingDurabilitySpec(key: BuildingKey): BuildingDurabilitySpec {
  return BUILDING_DURABILITY_SPECS[key];
}

export function getBuildingCondition(healthPct: number, isBuilt: boolean): BuildingCondition {
  if (!isBuilt || healthPct <= 0) return 'destroyed';
  if (healthPct <= BUILDING_FIRE_THRESHOLD_PCT) return 'critical';
  if (healthPct < 100) return 'damaged';
  return 'intact';
}

export function isBuildingBurning(healthPct: number, isBuilt: boolean): boolean {
  return isBuilt && healthPct > 0 && healthPct <= BUILDING_FIRE_THRESHOLD_PCT;
}

/**
 * Mitigates incoming enemy siege damage using building armor and maxIntegrity.
 * Higher-tier buildings (Reforçada / Blindada) require prolonged or heavy-enemy
 * assaults before needing urgent repair or catching fire.
 */
export function calculateMitigatedBuildingDamage(
  buildingKey: BuildingKey,
  rawDamage: number,
  armorPenetration = 0
): { effectiveDamage: number; hpPercentLoss: number } {
  if (rawDamage <= 0) {
    return { effectiveDamage: 0, hpPercentLoss: 0 };
  }
  const spec = BUILDING_DURABILITY_SPECS[buildingKey];
  const effectiveArmor = Math.max(0, spec.armor - Math.max(0, armorPenetration));
  // Always allow at least 22% chip damage so sustained attacks eventually wear down armor
  const effectiveDamage = Math.max(rawDamage * 0.22, rawDamage - effectiveArmor);
  const hpPercentLoss = (effectiveDamage / spec.maxIntegrity) * 100;
  return {
    effectiveDamage: Number(effectiveDamage.toFixed(2)),
    hpPercentLoss: Number(hpPercentLoss.toFixed(3)),
  };
}

export interface BuildingDamageResolution {
  state: ColonyState;
  destroyedKeys: BuildingKey[];
  newlyCriticalKeys: BuildingKey[];
  damagedKeys: BuildingKey[];
}

/**
 * Applies incoming combat hits to built colony structures:
 * - Mitigates damage via each building's armor & maxIntegrity
 * - Flags structures entering critical fire state (<= 35% integrity)
 * - Destroys & explodes structures reaching 0% integrity, resetting `buildings[key] = false`
 *   so the player must rebuild them from scratch.
 */
export function applyBuildingCombatDamage(
  state: ColonyState,
  hitsByBuilding: Partial<Record<BuildingKey, BuildingDamageHit[]>>,
  activeRoles: AstronautRoleId[] = ['engineer']
): BuildingDamageResolution {
  const keys = Object.keys(hitsByBuilding) as BuildingKey[];
  if (keys.length === 0) {
    return { state, destroyedKeys: [], newlyCriticalKeys: [], damagedKeys: [] };
  }

  let changed = false;
  const nextBuildings = { ...state.buildings };
  const nextHealth = { ...state.buildingHealth };
  let nextOxygenMax = state.oxygenMax;
  let nextOxygen = state.oxygen;

  const destroyedKeys: BuildingKey[] = [];
  const newlyCriticalKeys: BuildingKey[] = [];
  const damagedKeys: BuildingKey[] = [];

  for (const key of keys) {
    if (!nextBuildings[key]) continue;
    const hits = hitsByBuilding[key];
    if (!hits || hits.length === 0) continue;

    const prevHp = nextHealth[key];
    let totalPctLoss = 0;
    for (const hit of hits) {
      totalPctLoss += calculateMitigatedBuildingDamage(
        key,
        hit.rawDamage,
        hit.armorPenetration ?? 0
      ).hpPercentLoss;
    }

    if (totalPctLoss <= 0) continue;
    changed = true;
    damagedKeys.push(key);

    const updatedHp = prevHp - totalPctLoss;
    if (updatedHp <= 0) {
      // Catastrophic failure: structure explodes & must be rebuilt from scratch
      nextBuildings[key] = false;
      nextHealth[key] = 100;
      destroyedKeys.push(key);
      if (key === 'habitat') {
        nextOxygenMax = Math.max(100, nextOxygenMax - 25);
        nextOxygen = Math.min(nextOxygen, nextOxygenMax);
      }
    } else {
      const clampedHp = Number(updatedHp.toFixed(2));
      nextHealth[key] = clampedHp;
      if (prevHp > BUILDING_FIRE_THRESHOLD_PCT && clampedHp <= BUILDING_FIRE_THRESHOLD_PCT) {
        newlyCriticalKeys.push(key);
      }
    }
  }

  if (!changed) {
    return { state, destroyedKeys: [], newlyCriticalKeys: [], damagedKeys: [] };
  }

  const nextState: ColonyState = {
    ...state,
    buildings: nextBuildings,
    buildingHealth: nextHealth,
    oxygenMax: nextOxygenMax,
    oxygen: nextOxygen,
  };

  if (destroyedKeys.length > 0) {
    nextState.energy = computeTotalColonyEnergy(
      nextState.buildings,
      activeRoles,
      nextState.dustStorm.solarEfficiencyMultiplier
    );
    nextState.habitability = computeHabitability(nextState);
    nextState.stage = computeStage(nextState);
  }

  return {
    state: nextState,
    destroyedKeys,
    newlyCriticalKeys,
    damagedKeys,
  };
}
