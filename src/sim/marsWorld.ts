/**
 * Martian Biomes, Crater Excavation, Glass-Dome Food Crops & Planetary Orbital Sites
 * Pure TypeScript simulation module shared by 3D terrain, gameplay HUD, and unit tests.
 */

export type MarsBiomeId =
  | 'gale-plains'
  | 'basalt-canyon'
  | 'polar-frost'
  | 'tharsis-fissure';

export interface MarsBiomeInfo {
  id: MarsBiomeId;
  name: string;
  subtitle: string;
  accentHex: string;
  primaryMinerals: string;
  /** RGB multipliers (0..1) for terrain vertex coloring */
  tintRgb: [number, number, number];
}

export const MARS_BIOMES: Record<MarsBiomeId, MarsBiomeInfo> = {
  'gale-plains': {
    id: 'gale-plains',
    name: 'Planície de Gale',
    subtitle: 'Zona de pouso e dunas de óxido de ferro',
    accentHex: '#ea580c',
    primaryMinerals: 'Regolito · Ferro (Fe)',
    tintRgb: [0.96, 0.56, 0.36],
  },
  'basalt-canyon': {
    id: 'basalt-canyon',
    name: 'Cânion de Basalto',
    subtitle: 'Escarpa rochosa rica em hematita e ligas pesadas',
    accentHex: '#b45309',
    primaryMinerals: 'Ferro (Fe) · Titânio (Ti)',
    tintRgb: [0.68, 0.38, 0.28],
  },
  'polar-frost': {
    id: 'polar-frost',
    name: 'Calota Polar Norte',
    subtitle: 'Permafrost cristalino e depósitos de sílica',
    accentHex: '#38bdf8',
    primaryMinerals: 'Gelo (H₂O) · Silício (Si)',
    tintRgb: [0.84, 0.88, 0.96],
  },
  'tharsis-fissure': {
    id: 'tharsis-fissure',
    name: 'Fissura Vulcânica Tharsis',
    subtitle: 'Fumarolas geotérmicas, enxofre e minérios raros',
    accentHex: '#f59e0b',
    primaryMinerals: 'Titânio (Ti) · Enxofre (S) · Silício (Si)',
    tintRgb: [0.56, 0.32, 0.26],
  },
};

export function getMarsBiomeAt(x: number, z: number): MarsBiomeInfo {
  const distCenter = Math.hypot(x, z);
  if (distCenter < 28) {
    return MARS_BIOMES['gale-plains'];
  }
  // North sector (z < -26 and |x| < 58) -> Polar Frost
  if (z < -26 && Math.abs(x) < Math.abs(z) * 1.15) {
    return MARS_BIOMES['polar-frost'];
  }
  // East sector (x > 26) -> Basalt Canyon
  if (x > 26 && x >= Math.abs(z) * 0.72) {
    return MARS_BIOMES['basalt-canyon'];
  }
  // West / South-West sector (x < -24 or z > 32) -> Volcanic Fissure
  if (x < -24 || z > 34) {
    return MARS_BIOMES['tharsis-fissure'];
  }
  return MARS_BIOMES['gale-plains'];
}

export interface ExcavatedCrater {
  id: string;
  x: number;
  z: number;
  radius: number; // typically 2.4..3.8m
  depth: number; // typically 1.0..1.65m
  biomeId: MarsBiomeId;
}

export interface ExcavationYield {
  regolith: number;
  waterIce: number;
  iron: number;
  titanium: number;
  silicon: number;
  sulfur: number;
  summaryText: string;
}

/**
 * Computes terrain Y offset caused by player-excavated craters (bowl + raised ejecta rim).
 */
export function craterOffsetAt(
  x: number,
  z: number,
  craters?: ExcavatedCrater[]
): number {
  if (!craters || craters.length === 0) return 0;
  let delta = 0;
  for (let i = 0; i < craters.length; i++) {
    const c = craters[i];
    const dx = x - c.x;
    const dz = z - c.z;
    const outerR = c.radius * 1.45;
    const distSq = dx * dx + dz * dz;
    if (distSq >= outerR * outerR) continue;
    const dist = Math.sqrt(distSq);
    if (dist < c.radius) {
      // Smooth parabolic crater bowl
      const norm = dist / c.radius;
      const bowl = (1 - norm * norm);
      delta -= c.depth * bowl;
    } else {
      // Slight raised ejecta rim ring around the crater edge
      const rimT = (dist - c.radius) / (outerR - c.radius);
      const rimCurve = Math.sin(rimT * Math.PI);
      delta += c.depth * 0.18 * rimCurve;
    }
  }
  return delta;
}

