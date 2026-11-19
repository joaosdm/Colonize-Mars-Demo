/**
 * Mars Colonization Progression, Complexity-Timed Construction, Tech Tree & Contracts Engine
 * 6 Eras · 12 Core Missions · 8 Technologies · Timed Construction Queue · Building Integrity & Repairs
 */

import {
  AstronautRoleId,
  computeSquadRoleBonuses,
} from './astronautRoles';
import {
  DustStormState,
  activateDustStorm,
  createInitialDustStormState,
  stepDustStormLifecycle,
} from './marsWeather';
import {
  DailyObjectiveKind,
  DailyObjectiveReward,
  MissionControlState,
  createInitialMissionControlState,
  hasNonZeroReward,
  progressDailyObjectives,
  rerollDailyObjectives,
  syncMissionControlSol,
} from './missionControl';
import {
  CropTypeId,
  DomeCropBed,
  ExcavatedCrater,
  PLANETARY_SITES,
  computeExcavationYield,
  createInitialDomeCrops,
  getCropDef,
  stepDomeCrops,
} from './marsWorld';
import {
  WeaponId,
  craftWeapon,
  executeRefineryRecipe,
  getWeaponDef,
} from './marsChemistry';

export const MARS_GRAVITY = 3.72; // m/s^2 (0.38g)

export type TechId =
  | 'tech-jetpack'
  | 'tech-magnet'
  | 'tech-robotics'
  | 'tech-pulse'
  | 'tech-hydro'
  | 'tech-turret-ai'
  | 'tech-geothermal'
  | 'tech-terraform';

export type BuildingKey =
  | 'moxie'
  | 'solarPanels'
  | 'waterExtractor'
  | 'autoMiner'
  | 'researchLab'
  | 'defenseTurret'
  | 'bioDome'
  | 'habitat'
  | 'commsArray'
  | 'geothermalPlant'
  | 'terraformer';

export interface TechDefinition {
  id: TechId;
  name: string;
  description: string;
  durationSec: number;
  cost: {
    regolith: number;
    water: number;
    biomass: number;
  };
  prerequisite?: TechId;
}

export const TECH_CATALOG: TechDefinition[] = [
  {
    id: 'tech-jetpack',
    name: 'Propulsor EVA Mk.II',
    description: '+45% autonomia do Jetpack e +18% velocidade em baixa gravidade.',
    durationSec: 6,
    cost: { regolith: 3, water: 1, biomass: 0 },
  },
  {
    id: 'tech-magnet',
    name: 'Imã Orbital de Coleta',
    description: 'Dobra o raio de atração magnética de cristais e regolito (8.5m).',
    durationSec: 6,
    cost: { regolith: 4, water: 2, biomass: 0 },
  },
  {
    id: 'tech-robotics',
    name: 'Drones Construtores',
    description: 'Aumenta em +45% a velocidade de construção de todas as estruturas.',
    durationSec: 8,
    cost: { regolith: 4, water: 2, biomass: 0 },
  },
  {
    id: 'tech-pulse',
    name: 'Rifle de Pulso Mk.II',
    description: '+70% dano de plasma contra ameaças marcianas e recarga rápida.',
    durationSec: 8,
    cost: { regolith: 4, water: 2, biomass: 0 },
  },
  {
    id: 'tech-hydro',
    name: 'Sementes Bioengenheiradas',
    description: 'Desbloqueia o Biodomo Hidropônico e dobra o cultivo de biomassa.',
    durationSec: 8,
    cost: { regolith: 4, water: 3, biomass: 0 },
  },
  {
    id: 'tech-turret-ai',
    name: 'Mira Laser Tática',
    description: '+60% alcance e cadência das Torres de Defesa da colônia.',
    durationSec: 10,
    cost: { regolith: 4, water: 3, biomass: 1 },
    prerequisite: 'tech-robotics',
  },
  {
    id: 'tech-geothermal',
    name: 'Perfuração Geotérmica',
    description: 'Desbloqueia a Usina Geotérmica profunda (+80 kW de energia).',
    durationSec: 11,
    cost: { regolith: 5, water: 4, biomass: 1 },
    prerequisite: 'tech-robotics',
  },
  {
    id: 'tech-terraform',
    name: 'Núcleo Atmosférico',
    description: 'Habilita o Processador de Terraformação para criar um mundo vivo.',
    durationSec: 12,
    cost: { regolith: 6, water: 5, biomass: 4 },
    prerequisite: 'tech-hydro',
  },
];

export interface ConstructionProjectConfig {
  id: string; // e.g. 'trigger-moxie'
  buildingKey?: BuildingKey;
  plotIndex?: number;
  name: string;
  complexity: 'Simples' | 'Intermediária' | 'Avançada' | 'Megaestrutura';
  durationSec: number; // Base build time in seconds
  cost: {
    regolith: number;
    waterIce: number;
    water: number;
    biomass: number;
  };
  requiredTech?: TechId;
}

