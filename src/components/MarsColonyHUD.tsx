/**
 * Responsive HUD for Mars Surface Colonization & 3-Player Co-op
 * Features:
 * - 12-stage Era & Objective progression tracker
 * - Active Timed Construction Queue card (complexity, %, ETA)
 * - Active Orbital Contract tracker
 * - Threats toggle (Ameaças Ativas / Pacífico), Neutralized counter & Damaged Module alerts
 * - Planetary Habitability gauge, Suit O2, EVA Jetpack Fuel & Tech Tree [T]
 */

import React from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Compass,
  Zap,
  Droplet,
  Droplets,
  Mountain,
  Sprout,
  Cpu,
  Users,
  ShieldAlert,
  Flame,
  Hammer,
  Crosshair,
  Shield,
  Wrench,
  Radio,
  FlaskConical,
  Wind,
} from 'lucide-react';
import { BuildingKey, ColonyState, ColonyObjective } from '../sim/marsColonyLogic';
import { getUrgentMaintenanceModules } from '../sim/marsWeather';
import { RemotePlayerState } from '../net/coopProtocol';
import {
  AstronautRoleId,
  computeActivePlayerStats,
  getAstronautRole,
} from '../sim/astronautRoles';

interface MarsColonyHUDProps {
  colonyState: ColonyState;
  currentObjective: ColonyObjective | null;
  playerRoleId: AstronautRoleId;
  jetpackFuel: number;
  activeEnemiesCount: number;
  isMuted: boolean;
  activeInputDevice: 'keyboard' | 'touch' | 'gamepad';
  coopRoomCode: string | null;
  coopPlayers: RemotePlayerState[];
  coopEventBanner: string | null;
  onToggleMute: () => void;
  onToggleThreats: () => void;
  onPause: () => void;
  onOpenTechTree: () => void;
}

