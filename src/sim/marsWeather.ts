/**
 * Dynamic Martian Weather System: Dust Storms ("Tempestade de Poeira")
 * - Triggers randomly every 2–3 Sols once colony construction has begun
 * - Cuts Solar Panel energy efficiency by 50% while active
 * - Accelerates structural integrity degradation across built colony modules
 * - Computes urgent maintenance module priorities for HUD alerts
 */

import type { BuildingKey } from './marsColonyLogic';

export const STORM_SOL_MIN_INTERVAL = 2;
export const STORM_SOL_MAX_INTERVAL = 3;
export const STORM_DURATION_MIN_SEC = 18;
export const STORM_DURATION_MAX_SEC = 28;
export const STORM_SOLAR_EFFICIENCY = 0.5;
export const STORM_MODULE_DEGRADATION_PER_SEC = 1.65;
export const URGENT_MAINTENANCE_THRESHOLD = 75;
export const CRITICAL_MAINTENANCE_THRESHOLD = 45;

export interface DustStormState {
  isActive: boolean;
  remainingSec: number;
  durationSec: number;
  nextStormSol: number;
  solarEfficiencyMultiplier: number; // 1.0 normal, 0.5 during storm
  degradationPerSec: number;
  stormCount: number;
}

export interface UrgentMaintenanceItem {
  key: BuildingKey;
  name: string;
  health: number;
  severity: 'critical' | 'warning';
}

export const BUILDING_DISPLAY_NAMES: Record<BuildingKey, string> = {
  moxie: 'Gerador de Oxigênio (MOXIE)',
  solarPanels: 'Matriz Solar Fotovoltaica',
  waterExtractor: 'Extrator de Água',
  autoMiner: 'Sonda Mineradora',
  researchLab: 'Laboratório de Pesquisa',
  defenseTurret: 'Torre de Defesa Laser',
  bioDome: 'Biodomo Hidropônico',
  habitat: 'Habitat Pressurizado',
  commsArray: 'Antena Orbital',
  geothermalPlant: 'Usina Geotérmica',
  terraformer: 'Processador Atmosférico',
};

export function scheduleNextStormSol(
  currentSol: number,
  rng: () => number = Math.random
): number {
  const span = STORM_SOL_MAX_INTERVAL - STORM_SOL_MIN_INTERVAL + 1;
  const offset = STORM_SOL_MIN_INTERVAL + Math.floor(rng() * span);
  return currentSol + offset;
}

export function createInitialDustStormState(
  rng: () => number = Math.random
): DustStormState {
  return {
    isActive: false,
    remainingSec: 0,
    durationSec: 0,
    nextStormSol: scheduleNextStormSol(0, rng), // Sol 2 or Sol 3
    solarEfficiencyMultiplier: 1.0,
    degradationPerSec: 0,
    stormCount: 0,
  };
}

export function activateDustStorm(
  current: DustStormState,
  rng: () => number = Math.random
): DustStormState {
  const duration = Math.round(
    STORM_DURATION_MIN_SEC +
      rng() * (STORM_DURATION_MAX_SEC - STORM_DURATION_MIN_SEC)
  );
  return {
    isActive: true,
    remainingSec: duration,
    durationSec: duration,
    nextStormSol: current.nextStormSol,
    solarEfficiencyMultiplier: STORM_SOLAR_EFFICIENCY,
    degradationPerSec: STORM_MODULE_DEGRADATION_PER_SEC,
    stormCount: current.stormCount + 1,
  };
}

/**
 * Advances Dust Storm lifecycle, solar efficiency modifier, and structural degradation.
 */
export function stepDustStormLifecycle(params: {
  dustStorm: DustStormState;
  solDay: number;
  buildings: Record<BuildingKey, boolean>;
  buildingHealth: Record<BuildingKey, number>;
  dt: number;
  rng?: () => number;
}): {
  dustStorm: DustStormState;
  buildingHealth: Record<BuildingKey, number>;
  stormStarted: boolean;
  stormEnded: boolean;
} {
  const { dustStorm, solDay, buildings, buildingHealth, dt } = params;
  const rng = params.rng || Math.random;

  const builtKeys = (Object.keys(buildings) as BuildingKey[]).filter(
    (k) => buildings[k]
  );

  // Terraformed planet stabilizes atmosphere and prevents new dust storms
  const isTerraformed = buildings.terraformer;

  if (!dustStorm.isActive) {
    if (!isTerraformed && builtKeys.length > 0 && solDay >= dustStorm.nextStormSol) {
      const startedStorm = activateDustStorm(dustStorm, rng);
      return {
        dustStorm: startedStorm,
        buildingHealth,
        stormStarted: true,
        stormEnded: false,
      };
    }
    return {
      dustStorm,
      buildingHealth,
      stormStarted: false,
      stormEnded: false,
    };
  }

  // Active storm: degrade built modules' integrity & count down duration
  const effectiveDt = Math.min(dt, dustStorm.remainingSec);
  const nextHealth = { ...buildingHealth };
  if (effectiveDt > 0 && builtKeys.length > 0) {
    for (const key of builtKeys) {
      // Enclosed mega-domes / geothermal cores resist slightly better than exposed arrays
      const exposureFactor =
        key === 'solarPanels' || key === 'commsArray'
          ? 1.15
          : key === 'habitat' || key === 'geothermalPlant'
          ? 0.75
          : 1.0;
      const loss = dustStorm.degradationPerSec * exposureFactor * effectiveDt;
      nextHealth[key] = Math.max(12, nextHealth[key] - loss);
    }
  }

  const nextRemaining = dustStorm.remainingSec - dt;
  if (nextRemaining <= 0) {
    return {
      dustStorm: {
        isActive: false,
        remainingSec: 0,
        durationSec: dustStorm.durationSec,
        nextStormSol: scheduleNextStormSol(solDay, rng),
        solarEfficiencyMultiplier: 1.0,
        degradationPerSec: 0,
        stormCount: dustStorm.stormCount,
      },
      buildingHealth: nextHealth,
      stormStarted: false,
      stormEnded: true,
    };
  }

  return {
    dustStorm: {
      ...dustStorm,
      remainingSec: nextRemaining,
    },
    buildingHealth: nextHealth,
    stormStarted: false,
    stormEnded: false,
  };
}

/**
 * Returns built colony structures whose integrity dropped below the urgent maintenance threshold,
 * sorted from most critical to least damaged.
 */
export function getUrgentMaintenanceModules(
  buildings: Record<BuildingKey, boolean>,
  buildingHealth: Record<BuildingKey, number>,
  threshold = URGENT_MAINTENANCE_THRESHOLD
): UrgentMaintenanceItem[] {
  const items: UrgentMaintenanceItem[] = [];
  for (const key of Object.keys(buildings) as BuildingKey[]) {
    if (!buildings[key]) continue;
    const hp = buildingHealth[key];
    if (hp < threshold) {
      items.push({
        key,
        name: BUILDING_DISPLAY_NAMES[key],
        health: Math.round(hp),
        severity: hp < CRITICAL_MAINTENANCE_THRESHOLD ? 'critical' : 'warning',
      });
    }
  }
  items.sort((a, b) => a.health - b.health);
  return items;
}
