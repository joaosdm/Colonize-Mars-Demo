/**
 * Clean, Minimalist HUD for Colonize Mars
 * Keeps >= 85% of the Martian viewport completely clear on both Desktop & Mobile:
 * - Top-Left: Concise current objective + urgent alerts only (Critical Fire, Dust Storm, Active Build)
 * - Top-Right: Compact vitals (O2, Nutrition, Habitability) + Camera View Toggle (1ªP / 3ªP) + Systems Quick Drawer + Pause
 * - Center (1ª Pessoa only): Minimal tactical FPS crosshair reticle
 * - Bottom (Desktop): Quiet single-line icon+number resource strip + active weapon chip
 */

import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
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
  FlaskConical,
  Wind,
  Terminal,
  Pickaxe,
  Rocket,
  Utensils,
  Eye,
  Video,
  LayoutGrid,
  X,
  Share2,
  Copy,
  Check,
  WifiOff,
} from 'lucide-react';
import { BuildingKey, ColonyState, ColonyObjective } from '../sim/marsColonyLogic';
import { getWeaponDef } from '../sim/marsChemistry';
import {
  BUILDING_DISPLAY_NAMES,
  getUrgentMaintenanceModules,
} from '../sim/marsWeather';
import { BUILDING_FIRE_THRESHOLD_PCT } from '../sim/buildingDurability';
import { RemotePlayerState } from '../net/coopProtocol';
import { AstronautRoleId } from '../sim/astronautRoles';
import type { CameraMode } from '../graphics/MarsSurfaceScene';

