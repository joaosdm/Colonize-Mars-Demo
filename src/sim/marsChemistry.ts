/**
 * Mars ISRU Chemical Element Extraction & Craftable Weapons Arsenal
 * Pure TypeScript simulation shared across HUD, Workshop Modal, Combat, and Unit Tests.
 */

export type WeaponId =
  | 'pulse-pistol'
  | 'plasma-rifle'
  | 'ion-shotgun'
  | 'titanium-railgun';

export interface WeaponDefinition {
  id: WeaponId;
  slotKey: '1' | '2' | '3' | '4';
  name: string;
  tagline: string;
  damagePerBolt: number;
  boltCount: number;
  spreadRad: number;
  cooldownMs: number;
  boltSpeed: number;
  piercing: boolean;
  boltColorHex: string;
  cost: {
    iron: number;
    titanium: number;
    silicon: number;
    sulfur: number;
    fuel: number;
  };
}

export const WEAPON_CATALOG: WeaponDefinition[] = [
  {
    id: 'pulse-pistol',
    slotKey: '1',
    name: 'Pistola de Pulso EVA',
    tagline: 'Arma padrão de defesa pessoal — confiável e equilibrada.',
    damagePerBolt: 26,
    boltCount: 1,
    spreadRad: 0,
    cooldownMs: 260,
    boltSpeed: 26,
    piercing: false,
    boltColorHex: '#38bdf8',
    cost: { iron: 0, titanium: 0, silicon: 0, sulfur: 0, fuel: 0 },
  },
  {
    id: 'plasma-rifle',
    slotKey: '2',
    name: 'Rifle de Assalto a Plasma',
    tagline: 'Rajada dupla de alta cadência para conter enxames de sílica.',
    damagePerBolt: 24,
    boltCount: 2,
    spreadRad: 0.08,
    cooldownMs: 185,
    boltSpeed: 32,
    piercing: false,
    boltColorHex: '#34d399',
    cost: { iron: 4, titanium: 0, silicon: 3, sulfur: 0, fuel: 0 },
  },
  {
    id: 'ion-shotgun',
    slotKey: '3',
    name: 'Escopeta Iônica de Dispersão',
    tagline: 'Dispara 4 feixes energéticos em leque com alto impacto próximo.',
    damagePerBolt: 20,
    boltCount: 4,
    spreadRad: 0.34,
    cooldownMs: 470,
    boltSpeed: 24,
    piercing: false,
    boltColorHex: '#f59e0b',
    cost: { iron: 5, titanium: 3, silicon: 0, sulfur: 2, fuel: 0 },
  },
  {
    id: 'titanium-railgun',
    slotKey: '4',
    name: 'Canhão Railgun de Titânio',
    tagline: 'Projétil hiperveloz perfurante que atravessa inimigos blindados.',
    damagePerBolt: 92,
    boltCount: 1,
    spreadRad: 0,
    cooldownMs: 620,
    boltSpeed: 46,
    piercing: true,
    boltColorHex: '#c084fc',
    cost: { iron: 0, titanium: 6, silicon: 5, sulfur: 0, fuel: 3 },
  },
];

export function getWeaponDef(id: WeaponId): WeaponDefinition {
  return WEAPON_CATALOG.find((w) => w.id === id) || WEAPON_CATALOG[0];
}

export interface ElementBag {
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
  oxygen: number;
  oxygenMax: number;
}

export interface ChemicalRecipe {
  id: string;
  name: string;
  formula: string;
  description: string;
  inputs: Partial<Record<keyof Omit<ElementBag, 'oxygen' | 'oxygenMax'>, number>>;
  outputs: Partial<Record<keyof Omit<ElementBag, 'oxygen' | 'oxygenMax'>, number>> & {
    oxygenRefill?: boolean;
  };
}