/**
 * Computes deterministic/biome-authentic mineral yield when excavating a crater at (x, z).
 */
export function computeExcavationYield(
  x: number,
  z: number,
  rng: () => number = Math.random
): { biome: MarsBiomeInfo; yieldData: ExcavationYield } {
  const biome = getMarsBiomeAt(x, z);
  const bonusRoll = rng() > 0.45 ? 1 : 0;

  let regolith = 1;
  let waterIce = 0;
  let iron = 0;
  let titanium = 0;
  let silicon = 0;
  let sulfur = 0;

  switch (biome.id) {
    case 'gale-plains':
      regolith = 2 + bonusRoll;
      iron = 1 + (rng() > 0.4 ? 1 : 0);
      silicon = rng() > 0.55 ? 1 : 0;
      break;
    case 'basalt-canyon':
      regolith = 1;
      iron = 2 + bonusRoll;
      titanium = 1 + (rng() > 0.5 ? 1 : 0);
      break;
    case 'polar-frost':
      waterIce = 2 + bonusRoll;
      silicon = 2;
      regolith = 1;
      break;
    case 'tharsis-fissure':
      titanium = 1 + bonusRoll;
      sulfur = 2 + (rng() > 0.5 ? 1 : 0);
      silicon = 1;
      break;
  }

  const parts: string[] = [];
  if (regolith > 0) parts.push(`+${regolith} Regolito`);
  if (waterIce > 0) parts.push(`+${waterIce} Gelo`);
  if (iron > 0) parts.push(`+${iron} Ferro`);
  if (titanium > 0) parts.push(`+${titanium} Titânio`);
  if (silicon > 0) parts.push(`+${silicon} Silício`);
  if (sulfur > 0) parts.push(`+${sulfur} Enxofre`);

  return {
    biome,
    yieldData: {
      regolith,
      waterIce,
      iron,
      titanium,
      silicon,
      sulfur,
      summaryText: parts.join(' · '),
    },
  };
}

// ============================================================================
// GLASS-DOME HYDROPONIC FOOD FARMING (REDOMAS DE VIDRO)
// ============================================================================

export type CropTypeId = 'potato' | 'lettuce' | 'wheat';

export interface CropDefinition {
  id: CropTypeId;
  name: string;
  description: string;
  waterCost: number;
  growthSec: number;
  foodYield: number;
  biomassYield: number;
  colorHex: string;
}

export const CROP_CATALOG: CropDefinition[] = [
  {
    id: 'potato',
    name: 'Batata Marciana',
    description: 'Tubérculo resiliente de ciclo rápido para rações diárias da equipe.',
    waterCost: 1,
    growthSec: 12,
    foodYield: 6,
    biomassYield: 1,
    colorHex: '#65a30d',
  },
  {
    id: 'lettuce',
    name: 'Alface & Espirulina',
    description: 'Cultivo hidropônico rico em oxigênio, micronutrientes e biomassa.',
    waterCost: 2,
    growthSec: 15,
    foodYield: 5,
    biomassYield: 3,
    colorHex: '#10b981',
  },
  {
    id: 'wheat',
    name: 'Trigo Bioengenheirado',
    description: 'Grão dourado de altíssimo rendimento calórico dentro da redoma.',
    waterCost: 2,
    growthSec: 20,
    foodYield: 11,
    biomassYield: 2,
    colorHex: '#eab308',
  },
];

export interface DomeCropBed {
  bedIndex: number; // 0..3 inside the glass BioDome
  cropId: CropTypeId | null;
  elapsedSec: number;
  durationSec: number;
  readyToHarvest: boolean;
}

export function createInitialDomeCrops(): DomeCropBed[] {
  return [0, 1, 2, 3].map((bedIndex) => ({
    bedIndex,
    cropId: null,
    elapsedSec: 0,
    durationSec: 12,
    readyToHarvest: false,
  }));
}

export function getCropDef(cropId: CropTypeId): CropDefinition {
  return CROP_CATALOG.find((c) => c.id === cropId) || CROP_CATALOG[0];
}

export function stepDomeCrops(
  beds: DomeCropBed[],
  dt: number,
  speedMult = 1.0
): DomeCropBed[] {
  let changed = false;
  const next = beds.map((bed) => {
    if (!bed.cropId || bed.readyToHarvest) return bed;
    const nextElapsed = Math.min(bed.durationSec, bed.elapsedSec + dt * speedMult);
    const ready = nextElapsed >= bed.durationSec;
    if (nextElapsed !== bed.elapsedSec || ready !== bed.readyToHarvest) {
      changed = true;
      return {
        ...bed,
        elapsedSec: nextElapsed,
        readyToHarvest: ready,
      };
    }
    return bed;
  });
  return changed ? next : beds;
}

