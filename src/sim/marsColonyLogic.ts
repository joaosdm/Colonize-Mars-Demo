/**
 * Mars Colonization Logic & Objectives Engine
 * Multiplatform Arcade Idle & Base Building Progression:
 * - Mission 1: Ativar Extrator de Oxigênio (MOXIE) -> Feixe verde + aura O2 + 15% Habitabilidade
 * - Mission 2: Coletar 5 Regolitos no terreno -> Contador 0/5 em tempo real
 * - Mission 3: Depositar os 5 Regolitos no círculo azul para construir a Placa Solar (+20 kW, 35% Habitabilidade)
 * - Mission 4: Coletar 5 blocos de Gelo e construir o Extrator de Água / Biodomo (65% Habitabilidade)
 * - Mission 5: Construir o Habitat Pressurizado (100% Habitabilidade -> Vitória / Nível Concluído)
 */

export const MARS_GRAVITY = 3.72; // m/s^2 (0.38g of Earth)

export interface ColonyObjective {
  id: string;
  stageNumber: number;
  title: string;
  shortLabel: string;
  description: string;
  requiredResource?: {
    type: 'regolith' | 'ice';
    amount: number;
  };
  targetLocation: { x: number; z: number };
  isCompleted: boolean;
  rewardText: string;
}

export interface ColonyState {
  stage: number; // 0 to 4 (missions 1 to 5)
  oxygen: number; // 0 - 100%
  oxygenMax: number;
  energy: number; // kW
  waterIce: number; // units collected
  regolith: number; // units collected
  habitability: number; // 0 - 100%
  solDay: number;
  isNearO2Source: boolean; // near lander or O2 aura
  isSandboxMode: boolean; // free play after victory
  buildings: {
    moxie: boolean; // Mission 1
    solarPanels: boolean; // Mission 3
    bioDome: boolean; // Mission 4
    habitat: boolean; // Mission 5
  };
}

export const INITIAL_OBJECTIVES: ColonyObjective[] = [
  {
    id: 'obj-1-moxie',
    stageNumber: 1,
    title: '1. Ativar Extrator de Oxigênio (MOXIE)',
    shortLabel: 'Ativar MOXIE',
    description: 'Aproxime-se do módulo MOXIE ao lado da nave para gerar a cúpula de O2 da base.',
    targetLocation: { x: -6, z: 4 },
    isCompleted: false,
    rewardText: 'Aura de O2 Ativada · +15% Habitabilidade',
  },
  {
    id: 'obj-2-regolith',
    stageNumber: 2,
    title: '2. Coletar 5 Regolitos Marcianos',
    shortLabel: 'Coletar 5 Regolitos',
    description: 'Explore o terreno e colete 5 cubos de regolito mineral amarelo/dourado.',
    requiredResource: { type: 'regolith', amount: 5 },
    targetLocation: { x: 8, z: 10 },
    isCompleted: false,
    rewardText: 'Recursos para a Matriz Solar',
  },
  {
    id: 'obj-3-solar',
    stageNumber: 3,
    title: '3. Construir Placa Solar Adicional',
    shortLabel: 'Construir Placa Solar',
    description: 'Vá até a zona circular azul e deposite os 5 regolitos para erguer a matriz solar.',
    requiredResource: { type: 'regolith', amount: 5 },
    targetLocation: { x: 7, z: 3 },
    isCompleted: false,
    rewardText: '+20 kW Energia · Habitabilidade vai a 35%',
  },
  {
    id: 'obj-4-biodome',
    stageNumber: 4,
    title: '4. Coletar 5 Gelos e Construir Biodomo',
    shortLabel: 'Construir Biodomo',
    description: 'Colete 5 cubos de gelo azul e deposite na zona de construção do biodomo.',
    requiredResource: { type: 'ice', amount: 5 },
    targetLocation: { x: 0, z: -18 },
    isCompleted: false,
    rewardText: 'Água e Estufa · Habitabilidade vai a 65%',
  },
  {
    id: 'obj-5-habitat',
    stageNumber: 5,
    title: '5. Construir Habitat Pressurizado',
    shortLabel: 'Construir Habitat',
    description: 'Deposite os materiais na plataforma principal para concluir a primeira colônia permanente.',
    targetLocation: { x: -10, z: -10 },
    isCompleted: false,
    rewardText: 'Habitabilidade 100% · Vitória da Humanidade!',
  },
];

export function createInitialColonyState(): ColonyState {
  return {
    stage: 0,
    oxygen: 100,
    oxygenMax: 100,
    energy: 10,
    waterIce: 0,
    regolith: 0,
    habitability: 5,
    solDay: 1,
    isNearO2Source: true,
    isSandboxMode: false,
    buildings: {
      moxie: false,
      solarPanels: false,
      bioDome: false,
      habitat: false,
    },
  };
}

/**
 * Updates colony oxygen and habitability over delta time.
 */
export function updateColonyTick(
  state: ColonyState,
  deltaSeconds: number,
  isNearO2Source: boolean
): ColonyState {
  let nextO2 = state.oxygen;

  if (isNearO2Source) {
    // Rapid recharge when inside O2 aura, ship or biodome
    nextO2 = Math.min(state.oxygenMax, nextO2 + 20 * deltaSeconds);
  } else {
    // Gentle consumption rate while exploring outside
    // If MOXIE is active, suit life support lasts longer
    const drainMultiplier = state.buildings.moxie ? 0.6 : 1.0;
    nextO2 = Math.max(0, nextO2 - 0.7 * drainMultiplier * deltaSeconds);
  }

  // Calculate habitability milestone
  let hab = 5;
  if (state.buildings.moxie) hab = 15;
  if (state.stage >= 1 && state.regolith >= 5) hab = Math.max(hab, 25);
  if (state.buildings.solarPanels) hab = 35;
  if (state.buildings.bioDome) hab = 65;
  if (state.buildings.habitat) hab = 100;

  return {
    ...state,
    oxygen: nextO2,
    habitability: Math.min(100, hab),
    isNearO2Source,
  };
}

/**
 * Checks if a specific objective can be completed.
 */
export function canCompleteObjective(
  objId: string,
  state: ColonyState
): boolean {
  switch (objId) {
    case 'obj-1-moxie':
      return !state.buildings.moxie;
    case 'obj-2-regolith':
      return state.buildings.moxie && state.regolith >= 5;
    case 'obj-3-solar':
      return state.buildings.moxie && state.regolith >= 5 && !state.buildings.solarPanels;
    case 'obj-4-biodome':
      return state.buildings.solarPanels && state.waterIce >= 5 && !state.buildings.bioDome;
    case 'obj-5-habitat':
      return state.buildings.bioDome && !state.buildings.habitat;
    default:
      return false;
  }
}
