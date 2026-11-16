/**
 * Ship Customization & Modular Upgrades Interface
 * Allows players to upgrade modular ship components:
 * propulsion engines, cryo tanks, cargo hulls, life support bioreactors, and avionics.
 */

import React, { useState } from 'react';
import {
  Rocket,
  Fuel,
  Shield,
  HeartPulse,
  Zap,
  Compass,
  Check,
  Coins,
} from 'lucide-react';
import { ShipComponent, ShipResources } from '../types/game';
import { MODULAR_COMPONENTS } from '../sim/shipComponents';

interface ShipCustomizationPanelProps {
  mountedComponents: Record<ShipComponent['slot'], string>;
  resources: ShipResources;
  onEquipComponent: (component: ShipComponent) => void;
  onBuyComponent: (component: ShipComponent) => void;
}

export const ShipCustomizationPanel: React.FC<ShipCustomizationPanelProps> = ({
  mountedComponents,
  resources,
  onEquipComponent,
  onBuyComponent,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<ShipComponent['slot']>('engine');

  const slots = [
    { id: 'engine', name: 'Propulsion Engines', icon: Rocket },
    { id: 'tank', name: 'Fuel Tanks', icon: Fuel },
    { id: 'hull', name: 'Hull & Cargo Bay', icon: Shield },
    { id: 'lifeSupport', name: 'Life Support', icon: HeartPulse },
    { id: 'power', name: 'Power & Solar', icon: Zap },
    { id: 'avionics', name: 'Avionics Sensors', icon: Compass },
  ] as const;

  const componentsInSlot = MODULAR_COMPONENTS.filter((c) => c.slot === selectedSlot);

  return (
    <div className="space-y-3 font-mono text-xs">
      {/* Slot Selector Row */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
        {slots.map((slot) => {
          const Icon = slot.icon;
          const isSelected = selectedSlot === slot.id;

          return (
            <button
              key={slot.id}
              onClick={() => setSelectedSlot(slot.id)}
              className={`px-3 py-1.5 rounded flex items-center space-x-1.5 font-semibold transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{slot.name}</span>
            </button>
          );
        })}
      </div>

      {/* Component Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
        {componentsInSlot.map((comp) => {
          const isEquipped = mountedComponents[comp.slot] === comp.id;

          return (
            <div
              key={comp.id}
              className={`p-3 rounded-lg border flex flex-col justify-between space-y-2.5 transition-all ${
                isEquipped
                  ? 'bg-slate-900 border-red-500/80 shadow-md ring-1 ring-red-500/30'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between">
                  <span className="font-bold text-slate-100 text-sm leading-tight">{comp.name}</span>
                  <span className="text-[10px] text-slate-400">Mk {comp.level}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{comp.description}</p>
              </div>

              {/* Spec Stats List */}
              <div className="space-y-1 bg-slate-900/60 p-2 rounded text-[10px] text-slate-300">
                {comp.isp > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">SPECIFIC IMPULSE (Isp):</span>
                    <span className="font-bold text-cyan-400 tabular-nums">{comp.isp} s</span>
                  </div>
                )}
                {comp.thrustModifier !== 1.0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">THRUST MULTIPLIER:</span>
                    <span className="font-bold text-emerald-400 tabular-nums">{comp.thrustModifier}x</span>
                  </div>
                )}
                {comp.fuelCapacityModifier > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">MAX FUEL CAPACITY:</span>
                    <span className="font-bold text-cyan-400 tabular-nums">+{comp.fuelCapacityModifier} t</span>
                  </div>
                )}
                {comp.cargoModifier > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">CARGO BAY CAPACITY:</span>
                    <span className="font-bold text-amber-400 tabular-nums">+{comp.cargoModifier} t</span>
                  </div>
                )}
                {comp.lifeSupportEfficiency < 1.0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">O2/H2O CONSUMPTION:</span>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {Math.round(comp.lifeSupportEfficiency * 100)}% (Reduced)
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-800 pt-1">
                  <span className="text-slate-500">DRY MASS:</span>
                  <span className="font-bold text-slate-300 tabular-nums">{comp.mass} t</span>
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isEquipped ? (
                  <div className="w-full py-1.5 bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 rounded text-center font-bold flex items-center justify-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>CURRENTLY MOUNTED</span>
                  </div>
                ) : comp.unlocked ? (
                  <button
                    onClick={() => onEquipComponent(comp)}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold cursor-pointer transition-colors"
                  >
                    Equip Module
                  </button>
                ) : (
                  <button
                    onClick={() => onBuyComponent(comp)}
                    disabled={resources.credits < comp.cost}
                    className="w-full py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-bold cursor-pointer transition-colors flex items-center justify-center space-x-1"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Purchase ({comp.cost.toLocaleString()} ¢)</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
