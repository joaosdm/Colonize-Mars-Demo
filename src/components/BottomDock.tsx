/**
 * Clean & Consolidated Command Hub Drawer (Central de Bordo)
 * Greatly reduced button count, simplified unified tabs, and clean interface.
 */

import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Rocket,
  TrendingUp,
  Globe,
  Coins,
  Fuel,
  HeartPulse,
  Package,
  Check,
  Shield,
  Zap,
} from 'lucide-react';
import {
  ShipResources,
  MarketItem,
  TradeContract,
  ShipComponent,
  CrewMember,
  StarSystem,
} from '../types/game';
import { COMMODITIES } from '../sim/economy';
import { MODULAR_COMPONENTS } from '../sim/shipComponents';

interface BottomDockProps {
  currentStationBodyId: string;
  onChangeStation: (bodyId: string) => void;
  market: Record<string, MarketItem>;
  resources: ShipResources;
  contracts: TradeContract[];
  onBuyCommodity: (commodityId: string, amount: number) => void;
  onSellCommodity: (commodityId: string, amount: number) => void;
  onAcceptContract: (contractId: string) => void;
  onDeliverContract: (contractId: string) => void;
  mountedComponents: Record<ShipComponent['slot'], string>;
  onEquipComponent: (comp: ShipComponent) => void;
  onBuyComponent: (comp: ShipComponent) => void;
  crew: CrewMember[];
  currentSystemId: string;
  onJumpToSystem: (system: StarSystem) => void;
  systems: StarSystem[];
  socialInfluence: number;
  onQuickRefuel: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  currentStationBodyId,
  onChangeStation,
  market,
  resources,
  contracts,
  onBuyCommodity,
  onSellCommodity,
  onAcceptContract,
  onDeliverContract,
  mountedComponents,
  onEquipComponent,
  onBuyComponent,
  crew,
  currentSystemId,
  onJumpToSystem,
  systems,
  socialInfluence,
  onQuickRefuel,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ship' | 'market' | 'travel'>('market');

  const commander = crew[0];