export const MarsColonyHUD: React.FC<MarsColonyHUDProps> = ({
  colonyState,
  currentObjective,
  playerRoleId,
  jetpackFuel,
  activeEnemiesCount,
  isMuted,
  activeInputDevice,
  coopRoomCode,
  coopPlayers,
  coopEventBanner,
  onToggleMute,
  onToggleThreats,
  onPause,
  onOpenTechTree,
}) => {
  const isLowO2 = colonyState.oxygen < 25;
  const isNearO2 = colonyState.isNearO2Source;

  const squadRoles: AstronautRoleId[] =
    coopPlayers.length > 0 ? coopPlayers.map((p) => p.roleId) : [playerRoleId];
  const playerStats = computeActivePlayerStats(
    playerRoleId,
    colonyState.unlockedTechs,
    squadRoles
  );

  const damagedCount = (Object.keys(colonyState.buildings) as BuildingKey[]).filter(
    (k) => colonyState.buildings[k] && colonyState.buildingHealth[k] < 100
  ).length;
  const urgentMaintenance = getUrgentMaintenanceModules(
    colonyState.buildings,
    colonyState.buildingHealth
  );
  const isDustStorm = Boolean(colonyState.dustStorm?.isActive);

  const getPlanetPhaseLabel = (hab: number) => {
    if (hab >= 100) return 'Mundo Habitável';
    if (hab >= 80) return 'Colônia Expandida';
    if (hab >= 60) return 'Biosfera Ativa';
    if (hab >= 32) return 'Base Automatizada';
    if (hab >= 16) return 'Bacia Hídrica';
    return 'Deserto Árido';
  };

  const getObjectiveProgressText = () => {
    if (!currentObjective) {
      return 'Marte Terraformado · Contratos Orbitais Infinitos Ativos';
    }
    switch (currentObjective.id) {
      case 'obj-1-moxie':
        return 'Vá até o slot azul (-7, 4) e inicie a obra do MOXIE (4s)';
      case 'obj-2-solar':
        return colonyState.regolith >= 4
          ? '4/4 Regolitos prontos · Inicie a Matriz Solar (6s)'
          : `Regolito: ${colonyState.regolith}/4`;
      case 'obj-3-water':
        return `Gelo: ${colonyState.waterIce}/5 · Regolito: ${colonyState.regolith}/2`;
      case 'obj-4-miner':
        return `Sonda Mineradora (12s): ${colonyState.regolith}/4 Reg · ${colonyState.water}/2 Água`;
      case 'obj-5-lab':
        if (!colonyState.buildings.researchLab) {
          return `Lab (14s): ${colonyState.regolith}/5 Reg · ${colonyState.water}/3 Água`;
        }
        return 'Lab pronto · Aperte [T] e pesquise 1 tecnologia';
      case 'obj-6-turret':
        return `Torre Laser (10s): ${colonyState.regolith}/4 Reg · ${colonyState.water}/2 Água`;
      case 'obj-7-biodome':
        if (!colonyState.unlockedTechs.includes('tech-hydro')) {
          return 'Pesquise "Sementes Bioengenheiradas" em [T]';
        }
        return `Biodomo (18s): ${colonyState.regolith}/5 Reg · ${colonyState.water}/4 Água`;
      case 'obj-8-plant':
        return `Canteiros Plantados: ${colonyState.cropsPlantedCount}/3 (2 Água cada, 5s)`;
      case 'obj-9-habitat':
        return `Habitat (16s): ${colonyState.regolith}/6 Reg · ${colonyState.water}/4 Água · ${colonyState.biomass}/2 Bio`;
      case 'obj-10-comms':
        return `Antena Orbital (18s): ${colonyState.regolith}/5 Reg · ${colonyState.water}/4 Água`;
      case 'obj-11-geothermal':
        if (!colonyState.unlockedTechs.includes('tech-geothermal')) {
          return 'Pesquise "Drones" + "Perfuração Geotérmica" em [T]';
        }
        return `Usina Geotérmica (22s): ${colonyState.regolith}/6 Reg · ${colonyState.water}/5 Água`;
      case 'obj-12-terraform':
        if (!colonyState.unlockedTechs.includes('tech-terraform')) {
          return 'Pesquise "Núcleo Atmosférico" em [T]';
        }
        return `Terraformador (26s): ${colonyState.regolith}/8 Reg · ${colonyState.water}/6 Água · ${colonyState.biomass}/5 Bio`;
      default:
        return currentObjective.description;
    }
  };

  const displayTitle =
    currentObjective?.id === 'obj-8-plant'
      ? `8. Plantar e Irrigar Canteiros (${colonyState.cropsPlantedCount}/3)`
      : currentObjective?.title || 'Mundo Vivo Estabelecido!';

  const activeResearch = colonyState.activeTechResearch;
  const activeResearchPct = activeResearch
    ? Math.min(100, Math.round((activeResearch.elapsedSec / activeResearch.durationSec) * 100))
    : 0;
  const activeResearchRem = activeResearch
    ? Math.max(0, (activeResearch.durationSec - activeResearch.elapsedSec) / (playerStats.researchSpeedPct / 100))
    : 0;

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
      {/* 1. TOP BAR */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 w-full">
        {/* Top-Left: Objective + Active Constructions + Active Tech Research + Dust Storm + Contract */}
        <div className="space-y-2 w-full max-w-[260px] md:max-w-[300px] lg:max-w-md min-w-0 pointer-events-auto">
          <div className="bg-slate-950/90 border border-cyan-500/45 rounded-xl px-4 py-2.5 shadow-xl">
            <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-wider text-cyan-400">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                {currentObjective ? currentObjective.eraLabel : 'ERA FINAL · MUNDO VIVO'}
              </span>
              <span className="text-slate-400 tabular-nums">
                SOL {colonyState.solDay} · {Math.min(12, colonyState.stage + 1)}/12
              </span>
            </div>

            <h2 className="text-sm font-bold text-white mt-0.5 leading-snug">{displayTitle}</h2>
            <p className="text-[11px] text-slate-300 font-medium mt-0.5">
              {getObjectiveProgressText()}
            </p>
          </div>

          {/* Active Timed Constructions Queue */}
          {colonyState.activeConstructions.map((job) => {
            const pct = Math.min(100, Math.round((job.elapsedSec / job.durationSec) * 100));
            const rem = Math.max(0, job.durationSec - job.elapsedSec);
            return (
              <div
                key={job.id}
                className="bg-slate-950/92 border border-amber-500/50 rounded-xl px-3.5 py-2 shadow-lg space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                  <span className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Hammer className="w-3.5 h-3.5" />
                    {job.name}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {job.complexity} · {pct}% ({rem.toFixed(1)}s)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* Active Timed Tech Research */}
          {activeResearch && (
            <div className="bg-slate-950/92 border border-purple-500/55 rounded-xl px-3.5 py-2 shadow-lg space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
                <span className="flex items-center gap-1.5 font-bold text-purple-300">
                  <FlaskConical className="w-3.5 h-3.5" />
                  Pesquisa: {activeResearch.name}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-purple-200">
                  {activeResearchPct}% ({activeResearchRem.toFixed(1)}s)
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full"
                  style={{ width: `${activeResearchPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Active Dynamic Contract */}
          {colonyState.activeContract && (
            <div className="bg-slate-950/90 border border-sky-500/45 rounded-xl px-3.5 py-2 shadow-lg text-xs">
              <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase text-sky-400">
                <span className="flex items-center gap-1">
                  <Radio className="w-3 h-3" /> Contrato Orbital
                </span>
                <span className="text-emerald-300">{colonyState.activeContract.rewardText}</span>
              </div>
              <div className="font-bold text-white mt-0.5 flex items-center justify-between">
                <span>{colonyState.activeContract.title}</span>
                <span className="text-sky-300 font-mono tabular-nums">
                  {colonyState.activeContract.progress}/{colonyState.activeContract.target}
                </span>
              </div>
            </div>
          )}

          {/* Dust Storm & Urgent Maintenance Alert */}
          {(isDustStorm || urgentMaintenance.length > 0) && (
            <div
              data-testid="hud-dust-storm-alert"
              className={`rounded-xl px-3.5 py-2.5 shadow-xl border space-y-2 ${
                isDustStorm
                  ? 'bg-amber-950/95 border-amber-400/80 text-amber-100'
                  : 'bg-orange-950/95 border-orange-500/75 text-orange-100'
              }`}
            >
              {isDustStorm ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Wind className="w-4 h-4 text-amber-400" />
                      Tempestade de Poeira
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-900/90 border border-amber-500/50 text-[10px] tabular-nums">
                      {Math.ceil(colonyState.dustStorm.remainingSec)}s
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-amber-200">
                    <span>Matrizes Solares: -50% eficiência</span>
                    <span className="text-amber-500">·</span>
                    <span>Desgaste estrutural ativo</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-orange-300">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-orange-400" />
                    Manutenção Urgente Necessária
                  </span>
                  <span className="text-[10px] text-orange-200">Aproxime-se + [E]</span>
                </div>
              )}

              {urgentMaintenance.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-amber-500/30">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                    Estruturas em Alerta ({urgentMaintenance.length}) · Repare com [E]
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {urgentMaintenance.slice(0, 4).map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-2 text-[11px] tabular-nums"
                      >
                        <span className="truncate font-semibold text-white">{item.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-12 h-1.5 bg-slate-900/90 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'
                              }`}
                              style={{ width: `${item.health}%` }}
                            />
                          </div>
                          <span
                            className={`font-black text-[10px] w-8 text-right ${
                              item.severity === 'critical' ? 'text-red-300' : 'text-amber-300'
                            }`}
                          >
                            {item.health}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Minor Damage Reminder (75%–99% HP when no storm/urgent alert shown) */}
          {!isDustStorm && urgentMaintenance.length === 0 && damagedCount > 0 && (
            <div className="bg-orange-950/95 border border-orange-500/70 text-orange-200 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg">
              <Wrench className="w-3.5 h-3.5 text-orange-400" />
              <span>{damagedCount} módulo(s) danificado(s)! Aproxime-se e aperte [E] para reparar.</span>
            </div>
          )}

          {coopEventBanner && (
            <div className="bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
              {coopEventBanner}
            </div>
          )}
        </div>

        {/* Top-Center: Habitability + Threats Status + Co-op Room Strip */}
        <div className="hidden sm:flex flex-col items-center gap-1.5 shrink-0 pointer-events-auto">
          <div className="bg-slate-950/90 border border-slate-700/70 rounded-xl px-3 lg:px-4 py-2 shadow-xl flex items-center gap-2.5 lg:gap-3">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Habitabilidade · {getPlanetPhaseLabel(colonyState.habitability)}
              </span>
              <div className="w-24 md:w-28 lg:w-44 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 mt-1">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 via-emerald-400 to-sky-400 rounded-full transition-all duration-300"
                  style={{ width: `${colonyState.habitability}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-black text-cyan-300 min-w-9 text-right tabular-nums">
              {Math.round(colonyState.habitability)}%
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Threats Toggle & Enemy Counter */}
            <button
              type="button"
              onClick={onToggleThreats}
              className={`px-3 py-1 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1.5 transition-colors shadow-md tabular-nums ${
                colonyState.threatsEnabled
                  ? activeEnemiesCount > 0
                    ? 'bg-red-950/95 border-red-500/80 text-red-200'
                    : 'bg-slate-950/90 border-amber-500/50 text-amber-200 hover:bg-slate-900'
                  : 'bg-slate-950/90 border-emerald-500/40 text-emerald-300 hover:bg-slate-900'
              }`}
              title="Alternar Modo com Ameaças vs Modo Pacífico"
            >
              {colonyState.threatsEnabled ? (
                <Crosshair className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>
                {colonyState.threatsEnabled
                  ? activeEnemiesCount > 0
                    ? `Invasão: ${activeEnemiesCount} Inimigo(s)`
                    : `Ameaças Ativas · Abates: ${colonyState.enemiesDefeated}`
                  : 'Modo Pacífico'}
              </span>
            </button>

            {coopRoomCode && (
              <div className="bg-slate-950/90 border border-cyan-500/40 rounded-lg px-3 py-1 flex items-center gap-2 text-[11px] shadow-md">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-mono font-black text-cyan-300">SALA {coopRoomCode}</span>
                <div className="flex items-center gap-1">
                  {coopPlayers.map((p) => {
                    const roleShort = getAstronautRole(p.roleId).shortLabel;
                    return (
                      <span
                        key={p.id}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white border"
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          borderColor: p.suitColorHex,
                        }}
                      >
                        {p.name} · {roleShort}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top-Right: O2, Jetpack, Tech Button, Mute, Pause + Active Role Stats Card */}
        <div className="flex flex-col items-end gap-2 shrink-0 pointer-events-auto">
          <div className="flex items-center gap-1.5 lg:gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-lg tabular-nums ${
                isLowO2
                  ? 'bg-red-950/95 border-red-500 text-red-200'
                  : isNearO2
                  ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-200'
                  : 'bg-slate-950/90 border-slate-700 text-slate-200'
              }`}
            >
              {isLowO2 ? (
                <ShieldAlert className="w-4 h-4 text-red-400" />
              ) : (
                <Zap className={`w-4 h-4 ${isNearO2 ? 'text-emerald-400' : 'text-cyan-400'}`} />
              )}
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-semibold uppercase opacity-80">
                  {isNearO2 ? 'O2 Seguro' : 'O2 Traje'}
                </span>
                <span className="text-xs font-black">{Math.round(colonyState.oxygen)}%</span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-200 shadow-lg tabular-nums">
              <Flame className="w-4 h-4 text-orange-400" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-semibold uppercase opacity-80">Jetpack</span>
                <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-orange-400 rounded-full"
                    style={{ width: `${Math.round(jetpackFuel)}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenTechTree}
              className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors shadow-md whitespace-nowrap ${
                colonyState.buildings.researchLab
                  ? 'bg-purple-950/90 border-purple-400/70 text-purple-200 hover:bg-purple-900'
                  : 'bg-slate-950/90 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Árvore Tecnológica [T]"
            >
              <Cpu className="w-4 h-4" />
              <span className="hidden md:inline">Tech</span>
              <span className="text-[10px] font-mono opacity-80">[T]</span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="w-9 h-9 rounded-xl bg-slate-950/90 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer shadow-md"
              title={isMuted ? 'Ativar Áudio' : 'Mutar Áudio'}
              aria-label={isMuted ? 'Ativar Áudio' : 'Mutar Áudio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onPause}
              className="w-9 h-9 rounded-xl bg-slate-950/90 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer shadow-md"
              title="Pausar Jogo"
              aria-label="Pausar Jogo"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Active Player Role & Live Stats Strip */}
          <div
            data-testid="hud-player-stats"
            className="bg-slate-950/90 border rounded-xl px-3 py-2 shadow-lg text-[11px] max-w-xs sm:max-w-sm"
            style={{ borderColor: `${playerStats.accentHex}70` }}
          >
            <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-800">
              <span className="font-black text-white flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: playerStats.accentHex }}
                />
                <span>{playerStats.roleName}</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                STAT ATIVAS · {playerStats.shortLabel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-x-3 gap-y-1 pt-1.5 text-[10px] tabular-nums">
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-400">Obra</span>
                <span
                  className={`font-bold ${
                    playerStats.buildSpeedPct > 100 ? 'text-orange-300' : 'text-slate-200'
                  }`}
                >
                  {playerStats.buildSpeedPct}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-400">Reparo</span>
                <span
                  className={`font-bold ${
                    playerStats.repairEfficiencyPct > 100 ? 'text-amber-300' : 'text-slate-200'
                  }`}
                >
                  {playerStats.repairEfficiencyPct}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-400">Pesq.</span>
                <span
                  className={`font-bold ${
                    playerStats.researchSpeedPct > 100 ? 'text-purple-300' : 'text-slate-200'
                  }`}
                >
                  {playerStats.researchSpeedPct}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-400">Veloc.</span>
                <span
                  className={`font-bold ${
                    playerStats.moveSpeedPct > 100 ? 'text-emerald-300' : 'text-slate-200'
                  }`}
                >
                  {playerStats.moveSpeedMs}m/s
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-400">Coleta</span>
                <span
                  className={`font-bold ${
                    playerStats.pickupRadiusM > 4.2 ? 'text-cyan-300' : 'text-slate-200'
                  }`}
                >
                  {playerStats.pickupRadiusM}m
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-400">Plasma</span>
                <span
                  className={`font-bold ${
                    playerStats.plasmaDamage > 26 ? 'text-red-300' : 'text-slate-200'
                  }`}
                >
                  {playerStats.plasmaDamage} dmg
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM BAR: Resources & Control Hints */}
      <div className="flex flex-wrap items-end justify-between gap-3 w-full">
        <div className="flex flex-wrap items-center gap-3 bg-slate-950/90 border border-slate-700/70 rounded-xl px-4 py-2 text-xs font-bold shadow-lg pointer-events-auto tabular-nums">
          <div className="flex items-center gap-1.5 text-amber-300" title="Regolito Mineral">
            <Mountain className="w-4 h-4 text-amber-400" />
            <span>
              Regolito: <b>{colonyState.regolith}</b>
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-cyan-300" title="Cristais de Gelo">
            <Droplet className="w-4 h-4 text-cyan-400" />
            <span>
              Gelo: <b>{colonyState.waterIce}</b>
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-sky-300" title="Água Líquida Purificada">
            <Droplets className="w-4 h-4 text-sky-400" />
            <span>
              Água: <b>{colonyState.water}</b>
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-emerald-300" title="Biomassa Cultivada">
            <Sprout className="w-4 h-4 text-emerald-400" />
            <span>
              Biomassa: <b>{colonyState.biomass}</b>
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-yellow-300" title="Energia da Colônia">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>
              Energia: <b>{colonyState.energy} kW</b>
              {playerStats.energyBonusPct > 0 && (
                <span className="text-[10px] text-cyan-300 ml-1">
                  (+{playerStats.energyBonusPct}%)
                </span>
              )}
              {isDustStorm && colonyState.buildings.solarPanels && (
                <span className="text-[10px] text-amber-300 ml-1 font-black">
                  (-50% Solar)
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 bg-slate-950/85 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-300 shadow-sm">
          {activeInputDevice === 'touch' && (
            <span>Toque: Joystick (Esq) · Pular/Jetpack, Pulso e Ação (Dir)</span>
          )}
          {activeInputDevice === 'gamepad' && (
            <span>Gamepad: Analógico Mover · [A] Salto/Jetpack · [X] Ação · [B] Pulso</span>
          )}
          {activeInputDevice === 'keyboard' && (
            <span>
              WASD Mover · Shift Correr/Jetpack · [F]/Clique Pulso Plasma · [E] Construir/Acelerar/Reparar · [T] Tech
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
