/**
 * Colonize Mars - Types & Interfaces
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface CelestialBodyData {
  id: string;
  name: string;
  type: 'star' | 'planet' | 'moon' | 'asteroid';
  radius: number; // in relative visual km/units
  mass: number; // relative gravitational mass (GM)
  parentBodyId?: string;
  semiMajorAxis: number; // orbit radius
  orbitalPeriod: number; // seconds for full orbit at 1x
  initialAnomaly: number; // starting angle in radians
  color: string;
  atmosphereColor?: string;
  atmosphereDensity?: number;
  description: string;
  resources: Record<string, number>; // resource abundance (0-100)
  stationName?: string;
}

export interface StarSystem {
  id: string;
  name: string;
  starType: string;
  starColor: string;
  lightYearsFromSol: number;
  bodies: CelestialBodyData[];
  description: string;
  dangerLevel: 'Safe' | 'Moderate' | 'Hazardous' | 'Extreme';
  discovered: boolean;
}

export interface ShipResources {
  fuel: number; // current kg/units
  maxFuel: number;
  oxygen: number; // 0-100%
  water: number; // 0-100%
  food: number; // 0-100%
  hullIntegrity: number; // 0-100%
  power: number; // 0-100%
  credits: number; // Interplanetary Credits
  cargoUsed: number; // tons
  cargoCapacity: number; // tons
  inventory: Record<string, number>; // commodity id -> units
}

export interface ShipComponent {
  id: string;
  name: string;
  slot: 'engine' | 'tank' | 'hull' | 'lifeSupport' | 'power' | 'avionics';
  level: number;
  cost: number;
  description: string;
  thrustModifier: number; // multiplier
  isp: number; // specific impulse seconds
  fuelCapacityModifier: number; // kg
  cargoModifier: number; // tons
  lifeSupportEfficiency: number; // multiplier on consumption
  mass: number; // tons
  unlocked: boolean;
}

export interface CrewMember {
  id: string;
  name: string;
  role: 'Commander' | 'Chief Engineer' | 'Navigator' | 'Life Support Officer' | 'Trade Specialist' | 'Science Officer';
  portraitSeed: number;
  avatarIcon: string;
  morale: number; // 0-100
  fatigue: number; // 0-100
  skills: {
    piloting: number; // 1-10
    engineering: number;
    astrogation: number;
    trading: number;
    science: number;
  };
  assignment: 'Bridge' | 'Engineering' | 'LifeSupport' | 'Comms' | 'OffDuty';
  statusQuote: string;
  personality: string;
}

export interface TradeCommodity {
  id: string;
  name: string;
  basePrice: number;
  unitMass: number; // tons per unit
  category: 'raw' | 'industrial' | 'life' | 'tech' | 'luxury';
  description: string;
}

export interface MarketItem {
  commodityId: string;
  buyPrice: number; // price player pays to buy
  sellPrice: number; // price player receives when selling
  supply: number;
  demand: number;
  priceTrend: 'up' | 'down' | 'stable';
}

export interface TradeContract {
  id: string;
  title: string;
  originBodyId: string;
  destinationBodyId: string;
  commodityId: string;
  amount: number;
  rewardCredits: number;
  reputationReward: number;
  factionId: string;
  deadlineSeconds: number;
  timeRemaining: number;
  isAccepted: boolean;
  isCompleted: boolean;
}

export interface SimulatedPlayerOrder {
  id: string;
  commanderName: string;
  callsign: string;
  systemName: string;
  action: 'BUY' | 'SELL';
  commodityId: string;
  amount: number;
  pricePerUnit: number;
  timestamp: string;
}

export interface FactionReputation {
  id: string;
  name: string;
  fullName: string;
  color: string;
  standing: number; // -100 to +100
  tier: 'Hostile' | 'Neutral' | 'Friendly' | 'Allied' | 'Governor';
  perks: string;
}

export interface FlightTelemetry {
  speedKmS: number;
  throttle: number; // 0 - 1
  deltaVRemaining: number; // m/s
  altitudeKm: number;
  closestBodyId: string;
  apoapsisKm: number;
  periapsisKm: number;
  eccentricity: number;
  orbitalPeriodSec: number;
  isLanded: boolean;
  isInOrbit: boolean;
  headingPitch: number;
  headingYaw: number;
}