export const CONSTRUCTION_CONFIGS: Record<string, ConstructionProjectConfig> = {
  'trigger-moxie': {
    id: 'trigger-moxie',
    buildingKey: 'moxie',
    name: 'Gerador de Oxigênio (MOXIE)',
    complexity: 'Simples',
    durationSec: 4,
    cost: { regolith: 0, waterIce: 0, water: 0, biomass: 0 },
  },
  'trigger-solar': {
    id: 'trigger-solar',
    buildingKey: 'solarPanels',
    name: 'Matriz Solar Fotovoltaica',
    complexity: 'Simples',
    durationSec: 6,
    cost: { regolith: 4, waterIce: 0, water: 0, biomass: 0 },
  },
  'trigger-water': {
    id: 'trigger-water',
    buildingKey: 'waterExtractor',
    name: 'Extrator & Purificador de Água',
    complexity: 'Intermediária',
    durationSec: 10,
    cost: { regolith: 2, waterIce: 5, water: 0, biomass: 0 },
  },
  'trigger-miner': {
    id: 'trigger-miner',
    buildingKey: 'autoMiner',
    name: 'Sonda Mineradora Automática',
    complexity: 'Intermediária',
    durationSec: 12,
    cost: { regolith: 4, waterIce: 0, water: 2, biomass: 0 },
  },
  'trigger-lab': {
    id: 'trigger-lab',
    buildingKey: 'researchLab',
    name: 'Laboratório de Pesquisa',
    complexity: 'Avançada',
    durationSec: 14,
    cost: { regolith: 5, waterIce: 0, water: 3, biomass: 0 },
  },
  'trigger-turret': {
    id: 'trigger-turret',
    buildingKey: 'defenseTurret',
    name: 'Torre de Defesa Laser',
    complexity: 'Intermediária',
    durationSec: 10,
    cost: { regolith: 4, waterIce: 0, water: 2, biomass: 0 },
  },
  'trigger-biodome': {
    id: 'trigger-biodome',
    buildingKey: 'bioDome',
    name: 'Biodomo Hidropônico',
    complexity: 'Avançada',
    durationSec: 18,
    cost: { regolith: 5, waterIce: 0, water: 4, biomass: 0 },
    requiredTech: 'tech-hydro',
  },
  'trigger-plant-0': {
    id: 'trigger-plant-0',
    plotIndex: 0,
    name: 'Canteiro Hidropônico #1',
    complexity: 'Simples',
    durationSec: 5,
    cost: { regolith: 0, waterIce: 0, water: 2, biomass: 0 },
  },
  'trigger-plant-1': {
    id: 'trigger-plant-1',
    plotIndex: 1,
    name: 'Canteiro Hidropônico #2',
    complexity: 'Simples',
    durationSec: 5,
    cost: { regolith: 0, waterIce: 0, water: 2, biomass: 0 },
  },
  'trigger-plant-2': {
    id: 'trigger-plant-2',
    plotIndex: 2,
    name: 'Canteiro Hidropônico #3',
    complexity: 'Simples',
    durationSec: 5,
    cost: { regolith: 0, waterIce: 0, water: 2, biomass: 0 },
  },
  'trigger-habitat': {
    id: 'trigger-habitat',
    buildingKey: 'habitat',
    name: 'Habitat Pressurizado & Enfermaria',
    complexity: 'Avançada',
    durationSec: 16,
    cost: { regolith: 6, waterIce: 0, water: 4, biomass: 2 },
  },
  'trigger-comms': {
    id: 'trigger-comms',
    buildingKey: 'commsArray',
    name: 'Antena de Comunicação Orbital',
    complexity: 'Avançada',
    durationSec: 18,
    cost: { regolith: 5, waterIce: 0, water: 4, biomass: 0 },
  },
  'trigger-geothermal': {
    id: 'trigger-geothermal',
    buildingKey: 'geothermalPlant',
    name: 'Usina Geotérmica Profunda',
    complexity: 'Megaestrutura',
    durationSec: 22,
    cost: { regolith: 6, waterIce: 0, water: 5, biomass: 0 },
    requiredTech: 'tech-geothermal',
  },
  'trigger-terraform': {
    id: 'trigger-terraform',
    buildingKey: 'terraformer',
    name: 'Processador Atmosférico Global',
    complexity: 'Megaestrutura',
    durationSec: 26,
    cost: { regolith: 8, waterIce: 0, water: 6, biomass: 5 },
    requiredTech: 'tech-terraform',
  },
};

export interface ActiveConstruction {
  id: string; // matches CONSTRUCTION_CONFIGS key
  name: string;
  complexity: ConstructionProjectConfig['complexity'];
  elapsedSec: number;
  durationSec: number;
}

export interface ActiveTechResearch {
  techId: TechId;
  name: string;
  elapsedSec: number;
  durationSec: number;
}

export interface DynamicContract {
  id: string;
  title: string;
  rewardText: string;
  kind: 'kill-enemies' | 'collect-regolith' | 'produce-biomass' | 'repair-module';
  progress: number;
  target: number;
}

export interface ColonyObjective {
  id: string;
  stageNumber: number;
  eraLabel: string;
  title: string;
  description: string;
  targetLocation: { x: number; z: number };
  rewardText: string;
}

export interface ColonyState {
  stage: number; // 0..12
  oxygen: number; // 0..oxygenMax
  oxygenMax: number;
  energy: number; // kW
  regolith: number;
  waterIce: number;
  water: number;
  biomass: number;
  iron: number;
  titanium: number;
  silicon: number;
  sulfur: number;
  fuel: number;
  food: number;
  hunger: number; // 0..100% astronaut nutrition / satiety
  habitability: number; // 0..100%
  solDay: number;
  isNearO2Source: boolean;
  isSandboxMode: boolean;
  threatsEnabled: boolean;
  enemiesDefeated: number;
  buildings: Record<BuildingKey, boolean>;
  buildingHealth: Record<BuildingKey, number>; // 0..100
  activeConstructions: ActiveConstruction[];
  activeTechResearch: ActiveTechResearch | null;
  dustStorm: DustStormState;
  cropsPlantedCount: number; // 0..3 exterior plots
  domeCrops: DomeCropBed[]; // 4 glass-dome food cultivation beds
  craftedWeapons: WeaponId[];
  equippedWeapon: WeaponId;
  craters: ExcavatedCrater[];
  discoveredSites: string[];
  unlockedTechs: TechId[];
  activeContract: DynamicContract | null;
  missionControl: MissionControlState;
  waterGenAccumulator: number;
  biomassGenAccumulator: number;
  minerGenAccumulator: number;
  solAccumulator: number;
}

