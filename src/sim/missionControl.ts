/**
 * Mission Control Terminal (Habitat) - Randomized Daily Objectives & Bonus Rewards
 * Generates 3 randomized daily objectives per Martian Sol (e.g., Gather 50 Regolith,
 * Repair 3 Modules, Gather 25 Ice, Defeat 4 Threats, Purify 15 Water, Cultivate 10 Biomass).
 * Automatically tracks colony progress and awards bonus resources/repairs on completion.
 */

export type DailyObjectiveKind =
  | 'gather-regolith'
  | 'gather-ice'
  | 'repair-modules'
  | 'defeat-enemies'
  | 'produce-water'
  | 'produce-biomass'
  | 'complete-build';

export interface DailyObjectiveReward {
  regolith?: number;
  waterIce?: number;
  water?: number;
  biomass?: number;
  repairAllPct?: number;
  oxygenRefill?: boolean;
}

export interface DailyObjective {
  id: string;
  kind: DailyObjectiveKind;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  rewardClaimed: boolean;
  reward: DailyObjectiveReward;
  rewardText: string;
}

export interface MissionControlState {
  currentSol: number;
  objectives: DailyObjective[];
  totalCompletedCount: number;
  rerollsUsedForSol: number;
}

interface DailyObjectiveTemplate {
  idPrefix: string;
  kind: DailyObjectiveKind;
  title: string;
  description: string;
  target: number;
  requiresThreats?: boolean;
  reward: DailyObjectiveReward;
  rewardText: string;
}

export const DAILY_OBJECTIVES_COUNT = 3;

export const DAILY_OBJECTIVE_TEMPLATES: DailyObjectiveTemplate[] = [
  {
    idPrefix: 'daily-gather-regolith',
    kind: 'gather-regolith',
    title: 'Coletar 50 Regolito',
    description: 'Reúna 50 unidades de regolito por coleta EVA, sonda mineradora ou combate.',
    target: 50,
    reward: { water: 12, biomass: 6, oxygenRefill: true },
    rewardText: '+12 Água · +6 Biomassa · 100% O2',
  },
  {
    idPrefix: 'daily-repair-modules',
    kind: 'repair-modules',
    title: 'Reparar 3 Módulos',
    description: 'Restaure 3 estruturas da colônia até 100% de integridade estrutural com [E].',
    target: 3,
    reward: { regolith: 14, water: 10, repairAllPct: 15 },
    rewardText: '+14 Regolito · +10 Água · +15% Reparo Global',
  },
  {
    idPrefix: 'daily-gather-ice',
    kind: 'gather-ice',
    title: 'Coletar 25 Cristais de Gelo',
    description: 'Extraia 25 blocos de gelo subsuperficial na cratera ou via sonda automática.',
    target: 25,
    reward: { regolith: 12, water: 12 },
    rewardText: '+12 Regolito · +12 Água',
  },
  {
    idPrefix: 'daily-defeat-enemies',
    kind: 'defeat-enemies',
    title: 'Neutralizar 4 Ameaças Marcianas',
    description: 'Elimine 4 invasores de sílica ou drones hostis com o rifle de plasma ou torre.',
    target: 4,
    requiresThreats: true,
    reward: { regolith: 16, water: 8, biomass: 6 },
    rewardText: '+16 Regolito · +8 Água · +6 Biomassa',
  },
  {
    idPrefix: 'daily-produce-water',
    kind: 'produce-water',
    title: 'Purificar 15 Unidades de Água',
    description: 'Mantenha o Extrator de Água ativo para purificar 15 unidades de água líquida.',
    target: 15,
    reward: { regolith: 12, biomass: 6 },
    rewardText: '+12 Regolito · +6 Biomassa',
  },
  {
    idPrefix: 'daily-produce-biomass',
    kind: 'produce-biomass',
    title: 'Cultivar 10 Unidades de Biomassa',
    description: 'Produza 10 unidades de biomassa nos canteiros hidropônicos do Biodomo.',
    target: 10,
    reward: { regolith: 14, water: 10, oxygenRefill: true },
    rewardText: '+14 Regolito · +10 Água · 100% O2',
  },
  {
    idPrefix: 'daily-complete-build',
    kind: 'complete-build',
    title: 'Concluir 1 Construção ou Plantio',
    description: 'Finalize uma nova estrutura da colônia ou canteiro hidropônico.',
    target: 1,
    reward: { regolith: 10, waterIce: 8, water: 5 },
    rewardText: '+10 Regolito · +8 Gelo · +5 Água',
  },
];

