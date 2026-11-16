/**
 * Dynamic Economy & Multiplayer Trading Hub Engine
 * Simulates supply-demand price curves, player-driven order book,
 * planetary price disparities, trade contracts, and faction reputation.
 */

import {
  TradeCommodity,
  MarketItem,
  TradeContract,
  SimulatedPlayerOrder,
  FactionReputation,
} from '../types/game';

export const COMMODITIES: TradeCommodity[] = [
  {
    id: 'water_ice',
    name: 'Water Ice',
    basePrice: 120,
    unitMass: 1.0,
    category: 'raw',
    description: 'Extracted from comets & lunar poles. Essential for life support and propellant electrolysis.',
  },
  {
    id: 'methalox',
    name: 'Refined Methalox',
    basePrice: 210,
    unitMass: 1.0,
    category: 'industrial',
    description: 'Cryogenic liquid methane & oxidizer. The lifeblood of interplanetary rocket propulsion.',
  },
  {
    id: 'bio_fertilizer',
    name: 'Martian Bio-Nutrients',
    basePrice: 480,
    unitMass: 0.8,
    category: 'life',
    description: 'Enriched organic substrate necessary for Martian subterranean hydroponic dome crops.',
  },
  {
    id: 'rare_earths',
    name: 'Asteroidal Rare Earths',
    basePrice: 850,
    unitMass: 1.2,
    category: 'raw',
    description: 'Neodymium, scandium, and platinum-group metals mined from M-type carbonaceous asteroids.',
  },
  {
    id: 'helium_3',
    name: 'Helium-3 Isotope',
    basePrice: 1500,
    unitMass: 0.4,
    category: 'tech',
    description: 'Ultra-pure aneutronic fusion fuel harvested from lunar regolith and Jovian upper atmosphere.',
  },
  {
    id: 'hab_modules',
    name: 'Colonial Hab Modules',
    basePrice: 2200,
    unitMass: 3.5,
    category: 'industrial',
    description: 'Pressurized Kevlar-composite inflatable habitats equipped with radiation-hardened shielding.',
  },
  {
    id: 'ai_cores',
    name: 'Quantum AI Cores',
    basePrice: 3800,
    unitMass: 0.5,
    category: 'tech',
    description: 'Superconducting neuromorphic computing blocks designed for autonomous colony management.',
  },
  {
    id: 'regolith_bricks',
    name: 'Sintered Regolith Bricks',
    basePrice: 90,
    unitMass: 2.0,
    category: 'raw',
    description: 'Microwave-sintered Martian soil used for rapid perimeter shielding and landing pad paving.',
  },
];

export const INITIAL_FACTIONS: FactionReputation[] = [
  {
    id: 'mcc',
    name: 'MCC',
    fullName: 'Martian Colonial Coalition',
    color: '#ef4444',
    standing: 15,
    tier: 'Friendly',
    perks: '10% fuel discount at Bradbury Station, priority hab permits',
  },
  {
    id: 'ueg',
    name: 'UEG',
    fullName: 'United Earth Governance',
    color: '#3b82f6',
    standing: 0,
    tier: 'Neutral',
    perks: 'Standard docking clearance in LEO spaceports',
  },
  {
    id: 'opa',
    name: 'OPA',
    fullName: 'Outer Planets Alliance',
    color: '#10b981',
    standing: 20,
    tier: 'Friendly',
    perks: 'Access to illicit black-market thrusters and asteroid ice depots',
  },
  {
    id: 'tos',
    name: 'TOS',
    fullName: 'Trans-Orbital Syndicate',
    color: '#f59e0b',
    standing: 5,
    tier: 'Neutral',
    perks: 'Access to high-yield deep space transport logistics contracts',
  },
];

/**
 * Calculates current market prices based on local supply and demand ratios.
 */
