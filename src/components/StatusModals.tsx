/**
 * Game Status Modals (Pause, Victory, Game Over)
 * Tailored for Mars Surface Colonization
 */

import React from 'react';
import { Play, RotateCcw, Award, AlertOctagon, Compass, CheckCircle2 } from 'lucide-react';
import { ColonyState } from '../sim/marsColonyLogic';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ onResume, onRestart }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-none select-none font-sans">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5 text-center">
        <div className="space-y-1">
          <h2 className="text-xl font-black tracking-tight text-white">COLÔNIA PAUSADA</h2>
          <p className="text-xs text-slate-400">Atividades na superfície marciana congeladas.</p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={onResume}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-cyan-950/50"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>CONTINUAR EXPLORAÇÃO [ESC / P]</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>REINICIAR POUSO</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface VictoryModalProps {
  colonyState: ColonyState;
  onContinueSandbox: () => void;
  onRestart: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  colonyState,
  onContinueSandbox,
  onRestart,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 select-none font-sans">
      <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-500 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5 text-center ring-4 ring-emerald-500/20">
        <div className="space-y-2">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Award className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">MARTE COLONIZADO!</h2>
          <p className="text-xs text-slate-300">
            A primeira colônia humana autossustentável em solo marciano foi estabelecida com sucesso!
          </p>
        </div>

        {/* Colonization Metrics */}
        <div className="grid grid-cols-2 gap-3 text-left bg-slate-950/90 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">HABITABILIDADE:</div>
            <div className="text-base font-black text-emerald-400">100% (Completa)</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">ENERGIA DA BASE:</div>
            <div className="text-base font-black text-cyan-400">{colonyState.energy} kW</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">REGOLITO EXTRAÍDO:</div>
            <div className="text-base font-black text-amber-400">{colonyState.regolith} Unidades</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">GELO DE ÁGUA:</div>
            <div className="text-base font-black text-sky-400">{colonyState.waterIce} Unidades</div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button
            onClick={onContinueSandbox}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 text-sm shadow-xl shadow-emerald-950/60"
          >
            <Compass className="w-4 h-4" />
            <span>CONTINUAR EXPANDINDO (MODO LIVRE)</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>REINICIAR COLONIZAÇÃO</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  reason: string;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ reason, onRestart }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 select-none font-sans">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-red-500 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5 text-center ring-4 ring-red-500/20">
        <div className="space-y-2">
          <div className="w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-400 text-red-400 mx-auto flex items-center justify-center">
            <AlertOctagon className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">FALHA NA MISSÃO</h2>
          <p className="text-xs text-red-300 font-medium">{reason}</p>
        </div>

        <div className="pt-2">
          <button
            onClick={onRestart}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-sm shadow-xl shadow-red-950/60"
          >
            <RotateCcw className="w-4 h-4" />
            <span>TENTAR NOVAMENTE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
