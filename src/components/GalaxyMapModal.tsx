/**
 * Procedural Galaxy Starmap & Hyperspace Jump Engine
 * Allows players to navigate beyond the Sol system to procedural exoplanet systems.
 */

import React from 'react';
import { Compass, Sparkles, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { StarSystem } from '../types/game';
import { PROCEDURAL_STAR_SYSTEMS } from '../sim/proceduralSolarSystem';

interface GalaxyMapModalProps {
  currentSystemId: string;
  onJumpToSystem: (system: StarSystem) => void;
  fuelAvailable: number;
}

export const GalaxyMapModal: React.FC<GalaxyMapModalProps> = ({
  currentSystemId,
  onJumpToSystem,
  fuelAvailable,
}) => {
  const jumpFuelCost = 150; // tons of fuel required for warp drive

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded flex items-center justify-between">
        <span className="flex items-center space-x-2 text-slate-200 font-bold">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>PROCEDURAL GALAXY ENGINE · LOCAL CLUSTER SECTOR</span>
        </span>
        <span className="text-slate-400">
          Warp Jump Cost: <span className="text-cyan-400 font-bold">{jumpFuelCost} t</span> Fuel
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
        {PROCEDURAL_STAR_SYSTEMS.map((system) => {
          const isCurrent = system.id === currentSystemId;
          const canJump = fuelAvailable >= jumpFuelCost;

          return (
            <div
              key={system.id}
              className={`p-3 rounded-lg border space-y-2.5 transition-all ${
                isCurrent
                  ? 'bg-slate-900 border-cyan-500/80 ring-1 ring-cyan-500/30'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-100 flex items-center space-x-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: system.starColor }}
                    />
                    <span>{system.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {system.starType} · {system.lightYearsFromSol} LY from Sol
                  </div>
                </div>

                <span
                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border ${
                    system.dangerLevel === 'Safe'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : system.dangerLevel === 'Moderate'
                      ? 'bg-amber-950 text-amber-400 border-amber-800'
                      : 'bg-red-950 text-red-400 border-red-800'
                  }`}
                >
                  {system.dangerLevel}
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">{system.description}</p>

              {/* Celestial Bodies in System */}
              <div className="bg-slate-900/60 p-2 rounded text-[10px] space-y-1">
                <div className="text-slate-400 font-bold uppercase">MAJOR CELESTIAL BODIES:</div>
                <div className="flex flex-wrap gap-1">
                  {system.bodies.map((b) => (
                    <span
                      key={b.id}
                      className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300"
                    >
                      {b.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div>
                {isCurrent ? (
                  <div className="py-1.5 bg-cyan-950 border border-cyan-800 text-cyan-400 text-center font-bold rounded">
                    CURRENT SYSTEM ANCHOR
                  </div>
                ) : (
                  <button
                    onClick={() => onJumpToSystem(system)}
                    disabled={!canJump}
                    className="w-full py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded cursor-pointer transition-colors flex items-center justify-center space-x-1"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Engage Hyperspace Jump</span>
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