export const INITIAL_OBJECTIVES: ColonyObjective[] = [
  {
    id: 'obj-1-moxie',
    stageNumber: 1,
    eraLabel: 'ERA 1 · SOBREVIVÊNCIA',
    title: '1. Habilitar Gerador de Oxigênio (MOXIE)',
    description: 'Inicie a construção do MOXIE (4s) ao lado da nave para gerar cúpula de O2.',
    targetLocation: { x: -7, z: 4 },
    rewardText: 'Aura de O2 · 10% Habitabilidade',
  },
  {
    id: 'obj-2-solar',
    stageNumber: 2,
    eraLabel: 'ERA 1 · ENERGIA LIMPA',
    title: '2. Coletar 4 Regolitos e Erguer Matriz Solar',
    description: 'Colete blocos amarelos e inicie a obra da Matriz Solar (6s).',
    targetLocation: { x: 8, z: 4 },
    rewardText: '+30 kW Energia · 16% Habitabilidade',
  },
  {
    id: 'obj-3-water',
    stageNumber: 3,
    eraLabel: 'ERA 2 · CRIAR ÁGUA',
    title: '3. Coletar 5 Gelos, 2 Regolito e Criar Extrator de Água',
    description: 'Construa o purificador (10s) para produzir água líquida e encher bacias.',
    targetLocation: { x: 14, z: -10 },
    rewardText: 'Água Líquida Contínua · 24% Habitabilidade',
  },
  {
    id: 'obj-4-miner',
    stageNumber: 4,
    eraLabel: 'ERA 2 · AUTOMAÇÃO MINERAL',
    title: '4. Construir Sonda Mineradora Automática',
    description: 'Erga a Sonda Mineradora (12s) para extrair Regolito e Gelo automaticamente.',
    targetLocation: { x: 18, z: 7 },
    rewardText: 'Mineração Automática · 32% Habitabilidade',
  },
  {
    id: 'obj-5-lab',
    stageNumber: 5,
    eraLabel: 'ERA 3 · CIÊNCIA & TECNOLOGIA',
    title: '5. Construir Laboratório e Pesquisar Tecnologia [T]',
    description: 'Construa o Lab (14s) e pesquise uma tecnologia no painel [T].',
    targetLocation: { x: -12, z: -6 },
    rewardText: '8 Tecnologias · 42% Habitabilidade',
  },
  {
    id: 'obj-6-turret',
    stageNumber: 6,
    eraLabel: 'ERA 3 · DEFESA DA COLÔNIA',
    title: '6. Construir Torre de Defesa Laser',
    description: 'Erga a torre automatizada (10s) para defender módulos contra invasões.',
    targetLocation: { x: 10, z: -2 },
    rewardText: 'Defesa Laser Ativa · 50% Habitabilidade',
  },
  {
    id: 'obj-7-biodome',
    stageNumber: 7,
    eraLabel: 'ERA 4 · PLANTAR VIDA',
    title: '7. Pesquisar Sementes Bio [T] e Erguer Biodomo',
    description: 'Pesquise Sementes Bioengenheiradas e construa o Biodomo (18s).',
    targetLocation: { x: 0, z: -19 },
    rewardText: 'Estufa Pressurizada · 60% Habitabilidade',
  },
  {
    id: 'obj-8-plant',
    stageNumber: 8,
    eraLabel: 'ERA 4 · CULTIVO MARCIANO',
    title: '8. Plantar e Irrigar 3 Canteiros Hidropônicos',
    description: 'Inicie o plantio nos 3 canteiros ao redor do Biodomo (5s cada).',
    targetLocation: { x: 5, z: -22 },
    rewardText: 'Produção de Biomassa · 72% Habitabilidade',
  },
  {
    id: 'obj-9-habitat',
    stageNumber: 9,
    eraLabel: 'ERA 5 · EXPANSÃO HUMANA',
    title: '9. Construir Habitat Pressurizado & Enfermaria',
    description: 'Erga o Habitat dos colonos (16s) para ampliar O2 máximo e proteção.',
    targetLocation: { x: -11, z: 12 },
    rewardText: '+25% O2 Máx · 80% Habitabilidade',
  },
  {
    id: 'obj-10-comms',
    stageNumber: 10,
    eraLabel: 'ERA 5 · REDE ORBITAL',
    title: '10. Construir Antena de Comunicação Orbital',
    description: 'Erga a Antena Orbital (18s) para desbloquear contratos e suprimentos.',
    targetLocation: { x: 12, z: 14 },
    rewardText: 'Contratos Orbitais · 86% Habitabilidade',
  },
  {
    id: 'obj-11-geothermal',
    stageNumber: 11,
    eraLabel: 'ERA 6 · ENERGIA PROFUNDA',
    title: '11. Pesquisar Perfuração [T] e Erguer Usina Geotérmica',
    description: 'Pesquise Drones + Perfuração Geotérmica e construa a Usina (22s).',
    targetLocation: { x: -20, z: -4 },
    rewardText: '+80 kW Energia · 92% Habitabilidade',
  },
  {
    id: 'obj-12-terraform',
    stageNumber: 12,
    eraLabel: 'ERA 6 · CRIAR UM MUNDO',
    title: '12. Construir Processador Atmosférico Global',
    description: 'Pesquise Núcleo Atmosférico [T] e conclua a megaestrutura (26s)!',
    targetLocation: { x: -14, z: -18 },
    rewardText: 'Céu Azul, Lagos e Flora · 100% Habitabilidade!',
  },
];

export function computeTotalColonyEnergy(
  buildings: Record<BuildingKey, boolean>,
  activeRoles: AstronautRoleId[] = ['engineer'],
  solarEfficiencyMultiplier = 1.0
): number {
  const squad = computeSquadRoleBonuses(activeRoles);
  const solarPower = buildings.solarPanels ? 30 * solarEfficiencyMultiplier : 0;
  const geoPower = buildings.geothermalPlant ? 80 : 0;
  const plantPower = solarPower + geoPower;
  return 15 + Math.round(plantPower * squad.energyGenerationMultiplier) + squad.energyFlatBonusKw;
}

export function createInitialColonyState(
  threatsEnabled = true,
  activeRoles: AstronautRoleId[] = ['engineer']
): ColonyState {
  const initialBuildings: Record<BuildingKey, boolean> = {
    moxie: false,
    solarPanels: false,
    waterExtractor: false,
    autoMiner: false,
    researchLab: false,
    defenseTurret: false,
    bioDome: false,
    habitat: false,
    commsArray: false,
    geothermalPlant: false,
    terraformer: false,
  };

  return {
    stage: 0,
    oxygen: 100,
    oxygenMax: 100,
    energy: computeTotalColonyEnergy(initialBuildings, activeRoles, 1.0),
    regolith: 0,
    waterIce: 0,
    water: 2,
    biomass: 0,
    iron: 2,
    titanium: 0,
    silicon: 2,
    sulfur: 0,
    fuel: 4,
    food: 6,
    hunger: 100,
    habitability: 4,
    solDay: 1,
    isNearO2Source: true,
    isSandboxMode: false,
    threatsEnabled,
    enemiesDefeated: 0,
    buildings: initialBuildings,
    buildingHealth: {
      moxie: 100,
      solarPanels: 100,
      waterExtractor: 100,
      autoMiner: 100,
      researchLab: 100,
      defenseTurret: 100,
      bioDome: 100,
      habitat: 100,
      commsArray: 100,
      geothermalPlant: 100,
      terraformer: 100,
    },
    activeConstructions: [],
    activeTechResearch: null,
    dustStorm: createInitialDustStormState(),
    cropsPlantedCount: 0,
    domeCrops: createInitialDomeCrops(),
    craftedWeapons: ['pulse-pistol'],
    equippedWeapon: 'pulse-pistol',
    craters: [],
    discoveredSites: [],
    unlockedTechs: [],
    activeContract: null,
    missionControl: createInitialMissionControlState(1, threatsEnabled),
    waterGenAccumulator: 0,
    biomassGenAccumulator: 0,
    minerGenAccumulator: 0,
    solAccumulator: 0,
  };
}