  return (
    <div
      className="fixed z-20 pointer-events-auto transition-all duration-300 font-mono text-xs"
      style={{
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: isOpen ? 'min(860px, 94vw)' : 'auto',
      }}
    >
      {/* If closed, show only a single sleek, minimal launcher pill */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 rounded-full bg-slate-950/90 border border-slate-700/80 hover:border-red-500/80 text-slate-200 hover:text-white shadow-2xl flex items-center space-x-2 transition-all cursor-pointer backdrop-none"
        >
          <Rocket className="w-3.5 h-3.5 text-red-500" />
          <span className="font-bold tracking-wider uppercase text-xs">CENTRAL DE BORDO [H]</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
      ) : (
        /* If opened, show clean unified console card */
        <div className="bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Header Bar: Only 3 clean tabs + Close */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('market')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold cursor-pointer transition-colors ${
                  activeTab === 'market' ? 'bg-red-600 text-white shadow' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>MERCADO & CARGA</span>
              </button>

              <button
                onClick={() => setActiveTab('ship')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold cursor-pointer transition-colors ${
                  activeTab === 'ship' ? 'bg-red-600 text-white shadow' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>NAVE & MÓDULOS</span>
              </button>

              <button
                onClick={() => setActiveTab('travel')}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-bold cursor-pointer transition-colors ${
                  activeTab === 'travel' ? 'bg-red-600 text-white shadow' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>VIAGEM & GALÁXIA</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:text-white transition-colors flex items-center space-x-1 cursor-pointer font-bold"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>FECHAR [H]</span>
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="p-4 max-h-72 overflow-y-auto space-y-3">
            {/* 1. MERCADO & CARGA (CLEAN COMMERCE) */}
            {activeTab === 'market' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="text-slate-300 flex items-center space-x-2">
                    <span className="font-bold text-slate-100">Comércio Planetário:</span>
                    <select
                      value={currentStationBodyId}
                      onChange={(e) => onChangeStation(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white font-mono cursor-pointer"
                    >
                      <option value="earth">Terra (Estação LEO)</option>
                      <option value="mars">Marte (Base Bradbury)</option>
                      <option value="moon">Lua (Depósito Shackleton)</option>
                      <option value="ceres">Ceres (Cinturão de Asteroides)</option>
                    </select>
                  </div>

                  <div className="text-slate-400">
                    Carga: <span className="text-slate-200 font-bold">{resources.cargoUsed.toFixed(1)} / {resources.cargoCapacity} t</span>
                  </div>
                </div>

                {/* Simplified Commodity List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMMODITIES.slice(0, 4).map((comm) => {
                    const item = market[comm.id] || { buyPrice: comm.basePrice, sellPrice: Math.round(comm.basePrice * 0.9) };
                    const holding = resources.inventory[comm.id] || 0;

                    return (
                      <div
                        key={comm.id}
                        className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-200">{comm.name}</div>
                          <div className="text-[10px] text-slate-400">
                            Preço: <span className="text-amber-400 font-bold">{item.buyPrice} ¢</span> · Possui:{' '}
                            <span className="text-white font-bold">{holding}</span>
                          </div>
                        </div>

                        <div className="flex space-x-1">
                          <button
                            onClick={() => onBuyCommodity(comm.id, 1)}
                            disabled={resources.credits < item.buyPrice || resources.cargoUsed + comm.unitMass > resources.cargoCapacity}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-amber-300 rounded font-bold cursor-pointer"
                          >
                            +1 Comprar
                          </button>
                          <button
                            onClick={() => onSellCommodity(comm.id, 1)}
                            disabled={holding < 1}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-emerald-400 rounded font-bold cursor-pointer"
                          >
                            -1 Vender
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Primary Mission Contract if available */}
                {contracts[0] && (
                  <div className="p-2.5 bg-red-950/50 border border-red-800/60 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-red-300">Missão: {contracts[0].title}</div>
                      <div className="text-[10px] text-slate-400">
                        Destino: {contracts[0].destinationBodyId.toUpperCase()} · Recompensa:{' '}
                        <span className="text-amber-400 font-bold">+{contracts[0].rewardCredits.toLocaleString()} ¢</span>
                      </div>
                    </div>
                    {!contracts[0].isAccepted ? (
                      <button
                        onClick={() => onAcceptContract(contracts[0].id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-bold cursor-pointer"
                      >
                        Aceitar
                      </button>
                    ) : (
                      <button
                        onClick={() => onDeliverContract(contracts[0].id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold cursor-pointer"
                      >
                        Entregar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. NAVE & MÓDULOS (CLEAN SHIP UPGRADES & REFUEL) */}
            {activeTab === 'ship' && (
              <div className="space-y-3">
                {/* Instant Refuel & Maintenance Action */}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-200">Reabastecimento Rápido & Suporte de Vida</div>
                    <div className="text-[10px] text-slate-400">
                      Restaura Tanques de Metano (100%) e Purificadores de O2/H2O.
                    </div>
                  </div>
                  <button
                    onClick={onQuickRefuel}
                    disabled={resources.credits < 1500}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded cursor-pointer"
                  >
                    Reabastecer (1,500 ¢)
                  </button>
                </div>

                {/* Modular Component Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {MODULAR_COMPONENTS.filter((c) => c.slot === 'engine').slice(0, 3).map((comp) => {
                    const isMounted = mountedComponents.engine === comp.id;

                    return (
                      <div
                        key={comp.id}
                        className={`p-2.5 rounded-lg border flex flex-col justify-between space-y-2 ${
                          isMounted ? 'bg-slate-900 border-red-500/80 ring-1 ring-red-500/30' : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-200">{comp.name}</div>
                          <div className="text-[10px] text-slate-400">
                            Isp: {comp.isp}s · Empuxo: {comp.thrustModifier}x
                          </div>
                        </div>

                        {isMounted ? (
                          <div className="py-1 bg-emerald-950 border border-emerald-800 text-emerald-400 text-center font-bold rounded text-[10px]">
                            EQUIPADO
                          </div>
                        ) : comp.unlocked ? (
                          <button
                            onClick={() => onEquipComponent(comp)}
                            className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded cursor-pointer text-[10px]"
                          >
                            Equipar
                          </button>
                        ) : (
                          <button
                            onClick={() => onBuyComponent(comp)}
                            disabled={resources.credits < comp.cost}
                            className="w-full py-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded cursor-pointer text-[10px]"
                          >
                            Comprar ({comp.cost.toLocaleString()} ¢)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. VIAGEM & GALÁXIA (STARMAP & WARP) */}
            {activeTab === 'travel' && (
              <div className="space-y-3">
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded flex items-center justify-between text-slate-300">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-bold">Salto de Dobra Interespacial:</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Consumo: 150 t combustível</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {systems.slice(0, 4).map((sys) => {
                    const isCurrent = sys.id === currentSystemId;

                    return (
                      <div
                        key={sys.id}
                        className={`p-2.5 rounded-lg border flex items-center justify-between ${
                          isCurrent ? 'bg-slate-900 border-cyan-500' : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-100 flex items-center space-x-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sys.starColor }} />
                            <span>{sys.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{sys.description.slice(0, 45)}...</div>
                        </div>

                        {isCurrent ? (
                          <span className="text-cyan-400 font-bold text-[10px]">AQUI</span>
                        ) : (
                          <button
                            onClick={() => onJumpToSystem(sys)}
                            disabled={resources.fuel < 150}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded font-bold cursor-pointer text-[10px]"
                          >
                            Saltar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* AI Crew note */}
                {commander && (
                  <div className="text-[11px] text-slate-400 italic bg-slate-900/50 p-2 rounded border border-slate-800/80">
                    "{commander.name} ({commander.role}): {commander.statusQuote}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
