/**
 * Astronaut Cooperative Roles & Active Statistics Engine (Up to 3 Players)
 * Defines the 3 specialized classes for Colonize Mars:
 * 1. Engenheiro (Construction & Module Repair bonuses)
 * 2. Cientista (Tech Research Speed & Colony Energy Generation bonuses)
 * 3. Explorador / Segurança (Movement Speed, Resource Collection Radius & Silica Combat Damage bonuses)
 */

export type AstronautRoleId = 'engineer' | 'scientist' | 'explorer';

export interface RoleModifiers {
  buildSpeedMultiplier: number;
  repairAmountMultiplier: number;
  techResearchSpeedMultiplier: number;
  energyGenerationMultiplier: number;
  energyBonusKw: number;
  moveSpeedMultiplier: number;
  jetpackCapacityMultiplier: number;
  pickupRadiusMultiplier: number;
  combatDamageMultiplier: number;
  plasmaCooldownMultiplier: number;
}

export interface RoleStatHighlight {
  label: string;
  value: string;
  tone: 'orange' | 'cyan' | 'emerald' | 'purple' | 'amber' | 'red';
}

export interface AstronautRoleDefinition {
  id: AstronautRoleId;
  name: string;
  shortLabel: string;
  tagline: string;
  description: string;
  accentHex: string;
  modifiers: RoleModifiers;
  highlights: RoleStatHighlight[];
}

export interface SquadRoleBonuses {
  techResearchSpeedMultiplier: number;
  energyGenerationMultiplier: number;
  energyFlatBonusKw: number;
}

export interface ActivePlayerStats {
  roleId: AstronautRoleId;
  roleName: string;
  shortLabel: string;
  accentHex: string;
  moveSpeedMs: number;
  moveSpeedPct: number;
  buildSpeedPct: number;
  repairEfficiencyPct: number;
  researchSpeedPct: number;
  energyBonusPct: number;
  energyFlatKw: number;
  pickupRadiusM: number;
  plasmaDamage: number;
  plasmaCooldownMs: number;
  jetpackCapacityPct: number;
}

export const ASTRONAUT_ROLES: Record<AstronautRoleId, AstronautRoleDefinition> = {
  engineer: {
    id: 'engineer',
    name: 'Engenheiro',
    shortLabel: 'ENG',
    tagline: 'Infraestrutura & Manutenção',
    description:
      'Especialista em montagem orbital e sistemas estruturais. Acelera construções e restaura módulos sob ataque com máxima eficiência.',
    accentHex: '#f97316',
    modifiers: {
      buildSpeedMultiplier: 1.75,
      repairAmountMultiplier: 1.65,
      techResearchSpeedMultiplier: 1.0,
      energyGenerationMultiplier: 1.0,
      energyBonusKw: 0,
      moveSpeedMultiplier: 1.0,
      jetpackCapacityMultiplier: 1.1,
      pickupRadiusMultiplier: 1.0,
      combatDamageMultiplier: 1.0,
      plasmaCooldownMultiplier: 1.0,
    },
    highlights: [
      { label: 'Veloc. Construção', value: '+75%', tone: 'orange' },
      { label: 'Reparo de Módulos', value: '+65%', tone: 'amber' },
      { label: 'Jetpack EVA', value: '+10%', tone: 'cyan' },
    ],
  },
  scientist: {
    id: 'scientist',
    name: 'Cientista',
    shortLabel: 'CIE',
    tagline: 'Pesquisa & Reatores Energéticos',
    description:
      'Pesquisador de bioengenharia e física planetária. Acelera pesquisas tecnológicas e amplia a geração elétrica de usinas da colônia.',
    accentHex: '#06b6d4',
    modifiers: {
      buildSpeedMultiplier: 1.0,
      repairAmountMultiplier: 1.0,
      techResearchSpeedMultiplier: 1.8,
      energyGenerationMultiplier: 1.35,
      energyBonusKw: 8,
      moveSpeedMultiplier: 1.0,
      jetpackCapacityMultiplier: 1.0,
      pickupRadiusMultiplier: 1.15,
      combatDamageMultiplier: 1.0,
      plasmaCooldownMultiplier: 1.0,
    },
    highlights: [
      { label: 'Veloc. Pesquisa', value: '+80%', tone: 'purple' },
      { label: 'Geração Energia', value: '+35% (+8 kW)', tone: 'amber' },
      { label: 'Sensor Coleta', value: '+15%', tone: 'cyan' },
    ],
  },
  explorer: {
    id: 'explorer',
    name: 'Explorador / Segurança',
    shortLabel: 'EXP',
    tagline: 'Reconhecimento & Defesa Tática',
    description:
      'Batedor de alta mobilidade equipado com rifle de plasma calibrado e imã estendido para conter invasores de sílica e coletar recursos.',
    accentHex: '#10b981',
    modifiers: {
      buildSpeedMultiplier: 1.0,
      repairAmountMultiplier: 1.0,
      techResearchSpeedMultiplier: 1.0,
      energyGenerationMultiplier: 1.0,
      energyBonusKw: 0,
      moveSpeedMultiplier: 1.24,
      jetpackCapacityMultiplier: 1.25,
      pickupRadiusMultiplier: 1.5,
      combatDamageMultiplier: 1.6,
      plasmaCooldownMultiplier: 0.78,
    },
    highlights: [
      { label: 'Movimento & Jetpack', value: '+24% / +25%', tone: 'emerald' },
      { label: 'Raio de Coleta', value: '+50%', tone: 'cyan' },
      { label: 'Dano vs Sílica', value: '+60%', tone: 'red' },
    ],
  },
};