export function computeHabitability(state: ColonyState): number {
  let hab = 4;
  if (state.buildings.moxie) hab += 6; // 10
  if (state.buildings.solarPanels) hab += 6; // 16
  if (state.buildings.waterExtractor) hab += 8; // 24
  if (state.buildings.autoMiner) hab += 8; // 32
  if (state.buildings.researchLab) hab += 6; // 38
  if (state.unlockedTechs.length > 0) hab += 4; // 42
  if (state.buildings.defenseTurret) hab += 8; // 50
  if (state.buildings.bioDome) hab += 10; // 60
  hab += Math.min(3, state.cropsPlantedCount) * 4; // +12 -> 72
  if (state.buildings.habitat) hab += 8; // 80
  if (state.buildings.commsArray) hab += 6; // 86
  if (state.buildings.geothermalPlant) hab += 6; // 92
  if (state.buildings.terraformer) hab = 100;
  return Math.min(100, hab);
}

export function computeStage(state: ColonyState): number {
  if (!state.buildings.moxie) return 0;
  if (!state.buildings.solarPanels) return 1;
  if (!state.buildings.waterExtractor) return 2;
  if (!state.buildings.autoMiner) return 3;
  if (!state.buildings.researchLab || state.unlockedTechs.length === 0) return 4;
  if (!state.buildings.defenseTurret) return 5;
  if (!state.buildings.bioDome) return 6;
  if (state.cropsPlantedCount < 3) return 7;
  if (!state.buildings.habitat) return 8;
  if (!state.buildings.commsArray) return 9;
  if (!state.buildings.geothermalPlant) return 10;
  if (!state.buildings.terraformer) return 11;
  return 12;
}

export function canStartConstruction(
  triggerId: string,
  state: ColonyState,
  plantedPlots: number[]
): { ok: boolean; reason?: string } {
  const cfg = CONSTRUCTION_CONFIGS[triggerId];
  if (!cfg) return { ok: false, reason: 'Projeto desconhecido' };

  if (state.activeConstructions.some((c) => c.id === triggerId)) {
    return { ok: false, reason: 'Obra já em andamento' };
  }

  if (cfg.buildingKey && state.buildings[cfg.buildingKey]) {
    return { ok: false, reason: 'Já construído' };
  }

  if (cfg.plotIndex !== undefined && plantedPlots.includes(cfg.plotIndex)) {
    return { ok: false, reason: 'Canteiro já plantado' };
  }

  if (cfg.requiredTech && !state.unlockedTechs.includes(cfg.requiredTech)) {
    const tech = TECH_CATALOG.find((t) => t.id === cfg.requiredTech);
    return { ok: false, reason: `Requer tecnologia "${tech?.name || cfg.requiredTech}" [T]` };
  }

  if (
    state.regolith < cfg.cost.regolith ||
    state.waterIce < cfg.cost.waterIce ||
    state.water < cfg.cost.water ||
    state.biomass < cfg.cost.biomass
  ) {
    return { ok: false, reason: 'Recursos insuficientes' };
  }

  return { ok: true };
}

/**
 * Starts a complexity-timed construction project by spending resources immediately
 * and adding it to `activeConstructions`.
 */
export function startConstruction(
  triggerId: string,
  state: ColonyState,
  plantedPlots: number[]
): { state: ColonyState; started: boolean } {
  const check = canStartConstruction(triggerId, state, plantedPlots);
  if (!check.ok) return { state, started: false };

  const cfg = CONSTRUCTION_CONFIGS[triggerId];
  const next: ColonyState = {
    ...state,
    regolith: state.regolith - cfg.cost.regolith,
    waterIce: state.waterIce - cfg.cost.waterIce,
    water: state.water - cfg.cost.water,
    biomass: state.biomass - cfg.cost.biomass,
    activeConstructions: [
      ...state.activeConstructions,
      {
        id: cfg.id,
        name: cfg.name,
        complexity: cfg.complexity,
        elapsedSec: 0,
        durationSec: cfg.durationSec,
      },
    ],
  };

  return { state: next, started: true };
}

/**
 * Advances active construction sites (passive + proximity worker/role boost) and completes finished ones.
 * workerPowerBySiteId maps triggerId -> summed buildSpeedMultiplier of nearby workers (e.g., Engineer = 1.75).
 */