interface MarsColonyHUDProps {
  colonyState: ColonyState;
  currentObjective: ColonyObjective | null;
  playerRoleId: AstronautRoleId;
  playerPos: { x: number; z: number };
  jetpackFuel: number;
  activeEnemiesCount: number;
  cameraMode: CameraMode;
  isMuted: boolean;
  isMobileLayout: boolean;
  activeInputDevice: 'keyboard' | 'touch' | 'gamepad';
  coopRoomCode: string | null;
  coopPlayers: RemotePlayerState[];
  coopEventBanner: string | null;
  isCoopHost?: boolean;
  coopConnectionState?: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  isInviteSupported?: boolean;
  onInviteToRoom?: () => void;
  onToggleCameraMode: () => void;
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
  activeEnemiesCount,
  cameraMode,
  isMuted,
  isMobileLayout,
  coopRoomCode,
  coopPlayers,
  coopEventBanner,
  isCoopHost = false,
  coopConnectionState = 'disconnected',
  isInviteSupported = false,
  onInviteToRoom,
  onToggleCameraMode,
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
  const [systemsMenuOpen, setSystemsMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isLowO2 = colonyState.oxygen < 25;
  const isNearO2 = colonyState.isNearO2Source;
  const isFirstPerson = cameraMode === 'first-person';
  const equippedWeapon = getWeaponDef(colonyState.equippedWeapon);
  const readyCropsCount = colonyState.domeCrops.filter((b) => b.readyToHarvest).length;

  const burningBuildings = (Object.keys(colonyState.buildings) as BuildingKey[])
    .filter(
      (k) =>
        colonyState.buildings[k] &&
        colonyState.buildingHealth[k] <= BUILDING_FIRE_THRESHOLD_PCT
    )
    .map((k) => ({
      key: k,
      name: BUILDING_DISPLAY_NAMES[k],
      health: Math.max(1, Math.round(colonyState.buildingHealth[k])),
    }));

  const urgentMaintenance = getUrgentMaintenanceModules(
    colonyState.buildings,
    colonyState.buildingHealth
  );
  const isDustStorm = Boolean(colonyState.dustStorm?.isActive);
  const dailyDoneCount = colonyState.missionControl.objectives.filter((o) => o.completed).length;
  const dailyTotalCount = colonyState.missionControl.objectives.length;

  const getShortObjectiveProgress = (): string => {
    if (!currentObjective) return 'Marte Terraformado';
    switch (currentObjective.id) {
      case 'obj-1-moxie':
        return 'Construa MOXIE (-7, 4)';
      case 'obj-2-solar':
        return colonyState.regolith >= 4
          ? 'Erga Matriz Solar (8, 4)'
          : `Regolito ${colonyState.regolith}/4`;
      case 'obj-3-water':
        return `Gelo ${colonyState.waterIce}/5 · Reg ${colonyState.regolith}/2`;
      case 'obj-4-miner':
        return `Reg ${colonyState.regolith}/4 · Água ${colonyState.water}/2`;
      case 'obj-5-lab':
        return colonyState.buildings.researchLab
          ? 'Pesquise 1 Tech [T]'
          : `Reg ${colonyState.regolith}/5 · Água ${colonyState.water}/3`;
      case 'obj-6-turret':
        return `Reg ${colonyState.regolith}/4 · Água ${colonyState.water}/2`;
      case 'obj-7-biodome':
        return !colonyState.unlockedTechs.includes('tech-hydro')
          ? 'Pesquise Sementes [T]'
          : `Reg ${colonyState.regolith}/5 · Água ${colonyState.water}/4`;
      case 'obj-8-plant':
        return `Canteiros ${colonyState.cropsPlantedCount}/3`;
      case 'obj-9-habitat':
        return `Reg ${colonyState.regolith}/6 · Água ${colonyState.water}/4 · Bio ${colonyState.biomass}/2`;
      case 'obj-10-comms':
        return `Reg ${colonyState.regolith}/5 · Água ${colonyState.water}/4`;
      case 'obj-11-geothermal':
        return !colonyState.unlockedTechs.includes('tech-geothermal')
          ? 'Pesquise Geotérmica [T]'
          : `Reg ${colonyState.regolith}/6 · Água ${colonyState.water}/5`;
      case 'obj-12-terraform':
        return !colonyState.unlockedTechs.includes('tech-terraform')
          ? 'Pesquise Núcleo Atm. [T]'
          : `Reg ${colonyState.regolith}/8 · Água ${colonyState.water}/6 · Bio ${colonyState.biomass}/5`;
      default:
        return '';
    }
  };

  const shortTitle = currentObjective
    ? currentObjective.title.replace(/^\d+\.\s*/, '')
    : 'Mundo Vivo';

  const closeMenuAndRun = (fn: () => void) => {
    setSystemsMenuOpen(false);
    fn();
  };

  const activeResearch = colonyState.activeTechResearch;
  const activeResearchPct = activeResearch
    ? Math.min(100, Math.round((activeResearch.elapsedSec / activeResearch.durationSec) * 100))
    : 0;

  return (
    <div
      data-testid={isMobileLayout ? 'mobile-colony-hud' : 'desktop-colony-hud'}
      className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between overflow-hidden"
      style={{
        paddingTop: isMobileLayout
          ? 'max(env(safe-area-inset-top), 8px)'
          : 'max(env(safe-area-inset-top), 14px)',
        paddingBottom: isMobileLayout
          ? 'max(env(safe-area-inset-bottom), 8px)'
          : 'max(env(safe-area-inset-bottom), 14px)',
        paddingLeft: isMobileLayout
          ? 'max(env(safe-area-inset-left), 10px)'
          : 'max(env(safe-area-inset-left), 16px)',
        paddingRight: isMobileLayout
          ? 'max(env(safe-area-inset-right), 10px)'
          : 'max(env(safe-area-inset-right), 16px)',
      }}
    >
      {/* CENTER FIRST-PERSON RETICLE (Only visible in 1ª Pessoa) */}
      {isFirstPerson && (
        <div
          data-testid="fps-reticle"
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
          aria-hidden="true"
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <line x1="18" y1="4" x2="18" y2="12" stroke={equippedWeapon.boltColorHex} strokeWidth="2" strokeLinecap="round" />
            <line x1="18" y1="24" x2="18" y2="32" stroke={equippedWeapon.boltColorHex} strokeWidth="2" strokeLinecap="round" />
            <line x1="4" y1="18" x2="12" y2="18" stroke={equippedWeapon.boltColorHex} strokeWidth="2" strokeLinecap="round" />
            <line x1="24" y1="18" x2="32" y2="18" stroke={equippedWeapon.boltColorHex} strokeWidth="2" strokeLinecap="round" />
            <circle cx="18" cy="18" r="2.2" fill="#ffffff" />
          </svg>
        </div>
      )}

      {/* TOP BAR */}
      <div
        data-testid={isMobileLayout ? 'mobile-hud-top-row' : 'desktop-hud-top-row'}
        className={`flex w-full gap-1.5 ${
          isMobileLayout
            ? 'flex-col-reverse items-stretch'
            : 'flex-row items-start justify-between gap-2'
        }`}
      >
        {/* TOP-LEFT: Minimal Objective Card + Conditional Urgent Alerts */}
        <div
          className={`flex flex-col items-start gap-1.5 min-w-0 pointer-events-auto ${
            isMobileLayout ? 'w-full max-w-[310px]' : 'max-w-[265px] sm:max-w-[290px]'
          }`}
        >
          <div className="w-full bg-slate-950/82 border border-slate-700/70 rounded-xl px-3 py-1.5 shadow-lg">
            <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-400 tabular-nums">
              <span>SOL {colonyState.solDay}</span>
              <span className="text-slate-400">{Math.round(colonyState.habitability)}% Hab</span>
            </div>
            <div className="text-xs font-bold text-white truncate mt-0.5">{shortTitle}</div>
            <div className="text-[11px] text-slate-300 truncate">{getShortObjectiveProgress()}</div>
          </div>

          {/* Active Constructions (slim bar only while building) */}
          {colonyState.activeConstructions.slice(0, 1).map((job) => {
            const pct = Math.min(100, Math.round((job.elapsedSec / job.durationSec) * 100));
            return (
              <div
                key={job.id}
                className="w-full bg-slate-950/88 border border-amber-500/60 rounded-lg px-2.5 py-1.5 shadow-md space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-amber-300 tabular-nums">
                  <span className="flex items-center gap-1 truncate">
                    <Hammer className="w-3 h-3 shrink-0" />
                    {job.name}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}

          {/* Active Research (slim bar only while researching) */}
          {activeResearch && (
            <div className="w-full bg-slate-950/88 border border-purple-500/60 rounded-lg px-2.5 py-1.5 shadow-md space-y-1">
              <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-purple-300 tabular-nums">
                <span className="truncate">{activeResearch.name}</span>
                <span>{activeResearchPct}%</span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400 rounded-full" style={{ width: `${activeResearchPct}%` }} />
              </div>
            </div>
          )}

          {/* CRITICAL FIRE ALERT (only when a building is <= 35% HP & burning!) */}
          {burningBuildings.length > 0 && (
            <div
              data-testid="hud-fire-alert"
              className="w-full bg-red-950/95 border border-red-500 text-red-100 rounded-lg px-2.5 py-1.5 shadow-xl space-y-1"
            >
              <div className="flex items-center justify-between gap-1.5 text-[10px] font-black uppercase tracking-wide text-red-300">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  Em Chamas · Risco de Explosão
                </span>
              </div>
              {burningBuildings.slice(0, 2).map((b) => (
                <div
                  key={b.key}
                  className="flex items-center justify-between gap-2 text-[11px] font-bold tabular-nums"
                >
                  <span className="truncate text-white">{b.name}</span>
                  <span className="text-red-300 shrink-0">{b.health}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Dust Storm Alert (only when storm is active) */}
          {isDustStorm && (
            <div
              data-testid="hud-dust-storm-alert"
              className="w-full bg-amber-950/92 border border-amber-400/80 text-amber-100 rounded-lg px-2.5 py-1.5 text-[10px] font-bold shadow-lg space-y-1"
            >
              <div className="flex items-center justify-between gap-2 text-amber-300">
                <span className="flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 shrink-0" />
                  Tempestade (-50% Solar)
                </span>
                <span className="tabular-nums">{Math.ceil(colonyState.dustStorm.remainingSec)}s</span>
              </div>
              {urgentMaintenance.length > 0 && (
                <div className="text-[10px] text-amber-200 truncate">
                  Manutenção: {urgentMaintenance[0].name} ({urgentMaintenance[0].health}%)
                </div>
              )}
            </div>
          )}

          {/* Active Enemy Alert Badge (only during invasion) */}
          {activeEnemiesCount > 0 && (
            <div className="bg-red-950/90 border border-red-500/70 text-red-200 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md tabular-nums">
              <Crosshair className="w-3 h-3 text-red-400" />
              <span>{activeEnemiesCount} Inimigo(s)</span>
            </div>
          )}

          {/* Reconnecting Alert (Playgama Bridge auto-reconnect state) */}
          {coopRoomCode && coopConnectionState === 'reconnecting' && (
            <div className="bg-amber-950/92 border border-amber-400/80 text-amber-200 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg">
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Reconectando à sala Playgama...</span>
            </div>
          )}

          {/* Transient Event Notification */}
          {coopEventBanner && (
            <div className="bg-emerald-950/92 border border-emerald-500/60 text-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-lg">
              {coopEventBanner}
            </div>
          )}
        </div>

        {/* TOP-RIGHT: Compact Vitals + Camera Toggle (1ªP / 3ªP) + Systems Quick Drawer + Pause */}
        <div className="relative flex flex-col items-end gap-1.5 shrink-0 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            {/* Compact O2 & Nutrition Pill */}
            <div
              className={`h-9 px-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold shadow-lg tabular-nums ${
                isLowO2
                  ? 'bg-red-950/95 border-red-500 text-red-200'
                  : isNearO2
                  ? 'bg-emerald-950/88 border-emerald-500/65 text-emerald-200'
                  : 'bg-slate-950/82 border-slate-700/80 text-slate-100'
              }`}
            >
              <span className="flex items-center gap-1" title="Oxigênio do Traje">
                {isLowO2 ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Zap className={`w-3.5 h-3.5 ${isNearO2 ? 'text-emerald-400' : 'text-cyan-400'}`} />
                )}
                <span>{Math.round(colonyState.oxygen)}%</span>
              </span>

              <span className="text-slate-600">|</span>

              <button
                type="button"
                onClick={onConsumeFood}
                disabled={colonyState.food < 1}
                title="Consumir Ração [H]"
                aria-label={`Nutrição ${Math.round(colonyState.hunger)}%`}
                className={`flex items-center gap-1 cursor-pointer transition-colors ${
                  colonyState.hunger < 45 ? 'text-amber-300' : 'text-emerald-300 hover:text-emerald-200'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>{Math.round(colonyState.hunger)}%</span>
              </button>
            </div>

            {/* Camera Mode Toggle Button (1ª Pessoa / Normal 3ª Pessoa) */}
            <button
              type="button"
              onClick={onToggleCameraMode}
              data-testid="hud-camera-toggle-btn"
              title="Alternar Visão: 1ª Pessoa / 3ª Pessoa [X]"
              aria-label={isFirstPerson ? 'Voltar para Visão Normal (3ª Pessoa)' : 'Ativar Visão em 1ª Pessoa'}
              className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-black cursor-pointer transition-colors shadow-lg whitespace-nowrap ${
                isFirstPerson
                  ? 'bg-cyan-950/95 border-cyan-400 text-cyan-200'
                  : 'bg-slate-950/82 border-slate-700/80 text-slate-200 hover:border-cyan-500/70'
              }`}
            >
              {isFirstPerson ? (
                <Eye className="w-4 h-4 text-cyan-300" />
              ) : (
                <Video className="w-4 h-4 text-slate-300" />
              )}
              <span>{isFirstPerson ? '1ªP' : '3ªP'}</span>
            </button>

            {/* Systems Quick Menu Button (Consolidates Oficina, Nave, Tech, Missões, Escavar, Ameaças, Áudio) */}
            <button
              type="button"
              onClick={() => setSystemsMenuOpen((prev) => !prev)}
              data-testid="hud-systems-menu-btn"
              title="Abrir Sistemas da Colônia"
              aria-label="Abrir Menu de Sistemas"
              className={`relative h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors shadow-lg ${
                systemsMenuOpen
                  ? 'bg-amber-950/95 border-amber-400 text-amber-200'
                  : 'bg-slate-950/82 border-slate-700/80 text-slate-200 hover:border-slate-500'
              }`}
            >
              {systemsMenuOpen ? <X className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              <span className="hidden sm:inline">Menu</span>
              {readyCropsCount > 0 && !systemsMenuOpen && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>

            {/* Pause Button */}
            <button
              type="button"
              onClick={onPause}
              data-testid="hud-pause-btn"
              title="Pausar [P]"
              aria-label="Pausar Jogo"
              className="w-9 h-9 rounded-xl bg-slate-950/82 border border-slate-700/80 flex items-center justify-center text-slate-200 hover:text-white cursor-pointer shadow-lg shrink-0"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Systems Quick Popover Drawer (Clean, 1-click access to all colony systems without screen clutter) */}
          {systemsMenuOpen && (
            <div
              data-testid="hud-systems-drawer"
              className="w-60 bg-slate-950/96 border border-slate-700 rounded-2xl p-2.5 shadow-2xl space-y-1.5 text-xs"
            >
              <button
                type="button"
                data-testid="hud-workshop-btn"
                onClick={() => closeMenuAndRun(onOpenWorkshop)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-teal-500/40 text-teal-200 font-bold flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-400" />
                  Oficina & Redomas
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {readyCropsCount > 0 ? `+${readyCropsCount}` : '[B]'}
                </span>
              </button>

              <button
                type="button"
                data-testid="hud-orbital-btn"
                onClick={() => closeMenuAndRun(onOpenOrbital)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-500/40 text-sky-200 font-bold flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-sky-400" />
                  Explorar com Nave
                </span>
                <span className="text-[10px] font-mono text-slate-400">[V]</span>
              </button>

              <button
                type="button"
                data-testid="hud-tech-btn"
                onClick={() => closeMenuAndRun(onOpenTechTree)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-purple-500/40 text-purple-200 font-bold flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  Tecnologias
                </span>
                <span className="text-[10px] font-mono text-slate-400">[T]</span>
              </button>

              <button
                type="button"
                data-testid="hud-mission-control-btn"
                onClick={() => closeMenuAndRun(onOpenMissionControl)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-200 font-bold flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Missões Diárias
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {colonyState.buildings.habitat ? `${dailyDoneCount}/${dailyTotalCount}` : '[C]'}
                </span>
              </button>

              <button
                type="button"
                data-testid="hud-excavate-btn"
                onClick={() => closeMenuAndRun(onExcavateCrater)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-200 font-bold flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Pickaxe className="w-4 h-4 text-amber-400" />
                  Escavar Cratera
                </span>
                <span className="text-[10px] font-mono text-slate-400">[G]</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onToggleThreats}
                  className={`px-2.5 py-1.5 rounded-lg border font-bold flex items-center justify-center gap-1.5 text-[11px] cursor-pointer ${
                    colonyState.threatsEnabled
                      ? 'bg-red-950/80 border-red-500/50 text-red-200'
                      : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                  }`}
                >
                  {colonyState.threatsEnabled ? (
                    <Crosshair className="w-3.5 h-3.5" />
                  ) : (
                    <Shield className="w-3.5 h-3.5" />
                  )}
                  <span>{colonyState.threatsEnabled ? 'Ameaças' : 'Pacífico'}</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleMute}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1.5 text-[11px] cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isMuted ? 'Mudo' : 'Som'}</span>
                </button>
              </div>

              {/* Compact Mineral Inventory Inside Drawer (great for mobile!) */}
              {isMobileLayout && (
                <div className="pt-1.5 border-t border-slate-800 grid grid-cols-4 gap-1 text-[10px] font-bold tabular-nums text-center">
                  <span className="text-amber-300">Reg {colonyState.regolith}</span>
                  <span className="text-cyan-300">Gelo {colonyState.waterIce}</span>
                  <span className="text-sky-300">H₂O {colonyState.water}</span>
                  <span className="text-emerald-300">Alim {colonyState.food}</span>
                  <span className="text-orange-300">Fe {colonyState.iron}</span>
                  <span className="text-violet-300">Ti {colonyState.titanium}</span>
                  <span className="text-teal-300">Si {colonyState.silicon}</span>
                  <span className="text-yellow-300">⚡{colonyState.energy}</span>
                </div>
              )}

              {coopRoomCode && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold">
                    <span className="flex items-center gap-1 min-w-0">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono truncate">{coopRoomCode}</span>
                      {isCoopHost && (
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-200">
                          Host
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums shrink-0">{coopPlayers.length}/3</span>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(coopRoomCode).catch(() => {});
                        setCopiedCode(true);
                        window.setTimeout(() => setCopiedCode(false), 1800);
                      }}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1 text-[11px] cursor-pointer"
                    >
                      {copiedCode ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedCode ? 'Copiado!' : 'Copiar Código'}</span>
                    </button>

                    {isInviteSupported && onInviteToRoom && (
                      <button
                        type="button"
                        onClick={() => closeMenuAndRun(onInviteToRoom)}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 font-bold flex items-center justify-center gap-1 text-[11px] cursor-pointer"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>Convidar</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM BAR (Desktop only — ultra-clean single-line resources + active weapon chip) */}
      {!isMobileLayout && (
        <div className="flex items-end justify-between gap-2 w-full">
          <div
            data-testid="hud-resources-bar"
            className="flex items-center gap-3 bg-slate-950/76 border border-slate-800/80 rounded-xl px-3 py-1.5 text-[11px] font-bold shadow-lg pointer-events-auto tabular-nums"
          >
            <span className="flex items-center gap-1 text-amber-300" title="Regolito">
              <Mountain className="w-3.5 h-3.5 text-amber-400" />
              {colonyState.regolith}
            </span>
            <span className="flex items-center gap-1 text-cyan-300" title="Gelo">
              <Droplet className="w-3.5 h-3.5 text-cyan-400" />
              {colonyState.waterIce}
            </span>
            <span className="flex items-center gap-1 text-sky-300" title="Água">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              {colonyState.water}
            </span>
            <span className="flex items-center gap-1 text-emerald-300" title="Alimentos">
              <Utensils className="w-3.5 h-3.5 text-emerald-400" />
              {colonyState.food}
            </span>
            <span className="flex items-center gap-1 text-lime-300" title="Biomassa">
              <Sprout className="w-3.5 h-3.5 text-lime-400" />
              {colonyState.biomass}
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-orange-300" title="Ferro">Fe {colonyState.iron}</span>
            <span className="text-violet-300" title="Titânio">Ti {colonyState.titanium}</span>
            <span className="text-teal-300" title="Silício">Si {colonyState.silicon}</span>
            <span className="text-yellow-300" title="Enxofre">S {colonyState.sulfur}</span>
            <span className="text-pink-300" title="Combustível H₂">H₂ {colonyState.fuel}</span>
            <span className="text-slate-700">|</span>
            <span className="text-yellow-200" title="Energia da Colônia">⚡{colonyState.energy}kW</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/76 border border-slate-800/80 rounded-xl px-3 py-1.5 text-[11px] font-bold text-slate-200 shadow-lg pointer-events-auto">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: equippedWeapon.boltColorHex }}
            />
            <span>{equippedWeapon.name}</span>
            {urgentMaintenance.length > 0 && burningBuildings.length === 0 && (
              <span className="flex items-center gap-1 text-amber-300 pl-1 border-l border-slate-700">
                <Wrench className="w-3 h-3" />
                {urgentMaintenance.length}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