export function calculateMarketPrice(
  basePrice: number,
  supply: number,
  demand: number,
  priceModifier: number = 1.0
): { buyPrice: number; sellPrice: number } {
  const safeSupply = Math.max(10, supply);
  const safeDemand = Math.max(10, demand);
  const ratio = safeDemand / safeSupply;

  // Clamped price multiplier between 0.4x and 2.8x
  const multiplier = Math.min(2.8, Math.max(0.4, Math.sqrt(ratio))) * priceModifier;
  const nominal = Math.round(basePrice * multiplier);

  // Spread: sell price is 88-92% of buy price (station tariff/commission)
  const buyPrice = Math.max(10, nominal);
  const sellPrice = Math.max(8, Math.round(nominal * 0.88));

  return { buyPrice, sellPrice };
}

/**
 * Generates initial market catalog for a celestial body station.
 */
export function generateStationMarket(bodyId: string): Record<string, MarketItem> {
  const market: Record<string, MarketItem> = {};

  for (const comm of COMMODITIES) {
    let supply = 100;
    let demand = 100;
    let localMod = 1.0;

    switch (bodyId) {
      case 'mars':
        if (comm.id === 'bio_fertilizer' || comm.id === 'water_ice' || comm.id === 'hab_modules') {
          demand = 280;
          supply = 40;
        } else if (comm.id === 'regolith_bricks') {
          supply = 350;
          demand = 50;
        }
        break;
      case 'earth':
        if (comm.id === 'helium_3' || comm.id === 'rare_earths') {
          demand = 320;
          supply = 30;
        } else if (comm.id === 'hab_modules' || comm.id === 'ai_cores') {
          supply = 240;
          demand = 80;
        }
        break;
      case 'moon':
        if (comm.id === 'helium_3') {
          supply = 290;
          demand = 50;
        } else if (comm.id === 'water_ice' || comm.id === 'methalox') {
          demand = 220;
          supply = 60;
        }
        break;
      case 'ceres':
      case 'asteroid_belt':
        if (comm.id === 'rare_earths' || comm.id === 'water_ice') {
          supply = 320;
          demand = 40;
        } else if (comm.id === 'ai_cores' || comm.id === 'bio_fertilizer') {
          demand = 250;
          supply = 30;
        }
        break;
      case 'europa':
      case 'jupiter':
        if (comm.id === 'water_ice') {
          supply = 450;
          demand = 20;
        } else if (comm.id === 'methalox' || comm.id === 'hab_modules') {
          demand = 300;
          supply = 35;
        }
        break;
      default:
        supply = 120;
        demand = 120;
    }

    const { buyPrice, sellPrice } = calculateMarketPrice(comm.basePrice, supply, demand, localMod);
    market[comm.id] = {
      commodityId: comm.id,
      buyPrice,
      sellPrice,
      supply,
      demand,
      priceTrend: demand > supply ? 'up' : demand < supply ? 'down' : 'stable',
    };
  }

  return market;
}

/**
 * Creates dynamic multiplayer trading hub order book.
 * Simulates real-time peer player transactions and network activity.
 */
export function generateInitialPlayerOrders(): SimulatedPlayerOrder[] {
  const commanderNames = [
    'Cmdr. Vance-9',
    'Astraea_Drifter',
    'Kowalski_BeltMining',
    'NovaPilot_X',
    'Sagan_Echo',
    'Helios_Logistics',
    'Valkyrie_Orbital',
    'Tarkov_Freighter',
  ];

  const systems = ['Sol System (LEO)', 'Mars Orbital', 'Ceres Outpost', 'Lunar Gateway', 'Titan Prime'];

  const orders: SimulatedPlayerOrder[] = [];
  const commIds = COMMODITIES.map((c) => c.id);

  for (let i = 0; i < 8; i++) {
    const cmdr = commanderNames[i % commanderNames.length];
    const commId = commIds[i % commIds.length];
    const comm = COMMODITIES.find((c) => c.id === commId)!;
    const action = i % 2 === 0 ? 'BUY' : 'SELL';
    const amount = 5 + (i * 3) % 25;
    const priceVariance = 0.9 + ((i * 7) % 25) / 100; // 0.90 to 1.15
    const pricePerUnit = Math.round(comm.basePrice * priceVariance);

    orders.push({
      id: `ord-${i + 1}`,
      commanderName: cmdr,
      callsign: `CMDR-${100 + i * 47}`,
      systemName: systems[i % systems.length],
      action,
      commodityId: commId,
      amount,
      pricePerUnit,
      timestamp: `${(i + 1) * 3}m ago`,
    });
  }

  return orders;
}