export function advanceConstructions(
  state: ColonyState,
  plantedPlots: number[],
  dt: number,
  workerPowerBySiteId: Record<string, number> = {},
  activeRoles: AstronautRoleId[] = ['engineer']
): {
  state: ColonyState;
  completedIds: string[];
  nextPlantedPlots: number[];
} {
  if (state.activeConstructions.length === 0) {
    return { state, completedIds: [], nextPlantedPlots: plantedPlots };
  }

  const techMult = state.unlockedTechs.includes('tech-robotics') ? 1.45 : 1.0;
  const completedIds: string[] = [];
  const remaining: ActiveConstruction[] = [];

  for (const job of state.activeConstructions) {
    const workerPower = workerPowerBySiteId[job.id] || 0;
    // Base speed 1.0 + 1.2 * summed worker role build power nearby
    const speedMult = techMult * (1.0 + workerPower * 1.2);
    const nextElapsed = job.elapsedSec + dt * speedMult;

    if (nextElapsed >= job.durationSec) {
      completedIds.push(job.id);
    } else {
      remaining.push({ ...job, elapsedSec: nextElapsed });
    }
  }

  if (completedIds.length === 0) {
    return {
      state: { ...state, activeConstructions: remaining },
      completedIds: [],
      nextPlantedPlots: plantedPlots,
    };
  }

  let nextState: ColonyState = {
    ...state,
    activeConstructions: remaining,
    buildings: { ...state.buildings },
  };
  const nextPlots = [...plantedPlots];

  for (const doneId of completedIds) {
    const cfg = CONSTRUCTION_CONFIGS[doneId];
    if (!cfg) continue;

    if (cfg.buildingKey) {
      nextState.buildings[cfg.buildingKey] = true;
      if (cfg.buildingKey === 'moxie' || cfg.buildingKey === 'bioDome') {
        nextState.oxygen = nextState.oxygenMax;
      }
      if (cfg.buildingKey === 'waterExtractor') {
        nextState.water += 4;
      }
      if (cfg.buildingKey === 'habitat') {
        nextState.oxygenMax += 25;
        nextState.oxygen = nextState.oxygenMax;
        nextState.missionControl = createInitialMissionControlState(
          nextState.solDay,
          nextState.threatsEnabled
        );
      }
      if (cfg.buildingKey === 'commsArray' && !nextState.activeContract) {
        nextState.activeContract = generateNextContract(1);
      }
    }

    if (cfg.plotIndex !== undefined && !nextPlots.includes(cfg.plotIndex)) {
      nextPlots.push(cfg.plotIndex);
      nextState.biomass += 2;
      nextState.cropsPlantedCount = nextPlots.length;
    }
  }

  if (nextState.buildings.habitat && completedIds.length > 0) {
    nextState = applyMissionControlProgress(nextState, 'complete-build', completedIds.length).state;
  }

  nextState.energy = computeTotalColonyEnergy(
    nextState.buildings,
    activeRoles,
    nextState.dustStorm.solarEfficiencyMultiplier
  );
  nextState.habitability = computeHabitability(nextState);
  nextState.stage = computeStage(nextState);

  return { state: nextState, completedIds, nextPlantedPlots: nextPlots };
}

/**
 * Manual instant construction boost pulse when pressing [E] / Action near active build
 */
export function boostConstruction(
  state: ColonyState,
  triggerId: string,
  plantedPlots: number[],
  boostSec = 1.4,
  activeRoles: AstronautRoleId[] = ['engineer']
): {
  state: ColonyState;
  completedIds: string[];
  nextPlantedPlots: number[];
} {
  const idx = state.activeConstructions.findIndex((c) => c.id === triggerId);
  if (idx === -1) return { state, completedIds: [], nextPlantedPlots: plantedPlots };
  return advanceConstructions(state, plantedPlots, boostSec, { [triggerId]: 0 }, activeRoles);
}

export function canResearchTech(techId: TechId, state: ColonyState): boolean {
  if (!state.buildings.researchLab) return false;
  if (state.unlockedTechs.includes(techId)) return false;
  if (state.activeTechResearch) return false;

  const tech = TECH_CATALOG.find((t) => t.id === techId);
  if (!tech) return false;
  if (tech.prerequisite && !state.unlockedTechs.includes(tech.prerequisite)) {
    return false;
  }

  return (
    state.regolith >= tech.cost.regolith &&
    state.water >= tech.cost.water &&
    state.biomass >= tech.cost.biomass
  );
}

function finalizeUnlockedTech(techId: TechId, state: ColonyState): ColonyState {
  if (state.unlockedTechs.includes(techId)) return state;
  const nextState: ColonyState = {
    ...state,
    activeTechResearch: null,
    unlockedTechs: [...state.unlockedTechs, techId],
    oxygenMax: techId === 'tech-jetpack' ? state.oxygenMax + 25 : state.oxygenMax,
  };
  nextState.habitability = computeHabitability(nextState);
  nextState.stage = computeStage(nextState);
  return nextState;
}

/**
 * Starts timed technology research (Scientist role accelerates research speed).
 */
export function startTechResearch(
  techId: TechId,
  state: ColonyState
): { state: ColonyState; started: boolean } {
  if (!canResearchTech(techId, state)) return { state, started: false };
  const tech = TECH_CATALOG.find((t) => t.id === techId)!;

  return {
    started: true,
    state: {
      ...state,
      regolith: state.regolith - tech.cost.regolith,
      water: state.water - tech.cost.water,
      biomass: state.biomass - tech.cost.biomass,
      activeTechResearch: {
        techId: tech.id,
        name: tech.name,
        elapsedSec: 0,
        durationSec: tech.durationSec,
      },
    },
  };
}

/**
 * Advances active technology research using Scientist speed bonus.
 */
export function advanceTechResearch(
  state: ColonyState,
  dt: number,
  activeRoles: AstronautRoleId[] = ['engineer']
): { state: ColonyState; completedTechId: TechId | null } {
  const job = state.activeTechResearch;
  if (!job) return { state, completedTechId: null };

  const squad = computeSquadRoleBonuses(activeRoles);
  const nextElapsed = job.elapsedSec + dt * squad.techResearchSpeedMultiplier;

  if (nextElapsed >= job.durationSec) {
    return {
      state: finalizeUnlockedTech(job.techId, state),
      completedTechId: job.techId,
    };
  }

  return {
    state: {
      ...state,
      activeTechResearch: { ...job, elapsedSec: nextElapsed },
    },
    completedTechId: null,
  };
}

/**
 * Synchronous research completion helper (used in instant/unit tests).
 */
export function applyTechResearch(techId: TechId, state: ColonyState): ColonyState {
  if (!canResearchTech(techId, state)) return state;
  const tech = TECH_CATALOG.find((t) => t.id === techId)!;

  const spent: ColonyState = {
    ...state,
    regolith: state.regolith - tech.cost.regolith,
    water: state.water - tech.cost.water,
    biomass: state.biomass - tech.cost.biomass,
  };
  return finalizeUnlockedTech(techId, spent);
}

