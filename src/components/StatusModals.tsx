/**
 * Game Status Modals (Pause, Victory, Game Over)
 * Supports Solo and 3-Player Cooperative Mars Colonization (12 Missions & 8 Techs)
 */

import React from 'react';
import { Play, RotateCcw, Award, AlertOctagon, Compass, LogOut, Gauge, Smartphone } from 'lucide-react';
import { ColonyState, TECH_CATALOG } from '../sim/marsColonyLogic';
import {
  QualityPreset,
  QUALITY_PRESET_LABELS,
  TouchControlsMode,
} from '../sim/devicePerformance';

interface PauseModalProps {
  isCoop: boolean;
  qualityPreset: QualityPreset;
  resolvedQualityTier: 'low' | 'medium' | 'high';
  touchControlsMode: TouchControlsMode;
  onChangeQualityPreset: (preset: QualityPreset) => void;
  onChangeTouchControlsMode: (mode: TouchControlsMode) => void;
  onResume: () => void;
  onRestart: () => void;
  onExitToLobby: () => void;
}

const QUALITY_OPTIONS: QualityPreset[] = ['auto', 'low', 'medium', 'high'];
const TOUCH_OPTIONS: Array<{ id: TouchControlsMode; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'always', label: 'Ativado' },
  { id: 'hidden', label: 'Oculto' },
];

export const PauseModal: React.FC<PauseModalProps> = ({
  isCoop,
  qualityPreset,
  resolvedQualityTier,
  touchControlsMode,
  onChangeQualityPreset,
  onChangeTouchControlsMode,
  onResume,
  onRestart,
  onExitToLobby,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu da Missão e Configurações de Desempenho"
      data-testid="pause-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 select-none font-sans overflow-y-auto"
    >
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4 text-center">
        <div className="space-y-1">
          <h2 className="text-xl font-black tracking-tight text-white">MENU DA MISSÃO</h2>
          <p className="text-xs text-slate-400">
            {isCoop
              ? 'Sessão cooperativa em andamento no servidor.'
              : 'Atividades na superfície marciana pausadas.'}
          </p>
        </div>

        {/* Graphics Performance Preset Selector */}
        <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-3 text-left space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-cyan-300 uppercase tracking-wider">
              <Gauge className="w-3.5 h-3.5" />
              Qualidade &amp; FPS
            </span>
            <span className="text-[10px] text-slate-400">
              Ativo: {QUALITY_PRESET_LABELS[resolvedQualityTier]}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {QUALITY_OPTIONS.map((opt) => {
              const active = qualityPreset === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  data-testid={`quality-preset-${opt}`}
                  onClick={() => onChangeQualityPreset(opt)}
                  className={`py-2 px-2 rounded-lg text-[11px] font-black transition-colors cursor-pointer border whitespace-nowrap ${
                    active
                      ? 'bg-cyan-600 border-cyan-300 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {QUALITY_PRESET_LABELS[opt]}
                </button>
              );
            })}
          </div>

          {/* Mobile Touch Controls Override */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              Controles Toque
            </span>
            <div className="flex items-center gap-1">
              {TOUCH_OPTIONS.map((opt) => {
                const active = touchControlsMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`touch-mode-${opt.id}`}
                    onClick={() => onChangeTouchControlsMode(opt.id)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer border transition-colors ${
                      active
                        ? 'bg-amber-600 border-amber-300 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>CONTINUAR EXPLORAÇÃO</span>
          </button>

          {!isCoop && (
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>REINICIAR COLONIZAÇÃO</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExitToLobby}
            className="w-full py-2.5 bg-slate-800 hover:bg-red-950/80 text-slate-300 hover:text-red-200 font-semibold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs border border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>VOLTAR AO LOBBY PRINCIPAL</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface VictoryModalProps {
  colonyState: ColonyState;
  onContinueSandbox: () => void;
  onExitToLobby: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  colonyState,
  onContinueSandbox,
  onExitToLobby,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 select-none font-sans">
      <div className="w-full max-w-md bg-slate-900 border-2 border-emerald-500 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5 text-center">
        <div className="space-y-2">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 mx-auto flex items-center justify-center">
            <Award className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">MUNDO VIVO CRIADO!</h2>
          <p className="text-xs text-slate-300">
            Todas as 12 missões concluídas! Marte alcançou 100% de habitabilidade com atmosfera azul, lagos líquidos e vegetação autossustentável.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-left bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">HABITABILIDADE</div>
            <div className="text-base font-black text-emerald-400">100% (12/12 Missões)</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">ENERGIA DA BASE</div>
            <div className="text-base font-black text-yellow-400">{colonyState.energy} kW</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">AMEAÇAS ABATIDAS</div>
            <div className="text-base font-black text-red-400">{colonyState.enemiesDefeated} Inimigos</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">BIOMASSA &amp; TECH</div>
            <div className="text-base font-black text-purple-300">
              {colonyState.biomass} Bio · {colonyState.unlockedTechs.length}/{TECH_CATALOG.length} Tech
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <button
            onClick={onContinueSandbox}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Compass className="w-4 h-4" />
            <span>CONTINUAR NO MODO LIVRE (CONTRATOS INFINITOS)</span>
          </button>

          <button
            onClick={onExitToLobby}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs border border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>VOLTAR AO LOBBY</span>
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
      <div className="w-full max-w-sm bg-slate-900 border-2 border-red-500 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-5 text-center">
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
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>TENTAR NOVAMENTE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
