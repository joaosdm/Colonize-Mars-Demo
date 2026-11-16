/**
 * Dynamic AI Crew Management Engine
 * Handles crew duty assignments, skill modifiers, AI tactical advice,
 * morale/fatigue cycles, and space emergency decision events.
 */

import { CrewMember } from '../types/game';

export const INITIAL_CREW: CrewMember[] = [
  {
    id: 'crew-1',
    name: 'Dr. Elena Rostova',
    role: 'Commander',
    portraitSeed: 101,
    avatarIcon: 'ShieldAlert',
    morale: 92,
    fatigue: 12,
    skills: {
      piloting: 9,
      engineering: 6,
      astrogation: 8,
      trading: 7,
      science: 8,
    },
    assignment: 'Bridge',
    statusQuote: 'All navigation computers nominal. Mars orbital window is opening.',
    personality: 'Calm, methodical, veteran of the Martian Proving Expeditions.',
  },
  {
    id: 'crew-2',
    name: 'Marcus "Torque" Vance',
    role: 'Chief Engineer',
    portraitSeed: 202,
    avatarIcon: 'Wrench',
    morale: 88,
    fatigue: 24,
    skills: {
      piloting: 4,
      engineering: 10,
      astrogation: 5,
      trading: 4,
      science: 6,
    },
    assignment: 'Engineering',
    statusQuote: 'Cryo-pumps running clean. I have tuned the injector for +8% delta-V efficiency.',
    personality: 'Pragmatic, grease-under-fingernails propulsion genius.',
  },
  {
    id: 'crew-3',
    name: 'Lt. Maya Lin',
    role: 'Navigator',
    portraitSeed: 303,
    avatarIcon: 'Compass',
    morale: 85,
    fatigue: 18,
    skills: {
      piloting: 8,
      engineering: 4,
      astrogation: 10,
      trading: 5,
      science: 7,
    },
    assignment: 'Bridge',
    statusQuote: 'Tracking Martian periapsis. Gravitational assist solution computed.',
    personality: 'Astrodynamics prodigy from the Lunar Academy.',
  },
  {
    id: 'crew-4',
    name: 'Dr. Tariq Al-Mansoor',
    role: 'Life Support Officer',
    portraitSeed: 404,
    avatarIcon: 'HeartPulse',
    morale: 90,
    fatigue: 15,
    skills: {
      piloting: 3,
      engineering: 7,
      astrogation: 4,
      trading: 6,
      science: 9,
    },
    assignment: 'LifeSupport',
    statusQuote: 'CO2 scrubbers at 99.4% purity. Hydroponic algae culture thriving.',
    personality: 'Attentive biosystems ecologist dedicated to crew survival.',
  },
  {
    id: 'crew-5',
    name: 'Sariyah "Cipher" Thorne',
    role: 'Trade Specialist',
    portraitSeed: 505,
    avatarIcon: 'Coins',
    morale: 82,
    fatigue: 20,
    skills: {
      piloting: 5,
      engineering: 3,
      astrogation: 6,
      trading: 10,
      science: 5,
    },
    assignment: 'Comms',
    statusQuote: 'Interstellar trade hub frequencies synced. High arbitrage detected on Helium-3.',
    personality: 'Sharp-tongued former broker with contacts across all four mega-factions.',
  },
];

export interface CrewDilemmaEvent {
  id: string;
  title: string;
  description: string;
  requiringRole: string;
  options: {
    label: string;
    outcomeText: string;
    fuelCost?: number;
    creditsCost?: number;
    moraleDelta: number;
    hullDelta?: number;
    reputationFactionId?: string;
    reputationDelta?: number;
  }[];
}

export const CREW_DILEMMA_EVENTS: CrewDilemmaEvent[] = [
  {
    id: 'solar-flare-warning',
    title: 'Coronal Mass Ejection Warning',
    description: 'Solar arrays detect an intense X-class radiation burst emanating from Sol.',
    requiringRole: 'Chief Engineer',
    options: [
      {
        label: 'Re-orient ship and retract auxiliary arrays',
        outcomeText: 'Arrays protected! Minor fuel expended during attitude reorientation.',
        fuelCost: 20,
        moraleDelta: 5,
        hullDelta: 0,
      },
      {
        label: 'Overcharge magnetic deflectors',
        outcomeText: 'Deflectors held the flare off, but power grids took a small strain.',
        fuelCost: 0,
        moraleDelta: -5,
        hullDelta: -5,
      },
    ],
  },
  {
    id: 'distress-beacon',
    title: 'Automated Distress Beacon Detected',
    description: 'An unmanned planetary prospecting drone is adrift in the Asteroid Belt.',
    requiringRole: 'Navigator',
    options: [
      {
        label: 'Perform rendezvous maneuver and salvage drone core',
        outcomeText: 'Valuable survey data salvaged! Sold telemetry data to United Earth Governance.',
        fuelCost: 35,
        moraleDelta: 10,
        reputationFactionId: 'ueg',
        reputationDelta: 8,
      },
      {
        label: 'Maintain current interplanetary trajectory',
        outcomeText: 'Conserved critical fuel reserves for the primary colonization burn.',
        fuelCost: 0,
        moraleDelta: 0,
      },
    ],
  },
  {
    id: 'hydroponic-surge',
    title: 'Hydroponic Algae Mutation',
    description: 'Life support biologist Tariq reports a rare high-yield oxygen algae bloom.',
    requiringRole: 'Life Support Officer',
    options: [
      {
        label: 'Harvest excess biomass for extra crew rations',
        outcomeText: 'Fresh meals boost crew spirits and extend food reserves!',
        moraleDelta: 15,
      },
      {
        label: 'Refine biomass into bio-fertilizer trade cargo',
        outcomeText: 'Produced 5 units of high-grade Martian Bio-Nutrients for sale.',
        moraleDelta: 5,
      },
    ],
  },
];

/**
 * Calculates current ship efficiency multipliers based on crew assignments and morale.
 */
export function calculateCrewModifiers(crew: CrewMember[]) {
  let engineEfficiency = 1.0;
  let lifeSupportConsumptionRate = 1.0;
  let tradeMarginBonus = 0.0;
  let pilotingAgility = 1.0;

  for (const member of crew) {
    const moraleMult = member.morale / 100;
    const fatiguePenalty = Math.max(0.5, 1 - member.fatigue / 200);
    const effectiveSkill = moraleMult * fatiguePenalty;

    switch (member.assignment) {
      case 'Engineering':
        // Engineering crew reduces fuel burn and boosts ISP
        engineEfficiency += (member.skills.engineering / 10) * 0.15 * effectiveSkill;
        break;
      case 'LifeSupport':
        // Life support crew reduces O2/water consumption
        lifeSupportConsumptionRate -= (member.skills.science / 10) * 0.25 * effectiveSkill;
        break;
      case 'Comms':
        // Trade specialist boosts sell prices & cuts tariffs
        tradeMarginBonus += (member.skills.trading / 10) * 0.12 * effectiveSkill;
        break;
      case 'Bridge':
        // Piloting & astrogation increases maneuver responsiveness
        pilotingAgility += ((member.skills.piloting + member.skills.astrogation) / 20) * 0.2 * effectiveSkill;
        break;
    }
  }

  return {
    engineEfficiency: Math.max(1.0, engineEfficiency),
    lifeSupportConsumptionRate: Math.max(0.5, lifeSupportConsumptionRate),
    tradeMarginBonus: Math.min(0.25, tradeMarginBonus),
    pilotingAgility: Math.max(1.0, pilotingAgility),
  };
}