export function generateNextContract(seed: number): DynamicContract {
  const templates: Array<Omit<DynamicContract, 'progress'>> = [
    {
      id: `contract-enemies-${seed}`,
      title: 'Patrulha da Cratera: Neutralizar 3 Ameaças',
      rewardText: '+4 Regolito · +3 Água',
      kind: 'kill-enemies',
      target: 3,
    },
    {
      id: `contract-regolith-${seed}`,
      title: 'Suprimento Orbital: Coletar 5 Regolitos',
      rewardText: '+4 Água · +2 Biomassa',
      kind: 'collect-regolith',
      target: 5,
    },
    {
      id: `contract-repair-${seed}`,
      title: 'Manutenção Preventiva: Reparar 1 Módulo',
      rewardText: '+3 Regolito · +3 Água',
      kind: 'repair-module',
      target: 1,
    },
  ];
  const pick = templates[Math.abs(seed) % templates.length];
  return { ...pick, progress: 0 };
}

export function progressContract(
  state: ColonyState,
  kind: DynamicContract['kind'],
  amount = 1
): { state: ColonyState; completedContractTitle: string | null } {
  const contract = state.activeContract;
  if (!contract || contract.kind !== kind) {
    return { state, completedContractTitle: null };
  }

  const nextProg = contract.progress + amount;
  if (nextProg < contract.target) {
    return {
      state: {
        ...state,
        activeContract: { ...contract, progress: nextProg },
      },
      completedContractTitle: null,
    };
  }

  // Grant contract reward & issue next contract
  const seed = state.solDay + state.enemiesDefeated + 1;
  let bonusReg = 0;
  let bonusWater = 0;
  let bonusBio = 0;
  if (kind === 'kill-enemies') {
    bonusReg = 4;
    bonusWater = 3;
  } else if (kind === 'collect-regolith') {
    bonusWater = 4;
    bonusBio = 2;
  } else {
    bonusReg = 3;
    bonusWater = 3;
  }

  return {
    state: {
      ...state,
      regolith: state.regolith + bonusReg,
      water: state.water + bonusWater,
      biomass: state.biomass + bonusBio,
      activeContract: state.buildings.commsArray ? generateNextContract(seed) : null,
    },
    completedContractTitle: contract.title,
  };
}

export function updateColonyTick(
  state: ColonyState,
  deltaSeconds: number,
  isNearO2Source: boolean
): ColonyState {
  let nextO2 = state.oxygen;

  if (isNearO2Source || state.buildings.terraformer) {
    nextO2 = Math.min(state.oxygenMax, nextO2 + 24 * deltaSeconds);
  } else {
    const drainMultiplier = state.buildings.moxie ? 0.55 : 1.0;
    nextO2 = Math.max(0, nextO2 - 0.62 * drainMultiplier * deltaSeconds);
  }

  // Passive Water Extractor (halted if broken below 20% health)
  let nextWater = state.water;
  let waterAcc = state.waterGenAccumulator;
  let waterGained = 0;
  if (state.buildings.waterExtractor && state.buildingHealth.waterExtractor > 20) {
    const eff = state.buildingHealth.waterExtractor / 100;
    const waterRate = (state.unlockedTechs.includes('tech-hydro') ? 0.55 : 0.35) * eff;
    waterAcc += deltaSeconds * waterRate;
    if (waterAcc >= 1.0) {
      waterGained = Math.floor(waterAcc);
      nextWater += waterGained;
      waterAcc -= waterGained;
    }
  }

  // Passive Auto Miner (produces alternating Regolith & Ice)
  let nextRegolith = state.regolith;
  let nextIce = state.waterIce;
  let minerAcc = state.minerGenAccumulator;
  let minerRegGained = 0;
  let minerIceGained = 0;
  if (state.buildings.autoMiner && state.buildingHealth.autoMiner > 20) {
    const eff = state.buildingHealth.autoMiner / 100;
    minerAcc += deltaSeconds * 0.22 * eff;
    if (minerAcc >= 1.0) {
      minerRegGained = Math.floor(minerAcc);
      nextRegolith += minerRegGained;
      if (state.solDay % 2 === 0 || nextIce < 6) {
        minerIceGained = minerRegGained;
        nextIce += minerIceGained;
      }
      minerAcc -= minerRegGained;
    }
  }

  // Passive BioDome Crop Biomass
  let nextBiomass = state.biomass;
  let bioAcc = state.biomassGenAccumulator;
  let bioGained = 0;
  if (state.cropsPlantedCount > 0 && state.buildingHealth.bioDome > 20) {
    const bioRate =
      state.cropsPlantedCount * (state.unlockedTechs.includes('tech-hydro') ? 0.26 : 0.14);
    bioAcc += deltaSeconds * bioRate;
    if (bioAcc >= 1.0) {
      bioGained = Math.floor(bioAcc);
      nextBiomass += bioGained;
      bioAcc -= bioGained;
    }
  }

  // Glass Dome Food Crops growth (speeds up with Bio-Engineered Seeds tech & BioDome)
  const cropSpeed =
    (state.buildings.bioDome ? 1.45 : 1.0) *
    (state.unlockedTechs.includes('tech-hydro') ? 1.35 : 1.0);
  const nextDomeCrops = stepDomeCrops(state.domeCrops, deltaSeconds, cropSpeed);

  // Realistic Astronaut Nutrition / Hunger decay (slow, never kills abruptly; refills via [H])
  const hungerDrain = isNearO2Source ? 0.14 : 0.24;
  const nextHunger = Math.max(5, state.hunger - hungerDrain * deltaSeconds);

  // Sol Day cycle (~45 seconds per Martian Sol)
  let nextSol = state.solDay;
  let solAcc = state.solAccumulator + deltaSeconds;
  if (solAcc >= 45) {
    nextSol += 1;
    solAcc -= 45;
  }

  let nextState: ColonyState = {
    ...state,
    oxygen: nextO2,
    regolith: nextRegolith,
    waterIce: nextIce,
    water: nextWater,
    biomass: nextBiomass,
    hunger: nextHunger,
    domeCrops: nextDomeCrops,
    solDay: nextSol,
    waterGenAccumulator: waterAcc,
    minerGenAccumulator: minerAcc,
    biomassGenAccumulator: bioAcc,
    solAccumulator: solAcc,
    habitability: computeHabitability(state),
    stage: computeStage(state),
    isNearO2Source: isNearO2Source || state.buildings.terraformer,
  };

  if (nextState.buildings.habitat) {
    const solSync = syncMissionControlSol(
      nextState.missionControl,
      nextSol,
      nextState.threatsEnabled
    );
    if (solSync.rotated) {
      nextState = { ...nextState, missionControl: solSync.state };
    }
    if (waterGained > 0) {
      nextState = applyMissionControlProgress(nextState, 'produce-water', waterGained).state;
    }
    if (minerRegGained > 0) {
      nextState = applyMissionControlProgress(nextState, 'gather-regolith', minerRegGained).state;
    }
    if (minerIceGained > 0) {
      nextState = applyMissionControlProgress(nextState, 'gather-ice', minerIceGained).state;
    }
    if (bioGained > 0) {
      nextState = applyMissionControlProgress(nextState, 'produce-biomass', bioGained).state;
    }
  }

  return nextState;
}

