/**
 * Colony Research & Technology Tree Modal ([T])
 * Displays all 8 Martian technologies across propulsion, automation, defense, hydro & terraforming.
 */

import React from 'react';
import { X, Cpu, CheckCircle2, Lock, Sparkles, FlaskConical } from 'lucide-react';
import { ColonyState, TECH_CATALOG, TechId, canResearchTech } from '../sim/marsColonyLogic';
import { soundManager } from '../audio/soundManager';

interface TechTreeModalProps {
  colonyState: ColonyState;
  researchSpeedPct?: number;
  onResearchTech: (techId: TechId) => void;
  onClose: () => void;
}

export const TechTreeModal: React.FC<TechTreeModalProps> = ({
  colonyState,
  researchSpeedPct = 100,
  onResearchTech,
  onClose,
}) => {
  const hasLab = colonyState.buildings.researchLab;
  const activeJob = colonyState.activeTechResearch;
  const activePct = activeJob
    ? Math.min(100, Math.round((activeJob.elapsedSec / activeJob.durationSec) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 select-none font-sans">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-2 border-purple-500/60 rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-400/50 flex items-center justify-center text-purple-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white">
                ÁRVORE TECNOLÓGICA DA COLÔNIA ({colonyState.unlockedTechs.length}/{TECH_CATALOG.length})
              </h2>
              <p className="text-xs text-slate-400">
                {hasLab
                  ? `Laboratório Operacional · Velocidade de Pesquisa: ${researchSpeedPct}%`
                  : 'Construa o Laboratório de Pesquisa primeiro para desbloquear pesquisas'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Fechar Tecnologias"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Available Resources Bar + Active Research Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold tabular-nums">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-slate-400 uppercase tracking-wider text-[11px]">Estoque:</span>
            <span className="text-amber-300">Regolito: {colonyState.regolith}</span>
            <span className="text-sky-300">Água: {colonyState.water}</span>
            <span className="text-emerald-300">Biomassa: {colonyState.biomass}</span>
          </div>
          {activeJob && (
            <div className="flex items-center gap-2 text-purple-300">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>
                Pesquisando {activeJob.name}: {activePct}%
              </span>
            </div>
          )}
        </div>

        {/* 8-Tech Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TECH_CATALOG.map((tech) => {
            const isUnlocked = colonyState.unlockedTechs.includes(tech.id);
            const isResearchingThis = activeJob?.techId === tech.id;
            const canResearch = canResearchTech(tech.id, colonyState);
            const missingPrereq =
              Boolean(tech.prerequisite) && !colonyState.unlockedTechs.includes(tech.prerequisite!);
            const prereqName = tech.prerequisite
              ? TECH_CATALOG.find((t) => t.id === tech.prerequisite)?.name || tech.prerequisite
              : null;

            return (
              <div
                key={tech.id}
                className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
                  isUnlocked
                    ? 'bg-emerald-950/40 border-emerald-500/60'
                    : isResearchingThis
                    ? 'bg-purple-950/40 border-purple-400'
                    : canResearch
                    ? 'bg-slate-950 border-purple-500/60'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs sm:text-sm font-black text-white leading-tight">
                      {tech.name}
                    </h3>
                    {isUnlocked ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : !hasLab || missingPrereq ? (
                      <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    )}
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">{tech.description}</p>
                  <p className="text-[10px] text-slate-400 tabular-nums">
                    Tempo base: {tech.durationSec}s
                  </p>

                  {missingPrereq && prereqName && (
                    <p className="text-[10px] text-amber-400 font-semibold">
                      Requer: {prereqName}
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold tabular-nums">
                    {tech.cost.regolith > 0 && (
                      <span
                        className={
                          colonyState.regolith >= tech.cost.regolith ? 'text-amber-300' : 'text-red-400'
                        }
                      >
                        {tech.cost.regolith} Reg
                      </span>
                    )}
                    {tech.cost.water > 0 && (
                      <span
                        className={colonyState.water >= tech.cost.water ? 'text-sky-300' : 'text-red-400'}
                      >
                        {tech.cost.water} Água
                      </span>
                    )}
                    {tech.cost.biomass > 0 && (
                      <span
                        className={
                          colonyState.biomass >= tech.cost.biomass ? 'text-emerald-300' : 'text-red-400'
                        }
                      >
                        {tech.cost.biomass} Bio
                      </span>
                    )}
                  </div>

                  {isResearchingThis ? (
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full"
                          style={{ width: `${activePct}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-bold text-purple-300 text-center tabular-nums">
                        Pesquisando ({activePct}%)
                      </div>
                    </div>
                  ) : !isUnlocked ? (
                    <button
                      type="button"
                      disabled={!canResearch}
                      onClick={() => {
                        soundManager.playClick();
                        onResearchTech(tech.id);
                      }}
                      className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      {!hasLab
                        ? 'Requer Lab'
                        : missingPrereq
                        ? 'Bloqueada'
                        : activeJob
                        ? 'Lab Ocupado'
                        : canResearch
                        ? 'Pesquisar'
                        : 'Faltam Recursos'}
                    </button>
                  ) : (
                    <div className="text-[11px] font-bold text-emerald-400 text-center py-1">
                      Ativa na Colônia
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