export const ASTRONAUT_ROLE_LIST: AstronautRoleDefinition[] = [
  ASTRONAUT_ROLES.engineer,
  ASTRONAUT_ROLES.scientist,
  ASTRONAUT_ROLES.explorer,
];

export function isAstronautRoleId(value: unknown): value is AstronautRoleId {
  return value === 'engineer' || value === 'scientist' || value === 'explorer';
}

export function getAstronautRole(roleId?: AstronautRoleId | null): AstronautRoleDefinition {
  if (roleId && isAstronautRoleId(roleId)) {
    return ASTRONAUT_ROLES[roleId];
  }
  return ASTRONAUT_ROLES.engineer;
}

/**
 * Computes cooperative team-wide synergy bonuses for research speed and energy generation
 * across up to 3 players (with gentle diminishing stacking if multiple Scientists join).
 */
export function computeSquadRoleBonuses(roleIds: AstronautRoleId[]): SquadRoleBonuses {
  if (roleIds.length === 0) {
    return {
      techResearchSpeedMultiplier: 1.0,
      energyGenerationMultiplier: 1.0,
      energyFlatBonusKw: 0,
    };
  }

  let researchBonusSum = 0;
  let energyMultBonusSum = 0;
  let energyFlatBonusKw = 0;
  let scientistIndex = 0;

  for (const id of roleIds) {
    const role = getAstronautRole(id);
    if (role.modifiers.techResearchSpeedMultiplier > 1.0 || role.modifiers.energyGenerationMultiplier > 1.0) {
      const weight = scientistIndex === 0 ? 1.0 : 0.5;
      researchBonusSum += (role.modifiers.techResearchSpeedMultiplier - 1.0) * weight;
      energyMultBonusSum += (role.modifiers.energyGenerationMultiplier - 1.0) * weight;
      energyFlatBonusKw += Math.round(role.modifiers.energyBonusKw * weight);
      scientistIndex += 1;
    }
  }

  return {
    techResearchSpeedMultiplier: Number((1.0 + researchBonusSum).toFixed(2)),
    energyGenerationMultiplier: Number((1.0 + energyMultBonusSum).toFixed(2)),
    energyFlatBonusKw,
  };
}

/**
 * Computes the local player's effective live statistics combining Class Role + Unlocked Techs.
 */
export function computeActivePlayerStats(
  roleId: AstronautRoleId,
  unlockedTechs: string[],
  squadRoles: AstronautRoleId[] = [roleId]
): ActivePlayerStats {
  const role = getAstronautRole(roleId);
  const m = role.modifiers;
  const squad = computeSquadRoleBonuses(squadRoles.length > 0 ? squadRoles : [roleId]);

  const hasJetpackTech = unlockedTechs.includes('tech-jetpack');
  const hasMagnetTech = unlockedTechs.includes('tech-magnet');
  const hasRoboticsTech = unlockedTechs.includes('tech-robotics');
  const hasPulseTech = unlockedTechs.includes('tech-pulse');

  const moveMult = m.moveSpeedMultiplier * (hasJetpackTech ? 1.18 : 1.0);
  const moveSpeedMs = Number((10.2 * moveMult).toFixed(1));
  const moveSpeedPct = Math.round(moveMult * 100);

  const buildMult = m.buildSpeedMultiplier * (hasRoboticsTech ? 1.45 : 1.0);
  const buildSpeedPct = Math.round(buildMult * 100);

  const repairEfficiencyPct = Math.round(m.repairAmountMultiplier * 100);

  const effectiveResearchMult = Math.max(
    m.techResearchSpeedMultiplier,
    squad.techResearchSpeedMultiplier
  );
  const researchSpeedPct = Math.round(effectiveResearchMult * 100);

  const effectiveEnergyMult = Math.max(
    m.energyGenerationMultiplier,
    squad.energyGenerationMultiplier
  );
  const energyBonusPct = Math.round((effectiveEnergyMult - 1.0) * 100);

  const baseMagnet = hasMagnetTech ? 8.5 : 4.2;
  const pickupRadiusM = Number((baseMagnet * m.pickupRadiusMultiplier).toFixed(1));

  const baseBoltDmg = hasPulseTech ? 44 : 26;
  const plasmaDamage = Math.round(baseBoltDmg * m.combatDamageMultiplier);

  const baseCooldownMs = hasPulseTech ? 170 : 270;
  const plasmaCooldownMs = Math.round(baseCooldownMs * m.plasmaCooldownMultiplier);

  const jetpackCapMult = m.jetpackCapacityMultiplier * (hasJetpackTech ? 1.45 : 1.0);
  const jetpackCapacityPct = Math.round(jetpackCapMult * 100);

  return {
    roleId: role.id,
    roleName: role.name,
    shortLabel: role.shortLabel,
    accentHex: role.accentHex,
    moveSpeedMs,
    moveSpeedPct,
    buildSpeedPct,
    repairEfficiencyPct,
    researchSpeedPct,
    energyBonusPct,
    energyFlatKw: Math.max(m.energyBonusKw, squad.energyFlatBonusKw),
    pickupRadiusM,
    plasmaDamage,
    plasmaCooldownMs,
    jetpackCapacityPct,
  };
}
