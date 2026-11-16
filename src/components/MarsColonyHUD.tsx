/**
 * Responsive Minimalist HUD for Mars Surface Colonization
 * Features:
 * - Mission Objective Header with real-time progression counter (e.g. "2/5 Regolitos")
 * - Habitability gauge (5% to 100%)
 * - Suit Oxygen gauge with recharge indicator
 * - Resource counts (Gelo, Regolito, Energia)
 * - Safe area padding for PC, Mobile, and Smart TVs
 * - Dynamic input hint (Keyboard, Touch, or Gamepad)
 */

import React from 'react';
import { Volume2, VolumeX, Pause, Compass, Zap, Droplet, Mountain, ShieldAlert } from 'lucide-react';
import { ColonyState, ColonyObjective } from '../sim/marsColonyLogic';

interface MarsColonyHUDProps {
  colonyState: ColonyState;
  currentObjective: ColonyObjective | null;
  isMuted: boolean;
  activeInputDevice: 'keyboard' | 'touch' | 'gamepad';
  onToggleMute: () => void;
  onPause: () => void;
}

export const MarsColonyHUD: React.FC<MarsColonyHUDProps> = ({
  colonyState,
  currentObjective,
  isMuted,
  activeInputDevice,
  onToggleMute,
  onPause,
}) => {
  const isLowO2 = colonyState.oxygen < 25;
  const isNearO2 = colonyState.isNearO2Source;

  // Format dynamic objective requirement count if applicable
  const getObjectiveProgressText = () => {
    if (!currentObjective) {
      return 'Colônia Operacional · Modo Livre Ativo';
    }
    if (currentObjective.id === 'obj-2-regolith') {
      return `${colonyState.regolith}/5 Regolitos Coletados`;
    }
    if (currentObjective.id === 'obj-3-solar') {
      return colonyState.regolith >= 5 ? '5/5 Regolitos Prontos para Depósito' : `Faltam ${5 - colonyState.regolith} Regolitos`;
    }
    if (currentObjective.id === 'obj-4-biodome') {
      return `${colonyState.waterIce}/5 Gelos Coletados`;
    }
    return currentObjective.description;
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between overflow-hidden"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 14px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 14px)',
        paddingLeft: 'max(env(safe-area-inset-left), 16px)',
        paddingRight: 'max(env(safe-area-inset-right), 16px)',
      }}
    >
      {/* 1. TOP BAR: Mission Objective, Habitability & Oxygen */}
      <div className="flex flex-wrap items-start justify-between gap-3 w-full">
        {/* Left: Active Mission Objective Card */}
        <div className="bg-slate-950/85 border border-cyan-500/40 rounded-xl px-4 py-2.5 shadow-xl max-w-md pointer-events-auto backdrop-blur-none">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-cyan-400">
            <Compass className="w-3.5 h-3.5" />
            <span>COLONIZAÇÃO DE MARTE · SOL {colonyState.solDay}</span>
          </div>

          <h2 className="text-sm font-bold text-white mt-0.5 leading-snug">
            {currentObjective ? currentObjective.title : 'Todas as Missões Concluídas!'}
          </h2>

          <p className="text-[11px] text-slate-300 font-medium mt-0.5">
            {getObjectiveProgressText()}
          </p>
        </div>

        {/* Center: Habitability Progress Gauge */}
        <div className="bg-slate-950/85 border border-slate-700/60 rounded-xl px-4 py-2 shadow-xl flex items-center gap-3 pointer-events-auto backdrop-blur-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Habitabilidade:
          </span>
          <div className="w-28 sm:w-36 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${colonyState.habitability}%` }}
            />
          </div>
          <span className="text-xs font-black text-cyan-300 min-w-8 text-right">
            {Math.round(colonyState.habitability)}%
          </span>
        </div>

        {/* Right: Suit Oxygen Monitor & Audio/Pause Buttons */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Oxygen Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-lg transition-colors backdrop-blur-none ${
              isLowO2
                ? 'bg-red-950/90 border-red-500 text-red-200'
                : isNearO2
                ? 'bg-emerald-950/85 border-emerald-500/70 text-emerald-200'
                : 'bg-slate-950/85 border-slate-700 text-slate-200'
            }`}
          >
            {isLowO2 ? (
              <ShieldAlert className="w-4 h-4 text-red-400" />
            ) : (
              <Zap className={`w-4 h-4 ${isNearO2 ? 'text-emerald-400' : 'text-cyan-400'}`} />
            )}
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-semibold tracking-wider uppercase opacity-80">
                {isNearO2 ? 'Recarregando O2' : 'Oxigênio Traje'}
              </span>
              <span className="text-xs font-black">{Math.round(colonyState.oxygen)}%</span>
            </div>
          </div>

          {/* Sound Mute Button */}
          <button
            onClick={onToggleMute}
            className="w-9 h-9 rounded-xl bg-slate-950/85 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 active:scale-95 transition-all shadow-md backdrop-blur-none"
            title={isMuted ? 'Ativar Áudio' : 'Mutar Áudio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Pause Button */}
          <button
            onClick={onPause}
            className="w-9 h-9 rounded-xl bg-slate-950/85 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 active:scale-95 transition-all shadow-md backdrop-blur-none"
            title="Pausar Jogo"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. BOTTOM BAR: Collected Resources & Dynamic Input Legend */}
      <div className="flex flex-wrap items-end justify-between gap-3 w-full">
        {/* Resource Counters */}
        <div className="flex items-center gap-3 bg-slate-950/85 border border-slate-700/60 rounded-xl px-4 py-2 text-xs font-bold shadow-lg pointer-events-auto backdrop-blur-none">
          <div className="flex items-center gap-1.5 text-amber-300" title="Regolito Mineral">
            <Mountain className="w-4 h-4 text-amber-400" />
            <span>Regolito: <b>{colonyState.regolith}</b></span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="flex items-center gap-1.5 text-sky-300" title="Gelo de Água">
            <Droplet className="w-4 h-4 text-sky-400" />
            <span>Gelo: <b>{colonyState.waterIce}</b></span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="flex items-center gap-1.5 text-emerald-300" title="Energia Solar">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Energia: <b>{colonyState.energy} kW</b></span>
          </div>
        </div>

        {/* Dynamic Multiplatform Control Hint */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-400 shadow-sm backdrop-blur-none">
          {activeInputDevice === 'touch' && (
            <span>Controles de Toque: Joystick (Esq) · Pular e Ação (Dir)</span>
          )}
          {activeInputDevice === 'gamepad' && (
            <span>Gamepad Ativo: Analógico/D-Pad Mover · [A] Salto · [X] Ação</span>
          )}
          {activeInputDevice === 'keyboard' && (
            <span>WASD / Setas Mover · Espaço Salto Gravitacional (0.38g) · E / Enter Ação</span>
          )}
        </div>
      </div>
    </div>
  );
};