// ============================================================================
// PLANETARY STARSHIP EXPLORATION (ORBITAL SITES AROUND MARS)
// ============================================================================

export interface PlanetarySiteReward {
  regolith?: number;
  waterIce?: number;
  water?: number;
  iron?: number;
  titanium?: number;
  silicon?: number;
  sulfur?: number;
  fuel?: number;
  food?: number;
  biomass?: number;
}

export interface PlanetarySite {
  id: string;
  name: string;
  region: string;
  /** Spherical coordinates on Mars globe (radians) */
  lat: number;
  lon: number;
  signalLabel: string;
  discoveryLore: string;
  fuelCost: number;
  rewardText: string;
  reward: PlanetarySiteReward;
  accentHex: string;
}

export const PLANETARY_SITES: PlanetarySite[] = [
  {
    id: 'site-olympus',
    name: 'Olympus Mons · Caldeira Magmática',
    region: '18.6°N · 226.2°E',
    lat: 0.34,
    lon: -1.1,
    signalLabel: 'Assinatura Térmica Intensa',
    discoveryLore:
      'A nave detectou veios expostos de titânio e enxofre vulcânico na encosta do maior vulcão do Sistema Solar.',
    fuelCost: 1,
    rewardText: '+6 Titânio · +6 Enxofre · +4 Ferro',
    reward: { titanium: 6, sulfur: 6, iron: 4 },
    accentHex: '#f97316',
  },
  {
    id: 'site-valles',
    name: 'Valles Marineris · Sonda Viking Perdida',
    region: '13.9°S · 300.8°E',
    lat: -0.26,
    lon: 0.45,
    signalLabel: 'Transponder Histórico',
    discoveryLore:
      'Recuperados painéis intactos de silício de alta pureza e registros geológicos antigos do grande cânion marciano.',
    fuelCost: 1,
    rewardText: '+8 Silício · +6 Ferro · +4 Regolito',
    reward: { silicon: 8, iron: 6, regolith: 4 },
    accentHex: '#38bdf8',
  },
  {
    id: 'site-boreum',
    name: 'Planum Boreum · Aquífero Subglacial',
    region: '82.4°N · 15.0°E',
    lat: 1.12,
    lon: 0.28,
    signalLabel: 'Eco de Radar Hídrico',
    discoveryLore:
      'Bolsão cristalino de gelo de água pura sob a calota polar norte — reserva estratégica para as redomas da colônia.',
    fuelCost: 1,
    rewardText: '+10 Gelo · +8 Água · +3 Silício',
    reward: { waterIce: 10, water: 8, silicon: 3 },
    accentHex: '#22d3ee',
  },
  {
    id: 'site-cydonia',
    name: 'Cydonia · Anomalia Eletromagnética',
    region: '40.7°N · 350.5°E',
    lat: 0.68,
    lon: 1.85,
    signalLabel: 'Pulso Magnético Desconhecido',
    discoveryLore:
      'Um meteorito metálico enterrado gerava o pulso: liga natural rara de titânio-silício perfeita para armamentos avançados.',
    fuelCost: 1,
    rewardText: '+7 Titânio · +6 Silício · +4 Combustível',
    reward: { titanium: 7, silicon: 6, fuel: 4 },
    accentHex: '#a855f7',
  },
  {
    id: 'site-hellas',
    name: 'Hellas Planitia · Cápsula de Suprimentos',
    region: '42.4°S · 70.5°E',
    lat: -0.72,
    lon: -2.35,
    signalLabel: 'Baliza de Emergência da Missão',
    discoveryLore:
      'Localizada cápsula orbital pré-enviada pela Terra contendo sementes preservadas, rações liofilizadas e hidrogênio líquido.',
    fuelCost: 1,
    rewardText: '+12 Alimentos · +5 Combustível · +5 Biomassa',
    reward: { food: 12, fuel: 5, biomass: 5 },
    accentHex: '#10b981',
  },
  {
    id: 'site-jezero',
    name: 'Cratera Jezero · Bioassinatura Fóssil',
    region: '18.4°N · 77.6°E',
    lat: 0.32,
    lon: 2.7,
    signalLabel: 'Sinal Orgânico em Delta Antigo',
    discoveryLore:
      'Descoberta histórica! Estromatólitos microscópicos fossilizados confirmam vida microbiana ancestral em Marte — marco científico máximo!',
    fuelCost: 1,
    rewardText: '+10 Biomassa · +8 Alimentos · +6 Água · +5 Titânio',
    reward: { biomass: 10, food: 8, water: 6, titanium: 5 },
    accentHex: '#eab308',
  },
];
