/**
 * Colony Workshop Modal [B]:
 * 1. Refinaria Química ISRU (extração de elementos essenciais a partir de outros elementos)
 * 2. Arsenal & Armamentos (fabricação e troca de 4 armamentos marcianos)
 * 3. Redomas de Vidro — Cultivo Hidropônico de Alimentos & Nutrição
 */

import React from 'react';
import {
  X,
  FlaskConical,
  Crosshair,
  Sprout,
  Utensils,
  Check,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { ColonyState } from '../sim/marsColonyLogic';
import {
  REFINERY_RECIPES,
  WEAPON_CATALOG,
  WeaponId,
  canRunRecipe,
  canCraftWeapon,
} from '../sim/marsChemistry';
import { CROP_CATALOG, CropTypeId, getCropDef } from '../sim/marsWorld';

export type WorkshopTab = 'refinery' | 'weapons' | 'crops';

interface ColonyWorkshopModalProps {
  colonyState: ColonyState;
  activeTab: WorkshopTab;
  onChangeTab: (tab: WorkshopTab) => void;
  onRunRecipe: (recipeId: string) => void;
  onCraftWeapon: (weaponId: WeaponId) => void;
  onEquipWeapon: (weaponId: WeaponId) => void;
  onPlantCrop: (bedIndex: number, cropId: CropTypeId) => void;
  onHarvestCrop: (bedIndex: number) => void;
  onConsumeFood: () => void;
  onClose: () => void;
}

const ELEMENT_LABELS: Record<string, string> = {
  regolith: 'Regolito',
  waterIce: 'Gelo',
  water: 'Água',
  biomass: 'Biomassa',
  iron: 'Ferro (Fe)',
  titanium: 'Titânio (Ti)',
  silicon: 'Silício (Si)',
  sulfur: 'Enxofre (S)',
  fuel: 'Combustível (H₂)',
  food: 'Alimentos',
};

export const ColonyWorkshopModal: React.FC<ColonyWorkshopModalProps> = ({
  colonyState,
  activeTab,
  onChangeTab,
  onRunRecipe,
  onCraftWeapon,
  onEquipWeapon,
  onPlantCrop,
  onHarvestCrop,
  onConsumeFood,
  onClose,
}) => {
  const formatBagEntries = (
    entries: Partial<Record<string, number | boolean>>
  ): string[] => {
    const out: string[] = [];
    for (const [k, v] of Object.entries(entries)) {
      if (k === 'oxygenRefill' && v) {
        out.push('O₂ Traje 100%');
      } else if (typeof v === 'number' && v > 0) {
        out.push(`${v} ${ELEMENT_LABELS[k] || k}`);
      }
    }
    return out;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Oficina da Colônia: Refinaria Química, Arsenal e Redomas de Vidro"
      data-testid="colony-workshop-modal"
      className="fixed inset-0 z-40 bg-slate-950/82 flex items-center justify-center p-3 sm:p-5 select-none"
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-950 border border-slate-700/85 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-amber-400">
              COMPLEXO DE ENGENHARIA &amp; SUPORTE À VIDA · [B]
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              Refinaria Química, Arsenal &amp; Redomas de Vidro
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Oficina da Colônia"
            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Elements Inventory Strip */}
        <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold tabular-nums">
          <span className="text-amber-300">Regolito: {colonyState.regolith}</span>
          <span className="text-cyan-300">Gelo: {colonyState.waterIce}</span>
          <span className="text-sky-300">Água: {colonyState.water}</span>
          <span className="text-orange-300">Ferro (Fe): {colonyState.iron}</span>
          <span className="text-violet-300">Titânio (Ti): {colonyState.titanium}</span>
          <span className="text-teal-300">Silício (Si): {colonyState.silicon}</span>
          <span className="text-yellow-300">Enxofre (S): {colonyState.sulfur}</span>
          <span className="text-pink-300">Combustível (H₂): {colonyState.fuel}</span>
          <span className="text-emerald-300">Alimentos: {colonyState.food}</span>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Seções da Oficina"
          className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'refinery'}
            onClick={() => onChangeTab('refinery')}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'refinery'
                ? 'bg-slate-900 text-cyan-300 border-cyan-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            Refinaria Química ISRU
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'weapons'}
            onClick={() => onChangeTab('weapons')}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'weapons'
                ? 'bg-slate-900 text-amber-300 border-amber-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            Arsenal &amp; Armamentos ({colonyState.craftedWeapons.length}/4)
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'crops'}
            onClick={() => onChangeTab('crops')}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'crops'
                ? 'bg-slate-900 text-emerald-300 border-emerald-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <Sprout className="w-4 h-4" />
            Redomas de Vidro (Alimentos)
          </button>
        </div>

        {/* Scrollable Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: CHEMICAL EXTRACTION REFINERY */}
          {activeTab === 'refinery' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Extraia elementos essenciais a partir de minérios brutos coletados ou escavados em
                crateras marcianas ([G] no solo).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {REFINERY_RECIPES.map((recipe) => {
                  const check = canRunRecipe(colonyState, recipe.id);
                  const inputs = formatBagEntries(recipe.inputs);
                  const outputs = formatBagEntries(recipe.outputs);
                  return (
                    <div
                      key={recipe.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-black text-white">{recipe.name}</h3>
                          <span className="text-[10px] font-mono font-bold text-cyan-300">
                            {recipe.formula}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{recipe.description}</p>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                          <span className="text-amber-300">{inputs.join(' + ')}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-emerald-300">{outputs.join(' + ')}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!check.ok}
                        onClick={() => onRunRecipe(recipe.id)}
                        className={`w-full py-2 px-3 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                          check.ok
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {check.ok ? `Sintetizar: ${recipe.name}` : 'Elementos Insuficientes'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CRAFTABLE WEAPONS ARSENAL */}
          {activeTab === 'weapons' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Forje armamentos avançados com Ferro, Titânio, Silício e Enxofre. Alterne em combate
                a qualquer momento com as teclas <strong className="text-white">[1]–[4]</strong>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {WEAPON_CATALOG.map((weapon) => {
                  const isOwned = colonyState.craftedWeapons.includes(weapon.id);
                  const isEquipped = colonyState.equippedWeapon === weapon.id;
                  const craftCheck = canCraftWeapon(colonyState, weapon.id);
                  const costs = formatBagEntries(weapon.cost);

                  return (
                    <div
                      key={weapon.id}
                      className={`rounded-xl p-4 border flex flex-col justify-between gap-3 ${
                        isEquipped
                          ? 'bg-slate-900 border-amber-400/80'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-sm shrink-0"
                              style={{ backgroundColor: weapon.boltColorHex }}
                            />
                            <h3 className="text-sm font-black text-white">
                              [{weapon.slotKey}] {weapon.name}
                            </h3>
                          </div>
                          {isEquipped && (
                            <span className="text-[10px] font-black uppercase text-amber-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Equipada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{weapon.tagline}</p>

                        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] font-bold tabular-nums bg-slate-950 rounded-lg p-2 border border-slate-800">
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Dano</div>
                            <div className="text-white">
                              {weapon.damagePerBolt}
                              {weapon.boltCount > 1 ? ` ×${weapon.boltCount}` : ''}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Cadência</div>
                            <div className="text-cyan-300">{weapon.cooldownMs}ms</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Tipo</div>
                            <div className="text-amber-300">
                              {weapon.piercing
                                ? 'Perfurante'
                                : weapon.boltCount > 2
                                ? 'Dispersão'
                                : weapon.boltCount === 2
                                ? 'Rajada'
                                : 'Precisão'}
                            </div>
                          </div>
                        </div>

                        {!isOwned && costs.length > 0 && (
                          <div className="mt-2.5 text-[11px] font-bold text-slate-300">
                            Custo: <span className="text-amber-300">{costs.join(' · ')}</span>
                          </div>
                        )}
                      </div>

                      {isOwned ? (
                        <button
                          type="button"
                          disabled={isEquipped}
                          onClick={() => onEquipWeapon(weapon.id)}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                            isEquipped
                              ? 'bg-amber-950/80 border border-amber-500/40 text-amber-200 cursor-default'
                              : 'bg-slate-800 hover:bg-slate-700 text-white'
                          }`}
                        >
                          {isEquipped ? 'Arma Equipada' : `Equipar ${weapon.name}`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!craftCheck.ok}
                          onClick={() => onCraftWeapon(weapon.id)}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                            craftCheck.ok
                              ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {craftCheck.ok
                            ? `Fabricar ${weapon.name}`
                            : 'Minérios Insuficientes'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: GLASS-DOME FOOD FARMING (REDOMAS DE VIDRO) */}
          {activeTab === 'crops' && (
            <div className="space-y-4">
              {/* Nutrition & Rations Header Bar */}
              <div className="bg-slate-900 border border-emerald-500/35 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                    <Utensils className="w-4 h-4" />
                    Nutrição da Equipe: {Math.round(colonyState.hunger)}% · Estoque:{' '}
                    {colonyState.food} Rações
                  </div>
                  <div className="w-56 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-emerald-400"
                      style={{ width: `${Math.round(colonyState.hunger)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {colonyState.buildings.bioDome
                      ? 'Biodomo Principal ativo (+50% velocidade de crescimento nas redomas!).'
                      : 'Redoma Agrícola Inicial ativa. Construa o Biodomo Principal para +50% de velocidade.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={colonyState.food < 1}
                  onClick={onConsumeFood}
                  className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer transition-colors ${
                    colonyState.food >= 1
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Comer Ração [H] (+38% Nutrição, +15% O₂)
                </button>
              </div>

              {/* 4 Hydroponic Glass-Dome Beds */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {colonyState.domeCrops.map((bed) => {
                  const activeDef = bed.cropId ? getCropDef(bed.cropId) : null;
                  const pct = activeDef
                    ? Math.min(100, Math.round((bed.elapsedSec / Math.max(1, bed.durationSec)) * 100))
                    : 0;

                  return (
                    <div
                      key={bed.bedIndex}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-white">
                          Canteiro da Redoma #{bed.bedIndex + 1}
                        </h3>
                        <span className="text-[11px] font-bold tabular-nums text-emerald-300">
                          {activeDef
                            ? bed.readyToHarvest
                              ? 'Pronto para Colheita!'
                              : `${activeDef.name} · ${pct}%`
                            : 'Disponível para Plantio'}
                        </span>
                      </div>

                      {activeDef ? (
                        <div className="space-y-3">
                          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-200"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: activeDef.colorHex,
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-300">
                            <span>
                              Rendimento: +{activeDef.foodYield} Alimentos · +{activeDef.biomassYield}{' '}
                              Biomassa
                            </span>
                            {!bed.readyToHarvest && (
                              <span className="font-mono text-slate-400">
                                {Math.max(0, bed.durationSec - bed.elapsedSec).toFixed(0)}s
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={!bed.readyToHarvest}
                            onClick={() => onHarvestCrop(bed.bedIndex)}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                              bed.readyToHarvest
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {bed.readyToHarvest
                              ? `Colher ${activeDef.name} (Canteiro #${bed.bedIndex + 1})`
                              : 'Cultivando sob Luz Solar da Redoma...'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-400">
                            Escolha uma cultura para plantar neste canteiro (Água disponível:{' '}
                            <strong className="text-sky-300">{colonyState.water}</strong>):
                          </p>
                          <div className="grid grid-cols-1 gap-1.5">
                            {CROP_CATALOG.map((crop) => {
                              const canAfford = colonyState.water >= crop.waterCost;
                              return (
                                <button
                                  key={crop.id}
                                  type="button"
                                  disabled={!canAfford}
                                  onClick={() => onPlantCrop(bed.bedIndex, crop.id)}
                                  className={`px-3 py-2 rounded-lg border text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                                    canAfford
                                      ? 'bg-slate-950 border-slate-700 hover:border-emerald-400 text-white'
                                      : 'bg-slate-950/60 border-slate-800 text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  <span className="font-bold flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: crop.colorHex }}
                                    />
                                    Plantar {crop.name} (Canteiro #{bed.bedIndex + 1})
                                  </span>
                                  <span className="text-[10px] font-mono tabular-nums text-sky-300 shrink-0">
                                    {crop.waterCost} Água → +{crop.foodYield} Alim.
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