/**
 * Generates available high-value trade and colonial delivery contracts.
 */
export function generateTradeContracts(): TradeContract[] {
  return [
    {
      id: 'contract-mars-colonize-1',
      title: 'Emergency Life Support to Bradbury Outpost',
      originBodyId: 'earth',
      destinationBodyId: 'mars',
      commodityId: 'bio_fertilizer',
      amount: 15,
      rewardCredits: 14500,
      reputationReward: 18,
      factionId: 'mcc',
      deadlineSeconds: 900,
      timeRemaining: 900,
      isAccepted: false,
      isCompleted: false,
    },
    {
      id: 'contract-lunar-helium',
      title: 'Helium-3 Transport to Earth Fusion Grid',
      originBodyId: 'moon',
      destinationBodyId: 'earth',
      commodityId: 'helium_3',
      amount: 10,
      rewardCredits: 22000,
      reputationReward: 15,
      factionId: 'ueg',
      deadlineSeconds: 600,
      timeRemaining: 600,
      isAccepted: false,
      isCompleted: false,
    },
    {
      id: 'contract-ceres-water',
      title: 'Belt Ice Shipment to Martian Phobos Dock',
      originBodyId: 'ceres',
      destinationBodyId: 'mars',
      commodityId: 'water_ice',
      amount: 25,
      rewardCredits: 9800,
      reputationReward: 12,
      factionId: 'opa',
      deadlineSeconds: 1200,
      timeRemaining: 1200,
      isAccepted: false,
      isCompleted: false,
    },
    {
      id: 'contract-ai-deployment',
      title: 'Autonomous AI Cores for Olympus Biosphere',
      originBodyId: 'earth',
      destinationBodyId: 'mars',
      commodityId: 'ai_cores',
      amount: 6,
      rewardCredits: 34000,
      reputationReward: 25,
      factionId: 'mcc',
      deadlineSeconds: 1500,
      timeRemaining: 1500,
      isAccepted: false,
      isCompleted: false,
    },
  ];
}

/**
 * Updates market prices based on player trade action.
 */
export function processPlayerTrade(
  market: Record<string, MarketItem>,
  commodityId: string,
  amount: number,
  isPlayerBuying: boolean
): Record<string, MarketItem> {
  const item = market[commodityId];
  if (!item) return market;

  const newMarket = { ...market };
  const comm = COMMODITIES.find((c) => c.id === commodityId);
  const basePrice = comm ? comm.basePrice : 100;

  let newSupply = item.supply;
  let newDemand = item.demand;

  if (isPlayerBuying) {
    newSupply = Math.max(5, newSupply - amount);
    newDemand += Math.round(amount * 0.5);
  } else {
    // Player selling increases local supply and satisfies demand
    newSupply += amount;
    newDemand = Math.max(5, newDemand - Math.round(amount * 0.5));
  }

  const { buyPrice, sellPrice } = calculateMarketPrice(basePrice, newSupply, newDemand);

  newMarket[commodityId] = {
    ...item,
    supply: newSupply,
    demand: newDemand,
    buyPrice,
    sellPrice,
    priceTrend: buyPrice > item.buyPrice ? 'up' : buyPrice < item.buyPrice ? 'down' : 'stable',
  };

  return newMarket;
}
