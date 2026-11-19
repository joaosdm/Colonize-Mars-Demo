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
  Terminal,
  Pickaxe,
  Rocket,
  Utensils,
  MapPin,
} from 'lucide-react';
import { BuildingKey, ColonyState, ColonyObjective } from '../sim/marsColonyLogic';
import { getMarsBiomeAt } from '../sim/marsWorld';
import { getWeaponDef } from '../sim/marsChemistry';
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
  playerPos: { x: number; z: number };
  jetpackFuel: number;
  activeEnemiesCount: number;
  isMuted: boolean;
  isMobileLayout: boolean;
  activeInputDevice: 'keyboard' | 'touch' | 'gamepad';
  coopRoomCode: string | null;
  coopPlayers: RemotePlayerState[];
  coopEventBanner: string | null;
  onToggleMute: () => void;
  onToggleThreats: () => void;
  onPause: () => void;
  onOpenTechTree: () => void;
  onOpenMissionControl: () => void;
  onExcavateCrater: () => void;
  onOpenWorkshop: () => void;
  onOpenOrbital: () => void;
  onConsumeFood: () => void;
}

export const MarsColonyHUD: React.FC<MarsColonyHUDProps> = ({
  colonyState,
  currentObjective,
  playerRoleId,
  playerPos,
  jetpackFuel,
  activeEnemiesCount,
  isMuted,
  isMobileLayout,
  activeInputDevice,
  coopRoomCode,
  coopPlayers,
  coopEventBanner,
  onToggleMute,
  onToggleThreats,
  onPause,
  onOpenTechTree,
  onOpenMissionControl,
  onExcavateCrater,
  onOpenWorkshop,
  onOpenOrbital,
  onConsumeFood,
}) => {
  const isLowO2 = colonyState.oxygen < 25;
  const isNearO2 = colonyState.isNearO2Source;
  const currentBiome = getMarsBiomeAt(playerPos.x, playerPos.z);
  const equippedWeapon = getWeaponDef(colonyState.equippedWeapon);
  const readyCropsCount = colonyState.domeCrops.filter((b) => b.readyToHarvest).length;

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
  const dailyDoneCount = colonyState.missionControl.objectives.filter((o) => o.completed).length;
  const dailyTotalCount = colonyState.missionControl.objectives.length;

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

  if (isMobileLayout) {
    return (
      <div
        data-testid="mobile-colony-hud"
        className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-start gap-1.5 overflow-hidden"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 8px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
          paddingLeft: 'max(env(safe-area-inset-left), 10px)',
          paddingRight: 'max(env(safe-area-inset-right), 10px)',
        }}
      >
        {/* Mobile Row 1: O2, Nutrition & Quick Action Buttons */}
        <div
          data-testid="mobile-hud-top-row"
          className="flex items-center justify-between gap-1 w-full pointer-events-auto"
        >
          <div className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-1 px-1.5 h-8 rounded-lg border text-[10px] font-black shadow-md tabular-nums shrink-0 ${
                isLowO2
                  ? 'bg-red-950/95 border-red-500 text-red-200'
                  : isNearO2
                  ? 'bg-emerald-950/92 border-emerald-500/70 text-emerald-200'
                  : 'bg-slate-950/92 border-slate-700 text-slate-100'
              }`}
            >
              <Zap className={`w-3 h-3 shrink-0 ${isLowO2 ? 'text-red-400' : isNearO2 ? 'text-emerald-400' : 'text-cyan-400'}`} />
              <span>{Math.round(colonyState.oxygen)}%</span>
            </div>

            <button
              type="button"
              onClick={onConsumeFood}
              disabled={colonyState.food < 1}
              aria-label={`Nutrição ${Math.round(colonyState.hunger)}% - Tocar para comer ração`}
              className={`flex items-center gap-1 px-1.5 h-8 rounded-lg border text-[10px] font-bold shadow-md tabular-nums shrink-0 cursor-pointer ${
                colonyState.hunger < 45
                  ? 'bg-amber-950/95 border-amber-400 text-amber-200'
                  : 'bg-slate-950/92 border-slate-700 text-emerald-300'
              }`}
            >
              <Utensils className="w-3 h-3 shrink-0" />
              <span>{Math.round(colonyState.hunger)}%</span>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onOpenWorkshop}
              data-testid="hud-workshop-btn"
              aria-label="Abrir Oficina: Refinaria, Arsenal e Redomas"
              className={`h-8 px-2 rounded-lg border flex items-center gap-1 text-[10px] font-black cursor-pointer shadow-md whitespace-nowrap ${
                readyCropsCount > 0
                  ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                  : 'bg-slate-950/92 border-teal-500/70 text-teal-200'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden min-[375px]:inline">Oficina</span>
              {readyCropsCount > 0 && <span className="text-[9px] text-emerald-300">+{readyCropsCount}</span>}
            </button>

            <button
              type="button"
              onClick={onOpenOrbital}
              data-testid="hud-orbital-btn"
              aria-label="Explorar Planeta com a Nave"
              className="h-8 px-2 rounded-lg border bg-sky-950/92 border-sky-400/70 text-sky-200 flex items-center gap-1 text-[10px] font-black cursor-pointer shadow-md whitespace-nowrap"
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden min-[375px]:inline">Nave</span>
            </button>

            <button
              type="button"
              onClick={onOpenMissionControl}
              data-testid="hud-mission-control-btn"
              aria-label="Abrir Mission Control Terminal"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer shadow-md shrink-0 ${
                colonyState.buildings.habitat
                  ? 'bg-cyan-950/92 border-cyan-400/70 text-cyan-200'
                  : 'bg-slate-950/92 border-slate-700 text-slate-300'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenTechTree}
              aria-label="Abrir Árvore Tecnológica"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer shadow-md shrink-0 ${
                colonyState.buildings.researchLab
                  ? 'bg-purple-950/92 border-purple-400/70 text-purple-200'
                  : 'bg-slate-950/92 border-slate-700 text-slate-300'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onPause}
              data-testid="hud-pause-btn"
              aria-label="Pausar Jogo e Qualidade"
              className="w-8 h-8 rounded-lg bg-slate-950/92 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer shadow-md shrink-0"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Row 2: Compact Horizontally Scrollable Mineral & Resource Strip */}
        <div
          data-testid="hud-resources-bar"
          className="pointer-events-auto flex items-center gap-2.5 overflow-x-auto no-scrollbar bg-slate-950/88 border border-slate-700/70 rounded-xl px-3 py-1.5 text-[10px] font-bold shadow-md tabular-nums whitespace-nowrap"
        >
          <span className="text-amber-300">Reg <b>{colonyState.regolith}</b></span>
          <span className="text-cyan-300">Gelo <b>{colonyState.waterIce}</b></span>
          <span className="text-sky-300">Água <b>{colonyState.water}</b></span>
          <span className="text-emerald-300">Alim <b>{colonyState.food}</b></span>
          <span className="text-lime-300">Bio <b>{colonyState.biomass}</b></span>
          <span className="text-slate-600">|</span>
          <span className="text-orange-300">Fe <b>{colonyState.iron}</b></span>
          <span className="text-violet-300">Ti <b>{colonyState.titanium}</b></span>
          <span className="text-teal-300">Si <b>{colonyState.silicon}</b></span>
          <span className="text-yellow-300">S <b>{colonyState.sulfur}</b></span>
          <span className="text-pink-300">H₂ <b>{colonyState.fuel}</b></span>
          <span className="text-slate-600">|</span>
          <span className="text-yellow-200">⚡<b>{colonyState.energy}kW</b></span>
        </div>

        {/* Mobile Row 3: Compact Mission + Biome + Active Alerts (keeps center 3D view clear) */}
        <div className="flex flex-col items-start gap-1.5 max-w-[270px] sm:max-w-[320px] pointer-events-auto">
          <div className="w-full bg-slate-950/85 border border-cyan-500/40 rounded-xl px-3 py-1.5 shadow-lg">
            <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wider text-cyan-400 tabular-nums">
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" style={{ color: currentBiome.accentHex }} />
                {currentBiome.name} · Crateras: {colonyState.craters.length}
              </span>
              <span className="text-slate-300 shrink-0">
                SOL {colonyState.solDay} · {Math.round(colonyState.habitability)}%
              </span>
            </div>
            <div className="text-[11px] font-bold text-white truncate mt-0.5">{displayTitle}</div>
            <div className="text-[10px] text-slate-300 truncate">{getObjectiveProgressText()}</div>
          </div>

          {colonyState.activeConstructions.slice(0, 1).map((job) => {
            const pct = Math.min(100, Math.round((job.elapsedSec / job.durationSec) * 100));
            return (
              <div
                key={job.id}
                className="w-full bg-slate-950/90 border border-amber-500/50 rounded-lg px-2.5 py-1.5 shadow-md space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-amber-300 tabular-nums">
                  <span className="truncate">{job.name}</span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}

          {isDustStorm && (
            <div
              data-testid="hud-dust-storm-alert"
              className="w-full bg-amber-950/95 border border-amber-400/80 text-amber-100 rounded-lg px-2.5 py-1.5 text-[10px] font-bold flex items-center justify-between gap-2 shadow-lg"
            >
              <span className="flex items-center gap-1 text-amber-300">
                <Wind className="w-3.5 h-3.5" />
                Tempestade (-50% Solar)
              </span>
              <span className="tabular-nums">{Math.ceil(colonyState.dustStorm.remainingSec)}s</span>
            </div>
          )}

          {coopEventBanner && (
            <div className="bg-emerald-950/92 border border-emerald-500/50 text-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg">
              {coopEventBanner}
            </div>
          )}
        </div>
      </div>
    );
  }

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

        {/* Top-Center: Habitability + Current Mars Biome + Threats Status + Co-op Room Strip */}
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

          {/* Live Mars Biome & Coordinates Strip */}
          <div
            data-testid="hud-biome-indicator"
            className="bg-slate-950/90 border border-slate-700/75 rounded-lg px-3 py-1 flex items-center gap-2 text-[11px] font-bold text-slate-200 shadow-md tabular-nums"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: currentBiome.accentHex }} />
            <span className="text-white">{currentBiome.name}</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-[10px] text-slate-400">
              {Math.round(playerPos.x)}m, {Math.round(playerPos.z)}m
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-[10px] text-amber-300">
              Crateras: {colonyState.craters.length}
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

        {/* Top-Right: O2, Jetpack, Action Bar ([G], [B], [V], [C], [T]), Mute, Pause + Role/Weapon/Nutrition Card */}
        <div className="flex flex-col items-end gap-2 shrink-0 pointer-events-auto">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold shadow-lg tabular-nums ${
                isLowO2
                  ? 'bg-red-950/95 border-red-500 text-red-200'
                  : isNearO2
                  ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-200'
                  : 'bg-slate-950/90 border-slate-700 text-slate-200'
              }`}
            >
              {isLowO2 ? (
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Zap className={`w-3.5 h-3.5 ${isNearO2 ? 'text-emerald-400' : 'text-cyan-400'}`} />
              )}
              <span className="font-black">O₂ {Math.round(colonyState.oxygen)}%</span>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-slate-200 shadow-lg tabular-nums text-xs font-bold">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-400 rounded-full"
                  style={{ width: `${Math.round(jetpackFuel)}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onExcavateCrater}
              data-testid="hud-excavate-btn"
              className="h-9 px-2.5 rounded-xl border bg-amber-950/90 border-amber-500/65 text-amber-200 hover:bg-amber-900 flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors shadow-md whitespace-nowrap"
              title="Escavar Cratera e Minérios no Solo [G]"
              aria-label="Escavar Cratera no Solo"
            >
              <Pickaxe className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Escavar</span>
              <span className="text-[10px] font-mono opacity-80">[G]</span>
            </button>

            <button
              type="button"
              onClick={onOpenWorkshop}
              data-testid="hud-workshop-btn"
              className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors shadow-md whitespace-nowrap ${
                readyCropsCount > 0
                  ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200 hover:bg-emerald-900'
                  : 'bg-slate-950/90 border-teal-500/65 text-teal-200 hover:bg-slate-900'
              }`}
              title="Refinaria Química, Arsenal e Redomas de Vidro [B]"
              aria-label="Abrir Oficina: Refinaria, Arsenal e Redomas"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Oficina</span>
              {readyCropsCount > 0 && (
                <span className="text-[10px] font-mono text-emerald-300">+{readyCropsCount}</span>
              )}
              <span className="text-[10px] font-mono opacity-80">[B]</span>
            </button>

            <button
              type="button"
              onClick={onOpenOrbital}
              data-testid="hud-orbital-btn"
              className="h-9 px-2.5 rounded-xl border bg-sky-950/90 border-sky-400/70 text-sky-200 hover:bg-sky-900 flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors shadow-md whitespace-nowrap"
              title="Explorar Marte em Órbita com a Nave Starship [V]"
              aria-label="Explorar Planeta com a Nave"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Nave</span>
              <span className="text-[10px] font-mono opacity-80">[V]</span>
            </button>

            <button
              type="button"
              onClick={onOpenMissionControl}
              data-testid="hud-mission-control-btn"
              className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors shadow-md whitespace-nowrap tabular-nums ${
                colonyState.buildings.habitat
                  ? 'bg-cyan-950/90 border-cyan-400/70 text-cyan-200 hover:bg-cyan-900'
                  : 'bg-slate-950/90 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Mission Control Terminal (Habitat) [C]"
              aria-label="Abrir Mission Control Terminal"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Missões</span>
              {colonyState.buildings.habitat && (
                <span className="text-[10px] font-mono text-cyan-300">
                  {dailyDoneCount}/{dailyTotalCount}
                </span>
              )}
              <span className="text-[10px] font-mono opacity-80">[C]</span>
            </button>

            <button
              type="button"
              onClick={onOpenTechTree}
              className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors shadow-md whitespace-nowrap ${
                colonyState.buildings.researchLab
                  ? 'bg-purple-950/90 border-purple-400/70 text-purple-200 hover:bg-purple-900'
                  : 'bg-slate-950/90 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Árvore Tecnológica [T]"
              aria-label="Abrir Árvore Tecnológica"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Tech</span>
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

          {/* Active Player Role, Nutrition, Equipped Weapon & Live Stats Strip */}
          <div
            data-testid="hud-player-stats"
            className="bg-slate-950/90 border rounded-xl px-3 py-2 shadow-lg text-[11px] max-w-xs sm:max-w-sm space-y-1.5"
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
              <button
                type="button"
                onClick={onConsumeFood}
                disabled={colonyState.food < 1}
                title="Consumir Ração da Redoma [H]"
                className={`text-[10px] font-bold flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-pointer tabular-nums ${
                  colonyState.hunger < 45
                    ? 'bg-amber-950 border-amber-500 text-amber-200'
                    : 'bg-slate-900 border-slate-700 text-emerald-300 hover:border-emerald-500'
                }`}
              >
                <Utensils className="w-3 h-3" />
                Nutrição {Math.round(colonyState.hunger)}% [H]
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 text-[10px] pb-1 border-b border-slate-800/80">
              <span className="text-slate-400">Arma [{equippedWeapon.slotKey}]:</span>
              <span className="font-black text-white flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: equippedWeapon.boltColorHex }}
                />
                {equippedWeapon.name}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px] tabular-nums">
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
                <span className="text-slate-400">Órbita</span>
                <span className="font-bold text-sky-300">
                  {colonyState.discoveredSites.length}/6
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM BAR: Full Martian Minerals, Essentials & Control Hints */}
      <div className="flex flex-wrap items-end justify-between gap-2 w-full">
        <div
          data-testid="hud-resources-bar"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-950/92 border border-slate-700/75 rounded-xl px-3.5 py-2 text-[11px] font-bold shadow-lg pointer-events-auto tabular-nums"
        >
          <div className="flex items-center gap-1 text-amber-300" title="Regolito Mineral">
            <Mountain className="w-3.5 h-3.5 text-amber-400" />
            <span>Reg: <b>{colonyState.regolith}</b></span>
          </div>
          <div className="flex items-center gap-1 text-cyan-300" title="Cristais de Gelo (H₂O)">
            <Droplet className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gelo: <b>{colonyState.waterIce}</b></span>
          </div>
          <div className="flex items-center gap-1 text-sky-300" title="Água Purificada">
            <Droplets className="w-3.5 h-3.5 text-sky-400" />
            <span>Água: <b>{colonyState.water}</b></span>
          </div>
          <div className="flex items-center gap-1 text-emerald-300" title="Alimentos da Redoma de Vidro">
            <Utensils className="w-3.5 h-3.5 text-emerald-400" />
            <span>Alim: <b>{colonyState.food}</b></span>
          </div>
          <div className="flex items-center gap-1 text-lime-300" title="Biomassa">
            <Sprout className="w-3.5 h-3.5 text-lime-400" />
            <span>Bio: <b>{colonyState.biomass}</b></span>
          </div>
          <span className="text-slate-700">|</span>
          <span className="text-orange-300" title="Minério de Ferro (Fe)">Fe: <b>{colonyState.iron}</b></span>
          <span className="text-violet-300" title="Liga de Titânio (Ti)">Ti: <b>{colonyState.titanium}</b></span>
          <span className="text-teal-300" title="Silício Cristalino (Si)">Si: <b>{colonyState.silicon}</b></span>
          <span className="text-yellow-300" title="Enxofre Vulcânico (S)">S: <b>{colonyState.sulfur}</b></span>
          <span className="text-pink-300" title="Combustível Espacial (H₂)">H₂: <b>{colonyState.fuel}</b></span>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1 text-yellow-200" title="Energia da Colônia">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span>
              <b>{colonyState.energy} kW</b>
              {isDustStorm && colonyState.buildings.solarPanels && (
                <span className="text-[10px] text-amber-300 ml-1 font-black">(-50% Solar)</span>
              )}
            </span>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-2 bg-slate-950/88 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-300 shadow-sm">
          {activeInputDevice === 'touch' && (
            <span>Toque: Joystick (Esq) · Pular/Jetpack, Pulso e Ação (Dir)</span>
          )}
          {activeInputDevice === 'gamepad' && (
            <span>Gamepad: Analógico Mover · [A] Salto/Jetpack · [X] Ação · [B] Pulso</span>
          )}
          {activeInputDevice === 'keyboard' && (
            <span>
              WASD Mover · [G] Escavar · [B] Refinaria/Armas/Redoma · [V] Nave Orbital · [1-4] Armas · [F] Disparar · [E] Ação
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