export function applyMissionControlReward(
  state: ColonyState,
  reward: DailyObjectiveReward
): ColonyState {
  if (!hasNonZeroReward(reward)) return state;
  let nextHealth = state.buildingHealth;
  if (reward.repairAllPct && reward.repairAllPct > 0) {
    nextHealth = { ...state.buildingHealth };
    for (const k of Object.keys(state.buildings) as BuildingKey[]) {
      if (state.buildings[k]) {
        nextHealth[k] = Math.min(100, nextHealth[k] + reward.repairAllPct);
      }
    }
  }
  return {
    ...state,
    regolith: state.regolith + (reward.regolith || 0),
    waterIce: state.waterIce + (reward.waterIce || 0),
    water: state.water + (reward.water || 0),
    biomass: state.biomass + (reward.biomass || 0),
    oxygen: reward.oxygenRefill ? state.oxygenMax : state.oxygen,
    buildingHealth: nextHealth,
  };
}

/**
 * Advances Habitat Mission Control daily objectives when the Habitat is operational,
 * automatically granting bonus rewards upon objective completion.
 */
export function applyMissionControlProgress(
  state: ColonyState,
  kind: DailyObjectiveKind,
  amount = 1
): { state: ColonyState; completedDailyTitles: string[] } {
  if (!state.buildings.habitat || amount <= 0) {
    return { state, completedDailyTitles: [] };
  }
  const prog = progressDailyObjectives(state.missionControl, kind, amount);
  if (prog.state === state.missionControl) {
    return { state, completedDailyTitles: [] };
  }
  let nextState: ColonyState = {
    ...state,
    missionControl: prog.state,
  };
  if (prog.newlyCompleted.length > 0) {
    nextState = applyMissionControlReward(nextState, prog.grantedReward);
  }
  return {
    state: nextState,
    completedDailyTitles: prog.newlyCompleted.map((o) => `${o.title} (${o.rewardText})`),
  };
}

export function rerollColonyMissionControl(
  state: ColonyState,
  rng: () => number = Math.random
): { state: ColonyState; rerolled: boolean; reason?: string } {
  if (!state.buildings.habitat) {
    return {
      state,
      rerolled: false,
      reason: 'Construa o Habitat Pressurizado (-11, 12) para ativar o terminal.',
    };
  }
  const res = rerollDailyObjectives(state.missionControl, state.threatsEnabled, rng);
  if (!res.rerolled) {
    return { state, rerolled: false, reason: res.reason };
  }
  return {
    state: {
      ...state,
      missionControl: res.state,
    },
    rerolled: true,
  };
}

/**
 * Steps dynamic Martian Dust Storm events:
 * - Randomly triggers every 2–3 Sols
 * - Reduces Solar Panel generation by 50% while active
 * - Accelerates integrity degradation across built structures
 */
export function stepColonyDustStorm(
  state: ColonyState,
  dt: number,
  activeRoles: AstronautRoleId[] = ['engineer'],
  rng: () => number = Math.random
): { state: ColonyState; stormStarted: boolean; stormEnded: boolean } {
  const res = stepDustStormLifecycle({
    dustStorm: state.dustStorm,
    solDay: state.solDay,
    buildings: state.buildings,
    buildingHealth: state.buildingHealth,
    dt,
    rng,
  });

  if (
    !res.stormStarted &&
    !res.stormEnded &&
    res.dustStorm === state.dustStorm &&
    res.buildingHealth === state.buildingHealth
  ) {
    return { state, stormStarted: false, stormEnded: false };
  }

  const nextEnergy = computeTotalColonyEnergy(
    state.buildings,
    activeRoles,
    res.dustStorm.solarEfficiencyMultiplier
  );

  return {
    state: {
      ...state,
      dustStorm: res.dustStorm,
      buildingHealth: res.buildingHealth,
      energy: nextEnergy,
    },
    stormStarted: res.stormStarted,
    stormEnded: res.stormEnded,
  };
}

export function forceTriggerDustStorm(
  state: ColonyState,
  activeRoles: AstronautRoleId[] = ['engineer'],
  rng: () => number = Math.random
): ColonyState {
  const dustStorm = activateDustStorm(state.dustStorm, rng);
  return {
    ...state,
    dustStorm,
    energy: computeTotalColonyEnergy(
      state.buildings,
      activeRoles,
      dustStorm.solarEfficiencyMultiplier
    ),
  };
}

/**
 * Excavates a real 3D crater at (x, z) and extracts biome-authentic buried Martian minerals.
 */
export function excavateCraterAt(
  state: ColonyState,
  x: number,
  z: number,
  rng: () => number = Math.random
): { state: ColonyState; crater: ExcavatedCrater | null; summaryText: string; ok: boolean } {
  // Prevent digging right under the Starship landing pad or existing craters within 2.5m
  if (Math.hypot(x, z) < 5.0) {
    return {
      state,
      crater: null,
      summaryText: 'Afaste-se da base de pouso da nave para escavar crateras.',
      ok: false,
    };
  }
  const tooClose = state.craters.some((c) => Math.hypot(c.x - x, c.z - z) < 3.2);
  if (tooClose) {
    return {
      state,
      crater: null,
      summaryText: 'Cratera já escavada neste ponto. Explore uma nova área!',
      ok: false,
    };
  }

  const { biome, yieldData } = computeExcavationYield(x, z, rng);
  const crater: ExcavatedCrater = {
    id: `crater-${Date.now()}-${state.craters.length}`,
    x: Number(x.toFixed(2)),
    z: Number(z.toFixed(2)),
    radius: 2.8 + rng() * 0.8,
    depth: 1.15 + rng() * 0.45,
    biomeId: biome.id,
  };

  let next: ColonyState = {
    ...state,
    regolith: state.regolith + yieldData.regolith,
    waterIce: state.waterIce + yieldData.waterIce,
    iron: state.iron + yieldData.iron,
    titanium: state.titanium + yieldData.titanium,
    silicon: state.silicon + yieldData.silicon,
    sulfur: state.sulfur + yieldData.sulfur,
    craters: [...state.craters.slice(-24), crater],
  };

  if (yieldData.regolith > 0) {
    next = applyMissionControlProgress(next, 'gather-regolith', yieldData.regolith).state;
  }
  if (yieldData.waterIce > 0) {
    next = applyMissionControlProgress(next, 'gather-ice', yieldData.waterIce).state;
  }

  return {
    state: next,
    crater,
    summaryText: `Escavação (${biome.name}): ${yieldData.summaryText}`,
    ok: true,
  };
}

