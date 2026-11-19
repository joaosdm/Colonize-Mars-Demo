/**
 * Habitat Mission Control Terminal Modal ([C])
 * Displays 3 randomized daily objectives for the active Martian Sol,
 * real-time progress counters, and automatic completion bonus rewards.
 */

import React from 'react';
import { X, Terminal, CheckCircle2, Lock, RefreshCw, Award } from 'lucide-react';
import { ColonyState } from '../sim/marsColonyLogic';
import { soundManager } from '../audio/soundManager';

interface MissionControlModalProps {
  colonyState: ColonyState;
  onRerollObjectives: () => void;
  onClose: () => void;
}

export const MissionControlModal: React.FC<MissionControlModalProps> = ({
  colonyState,
  onRerollObjectives,
  onClose,
}) => {
  const hasHabitat = colonyState.buildings.habitat;
  const mc = colonyState.missionControl;
  const completedCount = mc.objectives.filter((o) => o.completed).length;
  const allCompleted = mc.objectives.length > 0 && completedCount === mc.objectives.length;
  const canReroll = hasHabitat && (allCompleted || mc.rerollsUsedForSol < 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 select-none font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-control-title"
      data-testid="mission-control-modal"
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-cyan-500/50 rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="mission-control-title"
                className="text-lg sm:text-xl font-black tracking-tight text-white"
              >
                Mission Control Terminal
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5 tabular-nums">
                <span>Habitat Pressurizado (-11, 12)</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-cyan-300">Sol {mc.currentSol}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">
                  Diárias: {completedCount}/{mc.objectives.length}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">Concluídas no total: {mc.totalCompletedCount}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-colors"
            aria-label="Fechar Mission Control Terminal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Habitat Activation Status */}
        {!hasHabitat ? (
          <div className="bg-slate-950 border border-amber-500/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 text-amber-300 font-semibold">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                Terminal em espera: construa o Habitat Pressurizado (-11, 12) para ativar os
                objetivos diários e receber recompensas bônus.
              </span>
            </div>
            <span className="font-mono text-xs text-slate-400 whitespace-nowrap">Offline</span>
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-slate-400 font-semibold">Estoque Atual:</span>
              <span className="font-mono text-amber-300">Regolito: {colonyState.regolith}</span>
              <span className="font-mono text-cyan-300">Gelo: {colonyState.waterIce}</span>
              <span className="font-mono text-sky-300">Água: {colonyState.water}</span>
              <span className="font-mono text-emerald-300">Biomassa: {colonyState.biomass}</span>
            </div>
            <span className="font-mono text-emerald-300 font-semibold">Terminal Online</span>
          </div>
        )}

        {/* 3 Daily Objectives Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {mc.objectives.map((obj, index) => {
            const pct = Math.min(100, Math.round((obj.progress / obj.target) * 100));
            return (
              <div
                key={obj.id}
                data-testid="daily-objective-card"
                className={`rounded-xl border p-4 flex flex-col justify-between gap-4 ${
                  !hasHabitat
                    ? 'bg-slate-950/70 border-slate-800 opacity-75'
                    : obj.completed
                    ? 'bg-emerald-950/35 border-emerald-500/60'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                    <span>Objetivo 0{index + 1}</span>
                    {obj.completed ? (
                      <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Concluído
                      </span>
                    ) : (
                      <span className="text-cyan-300 font-semibold">
                        {hasHabitat ? 'Em Andamento' : 'Aguardando Habitat'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {obj.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{obj.description}</p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800/90">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-slate-400">Progresso</span>
                      <span className="font-bold text-white">
                        {obj.progress} / {obj.target} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          obj.completed ? 'bg-emerald-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-xs pt-1">
                    <Award
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        obj.completed ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    <div>
                      <div className="text-[11px] text-slate-400">
                        {obj.rewardClaimed ? 'Bônus Entregue' : 'Recompensa Bônus'}
                      </div>
                      <div
                        className={`font-mono font-semibold tabular-nums ${
                          obj.completed ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {obj.rewardText}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            Objetivos são renovados automaticamente a cada novo Sol marciano ou após concluir os 3.
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={!canReroll}
              onClick={() => {
                soundManager.playClick();
                onRerollObjectives();
              }}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>
                {allCompleted
                  ? 'Gerar 3 Novos Objetivos'
                  : mc.rerollsUsedForSol < 1
                  ? 'Gerar Novos Objetivos'
                  : 'Rotação Usada neste Sol'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