function shuffleTemplates(
  items: DailyObjectiveTemplate[],
  rng: () => number
): DailyObjectiveTemplate[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.max(0, Math.min(0.999999, rng())) * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Generates 3 distinct randomized daily objectives for a given Martian Sol.
 */
export function generateDailyObjectives(
  solDay: number,
  threatsEnabled: boolean,
  rng: () => number = Math.random,
  previousKinds: DailyObjectiveKind[] = []
): DailyObjective[] {
  const eligible = DAILY_OBJECTIVE_TEMPLATES.filter(
    (tpl) => threatsEnabled || !tpl.requiresThreats
  );

  // Prefer fresh kinds first when rotating within the same run, while keeping full randomness
  const freshPool = eligible.filter((tpl) => !previousKinds.includes(tpl.kind));
  const fallbackPool = eligible.filter((tpl) => previousKinds.includes(tpl.kind));

  const ordered = [
    ...shuffleTemplates(freshPool, rng),
    ...shuffleTemplates(fallbackPool, rng),
  ];

  const picked: DailyObjectiveTemplate[] = [];
  const seenKinds = new Set<DailyObjectiveKind>();
  for (const tpl of ordered) {
    if (seenKinds.has(tpl.kind)) continue;
    seenKinds.add(tpl.kind);
    picked.push(tpl);
    if (picked.length >= DAILY_OBJECTIVES_COUNT) break;
  }

  return picked.map((tpl, idx) => ({
    id: `${tpl.idPrefix}-sol${solDay}-${idx + 1}`,
    kind: tpl.kind,
    title: tpl.title,
    description: tpl.description,
    progress: 0,
    target: tpl.target,
    completed: false,
    rewardClaimed: false,
    reward: { ...tpl.reward },
    rewardText: tpl.rewardText,
  }));
}

export function createInitialMissionControlState(
  solDay = 1,
  threatsEnabled = true,
  rng: () => number = Math.random
): MissionControlState {
  return {
    currentSol: solDay,
    objectives: generateDailyObjectives(solDay, threatsEnabled, rng),
    totalCompletedCount: 0,
    rerollsUsedForSol: 0,
  };
}

/**
 * Rotates to 3 fresh daily objectives automatically when a new Martian Sol begins.
 */
export function syncMissionControlSol(
  mcState: MissionControlState,
  solDay: number,
  threatsEnabled: boolean,
  rng: () => number = Math.random
): { state: MissionControlState; rotated: boolean } {
  if (solDay <= mcState.currentSol) {
    return { state: mcState, rotated: false };
  }
  const prevKinds = mcState.objectives.map((o) => o.kind);
  return {
    rotated: true,
    state: {
      ...mcState,
      currentSol: solDay,
      objectives: generateDailyObjectives(solDay, threatsEnabled, rng, prevKinds),
      rerollsUsedForSol: 0,
    },
  };
}

/**
 * Allows manual rotation of daily objectives inside the Habitat Mission Control Terminal:
 * - Always allowed when all 3 objectives for the Sol are completed
 * - Otherwise allowed once per Martian Sol
 */
export function rerollDailyObjectives(
  mcState: MissionControlState,
  threatsEnabled: boolean,
  rng: () => number = Math.random
): { state: MissionControlState; rerolled: boolean; reason?: string } {
  const allCompleted =
    mcState.objectives.length > 0 && mcState.objectives.every((o) => o.completed);

  if (!allCompleted && mcState.rerollsUsedForSol >= 1) {
    return {
      state: mcState,
      rerolled: false,
      reason: 'Nova rotação disponível após concluir os 3 objetivos ou no próximo Sol.',
    };
  }

  const prevKinds = mcState.objectives.map((o) => o.kind);
  return {
    rerolled: true,
    state: {
      ...mcState,
      objectives: generateDailyObjectives(
        mcState.currentSol,
        threatsEnabled,
        rng,
        prevKinds
      ),
      rerollsUsedForSol: allCompleted ? mcState.rerollsUsedForSol : mcState.rerollsUsedForSol + 1,
    },
  };
}

function mergeRewards(a: DailyObjectiveReward, b: DailyObjectiveReward): DailyObjectiveReward {
  return {
    regolith: (a.regolith || 0) + (b.regolith || 0),
    waterIce: (a.waterIce || 0) + (b.waterIce || 0),
    water: (a.water || 0) + (b.water || 0),
    biomass: (a.biomass || 0) + (b.biomass || 0),
    repairAllPct: (a.repairAllPct || 0) + (b.repairAllPct || 0),
    oxygenRefill: Boolean(a.oxygenRefill || b.oxygenRefill),
  };
}

/**
 * Advances matching daily objectives by `amount` and collects any newly earned bonus rewards.
 */
export function progressDailyObjectives(
  mcState: MissionControlState,
  kind: DailyObjectiveKind,
  amount = 1
): {
  state: MissionControlState;
  newlyCompleted: DailyObjective[];
  grantedReward: DailyObjectiveReward;
} {
  if (amount <= 0) {
    return { state: mcState, newlyCompleted: [], grantedReward: {} };
  }

  let anyChanged = false;
  const newlyCompleted: DailyObjective[] = [];
  let grantedReward: DailyObjectiveReward = {};

  const nextObjectives = mcState.objectives.map((obj) => {
    if (obj.kind !== kind || obj.completed) return obj;
    anyChanged = true;
    const nextProgress = Math.min(obj.target, obj.progress + amount);
    const isNowComplete = nextProgress >= obj.target;
    const updated: DailyObjective = {
      ...obj,
      progress: nextProgress,
      completed: isNowComplete,
      rewardClaimed: isNowComplete ? true : obj.rewardClaimed,
    };
    if (isNowComplete) {
      newlyCompleted.push(updated);
      grantedReward = mergeRewards(grantedReward, obj.reward);
    }
    return updated;
  });

  if (!anyChanged) {
    return { state: mcState, newlyCompleted: [], grantedReward: {} };
  }

  return {
    state: {
      ...mcState,
      objectives: nextObjectives,
      totalCompletedCount: mcState.totalCompletedCount + newlyCompleted.length,
    },
    newlyCompleted,
    grantedReward,
  };
}

export function hasNonZeroReward(reward: DailyObjectiveReward): boolean {
  return Boolean(
    (reward.regolith && reward.regolith > 0) ||
      (reward.waterIce && reward.waterIce > 0) ||
      (reward.water && reward.water > 0) ||
      (reward.biomass && reward.biomass > 0) ||
      (reward.repairAllPct && reward.repairAllPct > 0) ||
      reward.oxygenRefill
  );
}