/**
 * Plants a food crop inside one of the 4 glass-dome hydroponic beds.
 */
export function plantDomeCrop(
  state: ColonyState,
  bedIndex: number,
  cropId: CropTypeId
): { state: ColonyState; ok: boolean; label: string } {
  const bed = state.domeCrops[bedIndex];
  if (!bed) return { state, ok: false, label: 'Canteiro inválido.' };
  if (bed.cropId) return { state, ok: false, label: 'Canteiro ocupado.' };

  const crop = getCropDef(cropId);
  if (state.water < crop.waterCost) {
    return {
      state,
      ok: false,
      label: `Requer ${crop.waterCost} Água para plantar ${crop.name}.`,
    };
  }

  const nextBeds = state.domeCrops.map((b) =>
    b.bedIndex === bedIndex
      ? {
          ...b,
          cropId,
          elapsedSec: 0,
          durationSec: crop.growthSec,
          readyToHarvest: false,
        }
      : b
  );

  return {
    state: {
      ...state,
      water: state.water - crop.waterCost,
      domeCrops: nextBeds,
    },
    ok: true,
    label: `Plantado na Redoma: ${crop.name} (${crop.growthSec}s)`,
  };
}

/**
 * Harvests a mature food crop from a glass-dome bed.
 */
export function harvestDomeCrop(
  state: ColonyState,
  bedIndex: number
): { state: ColonyState; ok: boolean; label: string } {
  const bed = state.domeCrops[bedIndex];
  if (!bed || !bed.cropId || !bed.readyToHarvest) {
    return { state, ok: false, label: 'Cultivo ainda crescendo na redoma.' };
  }
  const crop = getCropDef(bed.cropId);
  const nextBeds = state.domeCrops.map((b) =>
    b.bedIndex === bedIndex
      ? {
          ...b,
          cropId: null,
          elapsedSec: 0,
          durationSec: 12,
          readyToHarvest: false,
        }
      : b
  );

  let next: ColonyState = {
    ...state,
    food: state.food + crop.foodYield,
    biomass: state.biomass + crop.biomassYield,
    domeCrops: nextBeds,
  };
  next = applyMissionControlProgress(next, 'produce-biomass', crop.biomassYield).state;

  return {
    state: next,
    ok: true,
    label: `Colhido: +${crop.foodYield} Alimentos · +${crop.biomassYield} Biomassa`,
  };
}

/**
 * Astronaut eats 1 food ration from colony stock to restore nutrition (+42%) and suit O2 (+18%).
 */
export function consumeFoodRation(
  state: ColonyState
): { state: ColonyState; ok: boolean; label: string } {
  if (state.food <= 0) {
    return {
      state,
      ok: false,
      label: 'Sem rações! Cultive alimentos na Redoma de Vidro [B].',
    };
  }
  return {
    state: {
      ...state,
      food: state.food - 1,
      hunger: Math.min(100, state.hunger + 42),
      oxygen: Math.min(state.oxygenMax, state.oxygen + 18),
    },
    ok: true,
    label: 'Ração consumida: +42% Nutrição · +18% O2',
  };
}

export function runColonyRefineryRecipe(
  state: ColonyState,
  recipeId: string
): { state: ColonyState; ok: boolean; label: string } {
  return executeRefineryRecipe(state, recipeId);
}

export function craftColonyWeapon(
  state: ColonyState,
  weaponId: WeaponId
): { state: ColonyState; crafted: boolean; label: string } {
  return craftWeapon(state, weaponId);
}

export function equipColonyWeapon(
  state: ColonyState,
  weaponId: WeaponId
): { state: ColonyState; equipped: boolean; label: string } {
  if (!state.craftedWeapons.includes(weaponId)) {
    return { state, equipped: false, label: 'Armamento ainda não fabricado.' };
  }
  const w = getWeaponDef(weaponId);
  return {
    state: { ...state, equippedWeapon: weaponId },
    equipped: true,
    label: `Equipado: ${w.name}`,
  };
}

/**
 * Scans & collects rewards from a Mars orbital anomaly/landmark discovered with the Starship.
 */
export function discoverPlanetarySite(
  state: ColonyState,
  siteId: string
): { state: ColonyState; discovered: boolean; label: string } {
  const site = PLANETARY_SITES.find((s) => s.id === siteId);
  if (!site) return { state, discovered: false, label: 'Coordenada orbital inválida.' };
  if (state.discoveredSites.includes(siteId)) {
    return { state, discovered: false, label: `${site.name} já foi explorado.` };
  }
  if (state.fuel < site.fuelCost) {
    return {
      state,
      discovered: false,
      label: `Requer ${site.fuelCost} Combustível (H₂) para varredura orbital. Sintetize na Refinaria [B].`,
    };
  }

  const r = site.reward;
  const next: ColonyState = {
    ...state,
    fuel: state.fuel - site.fuelCost + (r.fuel || 0),
    regolith: state.regolith + (r.regolith || 0),
    waterIce: state.waterIce + (r.waterIce || 0),
    water: state.water + (r.water || 0),
    iron: state.iron + (r.iron || 0),
    titanium: state.titanium + (r.titanium || 0),
    silicon: state.silicon + (r.silicon || 0),
    sulfur: state.sulfur + (r.sulfur || 0),
    food: state.food + (r.food || 0),
    biomass: state.biomass + (r.biomass || 0),
    discoveredSites: [...state.discoveredSites, siteId],
  };

  return {
    state: next,
    discovered: true,
    label: `Descoberta Orbital: ${site.name} (${site.rewardText})`,
  };
}