export const REFINERY_RECIPES: ChemicalRecipe[] = [
  {
    id: 'smelt-regolith',
    name: 'Redução de Óxido de Ferro',
    formula: 'Fe₂O₃ (Regolito) → Fe + Si',
    description: 'Extrai Ferro metálico e Silício diretamente do solo marciano.',
    inputs: { regolith: 3 },
    outputs: { iron: 2, silicon: 1 },
  },
  {
    id: 'melt-ice',
    name: 'Destilação Térmica de Gelo',
    formula: '2 H₂O (s) → 3 H₂O (l)',
    description: 'Purifica blocos de gelo polar em água potável para irrigação e eletrólise.',
    inputs: { waterIce: 2 },
    outputs: { water: 3 },
  },
  {
    id: 'water-electrolysis',
    name: 'Eletrólise de Água (O₂ + H₂)',
    formula: '2 H₂O → 2 H₂ (Propelente) + O₂ 100%',
    description: 'Separa água em hidrogênio combustível para a nave e recarrega o oxigênio do traje.',
    inputs: { water: 2 },
    outputs: { fuel: 2, oxygenRefill: true },
  },
  {
    id: 'sabatier-propellant',
    name: 'Síntese Sabatier de Propelente',
    formula: 'H₂O + S + CO₂ → 4 CH₄/H₂',
    description: 'Catalisa gelo e enxofre vulcânico em combustível espacial de longo alcance.',
    inputs: { waterIce: 2, sulfur: 2 },
    outputs: { fuel: 4 },
  },
  {
    id: 'titanium-alloy',
    name: 'Refino Aeroespacial de Titânio',
    formula: '3 Fe + 2 Si → 2 Ti (Liga)',
    description: 'Concentra silicato férrico em liga pura de Titânio para armas e blindagem.',
    inputs: { iron: 3, silicon: 2 },
    outputs: { titanium: 2 },
  },
  {
    id: 'bio-nutrient',
    name: 'Nutriente Hidropônico (NPK)',
    formula: '2 S + 2 H₂O → 3 Biomassa + 4 Alimentos',
    description: 'Sintetiza sulfato mineral nutritivo para acelerar produção de alimentos.',
    inputs: { sulfur: 2, water: 2 },
    outputs: { biomass: 3, food: 4 },
  },
];

export function canRunRecipe<T extends ElementBag>(
  state: T,
  recipeId: string
): { ok: boolean; recipe?: ChemicalRecipe; reason?: string } {
  const recipe = REFINERY_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { ok: false, reason: 'Processo químico desconhecido.' };

  for (const [key, req] of Object.entries(recipe.inputs)) {
    const k = key as keyof typeof recipe.inputs;
    const needed = req || 0;
    if ((state[k] as number) < needed) {
      return { ok: false, recipe, reason: 'Elementos insuficientes.' };
    }
  }
  return { ok: true, recipe };
}

export function executeRefineryRecipe<T extends ElementBag>(
  state: T,
  recipeId: string
): { state: T; ok: boolean; label: string } {
  const check = canRunRecipe(state, recipeId);
  if (!check.ok || !check.recipe) {
    return { state, ok: false, label: check.reason || 'Falha na síntese.' };
  }

  const next = { ...state };
  for (const [key, req] of Object.entries(check.recipe.inputs)) {
    const k = key as keyof typeof check.recipe.inputs;
    (next[k] as number) -= req || 0;
  }

  for (const [key, out] of Object.entries(check.recipe.outputs)) {
    if (key === 'oxygenRefill') {
      if (out) next.oxygen = next.oxygenMax;
      continue;
    }
    const k = key as keyof typeof check.recipe.inputs;
    (next[k] as number) += (out as number) || 0;
  }

  return { state: next, ok: true, label: `Extraído: ${check.recipe.name}` };
}

export function canCraftWeapon<T extends ElementBag & { craftedWeapons: WeaponId[] }>(
  state: T,
  weaponId: WeaponId
): { ok: boolean; weapon: WeaponDefinition; reason?: string } {
  const weapon = getWeaponDef(weaponId);
  if (state.craftedWeapons.includes(weaponId)) {
    return { ok: false, weapon, reason: 'Armamento já fabricado.' };
  }
  const c = weapon.cost;
  if (
    state.iron < c.iron ||
    state.titanium < c.titanium ||
    state.silicon < c.silicon ||
    state.sulfur < c.sulfur ||
    state.fuel < c.fuel
  ) {
    return { ok: false, weapon, reason: 'Elementos insuficientes para fabricar.' };
  }
  return { ok: true, weapon };
}

export function craftWeapon<
  T extends ElementBag & { craftedWeapons: WeaponId[]; equippedWeapon: WeaponId },
>(
  state: T,
  weaponId: WeaponId
): { state: T; crafted: boolean; label: string } {
  const check = canCraftWeapon(state, weaponId);
  if (!check.ok) {
    return { state, crafted: false, label: check.reason || 'Não foi possível fabricar.' };
  }
  const c = check.weapon.cost;
  const next: T = {
    ...state,
    iron: state.iron - c.iron,
    titanium: state.titanium - c.titanium,
    silicon: state.silicon - c.silicon,
    sulfur: state.sulfur - c.sulfur,
    fuel: state.fuel - c.fuel,
    craftedWeapons: [...state.craftedWeapons, weaponId],
    equippedWeapon: weaponId,
  };
  return {
    state: next,
    crafted: true,
    label: `Armamento fabricado e equipado: ${check.weapon.name}`,
  };
}
